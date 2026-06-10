"""System Notifications — VipChat admin broadcasts + per-user in-app alerts."""
import logging
import uuid
from datetime import datetime

from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship

from app.models.models import db, User

logger = logging.getLogger(__name__)
sysnotif_bp = Blueprint('sysnotif', __name__, url_prefix='/api/notifications/system')


# ── Models ────────────────────────────────────────────────────────────────────

class SystemNotification(db.Model):
    __tablename__ = 'system_notifications'
    __table_args__ = {'extend_existing': True}

    id             = Column(String(36),  primary_key=True, default=lambda: str(uuid.uuid4()))
    title          = Column(String(255), nullable=False)
    body           = Column(Text,        nullable=False)
    icon           = Column(String(10),  default='📢')
    target         = Column(String(20),  default='all')          # 'all' | 'user'
    target_user_id = Column(String(36),  ForeignKey('users.id'), nullable=True)
    action_url     = Column(String(500), nullable=True)
    created_at     = Column(DateTime,    default=datetime.utcnow)

    reads = relationship('SystemNotificationRead', backref='notification',
                         cascade='all, delete-orphan', lazy='dynamic')

    def to_dict(self, user_id=None):
        read = False
        if user_id:
            read = self.reads.filter_by(user_id=user_id).first() is not None
        return {
            'id':         self.id,
            'title':      self.title,
            'body':       self.body,
            'icon':       self.icon,
            'action_url': self.action_url,
            'created_at': self.created_at.isoformat(),
            'read':       read,
        }


class SystemNotificationRead(db.Model):
    __tablename__ = 'system_notification_reads'
    __table_args__ = {'extend_existing': True}

    id              = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    notification_id = Column(String(36), ForeignKey('system_notifications.id'), nullable=False)
    user_id         = Column(String(36), ForeignKey('users.id'),                nullable=False)
    read_at         = Column(DateTime,   default=datetime.utcnow)


# ── User endpoints ────────────────────────────────────────────────────────────

@sysnotif_bp.route('', methods=['GET'])
@jwt_required()
def list_notifications():
    user_id = get_jwt_identity()
    notifs = SystemNotification.query.filter(
        db.or_(
            SystemNotification.target == 'all',
            SystemNotification.target_user_id == user_id,
        )
    ).order_by(SystemNotification.created_at.desc()).limit(30).all()
    return jsonify([n.to_dict(user_id=user_id) for n in notifs])


@sysnotif_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    user_id = get_jwt_identity()
    visible = SystemNotification.query.filter(
        db.or_(
            SystemNotification.target == 'all',
            SystemNotification.target_user_id == user_id,
        )
    ).count()
    read_count = SystemNotificationRead.query.filter_by(user_id=user_id).count()
    return jsonify({'unread': max(0, visible - read_count)})


@sysnotif_bp.route('/<notif_id>/read', methods=['POST'])
@jwt_required()
def mark_read(notif_id):
    user_id = get_jwt_identity()
    if not SystemNotificationRead.query.filter_by(
        notification_id=notif_id, user_id=user_id
    ).first():
        db.session.add(SystemNotificationRead(notification_id=notif_id, user_id=user_id))
        db.session.commit()
    return jsonify({'ok': True})


@sysnotif_bp.route('/read-all', methods=['POST'])
@jwt_required()
def mark_all_read():
    user_id = get_jwt_identity()
    notifs = SystemNotification.query.filter(
        db.or_(
            SystemNotification.target == 'all',
            SystemNotification.target_user_id == user_id,
        )
    ).all()
    for n in notifs:
        if not SystemNotificationRead.query.filter_by(
            notification_id=n.id, user_id=user_id
        ).first():
            db.session.add(SystemNotificationRead(notification_id=n.id, user_id=user_id))
    db.session.commit()
    return jsonify({'ok': True})


# ── Admin endpoint ────────────────────────────────────────────────────────────

@sysnotif_bp.route('/admin/broadcast', methods=['POST'])
@jwt_required()
def admin_broadcast():
    caller_id = get_jwt_identity()
    caller = User.query.get(caller_id)
    if not caller or not getattr(caller, 'is_admin', False):
        return jsonify({'error': 'Admin access required'}), 403

    data           = request.json or {}
    title          = data.get('title', '').strip()
    body           = data.get('body', '').strip()
    icon           = data.get('icon', '📢')
    target         = data.get('target', 'all')          # all | user
    target_user_id = data.get('target_user_id')
    action_url     = data.get('action_url')

    if not title or not body:
        return jsonify({'error': 'title and body are required'}), 400

    notif = SystemNotification(
        title=title, body=body, icon=icon, target=target,
        target_user_id=target_user_id if target == 'user' else None,
        action_url=action_url,
    )
    db.session.add(notif)
    db.session.commit()

    # Push-notify recipients
    try:
        from app.utils.push_sender import push_to_user
        if target == 'user' and target_user_id:
            push_to_user(target_user_id, f'{icon} {title}', body, url=action_url or '/')
        else:
            for u in User.query.filter_by(is_banned=False).all():
                push_to_user(u.id, f'{icon} {title}', body, url=action_url or '/')
    except Exception as exc:
        logger.warning('Broadcast push error: %s', exc)

    return jsonify({'ok': True, 'id': notif.id})
