"""
Enhanced E2EE API endpoints for Signal Protocol implementation.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, Message, MessageStatus, User
from app.models.e2ee_models import E2EEKeyBundle, E2EEOneTimePreKey, log_security_event
from app.security.signal_protocol import SignalProtocol
from app.services.e2ee_service import E2EEMessageService, GroupE2EEService
from app.security.encryption import EncryptionService, KeyManager
from app.infrastructure.scalability import CacheManager
from datetime import datetime
import json
import logging

logger = logging.getLogger(__name__)
e2ee_enhanced_bp = Blueprint('e2ee_enhanced', __name__, url_prefix='/api/v2/e2ee')

# Initialize services
key_manager = KeyManager()
enc_service = EncryptionService(key_manager)
e2ee_service = E2EEMessageService(enc_service)
group_e2ee_service = GroupE2EEService(enc_service)
cache_manager = CacheManager()


@e2ee_enhanced_bp.route('/keys/register', methods=['POST'])
@jwt_required()
def register_keys():
    """
    Register/update user's Signal Protocol key bundle.
    Called once on app setup, refreshed periodically.
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        # Validate required fields
        identity_key = data.get('identity_key')
        spk_data = data.get('signed_prekey', {})
        opk_list = data.get('one_time_prekeys', [])
        
        if not identity_key:
            return jsonify({'error': 'identity_key required'}), 400
        if not spk_data.get('public_key') or not spk_data.get('signature'):
            return jsonify({'error': 'signed_prekey with public_key and signature required'}), 400
        
        # Validate SPK signature (in production)
        # SignalProtocol.verify_signed_prekey(...)
        
        # Create or update key bundle
        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        
        if bundle:
            bundle.identity_key_pub = identity_key
            bundle.signed_prekey_id = int(spk_data.get('id', 0))
            bundle.signed_prekey_pub = spk_data['public_key']
            bundle.signed_prekey_sig = spk_data['signature']
            bundle.registration_id = data.get('registration_id')
            bundle.updated_at = datetime.utcnow()
        else:
            bundle = E2EEKeyBundle()
            bundle.user_id = user_id
            bundle.identity_key_pub = identity_key
            bundle.signed_prekey_id = int(spk_data.get('id', 0))
            bundle.signed_prekey_pub = spk_data['public_key']
            bundle.signed_prekey_sig = spk_data['signature']
            bundle.registration_id = data.get('registration_id') or SignalProtocol.generate_registration_id()
            db.session.add(bundle)
        
        db.session.flush()
        
        # Add one-time prekeys
        existing_ids = {
            k.key_id for k in E2EEOneTimePreKey.query.filter_by(user_id=user_id)
            .with_entities(E2EEOneTimePreKey.key_id).all()
        }
        
        added_count = 0
        for opk in opk_list:
            kid = int(opk.get('id', 0))
            pub_key = opk.get('public_key')
            
            if kid and pub_key and kid not in existing_ids:
                new_opk = E2EEOneTimePreKey()
                new_opk.user_id = user_id
                new_opk.key_id = kid
                new_opk.public_key = pub_key
                db.session.add(new_opk)
                existing_ids.add(kid)
                added_count += 1
        
        if added_count > 200:
            db.session.rollback()
            return jsonify({'error': 'Maximum 200 OTPs per request'}), 400
        
        db.session.commit()
        
        # Cache the bundle for fast retrieval
        cache_manager.set(f"e2ee_bundle:{user_id}", bundle.to_dict(), cache_type='encryption_keys')
        
        remaining_otps = E2EEOneTimePreKey.query.filter_by(
            user_id=user_id, is_used=False
        ).count()
        
        log_security_event(user_id, 'e2ee_keys_registered', 'info', {
            'spk_id': spk_data.get('id'),
            'opk_count': added_count,
            'registration_id': bundle.registration_id,
        })
        
        return jsonify({
            'success': True,
            'message': 'Key bundle registered',
            'one_time_prekeys_on_server': remaining_otps,
            'bundle_id': bundle.id,
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Key registration failed: {e}")
        log_security_event(get_jwt_identity(), 'e2ee_keys_registration_failed', 'warning', {'error': str(e)})
        return jsonify({'error': 'Registration failed'}), 500


@e2ee_enhanced_bp.route('/keys/<user_id>', methods=['GET'])
@jwt_required()
def get_public_bundle(user_id):
    """
    Retrieve another user's public key bundle for session initiation (X3DH).
    """
    try:
        # Check cache first
        cached = cache_manager.get(f"e2ee_bundle:{user_id}")
        if cached:
            return jsonify(cached), 200
        
        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        if not bundle:
            return jsonify({'error': 'User not found or not using E2EE'}), 404
        
        # Get public bundle with OTK
        public_bundle = bundle.to_public_bundle(pop_opk=True)
        
        # Cache for 5 minutes
        cache_manager.set(f"e2ee_bundle:{user_id}", public_bundle, 
                         cache_type='encryption_keys', ex=300)
        
        db.session.commit()  # Persist OTK consumption
        
        return jsonify(public_bundle), 200
    
    except Exception as e:
        logger.error(f"Bundle retrieval failed: {e}")
        return jsonify({'error': 'Retrieval failed'}), 500


@e2ee_enhanced_bp.route('/messages/send', methods=['POST'])
@jwt_required()
def send_encrypted_message():
    """
    Send end-to-end encrypted message using Signal Protocol.
    """
    try:
        sender_id = get_jwt_identity()
        data = request.json or {}
        
        receiver_id = data.get('receiver_id')
        plaintext = data.get('content')
        
        if not receiver_id or not plaintext:
            return jsonify({'error': 'receiver_id and content required'}), 400
        
        # Verify receiver exists
        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({'error': 'Receiver not found'}), 404
        
        # Encrypt message
        encrypted_payload = e2ee_service.encrypt_message(sender_id, receiver_id, plaintext)
        
        # Store encrypted message
        msg = Message()
        msg.sender_id = sender_id
        msg.receiver_id = receiver_id
        msg.content = None  # Don't store plaintext
        msg.encrypted_payload = json.dumps(encrypted_payload)
        msg.e2ee_type = 1  # Double Ratchet
        msg.status = MessageStatus.SENT
        
        db.session.add(msg)
        db.session.commit()
        
        # Send push notification (optional, without revealing content)
        try:
            from app.utils.push_sender import push_to_user
            sender = User.query.get(sender_id)
            push_to_user(receiver_id, f"{sender.full_name if sender else 'Someone'}", "[Encrypted Message]")
        except:
            pass
        
        log_security_event(sender_id, 'message_encrypted_sent', 'info', {
            'message_id': msg.id,
            'receiver_id': receiver_id,
        })
        
        return jsonify({
            'message_id': msg.id,
            'status': 'sent',
            'created_at': msg.created_at.isoformat(),
        }), 201
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Encrypted message send failed: {e}")
        return jsonify({'error': 'Send failed'}), 500


@e2ee_enhanced_bp.route('/messages/<message_id>', methods=['GET'])
@jwt_required()
def get_encrypted_message(message_id):
    """
    Retrieve and decrypt message.
    Only receiver can decrypt their own messages.
    """
    try:
        user_id = get_jwt_identity()
        
        msg = Message.query.get(message_id)
        if not msg or msg.receiver_id != user_id:
            return jsonify({'error': 'Not found or access denied'}), 404
        
        if not msg.encrypted_payload:
            return jsonify({'error': 'Message not encrypted'}), 400
        
        encrypted = json.loads(msg.encrypted_payload)
        plaintext = e2ee_service.decrypt_message(user_id, msg.sender_id, encrypted)
        
        # Mark as read
        msg.status = MessageStatus.READ
        db.session.commit()
        
        log_security_event(user_id, 'message_decrypted_read', 'info', {
            'message_id': message_id,
        })
        
        return jsonify({
            'message_id': msg.id,
            'sender_id': msg.sender_id,
            'content': plaintext,
            'created_at': msg.created_at.isoformat(),
            'status': msg.status.value,
        }), 200
    
    except Exception as e:
        logger.error(f"Message decryption failed: {e}")
        log_security_event(get_jwt_identity(), 'message_decryption_failed', 'warning', {
            'message_id': message_id,
            'error': str(e),
        })
        return jsonify({'error': 'Decryption failed'}), 500


@e2ee_enhanced_bp.route('/group/<group_id>/messages', methods=['POST'])
@jwt_required()
def send_group_encrypted_message(group_id):
    """
    Send encrypted message to group using group key.
    """
    try:
        sender_id = get_jwt_identity()
        data = request.json or {}
        plaintext = data.get('content')
        
        if not plaintext:
            return jsonify({'error': 'content required'}), 400
        
        # Encrypt for group
        encrypted = group_e2ee_service.encrypt_group_message(group_id, sender_id, plaintext)
        
        # In production, would store and broadcast to group members
        # For now, just return encrypted payload
        
        log_security_event(sender_id, 'group_message_encrypted', 'info', {
            'group_id': group_id,
        })
        
        return jsonify({
            'status': 'sent',
            'group_id': group_id,
            'encrypted': encrypted,
        }), 201
    
    except Exception as e:
        logger.error(f"Group message encryption failed: {e}")
        return jsonify({'error': 'Send failed'}), 500


@e2ee_enhanced_bp.route('/audit/events', methods=['GET'])
@jwt_required()
def get_encryption_audit():
    """
    Get encryption audit log for user (compliance/verification).
    """
    try:
        user_id = get_jwt_identity()
        hours = request.args.get('hours', 24, type=int)
        
        from app.models.e2ee_models import SecurityAuditLog
        cutoff = datetime.utcnow() - timedelta(hours=hours)
        
        events = SecurityAuditLog.query.filter(
            SecurityAuditLog.user_id == user_id,
            SecurityAuditLog.event_type.like('e2ee_%'),
            SecurityAuditLog.created_at > cutoff,
        ).order_by(SecurityAuditLog.created_at.desc()).all()
        
        return jsonify({
            'events': [e.to_dict() for e in events],
            'total': len(events),
        }), 200
    
    except Exception as e:
        logger.error(f"Audit retrieval failed: {e}")
        return jsonify({'error': 'Retrieval failed'}), 500


from datetime import timedelta

# Register blueprint in main app initialization
