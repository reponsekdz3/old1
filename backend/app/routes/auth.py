from flask import Blueprint, request, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token,
    jwt_required, get_jwt_identity, get_jwt,
)
from app.models.models import db, User, VerificationCode
from app.models.e2ee_models import JWTBlocklist, log_security_event
from app.services.app_services import AuthService
from werkzeug.security import generate_password_hash
import secrets
import logging
import os

logger = logging.getLogger(__name__)
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

from app import limiter


def _validate_phone(phone_number):
    import phonenumbers
    try:
        number = phonenumbers.parse(phone_number, None)
        return phonenumbers.is_valid_number(number)
    except Exception:
        return False


@auth_bp.route('/send-verification-sms', methods=['POST'])
def send_verification_sms():
    try:
        data = request.json
        phone_number = data.get('phone_number')
        if not phone_number or not _validate_phone(phone_number):
            return jsonify({'error': 'A valid phone number is required'}), 400

        existing_user = User.query.filter_by(phone_number=phone_number).first()
        if existing_user:
            return jsonify({'error': 'User already exists'}), 409

        existing = VerificationCode.query.filter_by(phone_number=phone_number).first()
        if existing and not existing.is_expired():
            return jsonify({
                'message': 'Verification code already sent, please wait or use existing code',
                'phone_number': phone_number,
                'expires_at': existing.expires_at.isoformat() + 'Z',
            }), 200

        verification = AuthService.send_verification_sms(phone_number)
        if not verification.get('ok'):
            return jsonify({'error': 'Failed to send verification code'}), 500

        fresh = VerificationCode.query.filter_by(phone_number=phone_number).first()
        if not fresh:
            raise RuntimeError('Verification code was not stored after send')

        logger.info('Verification SMS sent to %s', phone_number)
        response_data = {
            'message': 'Verification code sent successfully',
            'phone_number': phone_number,
            'expires_at': fresh.expires_at.isoformat() + 'Z',
        }
        if verification.get('dev_code'):
            response_data['dev_code'] = verification['dev_code']
        return jsonify(response_data), 200
    except Exception as e:
        logger.exception('Failed to send verification SMS')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/verify-code', methods=['POST'])
def verify_code():
    """Verify the code sent to phone number"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        code = data.get('code')
        
        if not phone_number or not code:
            return jsonify({'error': 'Phone number and code are required'}), 400
        
        if not AuthService.verify_code(phone_number, code):
            return jsonify({'error': 'Invalid or expired verification code'}), 401
        
        return jsonify({'message': 'Code verified successfully'}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/signup', methods=['POST'])
@limiter.limit("5 per minute")
def signup():
    """Create a new user account — no OTP required at signup.
    Accounts are confirmed automatically after 2 days or by admin."""
    try:
        data = request.json or {}
        phone_number = data.get('phone_number', '').strip()
        full_name = data.get('full_name', '').strip()
        password = data.get('password', '')
        email = data.get('email', '').strip() or None
        age = data.get('age')
        country = data.get('country', '').strip() or None
        city = data.get('city', '').strip() or None

        if not all([phone_number, full_name, password]):
            return jsonify({'error': 'Phone number, name and password are required'}), 400

        if len(password) < 8:
            return jsonify({'error': 'Password must be at least 8 characters'}), 400

        if age is not None:
            try:
                age = int(age)
                if age < 13 or age > 120:
                    return jsonify({'error': 'Age must be between 13 and 120'}), 400
            except (TypeError, ValueError):
                return jsonify({'error': 'Age must be a valid number'}), 400

        if email:
            import re
            if not re.match(r'^[^@\s]+@[^@\s]+\.[^@\s]+$', email):
                return jsonify({'error': 'Please enter a valid email address'}), 400
            if User.query.filter_by(email=email).first():
                return jsonify({'error': 'An account with this email already exists'}), 409

        # Check if user already exists
        if User.query.filter_by(phone_number=phone_number).first():
            return jsonify({'error': 'An account with this phone number already exists'}), 409

        # Create account directly (phone verified via OTP only after 2 days)
        user = User()
        user.phone_number = phone_number
        user.full_name = full_name
        user.email = email
        user.age = age
        user.country = country
        user.city = city
        user.is_verified = True
        user.status = 'available'
        
        user.set_password(password)

        # Generate QR code
        try:
            qr_code = AuthService.generate_qr_code_for_user(user.id, phone_number)
            user.qr_code_url = qr_code
        except Exception:
            pass

        db.session.add(user)
        db.session.commit()

        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)

        return jsonify({
            'message': 'Account created successfully',
            'user': user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token,
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception('signup failed')
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/login', methods=['POST'])
@limiter.limit("10 per minute")
def login():
    """Login user"""
    try:
        data = request.json
        phone_number = data.get('phone_number')
        password = data.get('password')
        
        if not phone_number or not password:
            return jsonify({'error': 'Phone number and password are required'}), 400
        
        user = User.query.filter_by(phone_number=phone_number).first()
        
        if not user or not user.check_password(password):
            return jsonify({'error': 'Invalid credentials'}), 401
        
        if not user.is_verified:
            return jsonify({'error': 'Account not verified. Please complete phone verification.'}), 403

        if getattr(user, 'is_banned', False):
            return jsonify({'error': 'Your account has been suspended. Contact support.'}), 403

        # Update last seen
        from datetime import datetime
        user.last_seen = datetime.utcnow()
        db.session.commit()

        # Create tokens
        access_token = create_access_token(identity=user.id)
        refresh_token = create_refresh_token(identity=user.id)
        
        return jsonify({
            'message': 'Login successful',
            'user': user.to_dict(),
            'access_token': access_token,
            'refresh_token': refresh_token
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/refresh', methods=['POST'])
@jwt_required(refresh=True)
def refresh():
    """Refresh access token"""
    try:
        user_id = get_jwt_identity()
        access_token = create_access_token(identity=user_id)
        return jsonify({'access_token': access_token}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    """Get current user info"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        return jsonify(user.to_dict()), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/user/profile', methods=['PUT'])
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
            user.full_name = data['full_name']
        if 'bio' in data:
            user.bio = data['bio']
        if 'avatar_url' in data:
            user.avatar_url = data['avatar_url']
        
        db.session.commit()
        
        return jsonify({
            'message': 'Profile updated successfully',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/user/status', methods=['PUT'])
@jwt_required()
def update_status():
    """Update user status (available, away, offline)"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.json
        status = data.get('status')
        
        if status not in ['available', 'away', 'offline']:
            return jsonify({'error': 'Invalid status'}), 400
        
        user.status = status
        db.session.commit()
        
        return jsonify({
            'message': 'Status updated successfully',
            'user': user.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@auth_bp.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    """Logout user — revokes the current JWT token via the blocklist."""
    try:
        from datetime import datetime
        from flask_jwt_extended import get_jwt
        from app.models.e2ee_models import JWTBlocklist, log_security_event

        user_id = get_jwt_identity()
        jwt_data = get_jwt()
        jti = jwt_data.get('jti')

        if jti:
            exp_ts = jwt_data.get('exp', 0)
            exp_dt = datetime.utcfromtimestamp(exp_ts)
            try:
                blocklist_entry = JWTBlocklist()
                blocklist_entry.jti = jti
                blocklist_entry.user_id = user_id
                blocklist_entry.expires_at = exp_dt
                
                db.session.add(blocklist_entry)
                db.session.flush()
            except Exception:
                db.session.rollback()

        user = User.query.get(user_id)
        if user:
            user.last_seen = datetime.utcnow()
            user.status = 'offline'

        db.session.commit()
        log_security_event(user_id, 'user_logout', 'info')
        return jsonify({'message': 'Logged out successfully'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/send-reconfirmation-sms', methods=['POST'])
@jwt_required()
def send_reconfirmation_sms():
    """Send OTP for 2-day account re-confirmation"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Delete any existing unused codes for this phone
        VerificationCode.query.filter_by(phone_number=user.phone_number).delete()
        db.session.commit()

        result = AuthService.send_verification_sms(user.phone_number)
        if not result.get('ok'):
            return jsonify({'error': 'Failed to send verification code'}), 500

        fresh = VerificationCode.query.filter_by(phone_number=user.phone_number).first()
        response_data = {
            'message': 'Verification code sent',
            'expires_at': fresh.expires_at.isoformat() + 'Z' if fresh else None,
        }
        if result.get('dev_code'):
            response_data['dev_code'] = result['dev_code']
        return jsonify(response_data), 200
    except Exception as e:
        db.session.rollback()
        logger.exception('send_reconfirmation_sms failed')
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/confirm-account', methods=['POST'])
@jwt_required()
def confirm_account():
    """Verify OTP and mark account as confirmed (2-day gate)"""
    try:
        from datetime import datetime
        user_id = get_jwt_identity()
        data = request.json or {}
        code = data.get('code', '').strip()

        if not code or len(code) != 6:
            return jsonify({'error': 'A 6-digit code is required'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        if not AuthService.verify_code(user.phone_number, code):
            return jsonify({'error': 'Invalid or expired verification code'}), 401

        user.account_confirmed_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Account confirmed successfully',
            'account_confirmed_at': user.account_confirmed_at.isoformat(),
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception('confirm_account failed')
        return jsonify({'error': str(e)}), 500
