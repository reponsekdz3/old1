"""
Security audit log endpoints — admin-only access to the security event trail.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from app.models.e2ee_models import SecurityAuditLog
import logging

logger = logging.getLogger(__name__)
security_audit_bp = Blueprint('security_audit', __name__, url_prefix='/api/security')

from app import limiter


def _require_admin():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return None, jsonify({'error': 'Admin access required'}), 403
    return user, None, None


@security_audit_bp.route('/logs', methods=['GET'])
@jwt_required()
@limiter.limit("30 per minute")
def get_audit_logs():
    """Admin: paginated security audit log."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 200)
    severity = request.args.get('severity')
    event_type = request.args.get('event_type')
    target_user = request.args.get('user_id')

    query = SecurityAuditLog.query.order_by(SecurityAuditLog.created_at.desc())
    if severity:
        query = query.filter_by(severity=severity)
    if event_type:
        query = query.filter_by(event_type=event_type)
    if target_user:
        query = query.filter_by(user_id=target_user)

    pag = query.paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'logs': [log.to_dict() for log in pag.items],
        'total': pag.total,
        'pages': pag.pages,
        'page': page,
    }), 200


@security_audit_bp.route('/logs/my', methods=['GET'])
@jwt_required()
def my_audit_logs():
    """User: view own security event history (login, key changes, etc.)."""
    user_id = get_jwt_identity()
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 20, type=int), 100)

    pag = (
        SecurityAuditLog.query
        .filter_by(user_id=user_id)
        .order_by(SecurityAuditLog.created_at.desc())
        .paginate(page=page, per_page=per_page, error_out=False)
    )

    return jsonify({
        'logs': [log.to_dict() for log in pag.items],
        'total': pag.total,
        'pages': pag.pages,
    }), 200


@security_audit_bp.route('/stats', methods=['GET'])
@jwt_required()
def audit_stats():
    """Admin: security event statistics."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    from sqlalchemy import func
    from datetime import datetime, timedelta

    since = datetime.utcnow() - timedelta(days=7)
    stats = (
        db.session.query(SecurityAuditLog.event_type, func.count())
        .filter(SecurityAuditLog.created_at >= since)
        .group_by(SecurityAuditLog.event_type)
        .all()
    )
    critical = SecurityAuditLog.query.filter_by(severity='critical').count()
    warnings = SecurityAuditLog.query.filter_by(severity='warning').count()

    return jsonify({
        'last_7_days': {k: v for k, v in stats},
        'total_critical': critical,
        'total_warnings': warnings,
    }), 200
