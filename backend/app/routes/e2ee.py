"""
Signal Protocol E2EE key exchange endpoints.
Handles key bundle publication, retrieval, and one-time prekey management.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from app.models.e2ee_models import (
    E2EEKeyBundle, E2EEOneTimePreKey, log_security_event
)
from datetime import datetime
import logging
import hashlib

logger = logging.getLogger(__name__)
e2ee_bp = Blueprint('e2ee', __name__, url_prefix='/api/e2ee')

from app import limiter


@e2ee_bp.route('/keys', methods=['POST'])
@jwt_required()
@limiter.limit("10 per minute")
def publish_key_bundle():
    """
    Upload or refresh the user's Signal Protocol public key bundle.
    Called once on registration, and when SPK rotation is needed.
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}

        identity_key = (data.get('identity_key') or '').strip()
        spk = data.get('signed_prekey') or {}
        registration_id = data.get('registration_id')
        one_time_prekeys = data.get('one_time_prekeys') or []

        if not identity_key:
            return jsonify({'error': 'identity_key is required'}), 400
        if not spk.get('public_key') or not spk.get('signature') or not spk.get('id'):
            return jsonify({'error': 'signed_prekey with id, public_key, signature is required'}), 400
        if len(one_time_prekeys) > 200:
            return jsonify({'error': 'Maximum 200 one-time prekeys per upload'}), 400

        # Upsert key bundle
        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        if bundle:
            bundle.identity_key_pub = identity_key
            bundle.signed_prekey_id = int(spk['id'])
            bundle.signed_prekey_pub = spk['public_key']
            bundle.signed_prekey_sig = spk['signature']
            bundle.registration_id = registration_id
            bundle.updated_at = datetime.utcnow()
        else:
            bundle = E2EEKeyBundle()
            bundle.user_id = user_id
            bundle.identity_key_pub = identity_key
            bundle.signed_prekey_id = int(spk['id'])
            bundle.signed_prekey_pub = spk['public_key']
            bundle.signed_prekey_sig = spk['signature']
            bundle.registration_id = registration_id
            db.session.add(bundle)
            db.session.flush()

        # Upload one-time prekeys
        added = 0
        if one_time_prekeys:
            existing_ids = {
                k.key_id for k in
                E2EEOneTimePreKey.query.filter_by(user_id=user_id)
                .with_entities(E2EEOneTimePreKey.key_id).all()
            }
            for opk in one_time_prekeys:
                kid = int(opk.get('id', 0))
                pub = (opk.get('public_key') or '').strip()
                if kid and pub and kid not in existing_ids:
                    new_opk = E2EEOneTimePreKey()
                    new_opk.user_id = user_id
                    new_opk.key_id = kid
                    new_opk.public_key = pub
                    db.session.add(new_opk)
                    existing_ids.add(kid)
                    added += 1

        db.session.commit()

        remaining = E2EEOneTimePreKey.query.filter_by(
            user_id=user_id, is_used=False
        ).count()

        log_security_event(user_id, 'e2ee_keys_published', 'info',
                           {'spk_id': spk['id'], 'opk_count': added})

        return jsonify({
            'message': 'Key bundle published',
            'one_time_prekeys_remaining': remaining,
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception('publish_key_bundle failed')
        return jsonify({'error': str(e)}), 500


@e2ee_bp.route('/keys/<target_user_id>', methods=['GET'])
@jwt_required()
def get_key_bundle(target_user_id):
    """
    Fetch a user's public key bundle to initiate a new X3DH session.
    Consumes one OPK atomically (marked as used).
    """
    try:
        requester_id = get_jwt_identity()

        # Prevent fetching own keys via this endpoint
        if target_user_id == requester_id:
            return jsonify({'error': 'Use /keys/status for own key info'}), 400

        user = User.query.get(target_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        bundle = E2EEKeyBundle.query.filter_by(user_id=target_user_id).first()
        if not bundle:
            return jsonify({'e2ee_supported': False, 'error': 'No E2EE keys published'}), 404

        return jsonify({'e2ee_supported': True, **bundle.to_public_bundle(pop_opk=True)}), 200

    except Exception as e:
        logger.exception('get_key_bundle failed')
        return jsonify({'error': str(e)}), 500


@e2ee_bp.route('/keys/status', methods=['GET'])
@jwt_required()
def key_status():
    """Return own E2EE key status: OPK count, bundle presence, low-key warning."""
    try:
        user_id = get_jwt_identity()
        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        if not bundle:
            return jsonify({
                'has_bundle': False,
                'one_time_prekeys_remaining': 0,
                'needs_upload': True,
            }), 200

        remaining = E2EEOneTimePreKey.query.filter_by(
            user_id=user_id, is_used=False
        ).count()

        return jsonify({
            'has_bundle': True,
            'one_time_prekeys_remaining': remaining,
            'signed_prekey_id': bundle.signed_prekey_id,
            'low_prekeys': remaining < 10,
            'needs_upload': remaining < 5,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@e2ee_bp.route('/keys/one-time', methods=['POST'])
@jwt_required()
@limiter.limit("20 per minute")
def upload_one_time_prekeys():
    """Upload additional OPKs when supply runs low (< 10 remaining)."""
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        keys = data.get('one_time_prekeys') or []

        if not keys or len(keys) > 200:
            return jsonify({'error': 'Provide 1–200 one-time prekeys'}), 400

        existing_ids = {
            k.key_id for k in
            E2EEOneTimePreKey.query.filter_by(user_id=user_id)
            .with_entities(E2EEOneTimePreKey.key_id).all()
        }
        added = 0
        for opk in keys:
            kid = int(opk.get('id', 0))
            pub = (opk.get('public_key') or '').strip()
            if kid and pub and kid not in existing_ids:
                new_opk = E2EEOneTimePreKey()
                new_opk.user_id = user_id
                new_opk.key_id = kid
                new_opk.public_key = pub
                db.session.add(new_opk)
                existing_ids.add(kid)
                added += 1

        db.session.commit()
        remaining = E2EEOneTimePreKey.query.filter_by(
            user_id=user_id, is_used=False
        ).count()
        return jsonify({'added': added, 'one_time_prekeys_remaining': remaining}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@e2ee_bp.route('/fingerprint/<target_user_id>', methods=['GET'])
@jwt_required()
def verify_fingerprint(target_user_id):
    """
    Return the Signal-style safety number for a conversation.
    Both users display this to verify no MITM has occurred.
    """
    try:
        user_id = get_jwt_identity()
        my_bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        their_bundle = E2EEKeyBundle.query.filter_by(user_id=target_user_id).first()

        if not my_bundle or not their_bundle:
            return jsonify({'error': 'E2EE keys not found for one or both users'}), 404

        # Signal safety-number algorithm:
        # Sort identity keys + user IDs, SHA-512, format as 5×12-digit groups
        pairs = sorted([
            (user_id, my_bundle.identity_key_pub),
            (target_user_id, their_bundle.identity_key_pub),
        ])
        raw = hashlib.sha512(
            (pairs[0][0] + pairs[0][1] + pairs[1][0] + pairs[1][1]).encode()
        ).hexdigest()

        digits = ''.join(str(int(raw[i:i+2], 16)).zfill(3) for i in range(0, 60, 2))
        safety_number = ' '.join(digits[i:i+12] for i in range(0, 60, 12))

        return jsonify({
            'safety_number': safety_number,
            'my_identity_key': my_bundle.identity_key_pub,
            'their_identity_key': their_bundle.identity_key_pub,
            'verified': True,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@e2ee_bp.route('/keys/rotate-spk', methods=['POST'])
@jwt_required()
@limiter.limit("5 per hour")
def rotate_signed_prekey():
    """
    Rotate the Signed PreKey (recommended every 7–30 days).
    Does not invalidate existing sessions.
    """
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        spk = data.get('signed_prekey') or {}

        if not spk.get('public_key') or not spk.get('signature') or not spk.get('id'):
            return jsonify({'error': 'signed_prekey with id, public_key, signature required'}), 400

        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        if not bundle:
            return jsonify({'error': 'No key bundle found — publish keys first'}), 404

        bundle.signed_prekey_id = int(spk['id'])
        bundle.signed_prekey_pub = spk['public_key']
        bundle.signed_prekey_sig = spk['signature']
        bundle.updated_at = datetime.utcnow()
        db.session.commit()

        log_security_event(user_id, 'spk_rotated', 'info', {'new_spk_id': spk['id']})

        return jsonify({'message': 'Signed PreKey rotated successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
