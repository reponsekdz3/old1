"""
WebRTC E2EE Routes - End-to-end encrypted audio/video calls with Signal Protocol.
Provides secure establishment and management of real-time communication sessions.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, timedelta
import logging
import json
import base64
import secrets

from app.models.models import db, User
from app.security.webrtc_e2ee import WebRTCE2EE, GroupCallE2EE, MediaStreamEncryption
from app.security.signal_protocol import SignalProtocol
from app.models.e2ee_models import SecurityAuditLog, log_security_event

logger = logging.getLogger(__name__)
webrtc_e2ee_bp = Blueprint('webrtc_e2ee', __name__, url_prefix='/api/v2/webrtc')

# Initialize services
webrtc_e2ee = WebRTCE2EE()
group_call_e2ee = GroupCallE2EE()


@webrtc_e2ee_bp.route('/call/initiate', methods=['POST'])
@jwt_required()
def initiate_encrypted_call():
    """
    Initiate encrypted WebRTC call with another user.
    Performs DTLS-SRTP handshake and Signal Protocol key agreement.
    
    Request:
    {
        "callee_id": "user_id_of_recipient",
        "ice_ufrag": "random_ice_username_fragment",
        "ice_pwd": "random_ice_password",
        "dtls_fingerprint": "sha-256 AA:BB:CC:DD..."
    }
    
    Response:
    {
        "call_id": "unique_call_identifier",
        "key_material": {...},
        "dtls_context": {...},
        "expires_in": 3600
    }
    """
    try:
        caller_id = get_jwt_identity()
        data = request.json or {}
        
        callee_id = data.get('callee_id')
        ice_ufrag = data.get('ice_ufrag', '').strip()
        ice_pwd = data.get('ice_pwd', '').strip()
        dtls_fingerprint = data.get('dtls_fingerprint', '').strip()
        
        # Validate inputs
        if not callee_id or caller_id == callee_id:
            return jsonify({'error': 'Invalid callee_id'}), 400
        if not ice_ufrag or len(ice_ufrag) < 4:
            return jsonify({'error': 'Invalid ice_ufrag'}), 400
        if not ice_pwd or len(ice_pwd) < 24:
            return jsonify({'error': 'Invalid ice_pwd'}), 400
        if not dtls_fingerprint or 'sha-256' not in dtls_fingerprint.lower():
            return jsonify({'error': 'Invalid dtls_fingerprint'}), 400
        
        # Verify callee exists
        callee = User.query.get(callee_id)
        if not callee:
            return jsonify({'error': 'Callee not found'}), 404
        
        # Establish call session
        session = WebRTCE2EE.establish_webrtc_call_session(
            caller_id=caller_id,
            callee_id=callee_id,
            ice_ufrag=ice_ufrag,
            ice_pwd=ice_pwd,
            dtls_fingerprint=dtls_fingerprint
        )
        
        # Store session for later retrieval
        webrtc_e2ee.active_sessions[session['call_id']] = session
        
        # Log security event
        log_security_event(
            event_type='CALL_INITIATED',
            user_id=caller_id,
            severity='INFO',
            description=f'Encrypted call initiated with user {callee_id}'
        )
        
        return jsonify({
            'call_id': session['call_id'],
            'key_material': session['key_material'],
            'dtls_context': {
                'fingerprint': session['dtls_context']['fingerprint'],
                'cipher_suite': session['dtls_context']['cipher_suite']
            },
            'media_encryption': session['media_encryption'],
            'expires_in': 3600,
            'created_at': session['created_at']
        }), 201
    
    except Exception as e:
        logger.error(f"Error initiating call: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/call/<call_id>/accept', methods=['POST'])
@jwt_required()
def accept_encrypted_call(call_id):
    """
    Accept encrypted WebRTC call.
    Callee sends their encryption parameters to complete DTLS-SRTP setup.
    
    Request:
    {
        "ice_ufrag": "callee_ice_username_fragment",
        "ice_pwd": "callee_ice_password",
        "dtls_fingerprint": "sha-256 AA:BB:CC:DD..."
    }
    
    Response:
    {
        "call_id": "call_id",
        "status": "active",
        "key_material": {...}
    }
    """
    try:
        callee_id = get_jwt_identity()
        data = request.json or {}
        
        session = webrtc_e2ee.active_sessions.get(call_id)
        if not session:
            return jsonify({'error': 'Call session not found'}), 404
        
        if session['callee_id'] != callee_id:
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Update session with callee's parameters
        session['status'] = 'active'
        session['callee_ice_ufrag'] = data.get('ice_ufrag')
        session['callee_ice_pwd'] = data.get('ice_pwd')
        session['callee_dtls_fingerprint'] = data.get('dtls_fingerprint')
        session['accepted_at'] = datetime.utcnow().isoformat()
        
        # Log security event
        log_security_event(
            event_type='CALL_ACCEPTED',
            user_id=callee_id,
            severity='INFO',
            description=f'Encrypted call accepted from user {session["caller_id"]}'
        )
        
        return jsonify({
            'call_id': call_id,
            'status': session['status'],
            'key_material': session['key_material'],
            'dtls_verified_at': session['dtls_context']['verified_at']
        }), 200
    
    except Exception as e:
        logger.error(f"Error accepting call: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/call/<call_id>/verify-dtls', methods=['POST'])
@jwt_required()
def verify_dtls_handshake(call_id):
    """
    Verify DTLS handshake completion.
    Called after DTLS connection is established to confirm encryption.
    
    Request:
    {
        "verified": true,
        "cipher_suite": "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256"
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        session = webrtc_e2ee.active_sessions.get(call_id)
        if not session:
            return jsonify({'error': 'Call session not found'}), 404
        
        if not (session['caller_id'] == user_id or session['callee_id'] == user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        
        if data.get('verified'):
            session['dtls_context']['verified_at'] = datetime.utcnow().isoformat()
            session['dtls_context']['cipher_suite'] = data.get('cipher_suite')
            
            log_security_event(
                event_type='DTLS_VERIFIED',
                user_id=user_id,
                severity='INFO',
                description=f'DTLS handshake verified for call {call_id}'
            )
        
        return jsonify({'status': 'verified'}), 200
    
    except Exception as e:
        logger.error(f"Error verifying DTLS: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/call/<call_id>/encrypt-packet', methods=['POST'])
@jwt_required()
def encrypt_media_packet(call_id):
    """
    Encrypt media packet (audio/video) for transmission.
    Uses key material from established call session.
    
    Request:
    {
        "packet": "base64_encoded_media_packet",
        "algorithm": "aes-256-gcm",
        "aad": "base64_encoded_additional_auth_data"
    }
    
    Response:
    {
        "ciphertext": "base64_encoded_ciphertext",
        "nonce": "base64_encoded_nonce",
        "tag": "base64_encoded_authentication_tag"
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        session = webrtc_e2ee.active_sessions.get(call_id)
        if not session:
            return jsonify({'error': 'Call session not found'}), 404
        
        if not (session['caller_id'] == user_id or session['callee_id'] == user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get packet data
        packet_b64 = data.get('packet')
        algorithm_str = data.get('algorithm', 'aes-256-gcm')
        aad_b64 = data.get('aad')
        
        if not packet_b64:
            return jsonify({'error': 'packet is required'}), 400
        
        try:
            packet = base64.b64decode(packet_b64)
            aad = base64.b64decode(aad_b64) if aad_b64 else None
        except Exception:
            return jsonify({'error': 'Invalid base64 encoding'}), 400
        
        # Parse algorithm
        algorithm = MediaStreamEncryption.AES_GCM_256
        if algorithm_str == 'aes-128-gcm':
            algorithm = MediaStreamEncryption.AES_GCM_128
        elif algorithm_str == 'chacha20-poly1305':
            algorithm = MediaStreamEncryption.CHACHA20_POLY1305
        
        # Get encryption key from session
        key_b64 = session['key_material']['client_key']
        key = base64.b64decode(key_b64)
        
        # Encrypt packet
        ciphertext, nonce, tag = WebRTCE2EE.encrypt_media_packet(
            packet=packet,
            key=key,
            algorithm=algorithm,
            aad=aad
        )
        
        # Update statistics
        session['encrypted_packet_count'] += 1
        session['bandwidth_used'] += len(ciphertext)
        
        return jsonify({
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'nonce': base64.b64encode(nonce).decode(),
            'tag': base64.b64encode(tag).decode(),
            'packet_number': session['encrypted_packet_count']
        }), 200
    
    except Exception as e:
        logger.error(f"Error encrypting packet: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/call/<call_id>/decrypt-packet', methods=['POST'])
@jwt_required()
def decrypt_media_packet(call_id):
    """
    Decrypt received media packet.
    Verifies authentication tag and returns plaintext.
    
    Request:
    {
        "ciphertext": "base64_encoded_ciphertext",
        "nonce": "base64_encoded_nonce",
        "tag": "base64_encoded_authentication_tag",
        "algorithm": "aes-256-gcm",
        "aad": "base64_encoded_additional_auth_data"
    }
    
    Response:
    {
        "packet": "base64_encoded_plaintext_packet",
        "verified": true
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        session = webrtc_e2ee.active_sessions.get(call_id)
        if not session:
            return jsonify({'error': 'Call session not found'}), 404
        
        if not (session['caller_id'] == user_id or session['callee_id'] == user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Decode input
        try:
            ciphertext = base64.b64decode(data.get('ciphertext', ''))
            nonce = base64.b64decode(data.get('nonce', ''))
            tag = base64.b64decode(data.get('tag', ''))
            aad_b64 = data.get('aad')
            aad = base64.b64decode(aad_b64) if aad_b64 else None
        except Exception:
            return jsonify({'error': 'Invalid base64 encoding'}), 400
        
        # Parse algorithm
        algorithm_str = data.get('algorithm', 'aes-256-gcm')
        algorithm = MediaStreamEncryption.AES_GCM_256
        if algorithm_str == 'aes-128-gcm':
            algorithm = MediaStreamEncryption.AES_GCM_128
        elif algorithm_str == 'chacha20-poly1305':
            algorithm = MediaStreamEncryption.CHACHA20_POLY1305
        
        # Get decryption key from session
        key_b64 = session['key_material']['server_key']
        key = base64.b64decode(key_b64)
        
        # Decrypt and verify
        plaintext = WebRTCE2EE.decrypt_media_packet(
            ciphertext=ciphertext,
            key=key,
            nonce=nonce,
            tag=tag,
            algorithm=algorithm,
            aad=aad
        )
        
        return jsonify({
            'packet': base64.b64encode(plaintext).decode(),
            'verified': True,
            'algorithm': algorithm_str
        }), 200
    
    except Exception as e:
        logger.error(f"Error decrypting packet: {str(e)}")
        # Authentication failure - don't return details
        return jsonify({'error': 'Decryption failed or invalid tag'}), 401


@webrtc_e2ee_bp.route('/call/<call_id>/end', methods=['POST'])
@jwt_required()
def end_encrypted_call(call_id):
    """
    End encrypted WebRTC call and cleanup session.
    
    Response:
    {
        "call_id": "call_id",
        "status": "ended",
        "duration_seconds": 3600,
        "encrypted_packets": 50000,
        "bandwidth_used_mb": 250.5
    }
    """
    try:
        user_id = get_jwt_identity()
        session = webrtc_e2ee.active_sessions.get(call_id)
        
        if not session:
            return jsonify({'error': 'Call session not found'}), 404
        
        if not (session['caller_id'] == user_id or session['callee_id'] == user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        
        # Get statistics before cleanup
        stats = WebRTCE2EE.get_call_statistics(session)
        
        session['status'] = 'ended'
        session['ended_at'] = datetime.utcnow().isoformat()
        
        log_security_event(
            event_type='CALL_ENDED',
            user_id=user_id,
            severity='INFO',
            description=f'Encrypted call {call_id} ended after {stats["duration_seconds"]:.0f}s'
        )
        
        return jsonify({
            'call_id': call_id,
            'status': session['status'],
            **stats
        }), 200
    
    except Exception as e:
        logger.error(f"Error ending call: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/group-call/create', methods=['POST'])
@jwt_required()
def create_group_call():
    """
    Create encrypted group call (3+ participants).
    
    Request:
    {
        "group_id": "group_identifier",
        "participant_ids": ["user_1", "user_2", "user_3"],
        "max_participants": 100
    }
    
    Response:
    {
        "group_call_id": "unique_group_call_id",
        "participants": [...],
        "encryption_status": "active"
    }
    """
    try:
        initiator_id = get_jwt_identity()
        data = request.json or {}
        
        group_id = data.get('group_id')
        participant_ids = data.get('participant_ids', [])
        max_participants = data.get('max_participants', 100)
        
        if not group_id or not participant_ids:
            return jsonify({'error': 'group_id and participant_ids required'}), 400
        
        if len(participant_ids) < 2:
            return jsonify({'error': 'At least 2 participants required'}), 400
        
        if max_participants > 1000:
            return jsonify({'error': 'max_participants cannot exceed 1000'}), 400
        
        # Create group call session
        session = group_call_e2ee.create_group_call_session(
            group_id=group_id,
            initiator_id=initiator_id,
            participant_ids=participant_ids,
            max_participants=max_participants
        )
        
        log_security_event(
            event_type='GROUP_CALL_CREATED',
            user_id=initiator_id,
            severity='INFO',
            description=f'Group call created with {len(participant_ids)} participants'
        )
        
        return jsonify({
            'group_call_id': session['group_call_id'],
            'participants': session['participants'],
            'encryption_status': 'active',
            'created_at': session['created_at']
        }), 201
    
    except Exception as e:
        logger.error(f"Error creating group call: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/group-call/<group_call_id>/add-participant', methods=['POST'])
@jwt_required()
def add_group_call_participant(group_call_id):
    """
    Add participant to active group call.
    New participant receives unique encryption key.
    
    Request:
    {
        "participant_id": "new_user_id"
    }
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        new_participant_id = data.get('participant_id')
        if not new_participant_id:
            return jsonify({'error': 'participant_id required'}), 400
        
        session = group_call_e2ee.add_participant_to_group_call(
            group_call_id=group_call_id,
            new_participant_id=new_participant_id
        )
        
        if session is None:
            return jsonify({'error': 'Cannot add participant (call full or not found)'}), 400
        
        log_security_event(
            event_type='GROUP_CALL_PARTICIPANT_ADDED',
            user_id=user_id,
            severity='INFO',
            description=f'Participant {new_participant_id} added to group call'
        )
        
        return jsonify({
            'group_call_id': group_call_id,
            'participants': session['participants'],
            'participant_keys_generated': True
        }), 200
    
    except Exception as e:
        logger.error(f"Error adding participant: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/group-call/<group_call_id>/rotate-keys', methods=['POST'])
@jwt_required()
def rotate_group_call_keys(group_call_id):
    """
    Rotate encryption keys for group call.
    Ensures perfect forward secrecy for long-lived calls.
    """
    try:
        user_id = get_jwt_identity()
        
        result = group_call_e2ee.rotate_group_call_keys(group_call_id)
        
        if not result:
            return jsonify({'error': 'Group call not found'}), 404
        
        session = group_call_e2ee.group_sessions[group_call_id]
        
        log_security_event(
            event_type='GROUP_CALL_KEYS_ROTATED',
            user_id=user_id,
            severity='INFO',
            description=f'Keys rotated for group call {group_call_id}'
        )
        
        return jsonify({
            'group_call_id': group_call_id,
            'keys_rotated': True,
            'last_rotation': session['last_key_rotation']
        }), 200
    
    except Exception as e:
        logger.error(f"Error rotating keys: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500


@webrtc_e2ee_bp.route('/call/<call_id>/stats', methods=['GET'])
@jwt_required()
def get_call_stats(call_id):
    """
    Get call statistics and encryption metrics.
    """
    try:
        user_id = get_jwt_identity()
        session = webrtc_e2ee.active_sessions.get(call_id)
        
        if not session:
            return jsonify({'error': 'Call session not found'}), 404
        
        if not (session['caller_id'] == user_id or session['callee_id'] == user_id):
            return jsonify({'error': 'Unauthorized'}), 403
        
        stats = WebRTCE2EE.get_call_statistics(session)
        
        return jsonify(stats), 200
    
    except Exception as e:
        logger.error(f"Error getting call stats: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500
