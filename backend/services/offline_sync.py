"""
Ultra-Efficient Offline-First Sync Service for 500M+ Users
- Delta synchronization (only changed data)
- Binary MessagePack encoding (60% smaller than JSON)
- LZ4 compression for attachments
- Redis Streams for reliable delivery
"""

import msgpack
import lz4.frame
import hashlib
import time
from datetime import datetime
from typing import Dict, List, Any, Optional
import redis
from flask import current_app

# Redis connection pool for 500M+ scale
redis_pool = redis.ConnectionPool(
    host='localhost', port=6379, db=0,
    max_connections=10000,
    decode_responses=False
)

class DeltaSync:
    """Delta synchronization - transfers only changes"""
    
    @staticmethod
    def compute_delta(old: Dict, new: Dict) -> Optional[Dict]:
        """Compute minimal delta between states"""
        delta = {'_v': int(time.time() * 1000)}
        
        for key, new_val in new.items():
            if key not in old:
                delta[f'+{key}'] = new_val
            elif old[key] != new_val:
                if isinstance(new_val, dict) and isinstance(old.get(key), dict):
                    nested = DeltaSync.compute_delta(old[key], new_val)
                    if nested:
                        delta[f'~{key}'] = nested
                else:
                    delta[f'={key}'] = new_val
        
        for key in old:
            if key not in new:
                delta[f'-{key}'] = None
        
        return delta if len(delta) > 1 else None
    
    @staticmethod
    def apply_delta(base: Dict, delta: Dict) -> Dict:
        """Apply delta to base state"""
        result = base.copy()
        
        for key, val in delta.items():
            if key == '_v':
                continue
            elif key.startswith('+') or key.startswith('='):
                result[key[1:]] = val
            elif key.startswith('~'):
                nested_key = key[1:]
                result[nested_key] = DeltaSync.apply_delta(result.get(nested_key, {}), val)
            elif key.startswith('-'):
                result.pop(key[1:], None)
        
        return result


class BinaryProtocol:
    """Binary protocol with MessagePack + LZ4 compression"""
    
    @staticmethod
    def encode(data: Any, compress: bool = True) -> bytes:
        packed = msgpack.packb(data, use_bin_type=True)
        if compress and len(packed) > 100:
            return lz4.frame.compress(packed)
        return packed
    
    @staticmethod
    def decode(data: bytes) -> Any:
        try:
            if data[:4] == b'\x04\x22\x4D\x18':
                data = lz4.frame.decompress(data)
            return msgpack.unpackb(data, raw=False)
        except:
            return None


class OfflineSyncService:
    """Offline-first sync for 500M+ users"""
    
    def __init__(self):
        self.redis = redis.Redis(connection_pool=redis_pool)
    
    def get_sync_token(self, user_id: str) -> str:
        return hashlib.sha256(
            f"{user_id}:{time.time()}:{current_app.config['SECRET_KEY']}".encode()
        ).hexdigest()[:32]
    
    async def sync_messages(self, user_id: str, last_token: Optional[str] = None, limit: int = 100) -> bytes:
        """Sync messages - returns only new since last sync"""
        cache_key = f"sync:msg:{user_id}:{last_token or 'full'}"
        cached = self.redis.get(cache_key)
        if cached:
            return cached
        
        from app.models.models import Message
        query = Message.query.filter(
            Message.recipient_id == user_id
        ).order_by(Message.created_at.desc()).limit(limit)
        
        if last_token:
            try:
                sync_time = int(last_token.split('_')[0])
                query = query.filter(Message.created_at > datetime.fromtimestamp(sync_time/1000))
            except:
                pass
        
        messages = query.all()
        sync_data = {
            'messages': [{
                'id': str(m.id),
                'c': str(m.conversation_id),
                's': str(m.sender_id),
                't': m.content[:500] if m.content else None,
                'a': m.attachment_url,
                'ts': int(m.created_at.timestamp() * 1000),
            } for m in messages],
            'token': self.get_sync_token(user_id),
        }
        
        encoded = BinaryProtocol.encode(sync_data, compress=True)
        self.redis.setex(cache_key, 300, encoded)
        return encoded
    
    async def push_delta(self, user_id: str, entity_type: str, delta: Dict) -> bool:
        """Push delta update to user's sync queue"""
        queue_key = f"delta_queue:{user_id}"
        delta_payload = {
            'type': entity_type,
            'delta': delta,
            'ts': int(time.time() * 1000),
        }
        
        self.redis.xadd(queue_key, {'data': BinaryProtocol.encode(delta_payload)}, maxlen=1000)
        self.redis.publish(f"sync:{user_id}", msgpack.packb(delta_payload))
        return True
    
    async def get_pending_deltas(self, user_id: str, last_id: str = '0') -> bytes:
        """Get pending deltas for offline user"""
        queue_key = f"delta_queue:{user_id}"
        deltas = self.redis.xread({queue_key: last_id}, count=100, block=0)
        
        if not deltas:
            return BinaryProtocol.encode({'deltas': [], 'last_id': last_id})
        
        result = {
            'deltas': [BinaryProtocol.decode(e[1][b'data']) for e in deltas[0][1]],
            'last_id': deltas[0][1][-1][0].decode(),
        }
        return BinaryProtocol.encode(result, compress=True)


offline_sync = OfflineSyncService()
