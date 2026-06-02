from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Status, Contact
from app.services.app_services import ContactService
from datetime import datetime, timedelta

contacts_bp = Blueprint('contacts', __name__, url_prefix='/api/contacts')

@contacts_bp.route('', methods=['GET'])
@jwt_required()
def get_all_contacts():
    try:
        user_id = get_jwt_identity()
        contacts = ContactService.get_contacts(user_id)
        return jsonify({'contacts': contacts}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('', methods=['POST'])
@jwt_required()
def add_contact():
    try:
        user_id = get_jwt_identity()
        data = request.json
        phone_number = data.get('phone_number', '').strip()
        contact_name = data.get('contact_name', '').strip()
        if not phone_number:
            return jsonify({'error': 'Phone number is required'}), 400
        result = ContactService.add_contact(user_id, phone_number, contact_name)
        if result['success']:
            return jsonify(result['contact']), 201
        else:
            return jsonify({'error': result['error']}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>', methods=['GET'])
@jwt_required()
def get_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        # contact_id can be a contact UUID OR a user UUID (activeChat is always user ID)
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            # Try by contact_user_id
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        return jsonify(contact.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>', methods=['PUT'])
@jwt_required()
def update_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        data = request.json
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        if 'contact_name' in data:
            contact.contact_name = data['contact_name']
        db.session.commit()
        return jsonify(contact.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>/block', methods=['PUT'])
@jwt_required()
def block_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        contact.is_blocked = True
        db.session.commit()
        return jsonify({'message': 'Contact blocked'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>/unblock', methods=['PUT'])
@jwt_required()
def unblock_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        contact.is_blocked = False
        db.session.commit()
        return jsonify({'message': 'Contact unblocked'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>', methods=['DELETE'])
@jwt_required()
def delete_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        db.session.delete(contact)
        db.session.commit()
        return jsonify({'message': 'Contact deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/search', methods=['GET'])
@jwt_required()
def search_contacts():
    try:
        user_id = get_jwt_identity()
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'contacts': []}), 200
        contacts = Contact.query.filter(
            Contact.user_id == user_id,
            db.or_(
                Contact.contact_name.ilike(f'%{query}%'),
                Contact.phone_number.ilike(f'%{query}%'),
            )
        ).limit(20).all()
        return jsonify({'contacts': [c.to_dict() for c in contacts]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/search-users', methods=['GET'])
@jwt_required()
def search_users():
    """Search all registered users by name/phone/email"""
    try:
        user_id = get_jwt_identity()
        query_str = request.args.get('q', '').strip()
        if not query_str or len(query_str) < 2:
            return jsonify({'users': []}), 200
        users = User.query.filter(
            User.id != user_id,
            db.or_(
                User.full_name.ilike(f'%{query_str}%'),
                User.phone_number.ilike(f'%{query_str}%'),
                User.email.ilike(f'%{query_str}%'),
            )
        ).limit(15).all()
        return jsonify({'users': [u.to_dict() for u in users]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Status routes ─────────────────────────────────────────────────────────────
status_bp = Blueprint('status', __name__, url_prefix='/api/status')

def _do_create_status():
    """Shared logic for POST /api/status and /api/status/create."""
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        content = data.get('content', '').strip()
        media_url = data.get('media_url')
        media_type = data.get('media_type', 'text')
        background_color = data.get('background_color', '#008069')
        if not content and not media_url:
            return jsonify({'error': 'Content or media required'}), 400
        expires_at = datetime.utcnow() + timedelta(hours=24)
        # Backwards-compat: strip old __bg:...__  prefix if present
        if content and content.startswith('__bg:'):
            parts = content.split('__', 3)
            if len(parts) >= 3:
                background_color = parts[1].replace('bg:', '')
                content = parts[2] if len(parts) > 2 else ''
        status = Status(
            user_id=user_id,
            content=content,
            media_url=media_url,
            media_type=media_type,
            background_color=background_color,
            expires_at=expires_at,
        )
        db.session.add(status)
        db.session.commit()
        return jsonify({'message': 'Status created', 'status': status.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@status_bp.route('', methods=['POST'])
@jwt_required()
def create_status():
    return _do_create_status()

@status_bp.route('/create', methods=['POST'])
@jwt_required()
def create_status_alias():
    """Alias kept for backwards compatibility."""
    return _do_create_status()

@status_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_statuses():
    """Get statuses from all contacts + self, grouped by user."""
    try:
        user_id = get_jwt_identity()
        now = datetime.utcnow()
        current_user = User.query.get(user_id)

        my_contacts = Contact.query.filter_by(user_id=user_id, is_blocked=False).all()
        contact_user_ids = [c.contact_user_id for c in my_contacts if c.contact_user_id]
        contact_user_ids.append(user_id)

        all_statuses = Status.query.filter(
            Status.user_id.in_(contact_user_ids),
            Status.expires_at > now,
        ).order_by(Status.created_at.desc()).all()

        grouped = {}
        for s in all_statuses:
            uid = s.user_id
            if uid not in grouped:
                grouped[uid] = {
                    'user_id': uid,
                    'owner_name': s.user.full_name,
                    'owner_avatar': s.user.avatar_url,
                    'viewed': False,
                    'latest_at': s.created_at.isoformat(),
                    'statuses': [],
                }
            # Backwards-compat: parse legacy __bg:...__  prefix
            content = s.content or ''
            bg_color = s.background_color or '#008069'
            mtype = s.media_type or 'text'
            if content.startswith('__bg:'):
                parts = content.split('__', 3)
                if len(parts) >= 3:
                    bg_color = parts[1].replace('bg:', '')
                    content = parts[2] if len(parts) > 2 else ''
            is_viewed = current_user in s.viewers
            if is_viewed:
                grouped[uid]['viewed'] = True
            grouped[uid]['statuses'].append({
                'id': s.id,
                'content': content,
                'background_color': bg_color,
                'media_url': s.media_url,
                'media_type': mtype,
                'created_at': s.created_at.isoformat(),
                'viewers_count': len(s.viewers),
                'viewed': is_viewed,
            })

        my_statuses_raw = grouped.pop(user_id, None)
        statuses_list = sorted(grouped.values(), key=lambda x: x['latest_at'], reverse=True)

        return jsonify({
            'statuses': statuses_list,
            'my_statuses': my_statuses_raw['statuses'] if my_statuses_raw else [],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@status_bp.route('/<user_id_or_status_id>', methods=['GET'])
@jwt_required()
def get_user_status(user_id_or_status_id):
    try:
        statuses = Status.query.filter_by(user_id=user_id_or_status_id).filter(
            Status.expires_at > datetime.utcnow()
        ).order_by(Status.created_at.desc()).all()
        return jsonify({'statuses': [s.to_dict() for s in statuses]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@status_bp.route('/<status_id>/view', methods=['POST'])
@jwt_required()
def view_status(status_id):
    try:
        viewer_id = get_jwt_identity()
        status = Status.query.get(status_id)
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        viewer = User.query.get(viewer_id)
        if viewer and viewer not in status.viewers:
            status.viewers.append(viewer)
            db.session.commit()
        return jsonify({'message': 'Viewed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@status_bp.route('/<status_id>', methods=['DELETE'])
@jwt_required()
def delete_status(status_id):
    try:
        user_id = get_jwt_identity()
        status = Status.query.filter_by(id=status_id, user_id=user_id).first()
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        db.session.delete(status)
        db.session.commit()
        return jsonify({'message': 'Status deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
