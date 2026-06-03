"""
Scalability Infrastructure - support for 2 billion+ users
Includes database sharding, caching, load balancing, and CDN optimization.
"""
import logging
import hashlib
import json
from typing import Dict, List, Tuple, Optional, Any
from enum import Enum
import redis
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ShardingStrategy(Enum):
    """Different sharding strategies."""
    CONSISTENT_HASH = "consistent_hash"
    RANGE_BASED = "range_based"
    DIRECTORY_BASED = "directory_based"
    GEOGRAPHIC = "geographic"


class ShardManager:
    """Manage database sharding for horizontal scaling."""
    
    def __init__(self, shard_count: int = 256, strategy: ShardingStrategy = ShardingStrategy.CONSISTENT_HASH):
        self.shard_count = shard_count
        self.strategy = strategy
        self.shard_map = {}  # Shard index -> connection details
        self.ring = None  # Consistent hash ring
        
        if strategy == ShardingStrategy.CONSISTENT_HASH:
            self._init_consistent_hash()
    
    def _init_consistent_hash(self):
        """Initialize consistent hashing ring."""
        from bisect import bisect_right
        
        self.ring = []
        for i in range(self.shard_count):
            hash_val = int(hashlib.md5(f"shard_{i}".encode()).hexdigest(), 16)
            self.ring.append((hash_val, i))
        
        self.ring.sort()
    
    def get_shard(self, key: str) -> int:
        """Get shard index for key using chosen strategy."""
        if self.strategy == ShardingStrategy.CONSISTENT_HASH:
            return self._get_shard_consistent_hash(key)
        elif self.strategy == ShardingStrategy.RANGE_BASED:
            return self._get_shard_range(key)
        else:
            # Default to hash-based
            return hash(key) % self.shard_count
    
    def _get_shard_consistent_hash(self, key: str) -> int:
        """Consistent hashing shard selection."""
        from bisect import bisect_right
        
        if not self.ring:
            return 0
        
        hash_val = int(hashlib.md5(key.encode()).hexdigest(), 16)
        idx = bisect_right([h for h, _ in self.ring], hash_val)
        
        if idx == len(self.ring):
            idx = 0
        
        return self.ring[idx][1]
    
    def _get_shard_range(self, key: str) -> int:
        """Range-based sharding (first char of user_id)."""
        if not key:
            return 0
        first_char = ord(key[0])
        return first_char % self.shard_count
    
    def get_connection_string(self, key: str) -> str:
        """Get database connection string for shard."""
        shard_idx = self.get_shard(key)
        return f"postgresql://user:pass@shard-{shard_idx}.db.internal/bitese_shard_{shard_idx}"


class CacheManager:
    """Distributed caching using Redis for performance."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.cache_ttl = {
            'user_profile': 3600,      # 1 hour
            'messages': 1800,          # 30 minutes
            'conversations': 1800,
            'contacts': 7200,          # 2 hours
            'encryption_keys': 300,    # 5 minutes
        }
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get value from cache."""
        try:
            value = self.redis.get(key)
            if value and isinstance(value, str):
                return json.loads(value) if value.startswith(('{', '[')) else value
            return default
        except Exception as e:
            logger.error(f"Cache get failed: {e}")
            return default
    
    def set(self, key: str, value: Any, cache_type: str = 'default', ex: Optional[int] = None):
        """Set value in cache with TTL."""
        try:
            ttl = ex or self.cache_ttl.get(cache_type, 3600)
            serialized = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
            self.redis.setex(key, ttl, serialized)
        except Exception as e:
            logger.error(f"Cache set failed: {e}")
    
    def delete(self, key: str):
        """Delete from cache."""
        try:
            self.redis.delete(key)
        except Exception as e:
            logger.error(f"Cache delete failed: {e}")
    
    def invalidate_pattern(self, pattern: str):
        """Invalidate all keys matching pattern."""
        try:
            keys = self.redis.keys(pattern)
            if keys:
                self.redis.delete(*keys)
        except Exception as e:
            logger.error(f"Cache invalidate pattern failed: {e}")
    
    def get_multi(self, keys: List[str]) -> Dict[str, Any]:
        """Get multiple values."""
        try:
            values = self.redis.mget(keys)
            result = {}
            for key, value in zip(keys, values):
                if value and isinstance(value, str):
                    result[key] = json.loads(value) if value.startswith('{') else value
            return result
        except Exception as e:
            logger.error(f"Cache get_multi failed: {e}")
            return {}
    
    def set_multi(self, data: Dict[str, Any], cache_type: str = 'default'):
        """Set multiple values."""
        try:
            ttl = self.cache_ttl.get(cache_type, 3600)
            pipe = self.redis.pipeline()
            for key, value in data.items():
                serialized = json.dumps(value) if isinstance(value, (dict, list)) else str(value)
                pipe.setex(key, ttl, serialized)
            pipe.execute()
        except Exception as e:
            logger.error(f"Cache set_multi failed: {e}")


class ConnectionPoolManager:
    """Manage database connections with pooling."""
    
    def __init__(self, min_size: int = 10, max_size: int = 100):
        self.min_size = min_size
        self.max_size = max_size
        self.pools = {}  # connection_string -> pool
    
    def get_pool(self, connection_string: str):
        """Get or create connection pool."""
        if connection_string not in self.pools:
            try:
                from sqlalchemy import create_engine
                self.pools[connection_string] = create_engine(
                    connection_string,
                    pool_size=self.min_size,
                    max_overflow=self.max_size - self.min_size,
                    pool_pre_ping=True,
                    pool_recycle=3600,
                )
            except Exception as e:
                logger.error(f"Failed to create connection pool: {e}")
        
        return self.pools.get(connection_string)


class LoadBalancer:
    """Simple load balancer for distributing requests."""
    
    def __init__(self, servers: List[str]):
        self.servers = servers
        self.current_idx = 0
    
    def get_next_server(self) -> str:
        """Round-robin server selection."""
        server = self.servers[self.current_idx]
        self.current_idx = (self.current_idx + 1) % len(self.servers)
        return server
    
    def get_server_for_key(self, key: str) -> str:
        """Consistent hash-based server selection."""
        idx = hash(key) % len(self.servers)
        return self.servers[idx]


class CDNManager:
    """Manage CDN for media distribution."""
    
    def __init__(self, cdn_url: str = "https://cdn.bitese.local"):
        self.cdn_url = cdn_url
        self.cache_manifest = {}  # Local cache index
    
    def get_cdn_url(self, file_path: str, file_type: str = 'media') -> str:
        """Get CDN URL for file."""
        # Optimize based on file type
        if file_type == 'image':
            return f"{self.cdn_url}/img/{file_path}"
        elif file_type == 'video':
            return f"{self.cdn_url}/vid/{file_path}"
        elif file_type == 'audio':
            return f"{self.cdn_url}/aud/{file_path}"
        else:
            return f"{self.cdn_url}/{file_path}"
    
    def prefetch_to_edge(self, file_path: str, regions: List[str]):
        """Pre-cache file to edge nodes."""
        for region in regions:
            # This would call CDN API in production
            logger.info(f"Prefetching {file_path} to region {region}")


class MessageQueue:
    """Distributed message queue for async processing."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis = redis.from_url(redis_url, decode_responses=True)
    
    def enqueue(self, queue_name: str, task: Dict, priority: int = 0):
        """Add task to queue."""
        try:
            self.redis.zadd(queue_name, {json.dumps(task): priority})
        except Exception as e:
            logger.error(f"Queue enqueue failed: {e}")
    
    def dequeue(self, queue_name: str, count: int = 1) -> List[Dict]:
        """Get tasks from queue."""
        try:
            tasks = self.redis.zrange(queue_name, 0, count - 1)
            if tasks:
                self.redis.zremrangebyrank(queue_name, 0, count - 1)
            result: List[Dict] = []
            for task in tasks:
                if isinstance(task, str):
                    result.append(json.loads(task))
            return result
        except Exception as e:
            logger.error(f"Queue dequeue failed: {e}")
            return []
    
    def get_queue_size(self, queue_name: str) -> int:
        """Get queue size."""
        try:
            return self.redis.zcard(queue_name)
        except Exception as e:
            logger.error(f"Queue get_queue_size failed: {e}")
            return 0


class MetricsCollector:
    """Collect performance metrics for monitoring."""
    
    def __init__(self, redis_url: str = "redis://localhost:6379/0"):
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.metrics = {}
    
    def increment_counter(self, metric_name: str, value: int = 1, tags: Optional[Dict] = None):
        """Increment counter metric."""
        key = f"metric:{metric_name}"
        if tags:
            tag_str = ",".join(f"{k}={v}" for k, v in tags.items())
            key = f"{key}[{tag_str}]"
        
        try:
            self.redis.incr(key)
            self.redis.expire(key, 86400)  # 24 hour retention
        except Exception as e:
            logger.error(f"Metric increment failed: {e}")
    
    def record_histogram(self, metric_name: str, value: float, tags: Optional[Dict] = None):
        """Record histogram metric."""
        key = f"histogram:{metric_name}"
        if tags:
            tag_str = ",".join(f"{k}={v}" for k, v in tags.items())
            key = f"{key}[{tag_str}]"
        
        try:
            self.redis.lpush(key, value)
            self.redis.expire(key, 3600)  # 1 hour retention
        except Exception as e:
            logger.error(f"Metric histogram failed: {e}")
    
    def get_metrics(self, prefix: str = "") -> Dict:
        """Get all metrics."""
        try:
            keys = self.redis.keys(f"metric:{prefix}*")
            metrics = {}
            for key in keys:
                metrics[key] = self.redis.get(key)
            return metrics
        except Exception as e:
            logger.error(f"Get metrics failed: {e}")
            return {}


class AutoScalingManager:
    """Manage auto-scaling based on metrics."""
    
    def __init__(self, metrics: MetricsCollector):
        self.metrics = metrics
        self.scale_thresholds = {
            'cpu_usage': 70,      # %
            'memory_usage': 80,   # %
            'request_rate': 10000, # req/sec
            'queue_size': 50000,  # tasks
        }
    
    def evaluate_scaling_need(self) -> Tuple[bool, str]:
        """Check if scaling is needed."""
        metrics = self.metrics.get_metrics()
        
        for threshold_name, threshold_value in self.scale_thresholds.items():
            metric_key = f"metric:{threshold_name}"
            current_value = float(metrics.get(metric_key, 0))
            
            if current_value > threshold_value:
                return True, f"{threshold_name} exceeded: {current_value} > {threshold_value}"
        
        return False, "No scaling needed"


class DataPartitioning:
    """Partition data across multiple tables for performance."""
    
    @staticmethod
    def get_partition_key(user_id: str, partition_count: int = 100) -> int:
        """Get partition key for user."""
        return hash(user_id) % partition_count
    
    @staticmethod
    def get_table_name(base_name: str, user_id: str, partition_count: int = 100) -> str:
        """Get partitioned table name."""
        partition = DataPartitioning.get_partition_key(user_id, partition_count)
        return f"{base_name}_p{partition}"
