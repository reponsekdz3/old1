"""
SFU (Selective Forwarding Unit) Server for Group Video/Voice Calls
Handles WebRTC media routing, bandwidth optimization, and E2EE key distribution
"""
from flask_socketio import emit, join_room, leave_room
from typing import Dict, Set
import logging
from dataclasses import dataclass, field
from datetime import datetime

logger = logging.getLogger(__name__)

@dataclass
class SFUParticipant:
    user_id: int
    socket_id: str
    username: str
    audio_enabled: bool = True
    video_enabled: bool = True
    screen_share: bool = False
    role: str = 'participant'  # host, participant, viewer
    video_quality: str = 'medium'  # low, medium, high
    bandwidth_limit: int = 2500  # kbps
    is_muted: bool = False
    is_video_muted: bool = False
    joined_at: datetime = field(default_factory=datetime.utcnow)
    
@dataclass
class SFURoom:
    room_id: str
    participants: Dict[int, SFUParticipant] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    host_user_id: int = None
    max_participants: int = 50
    recording: bool = False
    e2ee_enabled: bool = True
    invited_users: Dict[int, datetime] = field(default_factory=dict)  # Track invitations
    call_id: str = None  # Link to database Call record
    active: bool = True
    locked: bool = False  # Prevent new joins when locked
    
class SFUMediaServer:
    def __init__(self):
        self.rooms: Dict[str, SFURoom] = {}
        self.user_to_room: Dict[int, str] = {}
        self.participant_metrics: Dict[str, dict] = {}  # Track metrics per participant
        
    def create_room(self, room_id: str, host_user_id: int, max_participants: int = 50) -> SFURoom:
        """Create new SFU room with configuration"""
        if room_id in self.rooms:
            return self.rooms[room_id]
        room = SFURoom(
            room_id=room_id,
            host_user_id=host_user_id,
            max_participants=max_participants
        )
        self.rooms[room_id] = room
        logger.info(f"[SFU] Room created: {room_id} by host {host_user_id} (max: {max_participants})")
        return room
    
    def join_room(self, room_id: str, user_id: int, socket_id: str, username: str, role: str = 'participant') -> bool:
        """Add participant to SFU room with role validation"""
        if room_id not in self.rooms:
            logger.warning(f"[SFU] Room {room_id} does not exist")
            return False
        
        room = self.rooms[room_id]
        
        # Validate room state
        if not room.active:
            logger.warning(f"[SFU] Room {room_id} is not active")
            return False
        
        if room.locked and user_id not in room.invited_users:
            logger.warning(f"[SFU] Room {room_id} is locked and user {user_id} not invited")
            return False
        
        if len(room.participants) >= room.max_participants:
            logger.warning(f"[SFU] Room {room_id} is full ({room.max_participants} participants)")
            return False
        
        # Determine role
        if user_id == room.host_user_id:
            role = 'host'
        
        participant = SFUParticipant(
            user_id=user_id,
            socket_id=socket_id,
            username=username,
            role=role
        )
        room.participants[user_id] = participant
        self.user_to_room[user_id] = room_id
        
        # Initialize metrics
        self.participant_metrics[f"{room_id}_{user_id}"] = {
            'packets_sent': 0,
            'packets_received': 0,
            'bytes_sent': 0,
            'bytes_received': 0,
            'join_time': datetime.utcnow()
        }
        
        # Remove from invited list if present
        room.invited_users.pop(user_id, None)
        
        logger.info(f"[SFU] User {user_id} ({role}) joined room {room_id} ({len(room.participants)}/{room.max_participants})")
        return True
    
    def leave_room(self, user_id: int) -> tuple:
        """Remove participant from room and cleanup metrics"""
        if user_id not in self.user_to_room:
            return None, None
        
        room_id = self.user_to_room[user_id]
        room = self.rooms.get(room_id)
        if not room:
            return None, None
        
        participant = room.participants.pop(user_id, None)
        del self.user_to_room[user_id]
        
        # Cleanup metrics
        metrics_key = f"{room_id}_{user_id}"
        if metrics_key in self.participant_metrics:
            del self.participant_metrics[metrics_key]
        
        # If host left and there are other participants, promote first participant
        if participant and participant.role == 'host' and len(room.participants) > 0:
            new_host_id = next(iter(room.participants.keys()))
            room.participants[new_host_id].role = 'host'
            room.host_user_id = new_host_id
            logger.info(f"[SFU] Auto-promoted user {new_host_id} to host in room {room_id}")
        
        # Clean up empty rooms
        if len(room.participants) == 0:
            del self.rooms[room_id]
            logger.info(f"[SFU] Room {room_id} deleted (empty)")
        
        return room_id, participant
    
    def get_room_participants(self, room_id: str) -> list:
        """Get all participants in a room"""
        room = self.rooms.get(room_id)
        if not room:
            return []
        return [
            {
                'user_id': p.user_id,
                'socket_id': p.socket_id,
                'username': p.username,
                'audio_enabled': p.audio_enabled,
                'video_enabled': p.video_enabled,
                'screen_share': p.screen_share,
                'role': p.role,
                'video_quality': p.video_quality,
                'bandwidth_limit': p.bandwidth_limit,
                'is_muted': p.is_muted,
                'is_video_muted': p.is_video_muted,
                'joined_at': p.joined_at.isoformat()
            }
            for p in room.participants.values()
        ]
    
    def get_participant(self, room_id: str, user_id: int) -> SFUParticipant:
        """Get specific participant in a room"""
        room = self.rooms.get(room_id)
        if not room:
            return None
        return room.participants.get(user_id)
    
    def invite_participant(self, room_id: str, user_id: int) -> bool:
        """Invite user to room"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        room.invited_users[user_id] = datetime.utcnow()
        logger.info(f"[SFU] User {user_id} invited to room {room_id}")
        return True
    
    def get_room_invitations(self, room_id: str) -> dict:
        """Get all pending invitations for a room"""
        room = self.rooms.get(room_id)
        if not room:
            return {}
        return {uid: inv_time.isoformat() for uid, inv_time in room.invited_users.items()}
    
    def is_host(self, room_id: str, user_id: int) -> bool:
        """Check if user is host of room"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        participant = room.participants.get(user_id)
        return participant and participant.role == 'host'
    
    def has_host_permission(self, room_id: str, user_id: int) -> bool:
        """Check if user has host-level permissions"""
        return self.is_host(room_id, user_id)
    
    def validate_action(self, room_id: str, user_id: int, action: str) -> tuple:
        """Validate if user can perform action in room
        Returns: (success: bool, error_message: str)
        """
        room = self.rooms.get(room_id)
        if not room:
            return False, "Room not found"
        
        if not room.active:
            return False, "Room is not active"
        
        participant = room.participants.get(user_id)
        if not participant:
            return False, "Not a participant in this room"
        
        # Host-only actions
        host_actions = ['remove_participant', 'promote_to_host', 'lock_room', 'mute_others']
        if action in host_actions and not self.is_host(room_id, user_id):
            return False, "Only host can perform this action"
        
        return True, ""
    
    def promote_to_host(self, room_id: str, user_id: int) -> bool:
        """Promote participant to host"""
        room = self.rooms.get(room_id)
        if not room or user_id not in room.participants:
            return False
        room.participants[user_id].role = 'host'
        logger.info(f"[SFU] User {user_id} promoted to host in room {room_id}")
        return True
    
    def remove_participant(self, room_id: str, user_id: int) -> bool:
        """Force remove participant from room"""
        room = self.rooms.get(room_id)
        if not room or user_id not in room.participants:
            return False
        room.participants.pop(user_id, None)
        if user_id in self.user_to_room:
            del self.user_to_room[user_id]
        logger.info(f"[SFU] User {user_id} removed from room {room_id}")
        return True
    
    def update_media_state(self, user_id: int, audio: bool = None, video: bool = None, screen: bool = None):
        """Update participant media state"""
        if user_id not in self.user_to_room:
            return False
        
        room_id = self.user_to_room[user_id]
        room = self.rooms.get(room_id)
        if not room or user_id not in room.participants:
            return False
        
        participant = room.participants[user_id]
        if audio is not None:
            participant.audio_enabled = audio
        if video is not None:
            participant.video_enabled = video
        if screen is not None:
            participant.screen_share = screen
        
        return True
    
    def mute_participant(self, room_id: str, user_id: int, mute_audio: bool = False, mute_video: bool = False) -> bool:
        """Mute/unmute participant"""
        room = self.rooms.get(room_id)
        if not room or user_id not in room.participants:
            return False
        
        participant = room.participants[user_id]
        if mute_audio:
            participant.is_muted = True
        if mute_video:
            participant.is_video_muted = True
        
        logger.info(f"[SFU] User {user_id} muted in room {room_id} (audio={mute_audio}, video={mute_video})")
        return True
    
    def unmute_participant(self, room_id: str, user_id: int, unmute_audio: bool = False, unmute_video: bool = False) -> bool:
        """Unmute participant"""
        room = self.rooms.get(room_id)
        if not room or user_id not in room.participants:
            return False
        
        participant = room.participants[user_id]
        if unmute_audio:
            participant.is_muted = False
        if unmute_video:
            participant.is_video_muted = False
        
        return True
    
    def update_video_quality(self, room_id: str, user_id: int, quality: str) -> bool:
        """Update participant video quality and bandwidth limit"""
        room = self.rooms.get(room_id)
        if not room or user_id not in room.participants:
            return False
        
        quality_settings = {
            'low': {'bandwidth': 500, 'resolution': '320x240'},
            'medium': {'bandwidth': 2500, 'resolution': '640x480'},
            'high': {'bandwidth': 5000, 'resolution': '1280x720'},
        }
        
        if quality not in quality_settings:
            return False
        
        participant = room.participants[user_id]
        participant.video_quality = quality
        participant.bandwidth_limit = quality_settings[quality]['bandwidth']
        
        logger.info(f"[SFU] User {user_id} quality updated to {quality} in room {room_id}")
        return True
    
    def get_room_state(self, room_id: str) -> dict:
        """Get complete room state with metrics"""
        room = self.rooms.get(room_id)
        if not room:
            return None
        
        participants_data = []
        for p in room.participants.values():
            participant_dict = {
                'user_id': p.user_id,
                'socket_id': p.socket_id,
                'username': p.username,
                'audio_enabled': p.audio_enabled,
                'video_enabled': p.video_enabled,
                'screen_share': p.screen_share,
                'role': p.role,
                'video_quality': p.video_quality,
                'bandwidth_limit': p.bandwidth_limit,
                'is_muted': p.is_muted,
                'is_video_muted': p.is_video_muted,
                'joined_at': p.joined_at.isoformat()
            }
            # Add metrics if available
            metrics = self.get_participant_metrics(room_id, p.user_id)
            if metrics:
                participant_dict['metrics'] = metrics
            participants_data.append(participant_dict)
        
        return {
            'room_id': room.room_id,
            'call_id': room.call_id,
            'host_user_id': room.host_user_id,
            'participants_count': len(room.participants),
            'max_participants': room.max_participants,
            'recording': room.recording,
            'e2ee_enabled': room.e2ee_enabled,
            'locked': room.locked,
            'active': room.active,
            'created_at': room.created_at.isoformat(),
            'participants': participants_data,
            'invitations': self.get_room_invitations(room_id)
        }
    
    def get_user_room(self, user_id: int) -> str:
        """Get room ID for user"""
        return self.user_to_room.get(user_id)
    
    def lock_room(self, room_id: str) -> bool:
        """Lock room to prevent new joins"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        room.locked = True
        logger.info(f"[SFU] Room {room_id} locked")
        return True
    
    def unlock_room(self, room_id: str) -> bool:
        """Unlock room to allow new joins"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        room.locked = False
        logger.info(f"[SFU] Room {room_id} unlocked")
        return True
    
    def link_call_to_room(self, room_id: str, call_id: str) -> bool:
        """Link database call record to SFU room"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        room.call_id = call_id
        logger.info(f"[SFU] Room {room_id} linked to call {call_id}")
        return True
    
    def update_participant_metrics(self, room_id: str, user_id: int, metrics: dict):
        """Update participant bandwidth/quality metrics"""
        key = f"{room_id}_{user_id}"
        if key in self.participant_metrics:
            self.participant_metrics[key].update(metrics)
    
    def get_participant_metrics(self, room_id: str, user_id: int) -> dict:
        """Get participant metrics"""
        key = f"{room_id}_{user_id}"
        return self.participant_metrics.get(key, {})
    
    def end_room(self, room_id: str) -> bool:
        """End room and remove all participants"""
        room = self.rooms.get(room_id)
        if not room:
            return False
        
        room.active = False
        
        # Remove all participants
        participant_ids = list(room.participants.keys())
        for user_id in participant_ids:
            self.leave_room(user_id)
        
        logger.info(f"[SFU] Room {room_id} ended")
        return True

# Global SFU instance
sfu_server = SFUMediaServer()

__all__ = ['sfu_server', 'SFUMediaServer', 'SFURoom', 'SFUParticipant']
