from flask import Blueprint, request, jsonify, g
from app.models.models import db, User, Message, Group, ApiClient, ApiUsageLog
from datetime import datetime, timedelta
from functools import wraps
import bcrypt as _bcrypt
import time

v1_bp = Blueprint('v1', __name__, url_prefix='/v1')

TIER_LIMITS = {
    'starter': 100,
    'pro': 10000,
    'enterprise': None,
}


def _bcrypt_verify(raw_key: str, stored_hash: str) -> bool:
    try:
        return _bcrypt.checkpw(raw_key.encode(), stored_hash.encode())
    except Exception:
        return False


def api_key_required(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer vck_live_'):
            return jsonify({'error': 'Missing or invalid API key', 'code': 'AUTH_REQUIRED'}), 401

        raw_key = auth_header[len('Bearer '):]
        prefix = raw_key[:20] + '...'
        client = ApiClient.query.filter_by(api_key_prefix=prefix).first()

        if not client or not _bcrypt_verify(raw_key, client.api_key_hash):
            return jsonify({'error': 'Invalid API key', 'code': 'AUTH_INVALID'}), 401
        if not client.is_active:
            return jsonify({'error': 'API client is suspended', 'code': 'CLIENT_SUSPENDED'}), 403

        limit = TIER_LIMITS.get(client.tier)
        if limit is not None:
            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            today_msgs = db.session.query(
                db.func.sum(ApiUsageLog.message_count)
            ).filter(
                ApiUsageLog.client_id == client.id,
                ApiUsageLog.timestamp >= today_start,
            ).scalar() or 0
            if today_msgs >= limit:
                response = jsonify({
                    'error': 'Daily rate limit exceeded',
                    'code': 'RATE_LIMIT_EXCEEDED',
                    'limit': limit,
                    'used': today_msgs,
                    'tier': client.tier,
                })
                response.headers['X-RateLimit-Limit'] = str(limit)
                response.headers['X-RateLimit-Remaining'] = '0'
                response.headers['X-RateLimit-Reset'] = str(int((today_start + timedelta(days=1)).timestamp()))
                return response, 429

        g.api_client = client
        g.api_start_time = time.time()
        return f(*args, **kwargs)
    return wrapper


def log_usage(endpoint: str, method: str, status_code: int, message_count: int = 0):
    try:
        elapsed = int((time.time() - g.get('api_start_time', time.time())) * 1000)
        log = ApiUsageLog(
            client_id=g.api_client.id,
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            message_count=message_count,
            response_time_ms=elapsed,
            ip_address=request.remote_addr,
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()


def _find_or_create_user_by_phone(phone: str):
    return User.query.filter_by(phone_number=phone).first()


def _rate_limit_headers(client: ApiClient):
    limit = TIER_LIMITS.get(client.tier)
    if limit is None:
        return {'X-RateLimit-Limit': 'unlimited', 'X-RateLimit-Remaining': 'unlimited'}
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    used = db.session.query(db.func.sum(ApiUsageLog.message_count)).filter(
        ApiUsageLog.client_id == client.id,
        ApiUsageLog.timestamp >= today_start,
    ).scalar() or 0
    return {
        'X-RateLimit-Limit': str(limit),
        'X-RateLimit-Remaining': str(max(0, limit - used)),
        'X-RateLimit-Reset': str(int((today_start + timedelta(days=1)).timestamp())),
    }


# ── POST /v1/messages/send ────────────────────────────────────────────────────
@v1_bp.route('/messages/send', methods=['POST'])
@api_key_required
def send_message():
    client = g.api_client
    data = request.json or {}
    to_phone = (data.get('to') or '').strip()
    content = (data.get('message') or data.get('content') or '').strip()
    media_url = data.get('media_url')
    media_type = data.get('media_type')

    if not to_phone:
        log_usage('/v1/messages/send', 'POST', 400)
        return jsonify({'error': 'to (phone number) is required'}), 400
    if not content and not media_url:
        log_usage('/v1/messages/send', 'POST', 400)
        return jsonify({'error': 'message or media_url is required'}), 400

    recipient = _find_or_create_user_by_phone(to_phone)
    if not recipient:
        log_usage('/v1/messages/send', 'POST', 404)
        return jsonify({'error': f'No user found with phone {to_phone}'}), 404

    sender = User.query.get(client.user_id)
    if not sender:
        log_usage('/v1/messages/send', 'POST', 500)
        return jsonify({'error': 'API client owner not found'}), 500

    msg = Message(
        sender_id=sender.id,
        receiver_id=recipient.id,
        content=content or None,
        media_url=media_url,
        media_type=media_type,
    )
    db.session.add(msg)
    db.session.commit()

    log_usage('/v1/messages/send', 'POST', 201, message_count=1)
    response = jsonify({
        'success': True,
        'message_id': msg.id,
        'to': to_phone,
        'status': 'sent',
        'timestamp': msg.created_at.isoformat(),
    })
    for k, v in _rate_limit_headers(client).items():
        response.headers[k] = v
    return response, 201


# ── GET /v1/messages ──────────────────────────────────────────────────────────
@v1_bp.route('/messages', methods=['GET'])
@api_key_required
def list_messages():
    client = g.api_client
    sender = User.query.get(client.user_id)
    if not sender:
        log_usage('/v1/messages', 'GET', 500)
        return jsonify({'error': 'Client owner not found'}), 500

    limit = min(request.args.get('limit', 50, type=int), 200)
    offset = request.args.get('offset', 0, type=int)

    msgs = Message.query.filter_by(sender_id=sender.id).order_by(
        Message.created_at.desc()
    ).offset(offset).limit(limit).all()

    log_usage('/v1/messages', 'GET', 200)
    return jsonify({
        'messages': [m.to_dict() for m in msgs],
        'count': len(msgs),
        'offset': offset,
    }), 200


# ── POST /v1/contacts/import ──────────────────────────────────────────────────
@v1_bp.route('/contacts/import', methods=['POST'])
@api_key_required
def import_contacts():
    client = g.api_client
    data = request.json or {}
    contacts = data.get('contacts', [])

    if not isinstance(contacts, list) or not contacts:
        log_usage('/v1/contacts/import', 'POST', 400)
        return jsonify({'error': 'contacts array is required'}), 400

    found = []
    not_found = []
    for c in contacts[:500]:
        phone = (c.get('phone') or '').strip()
        if not phone:
            continue
        user = User.query.filter_by(phone_number=phone).first()
        if user:
            found.append({'phone': phone, 'user_id': user.id, 'name': user.full_name})
        else:
            not_found.append(phone)

    log_usage('/v1/contacts/import', 'POST', 200)
    return jsonify({
        'imported': len(found),
        'not_found': len(not_found),
        'contacts': found,
        'missing': not_found,
    }), 200


# ── GET /v1/contacts ──────────────────────────────────────────────────────────
@v1_bp.route('/contacts', methods=['GET'])
@api_key_required
def list_contacts():
    client = g.api_client
    from app.models.models import Contact
    owner = User.query.get(client.user_id)
    if not owner:
        log_usage('/v1/contacts', 'GET', 500)
        return jsonify({'error': 'Client owner not found'}), 500

    contacts = Contact.query.filter_by(user_id=owner.id).limit(500).all()
    log_usage('/v1/contacts', 'GET', 200)
    return jsonify({
        'contacts': [c.to_dict() for c in contacts],
        'count': len(contacts),
    }), 200


# ── POST /v1/groups/create ────────────────────────────────────────────────────
@v1_bp.route('/groups/create', methods=['POST'])
@api_key_required
def create_group():
    client = g.api_client
    data = request.json or {}
    name = (data.get('name') or '').strip()
    description = (data.get('description') or '').strip()
    member_phones = data.get('member_phones', [])

    if not name:
        log_usage('/v1/groups/create', 'POST', 400)
        return jsonify({'error': 'Group name is required'}), 400

    creator = User.query.get(client.user_id)
    if not creator:
        log_usage('/v1/groups/create', 'POST', 500)
        return jsonify({'error': 'Client owner not found'}), 500

    group = Group(name=name, description=description, creator_id=creator.id)
    group.members.append(creator)
    group.admins.append(creator)

    added = []
    for phone in member_phones[:100]:
        user = User.query.filter_by(phone_number=phone.strip()).first()
        if user and user.id != creator.id:
            group.members.append(user)
            added.append(phone)

    db.session.add(group)
    db.session.commit()

    log_usage('/v1/groups/create', 'POST', 201)
    return jsonify({
        'success': True,
        'group_id': group.id,
        'name': group.name,
        'member_count': len(group.members),
        'members_added': added,
    }), 201


# ── POST /v1/broadcasts/send ──────────────────────────────────────────────────
@v1_bp.route('/broadcasts/send', methods=['POST'])
@api_key_required
def send_broadcast():
    client = g.api_client
    data = request.json or {}
    to_phones = data.get('to', [])
    content = (data.get('message') or data.get('content') or '').strip()
    media_url = data.get('media_url')

    if not to_phones or not isinstance(to_phones, list):
        log_usage('/v1/broadcasts/send', 'POST', 400)
        return jsonify({'error': 'to (array of phone numbers) is required'}), 400
    if not content and not media_url:
        log_usage('/v1/broadcasts/send', 'POST', 400)
        return jsonify({'error': 'message or media_url is required'}), 400
    if len(to_phones) > 1000:
        return jsonify({'error': 'Maximum 1000 recipients per broadcast'}), 400

    sender = User.query.get(client.user_id)
    if not sender:
        log_usage('/v1/broadcasts/send', 'POST', 500)
        return jsonify({'error': 'Client owner not found'}), 500

    sent = []
    failed = []
    for phone in to_phones:
        recipient = User.query.filter_by(phone_number=phone.strip()).first()
        if recipient:
            msg = Message(
                sender_id=sender.id,
                receiver_id=recipient.id,
                content=content or None,
                media_url=media_url,
            )
            db.session.add(msg)
            sent.append(phone)
        else:
            failed.append(phone)

    db.session.commit()
    log_usage('/v1/broadcasts/send', 'POST', 200, message_count=len(sent))

    response = jsonify({
        'success': True,
        'sent': len(sent),
        'failed': len(failed),
        'failed_phones': failed[:20],
    })
    for k, v in _rate_limit_headers(client).items():
        response.headers[k] = v
    return response, 200


# ── GET /v1/analytics ─────────────────────────────────────────────────────────
@v1_bp.route('/analytics', methods=['GET'])
@api_key_required
def analytics():
    client = g.api_client
    days = min(request.args.get('days', 7, type=int), 90)
    since = datetime.utcnow() - timedelta(days=days)

    logs = ApiUsageLog.query.filter(
        ApiUsageLog.client_id == client.id,
        ApiUsageLog.timestamp >= since,
    ).all()

    total_calls = len(logs)
    total_messages = sum(l.message_count for l in logs)
    success_calls = sum(1 for l in logs if l.status_code < 400)

    daily = {}
    for l in logs:
        day = l.timestamp.strftime('%Y-%m-%d')
        if day not in daily:
            daily[day] = {'calls': 0, 'messages': 0, 'errors': 0}
        daily[day]['calls'] += 1
        daily[day]['messages'] += l.message_count
        if l.status_code >= 400:
            daily[day]['errors'] += 1

    by_endpoint = {}
    for l in logs:
        ep = l.endpoint
        if ep not in by_endpoint:
            by_endpoint[ep] = 0
        by_endpoint[ep] += 1

    log_usage('/v1/analytics', 'GET', 200)
    return jsonify({
        'period_days': days,
        'total_calls': total_calls,
        'success_calls': success_calls,
        'error_calls': total_calls - success_calls,
        'total_messages': total_messages,
        'daily': [{'date': k, **v} for k, v in sorted(daily.items())],
        'by_endpoint': by_endpoint,
        'tier': client.tier,
        'daily_limit': TIER_LIMITS.get(client.tier),
    }), 200


# ── POST /v1/webhooks/configure ───────────────────────────────────────────────
@v1_bp.route('/webhooks/configure', methods=['POST'])
@api_key_required
def configure_webhook_v1():
    client = g.api_client
    data = request.json or {}
    webhook_url = (data.get('url') or '').strip()

    if webhook_url and not webhook_url.startswith('https://'):
        log_usage('/v1/webhooks/configure', 'POST', 400)
        return jsonify({'error': 'Webhook URL must use HTTPS'}), 400

    client.webhook_url = webhook_url or None
    db.session.commit()

    log_usage('/v1/webhooks/configure', 'POST', 200)
    return jsonify({
        'success': True,
        'webhook_url': client.webhook_url,
        'webhook_secret': client.webhook_secret,
        'note': 'Sign each request with HMAC-SHA256 using webhook_secret to verify authenticity.',
    }), 200


# ── GET /v1/account ───────────────────────────────────────────────────────────
@v1_bp.route('/account', methods=['GET'])
@api_key_required
def get_account():
    client = g.api_client
    limit = TIER_LIMITS.get(client.tier)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_used = db.session.query(db.func.sum(ApiUsageLog.message_count)).filter(
        ApiUsageLog.client_id == client.id,
        ApiUsageLog.timestamp >= today_start,
    ).scalar() or 0

    log_usage('/v1/account', 'GET', 200)
    return jsonify({
        'business_name': client.business_name,
        'tier': client.tier,
        'is_active': client.is_active,
        'daily_limit': limit,
        'today_used': today_used,
        'remaining_today': max(0, limit - today_used) if limit else None,
        'webhook_url': client.webhook_url,
        'api_key_prefix': client.api_key_prefix,
    }), 200
