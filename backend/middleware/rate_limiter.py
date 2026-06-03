from functools import wraps
from flask import request, jsonify
from time import time
from collections import defaultdict

class GlobalRateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
        self.blocked = {}
    
    def is_allowed(self, key, limit, window):
        now = time()
        
        # Check if blocked
        if key in self.blocked and self.blocked[key] > now:
            return False
        
        # Clean old requests
        self.requests[key] = [t for t in self.requests[key] if now - t < window]
        
        # Check limit
        if len(self.requests[key]) >= limit:
            return False
        
        self.requests[key].append(now)
        return True
    
    def block(self, key, duration=300):
        self.blocked[key] = time() + duration

limiter = GlobalRateLimiter()

def rate_limit(limit=100, window=60):
    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            ip = request.headers.get('X-Forwarded-For', request.remote_addr)
            key = f"{ip}:{request.endpoint}"
            
            if not limiter.is_allowed(key, limit, window):
                return jsonify({'error': 'Rate limit exceeded'}), 429
            
            return func(*args, **kwargs)
        return wrapper
    return decorator
