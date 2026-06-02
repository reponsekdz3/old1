from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from datetime import datetime

profile_bp = Blueprint('profile', __name__, url_prefix='/api/auth')

@profile_bp.route('/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.json
        
        if 'full_name' in data:
            user.full_name = data['full_name'].strip()
        
        if 'bio' in data:
            user.bio = data['bio'].strip()
        
        if 'avatar_url' in data:
            user.avatar_url = data['avatar_url']
        
        if 'email' in data:
            email = data['email'].strip() if data['email'] else None
            if email:
                import re
                if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                    return jsonify({'error': 'Invalid email address'}), 400
                existing = User.query.filter(User.email == email, User.id != user_id).first()
                if existing:
                    return jsonify({'error': 'Email already in use'}), 409
            user.email = email

        if 'age' in data:
            age = data['age']
            if age is not None:
                try:
                    age = int(age)
                    if age < 13 or age > 120:
                        return jsonify({'error': 'Age must be between 13 and 120'}), 400
                except (TypeError, ValueError):
                    return jsonify({'error': 'Invalid age'}), 400
            user.age = age

        if 'country' in data:
            user.country = data['country'].strip() if data['country'] else None

        if 'city' in data:
            user.city = data['city'].strip() if data['city'] else None

        user.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/status', methods=['PUT'])
@jwt_required()
def update_status():
    """Update user online status"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.json
        status = data.get('status', 'available')  # available, away, offline
        
        if status not in ['available', 'away', 'offline']:
            return jsonify({'error': 'Invalid status'}), 400
        
        user.status = status
        user.last_seen = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Status updated',
            'status': status
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@profile_bp.route('/last-seen', methods=['PUT'])
@jwt_required()
def update_last_seen():
    """Update last seen timestamp"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        user.last_seen = datetime.utcnow()
        db.session.commit()
        
        return jsonify({'message': 'Last seen updated'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
