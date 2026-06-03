from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config
from app.models.models import db
import os
from dotenv import load_dotenv

load_dotenv()

limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])


def create_app(config_name='development'):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    CORS(app, origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'], supports_credentials=True)
    JWTManager(app)
    limiter.init_app(app)

    socketio = SocketIO(
        app,
        cors_allowed_origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'],
        async_mode='threading',
        ping_timeout=60,
        ping_interval=25,
        max_http_buffer_size=50 * 1024 * 1024,
    )

    app.active_connections = {}

    # ── Blueprints ─────────────────────────────────────────────────────────
    from app.routes.auth import auth_bp
    from app.routes.messages import messages_bp
    from app.routes.contacts import contacts_bp, status_bp
    from app.routes.groups import groups_bp
    from app.routes.advanced_features import advanced_messages_bp, broadcast_bp, archive_bp, calls_bp
    from app.routes.settings import settings_bp
    from app.routes.communities import communities_bp
    from app.routes.channels import channels_bp
    from app.routes.qr_contacts import qr_bp, contact_requests_bp
    from app.routes.upload import upload_bp
    from app.routes.profile import profile_bp
    from app.routes.contacts_validation import contacts_validation_bp
    from app.routes.admin import admin_bp
    from app.routes.push import push_bp
    from app.routes.qr_login import qr_login_bp
    from app.routes.verification import verification_bp
    from app.routes.payments import payments_bp
    from app.routes.api_platform import api_platform_bp
    from app.routes.business_api_v1 import v1_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(messages_bp)
    app.register_blueprint(contacts_bp)
    app.register_blueprint(status_bp)
    app.register_blueprint(groups_bp)
    app.register_blueprint(advanced_messages_bp)
    app.register_blueprint(broadcast_bp)
    app.register_blueprint(archive_bp)
    app.register_blueprint(calls_bp)
    app.register_blueprint(settings_bp)
    app.register_blueprint(communities_bp)
    app.register_blueprint(channels_bp)
    app.register_blueprint(qr_bp)
    app.register_blueprint(contact_requests_bp)
    app.register_blueprint(upload_bp)
    app.register_blueprint(profile_bp)
    app.register_blueprint(contacts_validation_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(push_bp)
    app.register_blueprint(qr_login_bp)
    app.register_blueprint(verification_bp)
    app.register_blueprint(payments_bp)
    app.register_blueprint(api_platform_bp)
    app.register_blueprint(v1_bp)

    # ── Security headers ──────────────────────────────────────────────────
    from app.middleware.security import add_security_headers
    app.after_request(add_security_headers)

    # ── Serve uploaded files ──────────────────────────────────────────────
    UPLOAD_BASE = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'uploads')

    @app.route('/uploads/<path:filename>')
    def serve_upload(filename):
        return send_from_directory(UPLOAD_BASE, filename)

    # ── Health check ──────────────────────────────────────────────────────
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({'status': 'healthy'}), 200

    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return jsonify({'error': 'Too many requests. Please slow down.'}), 429

    @app.errorhandler(500)
    def server_error(error):
        return jsonify({'error': 'Internal server error'}), 500

    # ── WebSocket events ──────────────────────────────────────────────────
    @socketio.on('connect')
    def handle_connect():
        emit('connection_response', {'message': 'Connected to server'})

    @socketio.on('disconnect')
    def handle_disconnect():
        from flask import request as flask_request
        sid = flask_request.sid
        for user_id, connections in list(app.active_connections.items()):
            if sid in connections:
                connections.remove(sid)
                if not connections:
                    del app.active_connections[user_id]
                break

    @socketio.on('user_connect')
    def handle_user_connect(data):
        user_id = data.get('user_id')
        if not user_id:
            emit('error', {'message': 'User ID is required'})
            return
        if user_id not in app.active_connections:
            app.active_connections[user_id] = []
        app.active_connections[user_id].append(id)
        join_room(f"user_{user_id}")
        emit('user_connected', {'user_id': user_id, 'message': 'User connected'})

    @socketio.on('typing')
    def handle_typing(data):
        user_id = data.get('user_id')
        receiver_id = data.get('receiver_id')
        if receiver_id:
            emit('typing_indicator', {'user_id': user_id}, room=f"user_{receiver_id}")

    @socketio.on('stop_typing')
    def handle_stop_typing(data):
        user_id = data.get('user_id')
        receiver_id = data.get('receiver_id')
        if receiver_id:
            emit('stop_typing_indicator', {'user_id': user_id}, room=f"user_{receiver_id}")

    @socketio.on('message')
    def handle_message(data):
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        content = data.get('content')
        message_id = data.get('message_id')
        if not all([sender_id, receiver_id, message_id]):
            emit('error', {'message': 'Invalid message data'})
            return
        emit('new_message', {
            'message_id': message_id,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content,
            'timestamp': data.get('timestamp'),
        }, room=f"user_{receiver_id}")
        emit('message_sent', {'message_id': message_id})

    @socketio.on('message_delivered')
    def handle_message_delivered(data):
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        emit('delivery_confirmation', {'message_id': message_id}, room=f"user_{sender_id}")

    @socketio.on('message_read')
    def handle_message_read(data):
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        emit('read_confirmation', {'message_id': message_id}, room=f"user_{sender_id}")

    @socketio.on('reaction')
    def handle_reaction(data):
        message_id = data.get('message_id')
        user_id = data.get('user_id')
        emoji = data.get('emoji')
        receiver_id = data.get('receiver_id')
        emit('reaction_added', {
            'message_id': message_id,
            'user_id': user_id,
            'emoji': emoji,
        }, room=f"user_{receiver_id}")

    @socketio.on('status_update')
    def handle_status_update(data):
        user_id = data.get('user_id')
        status = data.get('status')
        emit('user_status_changed', {'user_id': user_id, 'status': status}, broadcast=True)

    # ── 1-to-1 WebRTC Call events ─────────────────────────────────────────
    @socketio.on('call_offer')
    def handle_call_offer(data):
        receiver_id = data.get('receiver_id')
        emit('incoming_call', {
            'caller_id': data.get('caller_id'),
            'caller_name': data.get('caller_name', 'Unknown'),
            'caller_avatar': data.get('caller_avatar'),
            'call_type': data.get('call_type', 'video'),
            'call_id': data.get('call_id'),
            'offer': data.get('offer'),
        }, room=f"user_{receiver_id}")

    @socketio.on('call_answer')
    def handle_call_answer(data):
        caller_id = data.get('caller_id')
        emit('call_answered', {
            'answer': data.get('answer'),
            'callee_id': data.get('callee_id'),
            'call_id': data.get('call_id'),
        }, room=f"user_{caller_id}")

    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        receiver_id = data.get('receiver_id')
        emit('ice_candidate', {
            'candidate': data.get('candidate'),
            'sender_id': data.get('sender_id'),
        }, room=f"user_{receiver_id}")

    @socketio.on('call_reject')
    def handle_call_reject(data):
        caller_id = data.get('caller_id')
        emit('call_rejected', {
            'call_id': data.get('call_id'),
            'reason': data.get('reason', 'declined'),
        }, room=f"user_{caller_id}")

    @socketio.on('call_end')
    def handle_call_end(data):
        receiver_id = data.get('receiver_id')
        emit('call_ended', {'call_id': data.get('call_id')}, room=f"user_{receiver_id}")

    # ── Group WebRTC Call events ──────────────────────────────────────────
    @socketio.on('group_call_start')
    def handle_group_call_start(data):
        """Initiator starts a group call — notify all members in the room"""
        group_id = data.get('group_id')
        initiator_id = data.get('initiator_id')
        call_type = data.get('call_type', 'video')
        call_id = data.get('call_id')
        initiator_name = data.get('initiator_name', 'Unknown')
        initiator_avatar = data.get('initiator_avatar')
        join_room(f"group_call_{call_id}")
        emit('group_incoming_call', {
            'group_id': group_id,
            'initiator_id': initiator_id,
            'initiator_name': initiator_name,
            'initiator_avatar': initiator_avatar,
            'call_type': call_type,
            'call_id': call_id,
        }, room=f"group_{group_id}", include_self=False)

    @socketio.on('group_call_join')
    def handle_group_call_join(data):
        """A user joins the group call room"""
        call_id = data.get('call_id')
        user_id = data.get('user_id')
        user_name = data.get('user_name', 'Unknown')
        join_room(f"group_call_{call_id}")
        emit('group_call_user_joined', {
            'user_id': user_id,
            'user_name': user_name,
            'call_id': call_id,
        }, room=f"group_call_{call_id}", include_self=False)

    @socketio.on('group_call_offer')
    def handle_group_call_offer(data):
        """Relay WebRTC offer to a specific user in a group call"""
        target_user_id = data.get('target_user_id')
        emit('group_call_offer', {
            'from_user_id': data.get('from_user_id'),
            'from_user_name': data.get('from_user_name'),
            'call_id': data.get('call_id'),
            'call_type': data.get('call_type', 'video'),
            'offer': data.get('offer'),
        }, room=f"user_{target_user_id}")

    @socketio.on('group_call_answer')
    def handle_group_call_answer(data):
        """Relay WebRTC answer to a specific user in a group call"""
        target_user_id = data.get('target_user_id')
        emit('group_call_answer', {
            'from_user_id': data.get('from_user_id'),
            'call_id': data.get('call_id'),
            'answer': data.get('answer'),
        }, room=f"user_{target_user_id}")

    @socketio.on('group_ice_candidate')
    def handle_group_ice_candidate(data):
        """Relay ICE candidate to a specific user in a group call"""
        target_user_id = data.get('target_user_id')
        emit('group_ice_candidate', {
            'from_user_id': data.get('from_user_id'),
            'call_id': data.get('call_id'),
            'candidate': data.get('candidate'),
        }, room=f"user_{target_user_id}")

    @socketio.on('group_call_leave')
    def handle_group_call_leave(data):
        """A user leaves the group call"""
        call_id = data.get('call_id')
        user_id = data.get('user_id')
        leave_room(f"group_call_{call_id}")
        emit('group_call_user_left', {
            'user_id': user_id,
            'call_id': call_id,
        }, room=f"group_call_{call_id}")

    @socketio.on('group_call_reject')
    def handle_group_call_reject(data):
        """User rejects a group call — notify initiator"""
        initiator_id = data.get('initiator_id')
        emit('group_call_rejected', {
            'user_id': data.get('user_id'),
            'user_name': data.get('user_name'),
            'call_id': data.get('call_id'),
        }, room=f"user_{initiator_id}")

    # ── Group / Room messaging events ─────────────────────────────────────
    @socketio.on('join_group')
    def handle_join_group(data):
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        if group_id:
            join_room(f"group_{group_id}")
            emit('user_joined_group', {'user_id': user_id, 'group_id': group_id}, room=f"group_{group_id}")

    @socketio.on('leave_group')
    def handle_leave_group(data):
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        if group_id:
            leave_room(f"group_{group_id}")
            emit('user_left_group', {'user_id': user_id, 'group_id': group_id}, room=f"group_{group_id}")

    @socketio.on('group_message')
    def handle_group_message(data):
        group_id = data.get('group_id')
        emit('new_group_message', {
            'message_id': data.get('message_id'),
            'group_id': group_id,
            'sender_id': data.get('sender_id'),
            'content': data.get('content'),
            'timestamp': data.get('timestamp'),
        }, room=f"group_{group_id}")

    @socketio.on('group_typing')
    def handle_group_typing(data):
        group_id = data.get('group_id')
        emit('group_typing_indicator', {'user_id': data.get('user_id')}, room=f"group_{group_id}")

    @socketio.on('location_share')
    def handle_location_share(data):
        receiver_id = data.get('receiver_id')
        emit('location_update', {
            'sender_id': data.get('sender_id'),
            'latitude': data.get('latitude'),
            'longitude': data.get('longitude'),
            'timestamp': data.get('timestamp'),
        }, room=f"user_{receiver_id}")

    @socketio.on('message_deleted')
    def handle_message_deleted(data):
        receiver_id = data.get('receiver_id')
        emit('message_deleted_notification', {'message_id': data.get('message_id')}, room=f"user_{receiver_id}")

    @socketio.on('message_edited')
    def handle_message_edited(data):
        receiver_id = data.get('receiver_id')
        emit('message_edited_notification', {
            'message_id': data.get('message_id'),
            'new_content': data.get('new_content'),
        }, room=f"user_{receiver_id}")

    @socketio.on('poll_created')
    def handle_poll_created(data):
        group_id = data.get('group_id')
        emit('new_poll', {'poll_id': data.get('poll_id'), 'group_id': group_id}, room=f"group_{group_id}")

    @socketio.on('poll_voted')
    def handle_poll_voted(data):
        group_id = data.get('group_id')
        emit('poll_vote_update', {
            'poll_id': data.get('poll_id'),
            'user_id': data.get('user_id'),
        }, room=f"group_{group_id}")

    # ── Database setup ────────────────────────────────────────────────────
    with app.app_context():
        db.create_all()
        from sqlalchemy import text
        migrations = [
            'ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0',
            'ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0',
            'ALTER TABLE messages ADD COLUMN is_deleted_sender BOOLEAN DEFAULT 0',
            'ALTER TABLE messages ADD COLUMN is_deleted_receiver BOOLEAN DEFAULT 0',
            'ALTER TABLE users ADD COLUMN account_confirmed_at TIMESTAMP NULL',
            "CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
            'ALTER TABLE users ADD COLUMN age INTEGER NULL',
            'ALTER TABLE users ADD COLUMN country VARCHAR(100) NULL',
            'ALTER TABLE users ADD COLUMN city VARCHAR(100) NULL',
            'ALTER TABLE users ALTER COLUMN password_hash TYPE TEXT',
            'ALTER TABLE users ALTER COLUMN avatar_url TYPE TEXT',
            'ALTER TABLE users ALTER COLUMN qr_code_url TYPE TEXT',
            # Payment-based verified badge columns
            'ALTER TABLE users ADD COLUMN badge_verified BOOLEAN DEFAULT FALSE',
            'ALTER TABLE users ADD COLUMN verification_tier VARCHAR(20) NULL',
            'ALTER TABLE users ADD COLUMN verified_at TIMESTAMP NULL',
            'ALTER TABLE users ADD COLUMN verification_payment_id VARCHAR(255) NULL',
            # Payments table
            '''CREATE TABLE IF NOT EXISTS payments (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                provider VARCHAR(20) NOT NULL,
                amount FLOAT NOT NULL,
                currency VARCHAR(10) DEFAULT 'USD',
                status VARCHAR(20) DEFAULT 'pending',
                provider_payment_id VARCHAR(255),
                tier VARCHAR(20) NOT NULL,
                metadata_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )''',
            'ALTER TABLE payments ADD COLUMN metadata_json TEXT',
            # Business API platform tables
            '''CREATE TABLE IF NOT EXISTS api_clients (
                id VARCHAR(36) PRIMARY KEY,
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                business_name VARCHAR(255) NOT NULL,
                api_key_hash VARCHAR(255) NOT NULL,
                api_key_prefix VARCHAR(20) NOT NULL,
                tier VARCHAR(20) DEFAULT 'starter',
                is_active BOOLEAN DEFAULT TRUE,
                webhook_url VARCHAR(500),
                webhook_secret VARCHAR(255),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )''',
            '''CREATE TABLE IF NOT EXISTS api_subscriptions (
                id VARCHAR(36) PRIMARY KEY,
                client_id VARCHAR(36) NOT NULL REFERENCES api_clients(id),
                stripe_subscription_id VARCHAR(255),
                tier VARCHAR(20) NOT NULL,
                status VARCHAR(20) DEFAULT 'active',
                current_period_end TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )''',
            '''CREATE TABLE IF NOT EXISTS api_usage_logs (
                id VARCHAR(36) PRIMARY KEY,
                client_id VARCHAR(36) NOT NULL REFERENCES api_clients(id),
                endpoint VARCHAR(255) NOT NULL,
                method VARCHAR(10) NOT NULL,
                status_code INTEGER NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                message_count INTEGER DEFAULT 0,
                response_time_ms INTEGER,
                ip_address VARCHAR(45)
            )''',
        ]
        for sql in migrations:
            try:
                db.session.execute(text(sql))
                db.session.commit()
            except Exception:
                db.session.rollback()

    return app, socketio
