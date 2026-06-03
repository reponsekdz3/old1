from redis import Redis
from functools import wraps
import json
import os

redis_client = None
if os.getenv('REDIS_URL'):
    try:
        redis_client = Redis.from_url(os.getenv('REDIS_URL'), decode_responses=True)
    except:
        pass

def cache_result(ttl=300):
    """Cache function results in Redis for scalability"""
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            if not redis_client:
                return func(*args, **kwargs)
            
            cache_key = f"{func.__name__}:{str(args)}:{str(kwargs)}"
            cached = redis_client.get(cache_key)
            
            if cached:
                return json.loads(cached)
            
            result = func(*args, **kwargs)
            redis_client.setex(cache_key, ttl, json.dumps(result))
            return result
        return wrapper
    return decorator

class ConnectionPool:
    """Manage WebSocket connections for horizontal scaling"""
    def __init__(self):
        self.connections = {}
    
    def add(self, user_id, sid):
        if not redis_client:
            self.connections[user_id] = sid
            return
        redis_client.hset('ws_connections', user_id, sid)
    
    def remove(self, user_id):
        if not redis_client:
            self.connections.pop(user_id, None)
            return
        redis_client.hdel('ws_connections', user_id)
    
    def get(self, user_id):
        if not redis_client:
            return self.connections.get(user_id)
        return redis_client.hget('ws_connections', user_id)

pool = ConnectionPool()
