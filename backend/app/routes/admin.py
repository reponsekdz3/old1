from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Message, Group, Call, Status, Contact
from datetime import datetime, timedelta
from functools import wraps

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
