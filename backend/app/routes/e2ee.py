"""
E2EE Routes - Signal Protocol key management and encrypted messaging.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import random

from app.models.models import db, User
from app.models.e2ee_models import E2EEKeyBundle, E2EEOneTimePreKey, log_security_event
from app.security.signal_protocol import SignalProtocol

e2ee_bp = Blueprint('e2ee', __name__, url_prefix='/api/e2ee')


@e2ee_bp.route('/keys/upload', methods=['POST'])
@jwt_required()
def upload_keys():
    """Upload user's key bundle (identity + signed prekey + one-time prekeys)."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate input
    required = ['identity_key', 'signed_prekey', 'signed_prekey_signature']
    if not all(k in data for k in required):
        return jsonify({'error': 'Missing required key fields'}), 400
    
    # Verify signature
    if not SignalProtocol.verify_prekey_signature(
        data['signed_prekey']['public_key'],
        data['signed_prekey_signature'],
        data['identity_key']
    ):
        return jsonify({'error': 'Invalid prekey signature'}), 400
    
    try:
        # Check if bundle exists
        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        
        if bundle:
            # Update existing
            bundle.identity_key_pub = data['identity_key']
            bundle.signed_prekey_id = data['signed_prekey']['id']
            bundle.signed_prekey_pub = data['signed_prekey']['public_key']
            bundle.signed_prekey_sig = data['signed_prekey_signature']
            bundle.registration_id = data.get('registration_id', random.randint(1, 16383))
        else:
            # Create new bundle
            bundle = E2EEKeyBundle(
                user_id=user_id,
                identity_key_pub=data['identity_key'],
                signed_prekey_id=data['signed_prekey']['id'],
                signed_prekey_pub=data['signed_prekey']['public_key'],
                signed_prekey_sig=data['signed_prekey_signature'],
                registration_id=data.get('registration_id', random.randint(1, 16383))
            )
            db.session.add(bundle)
        
        # Upload one-time prekeys
        if 'one_time_prekeys' in data:
            # Delete old unused keys
            E2EEOneTimePreKey.query.filter_by(user_id=user_id, is_used=False).delete()
            
            # Add new keys
            for opk in data['one_time_prekeys']:
                one_time_key = E2EEOneTimePreKey(
                    user_id=user_id,
                    key_id=opk['id'],
                    public_key=opk['public_key']
                )
                db.session.add(one_time_key)
        
        db.session.commit()
        
        log_security_event(user_id, 'e2ee_keys_uploaded', 'info')
        
        return jsonify({
            'message': 'Keys uploaded successfully',
            'one_time_keys_count': len(data.get('one_time_prekeys', []))
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@e2ee_bp.route('/keys/<user_id>', methods=['GET'])
@jwt_required()
def get_keys(user_id):
    """Get another user's public key bundle."""
    requester_id = get_jwt_identity()
    
    # Check if target user exists
    target_user = User.query.get(user_id)
    if not target_user:
        return jsonify({'error': 'User not found'}), 404
    
    # Get key bundle
    bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
    if not bundle:
        return jsonify({'error': 'User has not uploaded keys'}), 404
    
    # Get bundle with one-time prekey consumption
    bundle_data = bundle.to_public_bundle(pop_opk=True)
    
    log_security_event(requester_id, 'e2ee_keys_fetched', 'info', {
        'target_user': user_id,
        'opk_consumed': bundle_data.get('one_time_prekey') is not None
    })
    
    return jsonify(bundle_data), 200


@e2ee_bp.route('/keys/count', methods=['GET'])
@jwt_required()
def get_key_count():
    """Get count of user's remaining one-time prekeys."""
    user_id = get_jwt_identity()
    
    count = E2EEOneTimePreKey.query.filter_by(
        user_id=user_id,
        is_used=False
    ).count()
    
    return jsonify({'count': count}), 200


@e2ee_bp.route('/keys/replenish', methods=['POST'])
@jwt_required()
def replenish_keys():
    """Replenish one-time prekeys (when count is low)."""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if 'one_time_prekeys' not in data:
        return jsonify({'error': 'No one-time prekeys provided'}), 400
    
    try:
        # Add new keys
        for opk in data['one_time_prekeys']:
            one_time_key = E2EEOneTimePreKey(
                user_id=user_id,
                key_id=opk['id'],
                public_key=opk['public_key']
            )
            db.session.add(one_time_key)
        
        db.session.commit()
        
        log_security_event(user_id, 'e2ee_keys_replenished', 'info', {
            'count': len(data['one_time_prekeys'])
        })
        
        return jsonify({
            'message': 'Keys replenished',
            'added': len(data['one_time_prekeys'])
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
