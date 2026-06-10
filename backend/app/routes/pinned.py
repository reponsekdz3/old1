"""
Unlimited Pinned Chats — no limit, fully ordered.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db
from app.models.gift_models import PinnedChat

pinned_bp = Blueprint('pinned', __name__, url_prefix='/api/pinned')


@pinned_bp.route('', methods=['GET'])
@jwt_required()
def list_pinned():
    user_id = get_jwt_identity()
    pins = PinnedChat.query.filter_by(user_id=user_id).order_by(PinnedChat.pin_order).all()
    return jsonify({'pinned': [p.to_dict() for p in pins]}), 200


@pinned_bp.route('', methods=['POST'])
@jwt_required()
def pin_chat():
    user_id = get_jwt_identity()
    data = request.json or {}
    chat_with_id = data.get('chat_with_id') or None
    group_id = data.get('group_id') or None
    if not chat_with_id and not group_id:
        return jsonify({'error': 'Provide chat_with_id or group_id'}), 400

    existing = PinnedChat.query.filter_by(
        user_id=user_id, chat_with_id=chat_with_id, group_id=group_id).first()
    if existing:
        return jsonify({'pinned': existing.to_dict(), 'already_pinned': True}), 200

    max_order = db.session.query(db.func.max(PinnedChat.pin_order)).filter_by(user_id=user_id).scalar() or 0
    pin = PinnedChat(user_id=user_id, chat_with_id=chat_with_id,
                      group_id=group_id, pin_order=max_order + 1)
    db.session.add(pin)
    db.session.commit()
    return jsonify({'pinned': pin.to_dict()}), 201


@pinned_bp.route('/<pin_id>', methods=['DELETE'])
@jwt_required()
def unpin_chat(pin_id):
    user_id = get_jwt_identity()
    pin = PinnedChat.query.filter_by(id=pin_id, user_id=user_id).first_or_404()
    db.session.delete(pin)
    db.session.commit()
    return jsonify({'unpinned': True}), 200


@pinned_bp.route('/by-chat', methods=['DELETE'])
@jwt_required()
def unpin_by_chat():
    user_id = get_jwt_identity()
    chat_with_id = request.args.get('chat_with_id') or None
    group_id = request.args.get('group_id') or None
    pin = PinnedChat.query.filter_by(user_id=user_id,
                                      chat_with_id=chat_with_id, group_id=group_id).first()
    if pin:
        db.session.delete(pin)
        db.session.commit()
    return jsonify({'unpinned': True}), 200


@pinned_bp.route('/reorder', methods=['PUT'])
@jwt_required()
def reorder_pins():
    user_id = get_jwt_identity()
    order_list = (request.json or {}).get('order', [])
    for item in order_list:
        pin = PinnedChat.query.filter_by(id=item['id'], user_id=user_id).first()
        if pin:
            pin.pin_order = item.get('pin_order', 0)
    db.session.commit()
    return jsonify({'reordered': True}), 200


@pinned_bp.route('/check', methods=['GET'])
@jwt_required()
def check_pinned():
    user_id = get_jwt_identity()
    chat_with_id = request.args.get('chat_with_id') or None
    group_id = request.args.get('group_id') or None
    pin = PinnedChat.query.filter_by(user_id=user_id,
                                      chat_with_id=chat_with_id, group_id=group_id).first()
    return jsonify({'is_pinned': bool(pin), 'pin_id': pin.id if pin else None}), 200
