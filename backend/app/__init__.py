from flask import Flask, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, emit, join_room, leave_room
from config import config
from app.models.models import db
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def create_app(config_name='development'):
    """Application factory"""
    app = Flask(__name__)
    
    # Load configuration
    app.config.from_object(config[config_name])
    
    # Initialize extensions
    db.init_app(app)
    CORS(app, origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'])
    JWTManager(app)
    
    # Initialize SocketIO
    socketio = SocketIO(
        app,
        cors_allowed_origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'],
        async_mode='threading'
    )
    
    # Store active connections
    app.active_connections = {}
    
    # Register blueprints
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

    # Security headers on every response
    from app.middleware.security import add_security_headers
    app.after_request(add_security_headers)

    # Health check endpoint
    @app.route('/api/health', methods=['GET'])
    def health():
        return jsonify({'status': 'healthy', 'app': 'Bitese'}), 200
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(500)
    def server_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    # WebSocket events
    @socketio.on('connect')
    def handle_connect():
        """Handle user connection"""
        print(f'Client connected: {id}')
        emit('connection_response', {'message': 'Connected to server'})
    
    @socketio.on('disconnect')
    def handle_disconnect():
        """Handle user disconnection"""
        print(f'Client disconnected')
        # Remove from active connections
        for user_id, connections in app.active_connections.copy().items():
            if id in connections:
                connections.remove(id)
                if not connections:
                    del app.active_connections[user_id]
    
    @socketio.on('user_connect')
    def handle_user_connect(data):
        """Handle user authentication and connect to their room"""
        user_id = data.get('user_id')
        if not user_id:
            emit('error', {'message': 'User ID is required'})
            return
        
        # Add to active connections
        if user_id not in app.active_connections:
            app.active_connections[user_id] = []
        app.active_connections[user_id].append(id)
        
        # Join user's room
        join_room(f"user_{user_id}")
        emit('user_connected', {'user_id': user_id, 'message': 'User connected'})
        print(f'User {user_id} connected')
    
    @socketio.on('typing')
    def handle_typing(data):
        """Broadcast typing indicator"""
        user_id = data.get('user_id')
        receiver_id = data.get('receiver_id')
        
        if receiver_id:
            emit('typing_indicator', {
                'user_id': user_id
            }, room=f"user_{receiver_id}")
    
    @socketio.on('stop_typing')
    def handle_stop_typing(data):
        """Broadcast stop typing"""
        user_id = data.get('user_id')
        receiver_id = data.get('receiver_id')
        
        if receiver_id:
            emit('stop_typing_indicator', {
                'user_id': user_id
            }, room=f"user_{receiver_id}")
    
    @socketio.on('message')
    def handle_message(data):
        """Handle incoming message"""
        sender_id = data.get('sender_id')
        receiver_id = data.get('receiver_id')
        content = data.get('content')
        message_id = data.get('message_id')
        
        if not all([sender_id, receiver_id, content, message_id]):
            emit('error', {'message': 'Invalid message data'})
            return
        
        # Broadcast message to receiver
        emit('new_message', {
            'message_id': message_id,
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'content': content,
            'timestamp': data.get('timestamp')
        }, room=f"user_{receiver_id}")
        
        # Acknowledge to sender
        emit('message_sent', {'message_id': message_id})
    
    @socketio.on('message_delivered')
    def handle_message_delivered(data):
        """Handle message delivered confirmation"""
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        emit('delivery_confirmation', {
            'message_id': message_id
        }, room=f"user_{sender_id}")
    
    @socketio.on('message_read')
    def handle_message_read(data):
        """Handle message read confirmation"""
        message_id = data.get('message_id')
        sender_id = data.get('sender_id')
        
        emit('read_confirmation', {
            'message_id': message_id
        }, room=f"user_{sender_id}")
    
    @socketio.on('reaction')
    def handle_reaction(data):
        """Handle message reaction"""
        message_id = data.get('message_id')
        user_id = data.get('user_id')
        emoji = data.get('emoji')
        receiver_id = data.get('receiver_id')
        
        emit('reaction_added', {
            'message_id': message_id,
            'user_id': user_id,
            'emoji': emoji
        }, room=f"user_{receiver_id}")
    
    @socketio.on('status_update')
    def handle_status_update(data):
        """Handle user status update"""
        user_id = data.get('user_id')
        status = data.get('status')
        
        # Broadcast to all connected users
        emit('user_status_changed', {
            'user_id': user_id,
            'status': status
        }, broadcast=True)
    
    @socketio.on('call_offer')
    def handle_call_offer(data):
        """Handle voice/video call offer — relay full caller metadata"""
        receiver_id = data.get('receiver_id')
        caller_id = data.get('caller_id')
        offer = data.get('offer')
        emit('incoming_call', {
            'caller_id': caller_id,
            'caller_name': data.get('caller_name', 'Unknown'),
            'caller_avatar': data.get('caller_avatar'),
            'call_type': data.get('call_type', 'video'),
            'call_id': data.get('call_id'),
            'offer': offer,
        }, room=f"user_{receiver_id}")
    
    @socketio.on('call_answer')
    def handle_call_answer(data):
        """Handle call answer — relay SDP answer back to caller"""
        caller_id = data.get('caller_id')
        answer = data.get('answer')
        emit('call_answered', {
            'answer': answer,
            'callee_id': data.get('callee_id'),
            'call_id': data.get('call_id'),
        }, room=f"user_{caller_id}")
    
    @socketio.on('ice_candidate')
    def handle_ice_candidate(data):
        """Handle ICE candidate for WebRTC"""
        receiver_id = data.get('receiver_id')
        candidate = data.get('candidate')
        sender_id = data.get('sender_id')
        
        emit('ice_candidate', {
            'candidate': candidate,
            'sender_id': sender_id
        }, room=f"user_{receiver_id}")
    
    @socketio.on('join_group')
    def handle_join_group(data):
        """Join a group room"""
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        
        if group_id:
            join_room(f"group_{group_id}")
            emit('user_joined_group', {
                'user_id': user_id,
                'group_id': group_id
            }, room=f"group_{group_id}")
    
    @socketio.on('leave_group')
    def handle_leave_group(data):
        """Leave a group room"""
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        
        if group_id:
            leave_room(f"group_{group_id}")
            emit('user_left_group', {
                'user_id': user_id,
                'group_id': group_id
            }, room=f"group_{group_id}")
    
    @socketio.on('group_message')
    def handle_group_message(data):
        """Handle group message"""
        group_id = data.get('group_id')
        sender_id = data.get('sender_id')
        content = data.get('content')
        message_id = data.get('message_id')
        
        emit('new_group_message', {
            'message_id': message_id,
            'group_id': group_id,
            'sender_id': sender_id,
            'content': content,
            'timestamp': data.get('timestamp')
        }, room=f"group_{group_id}")
    
    @socketio.on('group_typing')
    def handle_group_typing(data):
        """Handle typing in group"""
        group_id = data.get('group_id')
        user_id = data.get('user_id')
        
        emit('group_typing_indicator', {
            'user_id': user_id
        }, room=f"group_{group_id}")
    
    @socketio.on('call_reject')
    def handle_call_reject(data):
        """Handle call rejection"""
        caller_id = data.get('caller_id')
        call_id = data.get('call_id')
        emit('call_rejected', {
            'call_id': call_id,
            'reason': data.get('reason', 'declined'),
        }, room=f"user_{caller_id}")
    
    @socketio.on('call_end')
    def handle_call_end(data):
        """Handle call end"""
        receiver_id = data.get('receiver_id')
        call_id = data.get('call_id')
        
        emit('call_ended', {
            'call_id': call_id
        }, room=f"user_{receiver_id}")
    
    @socketio.on('location_share')
    def handle_location_share(data):
        """Handle live location sharing"""
        receiver_id = data.get('receiver_id')
        sender_id = data.get('sender_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        emit('location_update', {
            'sender_id': sender_id,
            'latitude': latitude,
            'longitude': longitude,
            'timestamp': data.get('timestamp')
        }, room=f"user_{receiver_id}")
    
    @socketio.on('message_deleted')
    def handle_message_deleted(data):
        """Handle message deletion notification"""
        message_id = data.get('message_id')
        receiver_id = data.get('receiver_id')
        
        emit('message_deleted_notification', {
            'message_id': message_id
        }, room=f"user_{receiver_id}")
    
    @socketio.on('message_edited')
    def handle_message_edited(data):
        """Handle message edit notification"""
        message_id = data.get('message_id')
        receiver_id = data.get('receiver_id')
        new_content = data.get('new_content')
        
        emit('message_edited_notification', {
            'message_id': message_id,
            'new_content': new_content
        }, room=f"user_{receiver_id}")
    
    @socketio.on('poll_created')
    def handle_poll_created(data):
        """Handle poll creation in group"""
        group_id = data.get('group_id')
        poll_id = data.get('poll_id')
        
        emit('new_poll', {
            'poll_id': poll_id,
            'group_id': group_id
        }, room=f"group_{group_id}")
    
    @socketio.on('poll_voted')
    def handle_poll_voted(data):
        """Handle poll vote"""
        group_id = data.get('group_id')
        poll_id = data.get('poll_id')
        user_id = data.get('user_id')
        
        emit('poll_vote_update', {
            'poll_id': poll_id,
            'user_id': user_id
        }, room=f"group_{group_id}")
    
    # Create database tables + safe migrations
    with app.app_context():
        db.create_all()
        # Safe column additions for SQLite (ignore if column already exists)
        from sqlalchemy import text
        migrations = [
            'ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT 0',
            'ALTER TABLE users ADD COLUMN is_banned BOOLEAN DEFAULT 0',
            'ALTER TABLE messages ADD COLUMN is_deleted_sender BOOLEAN DEFAULT 0',
            'ALTER TABLE messages ADD COLUMN is_deleted_receiver BOOLEAN DEFAULT 0',
            'ALTER TABLE users ADD COLUMN account_confirmed_at TIMESTAMP NULL',
            "CREATE TABLE IF NOT EXISTS push_subscriptions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, active INTEGER DEFAULT 1, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
        ]
        for sql in migrations:
            try:
                db.session.execute(text(sql))
                db.session.commit()
            except Exception:
                db.session.rollback()
    
    return app, socketio

if __name__ == '__main__':
    app, socketio = create_app()
    socketio.run(app, host='0.0.0.0', port=5000, debug=True)
