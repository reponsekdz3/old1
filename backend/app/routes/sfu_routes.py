"""
SFU WebRTC Signaling Routes - Group calling with Selective Forwarding
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit, join_room, leave_room
from app.services.sfu_server import sfu_server
from app.models.models import db, User, GroupMember, Group
import logging

logger = logging.getLogger(__name__)

sfu_bp = Blueprint('sfu', __name__, url_prefix='/api/sfu')

@sfu_bp.route('/room/create', methods=['POST'])
@jwt_required()
def create_sfu_room():
    """Create SFU room for group call"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    room_id = data.get('room_id')
    group_id = data.get('group_id')
    
    if not room_id:
        return jsonify({'error': 'room_id required'}), 400
    
    # Verify group membership if group call
    if group_id:
        member = GroupMember.query.filter_by(
            group_id=group_id,
            user_id=user_id
        ).first()
        if not member:
            return jsonify({'error': 'Not a group member'}), 403
    
    room = sfu_server.create_room(room_id, user_id)
    
    return jsonify({
        'room_id': room.room_id,
        'host_user_id': room.host_user_id,
        'max_participants': room.max_participants,
        'e2ee_enabled': room.e2ee_enabled
    }), 200

@sfu_bp.route('/room/<room_id>/participants', methods=['GET'])
@jwt_required()
def get_room_participants(room_id):
    """Get all participants in SFU room"""
    user_id = get_jwt_identity()
    
    # Verify user is in room
    if sfu_server.get_user_room(user_id) != room_id:
        return jsonify({'error': 'Not in room'}), 403
    
    participants = sfu_server.get_room_participants(room_id)
    
    return jsonify({'participants': participants}), 200

def register_sfu_socket_events(socketio):
    """Register SFU WebRTC signaling events"""
    
    @socketio.on('sfu_join')
    def handle_sfu_join(data):
        """Participant joins SFU room"""
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        username = data.get('username', 'User')
        
        if not room_id or not user_id:
            emit('sfu_error', {'error': 'Missing room_id or user_id'})
            return
        
        success = sfu_server.join_room(room_id, user_id, request.sid, username)
        
        if not success:
            emit('sfu_error', {'error': 'Failed to join room'})
            return
        
        # Join socket room
        join_room(room_id)
        
        # Get existing participants
        participants = sfu_server.get_room_participants(room_id)
        
        # Notify new participant of existing participants
        emit('sfu_joined', {
            'room_id': room_id,
            'user_id': user_id,
            'participants': [p for p in participants if p['user_id'] != user_id]
        })
        
        # Notify existing participants of new participant
        emit('sfu_peer_joined', {
            'user_id': user_id,
            'socket_id': request.sid,
            'username': username
        }, room=room_id, skip_sid=request.sid)
        
        logger.info(f"[SFU] User {user_id} joined room {room_id}")
    
    @socketio.on('sfu_leave')
    def handle_sfu_leave(data):
        """Participant leaves SFU room"""
        user_id = data.get('user_id')
        
        room_id, participant = sfu_server.leave_room(user_id)
        
        if room_id:
            leave_room(room_id)
            
            # Notify other participants
            emit('sfu_peer_left', {
                'user_id': user_id,
                'socket_id': request.sid
            }, room=room_id)
            
            logger.info(f"[SFU] User {user_id} left room {room_id}")
    
    @socketio.on('sfu_offer')
    def handle_sfu_offer(data):
        """Forward WebRTC offer to specific peer"""
        target_user_id = data.get('target_user_id')
        offer = data.get('offer')
        sender_user_id = data.get('sender_user_id')
        
        if not all([target_user_id, offer, sender_user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        room_id = sfu_server.get_user_room(sender_user_id)
        if not room_id:
            emit('sfu_error', {'error': 'Not in a room'})
            return
        
        # Forward offer to target peer
        emit('sfu_offer', {
            'sender_user_id': sender_user_id,
            'offer': offer
        }, room=room_id, skip_sid=request.sid)
    
    @socketio.on('sfu_answer')
    def handle_sfu_answer(data):
        """Forward WebRTC answer to specific peer"""
        target_user_id = data.get('target_user_id')
        answer = data.get('answer')
        sender_user_id = data.get('sender_user_id')
        
        if not all([target_user_id, answer, sender_user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        room_id = sfu_server.get_user_room(sender_user_id)
        if not room_id:
            emit('sfu_error', {'error': 'Not in a room'})
            return
        
        # Forward answer to target peer
        emit('sfu_answer', {
            'sender_user_id': sender_user_id,
            'answer': answer
        }, room=room_id, skip_sid=request.sid)
    
    @socketio.on('sfu_ice_candidate')
    def handle_sfu_ice_candidate(data):
        """Forward ICE candidate to specific peer"""
        target_user_id = data.get('target_user_id')
        candidate = data.get('candidate')
        sender_user_id = data.get('sender_user_id')
        
        if not all([target_user_id, candidate, sender_user_id]):
            return
        
        room_id = sfu_server.get_user_room(sender_user_id)
        if not room_id:
            return
        
        # Forward ICE candidate to target peer
        emit('sfu_ice_candidate', {
            'sender_user_id': sender_user_id,
            'candidate': candidate
        }, room=room_id, skip_sid=request.sid)
    
    @socketio.on('sfu_media_state')
    def handle_media_state(data):
        """Update participant media state (audio/video/screen)"""
        user_id = data.get('user_id')
        audio = data.get('audio')
        video = data.get('video')
        screen = data.get('screen')
        
        if not user_id:
            return
        
        success = sfu_server.update_media_state(user_id, audio, video, screen)
        
        if success:
            room_id = sfu_server.get_user_room(user_id)
            if room_id:
                # Broadcast media state to all participants
                emit('sfu_peer_media_state', {
                    'user_id': user_id,
                    'audio': audio,
                    'video': video,
                    'screen': screen
                }, room=room_id)
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle unexpected disconnect"""
        # Find user by socket ID and remove from room
        for room_id, room in list(sfu_server.rooms.items()):
            for user_id, participant in list(room.participants.items()):
                if participant.socket_id == request.sid:
                    sfu_server.leave_room(user_id)
                    emit('sfu_peer_left', {
                        'user_id': user_id,
                        'socket_id': request.sid
                    }, room=room_id)
                    logger.info(f"[SFU] User {user_id} disconnected from room {room_id}")
                    return
