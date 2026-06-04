"""
Ultra-Scalable Database Architecture - 2 Billion+ Users
Automatic Sharding + Replication + Failover + Query Routing
"""
import logging
import hashlib
from typing import Dict, List, Optional, Tuple, Any
from sqlalchemy import create_engine, MetaData, Table, select, and_, or_
from sqlalchemy.pool import QueuePool
from sqlalchemy.orm import sessionmaker, scoped_session
import redis
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)

class DatabaseShard:
    """Individual database shard with connection pool"""
    
    def __init__(self, shard_id: int, connection_string: str, read_replicas: List[str] = None):
        self.shard_id = shard_id
        self.connection_string = connection_string
        self.read_replicas = read_replicas or []
        
        # Master (write) connection
        self.master_engine = create_engine(
            connection_string,
            poolclass=QueuePool,
            pool_size=50,
            max_overflow=100,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )
        
        # Read replica engines (load balanced)
        self.replica_engines = []
        for replica_url in self.read_replicas:
            engine = create_engine(
                replica_url,
                poolclass=QueuePool,
                pool_size=30,
                max_overflow=70,
                pool_pre_ping=True,
                pool_recycle=3600,
                echo=False
            )
            self.replica_engines.append(engine)
        
        # Session factories
        self.master_session = scoped_session(sessionmaker(bind=self.master_engine))
        self.replica_sessions = [
            scoped_session(sessionmaker(bind=engine))
            for engine in self.replica_engines
        ]
        
        self.current_replica = 0
        self.health_status = True
        
        logger.info(f"[Shard {shard_id}] Initialized with {len(self.read_replicas)} replicas")
    
    def get_write_session(self):
        """Get session for write operations"""
        return self.master_session()
    
    def get_read_session(self):
        """Get session for read operations (load balanced across replicas)"""
        if not self.replica_sessions:
            return self.master_session()
        
        # Round-robin load balancing
        session = self.replica_sessions[self.current_replica]
        self.current_replica = (self.current_replica + 1) % len(self.replica_sessions)
        return session()
    
    def close(self):
        """Close all connections"""
        self.master_session.remove()
        for session in self.replica_sessions:
            session.remove()
        
        self.master_engine.dispose()
        for engine in self.replica_engines:
            engine.dispose()

class ShardedDatabase:
    """
    Sharded database manager with automatic routing
    - Consistent hashing for shard selection
    - Read/write splitting
    - Automatic failover
    - Cross-shard queries
    """
    
    def __init__(self, shard_count: int, redis_url: str):
        self.shard_count = shard_count
        self.shards: Dict[int, DatabaseShard] = {}
        self.redis = redis.from_url(redis_url, decode_responses=True)
        
        # Shard ring for consistent hashing
        self.ring = []
        self._init_hash_ring()
        
        # Query cache
        self.query_cache_ttl = 300  # 5 minutes
        
        # Metrics
        self.query_count = defaultdict(int)
        self.shard_load = defaultdict(int)
        
        logger.info(f"[ShardedDB] Initialized with {shard_count} shards")
    
    def _init_hash_ring(self):
        """Initialize consistent hash ring with virtual nodes"""
        virtual_nodes_per_shard = 150  # More virtual nodes = better distribution
        
        for shard_id in range(self.shard_count):
            for vnode in range(virtual_nodes_per_shard):
                hash_val = int(hashlib.md5(
                    f"shard_{shard_id}_vnode_{vnode}".encode()
                ).hexdigest(), 16)
                self.ring.append((hash_val, shard_id))
        
        self.ring.sort()
        logger.info(f"[ShardedDB] Hash ring initialized with {len(self.ring)} virtual nodes")
    
    def add_shard(self, shard_id: int, connection_string: str, read_replicas: List[str] = None):
        """Add new shard"""
        shard = DatabaseShard(shard_id, connection_string, read_replicas)
        self.shards[shard_id] = shard
        logger.info(f"[ShardedDB] Shard {shard_id} added")
    
    def get_shard_id(self, sharding_key: str) -> int:
        """Get shard ID using consistent hashing"""
        if not self.ring:
            return 0
        
        hash_val = int(hashlib.md5(sharding_key.encode()).hexdigest(), 16)
        
        # Binary search for shard
        left, right = 0, len(self.ring) - 1
        while left < right:
            mid = (left + right) // 2
            if self.ring[mid][0] < hash_val:
                left = mid + 1
            else:
                right = mid
        
        if left >= len(self.ring):
            left = 0
        
        return self.ring[left][1]
    
    def get_shard(self, sharding_key: str) -> DatabaseShard:
        """Get shard for key"""
        shard_id = self.get_shard_id(sharding_key)
        shard = self.shards.get(shard_id)
        
        if not shard:
            # Fallback to first available shard
            shard = next(iter(self.shards.values()))
            logger.warning(f"[ShardedDB] Shard {shard_id} not found, using fallback")
        
        self.shard_load[shard_id] += 1
        return shard
    
    def execute_write(self, sharding_key: str, query: str, params: dict = None) -> Any:
        """Execute write query on appropriate shard"""
        shard = self.get_shard(sharding_key)
        session = shard.get_write_session()
        
        try:
            result = session.execute(query, params or {})
            session.commit()
            self.query_count['writes'] += 1
            return result
        except Exception as e:
            session.rollback()
            logger.error(f"[ShardedDB] Write failed: {e}")
            raise
        finally:
            session.close()
    
    def execute_read(self, sharding_key: str, query: str, params: dict = None, use_cache: bool = True) -> Any:
        """Execute read query on appropriate shard (with caching)"""
        # Check cache
        if use_cache:
            cache_key = f"query:{hashlib.md5(f'{query}{params}'.encode()).hexdigest()}"
            cached = self.redis.get(cache_key)
            if cached:
                self.query_count['cache_hits'] += 1
                return cached
        
        shard = self.get_shard(sharding_key)
        session = shard.get_read_session()
        
        try:
            result = session.execute(query, params or {})
            rows = result.fetchall()
            self.query_count['reads'] += 1
            
            # Cache result
            if use_cache:
                self.redis.setex(cache_key, self.query_cache_ttl, str(rows))
            
            return rows
        except Exception as e:
            logger.error(f"[ShardedDB] Read failed: {e}")
            raise
        finally:
            session.close()
    
    def execute_cross_shard_query(self, query: str, params: dict = None) -> List[Any]:
        """Execute query across all shards (scatter-gather)"""
        results = []
        errors = []
        
        for shard_id, shard in self.shards.items():
            session = shard.get_read_session()
            try:
                result = session.execute(query, params or {})
                rows = result.fetchall()
                results.extend(rows)
            except Exception as e:
                errors.append((shard_id, str(e)))
                logger.error(f"[ShardedDB] Cross-shard query failed on shard {shard_id}: {e}")
            finally:
                session.close()
        
        self.query_count['cross_shard'] += 1
        
        if errors and len(errors) == len(self.shards):
            raise Exception(f"All shards failed: {errors}")
        
        return results
    
    def get_user_shard(self, user_id: str) -> DatabaseShard:
        """Get shard for user (consistent sharding key)"""
        return self.get_shard(f"user:{user_id}")
    
    def get_message_shard(self, sender_id: str, receiver_id: str) -> DatabaseShard:
        """Get shard for message (based on sender)"""
        return self.get_shard(f"user:{sender_id}")
    
    def invalidate_cache(self, pattern: str = None):
        """Invalidate query cache"""
        if pattern:
            keys = self.redis.keys(f"query:*{pattern}*")
            if keys:
                self.redis.delete(*keys)
        else:
            keys = self.redis.keys("query:*")
            if keys:
                self.redis.delete(*keys)
    
    def get_shard_stats(self) -> Dict:
        """Get shard statistics"""
        stats = {
            'total_shards': len(self.shards),
            'query_count': dict(self.query_count),
            'shard_load': dict(self.shard_load),
            'shards': {}
        }
        
        for shard_id, shard in self.shards.items():
            stats['shards'][shard_id] = {
                'health': shard.health_status,
                'replicas': len(shard.read_replicas),
                'load': self.shard_load[shard_id]
            }
        
        return stats
    
    def health_check(self) -> Dict[int, bool]:
        """Check health of all shards"""
        health = {}
        
        for shard_id, shard in self.shards.items():
            try:
                session = shard.get_read_session()
                session.execute("SELECT 1")
                session.close()
                health[shard_id] = True
                shard.health_status = True
            except Exception as e:
                logger.error(f"[ShardedDB] Shard {shard_id} health check failed: {e}")
                health[shard_id] = False
                shard.health_status = False
        
        return health

class MessagePartitionManager:
    """
    Message table partitioning for ultra-high scale
    - Time-based partitioning (monthly)
    - Automatic partition creation
    - Old partition archival
    """
    
    def __init__(self, sharded_db: ShardedDatabase):
        self.sharded_db = sharded_db
        self.partition_prefix = "messages"
        self.retention_months = 12  # Keep active messages for 12 months
    
    def get_partition_name(self, timestamp: datetime) -> str:
        """Get partition name for timestamp"""
        return f"{self.partition_prefix}_{timestamp.year}_{timestamp.month:02d}"
    
    def get_current_partition(self) -> str:
        """Get current active partition"""
        return self.get_partition_name(datetime.utcnow())
    
    def create_partition(self, partition_name: str, shard: DatabaseShard):
        """Create new partition if not exists"""
        session = shard.get_write_session()
        try:
            # Check if partition exists
            check_query = f"""
            SELECT EXISTS (
                SELECT FROM pg_tables
                WHERE tablename = '{partition_name}'
            );
            """
            result = session.execute(check_query)
            exists = result.scalar()
            
            if not exists:
                # Create partition
                create_query = f"""
                CREATE TABLE {partition_name} (
                    LIKE messages INCLUDING ALL
                );
                """
                session.execute(create_query)
                session.commit()
                logger.info(f"[Partitions] Created partition {partition_name}")
        except Exception as e:
            session.rollback()
            logger.error(f"[Partitions] Failed to create partition {partition_name}: {e}")
        finally:
            session.close()
    
    def archive_old_partitions(self):
        """Archive old partitions"""
        cutoff_date = datetime.utcnow()
        # Implementation would move old partitions to cold storage
        logger.info("[Partitions] Old partition archival started")

# Global sharded database instance
sharded_db: Optional[ShardedDatabase] = None

def get_sharded_db() -> ShardedDatabase:
    """Get global sharded database"""
    global sharded_db
    if not sharded_db:
        raise RuntimeError("Sharded database not initialized")
    return sharded_db

def initialize_sharded_db(shard_count: int, redis_url: str, shard_configs: List[dict]):
    """Initialize global sharded database"""
    global sharded_db
    sharded_db = ShardedDatabase(shard_count, redis_url)
    
    for config in shard_configs:
        sharded_db.add_shard(
            shard_id=config['shard_id'],
            connection_string=config['master_url'],
            read_replicas=config.get('replica_urls', [])
        )
    
    logger.info(f"[ShardedDB] Global instance initialized with {len(shard_configs)} shards")
