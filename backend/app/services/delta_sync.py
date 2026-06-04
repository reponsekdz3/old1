"""
Delta Sync Service for Efficient Message Synchronization
Implements differential sync to minimize bandwidth and improve performance
"""
import logging
import hashlib
import json
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, field
from collections import defaultdict
import redis
import pickle

logger = logging.getLogger(__name__)

@dataclass
class SyncCheckpoint:
    """Represents a sync checkpoint for a user"""
    user_id: str
    chat_id: str
    last_message_id: str
    last_timestamp: datetime
    message_count: int
    checksum: str
    created_at: datetime = field(default_factory=datetime.utcnow)

@dataclass
class DeltaUpdate:
    """Represents a delta update"""
    added: List[Dict] = field(default_factory=list)
    modified: List[Dict] = field(default_factory=list)
    deleted: List[str] = field(default_factory=list)
    checkpoint: Optional[SyncCheckpoint] = None

class DeltaSyncService:
    """
    Production-grade delta sync implementation
    Minimizes bandwidth by syncing only changes since last checkpoint
    """
    
    def __init__(self, redis_url: str = None, checkpoint_ttl: int = 86400 * 7):
        """
        Initialize delta sync service
        
        Args:
            redis_url: Redis connection URL for checkpoint storage
            checkpoint_ttl: TTL for checkpoints in seconds (default 7 days)
        """
        self.redis_client = None
        if redis_url:
            try:
                self.redis_client = redis.from_url(redis_url, decode_responses=False)
                logger.info("[DELTA_SYNC] Redis connected for checkpoint storage")
            except Exception as e:
                logger.warning(f"[DELTA_SYNC] Redis connection failed: {e}")
        
        self.checkpoint_ttl = checkpoint_ttl
        self._local_checkpoints: Dict[str, SyncCheckpoint] = {}
        self._message_checksums: Dict[str, Dict[str, str]] = defaultdict(dict)
    
    def _get_checkpoint_key(self, user_id: str, chat_id: str) -> str:
        """Generate checkpoint storage key"""
        return f"sync:checkpoint:{user_id}:{chat_id}"
    
    def _get_message_checksum_key(self, message_id: str) -> str:
        """Generate message checksum key"""
        return f"sync:checksum:{message_id}"
    
    def _compute_message_checksum(self, message_data: Dict) -> str:
        """Compute checksum for message data"""
        # Create deterministic string representation
        checksum_data = {
            'id': message_data.get('id'),
            'content': message_data.get('content'),
            'status': message_data.get('status'),
            'is_edited': message_data.get('is_edited'),
            'updated_at': message_data.get('updated_at')
        }
        data_str = json.dumps(checksum_data, sort_keys=True)
        return hashlib.md5(data_str.encode()).hexdigest()
    
    def save_checkpoint(self, user_id: str, chat_id: str, last_message_id: str,
                       last_timestamp: datetime, message_count: int) -> SyncCheckpoint:
        """
        Save sync checkpoint for user-chat combination
        
        Args:
            user_id: User ID
            chat_id: Chat/conversation ID
            last_message_id: Last synced message ID
            last_timestamp: Timestamp of last message
            message_count: Total message count at checkpoint
        
        Returns:
            Created SyncCheckpoint
        """
        checkpoint = SyncCheckpoint(
            user_id=user_id,
            chat_id=chat_id,
            last_message_id=last_message_id,
            last_timestamp=last_timestamp,
            message_count=message_count,
            checksum=hashlib.md5(f"{last_message_id}:{last_timestamp}".encode()).hexdigest()
        )
        
        # Save to Redis
        if self.redis_client:
            try:
                key = self._get_checkpoint_key(user_id, chat_id)
                data = pickle.dumps(checkpoint)
                self.redis_client.setex(key, self.checkpoint_ttl, data)
            except Exception as e:
                logger.error(f"[DELTA_SYNC] Failed to save checkpoint to Redis: {e}")
        
        # Save locally
        self._local_checkpoints[f"{user_id}:{chat_id}"] = checkpoint
        
        logger.debug(f"[DELTA_SYNC] Checkpoint saved for user {user_id}, chat {chat_id}")
        return checkpoint
    
    def get_checkpoint(self, user_id: str, chat_id: str) -> Optional[SyncCheckpoint]:
        """
        Get sync checkpoint for user-chat combination
        
        Args:
            user_id: User ID
            chat_id: Chat/conversation ID
        
        Returns:
            SyncCheckpoint if exists, None otherwise
        """
        local_key = f"{user_id}:{chat_id}"
        
        # Try local cache first
        if local_key in self._local_checkpoints:
            return self._local_checkpoints[local_key]
        
        # Try Redis
        if self.redis_client:
            try:
                key = self._get_checkpoint_key(user_id, chat_id)
                data = self.redis_client.get(key)
                if data:
                    checkpoint = pickle.loads(data)
                    self._local_checkpoints[local_key] = checkpoint
                    return checkpoint
            except Exception as e:
                logger.error(f"[DELTA_SYNC] Failed to get checkpoint from Redis: {e}")
        
        return None
    
    def compute_delta(self, user_id: str, chat_id: str, 
                     current_messages: List[Dict], 
                     last_checkpoint: Optional[SyncCheckpoint] = None) -> DeltaUpdate:
        """
        Compute delta between checkpoint and current state
        
        Args:
            user_id: User ID
            chat_id: Chat/conversation ID
            current_messages: Current list of messages
            last_checkpoint: Optional last checkpoint (will load if not provided)
        
        Returns:
            DeltaUpdate with added, modified, deleted messages
        """
        if not last_checkpoint:
            last_checkpoint = self.get_checkpoint(user_id, chat_id)
        
        delta = DeltaUpdate()
        
        if not last_checkpoint:
            # No checkpoint - return all messages as added
            delta.added = current_messages
            if current_messages:
                last_msg = current_messages[-1]
                delta.checkpoint = self.save_checkpoint(
                    user_id=user_id,
                    chat_id=chat_id,
                    last_message_id=last_msg['id'],
                    last_timestamp=datetime.fromisoformat(last_msg['created_at'].replace('Z', '+00:00')),
                    message_count=len(current_messages)
                )
            return delta
        
        # Build index of current messages
        current_by_id = {msg['id']: msg for msg in current_messages}
        current_ids = set(current_by_id.keys())
        
        # Get message IDs since checkpoint
        last_timestamp = last_checkpoint.last_timestamp
        added_count = 0
        modified_count = 0
        
        for msg in current_messages:
            msg_id = msg['id']
            msg_timestamp = datetime.fromisoformat(msg['created_at'].replace('Z', '+00:00'))
            
            # New message after checkpoint
            if msg_timestamp > last_timestamp:
                delta.added.append(msg)
                added_count += 1
            else:
                # Check if modified
                current_checksum = self._compute_message_checksum(msg)
                stored_checksum = self._message_checksums.get(chat_id, {}).get(msg_id)
                
                if stored_checksum and current_checksum != stored_checksum:
                    delta.modified.append(msg)
                    modified_count += 1
                
                # Update checksum
                self._message_checksums[chat_id][msg_id] = current_checksum
        
        # Note: In production, deleted messages would be tracked separately
        # For now, we assume soft-deletes are handled at application level
        
        # Update checkpoint
        if current_messages:
            last_msg = current_messages[-1]
            delta.checkpoint = self.save_checkpoint(
                user_id=user_id,
                chat_id=chat_id,
                last_message_id=last_msg['id'],
                last_timestamp=datetime.fromisoformat(last_msg['created_at'].replace('Z', '+00:00')),
                message_count=len(current_messages)
            )
        
        logger.debug(f"[DELTA_SYNC] Computed delta for {chat_id}: +{added_count} ~{modified_count}")
        return delta
    
    def sync_chat(self, user_id: str, chat_id: str, 
                  fetch_messages_func, 
                  since: datetime = None) -> DeltaUpdate:
        """
        Sync chat messages with delta optimization
        
        Args:
            user_id: User ID
            chat_id: Chat ID
            fetch_messages_func: Function to fetch messages(chat_id, since)
            since: Optional timestamp to fetch from
        
        Returns:
            DeltaUpdate with changes
        """
        checkpoint = self.get_checkpoint(user_id, chat_id)
        
        # Determine fetch timestamp
        fetch_since = since
        if checkpoint and (not since or checkpoint.last_timestamp > since):
            fetch_since = checkpoint.last_timestamp
        
        # Fetch messages
        messages = fetch_messages_func(chat_id, fetch_since)
        
        # Compute delta
        return self.compute_delta(user_id, chat_id, messages, checkpoint)
    
    def invalidate_checkpoint(self, user_id: str, chat_id: str):
        """Invalidate checkpoint when message is edited/deleted"""
        local_key = f"{user_id}:{chat_id}"
        
        if local_key in self._local_checkpoints:
            del self._local_checkpoints[local_key]
        
        if self.redis_client:
            try:
                key = self._get_checkpoint_key(user_id, chat_id)
                self.redis_client.delete(key)
                logger.debug(f"[DELTA_SYNC] Checkpoint invalidated for {chat_id}")
            except Exception as e:
                logger.error(f"[DELTA_SYNC] Failed to invalidate checkpoint: {e}")
    
    def get_sync_statistics(self, user_id: str) -> Dict[str, Any]:
        """Get sync statistics for user"""
        stats = {
            'checkpoints_count': 0,
            'total_checkpoints_size_bytes': 0
        }
        
        if self.redis_client:
            try:
                pattern = self._get_checkpoint_key(user_id, '*')
                keys = self.redis_client.keys(pattern.replace('*', '*'))
                stats['checkpoints_count'] = len(keys)
                
                for key in keys:
                    data = self.redis_client.get(key)
                    if data:
                        stats['total_checkpoints_size_bytes'] += len(data)
            except Exception as e:
                logger.error(f"[DELTA_SYNC] Failed to get statistics: {e}")
        
        return stats
    
    def cleanup_old_checkpoints(self, max_age_days: int = 30):
        """Cleanup old checkpoints (handled by TTL, but can force cleanup)"""
        if self.redis_client:
            try:
                # Redis TTL handles this automatically
                # This method can be used for manual cleanup
                logger.info("[DELTA_SYNC] Checkpoint cleanup handled by Redis TTL")
            except Exception as e:
                logger.error(f"[DELTA_SYNC] Cleanup failed: {e}")


# Global instance
delta_sync_service = None

def init_delta_sync(redis_url: str = None):
    """Initialize global delta sync service"""
    global delta_sync_service
    delta_sync_service = DeltaSyncService(redis_url)
    logger.info("[DELTA_SYNC] Initialized delta sync service")
    return delta_sync_service
