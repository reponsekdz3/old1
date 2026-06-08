from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, ApiClient, ApiClientSubscription, ApiUsageLog
from datetime import datetime, timedelta
from functools import wraps
import secrets
import hashlib
import hmac
import json
import bcrypt as _bcrypt
import os

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
    'pro': os.environ.get('STRIPE_PRICE_ID_PRO', 'price_pro_monthly'),
    'enterprise': os.environ.get('STRIPE_PRICE_ID_ENTERPRISE', 'price_enterprise_monthly'),
}


def _bcrypt_hash(raw_key: str) -> str:
    return _bcrypt.hashpw(raw_key.encode(), _bcrypt.gensalt(10)).decode()


def _bcrypt_verify(raw_key: str, stored_hash: str) -> bool:
    try:
        return _bcrypt.checkpw(raw_key.encode(), stored_hash.encode())
    except Exception:
        return False


def generate_api_key():
    raw = 'vck_live_' + secrets.token_hex(32)
    return raw, _bcrypt_hash(raw)


def generate_sandbox_key():
    raw = 'vck_sbx_' + secrets.token_hex(32)
    return raw, _bcrypt_hash(raw)


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
    client = ApiClient()
    client.user_id = user_id
    client.business_name = business_name
    client.api_key_hash = key_hash
    client.api_key_prefix = raw_key[:20] + '...'
    client.tier = 'starter'
    client.is_active = True
    client.webhook_secret = secrets.token_hex(16)
    
    db.session.add(client)
    db.session.commit()

    return jsonify({
        'message': 'API client registered successfully',
        'client': client.to_dict(),
        'api_key': raw_key,
        'warning': 'Save this API key — it will not be shown again.',
    }), 201


# ── Sandbox register (create a sandbox API key for testing) ─────────────────
@api_platform_bp.route('/sandbox/register', methods=['POST'])
@jwt_required()
def sandbox_register():
    user_id = get_jwt_identity()
    data = request.json or {}
    business_name = (data.get('business_name') or 'Sandbox Test Client').strip()

    raw_key, key_hash = generate_sandbox_key()
    client = ApiClient()
    client.user_id = user_id
    client.business_name = business_name + ' (sandbox)'
    client.api_key_hash = key_hash
    client.api_key_prefix = raw_key[:20] + '...'
    client.tier = 'starter'
    client.is_active = True
    client.webhook_secret = secrets.token_hex(16)

    db.session.add(client)
    db.session.commit()

    return jsonify({
        'message': 'Sandbox API client created',
        'client': client.to_dict(),
        'api_key': raw_key,
        'note': 'Sandbox keys start with vck_sbx_ and bypass daily limits (testing only).',
    }), 201


# ── Get my client info ────────────────────────────────────────────────────────
@api_platform_bp.route('/me', methods=['GET'])
@jwt_required()
def get_my_client():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404
    sub = ApiClientSubscription.query.filter_by(client_id=client.id, status='active').first()
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
    client.api_key_prefix = raw_key[:20] + '...'
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
        sub = ApiClientSubscription()
        sub.client_id = client.id
        sub.tier = tier
        sub.status = 'active'
        sub.current_period_end = datetime.utcnow() + timedelta(days=30)
        
        db.session.add(sub)
        db.session.commit()
        return jsonify({
            'message': f'Upgraded to {tier} (demo mode — Stripe not configured)',
            'client': client.to_dict(),
        }), 200

    try:
        import stripe  # type: ignore
        stripe.api_key = stripe_key
        user = User.query.get(user_id)

        customer = stripe.Customer.create(
            email=getattr(user, 'email', None) or f'{user_id}@vipchat.app',
            name=client.business_name,
            metadata={'client_id': client.id, 'user_id': user_id},
        )

        price_id = STRIPE_PRICE_IDS.get(tier) or 'price_default'
        checkout = stripe.checkout.Session.create(
            customer=customer.id,
            mode='subscription',
            line_items=[{'price': str(price_id), 'quantity': 1}],
            success_url=data.get('success_url', 'https://vipchat.app/api-platform?success=1'),
            cancel_url=data.get('cancel_url', 'https://vipchat.app/api-platform?cancel=1'),
            metadata={'client_id': str(client.id), 'tier': tier},
            subscription_data={'metadata': {'client_id': str(client.id), 'tier': tier}},
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
        import stripe  # type: ignore
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
                existing = ApiClientSubscription.query.filter_by(
                    client_id=client_id,
                    stripe_subscription_id=sub_data['id'],
                ).first()
                if existing:
                    existing.status = status
                    period_end = sub_data.get('current_period_end')
                    if period_end:
                        existing.current_period_end = datetime.utcfromtimestamp(period_end)
                else:
                    new_sub = ApiClientSubscription()
                    new_sub.client_id = client_id
                    new_sub.stripe_subscription_id = sub_data['id']
                    new_sub.tier = tier
                    new_sub.status = status
                    
                    db.session.add(new_sub)
                db.session.commit()

    elif event['type'] == 'customer.subscription.deleted':
        sub_data = event['data']['object']
        client_id = sub_data.get('metadata', {}).get('client_id')
        if client_id:
            client = ApiClient.query.get(client_id)
            if client:
                client.tier = 'starter'
                ApiClientSubscription.query.filter_by(
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


# ── Billing portal ────────────────────────────────────────────────────────────
@api_platform_bp.route('/billing', methods=['GET'])
@jwt_required()
def billing_portal():
    user_id = get_jwt_identity()
    client = ApiClient.query.filter_by(user_id=user_id).first()
    if not client:
        return jsonify({'error': 'No API client found'}), 404

    sub = ApiClientSubscription.query.filter_by(client_id=client.id, status='active').order_by(
        ApiClientSubscription.created_at.desc()
    ).first()

    stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
    if not stripe_key or not sub or not sub.stripe_subscription_id:
        return jsonify({
            'tier': client.tier,
            'status': sub.status if sub else 'none',
            'current_period_end': sub.current_period_end.isoformat() if sub and sub.current_period_end else None,
            'portal_url': None,
            'demo_mode': True,
        }), 200

    try:
        import stripe  # type: ignore
        stripe.api_key = stripe_key
        subscription = stripe.Subscription.retrieve(sub.stripe_subscription_id)
        customer_id = subscription.customer if isinstance(subscription.customer, str) else subscription.customer.id  # type: ignore
        portal_session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=request.args.get('return_url', current_app.config.get('FRONTEND_URL', '') + '/api-platform'),
        )
        return jsonify({
            'tier': client.tier,
            'status': sub.status,
            'current_period_end': sub.current_period_end.isoformat() if sub.current_period_end else None,
            'portal_url': portal_session.url,
            'demo_mode': False,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── API docs schema (auto-generated from route metadata) ─────────────────────
@api_platform_bp.route('/docs', methods=['GET'])
def get_api_docs():
    return jsonify({
        'version': '1.0',
        'base_url': '/v1',
        'authentication': {
            'type': 'Bearer',
            'header': 'Authorization',
            'format': 'Bearer vck_live_<key> (or) Bearer vck_sbx_<key> for sandbox',
            'description': 'All /v1/ endpoints require a valid API key in the Authorization header. Sandbox keys (vck_sbx_) are for testing and bypass rate limits.',
        },
        'rate_limits': {
            'starter': {'daily_messages': 100, 'price_usd': 0},
            'pro': {'daily_messages': 10000, 'price_usd': 29},
            'enterprise': {'daily_messages': 'unlimited', 'price_usd': 99},
        },
        'response_headers': {
            'X-RateLimit-Limit': 'Your daily message limit',
            'X-RateLimit-Remaining': 'Messages remaining today',
            'X-RateLimit-Reset': 'Unix timestamp when the limit resets',
        },
        'endpoints': [
            {
                'method': 'POST',
                'path': '/v1/messages/send',
                'title': 'Send Message',
                'description': 'Send a text or media message to a phone number registered on the platform.',
                'request_body': {
                    'to': {'type': 'string', 'required': True, 'description': 'Recipient phone number (E.164 format, e.g. +1234567890)'},
                    'message': {'type': 'string', 'required': False, 'description': 'Text content of the message'},
                    'media_url': {'type': 'string', 'required': False, 'description': 'URL to a media file (image, video, document)'},
                    'media_type': {'type': 'string', 'required': False, 'enum': ['image', 'video', 'document'], 'description': 'Type of media'},
                },
                'response_example': {'success': True, 'message_id': 'uuid', 'to': '+1234567890', 'status': 'sent', 'timestamp': '2026-01-01T00:00:00'},
                'errors': [
                    {'code': 400, 'message': 'to and (message or media_url) required'},
                    {'code': 404, 'message': 'Recipient phone not registered on platform'},
                    {'code': 429, 'message': 'Daily message limit exceeded'},
                ],
                'curl_example': 'curl -X POST https://api.vipchat.app/v1/messages/send \\\n  -H "Authorization: Bearer vck_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"to":"+1234567890","message":"Hello!"}\'',
            },
            {
                'method': 'GET',
                'path': '/v1/messages',
                'title': 'List Messages',
                'description': 'Retrieve sent messages with delivery status, newest first.',
                'query_params': {
                    'limit': {'type': 'integer', 'default': 50, 'max': 200, 'description': 'Number of messages to return'},
                    'offset': {'type': 'integer', 'default': 0, 'description': 'Pagination offset'},
                },
                'response_example': {'messages': [], 'count': 0, 'offset': 0},
                'errors': [],
                'curl_example': 'curl https://api.vipchat.app/v1/messages?limit=20 \\\n  -H "Authorization: Bearer vck_live_..."',
            },
            {
                'method': 'POST',
                'path': '/v1/contacts/import',
                'title': 'Import Contacts',
                'description': 'Bulk-import contacts by phone number to see which are registered on the platform.',
                'request_body': {
                    'contacts': {'type': 'array', 'required': True, 'items': {'phone': 'string'}, 'description': 'Array of objects with a phone field'},
                },
                'response_example': {'imported': 2, 'not_found': 1, 'contacts': [], 'missing': ['+9990000000']},
                'errors': [{'code': 400, 'message': 'contacts array required'}],
                'curl_example': 'curl -X POST https://api.vipchat.app/v1/contacts/import \\\n  -H "Authorization: Bearer vck_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"contacts":[{"phone":"+1234567890"}]}\'',
            },
            {
                'method': 'GET',
                'path': '/v1/contacts',
                'title': 'List Contacts',
                'description': 'List all contacts associated with your API account.',
                'response_example': {'contacts': [], 'count': 0},
                'errors': [],
                'curl_example': 'curl https://api.vipchat.app/v1/contacts \\\n  -H "Authorization: Bearer vck_live_..."',
            },
            {
                'method': 'POST',
                'path': '/v1/groups/create',
                'title': 'Create Group',
                'description': 'Create a messaging group and optionally add members by phone number.',
                'request_body': {
                    'name': {'type': 'string', 'required': True, 'description': 'Group display name'},
                    'description': {'type': 'string', 'required': False, 'description': 'Group description'},
                    'member_phones': {'type': 'array', 'required': False, 'items': 'string', 'description': 'Phone numbers to add on creation'},
                },
                'response_example': {'group_id': 'uuid', 'name': 'My Group', 'member_count': 3, 'members_added': []},
                'errors': [{'code': 400, 'message': 'name required'}],
                'curl_example': 'curl -X POST https://api.vipchat.app/v1/groups/create \\\n  -H "Authorization: Bearer vck_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"name":"Support Team","member_phones":["+1234567890"]}\'',
            },
            {
                'method': 'POST',
                'path': '/v1/broadcasts/send',
                'title': 'Send Broadcast',
                'description': 'Send the same message to up to 1,000 recipients at once.',
                'request_body': {
                    'to': {'type': 'array', 'required': True, 'items': 'string', 'max': 1000, 'description': 'List of recipient phone numbers'},
                    'message': {'type': 'string', 'required': False, 'description': 'Text content (required if no media_url)'},
                    'media_url': {'type': 'string', 'required': False, 'description': 'Media URL (required if no message)'},
                },
                'response_example': {'success': True, 'sent': 98, 'failed': 2, 'failed_phones': []},
                'errors': [
                    {'code': 400, 'message': 'to array and message or media_url required'},
                    {'code': 400, 'message': 'Maximum 1000 recipients per broadcast'},
                    {'code': 429, 'message': 'Daily message limit exceeded'},
                ],
                'curl_example': 'curl -X POST https://api.vipchat.app/v1/broadcasts/send \\\n  -H "Authorization: Bearer vck_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"to":["+1234567890","+0987654321"],"message":"Flash sale now on!"}\'',
            },
            {
                'method': 'GET',
                'path': '/v1/analytics',
                'title': 'Analytics',
                'description': 'Message delivery stats and API usage by endpoint, broken down by day.',
                'query_params': {
                    'days': {'type': 'integer', 'default': 7, 'max': 90, 'description': 'Number of days to look back'},
                },
                'response_example': {'period_days': 7, 'total_calls': 42, 'total_messages': 310, 'daily': [], 'by_endpoint': {}},
                'errors': [],
                'curl_example': 'curl "https://api.vipchat.app/v1/analytics?days=30" \\\n  -H "Authorization: Bearer vck_live_..."',
            },
            {
                'method': 'POST',
                'path': '/v1/webhooks/configure',
                'title': 'Configure Webhook',
                'description': 'Set an HTTPS URL to receive real-time inbound message events from platform users who reply to your messages.',
                'request_body': {
                    'url': {'type': 'string', 'required': True, 'format': 'https://...', 'description': 'Your HTTPS endpoint that will receive POST events'},
                },
                'response_example': {'success': True, 'webhook_url': 'https://yourapp.com/webhook', 'webhook_secret': 'abc123...'},
                'errors': [{'code': 400, 'message': 'URL must use HTTPS'}],
                'curl_example': 'curl -X POST https://api.vipchat.app/v1/webhooks/configure \\\n  -H "Authorization: Bearer vck_live_..." \\\n  -H "Content-Type: application/json" \\\n  -d \'{"url":"https://yourapp.com/webhook"}\'',
            },
            {
                'method': 'GET',
                'path': '/v1/account',
                'title': 'Account Info',
                'description': 'View your API account details, current tier, daily usage, and webhook configuration.',
                'response_example': {
                    'business_name': 'Acme Corp',
                    'tier': 'pro',
                    'daily_limit': 10000,
                    'today_used': 342,
                    'remaining_today': 9658,
                    'webhook_url': 'https://yourapp.com/webhook',
                },
                'errors': [],
                'curl_example': 'curl https://api.vipchat.app/v1/account \\\n  -H "Authorization: Bearer vck_live_..."',
            },
        ],
    }), 200


# ── Promote sandbox client to paid / live (creates subscription or immediate demo upgrade) ─
@api_platform_bp.route('/sandbox/promote', methods=['POST'])
@jwt_required()
def sandbox_promote():
    user_id = get_jwt_identity()
    data = request.json or {}
    tier = (data.get('tier') or '').lower()
    if tier not in ('pro', 'enterprise'):
        return jsonify({'error': 'Invalid tier. Choose pro or enterprise'}), 400

    # find most recent sandbox client for this user
    client = ApiClient.query.filter_by(user_id=user_id).filter(
        ApiClient.api_key_prefix.ilike('vck_sbx_%')
    ).order_by(ApiClient.created_at.desc()).first()

    if not client:
        return jsonify({'error': 'No sandbox client found for user'}), 404

    stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
    if not stripe_key:
        # demo mode: immediately upgrade and rotate to a live API key
        raw_key, key_hash = generate_api_key()
        client.api_key_hash = key_hash
        client.api_key_prefix = raw_key[:20] + '...'
        client.tier = tier

        sub = ApiClientSubscription()
        sub.client_id = client.id
        sub.tier = tier
        sub.status = 'active'
        sub.current_period_end = datetime.utcnow() + timedelta(days=30)

        db.session.add(sub)
        db.session.commit()

        return jsonify({
            'message': f'Upgraded sandbox to {tier} (demo mode).',
            'client': client.to_dict(),
            'api_key': raw_key,
        }), 200

    # Stripe configured: create checkout session (reuse subscribe flow behavior)
    try:
        import stripe  # type: ignore
        stripe.api_key = stripe_key
        user = User.query.get(user_id)

        customer = stripe.Customer.create(
            email=getattr(user, 'email', None) or f'{user_id}@vipchat.app',
            name=client.business_name,
            metadata={'client_id': client.id, 'user_id': user_id},
        )

        price_id = STRIPE_PRICE_IDS.get(tier) or 'price_default'
        checkout = stripe.checkout.Session.create(
            customer=customer.id,
            mode='subscription',
            line_items=[{'price': str(price_id), 'quantity': 1}],
            success_url=data.get('success_url', 'https://vipchat.app/api-platform?success=1'),
            cancel_url=data.get('cancel_url', 'https://vipchat.app/api-platform?cancel=1'),
            metadata={'client_id': str(client.id), 'tier': tier},
            subscription_data={'metadata': {'client_id': str(client.id), 'tier': tier}},
        )
        return jsonify({'checkout_url': checkout.url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


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
