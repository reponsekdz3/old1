from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from datetime import datetime

verification_bp = Blueprint('verification', __name__, url_prefix='/api/verification')


@verification_bp.route('/status', methods=['GET'])
@jwt_required()
def my_verification_status():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'is_verified': user.is_account_verified,
        'tier': user.account_verification_tier,
        'verified_at': user.account_verified_at.isoformat() if user.account_verified_at else None,
        'payment_id': user.account_verification_payment_id,
    }), 200


@verification_bp.route('/users/<user_id>/status', methods=['GET'])
@jwt_required()
def user_verification_status(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404
    return jsonify({
        'user_id': user_id,
        'is_verified': user.is_account_verified,
        'tier': user.account_verification_tier,
        'verified_at': user.account_verified_at.isoformat() if user.account_verified_at else None,
    }), 200


@verification_bp.route('/admin/verify/<target_user_id>', methods=['POST'])
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

    user.is_account_verified = True
    user.account_verification_tier = tier
    user.account_verified_at = datetime.utcnow()
    user.account_verification_payment_id = data.get('payment_id', 'admin-granted')
    db.session.commit()

    return jsonify({
        'message': f'User {user.full_name} verified as {tier}',
        'user': user.to_dict(),
    }), 200


@verification_bp.route('/admin/unverify/<target_user_id>', methods=['POST'])
@jwt_required()
def admin_unverify_user(target_user_id):
    requester_id = get_jwt_identity()
    requester = User.query.get(requester_id)
    if not requester or not requester.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    user = User.query.get(target_user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    user.is_account_verified = False
    user.account_verification_tier = None
    user.account_verified_at = None
    user.account_verification_payment_id = None
    db.session.commit()

    return jsonify({'message': f'Verification removed from {user.full_name}'}), 200
