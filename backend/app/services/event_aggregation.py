"""
Rate-Limited Event Aggregation Service
Optimizes real-time events (typing, presence, status) for massive scale
"""
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Callable, Any
from dataclasses import dataclass, field
from collections import defaultdict, deque
import threading
import redis
import json

logger = logging.getLogger(__name__)

@dataclass
class RateLimitConfig:
    """Rate limit configuration"""
    max_events_per_window: int
    window_seconds: int
    aggregation_window_ms: int
    max_burst: int = 10

@dataclass
class AggregatedEvent:
    """Aggregated event data"""
    event_type: str
    user_id: str
    target_id: str
    data: Dict
    count: int = 1
    first_occurrence: datetime = field(default_factory=datetime.utcnow)
    last_occurrence: datetime = field(default_factory=datetime.utcnow)

class EventRateLimiter:
    """
    Production-grade event rate limiter with aggregation
    Protects system from event floods while maintaining real-time feel
    """
    
    # Default rate limits per event type
    DEFAULT_LIMITS = {
        'typing': RateLimitConfig(
            max_events_per_window=30,
            window_seconds=60,
            aggregation_window_ms=2000,  # Aggregate over 2 seconds
            max_burst=15
        ),
        'presence': RateLimitConfig(
            max_events_per_window=60,
            window_seconds=60,
            aggregation_window_ms=5000,  # Aggregate over 5 seconds
            max_burst=20
        ),
        'status_update': RateLimitConfig(
            max_events_per_window=20,
            window_seconds=60,
            aggregation_window_ms=3000,
            max_burst=10
        ),
        'message_read': RateLimitConfig(
            max_events_per_window=100,
            window_seconds=60,
            aggregation_window_ms=1000,
            max_burst=30
        ),
        'reaction': RateLimitConfig(
            max_events_per_window=50,
            window_seconds=60,
            aggregation_window_ms=500,
            max_burst=20
        ),
        'call_signal': RateLimitConfig(
            max_events_per_window=200,
            window_seconds=60,
            aggregation_window_ms=100,
            max_burst=50
        )
    }
    
    def __init__(self, redis_url: str = None):
        """
        Initialize event rate limiter
        
        Args:
            redis_url: Redis URL for distributed rate limiting
        """
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url)
                logger.info("[EVENT_RATE] Redis connected for distributed rate limiting")
            except Exception as e:
                logger.warning(f"[EVENT_RATE] Redis connection failed: {e}")
        
        # Local rate limit counters
        self._event_counters: Dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
        
        # Aggregation buffers
        self._aggregation_buffers: Dict[str, List[AggregatedEvent]] = defaultdict(list)
        
        # Last emission times
        self._last_emission: Dict[str, float] = {}
        
        # Thread lock
        self._lock = threading.RLock()
        
        # Event callbacks
        self._callbacks: Dict[str, List[Callable]] = defaultdict(list)
    
    def _get_rate_key(self, event_type: str, user_id: str, target_id: str = None) -> str:
        """Generate rate limit key"""
        if target_id:
            return f"rate:{event_type}:{user_id}:{target_id}"
        return f"rate:{event_type}:{user_id}"
    
    def _get_aggregation_key(self, event_type: str, user_id: str, target_id: str = None) -> str:
        """Generate aggregation key"""
        if target_id:
            return f"agg:{event_type}:{user_id}:{target_id}"
        return f"agg:{event_type}:{user_id}"
    
    def check_rate_limit(self, event_type: str, user_id: str, 
                        target_id: str = None) -> Tuple[bool, int]:
        """
        Check if event passes rate limit
        
        Args:
            event_type: Type of event
            user_id: User sending event
            target_id: Optional target (receiver, group, etc.)
        
        Returns:
            Tuple of (allowed: bool, retry_after: int seconds)
        """
        config = self.DEFAULT_LIMITS.get(event_type, RateLimitConfig(
            max_events_per_window=100, window_seconds=60,
            aggregation_window_ms=1000, max_burst=50
        ))
        
        key = self._get_rate_key(event_type, user_id, target_id)
        now = time.time()
        window_start = now - config.window_seconds
        
        with self._lock:
            # Clean old entries
            counter = self._event_counters[key]
            while counter and counter[0] < window_start:
                counter.popleft()
            
            # Check burst limit
            if len(counter) >= config.max_burst:
                retry_after = int(counter[0] + config.window_seconds - now) + 1
                logger.warning(f"[EVENT_RATE] Burst limit hit for {key}")
                return False, retry_after
            
            # Check rate limit
            if len(counter) >= config.max_events_per_window:
                retry_after = int(counter[0] + config.window_seconds - now) + 1
                logger.warning(f"[EVENT_RATE] Rate limit hit for {key}")
                return False, retry_after
            
            # Add event
            counter.append(now)
        
        # Check Redis for distributed rate limiting
        if self.redis_client:
            try:
                redis_key = f"dist_{key}"
                pipe = self.redis_client.pipeline()
                pipe.zremrangebyscore(redis_key, 0, window_start)
                pipe.zcard(redis_key)
                pipe.zadd(redis_key, {str(now): now})
                pipe.expire(redis_key, config.window_seconds + 10)
                results = pipe.execute()
                
                count = results[1]
                if count >= config.max_events_per_window:
                    logger.warning(f"[EVENT_RATE] Distributed rate limit hit for {key}")
                    return False, 1
            except Exception as e:
                logger.error(f"[EVENT_RATE] Redis rate check failed: {e}")
        
        return True, 0
    
    def aggregate_event(self, event_type: str, user_id: str, 
                       target_id: str, data: Dict) -> Optional[AggregatedEvent]:
        """
        Aggregate event for batched emission
        
        Args:
            event_type: Type of event
            user_id: User sending event
            target_id: Target ID
            data: Event data
        
        Returns:
            AggregatedEvent if ready for emission, None otherwise
        """
        config = self.DEFAULT_LIMITS.get(event_type)
        if not config:
            return AggregatedEvent(
                event_type=event_type,
                user_id=user_id,
                target_id=target_id,
                data=data
            )
        
        key = self._get_aggregation_key(event_type, user_id, target_id)
        now = time.time()
        
        with self._lock:
            # Check if aggregation window has elapsed
            last_emission = self._last_emission.get(key, 0)
            time_since_last = (now - last_emission) * 1000  # ms
            
            if time_since_last < config.aggregation_window_ms:
                # Within aggregation window - buffer the event
                self._aggregation_buffers[key].append(AggregatedEvent(
                    event_type=event_type,
                    user_id=user_id,
                    target_id=target_id,
                    data=data
                ))
                return None
            
            # Aggregation window elapsed - flush and start new
            buffered = self._aggregation_buffers.get(key, [])
            if buffered:
                # Aggregate buffered events
                aggregated = AggregatedEvent(
                    event_type=event_type,
                    user_id=user_id,
                    target_id=target_id,
                    data=data,
                    count=len(buffered) + 1,
                    first_occurrence=buffered[0].first_occurrence,
                    last_occurrence=datetime.utcnow()
                )
            else:
                aggregated = AggregatedEvent(
                    event_type=event_type,
                    user_id=user_id,
                    target_id=target_id,
                    data=data
                )
            
            # Clear buffer and update emission time
            self._aggregation_buffers[key] = []
            self._last_emission[key] = now
            
            return aggregated
    
    def register_callback(self, event_type: str, callback: Callable):
        """Register callback for event emission"""
        with self._lock:
            self._callbacks[event_type].append(callback)
    
    def process_event(self, event_type: str, user_id: str, 
                     target_id: str, data: Dict,
                     emit_func: Callable = None) -> Tuple[bool, Optional[Dict]]:
        """
        Process event with rate limiting and aggregation
        
        Args:
            event_type: Type of event
            user_id: User sending event
            target_id: Target ID
            data: Event data
            emit_func: Optional function to emit event
        
        Returns:
            Tuple of (success: bool, aggregated_data: Optional[Dict])
        """
        # Check rate limit
        allowed, retry_after = self.check_rate_limit(event_type, user_id, target_id)
        if not allowed:
            return False, {'error': 'Rate limit exceeded', 'retry_after': retry_after}
        
        # Aggregate event
        aggregated = self.aggregate_event(event_type, user_id, target_id, data)
        
        if aggregated:
            # Emit aggregated event
            emit_data = {
                'event_type': event_type,
                'user_id': user_id,
                'target_id': target_id,
                'data': aggregated.data,
                'count': aggregated.count,
                'duration_ms': int(
                    (aggregated.last_occurrence - aggregated.first_occurrence).total_seconds() * 1000
                )
            }
            
            if emit_func:
                try:
                    emit_func(emit_data)
                except Exception as e:
                    logger.error(f"[EVENT_RATE] Emit callback failed: {e}")
            
            # Call registered callbacks
            for callback in self._callbacks.get(event_type, []):
                try:
                    callback(emit_data)
                except Exception as e:
                    logger.error(f"[EVENT_RATE] Callback failed: {e}")
            
            return True, emit_data
        
        return True, None
    
    def get_user_event_stats(self, user_id: str) -> Dict[str, Any]:
        """Get event statistics for user"""
        stats = {}
        
        with self._lock:
            for event_type in self.DEFAULT_LIMITS.keys():
                key = self._get_rate_key(event_type, user_id)
                counter = self._event_counters.get(key, deque())
                
                stats[event_type] = {
                    'events_in_window': len(counter),
                    'limit': self.DEFAULT_LIMITS[event_type].max_events_per_window,
                    'burst_limit': self.DEFAULT_LIMITS[event_type].max_burst
                }
        
        return stats
    
    def reset_user_limits(self, user_id: str):
        """Reset rate limits for user"""
        with self._lock:
            keys_to_remove = [
                key for key in self._event_counters.keys()
                if f":{user_id}:" in key or key.endswith(f":{user_id}")
            ]
            for key in keys_to_remove:
                self._event_counters.pop(key, None)
        
        if self.redis_client:
            try:
                pattern = f"rate:*:{user_id}:*"
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            except Exception as e:
                logger.error(f"[EVENT_RATE] Failed to reset Redis limits: {e}")


# Global instance
event_rate_limiter = None

def init_event_rate_limiter(redis_url: str = None):
    """Initialize global event rate limiter"""
    global event_rate_limiter
    event_rate_limiter = EventRateLimiter(redis_url)
    logger.info("[EVENT_RATE] Initialized event rate limiter")
    return event_rate_limiter


# Import Tuple for type hints
from typing import Tuple
