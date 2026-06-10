"""
Scheduled Messages — write a message now, deliver it at a future time.
Full CRUD + background dispatcher thread.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Message, MessageStatus
from datetime import datetime
import uuid, threading, time
import logging

logger = logging.getLogger(__name__)
scheduled_bp = Blueprint('scheduled', __name__, url_prefix='/api/messages')

# ── Model ──────────────────────────────────────────────────────────────────────
from sqlalchemy import Column, String, Text, DateTime, Boolean, ForeignKey

class ScheduledMessage(db.Model):
    __tablename__ = 'scheduled_messages'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    receiver_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    content = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    media_type = Column(String(50), nullable=True)
    scheduled_at = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    status = Column(String(20), default='pending')  # pending | sent | cancelled | failed
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        try:
            receiver = User.query.get(self.receiver_id)
            receiver_name = receiver.full_name if receiver else 'Unknown'
            receiver_avatar = receiver.avatar_url if receiver else None
        except Exception:
            receiver_name = 'Unknown'
            receiver_avatar = None
        return {
            'id': self.id,
            'receiver_id': self.receiver_id,
            'receiver_name': receiver_name,
            'receiver_avatar': receiver_avatar,
            'content': self.content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'scheduled_at': self.scheduled_at.isoformat() if self.scheduled_at else None,
            'sent_at': self.sent_at.isoformat() if self.sent_at else None,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


# ── Endpoints ──────────────────────────────────────────────────────────────────
@scheduled_bp.route('/schedule', methods=['POST'])
@jwt_required()
def create_scheduled():
    try:
        sender_id = get_jwt_identity()
        data = request.json or {}
        receiver_id = data.get('receiver_id', '').strip()
        content = (data.get('content') or '').strip() or None
        media_url = data.get('media_url')
        media_type = data.get('media_type')
        scheduled_at_str = data.get('scheduled_at', '').strip()

        if not receiver_id:
            return jsonify({'error': 'receiver_id required'}), 400
        if not content and not media_url:
            return jsonify({'error': 'content or media_url required'}), 400
        if not scheduled_at_str:
            return jsonify({'error': 'scheduled_at required (ISO 8601)'}), 400

        try:
            scheduled_at = datetime.fromisoformat(scheduled_at_str.replace('Z', '+00:00'))
            # Strip timezone for naive comparison
            if scheduled_at.tzinfo is not None:
                import pytz
                scheduled_at = scheduled_at.replace(tzinfo=None) - scheduled_at.utcoffset()
        except ValueError:
            return jsonify({'error': 'Invalid scheduled_at format. Use ISO 8601.'}), 400

        if scheduled_at <= datetime.utcnow():
            return jsonify({'error': 'Scheduled time must be in the future'}), 400

        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({'error': 'Receiver not found'}), 404

        msg = ScheduledMessage(
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            media_url=media_url,
            media_type=media_type,
            scheduled_at=scheduled_at,
        )
        db.session.add(msg)
        db.session.commit()
        return jsonify({'scheduled': msg.to_dict(), 'message': 'Message scheduled!'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@scheduled_bp.route('/scheduled', methods=['GET'])
@jwt_required()
def list_scheduled():
    try:
        sender_id = get_jwt_identity()
        status_filter = request.args.get('status', 'pending')
        q = ScheduledMessage.query.filter_by(sender_id=sender_id)
        if status_filter != 'all':
            q = q.filter_by(status=status_filter)
        msgs = q.order_by(ScheduledMessage.scheduled_at.asc()).limit(100).all()
        return jsonify({'scheduled': [m.to_dict() for m in msgs]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@scheduled_bp.route('/scheduled/<msg_id>', methods=['DELETE'])
@jwt_required()
def cancel_scheduled(msg_id):
    try:
        sender_id = get_jwt_identity()
        msg = ScheduledMessage.query.filter_by(id=msg_id, sender_id=sender_id).first()
        if not msg:
            return jsonify({'error': 'Not found'}), 404
        if msg.status != 'pending':
            return jsonify({'error': f'Cannot cancel a {msg.status} message'}), 400
        msg.status = 'cancelled'
        db.session.commit()
        return jsonify({'ok': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@scheduled_bp.route('/scheduled/<msg_id>', methods=['PUT'])
@jwt_required()
def edit_scheduled(msg_id):
    try:
        sender_id = get_jwt_identity()
        msg = ScheduledMessage.query.filter_by(id=msg_id, sender_id=sender_id).first()
        if not msg:
            return jsonify({'error': 'Not found'}), 404
        if msg.status != 'pending':
            return jsonify({'error': f'Cannot edit a {msg.status} message'}), 400
        data = request.json or {}
        if 'content' in data:
            msg.content = (data['content'] or '').strip() or None
        if 'scheduled_at' in data:
            try:
                new_time = datetime.fromisoformat(data['scheduled_at'].replace('Z', '+00:00'))
                if new_time.tzinfo is not None:
                    new_time = new_time.replace(tzinfo=None) - new_time.utcoffset()
                if new_time <= datetime.utcnow():
                    return jsonify({'error': 'New time must be in the future'}), 400
                msg.scheduled_at = new_time
            except ValueError:
                return jsonify({'error': 'Invalid scheduled_at format'}), 400
        db.session.commit()
        return jsonify({'scheduled': msg.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Background dispatcher ──────────────────────────────────────────────────────
_dispatcher_started = False

def _dispatch_scheduled_messages(app):
    """Background thread: fires scheduled messages when their time arrives."""
    with app.app_context():
        while True:
            try:
                now = datetime.utcnow()
                pending = ScheduledMessage.query.filter(
                    ScheduledMessage.status == 'pending',
                    ScheduledMessage.scheduled_at <= now,
                ).all()
                for sched in pending:
                    try:
                        msg = Message()
                        msg.sender_id = sched.sender_id
                        msg.receiver_id = sched.receiver_id
                        msg.content = sched.content
                        msg.media_url = sched.media_url
                        msg.media_type = sched.media_type
                        msg.status = MessageStatus.SENT
                        db.session.add(msg)
                        sched.status = 'sent'
                        sched.sent_at = datetime.utcnow()
                        db.session.commit()
                        # Push notification
                        try:
                            from app.utils.push_sender import push_to_user
                            sender = User.query.get(sched.sender_id)
                            name = sender.full_name if sender else 'Someone'
                            preview = (sched.content[:60] + '…') if sched.content and len(sched.content) > 60 else (sched.content or '[attachment]')
                            push_to_user(sched.receiver_id, name, preview, url=f'/chat/{sched.sender_id}', extra={
                                'type': 'message', 'sender_id': str(sched.sender_id), 'chat_id': str(sched.sender_id),
                            })
                        except Exception:
                            pass
                        logger.info(f"[Scheduler] Dispatched scheduled message {sched.id}")
                    except Exception as e:
                        db.session.rollback()
                        sched.status = 'failed'
                        try:
                            db.session.commit()
                        except Exception:
                            db.session.rollback()
                        logger.error(f"[Scheduler] Failed to dispatch {sched.id}: {e}")
            except Exception as e:
                logger.error(f"[Scheduler] Dispatcher error: {e}")
            time.sleep(30)


def start_scheduler(app):
    global _dispatcher_started
    if _dispatcher_started:
        return
    _dispatcher_started = True
    t = threading.Thread(target=_dispatch_scheduled_messages, args=(app,), daemon=True)
    t.start()
    logger.info("[Scheduler] Background message dispatcher started")
