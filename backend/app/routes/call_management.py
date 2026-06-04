"""
Advanced Call Participant Management API Endpoints
Handles participant management, role-based operations, and call quality control
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Call, CallParticipant, Group
from app.services.sfu_server import sfu_server
from datetime import datetime
import uuid
import logging
from flask_socketio import SocketIO
from functools import wraps

logger = logging.getLogger(__name__)

# Global socketio instance for emitting events
_socketio = None

def set_socketio(socketio):
    """Set the SocketIO instance for broadcasting events"""
    global _socketio
    _socketio = socketio

call_mgmt_bp = Blueprint('call_management', __name__, url_prefix='/api/calls')


def _get_current_user() -> str:
    """Get current authenticated user ID"""
    return get_jwt_identity()


def _is_call_host(call_id: str, user_id: str) -> bool:
    """Check if user is the host of the call"""
    call = Call.query.filter_by(id=call_id).first()
    return call and call.caller_id == user_id


def _is_participant_in_call(call_id: str, user_id: str) -> bool:
    """Check if user is a participant in the call"""
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=user_id
    ).first()
    return participant is not None


def _get_call_or_404(call_id: str) -> Call:
    """Get call or return 404 error"""
    call = Call.query.filter_by(id=call_id).first()
    if not call:
        return None
    return call


def _validate_call_state(call: Call, allowed_states: list) -> bool:
    """Validate call is in an allowed state"""
    return call.status in allowed_states


def _broadcast_to_call(call_id: str, event: str, data: dict):
    """Broadcast event to all participants in a call"""
    if _socketio:
        _socketio.emit(event, data, room=f"call_{call_id}")
        logger.debug(f"[CALL_MGMT] Broadcast {event} to call {call_id}")


@call_mgmt_bp.route('/<call_id>/participants', methods=['GET'])
@jwt_required()
def get_call_participants(call_id: str):
    """
    Get all participants in a call with their status and media states
    
    Required: User must be a participant in the call
    Response: List of participants with roles, media states, and join times
    """
    user_id = _get_current_user()
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    if not _is_participant_in_call(call_id, user_id):
        logger.warning(f"[CALL_MGMT] User {user_id} attempted to view participants of unauthorized call {call_id}")
        return jsonify({'error': 'Not authorized to view this call'}), 403
    
    participants = CallParticipant.query.filter_by(call_id=call_id).all()
    
    logger.info(f"[CALL_MGMT] Retrieved {len(participants)} participants for call {call_id}")
    
    return jsonify({
        'call_id': call_id,
        'status': call.status,
        'participants': [p.to_dict() for p in participants],
        'participants_count': len(participants),
        'room_id': call.room_id
    }), 200


@call_mgmt_bp.route('/<call_id>/add-participant', methods=['POST'])
@jwt_required()
def add_participant(call_id: str):
    """
    Add a new participant to the call
    
    Required: Caller must be the call host
    Payload: {
        "user_id": "participant_user_id",
        "role": "participant|viewer"  # optional, defaults to "participant"
    }
    Response: Newly created CallParticipant object
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data or 'user_id' not in data:
        return jsonify({'error': 'user_id is required'}), 400
    
    new_participant_id = data.get('user_id')
    role = data.get('role', 'participant')
    
    if role not in ['participant', 'viewer', 'host']:
        return jsonify({'error': 'Invalid role. Must be participant, viewer, or host'}), 400
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    # Authorization: Only host can add participants
    if not _is_call_host(call_id, user_id):
        logger.warning(f"[CALL_MGMT] User {user_id} attempted to add participant without host privileges to call {call_id}")
        return jsonify({'error': 'Only the call host can add participants'}), 403
    
    # Verify call status
    if call.status not in ['answered', 'initiated', 'ringing']:
        return jsonify({'error': f'Cannot add participants to a call in {call.status} status'}), 409
    
    # Check if participant already exists
    existing = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=new_participant_id
    ).first()
    
    if existing:
        logger.info(f"[CALL_MGMT] User {new_participant_id} already in call {call_id}")
        return jsonify({'error': 'Participant already in call'}), 409
    
    # Verify new participant exists
    new_user = User.query.filter_by(id=new_participant_id).first()
    if not new_user:
        return jsonify({'error': 'Target user not found'}), 404
    
    # Check participant limit
    current_count = CallParticipant.query.filter_by(call_id=call_id).count()
    if current_count >= call.max_participants:
        logger.warning(f"[CALL_MGMT] Call {call_id} is at maximum capacity ({call.max_participants})")
        return jsonify({'error': f'Call has reached maximum participants ({call.max_participants})'}), 409
    
    # Create new call participant
    participant = CallParticipant(
        id=str(uuid.uuid4()),
        call_id=call_id,
        user_id=new_participant_id,
        role=role,
        status='invited'
    )
    
    db.session.add(participant)
    
    # Add to SFU room if active and link to call
    if call.room_id and call.room_id in sfu_server.rooms:
        sfu_server.invite_participant(call.room_id, int(new_participant_id))
        sfu_server.link_call_to_room(call.room_id, call_id)
    
    try:
        db.session.commit()
        logger.info(f"[CALL_MGMT] Added participant {new_participant_id} to call {call_id} with role {role}")
        
        # Broadcast to all participants
        _broadcast_to_call(call_id, 'participant_added', {
            'call_id': call_id,
            'participant': participant.to_dict(),
            'added_by': user_id
        })
        
        # Send direct notification to invited user
        if _socketio:
            _socketio.emit('call_invitation', {
                'call_id': call_id,
                'call_type': call.call_type,
                'call_mode': call.call_mode,
                'host_id': call.caller_id,
                'host_name': call.caller.full_name if call.caller else None,
                'role': role,
                'room_id': call.room_id
            }, room=f"user_{new_participant_id}")
        
        return jsonify({
            'message': 'Participant added successfully',
            'participant': participant.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error adding participant: {str(e)}")
        return jsonify({'error': 'Failed to add participant'}), 500


@call_mgmt_bp.route('/<call_id>/remove-participant', methods=['POST'])
@jwt_required()
def remove_participant(call_id: str):
    """
    Remove a participant from the call
    
    Required: Caller must be the call host
    Payload: {
        "user_id": "participant_to_remove"
    }
    Response: Success message with removed participant details
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data or 'user_id' not in data:
        return jsonify({'error': 'user_id is required'}), 400
    
    participant_id = data.get('user_id')
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    # Authorization: Only host can remove participants
    if not _is_call_host(call_id, user_id):
        logger.warning(f"[CALL_MGMT] User {user_id} attempted to remove participant without host privileges from call {call_id}")
        return jsonify({'error': 'Only the call host can remove participants'}), 403
    
    # Prevent host from removing themselves (call would end)
    if participant_id == call.caller_id:
        return jsonify({'error': 'Host cannot remove themselves. End the call instead'}), 400
    
    # Find participant
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=participant_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'Participant not found in this call'}), 404
    
    # Remove from SFU room if active
    if call.room_id and call.room_id in sfu_server.rooms:
        sfu_server.remove_participant(call.room_id, int(participant_id))
    
    try:
        participant_data = participant.to_dict()
        participant.left_at = datetime.utcnow()
        participant.status = 'left'
        
        # Calculate duration if they joined
        if participant.joined_at:
            participant.duration = int((participant.left_at - participant.joined_at).total_seconds())
        
        db.session.commit()
        
        logger.info(f"[CALL_MGMT] Removed participant {participant_id} from call {call_id}")
        
        # Broadcast removal to all participants
        _broadcast_to_call(call_id, 'participant_removed', {
            'call_id': call_id,
            'user_id': participant_id,
            'removed_by': user_id
        })
        
        # Notify removed user
        if _socketio:
            _socketio.emit('removed_from_call', {
                'call_id': call_id,
                'removed_by': user_id,
                'reason': 'removed_by_host'
            }, room=f"user_{participant_id}")
        
        return jsonify({
            'message': 'Participant removed successfully',
            'participant': participant_data
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error removing participant: {str(e)}")
        return jsonify({'error': 'Failed to remove participant'}), 500


@call_mgmt_bp.route('/<call_id>/promote-participant', methods=['POST'])
@jwt_required()
def promote_participant(call_id: str):
    """
    Promote a participant to host role
    
    Required: Caller must be the current call host
    Payload: {
        "user_id": "participant_to_promote"
    }
    Response: Updated participant with new host role
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data or 'user_id' not in data:
        return jsonify({'error': 'user_id is required'}), 400
    
    target_user_id = data.get('user_id')
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    # Authorization: Only current host can promote others
    if not _is_call_host(call_id, user_id):
        logger.warning(f"[CALL_MGMT] Non-host {user_id} attempted to promote participant in call {call_id}")
        return jsonify({'error': 'Only the call host can promote participants'}), 403
    
    # Cannot promote yourself
    if target_user_id == user_id:
        return jsonify({'error': 'Cannot promote yourself'}), 400
    
    # Find participant
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=target_user_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'Participant not found in this call'}), 404
    
    if participant.status not in ['joined', 'answered']:
        return jsonify({'error': f'Cannot promote participant with status {participant.status}'}), 409
    
    try:
        # Update database
        old_role = participant.role
        participant.role = 'host'
        
        # Update in SFU if active
        if call.room_id and call.room_id in sfu_server.rooms:
            sfu_server.promote_to_host(call.room_id, int(target_user_id))
        
        db.session.commit()
        
        logger.info(f"[CALL_MGMT] Promoted participant {target_user_id} from {old_role} to host in call {call_id}")
        
        # Broadcast promotion to all participants
        _broadcast_to_call(call_id, 'participant_promoted', {
            'call_id': call_id,
            'user_id': target_user_id,
            'promoted_by': user_id,
            'new_role': 'host'
        })
        
        return jsonify({
            'message': 'Participant promoted to host',
            'participant': participant.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error promoting participant: {str(e)}")
        return jsonify({'error': 'Failed to promote participant'}), 500


@call_mgmt_bp.route('/<call_id>/mute-participant', methods=['POST'])
@jwt_required()
def mute_participant(call_id: str):
    """
    Mute or unmute a participant's audio or video
    
    Required: Caller must be the call host or the participant themselves
    Payload: {
        "user_id": "participant_to_mute",  # Can be self or another participant (host only for others)
        "mute_audio": true|false,
        "mute_video": true|false
    }
    Response: Updated participant with new mute states
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data or 'user_id' not in data:
        return jsonify({'error': 'user_id is required'}), 400
    
    target_user_id = data.get('user_id')
    mute_audio = data.get('mute_audio', False)
    mute_video = data.get('mute_video', False)
    
    if not isinstance(mute_audio, bool) or not isinstance(mute_video, bool):
        return jsonify({'error': 'mute_audio and mute_video must be boolean'}), 400
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    # Authorization: Can only mute self or host can mute others
    is_host = _is_call_host(call_id, user_id)
    if target_user_id != user_id and not is_host:
        logger.warning(f"[CALL_MGMT] Non-host {user_id} attempted to mute other participant in call {call_id}")
        return jsonify({'error': 'Only the host can mute other participants'}), 403
    
    # Find participant
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=target_user_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'Participant not found in this call'}), 404
    
    try:
        # Update database
        if mute_audio:
            participant.is_muted = True
            participant.audio_enabled = False
        else:
            participant.is_muted = False
            participant.audio_enabled = True
        
        if mute_video:
            participant.is_video_muted = True
            participant.video_enabled = False
        else:
            participant.is_video_muted = False
            participant.video_enabled = True
        
        # Update in SFU if active
        if call.room_id and call.room_id in sfu_server.rooms:
            if mute_audio:
                sfu_server.mute_participant(call.room_id, int(target_user_id), mute_audio=True)
            if mute_video:
                sfu_server.mute_participant(call.room_id, int(target_user_id), mute_video=True)
        
        db.session.commit()
        
        logger.info(f"[CALL_MGMT] Updated mute state for {target_user_id} in call {call_id} (audio={mute_audio}, video={mute_video})")
        
        # Broadcast mute state to all participants
        _broadcast_to_call(call_id, 'participant_mute_changed', {
            'call_id': call_id,
            'user_id': target_user_id,
            'is_muted': mute_audio,
            'is_video_muted': mute_video,
            'changed_by': user_id
        })
        
        return jsonify({
            'message': 'Participant mute state updated',
            'participant': participant.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error updating mute state: {str(e)}")
        return jsonify({'error': 'Failed to update mute state'}), 500


@call_mgmt_bp.route('/<call_id>/update-quality', methods=['POST'])
@jwt_required()
def update_video_quality(call_id: str):
    """
    Update video quality and bandwidth limit for a participant
    
    Required: Caller must be the call host or the participant themselves
    Payload: {
        "user_id": "participant_to_update",
        "quality": "low|medium|high"
    }
    Response: Updated participant with new quality settings
    Quality profiles:
        - low: 320x240, 500 kbps
        - medium: 640x480, 2500 kbps
        - high: 1280x720, 5000 kbps
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data or 'user_id' not in data or 'quality' not in data:
        return jsonify({'error': 'user_id and quality are required'}), 400
    
    target_user_id = data.get('user_id')
    quality = data.get('quality')
    
    if quality not in ['low', 'medium', 'high']:
        return jsonify({'error': 'Quality must be low, medium, or high'}), 400
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    # Authorization: Can only update self or host can update others
    is_host = _is_call_host(call_id, user_id)
    if target_user_id != user_id and not is_host:
        logger.warning(f"[CALL_MGMT] Non-host {user_id} attempted to update quality for other participant in call {call_id}")
        return jsonify({'error': 'Only the host can update quality for other participants'}), 403
    
    # Find participant
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=target_user_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'Participant not found in this call'}), 404
    
    try:
        # Quality settings mapping
        quality_settings = {
            'low': {'bandwidth': 500, 'resolution': '320x240'},
            'medium': {'bandwidth': 2500, 'resolution': '640x480'},
            'high': {'bandwidth': 5000, 'resolution': '1280x720'},
        }
        
        settings = quality_settings[quality]
        
        # Update database
        participant.video_quality = quality
        participant.bandwidth_limit = settings['bandwidth']
        
        # Update in SFU if active
        if call.room_id and call.room_id in sfu_server.rooms:
            sfu_server.update_video_quality(call.room_id, int(target_user_id), quality)
        
        db.session.commit()
        
        logger.info(f"[CALL_MGMT] Updated quality for {target_user_id} to {quality} in call {call_id} (bandwidth={settings['bandwidth']} kbps)")
        
        # Broadcast quality update to all participants
        _broadcast_to_call(call_id, 'participant_quality_changed', {
            'call_id': call_id,
            'user_id': target_user_id,
            'quality': quality,
            'bandwidth_limit': settings['bandwidth'],
            'resolution': settings['resolution']
        })
        
        return jsonify({
            'message': 'Video quality updated',
            'quality': quality,
            'bandwidth_limit': settings['bandwidth'],
            'resolution': settings['resolution'],
            'participant': participant.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error updating quality: {str(e)}")
        return jsonify({'error': 'Failed to update quality'}), 500


@call_mgmt_bp.route('/<call_id>/state', methods=['GET'])
@jwt_required()
def get_call_state(call_id: str):
    """
    Get complete call state including participants, room info, and metadata
    
    Required: User must be a participant in the call
    Response: Complete call state with all participants and their status
    """
    user_id = _get_current_user()
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    if not _is_participant_in_call(call_id, user_id):
        logger.warning(f"[CALL_MGMT] User {user_id} attempted to view state of unauthorized call {call_id}")
        return jsonify({'error': 'Not authorized to view this call'}), 403
    
    participants = CallParticipant.query.filter_by(call_id=call_id).all()
    
    call_state = call.to_dict()
    call_state['participants'] = [p.to_dict() for p in participants]
    
    # Add SFU room state if available
    if call.room_id and call.room_id in sfu_server.rooms:
        room_state = sfu_server.get_room_state(call.room_id)
        call_state['room_state'] = room_state
    
    logger.info(f"[CALL_MGMT] Retrieved state for call {call_id}")
    
    return jsonify(call_state), 200


@call_mgmt_bp.route('/<call_id>/participants/<participant_id>', methods=['GET'])
@jwt_required()
def get_participant_details(call_id: str, participant_id: str):
    """
    Get detailed information about a specific participant
    
    Required: User must be a participant in the call
    Response: Detailed participant information with media states
    """
    user_id = _get_current_user()
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    if not _is_participant_in_call(call_id, user_id):
        return jsonify({'error': 'Not authorized to view this call'}), 403
    
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=participant_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'Participant not found in this call'}), 404
    
    return jsonify(participant.to_dict()), 200


@call_mgmt_bp.route('/<call_id>/update-media', methods=['POST'])
@jwt_required()
def update_participant_media(call_id: str):
    """
    Update participant's media state (audio/video/screen share)
    Self-only operation - participants can only update their own state
    
    Payload: {
        "audio_enabled": true|false,
        "video_enabled": true|false,
        "screen_share": true|false
    }
    Response: Updated participant with new media states
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data:
        return jsonify({'error': 'Request body is required'}), 400
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    participant = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=user_id
    ).first()
    
    if not participant:
        return jsonify({'error': 'You are not in this call'}), 404
    
    try:
        # Update media states
        if 'audio_enabled' in data:
            participant.audio_enabled = bool(data.get('audio_enabled'))
        
        if 'video_enabled' in data:
            participant.video_enabled = bool(data.get('video_enabled'))
        
        if 'screen_share' in data:
            participant.screen_share = bool(data.get('screen_share'))
        
        # Update in SFU if active
        if call.room_id and call.room_id in sfu_server.rooms:
            sfu_server.update_media_state(
                int(user_id),
                audio=participant.audio_enabled,
                video=participant.video_enabled,
                screen=participant.screen_share
            )
        
        db.session.commit()
        
        logger.info(f"[CALL_MGMT] Updated media state for user {user_id} in call {call_id}")
        
        # Broadcast media state to all participants
        _broadcast_to_call(call_id, 'participant_media_changed', {
            'call_id': call_id,
            'user_id': user_id,
            'audio_enabled': participant.audio_enabled,
            'video_enabled': participant.video_enabled,
            'screen_share': participant.screen_share
        })
        
        return jsonify({
            'message': 'Media state updated',
            'participant': participant.to_dict()
        }), 200


@call_mgmt_bp.route('/<call_id>/convert-to-group', methods=['POST'])
@jwt_required()
def convert_peer_to_group_call(call_id: str):
    """
    Convert a 1-to-1 call to a group call by adding a new participant
    
    This allows adding participants during an ongoing voice/video call
    Required: Caller must be one of the participants in the call
    Payload: {
        "new_participant_id": "user_id_to_add",
        "role": "participant|viewer"  # optional
    }
    Response: Updated call with new participant
    """
    user_id = _get_current_user()
    data = request.get_json()
    
    if not data or 'new_participant_id' not in data:
        return jsonify({'error': 'new_participant_id is required'}), 400
    
    new_participant_id = data.get('new_participant_id')
    role = data.get('role', 'participant')
    
    call = _get_call_or_404(call_id)
    if not call:
        return jsonify({'error': 'Call not found'}), 404
    
    # Verify user is a participant in the call
    if not _is_participant_in_call(call_id, user_id):
        logger.warning(f"[CALL_MGMT] User {user_id} attempted to add participant to unauthorized call {call_id}")
        return jsonify({'error': 'Not authorized to modify this call'}), 403
    
    # Verify call is active
    if call.status not in ['answered', 'ringing']:
        return jsonify({'error': f'Cannot add participants to a call in {call.status} status'}), 409
    
    # Check if this is a peer call being converted to group
    if call.call_mode == 'peer':
        # Convert to group call
        call.call_mode = 'group'
        logger.info(f"[CALL_MGMT] Converting peer call {call_id} to group call")
        
        # Create SFU room if doesn't exist
        if not call.room_id:
            room_id = f"call_{call_id}_{uuid.uuid4().hex[:8]}"
            call.room_id = room_id
            sfu_server.create_room(room_id, int(call.caller_id), call.max_participants)
            sfu_server.link_call_to_room(room_id, call_id)
            
            # Add existing participants to SFU room
            existing_participants = CallParticipant.query.filter_by(call_id=call_id).all()
            for p in existing_participants:
                if p.user_id and p.status == 'joined':
                    sfu_server.join_room(room_id, int(p.user_id), p.socket_id or '', p.user.full_name if p.user else 'User')
    
    # Verify new participant exists and is not already in call
    new_user = User.query.filter_by(id=new_participant_id).first()
    if not new_user:
        return jsonify({'error': 'Target user not found'}), 404
    
    existing = CallParticipant.query.filter_by(
        call_id=call_id,
        user_id=new_participant_id
    ).first()
    
    if existing:
        logger.info(f"[CALL_MGMT] User {new_participant_id} already in call {call_id}")
        return jsonify({'error': 'Participant already in call'}), 409
    
    # Check participant limit
    current_count = CallParticipant.query.filter_by(call_id=call_id).count()
    if current_count >= call.max_participants:
        logger.warning(f"[CALL_MGMT] Call {call_id} is at maximum capacity ({call.max_participants})")
        return jsonify({'error': f'Call has reached maximum participants ({call.max_participants})'}), 409
    
    # Create new call participant
    participant = CallParticipant(
        id=str(uuid.uuid4()),
        call_id=call_id,
        user_id=new_participant_id,
        role=role,
        status='invited'
    )
    
    db.session.add(participant)
    
    # Add to SFU room
    if call.room_id and call.room_id in sfu_server.rooms:
        sfu_server.invite_participant(call.room_id, int(new_participant_id))
    
    try:
        db.session.commit()
        logger.info(f"[CALL_MGMT] Added participant {new_participant_id} to call {call_id} (converted to group)")
        
        # Broadcast to all participants
        _broadcast_to_call(call_id, 'call_converted_to_group', {
            'call_id': call_id,
            'call_mode': 'group',
            'room_id': call.room_id,
            'new_participant': participant.to_dict(),
            'added_by': user_id
        })
        
        # Send direct notification to invited user
        if _socketio:
            _socketio.emit('call_invitation', {
                'call_id': call_id,
                'call_type': call.call_type,
                'call_mode': 'group',
                'host_id': call.caller_id,
                'host_name': call.caller.full_name if call.caller else None,
                'role': role,
                'room_id': call.room_id
            }, room=f"user_{new_participant_id}")
        
        return jsonify({
            'message': 'Participant added successfully - call converted to group',
            'call': call.to_dict(),
            'participant': participant.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error adding participant: {str(e)}")
        return jsonify({'error': 'Failed to add participant'}), 500
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"[CALL_MGMT] Error updating media state: {str(e)}")
        return jsonify({'error': 'Failed to update media state'}), 500
