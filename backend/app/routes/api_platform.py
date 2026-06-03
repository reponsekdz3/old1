from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, ApiClient, ApiSubscription, ApiUsageLog
from datetime import datetime, timedelta
from functools import wraps
import secrets
import hashlib
import hmac
import json

api_platform_bp = Blueprint('api_platform', __name__, url_prefix='/api/platform')

TIER_LIMITS = {
    'starter': 100,
    'pro': 10000,
    'enterprise': None,
}

TIER_PRICES = {
    'starter': 0,
    'pro': 29,
    'enterprise': 99,
}

STRIPE_PRICE_IDS = {
    'pro': 'price_pro_monthly',
    'enterprise': 'price_enterprise_monthly',
}


def _hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_api_key():
    raw = 'vck_live_' + secrets.token_hex(32)
    return raw, _hash_key(raw)


# ── Register ──────────────────────────────────────────────────────────────────
@api_platform_bp.route('/register', methods=['POST'])
@jwt_required()
def register():
    user_id = get_jwt_identity()
    data = request.json or {}
    business_name = (data.get('business_name') or '').strip()
    if not business_name:
        return jsonify({'error': 'Business name is required'}), 400

    existing = ApiClient.query.filter_by(user_id=user_id).first()
    if existing:
        return jsonify({'error': 'You already have an API client registered'}), 409

    raw_key, key_hash = generate_api_key()
    client = ApiClient(
        user_id=user_id,
        business_name=business_name,
        api_key_hash=key_hash,
        api_key_prefix=raw_key[:16] + '...',
        tier='starter',
        is_active=True,
        webhook_secret=secrets.token_hex(16),
    )
    db.session.add(client)
    db.session.commit()

    return jsonify({
        'message': 'API client registered successfully',
        'client': client.to_dict(),
        'api_key': raw_key,
        'warning': 'Save this API key — it will not be shown again.',
    }), 201


# ── Get my client info ────────────────────────────────────────────────────────
@api_platform_bp.route('/me', methods=['GET'])
@jwt_required()
def get_my_client():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404
    sub = ApiSubscription.query.filter_by(client_id=client.id, status='active').first()
    return jsonify({
        'client': client.to_dict(),
        'subscription': sub.to_dict() if sub else None,
    }), 200


# ── Rotate API key ────────────────────────────────────────────────────────────
@api_platform_bp.route('/rotate-key', methods=['POST'])
@jwt_required()
def rotate_key():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404

    raw_key, key_hash = generate_api_key()
    client.api_key_hash = key_hash
    client.api_key_prefix = raw_key[:16] + '...'
    db.session.commit()

    return jsonify({
        'message': 'API key rotated successfully',
        'api_key': raw_key,
        'warning': 'Save this API key — it will not be shown again.',
    }), 200


# ── Configure webhook ─────────────────────────────────────────────────────────
@api_platform_bp.route('/webhook', methods=['PUT'])
@jwt_required()
def configure_webhook():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404

    data = request.json or {}
    webhook_url = (data.get('webhook_url') or '').strip()
    if webhook_url and not webhook_url.startswith('https://'):
        return jsonify({'error': 'Webhook URL must use HTTPS'}), 400

    client.webhook_url = webhook_url or None
    db.session.commit()

    return jsonify({
        'message': 'Webhook configured',
        'webhook_url': client.webhook_url,
        'webhook_secret': client.webhook_secret,
    }), 200


# ── Usage stats ───────────────────────────────────────────────────────────────
@api_platform_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404

    days = request.args.get('days', 7, type=int)
    since = datetime.utcnow() - timedelta(days=days)

    logs = ApiUsageLog.query.filter(
        ApiUsageLog.client_id == client.id,
        ApiUsageLog.timestamp >= since,
    ).all()

    total_calls = len(logs)
    total_messages = sum(l.message_count for l in logs)
    success_calls = sum(1 for l in logs if l.status_code < 400)
    error_calls = total_calls - success_calls

    daily = {}
    for l in logs:
        day = l.timestamp.strftime('%Y-%m-%d')
        if day not in daily:
            daily[day] = {'calls': 0, 'messages': 0, 'errors': 0}
        daily[day]['calls'] += 1
        daily[day]['messages'] += l.message_count
        if l.status_code >= 400:
            daily[day]['errors'] += 1

    daily_list = [{'date': k, **v} for k, v in sorted(daily.items())]

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0)
    today_msgs = sum(l.message_count for l in logs if l.timestamp >= today_start)
    limit = TIER_LIMITS.get(client.tier)

    return jsonify({
        'total_calls': total_calls,
        'total_messages': total_messages,
        'success_calls': success_calls,
        'error_calls': error_calls,
        'today_messages': today_msgs,
        'daily_limit': limit,
        'tier': client.tier,
        'daily': daily_list,
        'recent_logs': [l.to_dict() for l in sorted(logs, key=lambda x: x.timestamp, reverse=True)[:50]],
    }), 200


# ── Subscribe (Stripe) ────────────────────────────────────────────────────────
@api_platform_bp.route('/subscribe', methods=['POST'])
@jwt_required()
def subscribe():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404

    data = request.json or {}
    tier = data.get('tier', '').lower()
    if tier not in ('pro', 'enterprise'):
        return jsonify({'error': 'Invalid tier. Choose pro or enterprise'}), 400

    stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
    if not stripe_key:
        client.tier = tier
        sub = ApiSubscription(
            client_id=client.id,
            tier=tier,
            status='active',
            current_period_end=datetime.utcnow() + timedelta(days=30),
        )
        db.session.add(sub)
        db.session.commit()
        return jsonify({
            'message': f'Upgraded to {tier} (demo mode — Stripe not configured)',
            'client': client.to_dict(),
        }), 200

    try:
        import stripe
        stripe.api_key = stripe_key
        user = User.query.get(user_id)

        customer = stripe.Customer.create(
            email=getattr(user, 'email', None) or f'{user_id}@vipchat.app',
            name=client.business_name,
            metadata={'client_id': client.id, 'user_id': user_id},
        )

        price_id = STRIPE_PRICE_IDS.get(tier)
        checkout = stripe.checkout.Session.create(
            customer=customer.id,
            mode='subscription',
            line_items=[{'price': price_id, 'quantity': 1}],
            success_url=data.get('success_url', 'https://vipchat.app/api-platform?success=1'),
            cancel_url=data.get('cancel_url', 'https://vipchat.app/api-platform?cancel=1'),
            metadata={'client_id': client.id, 'tier': tier},
        )
        return jsonify({'checkout_url': checkout.url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Stripe webhook ────────────────────────────────────────────────────────────
@api_platform_bp.route('/stripe-webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig = request.headers.get('Stripe-Signature', '')
    secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

    try:
        import stripe
        stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        event = stripe.Webhook.construct_event(payload, sig, secret)
    except Exception:
        return jsonify({'error': 'Invalid signature'}), 400

    if event['type'] in ('customer.subscription.updated', 'customer.subscription.created'):
        sub_data = event['data']['object']
        client_id = sub_data.get('metadata', {}).get('client_id')
        tier = sub_data.get('metadata', {}).get('tier', 'pro')
        status = sub_data.get('status', 'active')
        if client_id:
            client = ApiClient.query.get(client_id)
            if client:
                client.tier = tier if status == 'active' else 'starter'
                existing = ApiSubscription.query.filter_by(
                    client_id=client_id,
                    stripe_subscription_id=sub_data['id'],
                ).first()
                if existing:
                    existing.status = status
                    period_end = sub_data.get('current_period_end')
                    if period_end:
                        existing.current_period_end = datetime.utcfromtimestamp(period_end)
                else:
                    new_sub = ApiSubscription(
                        client_id=client_id,
                        stripe_subscription_id=sub_data['id'],
                        tier=tier,
                        status=status,
                    )
                    db.session.add(new_sub)
                db.session.commit()

    elif event['type'] == 'customer.subscription.deleted':
        sub_data = event['data']['object']
        client_id = sub_data.get('metadata', {}).get('client_id')
        if client_id:
            client = ApiClient.query.get(client_id)
            if client:
                client.tier = 'starter'
                ApiSubscription.query.filter_by(
                    client_id=client_id,
                    stripe_subscription_id=sub_data['id'],
                ).update({'status': 'canceled'})
                db.session.commit()

    return jsonify({'received': True}), 200


# ── Admin: list all clients ───────────────────────────────────────────────────
@api_platform_bp.route('/admin/clients', methods=['GET'])
@jwt_required()
def admin_list_clients():
    user_id = get_jwt_identity()
    requester = User.query.get(user_id)
    if not requester or not getattr(requester, 'is_admin', False):
        return jsonify({'error': 'Admin access required'}), 403

    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)
    q = request.args.get('search', '').strip()

    query = ApiClient.query
    if q:
        query = query.filter(ApiClient.business_name.ilike(f'%{q}%'))
    paged = query.order_by(ApiClient.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    result = []
    for c in paged.items:
        d = c.to_dict(admin=True)
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0)
        today_msgs = db.session.query(
            db.func.sum(ApiUsageLog.message_count)
        ).filter(
            ApiUsageLog.client_id == c.id,
            ApiUsageLog.timestamp >= today_start,
        ).scalar() or 0
        d['today_messages'] = today_msgs
        d['total_calls'] = ApiUsageLog.query.filter_by(client_id=c.id).count()
        result.append(d)

    return jsonify({
        'clients': result,
        'total': paged.total,
        'pages': paged.pages,
        'page': page,
    }), 200


# ── Admin: suspend/reinstate client ──────────────────────────────────────────
@api_platform_bp.route('/admin/clients/<client_id>/suspend', methods=['PUT'])
@jwt_required()
def admin_suspend_client(client_id):
    user_id = get_jwt_identity()
    requester = User.query.get(user_id)
    if not requester or not getattr(requester, 'is_admin', False):
        return jsonify({'error': 'Admin access required'}), 403

    client = ApiClient.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    client.is_active = False
    db.session.commit()
    return jsonify({'message': 'Client suspended'}), 200


@api_platform_bp.route('/admin/clients/<client_id>/reinstate', methods=['PUT'])
@jwt_required()
def admin_reinstate_client(client_id):
    user_id = get_jwt_identity()
    requester = User.query.get(user_id)
    if not requester or not getattr(requester, 'is_admin', False):
        return jsonify({'error': 'Admin access required'}), 403

    client = ApiClient.query.get(client_id)
    if not client:
        return jsonify({'error': 'Client not found'}), 404

    client.is_active = True
    db.session.commit()
    return jsonify({'message': 'Client reinstated'}), 200


# ── Deliver inbound webhook ───────────────────────────────────────────────────
def deliver_webhook(client: ApiClient, event_type: str, payload: dict):
    if not client.webhook_url or not client.is_active:
        return
    import threading, requests as req_lib
    def _send():
        body = json.dumps({'event': event_type, 'data': payload, 'timestamp': datetime.utcnow().isoformat()})
        sig = hmac.new(client.webhook_secret.encode(), body.encode(), hashlib.sha256).hexdigest() if client.webhook_secret else ''
        headers = {
            'Content-Type': 'application/json',
            'X-VipChat-Signature': f'sha256={sig}',
            'X-VipChat-Event': event_type,
        }
        for attempt in range(3):
            try:
                r = req_lib.post(client.webhook_url, data=body, headers=headers, timeout=5)
                if r.status_code < 500:
                    break
            except Exception:
                pass
    threading.Thread(target=_send, daemon=True).start()
