"""
SFU WebRTC Signaling Routes - Group calling with Selective Forwarding
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from flask_socketio import emit, join_room, leave_room
from app.services.sfu_server import sfu_server
from app.models.models import db, User, Group, group_members, Call, CallParticipant
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)

sfu_bp = Blueprint('sfu', __name__, url_prefix='/api/sfu')

@sfu_bp.route('/room/create', methods=['POST'])
@jwt_required()
def create_sfu_room():
    """Create SFU room for group call with advanced configuration"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    room_id = data.get('room_id')
    call_id = data.get('call_id')
    group_id = data.get('group_id')
    max_participants = data.get('max_participants', 50)
    
    if not room_id:
        return jsonify({'error': 'room_id required'}), 400
    
    # Verify group membership if group call
    if group_id:
        group = Group.query.filter_by(id=group_id).first()
        if not group or user_id not in [m.id for m in group.members]:
            return jsonify({'error': 'Not a group member'}), 403
    
    # Create or get call record
    if call_id:
        call = Call.query.filter_by(id=call_id).first()
        if not call:
            return jsonify({'error': 'Call not found'}), 404
        call.room_id = room_id
        call.status = 'answered'
    else:
        # Create new call record
        call = Call(
            id=str(uuid.uuid4()),
            caller_id=user_id,
            group_id=group_id,
            call_type=data.get('call_type', 'video'),
            call_mode='group',
            status='initiated',
            room_id=room_id,
            max_participants=max_participants
        )
        db.session.add(call)
        call_id = call.id
        
        # Add host as participant
        host_participant = CallParticipant(
            id=str(uuid.uuid4()),
            call_id=call_id,
            user_id=user_id,
            role='host',
            status='joined',
            joined_at=datetime.utcnow()
        )
        db.session.add(host_participant)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"[SFU] Error creating call record: {e}")
        return jsonify({'error': 'Failed to create call'}), 500
    
    # Create SFU room
    room = sfu_server.create_room(room_id, int(user_id), max_participants)
    sfu_server.link_call_to_room(room_id, call_id)
    
    logger.info(f"[SFU] Room {room_id} created for call {call_id}")
    
    return jsonify({
        'room_id': room.room_id,
        'call_id': call_id,
        'host_user_id': room.host_user_id,
        'max_participants': room.max_participants,
        'e2ee_enabled': room.e2ee_enabled
    }), 200

@sfu_bp.route('/room/<room_id>/participants', methods=['GET'])
@jwt_required()
def get_room_participants(room_id):
    """Get all participants in SFU room with metrics"""
    user_id = get_jwt_identity()
    
    # Verify user is in room
    if sfu_server.get_user_room(int(user_id)) != room_id:
        return jsonify({'error': 'Not in room'}), 403
    
    participants = sfu_server.get_room_participants(room_id)
    
    return jsonify({
        'room_id': room_id,
        'participants': participants,
        'count': len(participants)
    }), 200


@sfu_bp.route('/room/<room_id>/state', methods=['GET'])
@jwt_required()
def get_room_state_api(room_id):
    """Get complete room state including metrics"""
    user_id = get_jwt_identity()
    
    # Verify user is in room
    if sfu_server.get_user_room(int(user_id)) != room_id:
        return jsonify({'error': 'Not in room'}), 403
    
    state = sfu_server.get_room_state(room_id)
    if not state:
        return jsonify({'error': 'Room not found'}), 404
    
    return jsonify(state), 200


@sfu_bp.route('/room/<room_id>/lock', methods=['POST'])
@jwt_required()
def lock_room(room_id):
    """Lock room to prevent new joins (host only)"""
    user_id = get_jwt_identity()
    
    if not sfu_server.is_host(room_id, int(user_id)):
        return jsonify({'error': 'Only host can lock room'}), 403
    
    success = sfu_server.lock_room(room_id)
    if not success:
        return jsonify({'error': 'Room not found'}), 404
    
    logger.info(f"[SFU] Room {room_id} locked by {user_id}")
    return jsonify({'message': 'Room locked'}), 200


@sfu_bp.route('/room/<room_id>/unlock', methods=['POST'])
@jwt_required()
def unlock_room(room_id):
    """Unlock room to allow new joins (host only)"""
    user_id = get_jwt_identity()
    
    if not sfu_server.is_host(room_id, int(user_id)):
        return jsonify({'error': 'Only host can unlock room'}), 403
    
    success = sfu_server.unlock_room(room_id)
    if not success:
        return jsonify({'error': 'Room not found'}), 404
    
    logger.info(f"[SFU] Room {room_id} unlocked by {user_id}")
    return jsonify({'message': 'Room unlocked'}), 200


@sfu_bp.route('/room/<room_id>/end', methods=['POST'])
@jwt_required()
def end_room(room_id):
    """End room and remove all participants (host only)"""
    user_id = get_jwt_identity()
    
    if not sfu_server.is_host(room_id, int(user_id)):
        return jsonify({'error': 'Only host can end room'}), 403
    
    # Update call record
    room_state = sfu_server.get_room_state(room_id)
    if room_state and room_state.get('call_id'):
        call = Call.query.filter_by(id=room_state['call_id']).first()
        if call:
            call.status = 'ended'
            call.ended_at = datetime.utcnow()
            if call.started_at:
                call.duration = int((call.ended_at - call.started_at).total_seconds())
            
            # Update all participant durations
            for participant in call.participants:
                if participant.joined_at and not participant.left_at:
                    participant.left_at = datetime.utcnow()
                    participant.duration = int((participant.left_at - participant.joined_at).total_seconds())
            
            db.session.commit()
    
    success = sfu_server.end_room(room_id)
    if not success:
        return jsonify({'error': 'Room not found'}), 404
    
    logger.info(f"[SFU] Room {room_id} ended by {user_id}")
    return jsonify({'message': 'Room ended'}), 200

def register_sfu_socket_events(socketio):
    """Register SFU WebRTC signaling events with participant management"""
    
    @socketio.on('sfu_join')
    def handle_sfu_join(data):
        """Participant joins SFU room with role tracking"""
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        username = data.get('username', 'User')
        role = data.get('role', 'participant')
        
        if not room_id or not user_id:
            emit('sfu_error', {'error': 'Missing room_id or user_id'})
            return
        
        # Validate room exists and is active
        room_state = sfu_server.get_room_state(room_id)
        if not room_state:
            emit('sfu_error', {'error': 'Room not found'})
            return
        
        if not room_state.get('active'):
            emit('sfu_error', {'error': 'Room is not active'})
            return
        
        # Join SFU room
        success = sfu_server.join_room(room_id, user_id, request.sid, username, role)
        
        if not success:
            emit('sfu_error', {'error': 'Failed to join room - room may be full or locked'})
            return
        
        # Join socket room
        join_room(room_id)
        join_room(f"user_{user_id}")
        
        # Update database participant record
        if room_state.get('call_id'):
            participant = CallParticipant.query.filter_by(
                call_id=room_state['call_id'],
                user_id=str(user_id)
            ).first()
            if participant:
                participant.status = 'joined'
                participant.joined_at = datetime.utcnow()
                participant.socket_id = request.sid
                db.session.commit()
        
        # Get existing participants
        participants = sfu_server.get_room_participants(room_id)
        
        # Notify new participant of existing participants
        emit('sfu_joined', {
            'room_id': room_id,
            'user_id': user_id,
            'role': sfu_server.get_participant(room_id, user_id).role if sfu_server.get_participant(room_id, user_id) else 'participant',
            'participants': [p for p in participants if p['user_id'] != user_id]
        })
        
        # Notify existing participants of new participant
        emit('sfu_peer_joined', {
            'user_id': user_id,
            'socket_id': request.sid,
            'username': username,
            'role': sfu_server.get_participant(room_id, user_id).role if sfu_server.get_participant(room_id, user_id) else 'participant'
        }, room=room_id, skip_sid=request.sid)
        
        logger.info(f"[SFU] User {user_id} joined room {room_id}")
    
    @socketio.on('sfu_leave')
    def handle_sfu_leave(data):
        """Participant leaves SFU room with cleanup"""
        user_id = data.get('user_id')
        
        room_id, participant = sfu_server.leave_room(user_id)
        
        if room_id:
            leave_room(room_id)
            
            # Update database participant record
            room_state = sfu_server.get_room_state(room_id)
            if room_state and room_state.get('call_id'):
                db_participant = CallParticipant.query.filter_by(
                    call_id=room_state['call_id'],
                    user_id=str(user_id)
                ).first()
                if db_participant:
                    db_participant.status = 'left'
                    db_participant.left_at = datetime.utcnow()
                    if db_participant.joined_at:
                        db_participant.duration = int((db_participant.left_at - db_participant.joined_at).total_seconds())
                    db.session.commit()
            
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
    
    @socketio.on('sfu_invite_participant')
    def handle_invite_participant(data):
        """Invite a participant to join the call with full tracking"""
        room_id = data.get('room_id')
        target_user_id = data.get('target_user_id')
        sender_user_id = data.get('sender_user_id')
        
        if not all([room_id, target_user_id, sender_user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        # Validate action
        can_proceed, error_msg = sfu_server.validate_action(room_id, int(sender_user_id), 'invite_participant')
        if not can_proceed:
            emit('sfu_error', {'error': error_msg})
            return
        
        # Verify sender is host
        if not sfu_server.is_host(room_id, int(sender_user_id)):
            emit('sfu_error', {'error': 'Only host can invite participants'})
            logger.warning(f"[SFU] Non-host {sender_user_id} attempted to invite in room {room_id}")
            return
        
        # Add invitation to room
        sfu_server.invite_participant(room_id, int(target_user_id))
        
        # Get room state for call_id
        room_state = sfu_server.get_room_state(room_id)
        
        # Create database participant record if call exists
        if room_state and room_state.get('call_id'):
            existing = CallParticipant.query.filter_by(
                call_id=room_state['call_id'],
                user_id=str(target_user_id)
            ).first()
            
            if not existing:
                # Verify user exists
                target_user = User.query.filter_by(id=str(target_user_id)).first()
                if target_user:
                    participant = CallParticipant(
                        id=str(uuid.uuid4()),
                        call_id=room_state['call_id'],
                        user_id=str(target_user_id),
                        role='participant',
                        status='invited',
                        invited_at=datetime.utcnow()
                    )
                    db.session.add(participant)
                    db.session.commit()
        
        # Broadcast invitation to all in room
        emit('sfu_participant_invited', {
            'target_user_id': target_user_id,
            'invited_by': sender_user_id,
            'room_id': room_id,
            'call_id': room_state.get('call_id') if room_state else None
        }, room=room_id)
        
        # Send direct notification to invited user
        emit('sfu_call_invitation', {
            'room_id': room_id,
            'invited_by': sender_user_id,
            'call_id': room_state.get('call_id') if room_state else None
        }, room=f"user_{target_user_id}")
        
        logger.info(f"[SFU] User {target_user_id} invited to room {room_id} by {sender_user_id}")
    
    @socketio.on('sfu_promote_to_host')
    def handle_promote_to_host(data):
        """Promote a participant to host with database sync"""
        room_id = data.get('room_id')
        target_user_id = data.get('target_user_id')
        sender_user_id = data.get('sender_user_id')
        
        if not all([room_id, target_user_id, sender_user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        # Validate action
        can_proceed, error_msg = sfu_server.validate_action(room_id, int(sender_user_id), 'promote_to_host')
        if not can_proceed:
            emit('sfu_error', {'error': error_msg})
            return
        
        # Verify sender is host
        if not sfu_server.is_host(room_id, int(sender_user_id)):
            emit('sfu_error', {'error': 'Only host can promote participants'})
            logger.warning(f"[SFU] Non-host {sender_user_id} attempted to promote in room {room_id}")
            return
        
        # Promote participant in SFU
        success = sfu_server.promote_to_host(room_id, int(target_user_id))
        
        if success:
            # Update database
            room_state = sfu_server.get_room_state(room_id)
            if room_state and room_state.get('call_id'):
                db_participant = CallParticipant.query.filter_by(
                    call_id=room_state['call_id'],
                    user_id=str(target_user_id)
                ).first()
                if db_participant:
                    db_participant.role = 'host'
                    db.session.commit()
            
            # Broadcast promotion to all in room
            emit('sfu_participant_promoted', {
                'promoted_user_id': target_user_id,
                'promoted_by': sender_user_id,
                'room_id': room_id
            }, room=room_id)
            
            logger.info(f"[SFU] User {target_user_id} promoted to host in room {room_id}")
        else:
            emit('sfu_error', {'error': 'Failed to promote participant'})
    
    @socketio.on('sfu_remove_participant')
    def handle_remove_participant(data):
        """Remove a participant from the call with full cleanup"""
        room_id = data.get('room_id')
        target_user_id = data.get('target_user_id')
        sender_user_id = data.get('sender_user_id')
        
        if not all([room_id, target_user_id, sender_user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        # Validate action
        can_proceed, error_msg = sfu_server.validate_action(room_id, int(sender_user_id), 'remove_participant')
        if not can_proceed:
            emit('sfu_error', {'error': error_msg})
            return
        
        # Verify sender is host
        if not sfu_server.is_host(room_id, int(sender_user_id)):
            emit('sfu_error', {'error': 'Only host can remove participants'})
            logger.warning(f"[SFU] Non-host {sender_user_id} attempted to remove participant in room {room_id}")
            return
        
        # Prevent removing yourself
        if int(target_user_id) == int(sender_user_id):
            emit('sfu_error', {'error': 'Cannot remove yourself'})
            return
        
        # Remove participant from SFU
        success = sfu_server.remove_participant(room_id, int(target_user_id))
        
        if success:
            # Update database
            room_state = sfu_server.get_room_state(room_id)
            if room_state and room_state.get('call_id'):
                db_participant = CallParticipant.query.filter_by(
                    call_id=room_state['call_id'],
                    user_id=str(target_user_id)
                ).first()
                if db_participant:
                    db_participant.status = 'left'
                    db_participant.left_at = datetime.utcnow()
                    if db_participant.joined_at:
                        db_participant.duration = int((db_participant.left_at - db_participant.joined_at).total_seconds())
                    db.session.commit()
            
            # Broadcast removal to all in room
            emit('sfu_participant_removed', {
                'removed_user_id': target_user_id,
                'removed_by': sender_user_id,
                'room_id': room_id
            }, room=room_id)
            
            # Notify removed user
            emit('sfu_removed_from_call', {
                'room_id': room_id,
                'removed_by': sender_user_id,
                'reason': 'removed_by_host'
            }, room=f"user_{target_user_id}")
            
            logger.info(f"[SFU] User {target_user_id} removed from room {room_id} by {sender_user_id}")
        else:
            emit('sfu_error', {'error': 'Failed to remove participant'})
    
    @socketio.on('sfu_mute_participant')
    def handle_mute_participant(data):
        """Mute a participant's audio or video with database sync"""
        room_id = data.get('room_id')
        target_user_id = data.get('target_user_id')
        sender_user_id = data.get('sender_user_id')
        mute_audio = data.get('mute_audio', False)
        mute_video = data.get('mute_video', False)
        
        if not all([room_id, target_user_id, sender_user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        # Allow muting self or host can mute others
        is_host = sfu_server.is_host(room_id, int(sender_user_id))
        if int(target_user_id) != int(sender_user_id) and not is_host:
            emit('sfu_error', {'error': 'Only host can mute other participants'})
            logger.warning(f"[SFU] User {sender_user_id} attempted to mute {target_user_id} without authority in room {room_id}")
            return
        
        # Mute participant in SFU
        if mute_audio or mute_video:
            sfu_server.mute_participant(room_id, int(target_user_id), mute_audio, mute_video)
        else:
            sfu_server.unmute_participant(room_id, int(target_user_id), not mute_audio, not mute_video)
        
        # Update database
        room_state = sfu_server.get_room_state(room_id)
        if room_state and room_state.get('call_id'):
            db_participant = CallParticipant.query.filter_by(
                call_id=room_state['call_id'],
                user_id=str(target_user_id)
            ).first()
            if db_participant:
                if mute_audio:
                    db_participant.is_muted = True
                    db_participant.audio_enabled = False
                if mute_video:
                    db_participant.is_video_muted = True
                    db_participant.video_enabled = False
                db.session.commit()
        
        # Broadcast mute state to all in room
        emit('sfu_participant_muted', {
            'user_id': target_user_id,
            'mute_audio': mute_audio,
            'mute_video': mute_video,
            'room_id': room_id
        }, room=room_id)
        
        logger.info(f"[SFU] User {target_user_id} muted in room {room_id} (audio={mute_audio}, video={mute_video})")
    
    @socketio.on('sfu_update_quality')
    def handle_update_quality(data):
        """Update participant's video quality with database sync"""
        room_id = data.get('room_id')
        target_user_id = data.get('target_user_id')
        sender_user_id = data.get('sender_user_id')
        quality = data.get('quality')
        
        if not all([room_id, target_user_id, sender_user_id, quality]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        if quality not in ['low', 'medium', 'high']:
            emit('sfu_error', {'error': 'Quality must be low, medium, or high'})
            return
        
        # Allow updating own quality or host can update others
        is_host = sfu_server.is_host(room_id, int(sender_user_id))
        if int(target_user_id) != int(sender_user_id) and not is_host:
            emit('sfu_error', {'error': 'Only host can update quality for other participants'})
            logger.warning(f"[SFU] User {sender_user_id} attempted to update quality for {target_user_id} in room {room_id}")
            return
        
        # Update quality in SFU
        success = sfu_server.update_video_quality(room_id, int(target_user_id), quality)
        
        if success:
            # Update database
            room_state = sfu_server.get_room_state(room_id)
            if room_state and room_state.get('call_id'):
                db_participant = CallParticipant.query.filter_by(
                    call_id=room_state['call_id'],
                    user_id=str(target_user_id)
                ).first()
                if db_participant:
                    quality_settings = {
                        'low': {'bandwidth': 500},
                        'medium': {'bandwidth': 2500},
                        'high': {'bandwidth': 5000}
                    }
                    db_participant.video_quality = quality
                    db_participant.bandwidth_limit = quality_settings[quality]['bandwidth']
                    db.session.commit()
            
            # Broadcast quality update to all in room
            emit('sfu_participant_quality_updated', {
                'user_id': target_user_id,
                'quality': quality,
                'room_id': room_id
            }, room=room_id)
            
            logger.info(f"[SFU] Quality updated for user {target_user_id} to {quality} in room {room_id}")
        else:
            emit('sfu_error', {'error': 'Failed to update quality'})
    
    @socketio.on('sfu_get_room_state')
    def handle_get_room_state(data):
        """Get complete room state with metrics"""
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        
        if not room_id:
            emit('sfu_error', {'error': 'room_id required'})
            return
        
        # Verify user is in room
        if user_id and sfu_server.get_user_room(int(user_id)) != room_id:
            emit('sfu_error', {'error': 'Not authorized to view this room'})
            return
        
        state = sfu_server.get_room_state(room_id)
        
        if state:
            emit('sfu_room_state', state)
        else:
            emit('sfu_error', {'error': 'Room not found'})
    
    @socketio.on('sfu_update_metrics')
    def handle_update_metrics(data):
        """Update participant metrics for monitoring"""
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        metrics = data.get('metrics', {})
        
        if not all([room_id, user_id]):
            return
        
        sfu_server.update_participant_metrics(room_id, int(user_id), metrics)
    
    @socketio.on('sfu_lock_room')
    def handle_lock_room(data):
        """Lock room to prevent new joins (host only)"""
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        
        if not all([room_id, user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        if not sfu_server.is_host(room_id, int(user_id)):
            emit('sfu_error', {'error': 'Only host can lock room'})
            return
        
        success = sfu_server.lock_room(room_id)
        
        if success:
            emit('sfu_room_locked', {'room_id': room_id, 'locked_by': user_id}, room=room_id)
            logger.info(f"[SFU] Room {room_id} locked by {user_id}")
        else:
            emit('sfu_error', {'error': 'Failed to lock room'})
    
    @socketio.on('sfu_unlock_room')
    def handle_unlock_room(data):
        """Unlock room to allow new joins (host only)"""
        room_id = data.get('room_id')
        user_id = data.get('user_id')
        
        if not all([room_id, user_id]):
            emit('sfu_error', {'error': 'Missing required fields'})
            return
        
        if not sfu_server.is_host(room_id, int(user_id)):
            emit('sfu_error', {'error': 'Only host can unlock room'})
            return
        
        success = sfu_server.unlock_room(room_id)
        
        if success:
            emit('sfu_room_unlocked', {'room_id': room_id, 'unlocked_by': user_id}, room=room_id)
            logger.info(f"[SFU] Room {room_id} unlocked by {user_id}")
        else:
            emit('sfu_error', {'error': 'Failed to unlock room'})
