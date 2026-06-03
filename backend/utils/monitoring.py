from functools import wraps
from time import time
from .logger import logger

class PerformanceMonitor:
    def __init__(self):
        self.metrics = {}
    
    def track(self, endpoint):
        def decorator(func):
            @wraps(func)
            def wrapper(*args, **kwargs):
                start = time()
                try:
                    result = func(*args, **kwargs)
                    duration = time() - start
                    logger.info(f"⏱️ {endpoint} completed in {duration:.3f}s")
                    return result
                except Exception as e:
                    duration = time() - start
                    logger.error(f"❌ {endpoint} failed after {duration:.3f}s: {str(e)}")
                    raise
            return wrapper
        return decorator

monitor = PerformanceMonitor()
