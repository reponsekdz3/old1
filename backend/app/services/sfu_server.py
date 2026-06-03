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
    joined_at: datetime = field(default_factory=datetime.utcnow)
    bandwidth_limit: int = 2500  # kbps
    
@dataclass
class SFURoom:
    room_id: str
    participants: Dict[int, SFUParticipant] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.utcnow)
    host_user_id: int = None
    max_participants: int = 50
    recording: bool = False
    e2ee_enabled: bool = True
    
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
                'screen_share': p.screen_share
            }
            for p in room.participants.values()
        ]
    
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
    
    def get_user_room(self, user_id: int) -> str:
        """Get room ID for user"""
        return self.user_to_room.get(user_id)

# Global SFU instance
sfu_server = SFUMediaServer()
