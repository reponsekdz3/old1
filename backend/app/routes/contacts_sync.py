"""
Contacts sync route - match phone numbers against registered users.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
import re

from app.models.models import db, User, Contact

contacts_sync_bp = Blueprint('contacts_sync', __name__, url_prefix='/api/contacts')


def normalize_phone(phone: str) -> str:
    """Normalize phone number for comparison."""
    return re.sub(r'[\s\-().+]', '', phone)


@contacts_sync_bp.route('/sync-phone', methods=['POST'])
@jwt_required()
def sync_phone_contacts():
    """
    Match phone numbers from device against registered VipChat users.
    Request: { phone_numbers: ["+250788123456", ...] }
    Response: { registered: [...], unregistered: [...] }
    """
    user_id = get_jwt_identity()
    data = request.get_json()
    
    if not data or 'phone_numbers' not in data:
        return jsonify({'error': 'phone_numbers array required'}), 400
    
    phone_numbers = data['phone_numbers']
    if not isinstance(phone_numbers, list):
        return jsonify({'error': 'phone_numbers must be an array'}), 400
    
    # Limit to prevent abuse
    if len(phone_numbers) > 5000:
        return jsonify({'error': 'Too many phone numbers (max 5000)'}), 400
    
    # Normalize all phone numbers
    normalized_phones = {normalize_phone(p): p for p in phone_numbers if p}
    
    # Query users with matching phone numbers
    registered_users = User.query.filter(
        User.phone_number.in_(list(normalized_phones.keys()))
    ).all()
    
    registered_phones = set()
    registered_list = []
    
    for user in registered_users:
        norm_phone = normalize_phone(user.phone_number)
        registered_phones.add(norm_phone)
        
        # Check if already in user's contacts
        existing_contact = Contact.query.filter_by(
            user_id=user_id,
            contact_user_id=user.id
        ).first()
        
        if not existing_contact:
            # Auto-add to contacts
            contact = Contact(
                user_id=user_id,
                phone_number=user.phone_number,
                contact_user_id=user.id,
                contact_name=user.full_name
            )
            db.session.add(contact)
        
        registered_list.append({
            'id': user.id,
            'phone_number': user.phone_number,
            'full_name': user.full_name,
            'avatar_url': user.avatar_url,
            'bio': user.bio,
            'status': user.status,
            'badge_verified': user.badge_verified
        })
    
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
    
    # Unregistered numbers
    unregistered = [
        normalized_phones[norm] 
        for norm in normalized_phones.keys() 
        if norm not in registered_phones
    ]
    
    return jsonify({
        'registered': registered_list,
        'unregistered': unregistered,
        'total_checked': len(phone_numbers),
        'registered_count': len(registered_list),
        'unregistered_count': len(unregistered)
    }), 200
