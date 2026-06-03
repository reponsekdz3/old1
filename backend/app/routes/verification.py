from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from datetime import datetime

verification_bp = Blueprint('verification', __name__)


@verification_bp.route('/api/users/me/verification-status', methods=['GET'])
@jwt_required()
def my_verification_status():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'badge_verified': user.badge_verified,
        'verification_tier': user.verification_tier,
        'verified_at': user.verified_at.isoformat() if user.verified_at else None,
        'verification_payment_id': user.verification_payment_id,
    }), 200


@verification_bp.route('/api/users/<user_id>/verification-status', methods=['GET'])
@jwt_required()
def user_verification_status(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'user_id': user_id,
        'badge_verified': user.badge_verified,
        'verification_tier': user.verification_tier,
        'verified_at': user.verified_at.isoformat() if user.verified_at else None,
    }), 200


@verification_bp.route('/api/admin/users/<target_user_id>/verify', methods=['POST'])
@jwt_required()
def admin_verify_user(target_user_id):
    requester_id = get_jwt_identity()
    requester = User.query.get(requester_id)
    if not requester or not requester.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(target_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.json or {}
    tier = data.get('tier', 'personal')
    if tier not in ('personal', 'business'):
        return jsonify({'error': 'Invalid tier. Use personal or business'}), 400

    user.badge_verified = True
    user.verification_tier = tier
    user.verified_at = datetime.utcnow()
    user.verification_payment_id = data.get('payment_id', 'admin-granted')
    db.session.commit()

    return jsonify({
        'message': f'User {user.full_name} verified as {tier}',
        'user': user.to_dict(),
    }), 200


@verification_bp.route('/api/admin/users/<target_user_id>/unverify', methods=['POST'])
@jwt_required()
def admin_unverify_user(target_user_id):
    requester_id = get_jwt_identity()
    requester = User.query.get(requester_id)
    if not requester or not requester.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(target_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.badge_verified = False
    user.verification_tier = None
    user.verified_at = None
    user.verification_payment_id = None
    db.session.commit()

    return jsonify({'message': f'Verification removed from {user.full_name}'}), 200
