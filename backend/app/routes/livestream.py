"""
Live Streaming — creators go live, viewers join and watch in real-time.
WebRTC signaling via Socket.IO + viewer count tracking.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.models import db, User
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey, Float
import uuid, logging

logger = logging.getLogger(__name__)
livestream_bp = Blueprint('livestream', __name__, url_prefix='/api/livestream')

# ── Models ─────────────────────────────────────────────────────────────────────
class LiveStream(db.Model):
    __tablename__ = 'live_streams'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    host_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    host_name = Column(String(128))
    host_avatar = Column(Text, nullable=True)
    title = Column(String(255), nullable=False, default='Live Stream')
    description = Column(Text, nullable=True)
    category = Column(String(64), default='general')
    viewer_count = Column(Integer, default=0)
    peak_viewers = Column(Integer, default=0)
    total_messages = Column(Integer, default=0)
    is_live = Column(Boolean, default=True)
    started_at = Column(DateTime, default=datetime.utcnow)
    ended_at = Column(DateTime, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    stream_key = Column(String(64), nullable=True, unique=True)

    def to_dict(self):
        host = User.query.get(self.host_id)
        duration = None
        if self.started_at:
            end = self.ended_at or datetime.utcnow()
            duration = int((end - self.started_at).total_seconds())
        return {
            'id': self.id,
            'host_id': self.host_id,
            'host_name': self.host_name,
            'host_avatar': host.avatar_url if host else self.host_avatar,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'viewer_count': self.viewer_count or 0,
            'peak_viewers': self.peak_viewers or 0,
            'total_messages': self.total_messages or 0,
            'is_live': self.is_live,
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'ended_at': self.ended_at.isoformat() if self.ended_at else None,
            'duration_sec': duration,
            'thumbnail_url': self.thumbnail_url,
            'stream_key': self.stream_key if self.is_live else None,
        }


class LiveStreamViewer(db.Model):
    __tablename__ = 'live_stream_viewers'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    stream_id = Column(String(36), ForeignKey('live_streams.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    session_id = Column(String(64), nullable=False)
    joined_at = Column(DateTime, default=datetime.utcnow)
    left_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)


class LiveChatMessage(db.Model):
    __tablename__ = 'live_chat_messages'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    stream_id = Column(String(36), ForeignKey('live_streams.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    user_name = Column(String(128))
    user_avatar = Column(Text, nullable=True)
    content = Column(Text, nullable=False)
    msg_type = Column(String(20), default='chat')  # chat | gift | like | join
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'stream_id': self.stream_id,
            'user_id': self.user_id,
            'user_name': self.user_name,
            'user_avatar': self.user_avatar,
            'content': self.content,
            'msg_type': self.msg_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── Helpers ────────────────────────────────────────────────────────────────────
def _optional_user():
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt_identity()
    except Exception:
        return None


# ── REST Endpoints ─────────────────────────────────────────────────────────────
@livestream_bp.route('/active', methods=['GET'])
def get_active_streams():
    try:
        category = request.args.get('category', '')
        q = LiveStream.query.filter_by(is_live=True)
        if category and category != 'all':
            q = q.filter_by(category=category)
        streams = q.order_by(LiveStream.viewer_count.desc()).limit(20).all()
        return jsonify({'streams': [s.to_dict() for s in streams]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/recent', methods=['GET'])
def get_recent_streams():
    try:
        cutoff = datetime.utcnow() - timedelta(hours=24)
        streams = LiveStream.query.filter(
            LiveStream.is_live == False,
            LiveStream.ended_at >= cutoff,
        ).order_by(LiveStream.peak_viewers.desc()).limit(10).all()
        return jsonify({'streams': [s.to_dict() for s in streams]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/start', methods=['POST'])
@jwt_required()
def start_stream():
    try:
        host_id = get_jwt_identity()
        host = User.query.get(host_id)
        if not host:
            return jsonify({'error': 'User not found'}), 404

        # End any existing live stream from this host
        existing = LiveStream.query.filter_by(host_id=host_id, is_live=True).first()
        if existing:
            existing.is_live = False
            existing.ended_at = datetime.utcnow()

        data = request.json or {}
        import secrets
        stream_key = secrets.token_urlsafe(24)

        stream = LiveStream(
            host_id=host_id,
            host_name=host.full_name,
            host_avatar=host.avatar_url,
            title=(data.get('title') or f"{host.full_name}'s Live").strip()[:200],
            description=(data.get('description') or '').strip(),
            category=data.get('category', 'general'),
            thumbnail_url=data.get('thumbnail_url'),
            stream_key=stream_key,
        )
        db.session.add(stream)
        db.session.commit()
        return jsonify({'stream': stream.to_dict(), 'message': 'You are now live!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/<stream_id>/end', methods=['POST'])
@jwt_required()
def end_stream(stream_id):
    try:
        host_id = get_jwt_identity()
        stream = LiveStream.query.filter_by(id=stream_id, host_id=host_id, is_live=True).first()
        if not stream:
            return jsonify({'error': 'Stream not found or already ended'}), 404
        stream.is_live = False
        stream.ended_at = datetime.utcnow()
        stream.stream_key = None
        LiveStreamViewer.query.filter_by(stream_id=stream_id, is_active=True).update({'is_active': False, 'left_at': datetime.utcnow()})
        stream.viewer_count = 0
        db.session.commit()
        return jsonify({'stream': stream.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/<stream_id>', methods=['GET'])
def get_stream(stream_id):
    try:
        stream = LiveStream.query.get(stream_id)
        if not stream:
            return jsonify({'error': 'Stream not found'}), 404
        return jsonify({'stream': stream.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/<stream_id>/join', methods=['POST'])
def join_stream(stream_id):
    try:
        user_id = _optional_user()
        stream = LiveStream.query.filter_by(id=stream_id, is_live=True).first()
        if not stream:
            return jsonify({'error': 'Stream not found or ended'}), 404
        session_id = request.json.get('session_id', str(uuid.uuid4())) if request.json else str(uuid.uuid4())
        # Check if already viewing
        existing = LiveStreamViewer.query.filter_by(stream_id=stream_id, session_id=session_id, is_active=True).first()
        if not existing:
            viewer = LiveStreamViewer(stream_id=stream_id, user_id=user_id, session_id=session_id)
            db.session.add(viewer)
            stream.viewer_count = (stream.viewer_count or 0) + 1
            if stream.viewer_count > (stream.peak_viewers or 0):
                stream.peak_viewers = stream.viewer_count
            db.session.commit()
        # Post join message
        if user_id:
            user = User.query.get(user_id)
            if user:
                try:
                    join_msg = LiveChatMessage(
                        stream_id=stream_id, user_id=user_id,
                        user_name=user.full_name, user_avatar=user.avatar_url,
                        content=f'{user.full_name} joined', msg_type='join'
                    )
                    db.session.add(join_msg)
                    db.session.commit()
                except Exception:
                    db.session.rollback()
        return jsonify({'viewer_count': stream.viewer_count, 'session_id': session_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/<stream_id>/leave', methods=['POST'])
def leave_stream(stream_id):
    try:
        session_id = (request.json or {}).get('session_id', '')
        stream = LiveStream.query.get(stream_id)
        if not stream:
            return jsonify({'ok': True}), 200
        viewer = LiveStreamViewer.query.filter_by(stream_id=stream_id, session_id=session_id, is_active=True).first()
        if viewer:
            viewer.is_active = False
            viewer.left_at = datetime.utcnow()
            stream.viewer_count = max(0, (stream.viewer_count or 0) - 1)
            db.session.commit()
        return jsonify({'viewer_count': stream.viewer_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/<stream_id>/chat', methods=['GET'])
def get_live_chat(stream_id):
    try:
        messages = LiveChatMessage.query.filter_by(stream_id=stream_id).order_by(
            LiveChatMessage.created_at.desc()
        ).limit(100).all()
        return jsonify({'messages': [m.to_dict() for m in reversed(messages)]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/<stream_id>/chat', methods=['POST'])
@jwt_required()
def send_live_chat(stream_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        stream = LiveStream.query.filter_by(id=stream_id, is_live=True).first()
        if not stream:
            return jsonify({'error': 'Stream not live'}), 404
        content = ((request.json or {}).get('content') or '').strip()
        if not content or len(content) > 500:
            return jsonify({'error': 'Content must be 1-500 chars'}), 400
        msg = LiveChatMessage(
            stream_id=stream_id, user_id=user_id,
            user_name=user.full_name if user else 'Viewer',
            user_avatar=user.avatar_url if user else None,
            content=content, msg_type='chat',
        )
        db.session.add(msg)
        stream.total_messages = (stream.total_messages or 0) + 1
        db.session.commit()
        return jsonify({'message': msg.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@livestream_bp.route('/my', methods=['GET'])
@jwt_required()
def my_streams():
    try:
        host_id = get_jwt_identity()
        streams = LiveStream.query.filter_by(host_id=host_id).order_by(
            LiveStream.started_at.desc()
        ).limit(20).all()
        return jsonify({'streams': [s.to_dict() for s in streams]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Socket.IO events ───────────────────────────────────────────────────────────
def register_livestream_events(socketio):
    @socketio.on('live_join')
    def on_live_join(data):
        from flask_socketio import join_room, emit
        stream_id = data.get('stream_id')
        if stream_id:
            join_room(f'live_{stream_id}')
            stream = LiveStream.query.filter_by(id=stream_id, is_live=True).first()
            if stream:
                emit('live_viewer_count', {'count': stream.viewer_count}, room=f'live_{stream_id}')

    @socketio.on('live_leave')
    def on_live_leave(data):
        from flask_socketio import leave_room
        stream_id = data.get('stream_id')
        if stream_id:
            leave_room(f'live_{stream_id}')

    @socketio.on('live_chat_send')
    def on_live_chat(data):
        from flask_socketio import emit
        stream_id = data.get('stream_id')
        msg = data.get('message', {})
        if stream_id and msg:
            emit('live_chat_message', msg, room=f'live_{stream_id}')

    @socketio.on('live_reaction')
    def on_live_reaction(data):
        from flask_socketio import emit
        stream_id = data.get('stream_id')
        if stream_id:
            emit('live_reaction', data, room=f'live_{stream_id}')
