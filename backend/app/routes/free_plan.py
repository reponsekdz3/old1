"""
Free Plan Limits — enforces usage caps on free-tier users.
Import `require_plan` and `check_plan_limit` in any route.
"""
from flask import jsonify
from flask_jwt_extended import get_jwt_identity
from app.models.models import db, User
from datetime import datetime, timedelta
from functools import wraps
import logging

logger = logging.getLogger(__name__)

FREE_LIMITS = {
    'messages_per_day': 200,
    'marketplace_products': 3,
    'upload_size_mb': 25,
    'group_size': 50,
    'scheduled_messages': 2,
    'live_streams': False,
    'api_access': False,
    'video_calls_minutes': 10,
    'analytics': False,
}

PRO_PLANS = ('pro', 'basic', 'professional', 'enterprise', 'business')


def _get_user_plan(user_id):
    """Returns the user's plan tier: 'free' or plan name."""
    try:
        from app.models.e2ee_models import SubscriptionPlan
        sub = SubscriptionPlan.query.filter_by(user_id=user_id, status='active').first()
        if sub and sub.plan in PRO_PLANS:
            return sub.plan
    except Exception:
        pass
    return 'free'


def _is_free(user_id):
    return _get_user_plan(user_id) == 'free'


def check_plan_limit(user_id, feature):
    """
    Returns (allowed: bool, reason: str | None)
    """
    if not _is_free(user_id):
        return True, None

    limit = FREE_LIMITS.get(feature)
    if limit is False:
        return False, f'"{feature}" is not available on the Free plan. Upgrade to unlock.'
    if limit is True or limit is None:
        return True, None

    if feature == 'messages_per_day':
        from app.models.models import Message
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        count = Message.query.filter(
            Message.sender_id == user_id,
            Message.created_at >= today_start,
        ).count()
        if count >= limit:
            return False, f'Free plan limit: {limit} messages per day. Upgrade for unlimited messaging.'

    if feature == 'marketplace_products':
        try:
            from app.routes.marketplace import MarketplaceProduct
            count = MarketplaceProduct.query.filter_by(seller_id=user_id, is_active=True).count()
            if count >= limit:
                return False, f'Free plan limit: {limit} active products. Upgrade to list more.'
        except Exception:
            pass

    if feature == 'scheduled_messages':
        from app.routes.scheduled_messages import ScheduledMessage
        count = ScheduledMessage.query.filter_by(sender_id=user_id, status='pending').count()
        if count >= limit:
            return False, f'Free plan limit: {limit} pending scheduled messages. Upgrade for more.'

    return True, None


def plan_required(feature):
    """Decorator: blocks a route if free user exceeds the given feature limit."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            try:
                user_id = get_jwt_identity()
                allowed, reason = check_plan_limit(user_id, feature)
                if not allowed:
                    return jsonify({'error': reason, 'upgrade_required': True, 'feature': feature}), 403
            except Exception:
                pass
            return f(*args, **kwargs)
        return wrapper
    return decorator


def get_plan_status(user_id):
    """Returns full plan status dict for the current user."""
    plan = _get_user_plan(user_id)
    is_free = plan == 'free'

    status = {'plan': plan, 'is_free': is_free, 'limits': {}}
    if not is_free:
        status['limits'] = {k: 'unlimited' for k in FREE_LIMITS}
        return status

    for feature, limit in FREE_LIMITS.items():
        if limit is False:
            status['limits'][feature] = {'allowed': False, 'limit': 0}
        elif limit is True:
            status['limits'][feature] = {'allowed': True, 'limit': 'unlimited'}
        else:
            status['limits'][feature] = {'allowed': True, 'limit': limit}

    return status
