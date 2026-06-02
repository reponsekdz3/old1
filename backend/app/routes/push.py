from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, PushSubscription
from app.utils.vapid_keys import get_vapid_keys
import logging

logger = logging.getLogger(__name__)
push_bp = Blueprint('push', __name__, url_prefix='/api/push')


@push_bp.route('/vapid-public-key', methods=['GET'])
def vapid_public_key():
    try:
        _, public_key = get_vapid_keys()
        return jsonify({'public_key': public_key}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@push_bp.route('/subscribe', methods=['POST'])
@jwt_required()
def subscribe():
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        endpoint = data.get('endpoint')
        p256dh = data.get('keys', {}).get('p256dh')
        auth = data.get('keys', {}).get('auth')

        if not endpoint or not p256dh or not auth:
            return jsonify({'error': 'Invalid subscription data'}), 400

        existing = PushSubscription.query.filter_by(user_id=str(user_id), endpoint=endpoint).first()
        if existing:
            existing.p256dh = p256dh
            existing.auth = auth
            existing.active = True
        else:
            sub = PushSubscription(user_id=str(user_id), endpoint=endpoint, p256dh=p256dh, auth=auth)
            db.session.add(sub)
        db.session.commit()
        return jsonify({'message': 'Subscribed to push notifications'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@push_bp.route('/unsubscribe', methods=['DELETE'])
@jwt_required()
def unsubscribe():
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        endpoint = data.get('endpoint')
        if endpoint:
            PushSubscription.query.filter_by(user_id=str(user_id), endpoint=endpoint).delete()
        else:
            PushSubscription.query.filter_by(user_id=str(user_id)).delete()
        db.session.commit()
        return jsonify({'message': 'Unsubscribed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@push_bp.route('/test', methods=['POST'])
@jwt_required()
def test_push():
    """Send a test push notification to yourself."""
    try:
        user_id = get_jwt_identity()
        from app.utils.push_sender import push_to_user
        push_to_user(user_id, 'Bitese 🔔', 'Push notifications are working!', url='/')
        return jsonify({'message': 'Test notification sent'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
