"""
Janus Gateway Integration - Production WebRTC SFU
C-based media server for ultra-low latency and high scalability
Supports VideoRoom, AudioBridge, SIP, Streaming plugins
"""
import logging
import json
import requests
import asyncio
import websockets
from typing import Dict, List, Optional, Callable
from dataclasses import dataclass, asdict
import secrets

logger = logging.getLogger(__name__)

@dataclass
class JanusSession:
    """Janus Gateway session"""
    session_id: int
    handle_id: int = None
    room_id: int = None

class JanusGatewayClient:
    """
    Janus Gateway HTTP/WebSocket Client
    - VideoRoom plugin for SFU
    - Audio/Video conferencing
    - Recording support
    - Simulcast/SVC
    """
    
    def __init__(self, janus_url: str, admin_secret: str = None):
        self.janus_url = janus_url.rstrip('/')
        self.admin_secret = admin_secret
        self.sessions: Dict[str, JanusSession] = {}
        self.transaction_callbacks: Dict[str, Callable] = {}
        
        # WebSocket connection (if using WS)
        self.ws = None
        self.is_connected = False
        
        logger.info(f"[Janus] Client initialized: {janus_url}")
    
    async def connect_websocket(self, ws_url: str):
        """Connect to Janus via WebSocket"""
        try:
            self.ws = await websockets.connect(ws_url, subprotocols=['janus-protocol'])
            self.is_connected = True
            asyncio.create_task(self._listen_websocket())
            logger.info("[Janus] WebSocket connected")
        except Exception as e:
            logger.error(f"[Janus] WebSocket connection failed: {e}")
            self.is_connected = False
    
    async def _listen_websocket(self):
        """Listen to WebSocket messages"""
        try:
            async for message in self.ws:
                data = json.loads(message)
                await self._handle_message(data)
        except Exception as e:
            logger.error(f"[Janus] WebSocket listen error: {e}")
            self.is_connected = False
    
    async def _handle_message(self, message: dict):
        """Handle incoming Janus message"""
        janus_type = message.get('janus')
        transaction = message.get('transaction')
        
        # Call transaction callback if exists
        if transaction and transaction in self.transaction_callbacks:
            callback = self.transaction_callbacks.pop(transaction)
            callback(message)
        
        # Handle specific message types
        if janus_type == 'event':
            await self._handle_event(message)
        elif janus_type == 'webrtcup':
            logger.info(f"[Janus] WebRTC connection established")
        elif janus_type == 'media':
            logger.info(f"[Janus] Media {message.get('type')} flowing")
        elif janus_type == 'hangup':
            logger.info(f"[Janus] Hangup: {message.get('reason')}")
    
    async def _handle_event(self, message: dict):
        """Handle VideoRoom events"""
        plugin_data = message.get('plugindata', {})
        data = plugin_data.get('data', {})
        event = data.get('videoroom')
        
        if event == 'joined':
            logger.info(f"[Janus] User joined room: {data}")
        elif event == 'leaving':
            logger.info(f"[Janus] User leaving room: {data}")
        elif event == 'event':
            # Generic event
            pass
    
    def _make_request(self, endpoint: str, payload: dict) -> dict:
        """Make HTTP request to Janus"""
        url = f"{self.janus_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"[Janus] Request failed: {e}")
            raise
    
    async def _send_message(self, payload: dict, callback: Callable = None):
        """Send message via WebSocket"""
        if not self.ws or not self.is_connected:
            raise Exception("WebSocket not connected")
        
        transaction = secrets.token_hex(12)
        payload['transaction'] = transaction
        
        if callback:
            self.transaction_callbacks[transaction] = callback
        
        await self.ws.send(json.dumps(payload))
    
    def create_session(self) -> JanusSession:
        """Create Janus session"""
        payload = {'janus': 'create'}
        response = self._make_request('', payload)
        
        if response.get('janus') == 'success':
            session_id = response['data']['id']
            session = JanusSession(session_id=session_id)
            self.sessions[str(session_id)] = session
            logger.info(f"[Janus] Session created: {session_id}")
            return session
        else:
            raise Exception(f"Session creation failed: {response}")
    
    def attach_plugin(self, session: JanusSession, plugin: str = 'janus.plugin.videoroom') -> int:
        """Attach to plugin"""
        payload = {
            'janus': 'attach',
            'plugin': plugin
        }
        
        response = self._make_request(f"{session.session_id}", payload)
        
        if response.get('janus') == 'success':
            handle_id = response['data']['id']
            session.handle_id = handle_id
            logger.info(f"[Janus] Plugin attached: {plugin} (handle {handle_id})")
            return handle_id
        else:
            raise Exception(f"Plugin attach failed: {response}")
    
    def create_room(self, session: JanusSession, room_config: dict) -> int:
        """Create VideoRoom"""
        default_config = {
            'request': 'create',
            'room': room_config.get('room_id', secrets.randbelow(1000000000)),
            'permanent': False,
            'description': room_config.get('description', 'VipChat Room'),
            'publishers': room_config.get('max_publishers', 500),
            'bitrate': room_config.get('bitrate', 2048000),  # 2 Mbps
            'fir_freq': 10,
            'audiocodec': 'opus',
            'videocodec': 'vp8,vp9,h264',
            'record': room_config.get('record', False),
            'rec_dir': '/var/janus/recordings',
            'notify_joining': True,
        }
        
        payload = {
            'janus': 'message',
            'body': default_config
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        if response.get('janus') == 'success':
            plugin_data = response.get('plugindata', {})
            data = plugin_data.get('data', {})
            room_id = data.get('room')
            session.room_id = room_id
            logger.info(f"[Janus] Room created: {room_id}")
            return room_id
        else:
            raise Exception(f"Room creation failed: {response}")
    
    def join_room(self, session: JanusSession, room_id: int, user_id: str, display_name: str) -> dict:
        """Join VideoRoom as publisher"""
        payload = {
            'janus': 'message',
            'body': {
                'request': 'join',
                'room': room_id,
                'ptype': 'publisher',
                'id': user_id,
                'display': display_name
            }
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        return response
    
    def configure_publisher(self, session: JanusSession, jsep: dict) -> dict:
        """Configure publisher media"""
        payload = {
            'janus': 'message',
            'body': {
                'request': 'configure',
                'audio': True,
                'video': True
            },
            'jsep': jsep
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        return response
    
    def subscribe_to_feed(self, session: JanusSession, room_id: int, feed_id: str) -> dict:
        """Subscribe to publisher feed"""
        # Create new handle for subscriber
        subscriber_handle = self.attach_plugin(session, 'janus.plugin.videoroom')
        
        payload = {
            'janus': 'message',
            'body': {
                'request': 'join',
                'room': room_id,
                'ptype': 'subscriber',
                'feed': feed_id
            }
        }
        
        response = self._make_request(
            f"{session.session_id}/{subscriber_handle}",
            payload
        )
        
        return response
    
    def leave_room(self, session: JanusSession):
        """Leave VideoRoom"""
        payload = {
            'janus': 'message',
            'body': {
                'request': 'leave'
            }
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        logger.info(f"[Janus] Left room")
        return response
    
    def destroy_room(self, session: JanusSession, room_id: int):
        """Destroy VideoRoom"""
        payload = {
            'janus': 'message',
            'body': {
                'request': 'destroy',
                'room': room_id
            }
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        logger.info(f"[Janus] Room destroyed: {room_id}")
        return response
    
    def list_rooms(self, session: JanusSession) -> List[dict]:
        """List all VideoRooms"""
        payload = {
            'janus': 'message',
            'body': {
                'request': 'list'
            }
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        plugin_data = response.get('plugindata', {})
        data = plugin_data.get('data', {})
        rooms = data.get('list', [])
        
        return rooms
    
    def list_participants(self, session: JanusSession, room_id: int) -> List[dict]:
        """List participants in room"""
        payload = {
            'janus': 'message',
            'body': {
                'request': 'listparticipants',
                'room': room_id
            }
        }
        
        response = self._make_request(
            f"{session.session_id}/{session.handle_id}",
            payload
        )
        
        plugin_data = response.get('plugindata', {})
        data = plugin_data.get('data', {})
        participants = data.get('participants', [])
        
        return participants
    
    def destroy_session(self, session: JanusSession):
        """Destroy Janus session"""
        payload = {'janus': 'destroy'}
        
        response = self._make_request(f"{session.session_id}", payload)
        
        if str(session.session_id) in self.sessions:
            del self.sessions[str(session.session_id)]
        
        logger.info(f"[Janus] Session destroyed: {session.session_id}")
        return response

# Global Janus client
janus_client: Optional[JanusGatewayClient] = None

def get_janus_client() -> JanusGatewayClient:
    """Get global Janus client"""
    global janus_client
    if not janus_client:
        raise RuntimeError("Janus client not initialized")
    return janus_client

def initialize_janus_client(janus_url: str, admin_secret: str = None):
    """Initialize global Janus client"""
    global janus_client
    janus_client = JanusGatewayClient(janus_url, admin_secret)
    logger.info("[Janus] Global client initialized")
