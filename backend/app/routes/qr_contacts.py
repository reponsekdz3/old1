from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Contact
from app.models.community_models import QRCode, ContactRequest
from datetime import datetime, timedelta
import qrcode
import io
import json
import base64
from cryptography.fernet import Fernet
import os

qr_bp = Blueprint('qr', __name__, url_prefix='/api/qr')

# Generate encryption key (store in env in production)
ENCRYPTION_KEY = os.getenv('QR_ENCRYPTION_KEY', Fernet.generate_key())
cipher = Fernet(ENCRYPTION_KEY)

@qr_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_qr_code():
    """Generate QR code for user profile"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Create QR data
        qr_data = {
            'user_id': user.id,
            'full_name': user.full_name,
            'phone_number': user.phone_number,
            'avatar_url': user.avatar_url,
            'timestamp': datetime.utcnow().isoformat()
        }
        
        # Encrypt data
        encrypted_data = cipher.encrypt(json.dumps(qr_data).encode())
        encoded_data = base64.b64encode(encrypted_data).decode()
        
        # Generate QR code image
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=4,
        )
        qr.add_data(encoded_data)
        qr.make(fit=True)
        
        img = qr.make_image(fill_color="#25D366", back_color="white")
        
        # Save to buffer
        buffer = io.BytesIO()
        img.save(buffer, format='PNG')
        buffer.seek(0)
        
        # Save to file
        filename = f"qr_{user_id}_{datetime.utcnow().timestamp()}.png"
        qr_folder = os.path.join('uploads', 'qr_codes')
        os.makedirs(qr_folder, exist_ok=True)
        filepath = os.path.join(qr_folder, filename)
        
        with open(filepath, 'wb') as f:
            f.write(buffer.getvalue())
        
        # Save to database
        qr_code = QRCode(
            user_id=user_id,
            qr_data=encoded_data,
            qr_image_url=f"/uploads/qr_codes/{filename}",
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        
        db.session.add(qr_code)
        db.session.commit()
        
        return jsonify({
            'message': 'QR code generated',
            'qr_code': qr_code.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@qr_bp.route('/scan', methods=['POST'])
@jwt_required()
def scan_qr_code():
    """Scan and decode QR code"""
    try:
        scanner_id = get_jwt_identity()
        data = request.json
        qr_data = data.get('qr_data')
        
        if not qr_data:
            return jsonify({'error': 'QR data required'}), 400
        
        # Decrypt data
        try:
            decoded_data = base64.b64decode(qr_data)
            decrypted_data = cipher.decrypt(decoded_data)
            user_data = json.loads(decrypted_data.decode())
        except Exception:
            return jsonify({'error': 'Invalid QR code'}), 400
        
        scanned_user_id = user_data.get('user_id')
        
        # Update scan count
        qr_code = QRCode.query.filter_by(
            user_id=scanned_user_id,
            qr_data=qr_data,
            is_active=True
        ).first()
        
        if qr_code:
            qr_code.scan_count += 1
            db.session.commit()
        
        # Check if already contacts
        existing_contact = Contact.query.filter_by(
            user_id=scanner_id,
            contact_user_id=scanned_user_id
        ).first()
        
        return jsonify({
            'user': user_data,
            'is_contact': existing_contact is not None,
            'scan_count': qr_code.scan_count if qr_code else 0
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@qr_bp.route('/my-codes', methods=['GET'])
@jwt_required()
def get_my_qr_codes():
    """Get all QR codes for current user"""
    try:
        user_id = get_jwt_identity()
        
        qr_codes = QRCode.query.filter_by(
            user_id=user_id,
            is_active=True
        ).order_by(QRCode.created_at.desc()).all()
        
        return jsonify({
            'qr_codes': [qr.to_dict() for qr in qr_codes]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@qr_bp.route('/<qr_id>/deactivate', methods=['PUT'])
@jwt_required()
def deactivate_qr_code(qr_id):
    """Deactivate a QR code"""
    try:
        user_id = get_jwt_identity()
        
        qr_code = QRCode.query.get(qr_id)
        if not qr_code:
            return jsonify({'error': 'QR code not found'}), 404
        
        if qr_code.user_id != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        
        qr_code.is_active = False
        db.session.commit()
        
        return jsonify({'message': 'QR code deactivated'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Contact Request Routes
contact_requests_bp = Blueprint('contact_requests', __name__, url_prefix='/api/contact-requests')

@contact_requests_bp.route('/send', methods=['POST'])
@jwt_required()
def send_contact_request():
    """Send contact request"""
    try:
        sender_id = get_jwt_identity()
        data = request.json
        
        receiver_phone = data.get('phone_number')
        receiver_id = data.get('user_id')
        message = data.get('message', '')
        
        if not receiver_phone and not receiver_id:
            return jsonify({'error': 'Phone number or user ID required'}), 400
        
        # Find receiver
        if receiver_phone:
            receiver = User.query.filter_by(phone_number=receiver_phone).first()
        else:
            receiver = User.query.get(receiver_id)
        
        if not receiver:
            return jsonify({'error': 'User not found'}), 404
        
        if sender_id == receiver.id:
            return jsonify({'error': 'Cannot send request to yourself'}), 400
        
        # Check if already contacts
        existing_contact = Contact.query.filter_by(
            user_id=sender_id,
            contact_user_id=receiver.id
        ).first()
        
        if existing_contact:
            return jsonify({'error': 'Already in contacts'}), 409
        
        # Check for existing request
        existing_request = ContactRequest.query.filter_by(
            sender_id=sender_id,
            receiver_id=receiver.id,
            status='pending'
        ).first()
        
        if existing_request:
            return jsonify({'error': 'Request already sent'}), 409
        
        # Create request
        contact_request = ContactRequest(
            sender_id=sender_id,
            receiver_id=receiver.id,
            message=message
        )
        
        db.session.add(contact_request)
        db.session.commit()
        
        return jsonify({
            'message': 'Contact request sent',
            'request': contact_request.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contact_requests_bp.route('/received', methods=['GET'])
@jwt_required()
def get_received_requests():
    """Get received contact requests"""
    try:
        user_id = get_jwt_identity()
        
        requests = ContactRequest.query.filter_by(
            receiver_id=user_id,
            status='pending'
        ).order_by(ContactRequest.created_at.desc()).all()
        
        return jsonify({
            'requests': [r.to_dict() for r in requests]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contact_requests_bp.route('/sent', methods=['GET'])
@jwt_required()
def get_sent_requests():
    """Get sent contact requests"""
    try:
        user_id = get_jwt_identity()
        
        requests = ContactRequest.query.filter_by(
            sender_id=user_id
        ).order_by(ContactRequest.created_at.desc()).all()
        
        return jsonify({
            'requests': [r.to_dict() for r in requests]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contact_requests_bp.route('/<request_id>/accept', methods=['PUT'])
@jwt_required()
def accept_request(request_id):
    """Accept contact request"""
    try:
        user_id = get_jwt_identity()
        
        contact_request = ContactRequest.query.get(request_id)
        if not contact_request:
            return jsonify({'error': 'Request not found'}), 404
        
        if contact_request.receiver_id != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        
        if contact_request.status != 'pending':
            return jsonify({'error': 'Request already processed'}), 400
        
        # Create mutual contacts
        contact1 = Contact(
            user_id=user_id,
            phone_number=contact_request.sender.phone_number,
            contact_name=contact_request.sender.full_name,
            contact_user_id=contact_request.sender_id
        )
        
        contact2 = Contact(
            user_id=contact_request.sender_id,
            phone_number=contact_request.receiver.phone_number,
            contact_name=contact_request.receiver.full_name,
            contact_user_id=user_id
        )
        
        contact_request.status = 'accepted'
        
        db.session.add(contact1)
        db.session.add(contact2)
        db.session.commit()
        
        return jsonify({
            'message': 'Contact request accepted',
            'contact': contact1.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contact_requests_bp.route('/<request_id>/reject', methods=['PUT'])
@jwt_required()
def reject_request(request_id):
    """Reject contact request"""
    try:
        user_id = get_jwt_identity()
        
        contact_request = ContactRequest.query.get(request_id)
        if not contact_request:
            return jsonify({'error': 'Request not found'}), 404
        
        if contact_request.receiver_id != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        
        contact_request.status = 'rejected'
        db.session.commit()
        
        return jsonify({'message': 'Contact request rejected'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
