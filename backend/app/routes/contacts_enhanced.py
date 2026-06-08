"""
VipChat Contacts Enhanced — Auto-sync, discovery, import, and web contact management.
Real, functional, enterprise-grade contact management.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Contact
from datetime import datetime
import re
import logging

logger = logging.getLogger(__name__)
contacts_enhanced_bp = Blueprint('contacts_enhanced', __name__, url_prefix='/api/contacts')


def normalize_phone(phone: str) -> str:
    """Strip formatting, keep digits and leading +."""
    cleaned = re.sub(r'[\s\-().]', '', phone.strip())
    if not cleaned.startswith('+'):
        cleaned = '+' + cleaned.lstrip('+')
    return cleaned


def _auto_add_contact(user_id: str, contact_user: User) -> bool:
    """Add a contact relationship if it doesn't exist. Returns True if new."""
    existing = Contact.query.filter_by(user_id=user_id, contact_user_id=contact_user.id).first()
    if existing:
        return False
    c = Contact()
    c.user_id = user_id
    c.contact_user_id = contact_user.id
    c.contact_name = contact_user.full_name
    c.phone_number = contact_user.phone_number
    db.session.add(c)
    return True


@contacts_enhanced_bp.route('/discover', methods=['POST'])
@jwt_required()
def discover_contacts():
    """
    Upload phone numbers from device. Returns VipChat users found.
    Auto-adds them to the requester's contact list.
    POST { phone_numbers: ["+256788123456", ...] }
    """
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    phone_numbers = data.get('phone_numbers', [])

    if not isinstance(phone_numbers, list):
        return jsonify({'error': 'phone_numbers must be an array'}), 400
    if len(phone_numbers) > 5000:
        return jsonify({'error': 'Max 5000 numbers per sync'}), 400

    # Normalize
    normalized = {}
    for p in phone_numbers:
        if p and isinstance(p, str):
            n = normalize_phone(p)
            if len(n) >= 7:
                normalized[n] = p

    if not normalized:
        return jsonify({'registered': [], 'unregistered': [], 'new_contacts': 0}), 200

    # Find matching users (exclude self)
    found_users = User.query.filter(
        User.phone_number.in_(list(normalized.keys())),
        User.id != user_id,
    ).all()

    new_count = 0
    registered = []
    registered_phones = set()

    for found_user in found_users:
        norm = normalize_phone(found_user.phone_number)
        registered_phones.add(norm)

        # Auto-add contact
        if _auto_add_contact(user_id, found_user):
            new_count += 1

        registered.append({
            'id': found_user.id,
            'full_name': found_user.full_name,
            'phone_number': found_user.phone_number,
            'avatar_url': found_user.avatar_url,
            'badge_verified': getattr(found_user, 'badge_verified', False),
            'is_online': getattr(found_user, 'is_online', False),
        })

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    unregistered = [
        normalized[p] for p in normalized
        if p not in registered_phones
    ]

    return jsonify({
        'registered': registered,
        'unregistered': unregistered[:100],  # Return first 100
        'unregistered_count': len(unregistered),
        'new_contacts': new_count,
        'total_checked': len(normalized),
    }), 200


@contacts_enhanced_bp.route('/auto-sync-on-register', methods=['POST'])
@jwt_required()
def auto_sync_on_register():
    """
    Called right after registration to notify mutual contacts.
    Finds all existing users who have the new user's phone in their upload history,
    and creates mutual contact relationships.
    """
    user_id = get_jwt_identity()
    new_user = User.query.get(user_id)
    if not new_user:
        return jsonify({'error': 'User not found'}), 404

    # Find users who already have this phone as a contact
    existing_contacts_of_new_user = Contact.query.filter_by(
        phone_number=new_user.phone_number
    ).filter(Contact.user_id != user_id).all()

    count = 0
    for c in existing_contacts_of_new_user:
        # Update their contact to link to actual user
        if not c.contact_user_id:
            c.contact_user_id = user_id
            count += 1

        # Create reverse contact for new user
        if _auto_add_contact(user_id, User.query.get(c.user_id)):
            count += 1

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({'synced_contacts': count}), 200


@contacts_enhanced_bp.route('/search', methods=['GET'])
@jwt_required()
def search_contacts():
    """Search contacts by name or phone number."""
    user_id = get_jwt_identity()
    q = request.args.get('q', '').strip()
    if not q:
        return jsonify({'results': []}), 200

    # Search in contacts first
    contacts = Contact.query.filter(
        Contact.user_id == user_id,
        db.or_(
            Contact.contact_name.ilike(f'%{q}%'),
            Contact.phone_number.ilike(f'%{q}%'),
        )
    ).limit(20).all()

    results = []
    seen_user_ids = set()

    for c in contacts:
        if c.contact_user_id and c.contact_user_id not in seen_user_ids:
            user = User.query.get(c.contact_user_id)
            if user:
                seen_user_ids.add(user.id)
                results.append({
                    'id': user.id,
                    'full_name': user.full_name,
                    'phone_number': user.phone_number,
                    'avatar_url': user.avatar_url,
                    'badge_verified': getattr(user, 'badge_verified', False),
                    'contact_name': c.contact_name,
                    'is_contact': True,
                })

    # Also search all users by phone (exact match) if less than 5 results
    if len(results) < 5 and len(q) >= 7:
        norm = normalize_phone(q)
        global_user = User.query.filter(
            User.phone_number == norm,
            User.id != user_id,
            ~User.id.in_(seen_user_ids),
        ).first()
        if global_user:
            results.append({
                'id': global_user.id,
                'full_name': global_user.full_name,
                'phone_number': global_user.phone_number,
                'avatar_url': global_user.avatar_url,
                'badge_verified': getattr(global_user, 'badge_verified', False),
                'is_contact': False,
            })

    return jsonify({'results': results}), 200


@contacts_enhanced_bp.route('/add-by-phone', methods=['POST'])
@jwt_required()
def add_by_phone():
    """Add a contact by phone number."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    phone = data.get('phone_number', '').strip()
    contact_name = data.get('contact_name', '').strip()

    if not phone:
        return jsonify({'error': 'Phone number required'}), 400

    norm = normalize_phone(phone)
    found_user = User.query.filter_by(phone_number=norm).filter(User.id != user_id).first()

    if not found_user:
        # Add as pending contact (not on VipChat yet)
        existing = Contact.query.filter_by(user_id=user_id, phone_number=norm).first()
        if existing:
            return jsonify({'error': 'Contact already exists', 'contact': existing.to_dict()}), 409

        c = Contact()
        c.user_id = user_id
        c.phone_number = norm
        c.contact_name = contact_name or phone
        db.session.add(c)
        db.session.commit()
        return jsonify({
            'contact': c.to_dict(),
            'message': f'{contact_name or phone} saved. They will appear when they join VipChat.',
            'on_vipchat': False,
        }), 201

    # User found on VipChat
    existing = Contact.query.filter_by(user_id=user_id, contact_user_id=found_user.id).first()
    if existing:
        return jsonify({'error': 'Already a contact', 'contact': existing.to_dict(), 'on_vipchat': True}), 409

    c = Contact()
    c.user_id = user_id
    c.contact_user_id = found_user.id
    c.contact_name = contact_name or found_user.full_name
    c.phone_number = norm
    db.session.add(c)
    db.session.commit()

    return jsonify({
        'contact': c.to_dict(),
        'user': {
            'id': found_user.id,
            'full_name': found_user.full_name,
            'avatar_url': found_user.avatar_url,
            'badge_verified': getattr(found_user, 'badge_verified', False),
        },
        'message': f'{found_user.full_name} added to contacts!',
        'on_vipchat': True,
    }), 201


@contacts_enhanced_bp.route('/bulk-add', methods=['POST'])
@jwt_required()
def bulk_add_contacts():
    """Add multiple contacts at once (from import CSV/vCard)."""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    contacts_data = data.get('contacts', [])

    if not isinstance(contacts_data, list) or len(contacts_data) > 1000:
        return jsonify({'error': 'Max 1000 contacts per bulk add'}), 400

    added = 0
    found_on_vipchat = 0
    errors = []

    for item in contacts_data:
        phone = item.get('phone_number', '').strip()
        name = item.get('name', '').strip()
        if not phone:
            continue
        try:
            norm = normalize_phone(phone)
            found_user = User.query.filter_by(phone_number=norm).filter(User.id != user_id).first()
            existing = None
            if found_user:
                existing = Contact.query.filter_by(user_id=user_id, contact_user_id=found_user.id).first()
            else:
                existing = Contact.query.filter_by(user_id=user_id, phone_number=norm).first()

            if not existing:
                c = Contact()
                c.user_id = user_id
                c.contact_name = name or phone
                c.phone_number = norm
                if found_user:
                    c.contact_user_id = found_user.id
                    found_on_vipchat += 1
                db.session.add(c)
                added += 1
        except Exception as ex:
            errors.append(str(ex))

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({'error': 'Database error'}), 500

    return jsonify({
        'added': added,
        'found_on_vipchat': found_on_vipchat,
        'errors': errors[:10],
    }), 200


@contacts_enhanced_bp.route('/stats', methods=['GET'])
@jwt_required()
def contact_stats():
    """Get contact statistics."""
    user_id = get_jwt_identity()
    total = Contact.query.filter_by(user_id=user_id).count()
    on_vipchat = Contact.query.filter(
        Contact.user_id == user_id,
        Contact.contact_user_id != None,
    ).count()
    return jsonify({
        'total': total,
        'on_vipchat': on_vipchat,
        'not_on_vipchat': total - on_vipchat,
    }), 200
