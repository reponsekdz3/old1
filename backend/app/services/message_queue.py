"""
Advanced Message Queue & Background Processing System
Handles offline message delivery, push notifications, and background tasks
"""
import redis
import json
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from celery import Celery
from flask import current_app
import logging

logger = logging.getLogger(__name__)

class MessageQueueManager:
    """Advanced message queue with Redis backend"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or 'redis://localhost:6379/0'
        self.redis_client = None
        self.celery_app = None
        self.initialized = False
    
    def initialize(self, app=None):
        """Initialize Redis and Celery"""
        try:
            # Redis connection
            self.redis_client = redis.from_url(
                self.redis_url,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            
            # Test connection
            self.redis_client.ping()
            
            # Initialize Celery
            self.celery_app = Celery('vipchat')
            self.celery_app.conf.update(
                broker_url=self.redis_url,
                result_backend=self.redis_url,
                task_serializer='json',
                accept_content=['json'],
                result_serializer='json',
                timezone='UTC',
                enable_utc=True,
                task_routes={
                    'vipchat.send_push_notification': {'queue': 'notifications'},
                    'vipchat.process_offline_message': {'queue': 'messages'},
                    'vipchat.sync_user_data': {'queue': 'sync'},
                }
            )
            
            if app:
                app.queue_manager = self
            
            self.initialized = True
            logger.info("[MessageQueue] Initialized successfully")
            
        except Exception as e:
            logger.error(f"[MessageQueue] Initialization failed: {e}")
            raise
    
    def queue_message(self, message_data: Dict, priority: str = 'normal') -> str:
        """Queue a message for processing"""
        if not self.initialized:
            raise RuntimeError("MessageQueue not initialized")
        
        message_id = f"msg_{int(time.time() * 1000)}_{hash(str(message_data)) % 10000}"
        
        queue_item = {
            'id': message_id,
            'data': message_data,
            'priority': priority,
            'queued_at': datetime.utcnow().isoformat(),
            'attempts': 0,
            'max_attempts': 5,
            'status': 'pending'
        }
        
        # Use different queues based on priority
        queue_name = f"message_queue:{priority}"
        
        try:
            self.redis_client.lpush(queue_name, json.dumps(queue_item))
            logger.info(f"[MessageQueue] Queued message {message_id} with priority {priority}")
            return message_id
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to queue message: {e}")
            raise
    
    def queue_offline_delivery(self, user_id: str, message_data: Dict) -> str:
        """Queue message for offline user delivery"""
        offline_key = f"offline_queue:{user_id}"
        
        queue_item = {
            'user_id': user_id,
            'message': message_data,
            'queued_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(days=7)).isoformat()
        }
        
        try:
            # Add to user's offline queue
            self.redis_client.lpush(offline_key, json.dumps(queue_item))
            
            # Set expiry on the key (7 days)
            self.redis_client.expire(offline_key, 7 * 24 * 3600)
            
            # Track offline message count
            count_key = f"offline_count:{user_id}"
            self.redis_client.incr(count_key)
            self.redis_client.expire(count_key, 7 * 24 * 3600)
            
            logger.info(f"[MessageQueue] Queued offline message for user {user_id}")
            return queue_item['queued_at']
            
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to queue offline message: {e}")
            raise
    
    def get_offline_messages(self, user_id: str, limit: int = 100) -> List[Dict]:
        """Get offline messages for user"""
        offline_key = f"offline_queue:{user_id}"
        
        try:
            # Get messages from queue
            messages = self.redis_client.lrange(offline_key, 0, limit - 1)
            
            # Parse and filter valid messages
            parsed_messages = []
            expired_count = 0
            
            for msg_json in messages:
                try:
                    msg = json.loads(msg_json)
                    
                    # Check expiry
                    expires_at = datetime.fromisoformat(msg['expires_at'])
                    if datetime.utcnow() > expires_at:
                        expired_count += 1
                        continue
                    
                    parsed_messages.append(msg['message'])
                except (json.JSONDecodeError, KeyError, ValueError):
                    expired_count += 1
                    continue
            
            # Clean up expired messages
            if expired_count > 0:
                self.cleanup_expired_offline_messages(user_id)
            
            logger.info(f"[MessageQueue] Retrieved {len(parsed_messages)} offline messages for user {user_id}")
            return parsed_messages
            
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to get offline messages: {e}")
            return []
    
    def clear_offline_messages(self, user_id: str) -> int:
        """Clear all offline messages for user"""
        offline_key = f"offline_queue:{user_id}"
        count_key = f"offline_count:{user_id}"
        
        try:
            # Get current count
            count = self.redis_client.llen(offline_key)
            
            # Delete queues
            self.redis_client.delete(offline_key)
            self.redis_client.delete(count_key)
            
            logger.info(f"[MessageQueue] Cleared {count} offline messages for user {user_id}")
            return count
            
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to clear offline messages: {e}")
            return 0
    
    def cleanup_expired_offline_messages(self, user_id: str):
        """Remove expired messages from offline queue"""
        offline_key = f"offline_queue:{user_id}"
        
        try:
            messages = self.redis_client.lrange(offline_key, 0, -1)
            valid_messages = []
            
            for msg_json in messages:
                try:
                    msg = json.loads(msg_json)
                    expires_at = datetime.fromisoformat(msg['expires_at'])
                    
                    if datetime.utcnow() <= expires_at:
                        valid_messages.append(msg_json)
                except (json.JSONDecodeError, KeyError, ValueError):
                    continue
            
            # Replace queue with valid messages
            pipe = self.redis_client.pipeline()
            pipe.delete(offline_key)
            
            if valid_messages:
                pipe.lpush(offline_key, *valid_messages)
                pipe.expire(offline_key, 7 * 24 * 3600)
            
            pipe.execute()
            
            cleaned_count = len(messages) - len(valid_messages)
            if cleaned_count > 0:
                logger.info(f"[MessageQueue] Cleaned {cleaned_count} expired messages for user {user_id}")
                
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to cleanup expired messages: {e}")
    
    def queue_push_notification(self, user_id: str, notification_data: Dict) -> str:
        """Queue push notification for delivery"""
        if not self.initialized:
            return None
        
        try:
            # Use Celery for async processing
            from .background_tasks import send_push_notification
            
            result = send_push_notification.delay(user_id, notification_data)
            
            logger.info(f"[MessageQueue] Queued push notification for user {user_id}")
            return result.id
            
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to queue push notification: {e}")
            return None
    
    def get_queue_stats(self) -> Dict[str, Any]:
        """Get queue statistics"""
        try:
            stats = {
                'queues': {},
                'offline_users': 0,
                'total_offline_messages': 0,
                'redis_info': {},
            }
            
            # Queue lengths
            for priority in ['high', 'normal', 'low']:
                queue_name = f"message_queue:{priority}"
                stats['queues'][priority] = self.redis_client.llen(queue_name)
            
            # Offline message stats
            offline_keys = self.redis_client.keys("offline_queue:*")
            stats['offline_users'] = len(offline_keys)
            
            total_offline = 0
            for key in offline_keys:
                total_offline += self.redis_client.llen(key)
            stats['total_offline_messages'] = total_offline
            
            # Redis info
            redis_info = self.redis_client.info()
            stats['redis_info'] = {
                'used_memory_human': redis_info.get('used_memory_human'),
                'connected_clients': redis_info.get('connected_clients'),
                'uptime_in_seconds': redis_info.get('uptime_in_seconds'),
            }
            
            return stats
            
        except Exception as e:
            logger.error(f"[MessageQueue] Failed to get stats: {e}")
            return {}
    
    def health_check(self) -> Dict[str, Any]:
        """Health check for message queue"""
        try:
            # Test Redis connection
            start_time = time.time()
            self.redis_client.ping()
            redis_latency = (time.time() - start_time) * 1000
            
            # Test queue operations
            test_key = "health_check_test"
            self.redis_client.set(test_key, "test", ex=5)
            self.redis_client.get(test_key)
            self.redis_client.delete(test_key)
            
            return {
                'status': 'healthy',
                'redis_latency_ms': round(redis_latency, 2),
                'timestamp': datetime.utcnow().isoformat(),
            }
            
        except Exception as e:
            return {
                'status': 'unhealthy',
                'error': str(e),
                'timestamp': datetime.utcnow().isoformat(),
            }

class BackgroundTaskManager:
    """Manages background task processing"""
    
    def __init__(self, queue_manager: MessageQueueManager):
        self.queue_manager = queue_manager
    
    def process_message_queue(self, priority: str = 'normal', batch_size: int = 10):
        """Process messages from queue"""
        queue_name = f"message_queue:{priority}"
        
        try:
            # Get batch of messages
            messages = []
            for _ in range(batch_size):
                msg_json = self.queue_manager.redis_client.rpop(queue_name)
                if not msg_json:
                    break
                
                try:
                    messages.append(json.loads(msg_json))
                except json.JSONDecodeError:
                    continue
            
            # Process each message
            for message in messages:
                try:
                    self.process_single_message(message)
                except Exception as e:
                    logger.error(f"[BackgroundTask] Message processing failed: {e}")
                    self.handle_failed_message(message, str(e))
            
            return len(messages)
            
        except Exception as e:
            logger.error(f"[BackgroundTask] Queue processing failed: {e}")
            return 0
    
    def process_single_message(self, message: Dict):
        """Process a single message"""
        message_data = message.get('data', {})
        message_type = message_data.get('type')
        
        if message_type == 'chat_message':
            self.process_chat_message(message_data)
        elif message_type == 'group_message':
            self.process_group_message(message_data)
        elif message_type == 'push_notification':
            self.process_push_notification(message_data)
        else:
            logger.warning(f"[BackgroundTask] Unknown message type: {message_type}")
    
    def process_chat_message(self, data: Dict):
        """Process chat message"""
        # Implementation for chat message processing
        pass
    
    def process_group_message(self, data: Dict):
        """Process group message"""
        # Implementation for group message processing
        pass
    
    def process_push_notification(self, data: Dict):
        """Process push notification"""
        # Implementation for push notification
        pass
    
    def handle_failed_message(self, message: Dict, error: str):
        """Handle failed message processing"""
        message['attempts'] = message.get('attempts', 0) + 1
        message['last_error'] = error
        message['last_attempt'] = datetime.utcnow().isoformat()
        
        if message['attempts'] < message.get('max_attempts', 5):
            # Retry with exponential backoff
            delay = min(2 ** message['attempts'], 300)  # Max 5 minutes
            
            # Re-queue with delay (using Redis sorted set for delay)
            delayed_key = "delayed_messages"
            score = time.time() + delay
            
            self.queue_manager.redis_client.zadd(
                delayed_key, 
                {json.dumps(message): score}
            )
        else:
            # Move to dead letter queue
            dead_letter_key = "dead_letter_queue"
            message['status'] = 'failed'
            message['failed_at'] = datetime.utcnow().isoformat()
            
            self.queue_manager.redis_client.lpush(
                dead_letter_key, 
                json.dumps(message)
            )

# Global instance
message_queue = MessageQueueManager()