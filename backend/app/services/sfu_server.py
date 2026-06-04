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
    
class SFUMediaServer:
    def __init__(self):
        self.rooms: Dict[str, SFURoom] = {}
        self.user_to_room: Dict[int, str] = {}
        
    def create_room(self, room_id: str, host_user_id: int) -> SFURoom:
        """Create new SFU room"""
        if room_id in self.rooms:
            return self.rooms[room_id]
        room = SFURoom(room_id=room_id, host_user_id=host_user_id)
        self.rooms[room_id] = room
        logger.info(f"[SFU] Room created: {room_id} by host {host_user_id}")
        return room
    
    def join_room(self, room_id: str, user_id: int, socket_id: str, username: str) -> bool:
        """Add participant to SFU room"""
        if room_id not in self.rooms:
            return False
        
        room = self.rooms[room_id]
        if len(room.participants) >= room.max_participants:
            logger.warning(f"[SFU] Room {room_id} is full")
            return False
        
        participant = SFUParticipant(
            user_id=user_id,
            socket_id=socket_id,
            username=username
        )
        room.participants[user_id] = participant
        self.user_to_room[user_id] = room_id
        
        logger.info(f"[SFU] User {user_id} joined room {room_id} ({len(room.participants)} participants)")
        return True
    
    def leave_room(self, user_id: int) -> tuple:
        """Remove participant from room"""
        if user_id not in self.user_to_room:
            return None, None
        
        room_id = self.user_to_room[user_id]
        room = self.rooms.get(room_id)
        if not room:
            return None, None
        
        participant = room.participants.pop(user_id, None)
        del self.user_to_room[user_id]
        
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
        """Get complete room state"""
        room = self.rooms.get(room_id)
        if not room:
            return None
        
        return {
            'room_id': room.room_id,
            'call_id': room.call_id,
            'host_user_id': room.host_user_id,
            'participants_count': len(room.participants),
            'max_participants': room.max_participants,
            'recording': room.recording,
            'e2ee_enabled': room.e2ee_enabled,
            'created_at': room.created_at.isoformat(),
            'participants': self.get_room_participants(room_id),
            'invitations': self.get_room_invitations(room_id)
        }
    
    def get_user_room(self, user_id: int) -> str:
        """Get room ID for user"""
        return self.user_to_room.get(user_id)

# Global SFU instance
sfu_server = SFUMediaServer()
