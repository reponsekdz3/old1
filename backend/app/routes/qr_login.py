from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token, create_refresh_token
from app.models.models import db, User
from datetime import datetime, timedelta
import uuid
import threading

qr_login_bp = Blueprint('qr_login', __name__, url_prefix='/api/auth/qr-session')

# In-memory session store: {session_id: {status, user_id, created_at, access_token, refresh_token}}
_sessions = {}
_sessions_lock = threading.Lock()

QR_SESSION_TTL = 120  # seconds


def _cleanup_sessions():
    now = datetime.utcnow()
    with _sessions_lock:
        expired = [k for k, v in _sessions.items()
                   if (now - v['created_at']).total_seconds() > QR_SESSION_TTL]
        for k in expired:
            del _sessions[k]


@qr_login_bp.route('/generate', methods=['POST'])
def generate_qr_session():
    """Web calls this to get a one-time session token to display as QR code."""
    _cleanup_sessions()
    session_id = str(uuid.uuid4())
    with _sessions_lock:
        _sessions[session_id] = {
            'status': 'pending',
            'user_id': None,
            'created_at': datetime.utcnow(),
            'access_token': None,
            'refresh_token': None,
        }
    return jsonify({
        'session_id': session_id,
        'expires_in': QR_SESSION_TTL,
        'qr_data': f'vipchat://qr-login/{session_id}',
    }), 200


@qr_login_bp.route('/status/<session_id>', methods=['GET'])
def get_qr_session_status(session_id):
    """Web polls this to check if the mobile app has confirmed the login."""
    with _sessions_lock:
        session = _sessions.get(session_id)
    if not session:
        return jsonify({'status': 'expired'}), 404
    age = (datetime.utcnow() - session['created_at']).total_seconds()
    if age > QR_SESSION_TTL:
        with _sessions_lock:
            _sessions.pop(session_id, None)
        return jsonify({'status': 'expired'}), 404
    if session['status'] == 'confirmed':
        with _sessions_lock:
            _sessions.pop(session_id, None)
        return jsonify({
            'status': 'confirmed',
            'access_token': session['access_token'],
            'refresh_token': session['refresh_token'],
            'user': session['user_data'],
        }), 200
    return jsonify({
        'status': session['status'],
        'expires_in': max(0, int(QR_SESSION_TTL - age)),
    }), 200


@qr_login_bp.route('/confirm', methods=['POST'])
@jwt_required()
def confirm_qr_session():
    """Mobile app calls this (while authenticated) to confirm a web login session."""
    user_id = get_jwt_identity()
    data = request.json or {}
    session_id = data.get('session_id', '').strip()
    if not session_id:
        return jsonify({'error': 'session_id is required'}), 400
    with _sessions_lock:
        session = _sessions.get(session_id)
    if not session:
        return jsonify({'error': 'QR session not found or expired'}), 404
    age = (datetime.utcnow() - session['created_at']).total_seconds()
    if age > QR_SESSION_TTL:
        with _sessions_lock:
            _sessions.pop(session_id, None)
        return jsonify({'error': 'QR session expired'}), 410
    if session['status'] != 'pending':
        return jsonify({'error': 'QR session already used'}), 409

    user = User.query.get(user_id)
    if not user:
        return jsonify({'error': 'User not found'}), 404

    access_token = create_access_token(identity=user_id)
    refresh_token = create_refresh_token(identity=user_id)

    with _sessions_lock:
        if session_id in _sessions:
            _sessions[session_id]['status'] = 'confirmed'
            _sessions[session_id]['user_id'] = user_id
            _sessions[session_id]['access_token'] = access_token
            _sessions[session_id]['refresh_token'] = refresh_token
            _sessions[session_id]['user_data'] = {
                'id': user.id,
                'full_name': user.full_name,
                'phone_number': user.phone_number,
                'avatar_url': user.avatar_url,
                'about': user.about,
            }

    return jsonify({'message': 'Web login confirmed successfully'}), 200
