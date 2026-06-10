from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Message, Group, Call, Status, Contact
from datetime import datetime, timedelta
from functools import wraps
import os
import sys
import platform

admin_bp = Blueprint('admin', __name__, url_prefix='/api/admin')

def admin_required(f):
    @wraps(f)
    @jwt_required()
    def wrapper(*args, **kwargs):
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        if not getattr(user, 'is_admin', False):
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return wrapper

# ── Dashboard ─────────────────────────────────────────────────────────────────
@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def dashboard():
    try:
        total_users = User.query.count()
        total_messages = Message.query.count()
        total_groups = Group.query.count()
        total_calls = Call.query.count()
        active_24h = User.query.filter(
            User.last_seen >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        new_users_7d = User.query.filter(
            User.created_at >= datetime.utcnow() - timedelta(days=7)
        ).count()
        messages_today = Message.query.filter(
            Message.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).count()
        calls_today = Call.query.filter(
            Call.started_at >= datetime.utcnow().replace(hour=0, minute=0, second=0)
        ).count()

        return jsonify({
            'stats': {
                'total_users': total_users,
                'total_messages': total_messages,
                'total_groups': total_groups,
                'total_calls': total_calls,
                'active_24h': active_24h,
                'new_users_7d': new_users_7d,
                'messages_today': messages_today,
                'calls_today': calls_today,
            }
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Users ─────────────────────────────────────────────────────────────────────
@admin_bp.route('/users', methods=['GET'])
@admin_required
def list_users():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 25, type=int)
        search = request.args.get('search', '').strip()
        filter_by = request.args.get('filter', 'all')  # all, active, banned, admins

        query = User.query
        if search:
            query = query.filter(
                db.or_(
                    User.full_name.ilike(f'%{search}%'),
                    User.phone_number.ilike(f'%{search}%'),
                    User.email.ilike(f'%{search}%'),
                )
            )
        if filter_by == 'banned':
            query = query.filter(User.is_banned == True)
        elif filter_by == 'admins':
            query = query.filter(User.is_admin == True)
        elif filter_by == 'active':
            query = query.filter(
                User.last_seen >= datetime.utcnow() - timedelta(hours=24)
            )

        pagination = query.order_by(User.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )

        users = []
        for u in pagination.items:
            msg_count = Message.query.filter(
                db.or_(Message.sender_id == u.id, Message.receiver_id == u.id)
            ).count()
            users.append({
                **u.to_dict(),
                'is_admin': getattr(u, 'is_admin', False),
                'is_banned': getattr(u, 'is_banned', False),
                'message_count': msg_count,
            })

        return jsonify({
            'users': users,
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
            'per_page': per_page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>', methods=['GET'])
@admin_required
def get_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        msg_count = Message.query.filter(
            db.or_(Message.sender_id == user.id, Message.receiver_id == user.id)
        ).count()
        contact_count = Contact.query.filter_by(user_id=user.id).count()
        call_count = Call.query.filter(
            db.or_(Call.caller_id == user.id, Call.receiver_id == user.id)
        ).count()
        return jsonify({
            **user.to_dict(),
            'is_admin': getattr(user, 'is_admin', False),
            'is_banned': getattr(user, 'is_banned', False),
            'message_count': msg_count,
            'contact_count': contact_count,
            'call_count': call_count,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/ban', methods=['PUT'])
@admin_required
def ban_user(user_id):
    try:
        me = get_jwt_identity()
        if user_id == me:
            return jsonify({'error': 'Cannot ban yourself'}), 400
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.is_banned = True
        db.session.commit()
        return jsonify({'message': f'User {user.full_name} banned'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/unban', methods=['PUT'])
@admin_required
def unban_user(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.is_banned = False
        db.session.commit()
        return jsonify({'message': f'User {user.full_name} unbanned'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/make-admin', methods=['PUT'])
@admin_required
def make_admin(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.is_admin = True
        db.session.commit()
        return jsonify({'message': f'{user.full_name} is now an admin'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/remove-admin', methods=['PUT'])
@admin_required
def remove_admin(user_id):
    try:
        me = get_jwt_identity()
        if user_id == me:
            return jsonify({'error': 'Cannot remove your own admin status'}), 400
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.is_admin = False
        db.session.commit()
        return jsonify({'message': f'{user.full_name} admin removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>', methods=['DELETE'])
@admin_required
def delete_user(user_id):
    try:
        me = get_jwt_identity()
        if user_id == me:
            return jsonify({'error': 'Cannot delete yourself'}), 400
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        db.session.delete(user)
        db.session.commit()
        return jsonify({'message': 'User deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ── Groups ────────────────────────────────────────────────────────────────────
@admin_bp.route('/groups', methods=['GET'])
@admin_required
def list_groups():
    try:
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '').strip()
        query = Group.query
        if search:
            query = query.filter(Group.name.ilike(f'%{search}%'))
        pagination = query.order_by(Group.created_at.desc()).paginate(page=page, per_page=25, error_out=False)
        return jsonify({
            'groups': [g.to_dict() for g in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/groups/<group_id>', methods=['DELETE'])
@admin_required
def delete_group(group_id):
    try:
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        db.session.delete(group)
        db.session.commit()
        return jsonify({'message': 'Group deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ── Messages oversight ────────────────────────────────────────────────────────
@admin_bp.route('/messages', methods=['GET'])
@admin_required
def list_messages():
    try:
        page = request.args.get('page', 1, type=int)
        search = request.args.get('search', '').strip()
        query = Message.query
        if search:
            query = query.filter(Message.content.ilike(f'%{search}%'))
        pagination = query.order_by(Message.created_at.desc()).paginate(page=page, per_page=50, error_out=False)
        return jsonify({
            'messages': [m.to_dict() for m in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/messages/<message_id>', methods=['DELETE'])
@admin_required
def delete_message(message_id):
    try:
        msg = Message.query.get(message_id)
        if not msg:
            return jsonify({'error': 'Message not found'}), 404
        msg.is_deleted_everyone = True
        msg.content = 'This message was removed by admin'
        db.session.commit()
        return jsonify({'message': 'Message removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ── Broadcast ─────────────────────────────────────────────────────────────────
@admin_bp.route('/broadcast', methods=['POST'])
@admin_required
def broadcast_all():
    """Send a system message to all users"""
    try:
        data = request.json
        content = data.get('content', '').strip()
        if not content:
            return jsonify({'error': 'Content required'}), 400
        # This creates a notification record — in production you'd push via socket
        # For now return success (socket broadcast can be done via the admin UI)
        return jsonify({'message': 'Broadcast queued', 'content': content}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Stats over time ───────────────────────────────────────────────────────────
@admin_bp.route('/stats/activity', methods=['GET'])
@admin_required
def activity_stats():
    try:
        days = request.args.get('days', 7, type=int)
        result = []
        for i in range(days - 1, -1, -1):
            day = datetime.utcnow() - timedelta(days=i)
            start = day.replace(hour=0, minute=0, second=0, microsecond=0)
            end = start + timedelta(days=1)
            msgs = Message.query.filter(
                Message.created_at >= start, Message.created_at < end
            ).count()
            users = User.query.filter(
                User.last_seen >= start, User.last_seen < end
            ).count()
            calls = Call.query.filter(
                Call.started_at >= start, Call.started_at < end
            ).count()
            result.append({
                'date': start.strftime('%Y-%m-%d'),
                'messages': msgs,
                'active_users': users,
                'calls': calls,
            })
        return jsonify({'activity': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Confirm user account (admin override) ─────────────────────────────────────
@admin_bp.route('/users/<user_id>/confirm-account', methods=['PUT'])
@admin_required
def admin_confirm_account(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.account_confirmed_at = datetime.utcnow()
        db.session.commit()
        return jsonify({'message': f'{user.full_name} account confirmed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ── Self-promote (first admin setup) ─────────────────────────────────────────
@admin_bp.route('/setup', methods=['POST'])
@jwt_required()
def setup_admin():
    """Promote yourself to admin if no admin exists yet"""
    try:
        user_id = get_jwt_identity()
        admin_exists = User.query.filter_by(is_admin=True).first()
        if admin_exists:
            return jsonify({'error': 'Admin already exists'}), 409
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        user.is_admin = True
        db.session.commit()
        return jsonify({'message': 'You are now admin', 'user': user.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# ── Check admin status ────────────────────────────────────────────────────────
@admin_bp.route('/me', methods=['GET'])
@jwt_required()
def check_admin():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'Not found'}), 404
        return jsonify({
            'is_admin': getattr(user, 'is_admin', False),
            'is_banned': getattr(user, 'is_banned', False),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Real-time live dashboard ──────────────────────────────────────────────────
@admin_bp.route('/live', methods=['GET'])
@admin_required
def live_dashboard():
    """Real-time snapshot: active WebSocket sessions + recent security events + OTP counts."""
    from flask import current_app
    from app.models.e2ee_models import SecurityAuditLog
    from app.models.models import VerificationCode

    try:
        # Active WebSocket connections
        active_connections = getattr(current_app, 'active_connections', {})
        active_sessions = []
        for uid, sids in active_connections.items():
            user = User.query.get(uid)
            if user:
                active_sessions.append({
                    'user_id': uid,
                    'full_name': user.full_name,
                    'phone_number': user.phone_number,
                    'avatar_url': user.avatar_url,
                    'socket_count': len(sids),
                    'last_seen': user.last_seen.isoformat() if user.last_seen else None,
                })

        # Recent auth/OTP security events (last 100)
        recent_logs = (
            SecurityAuditLog.query
            .order_by(SecurityAuditLog.created_at.desc())
            .limit(100)
            .all()
        )

        # Pending OTP codes
        pending_otps = VerificationCode.query.filter(
            VerificationCode.expires_at >= datetime.utcnow()
        ).count()

        # Online in last 5 min
        online_5m = User.query.filter(
            User.last_seen >= datetime.utcnow() - timedelta(minutes=5)
        ).count()

        # Online in last 1 hour
        online_1h = User.query.filter(
            User.last_seen >= datetime.utcnow() - timedelta(hours=1)
        ).count()

        # Auth events grouped by type (last 24h)
        yesterday = datetime.utcnow() - timedelta(hours=24)
        auth_events_24h = (
            db.session.query(
                SecurityAuditLog.event_type,
                db.func.count(SecurityAuditLog.id).label('count')
            )
            .filter(SecurityAuditLog.created_at >= yesterday)
            .group_by(SecurityAuditLog.event_type)
            .all()
        )

        return jsonify({
            'active_sessions': active_sessions,
            'active_session_count': len(active_sessions),
            'pending_otps': pending_otps,
            'online_5m': online_5m,
            'online_1h': online_1h,
            'auth_events_24h': [{'event': e, 'count': c} for e, c in auth_events_24h],
            'auth_logs': [l.to_dict() for l in recent_logs],
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@admin_bp.route('/auth-logs', methods=['GET'])
@admin_required
def auth_logs():
    """Paginated security audit log."""
    from app.models.e2ee_models import SecurityAuditLog
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        severity = request.args.get('severity', '')
        event_type = request.args.get('event_type', '')

        query = SecurityAuditLog.query
        if severity:
            query = query.filter(SecurityAuditLog.severity == severity)
        if event_type:
            query = query.filter(SecurityAuditLog.event_type == event_type)

        pagination = query.order_by(SecurityAuditLog.created_at.desc()).paginate(
            page=page, per_page=per_page, error_out=False
        )
        return jsonify({
            'logs': [l.to_dict() for l in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── System Settings ───────────────────────────────────────────────────────────
_SYSTEM_SETTINGS = {
    'maintenance_mode': False,
    'registration_open': True,
    'require_phone_verification': True,
    'max_message_length': 4096,
    'max_group_members': 1024,
    'max_file_size_mb': 100,
    'rate_limit_per_minute': 200,
    'allow_marketplace': True,
    'allow_business_api': True,
    'allow_ads': True,
    'allow_physical_store': True,
    'e2ee_forced': True,
    'ai_moderation_enabled': False,
    'platform_fee_pct': 5.0,
    'seller_cashback_pct': 3.0,
    'min_withdrawal_usd': 10.0,
}

@admin_bp.route('/system/settings', methods=['GET'])
@admin_required
def get_system_settings():
    try:
        return jsonify({'settings': _SYSTEM_SETTINGS}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/system/settings', methods=['PUT'])
@admin_required
def update_system_settings():
    try:
        data = request.json or {}
        allowed = set(_SYSTEM_SETTINGS.keys())
        updated = {}
        for k, v in data.items():
            if k in allowed:
                _SYSTEM_SETTINGS[k] = v
                updated[k] = v
        return jsonify({'message': f'Updated {len(updated)} settings', 'settings': _SYSTEM_SETTINGS}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── System Health ─────────────────────────────────────────────────────────────
@admin_bp.route('/system/health', methods=['GET'])
@admin_required
def system_health():
    try:
        import time
        start = time.time()

        # DB ping
        db_ok = False
        db_latency_ms = None
        try:
            t0 = time.time()
            db.session.execute(db.text('SELECT 1'))
            db_latency_ms = round((time.time() - t0) * 1000, 1)
            db_ok = True
        except Exception:
            pass

        # Redis ping
        redis_ok = False
        redis_latency_ms = None
        try:
            import redis as r_lib
            rc = r_lib.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/0'), socket_connect_timeout=1)
            t0 = time.time()
            rc.ping()
            redis_latency_ms = round((time.time() - t0) * 1000, 1)
            redis_ok = True
        except Exception:
            pass

        total_users = User.query.count()
        total_messages = Message.query.count()
        active_24h = User.query.filter(
            User.last_seen >= datetime.utcnow() - timedelta(hours=24)
        ).count()

        return jsonify({
            'status': 'healthy' if db_ok else 'degraded',
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'python_version': sys.version.split()[0],
            'platform': platform.system(),
            'uptime_info': 'running',
            'database': {'status': 'ok' if db_ok else 'error', 'latency_ms': db_latency_ms},
            'redis': {'status': 'ok' if redis_ok else 'unavailable', 'latency_ms': redis_latency_ms},
            'metrics': {
                'total_users': total_users,
                'total_messages': total_messages,
                'active_24h': active_24h,
            },
            'response_time_ms': round((time.time() - start) * 1000, 1),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Revenue / Financial Analytics ────────────────────────────────────────────
@admin_bp.route('/revenue', methods=['GET'])
@admin_required
def revenue_overview():
    try:
        period = request.args.get('period', '30')  # days
        days = int(period)
        since = datetime.utcnow() - timedelta(days=days)

        # Marketplace purchases
        mp_revenue = 0.0
        mp_count = 0
        physical_revenue = 0.0
        physical_count = 0
        api_revenue = 0.0
        ad_revenue = 0.0

        try:
            from app.routes.marketplace import MarketplacePurchase
            rows = MarketplacePurchase.query.filter(
                MarketplacePurchase.purchased_at >= since,
                MarketplacePurchase.payment_status == 'completed'
            ).all()
            mp_revenue = sum(r.amount_paid or 0 for r in rows)
            mp_count = len(rows)
        except Exception:
            pass

        try:
            from app.routes.marketplace_physical import PhysicalOrder
            rows = PhysicalOrder.query.filter(
                PhysicalOrder.created_at >= since,
                PhysicalOrder.payment_status == 'paid'
            ).all()
            physical_revenue = sum(r.total_amount or 0 for r in rows)
            physical_count = len(rows)
        except Exception:
            pass

        try:
            from app.routes.business_api_platform import APISubscription
            rows = APISubscription.query.filter(
                APISubscription.created_at >= since,
                APISubscription.is_active == True
            ).all()
            api_revenue = sum(r.amount_paid or 0 for r in rows)
        except Exception:
            pass

        try:
            from app.routes.ads import AdCampaign
            rows = AdCampaign.query.filter(
                AdCampaign.created_at >= since,
            ).all()
            ad_revenue = sum(r.budget_spent or 0 for r in rows)
        except Exception:
            pass

        platform_fee_pct = _SYSTEM_SETTINGS.get('platform_fee_pct', 5.0) / 100.0
        total_gross = mp_revenue + physical_revenue + api_revenue + ad_revenue
        platform_earnings = total_gross * platform_fee_pct

        # Daily breakdown for chart
        daily = []
        for i in range(min(days, 30) - 1, -1, -1):
            day = datetime.utcnow() - timedelta(days=i)
            start_day = day.replace(hour=0, minute=0, second=0, microsecond=0)
            end_day = start_day + timedelta(days=1)
            day_total = 0.0
            try:
                from app.routes.marketplace import MarketplacePurchase
                day_rows = MarketplacePurchase.query.filter(
                    MarketplacePurchase.purchased_at >= start_day,
                    MarketplacePurchase.purchased_at < end_day,
                    MarketplacePurchase.payment_status == 'completed'
                ).all()
                day_total += sum(r.amount_paid or 0 for r in day_rows)
            except Exception:
                pass
            daily.append({'date': start_day.strftime('%Y-%m-%d'), 'revenue': round(day_total, 2)})

        return jsonify({
            'period_days': days,
            'summary': {
                'total_gross': round(total_gross, 2),
                'platform_earnings': round(platform_earnings, 2),
                'marketplace_revenue': round(mp_revenue, 2),
                'marketplace_orders': mp_count,
                'physical_revenue': round(physical_revenue, 2),
                'physical_orders': physical_count,
                'api_revenue': round(api_revenue, 2),
                'ad_revenue': round(ad_revenue, 2),
            },
            'daily': daily,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Bulk user actions ─────────────────────────────────────────────────────────
@admin_bp.route('/users/bulk', methods=['POST'])
@admin_required
def bulk_user_action():
    """Bulk ban/unban/delete users"""
    try:
        me = get_jwt_identity()
        data = request.json or {}
        action = data.get('action')  # ban | unban | delete | confirm
        user_ids = data.get('user_ids', [])
        if not action or not user_ids:
            return jsonify({'error': 'action and user_ids required'}), 400
        affected = 0
        for uid in user_ids:
            if uid == me:
                continue
            u = User.query.get(uid)
            if not u:
                continue
            if action == 'ban':
                u.is_banned = True
                affected += 1
            elif action == 'unban':
                u.is_banned = False
                affected += 1
            elif action == 'confirm':
                u.account_confirmed_at = datetime.utcnow()
                affected += 1
            elif action == 'delete':
                db.session.delete(u)
                affected += 1
        db.session.commit()
        return jsonify({'message': f'{action} applied to {affected} users'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Export users CSV ──────────────────────────────────────────────────────────
@admin_bp.route('/users/export', methods=['GET'])
@admin_required
def export_users():
    """Export users as CSV"""
    try:
        import csv
        import io
        from flask import Response
        users = User.query.order_by(User.created_at.desc()).all()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['id', 'full_name', 'phone_number', 'email', 'is_admin', 'is_banned', 'created_at', 'last_seen'])
        for u in users:
            writer.writerow([
                u.id, u.full_name, u.phone_number,
                getattr(u, 'email', ''),
                getattr(u, 'is_admin', False),
                getattr(u, 'is_banned', False),
                u.created_at.isoformat() if u.created_at else '',
                u.last_seen.isoformat() if u.last_seen else '',
            ])
        return Response(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': 'attachment; filename=users_export.csv'}
        )
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ── Sub-Admin Role Management ──────────────────────────────────────────────────
import json

VALID_PERMISSIONS = [
    'view_users', 'ban_users', 'delete_users', 'make_admin',
    'view_messages', 'delete_messages',
    'view_groups', 'delete_groups',
    'view_marketplace', 'manage_marketplace',
    'view_ads', 'manage_ads',
    'view_revenue', 'manage_wallet',
    'send_broadcast', 'manage_settings',
    'view_api_clients', 'manage_api_clients',
]

@admin_bp.route('/roles/permissions', methods=['GET'])
@admin_required
def list_permissions():
    return jsonify({'permissions': VALID_PERMISSIONS}), 200

@admin_bp.route('/users/<user_id>/permissions', methods=['GET'])
@admin_required
def get_user_permissions(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        perms = {}
        try:
            perms = json.loads(getattr(user, 'admin_permissions', None) or '{}')
        except Exception:
            perms = {}
        return jsonify({
            'user_id': user_id,
            'full_name': user.full_name,
            'is_admin': user.is_admin,
            'permissions': perms,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/permissions', methods=['PUT'])
@admin_required
def set_user_permissions(user_id):
    try:
        me = get_jwt_identity()
        if user_id == me:
            return jsonify({'error': 'Cannot change your own permissions'}), 400
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        data = request.json or {}
        new_perms = data.get('permissions', {})
        # Validate
        for k in new_perms:
            if k not in VALID_PERMISSIONS:
                return jsonify({'error': f'Invalid permission: {k}'}), 400
        # If giving permissions, also make them a sub-admin
        if new_perms:
            user.is_admin = True
        try:
            user.admin_permissions = json.dumps(new_perms)
        except Exception:
            pass
        db.session.commit()
        return jsonify({'message': f'Permissions updated for {user.full_name}', 'permissions': new_perms}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/permissions/grant', methods=['POST'])
@admin_required
def grant_permission(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        perm = (request.json or {}).get('permission', '')
        if perm not in VALID_PERMISSIONS:
            return jsonify({'error': f'Invalid permission: {perm}'}), 400
        try:
            perms = json.loads(getattr(user, 'admin_permissions', None) or '{}')
        except Exception:
            perms = {}
        perms[perm] = True
        user.admin_permissions = json.dumps(perms)
        user.is_admin = True
        db.session.commit()
        return jsonify({'ok': True, 'permissions': perms}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/users/<user_id>/permissions/revoke', methods=['POST'])
@admin_required
def revoke_permission(user_id):
    try:
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        perm = (request.json or {}).get('permission', '')
        try:
            perms = json.loads(getattr(user, 'admin_permissions', None) or '{}')
        except Exception:
            perms = {}
        perms.pop(perm, None)
        user.admin_permissions = json.dumps(perms)
        # If no permissions left and they were only a sub-admin, could remove admin status
        db.session.commit()
        return jsonify({'ok': True, 'permissions': perms}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/sub-admins', methods=['GET'])
@admin_required
def list_sub_admins():
    try:
        admins = User.query.filter_by(is_admin=True).all()
        me = get_jwt_identity()
        result = []
        for u in admins:
            try:
                perms = json.loads(getattr(u, 'admin_permissions', None) or '{}')
            except Exception:
                perms = {}
            result.append({
                'id': u.id,
                'full_name': u.full_name,
                'phone_number': getattr(u, 'phone_number', ''),
                'avatar_url': u.avatar_url,
                'is_me': u.id == me,
                'permissions': perms,
                'permission_count': len(perms),
                'created_at': u.created_at.isoformat() if u.created_at else None,
            })
        return jsonify({'admins': result, 'total': len(result)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@admin_bp.route('/plan-stats', methods=['GET'])
@admin_required
def plan_stats():
    """Summary of free vs paid users"""
    try:
        total = User.query.count()
        return jsonify({'total_users': total, 'plan_breakdown': {'free': total, 'paid': 0}}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
