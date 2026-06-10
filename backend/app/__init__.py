from flask import Flask, jsonify, send_from_directory
import gzip
import io
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import config
from app.models.models import db
import os
import asyncio
from dotenv import load_dotenv

load_dotenv()

limiter = Limiter(key_func=get_remote_address, default_limits=["200 per minute"])

import logging
logger = logging.getLogger(__name__)


def create_app(config_name='development'):
    """Application factory"""
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    db.init_app(app)
    CORS(app, origins=app.config['SOCKETIO_CORS_ALLOWED_ORIGINS'], supports_credentials=True)
    jwt = JWTManager(app)
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

    # ── Enterprise Infrastructure Initialization ───────────────────────────
    try:
        logger.info("Initializing enterprise infrastructure...")
        
        # Military-Grade Security
        from app.security.military_grade_security import initialize_security_manager
        initialize_security_manager(
            redis_url=app.config.get('REDIS_URL'),
            secret_key=app.config['SECRET_KEY']
        )
        logger.info("✓ Military-grade security initialized")
        
        # Distributed SFU Cluster
        from app.services.distributed_sfu import initialize_sfu_cluster
        server_id = os.environ.get('SERVER_ID', f"sfu-{os.urandom(4).hex()}")
        region = os.environ.get('AWS_REGION', 'us-east-1')
        asyncio.run(initialize_sfu_cluster(
            redis_url=app.config.get('REDIS_URL'),
            server_id=server_id,
            region=region
        ))
        logger.info(f"✓ Distributed SFU cluster initialized (server: {server_id}, region: {region})")
        
        # Sharded Database
        from app.infrastructure.sharded_database import initialize_sharded_db
        shard_configs = [
            {
                'shard_id': i,
                'master_url': os.environ.get(f'SHARD_{i}_MASTER_URL', app.config['SQLALCHEMY_DATABASE_URI']),
                'replica_urls': [
                    os.environ.get(f'SHARD_{i}_REPLICA_{j}_URL')
                    for j in range(3)
                    if os.environ.get(f'SHARD_{i}_REPLICA_{j}_URL')
                ]
            }
            for i in range(app.config.get('SHARD_COUNT', 8))
        ]
        initialize_sharded_db(
            shard_count=app.config.get('SHARD_COUNT', 8),
            redis_url=app.config.get('REDIS_URL'),
            shard_configs=shard_configs
        )
        logger.info(f"✓ Sharded database initialized with {len(shard_configs)} shards")
        
        # Janus Gateway (if URL provided)
        janus_url = os.environ.get('JANUS_URL')
        if janus_url:
            from app.services.janus_gateway import initialize_janus_client
            initialize_janus_client(
                janus_url=janus_url,
                admin_secret=os.environ.get('JANUS_ADMIN_SECRET')
            )
            logger.info(f"✓ Janus Gateway connected: {janus_url}")
        
        logger.info("✓ Enterprise infrastructure fully operational")
    except Exception as e:
        logger.error(f"⚠ Enterprise infrastructure initialization error: {e}")
        # Continue anyway - fallback to basic mode
    
    # ── Original Enterprise Services Initialization ────────────────────────
    try:
        logger.info("Initializing enterprise services...")
        
        # Security Services
        from app.security.encryption import EncryptionService, KeyManager
        from app.services.e2ee_service import E2EEMessageService, GroupE2EEService
        from app.security.advanced_security import SecurityManager
        from app.security.csrf_protection import csrf_protection
        from app.security.tls_security import tls_manager
        from app.security.audit_logging import security_audit
        
        app.key_manager = KeyManager()
        app.enc_service = EncryptionService(app.key_manager)
        app.e2ee_service = E2EEMessageService(app.enc_service)
        app.group_e2ee_service = GroupE2EEService(app.enc_service)
        app.security_manager = SecurityManager(app)
        csrf_protection.init_app(app)
        tls_manager.init_app(app)
        app.security_audit = security_audit
        security_audit.init_app(app)
        
        # Scalability
        from app.infrastructure.scalability import (
            ShardManager, CacheManager, CDNManager,
            MessageQueue, MetricsCollector
        )
        
        app.shard_manager = ShardManager(shard_count=app.config.get('SHARD_COUNT', 256))
        app.cache_manager = CacheManager(app.config.get('REDIS_URL', 'redis://localhost:6379/0'))
        app.cdn_manager = CDNManager(app.config.get('CDN_URL', 'https://cdn.bitese.app'))
        app.message_queue = MessageQueue(app.config.get('REDIS_URL'))
        app.metrics = MetricsCollector(app.config.get('REDIS_URL'))
        
        # Monetization (if enabled)
        if app.config.get('FEATURE_PAYMENTS', True):
            from app.services.monetization import StripePaymentProcessor, BillingService, RevenueAnalytics
            app.stripe_processor = StripePaymentProcessor(app.config.get('STRIPE_API_KEY', ''))
            app.billing_service = BillingService(app.stripe_processor)
            app.revenue_analytics = RevenueAnalytics()
        
        logger.info("✓ Enterprise services initialized successfully")
    except Exception as e:
        logger.error(f"⚠ Error initializing enterprise services: {e}")
        # Don't fail app startup if services init fails

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

    from app.routes.e2ee import e2ee_bp
    from app.routes.security_audit import security_audit_bp
    from app.routes.contacts_sync import contacts_sync_bp
    from app.routes.sfu_routes import sfu_bp, register_sfu_socket_events
    from app.routes.call_management import call_mgmt_bp, set_socketio
    app.register_blueprint(e2ee_bp)
    app.register_blueprint(security_audit_bp)
    app.register_blueprint(contacts_sync_bp)
    app.register_blueprint(sfu_bp)
    app.register_blueprint(call_mgmt_bp)
    
    # ── Enterprise Blueprints ──────────────────────────────────────────────
    try:
        from app.routes.e2ee_enhanced import e2ee_enhanced_bp
        app.register_blueprint(e2ee_enhanced_bp)
        logger.info("✓ E2EE Enhanced routes registered")
    except Exception as e:
        logger.warning(f"⚠ E2EE Enhanced routes not available: {e}")
    
    try:
        from app.routes.monetization import monetization_bp
        app.register_blueprint(monetization_bp)
        logger.info("✓ Monetization routes registered")
    except Exception as e:
        logger.warning(f"⚠ Monetization routes not available: {e}")
    
    try:
        from app.routes.webrtc_e2ee import webrtc_e2ee_bp
        app.register_blueprint(webrtc_e2ee_bp)
        logger.info("✓ WebRTC E2EE routes registered")
    except Exception as e:
        logger.warning(f"⚠ WebRTC E2EE routes not available: {e}")

    try:
        from app.routes.marketplace import marketplace_bp, MarketplaceProduct, MarketplacePurchase, MarketplaceReview, MarketplaceMessage
        app.register_blueprint(marketplace_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Marketplace routes registered")
    except Exception as e:
        logger.warning(f"⚠ Marketplace routes not available: {e}")

    try:
        from app.routes.marketplace_advanced import marketplace_adv_bp
        app.register_blueprint(marketplace_adv_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Marketplace Advanced (Ads/B2B/Analytics) routes registered")
    except Exception as e:
        logger.warning(f"⚠ Marketplace Advanced routes not available: {e}")

    try:
        from app.routes.contacts_enhanced import contacts_enhanced_bp
        app.register_blueprint(contacts_enhanced_bp)
        logger.info("✓ Contacts Enhanced routes registered")
    except Exception as e:
        logger.warning(f"⚠ Contacts Enhanced routes not available: {e}")

    try:
        from app.routes.api_billing import api_billing_bp
        app.register_blueprint(api_billing_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ API Billing routes registered")
    except Exception as e:
        logger.warning(f"⚠ API Billing routes not available: {e}")

    try:
        from app.routes.ads import ads_bp
        app.register_blueprint(ads_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Status Ads routes registered")
    except Exception as e:
        logger.warning(f"⚠ Status Ads routes not available: {e}")

    try:
        from app.routes.auth import csrf_public_bp
        app.register_blueprint(csrf_public_bp)
        logger.info("✓ CSRF token endpoint registered")
    except Exception as e:
        logger.warning(f"⚠ CSRF token endpoint not available: {e}")

    try:
        from app.routes.marketplace_physical import physical_bp
        app.register_blueprint(physical_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Physical Marketplace routes registered")
    except Exception as e:
        logger.warning(f"⚠ Physical Marketplace routes not available: {e}")

    try:
        from app.routes.business_api_platform import biz_api_bp
        app.register_blueprint(biz_api_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Business API Platform routes registered")
    except Exception as e:
        logger.warning(f"⚠ Business API Platform routes not available: {e}")

    # ── Wallet & Trends ────────────────────────────────────────────────────
    try:
        from app.routes.wallet import wallet_bp
        app.register_blueprint(wallet_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Wallet routes registered")
    except Exception as e:
        logger.warning(f"⚠ Wallet routes not available: {e}")

    try:
        from app.routes.trends import trends_bp
        app.register_blueprint(trends_bp)
        with app.app_context():
            db.create_all()
        logger.info("✓ Trends routes registered")
    except Exception as e:
        logger.warning(f"⚠ Trends routes not available: {e}")

    try:
        from app.routes.scheduled_messages import scheduled_bp, ScheduledMessage, start_scheduler
        app.register_blueprint(scheduled_bp)
        with app.app_context():
            db.create_all()
        start_scheduler(app)
        logger.info("✓ Scheduled Messages routes registered")
    except Exception as e:
        logger.warning(f"⚠ Scheduled Messages routes not available: {e}")

    try:
        from app.routes.livestream import livestream_bp, LiveStream, LiveStreamViewer, LiveChatMessage, register_livestream_events
        app.register_blueprint(livestream_bp)
        with app.app_context():
            db.create_all()
        register_livestream_events(socketio)
        logger.info("✓ Live Stream routes registered")
    except Exception as e:
        logger.warning(f"⚠ Live Stream routes not available: {e}")

    # ── JWT token blocklist ────────────────────────────────────────────────
    @jwt.token_in_blocklist_loader
    def _check_token_revoked(jwt_header, jwt_payload):
        from app.models.e2ee_models import JWTBlocklist
        jti = jwt_payload.get('jti')
        if not jti:
            return False
        return JWTBlocklist.query.filter_by(jti=jti).first() is not None

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
            try:
                # Throttle typing events per sender->receiver to reduce bandwidth
                key = f"typing:{user_id}:{receiver_id}"
                if hasattr(app, 'cache_manager') and app.cache_manager:
                    existing = app.cache_manager.get(key)
                    if existing:
                        return
                    # Set short TTL so repeated typing within window is suppressed
                    app.cache_manager.set(key, {'ts': datetime.utcnow().isoformat()}, cache_type='default', ex=3)
            except Exception:
                # Best-effort; don't break typing flow
                pass

            emit('typing_indicator', {'user_id': user_id}, room=f"user_{receiver_id}")

    @socketio.on('stop_typing')
    def handle_stop_typing(data):
        user_id = data.get('user_id')
        receiver_id = data.get('receiver_id')
        if receiver_id:
            try:
                key = f"typing:{user_id}:{receiver_id}"
                if hasattr(app, 'cache_manager') and app.cache_manager:
                    app.cache_manager.delete(key)
            except Exception:
                pass

            emit('stop_typing_indicator', {'user_id': user_id}, room=f"user_{receiver_id}")

    # Enable lightweight gzip compression for JSON/text responses to save bandwidth
    @app.after_request
    def compress_response(response):
        try:
            accept_enc = request.headers.get('Accept-Encoding', '')
            if 'gzip' not in accept_enc.lower():
                return response

            content_type = response.headers.get('Content-Type', '')
            if not (content_type.startswith('application/json') or content_type.startswith('text/')):
                return response

            # Do not compress very small responses
            data = response.get_data()
            if not data or len(data) < 500:
                return response

            gzip_buffer = io.BytesIO()
            with gzip.GzipFile(mode='wb', fileobj=gzip_buffer, compresslevel=5) as gz:
                gz.write(data)

            response.set_data(gzip_buffer.getvalue())
            response.headers['Content-Encoding'] = 'gzip'
            response.headers['Vary'] = 'Accept-Encoding'
            response.headers['Content-Length'] = len(response.get_data())
            return response
        except Exception:
            return response

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

        # Push notification for users not currently connected via WebSocket
        try:
            active_connections = getattr(current_app, 'active_connections', {})
            if str(receiver_id) not in active_connections:
                from app.utils.push_sender import push_to_user
                from app.models.models import User as _User
                _sender = _User.query.get(sender_id)
                _name = _sender.full_name if _sender else 'Someone'
                _preview = (content[:60] + '…') if content and len(content) > 60 else (content or '[Message]')
                push_to_user(
                    receiver_id, _name, _preview,
                    url=f'/chat/{sender_id}',
                    extra={
                        'type': 'message',
                        'sender_id': str(sender_id),
                        'chat_id': str(sender_id),
                        'sender_name': _name,
                    }
                )
        except Exception:
            pass

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
    
    # Register SFU socket events
    register_sfu_socket_events(socketio)
    
    # Set socketio instance for call management broadcasting
    from app.routes.call_management import set_socketio
    set_socketio(socketio)

    # Test API Blueprint (API Testing & Sandbox)
    from app.routes.test_api import test_api_bp
    app.register_blueprint(test_api_bp)

    # API Documentation Blueprint
    from app.routes.api_docs import docs_bp
    app.register_blueprint(docs_bp)

    # ── Database setup ────────────────────────────────────────────────────
    with app.app_context():
        from app.models import e2ee_models as _e2ee_models  # noqa: F401 — ensure E2EE tables created
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
            # Call participants table for advanced call management
            '''CREATE TABLE IF NOT EXISTS call_participants (
                id VARCHAR(36) PRIMARY KEY,
                call_id VARCHAR(36) NOT NULL REFERENCES calls(id),
                user_id VARCHAR(36) NOT NULL REFERENCES users(id),
                role VARCHAR(20) DEFAULT 'participant',
                status VARCHAR(20) DEFAULT 'invited',
                audio_enabled BOOLEAN DEFAULT 1,
                video_enabled BOOLEAN DEFAULT 1,
                screen_share BOOLEAN DEFAULT 0,
                video_quality VARCHAR(20) DEFAULT 'medium',
                bandwidth_limit INTEGER DEFAULT 2500,
                socket_id VARCHAR(255),
                joined_at TIMESTAMP NULL,
                left_at TIMESTAMP NULL,
                duration INTEGER DEFAULT 0,
                is_muted BOOLEAN DEFAULT 0,
                is_video_muted BOOLEAN DEFAULT 0,
                invited_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                responded_at TIMESTAMP NULL
            )''',
            'CREATE INDEX IF NOT EXISTS ix_call_participants_call_id ON call_participants(call_id)',
            'CREATE INDEX IF NOT EXISTS ix_call_participants_user_id ON call_participants(user_id)',
            'CREATE INDEX IF NOT EXISTS ix_call_participants_role ON call_participants(role)',
            'CREATE INDEX IF NOT EXISTS ix_call_participants_status ON call_participants(status)',
        ]
        for sql in migrations:
            try:
                db.session.execute(text(sql))
                db.session.commit()
            except Exception:
                db.session.rollback()

    return app, socketio
