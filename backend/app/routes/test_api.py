"""
Advanced API Testing & Sandbox Platform
Features: Full API testing, sandbox mode, production upgrade, subscription management
"""

from flask import Blueprint, request, jsonify, g
from flask_jwt_extended import jwt_required, get_jwt_identity, create_access_token
from datetime import datetime, timedelta
import uuid
import hashlib
import secrets
import json
import time
from functools import wraps

test_api_bp = Blueprint('test_api', __name__, url_prefix='/api/test')

# In-memory test data stores (use Redis/database in production)
_API_KEYS = {}
_TEST_USERS = {}
_API_SUBSCRIPTIONS = {}
_API_USAGE = {}
_REQUEST_LOGS = []

# Sandbox configuration
SANDBOX_CONFIG = {
    'rate_limit': 1000,  # requests per hour in sandbox
    'features': ['messaging', 'calls', 'contacts', 'groups', 'status'],
    'max_contacts': 50,
    'max_groups': 10,
    'max_upload_size': 5 * 1024 * 1024,  # 5MB
    'webSocket_limit': 10,
    'call_duration_limit': 300,  # 5 minutes
    'storage_limit': 100 * 1024 * 1024,  # 100MB
}

PRODUCTION_PLANS = {
    'free': {
        'name': 'Free',
        'price': 0,
        'rate_limit': 100,
        'features': ['messaging', 'contacts'],
        'max_contacts': 20,
        'max_groups': 3,
        'max_upload_size': 2 * 1024 * 1024,
        'webSocket_limit': 3,
        'call_duration_limit': 60,
        'storage_limit': 50 * 1024 * 1024,
    },
    'pro': {
        'name': 'Pro',
        'price': 9.99,
        'rate_limit': 1000,
        'features': ['messaging', 'calls', 'contacts', 'groups', 'status'],
        'max_contacts': 200,
        'max_groups': 50,
        'max_upload_size': 25 * 1024 * 1024,
        'webSocket_limit': 25,
        'call_duration_limit': 1800,
        'storage_limit': 500 * 1024 * 1024,
    },
    'enterprise': {
        'name': 'Enterprise',
        'price': 49.99,
        'rate_limit': 10000,
        'features': ['messaging', 'calls', 'contacts', 'groups', 'status', 'analytics', 'api', 'webhooks'],
        'max_contacts': -1,  # unlimited
        'max_groups': -1,
        'max_upload_size': 100 * 1024 * 1024,
        'webSocket_limit': 100,
        'call_duration_limit': -1,
        'storage_limit': 5 * 1024 * 1024 * 1024,
    }
}


def generate_api_key(prefix='vipchat'):
    """Generate a secure API key"""
    random_part = secrets.token_urlsafe(32)
    return f"{prefix}_sk_{random_part}"


def hash_api_key(api_key):
    """Hash API key for storage (never store raw keys)"""
    return hashlib.sha256(api_key.encode()).hexdigest()


def log_request(api_key, endpoint, method, status_code, duration_ms):
    """Log API request for analytics"""
    _REQUEST_LOGS.append({
        'id': str(uuid.uuid4()),
        'api_key_hash': hash_api_key(api_key) if api_key else None,
        'endpoint': endpoint,
        'method': method,
        'status_code': status_code,
        'duration_ms': duration_ms,
        'timestamp': datetime.utcnow().isoformat(),
        'ip': request.remote_addr,
        'user_agent': request.user_agent.string[:255] if request.user_agent else None,
    })
    # Keep only last 10000 logs
    if len(_REQUEST_LOGS) > 10000:
        _REQUEST_LOGS.pop(0)


def get_subscription(api_key):
    """Get subscription details for API key"""
    if not api_key:
        return None
    
    key_hash = hash_api_key(api_key)
    
    # Check if it's a sandbox key
    if api_key.startswith('vipchat_test_'):
        return {
            'plan': 'sandbox',
            'mode': 'sandbox',
            'features': SANDBOX_CONFIG['features'],
            'rate_limit': SANDBOX_CONFIG['rate_limit'],
            'is_sandbox': True,
        }
    
    # Check subscription
    subscription = _API_SUBSCRIPTIONS.get(key_hash)
    if subscription:
        plan = PRODUCTION_PLANS.get(subscription.get('plan', 'free'), PRODUCTION_PLANS['free'])
        return {
            'plan': subscription.get('plan', 'free'),
            'mode': 'production',
            'features': plan['features'],
            'rate_limit': plan['rate_limit'],
            'is_sandbox': False,
            'expires_at': subscription.get('expires_at'),
            'status': subscription.get('status', 'active'),
        }
    
    return None


def check_rate_limit(api_key):
    """Check if request is within rate limit"""
    subscription = get_subscription(api_key)
    if not subscription:
        return False, 'No valid subscription'
    
    limit = subscription['rate_limit']
    key_hash = hash_api_key(api_key) if api_key else None
    
    if not key_hash:
        return True, 'OK'
    
    # Get usage for current hour
    current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    usage_key = f"{key_hash}_{current_hour.isoformat()}"
    usage = _API_USAGE.get(usage_key, 0)
    
    if usage >= limit:
        return False, f'Rate limit exceeded. Limit: {limit}/hour'
    
    _API_USAGE[usage_key] = usage + 1
    return True, 'OK'


# ═══════════════════════════════════════════════════════════════════════════════
# API KEY MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/keys/create', methods=['POST'])
@jwt_required()
def create_api_key():
    """Create a new API key"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    key_type = data.get('type', 'sandbox')  # sandbox or production
    name = data.get('name', f'API Key {datetime.now().strftime("%Y-%m-%d %H:%M")}')
    
    # Generate key
    if key_type == 'sandbox':
        api_key = f"vipchat_test_{secrets.token_urlsafe(32)}"
    else:
        api_key = generate_api_key()
    
    key_hash = hash_api_key(api_key)
    
    # Store key
    _API_KEYS[key_hash] = {
        'id': str(uuid.uuid4()),
        'user_id': user_id,
        'name': name,
        'type': key_type,
        'key_hash': key_hash,
        'created_at': datetime.utcnow().isoformat(),
        'last_used': None,
        'is_active': True,
    }
    
    # Create subscription
    _API_SUBSCRIPTIONS[key_hash] = {
        'plan': 'sandbox' if key_type == 'sandbox' else 'free',
        'status': 'active',
        'created_at': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(days=365)).isoformat() if key_type == 'sandbox' else None,
    }
    
    return jsonify({
        'success': True,
        'api_key': api_key,
        'key_id': _API_KEYS[key_hash]['id'],
        'type': key_type,
        'message': 'Store this API key securely. It will not be shown again.',
    }), 201


@test_api_bp.route('/keys/list', methods=['GET'])
@jwt_required()
def list_api_keys():
    """List all API keys for current user"""
    user_id = get_jwt_identity()
    
    user_keys = [
        {
            'id': k['id'],
            'name': k['name'],
            'type': k['type'],
            'created_at': k['created_at'],
            'last_used': k['last_used'],
            'is_active': k['is_active'],
        }
        for k in _API_KEYS.values()
        if k['user_id'] == user_id
    ]
    
    return jsonify({
        'success': True,
        'keys': user_keys,
    })


@test_api_bp.route('/keys/<key_id>/revoke', methods=['POST'])
@jwt_required()
def revoke_api_key(key_id):
    """Revoke an API key"""
    user_id = get_jwt_identity()
    
    for key_hash, key_data in _API_KEYS.items():
        if key_data['id'] == key_id and key_data['user_id'] == user_id:
            key_data['is_active'] = False
            return jsonify({'success': True, 'message': 'API key revoked'})
    
    return jsonify({'error': 'API key not found'}), 404


@test_api_bp.route('/keys/<key_id>/regenerate', methods=['POST'])
@jwt_required()
def regenerate_api_key(key_id):
    """Regenerate an API key"""
    user_id = get_jwt_identity()
    
    for key_hash, key_data in _API_KEYS.items():
        if key_data['id'] == key_id and key_data['user_id'] == user_id:
            # Generate new key
            new_key = generate_api_key() if key_data['type'] == 'production' else f"vipchat_test_{secrets.token_urlsafe(32)}"
            new_hash = hash_api_key(new_key)
            
            # Update storage
            key_data['key_hash'] = new_hash
            key_data['created_at'] = datetime.utcnow().isoformat()
            
            _API_SUBSCRIPTIONS[new_hash] = _API_SUBSCRIPTIONS.pop(key_hash, {})
            
            return jsonify({
                'success': True,
                'api_key': new_key,
                'message': 'New API key generated. Store it securely.',
            })
    
    return jsonify({'error': 'API key not found'}), 404


# ═══════════════════════════════════════════════════════════════════════════════
# SUBSCRIPTION MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/subscription/plans', methods=['GET'])
def get_subscription_plans():
    """Get all available subscription plans"""
    plans = []
    
    for plan_id, plan in PRODUCTION_PLANS.items():
        plans.append({
            'id': plan_id,
            'name': plan['name'],
            'price': plan['price'],
            'features': plan['features'],
            'rate_limit': plan['rate_limit'],
            'max_contacts': plan['max_contacts'],
            'max_groups': plan['max_groups'],
            'max_upload_size': plan['max_upload_size'],
            'call_duration_limit': plan['call_duration_limit'],
        })
    
    return jsonify({
        'success': True,
        'plans': plans,
        'sandbox': {
            'name': 'Sandbox',
            'price': 0,
            'features': SANDBOX_CONFIG['features'],
            'rate_limit': SANDBOX_CONFIG['rate_limit'],
        }
    })


@test_api_bp.route('/subscription/upgrade', methods=['POST'])
@jwt_required()
def upgrade_subscription():
    """Upgrade subscription to a paid plan"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    plan_id = data.get('plan', 'free')
    
    if plan_id not in PRODUCTION_PLANS:
        return jsonify({'error': 'Invalid plan'}), 400
    
    # In production, this would integrate with payment processor
    # For demo, we'll simulate the upgrade
    
    # Find user's production API key
    user_key = None
    for key_hash, key_data in _API_KEYS.items():
        if key_data['user_id'] == user_id and key_data['type'] == 'production':
            user_key = key_hash
            break
    
    if not user_key:
        return jsonify({'error': 'No production API key found. Create one first.'}), 400
    
    # Update subscription
    _API_SUBSCRIPTIONS[user_key] = {
        'plan': plan_id,
        'status': 'active',
        'upgraded_at': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
    }
    
    plan = PRODUCTION_PLANS[plan_id]
    
    return jsonify({
        'success': True,
        'message': f'Upgraded to {plan["name"]} plan',
        'subscription': {
            'plan': plan_id,
            'name': plan['name'],
            'price': plan['price'],
            'features': plan['features'],
            'rate_limit': plan['rate_limit'],
            'expires_at': _API_SUBSCRIPTIONS[user_key]['expires_at'],
        }
    })


@test_api_bp.route('/subscription/current', methods=['GET'])
@jwt_required()
def get_current_subscription():
    """Get current subscription status"""
    user_id = get_jwt_identity()
    
    # Find user's keys
    user_keys = [k for k in _API_KEYS.values() if k['user_id'] == user_id]
    
    subscriptions = []
    for key in user_keys:
        sub = _API_SUBSCRIPTIONS.get(key['key_hash'])
        if sub:
            plan = PRODUCTION_PLANS.get(sub.get('plan', 'free'), PRODUCTION_PLANS['free'])
            subscriptions.append({
                'key_id': key['id'],
                'key_name': key['name'],
                'type': key['type'],
                'plan': sub.get('plan', 'free'),
                'status': sub.get('status', 'active'),
                'expires_at': sub.get('expires_at'),
                'features': plan['features'],
            })
    
    return jsonify({
        'success': True,
        'subscriptions': subscriptions,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# API TESTING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/test/connection', methods=['GET', 'POST'])
def test_connection():
    """Test API connection and get server info"""
    start_time = time.time()
    
    # Get API key from header
    api_key = request.headers.get('X-API-Key')
    subscription = get_subscription(api_key)
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/connection', request.method, 200, duration)
    
    return jsonify({
        'success': True,
        'message': 'API connection successful',
        'server': {
            'name': 'VipChat API',
            'version': '2.0.0',
            'mode': subscription['mode'] if subscription else 'unknown',
            'timestamp': datetime.utcnow().isoformat(),
        },
        'subscription': subscription,
        'response_time_ms': duration,
    })


@test_api_bp.route('/test/auth', methods=['POST'])
def test_auth():
    """Test authentication endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    data = request.get_json() or {}
    
    action = data.get('action', 'login')
    
    # Check rate limit
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/auth', 'POST', 200, duration)
    
    if action == 'login':
        # Simulate login
        return jsonify({
            'success': True,
            'action': 'login',
            'result': {
                'access_token': f"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.{secrets.token_urlsafe(32)}",
                'refresh_token': f"refresh_{secrets.token_urlsafe(32)}",
                'expires_in': 3600,
                'token_type': 'Bearer',
            },
            'sandbox_notice': 'This is a sandbox response. Use real credentials in production.',
        })
    
    elif action == 'signup':
        return jsonify({
            'success': True,
            'action': 'signup',
            'result': {
                'user_id': str(uuid.uuid4()),
                'access_token': f"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.{secrets.token_urlsafe(32)}",
                'message': 'User created successfully',
            },
        })
    
    return jsonify({'error': 'Invalid action'}), 400


@test_api_bp.route('/test/messages', methods=['POST'])
def test_messages():
    """Test messaging endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    data = request.get_json() or {}
    
    action = data.get('action', 'send')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/messages', 'POST', 200, duration)
    
    if action == 'send':
        return jsonify({
            'success': True,
            'action': 'send_message',
            'result': {
                'message_id': str(uuid.uuid4()),
                'status': 'sent',
                'timestamp': datetime.utcnow().isoformat(),
                'recipient_status': 'delivered',
            },
        })
    
    elif action == 'list':
        # Return test messages
        messages = [
            {
                'id': str(uuid.uuid4()),
                'sender_id': str(uuid.uuid4()),
                'content': 'Hello from sandbox!',
                'created_at': (datetime.utcnow() - timedelta(minutes=i*5)).isoformat(),
                'status': 'delivered',
            }
            for i in range(5)
        ]
        
        return jsonify({
            'success': True,
            'action': 'list_messages',
            'result': {
                'messages': messages,
                'total': 5,
                'page': 1,
                'per_page': 20,
            },
        })
    
    return jsonify({'error': 'Invalid action'}), 400


@test_api_bp.route('/test/calls', methods=['POST'])
def test_calls():
    """Test call endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    data = request.get_json() or {}
    
    action = data.get('action', 'initiate')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/calls', 'POST', 200, duration)
    
    if action == 'initiate':
        return jsonify({
            'success': True,
            'action': 'initiate_call',
            'result': {
                'call_id': str(uuid.uuid4()),
                'status': 'ringing',
                'room_id': f"room_{secrets.token_urlsafe(16)}",
                'ice_servers': [
                    {'urls': 'stun:stun.l.google.com:19302'},
                ],
            },
        })
    
    elif action == 'history':
        calls = [
            {
                'id': str(uuid.uuid4()),
                'caller_id': str(uuid.uuid4()),
                'caller_name': 'Test User',
                'call_type': 'audio',
                'direction': 'incoming',
                'status': 'completed',
                'duration': 120,
                'created_at': (datetime.utcnow() - timedelta(hours=i)).isoformat(),
            }
            for i in range(3)
        ]
        
        return jsonify({
            'success': True,
            'action': 'call_history',
            'result': {
                'calls': calls,
                'total': 3,
            },
        })
    
    return jsonify({'error': 'Invalid action'}), 400


@test_api_bp.route('/test/contacts', methods=['GET', 'POST'])
def test_contacts():
    """Test contacts endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/contacts', request.method, 200, duration)
    
    if request.method == 'GET':
        contacts = [
            {
                'id': str(uuid.uuid4()),
                'full_name': f'Test Contact {i}',
                'phone': f'+1555000{i:04d}',
                'avatar_url': None,
                'status': 'online' if i % 2 == 0 else 'offline',
            }
            for i in range(10)
        ]
        
        return jsonify({
            'success': True,
            'action': 'list_contacts',
            'result': {
                'contacts': contacts,
                'total': 10,
            },
        })
    
    elif request.method == 'POST':
        return jsonify({
            'success': True,
            'action': 'add_contact',
            'result': {
                'contact_id': str(uuid.uuid4()),
                'status': 'added',
            },
        })


@test_api_bp.route('/test/groups', methods=['GET', 'POST'])
def test_groups():
    """Test group endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/groups', request.method, 200, duration)
    
    if request.method == 'GET':
        groups = [
            {
                'id': str(uuid.uuid4()),
                'name': f'Test Group {i}',
                'member_count': 5 + i,
                'is_admin': True,
                'last_message': 'Test message',
                'updated_at': datetime.utcnow().isoformat(),
            }
            for i in range(3)
        ]
        
        return jsonify({
            'success': True,
            'action': 'list_groups',
            'result': {
                'groups': groups,
                'total': 3,
            },
        })
    
    elif request.method == 'POST':
        return jsonify({
            'success': True,
            'action': 'create_group',
            'result': {
                'group_id': str(uuid.uuid4()),
                'name': 'New Test Group',
                'admin_id': str(uuid.uuid4()),
                'member_count': 1,
            },
        })


@test_api_bp.route('/test/upload', methods=['POST'])
def test_upload():
    """Test file upload"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    # Check file size
    subscription = get_subscription(api_key)
    max_size = SANDBOX_CONFIG['max_upload_size']
    if subscription:
        plan = PRODUCTION_PLANS.get(subscription.get('plan', 'free'), PRODUCTION_PLANS['free'])
        max_size = plan['max_upload_size']
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/upload', 'POST', 200, duration)
    
    # Simulate upload response
    return jsonify({
        'success': True,
        'action': 'upload_file',
        'result': {
            'file_id': str(uuid.uuid4()),
            'url': f'/uploads/test_{secrets.token_urlsafe(16)}',
            'size': 1024,
            'type': 'image/jpeg',
            'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
        },
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS & USAGE
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    """Get API usage statistics"""
    user_id = get_jwt_identity()
    api_key = request.headers.get('X-API-Key')
    
    # Get user's keys
    user_keys = [k['key_hash'] for k in _API_KEYS.values() if k['user_id'] == user_id]
    
    # Calculate usage
    current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    
    usage_data = {}
    for key_hash in user_keys:
        for hour_offset in range(24):
            hour = current_hour - timedelta(hours=hour_offset)
            usage_key = f"{key_hash}_{hour.isoformat()}"
            usage_data[hour.isoformat()] = _API_USAGE.get(usage_key, 0)
    
    # Get subscription
    subscription = get_subscription(api_key)
    
    return jsonify({
        'success': True,
        'usage': usage_data,
        'subscription': subscription,
    })


@test_api_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_request_logs():
    """Get request logs"""
    user_id = get_jwt_identity()
    
    # Filter logs for user's keys
    user_key_hashes = [k['key_hash'] for k in _API_KEYS.values() if k['user_id'] == user_id]
    
    user_logs = [
        log for log in _REQUEST_LOGS
        if log.get('api_key_hash') in user_key_hashes
    ][-100:]  # Last 100 logs
    
    return jsonify({
        'success': True,
        'logs': user_logs,
        'total': len(user_logs),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# WEBHOOK MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/webhooks', methods=['GET', 'POST'])
@jwt_required()
def manage_webhooks():
    """Manage webhooks"""
    user_id = get_jwt_identity()
    
    if request.method == 'GET':
        # Return test webhooks
        return jsonify({
            'success': True,
            'webhooks': [
                {
                    'id': str(uuid.uuid4()),
                    'url': 'https://example.com/webhook',
                    'events': ['message.received', 'call.ended'],
                    'is_active': True,
                }
            ],
        })
    
    elif request.method == 'POST':
        data = request.get_json() or {}
        return jsonify({
            'success': True,
            'webhook': {
                'id': str(uuid.uuid4()),
                'url': data.get('url'),
                'events': data.get('events', []),
                'is_active': True,
                'created_at': datetime.utcnow().isoformat(),
            },
        })


@test_api_bp.route('/webhooks/<webhook_id>/test', methods=['POST'])
@jwt_required()
def test_webhook(webhook_id):
    """Test a webhook"""
    return jsonify({
        'success': True,
        'message': 'Test webhook triggered',
        'payload': {
            'event': 'test.event',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {'test': True},
        },
    })


# ═══════════════════════════════════════════════════════════════════════════════
# FULL API DOCUMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/docs', methods=['GET'])
def get_api_docs():
    """Get full API documentation"""
    return jsonify({
        'name': 'VipChat API',
        'version': '2.0.0',
        'description': 'Advanced messaging and calling platform API',
        'sandbox_mode': True,
        'endpoints': {
            'authentication': {
                'POST /api/test/auth': {
                    'description': 'Test authentication (login/signup)',
                    'body': {'action': 'login|signup', 'phone': '', 'password': ''},
                },
            },
            'messages': {
                'POST /api/test/messages': {
                    'description': 'Test messaging operations',
                    'body': {'action': 'send|list', 'receiver_id': '', 'content': ''},
                },
            },
            'calls': {
                'POST /api/test/calls': {
                    'description': 'Test call operations',
                    'body': {'action': 'initiate|history', 'callee_id': '', 'call_type': 'audio|video'},
                },
            },
            'contacts': {
                'GET /api/test/contacts': 'List contacts',
                'POST /api/test/contacts': 'Add contact',
            },
            'groups': {
                'GET /api/test/groups': 'List groups',
                'POST /api/test/groups': 'Create group',
            },
        },
        'authentication': {
            'header': 'X-API-Key',
            'sandbox_key_prefix': 'vipchat_test_',
            'production_key_prefix': 'vipchat_sk_',
        },
        'rate_limits': {
            'sandbox': '1000/hour',
            'free': '100/hour',
            'pro': '1000/hour',
            'enterprise': '10000/hour',
        },
    })RODUCTION_PLANS.items():
        plans.append({
            'id': plan_id,
            'name': plan['name'],
            'price': plan['price'],
            'features': plan['features'],
            'rate_limit': plan['rate_limit'],
            'max_contacts': plan['max_contacts'],
            'max_groups': plan['max_groups'],
            'max_upload_size': plan['max_upload_size'],
            'call_duration_limit': plan['call_duration_limit'],
        })
    
    return jsonify({
        'success': True,
        'plans': plans,
        'sandbox': {
            'name': 'Sandbox',
            'price': 0,
            'features': SANDBOX_CONFIG['features'],
            'rate_limit': SANDBOX_CONFIG['rate_limit'],
        }
    })


@test_api_bp.route('/subscription/upgrade', methods=['POST'])
@jwt_required()
def upgrade_subscription():
    """Upgrade subscription to a paid plan"""
    user_id = get_jwt_identity()
    data = request.get_json() or {}
    
    plan_id = data.get('plan', 'free')
    
    if plan_id not in PRODUCTION_PLANS:
        return jsonify({'error': 'Invalid plan'}), 400
    
    # In production, this would integrate with payment processor
    # For demo, we'll simulate the upgrade
    
    # Find user's production API key
    user_key = None
    for key_hash, key_data in _API_KEYS.items():
        if key_data['user_id'] == user_id and key_data['type'] == 'production':
            user_key = key_hash
            break
    
    if not user_key:
        return jsonify({'error': 'No production API key found. Create one first.'}), 400
    
    # Update subscription
    _API_SUBSCRIPTIONS[user_key] = {
        'plan': plan_id,
        'status': 'active',
        'upgraded_at': datetime.utcnow().isoformat(),
        'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
    }
    
    plan = PRODUCTION_PLANS[plan_id]
    
    return jsonify({
        'success': True,
        'message': f'Upgraded to {plan["name"]} plan',
        'subscription': {
            'plan': plan_id,
            'name': plan['name'],
            'price': plan['price'],
            'features': plan['features'],
            'rate_limit': plan['rate_limit'],
            'expires_at': _API_SUBSCRIPTIONS[user_key]['expires_at'],
        }
    })


@test_api_bp.route('/subscription/current', methods=['GET'])
@jwt_required()
def get_current_subscription():
    """Get current subscription status"""
    user_id = get_jwt_identity()
    
    # Find user's keys
    user_keys = [k for k in _API_KEYS.values() if k['user_id'] == user_id]
    
    subscriptions = []
    for key in user_keys:
        sub = _API_SUBSCRIPTIONS.get(key['key_hash'])
        if sub:
            plan = PRODUCTION_PLANS.get(sub.get('plan', 'free'), PRODUCTION_PLANS['free'])
            subscriptions.append({
                'key_id': key['id'],
                'key_name': key['name'],
                'type': key['type'],
                'plan': sub.get('plan', 'free'),
                'status': sub.get('status', 'active'),
                'expires_at': sub.get('expires_at'),
                'features': plan['features'],
            })
    
    return jsonify({
        'success': True,
        'subscriptions': subscriptions,
    })


# ═══════════════════════════════════════════════════════════════════════════════
# API TESTING ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/test/connection', methods=['GET', 'POST'])
def test_connection():
    """Test API connection and get server info"""
    start_time = time.time()
    
    # Get API key from header
    api_key = request.headers.get('X-API-Key')
    subscription = get_subscription(api_key)
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/connection', request.method, 200, duration)
    
    return jsonify({
        'success': True,
        'message': 'API connection successful',
        'server': {
            'name': 'VipChat API',
            'version': '2.0.0',
            'mode': subscription['mode'] if subscription else 'unknown',
            'timestamp': datetime.utcnow().isoformat(),
        },
        'subscription': subscription,
        'response_time_ms': duration,
    })


@test_api_bp.route('/test/auth', methods=['POST'])
def test_auth():
    """Test authentication endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    data = request.get_json() or {}
    
    action = data.get('action', 'login')
    
    # Check rate limit
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/auth', 'POST', 200, duration)
    
    if action == 'login':
        # Simulate login
        return jsonify({
            'success': True,
            'action': 'login',
            'result': {
                'access_token': f"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.{secrets.token_urlsafe(32)}",
                'refresh_token': f"refresh_{secrets.token_urlsafe(32)}",
                'expires_in': 3600,
                'token_type': 'Bearer',
            },
            'sandbox_notice': 'This is a sandbox response. Use real credentials in production.',
        })
    
    elif action == 'signup':
        return jsonify({
            'success': True,
            'action': 'signup',
            'result': {
                'user_id': str(uuid.uuid4()),
                'access_token': f"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.{secrets.token_urlsafe(32)}",
                'message': 'User created successfully',
            },
        })
    
    return jsonify({'error': 'Invalid action'}), 400


@test_api_bp.route('/test/messages', methods=['POST'])
def test_messages():
    """Test messaging endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    data = request.get_json() or {}
    
    action = data.get('action', 'send')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/messages', 'POST', 200, duration)
    
    if action == 'send':
        return jsonify({
            'success': True,
            'action': 'send_message',
            'result': {
                'message_id': str(uuid.uuid4()),
                'status': 'sent',
                'timestamp': datetime.utcnow().isoformat(),
                'recipient_status': 'delivered',
            },
        })
    
    elif action == 'list':
        # Return test messages
        messages = [
            {
                'id': str(uuid.uuid4()),
                'sender_id': str(uuid.uuid4()),
                'content': 'Hello from sandbox!',
                'created_at': (datetime.utcnow() - timedelta(minutes=i*5)).isoformat(),
                'status': 'delivered',
            }
            for i in range(5)
        ]
        
        return jsonify({
            'success': True,
            'action': 'list_messages',
            'result': {
                'messages': messages,
                'total': 5,
                'page': 1,
                'per_page': 20,
            },
        })
    
    return jsonify({'error': 'Invalid action'}), 400


@test_api_bp.route('/test/calls', methods=['POST'])
def test_calls():
    """Test call endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    data = request.get_json() or {}
    
    action = data.get('action', 'initiate')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/calls', 'POST', 200, duration)
    
    if action == 'initiate':
        return jsonify({
            'success': True,
            'action': 'initiate_call',
            'result': {
                'call_id': str(uuid.uuid4()),
                'status': 'ringing',
                'room_id': f"room_{secrets.token_urlsafe(16)}",
                'ice_servers': [
                    {'urls': 'stun:stun.l.google.com:19302'},
                ],
            },
        })
    
    elif action == 'history':
        calls = [
            {
                'id': str(uuid.uuid4()),
                'caller_id': str(uuid.uuid4()),
                'caller_name': 'Test User',
                'call_type': 'audio',
                'direction': 'incoming',
                'status': 'completed',
                'duration': 120,
                'created_at': (datetime.utcnow() - timedelta(hours=i)).isoformat(),
            }
            for i in range(3)
        ]
        
        return jsonify({
            'success': True,
            'action': 'call_history',
            'result': {
                'calls': calls,
                'total': 3,
            },
        })
    
    return jsonify({'error': 'Invalid action'}), 400


@test_api_bp.route('/test/contacts', methods=['GET', 'POST'])
def test_contacts():
    """Test contacts endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/contacts', request.method, 200, duration)
    
    if request.method == 'GET':
        contacts = [
            {
                'id': str(uuid.uuid4()),
                'full_name': f'Test Contact {i}',
                'phone': f'+1555000{i:04d}',
                'avatar_url': None,
                'status': 'online' if i % 2 == 0 else 'offline',
            }
            for i in range(10)
        ]
        
        return jsonify({
            'success': True,
            'action': 'list_contacts',
            'result': {
                'contacts': contacts,
                'total': 10,
            },
        })
    
    elif request.method == 'POST':
        return jsonify({
            'success': True,
            'action': 'add_contact',
            'result': {
                'contact_id': str(uuid.uuid4()),
                'status': 'added',
            },
        })


@test_api_bp.route('/test/groups', methods=['GET', 'POST'])
def test_groups():
    """Test group endpoints"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/groups', request.method, 200, duration)
    
    if request.method == 'GET':
        groups = [
            {
                'id': str(uuid.uuid4()),
                'name': f'Test Group {i}',
                'member_count': 5 + i,
                'is_admin': True,
                'last_message': 'Test message',
                'updated_at': datetime.utcnow().isoformat(),
            }
            for i in range(3)
        ]
        
        return jsonify({
            'success': True,
            'action': 'list_groups',
            'result': {
                'groups': groups,
                'total': 3,
            },
        })
    
    elif request.method == 'POST':
        return jsonify({
            'success': True,
            'action': 'create_group',
            'result': {
                'group_id': str(uuid.uuid4()),
                'name': 'New Test Group',
                'admin_id': str(uuid.uuid4()),
                'member_count': 1,
            },
        })


@test_api_bp.route('/test/upload', methods=['POST'])
def test_upload():
    """Test file upload"""
    start_time = time.time()
    
    api_key = request.headers.get('X-API-Key')
    
    allowed, message = check_rate_limit(api_key)
    if not allowed:
        return jsonify({'error': message}), 429
    
    # Check file size
    subscription = get_subscription(api_key)
    max_size = SANDBOX_CONFIG['max_upload_size']
    if subscription:
        plan = PRODUCTION_PLANS.get(subscription.get('plan', 'free'), PRODUCTION_PLANS['free'])
        max_size = plan['max_upload_size']
    
    duration = int((time.time() - start_time) * 1000)
    log_request(api_key, '/test/upload', 'POST', 200, duration)
    
    # Simulate upload response
    return jsonify({
        'success': True,
        'action': 'upload_file',
        'result': {
            'file_id': str(uuid.uuid4()),
            'url': f'/uploads/test_{secrets.token_urlsafe(16)}',
            'size': 1024,
            'type': 'image/jpeg',
            'expires_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
        },
    })


# ═══════════════════════════════════════════════════════════════════════════════
# ANALYTICS & USAGE
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    """Get API usage statistics"""
    user_id = get_jwt_identity()
    api_key = request.headers.get('X-API-Key')
    
    # Get user's keys
    user_keys = [k['key_hash'] for k in _API_KEYS.values() if k['user_id'] == user_id]
    
    # Calculate usage
    current_hour = datetime.utcnow().replace(minute=0, second=0, microsecond=0)
    
    usage_data = {}
    for key_hash in user_keys:
        for hour_offset in range(24):
            hour = current_hour - timedelta(hours=hour_offset)
            usage_key = f"{key_hash}_{hour.isoformat()}"
            usage_data[hour.isoformat()] = _API_USAGE.get(usage_key, 0)
    
    # Get subscription
    subscription = get_subscription(api_key)
    
    return jsonify({
        'success': True,
        'usage': usage_data,
        'subscription': subscription,
    })


@test_api_bp.route('/logs', methods=['GET'])
@jwt_required()
def get_request_logs():
    """Get request logs"""
    user_id = get_jwt_identity()
    
    # Filter logs for user's keys
    user_key_hashes = [k['key_hash'] for k in _API_KEYS.values() if k['user_id'] == user_id]
    
    user_logs = [
        log for log in _REQUEST_LOGS
        if log.get('api_key_hash') in user_key_hashes
    ][-100:]  # Last 100 logs
    
    return jsonify({
        'success': True,
        'logs': user_logs,
        'total': len(user_logs),
    })


# ═══════════════════════════════════════════════════════════════════════════════
# WEBHOOK MANAGEMENT
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/webhooks', methods=['GET', 'POST'])
@jwt_required()
def manage_webhooks():
    """Manage webhooks"""
    user_id = get_jwt_identity()
    
    if request.method == 'GET':
        # Return test webhooks
        return jsonify({
            'success': True,
            'webhooks': [
                {
                    'id': str(uuid.uuid4()),
                    'url': 'https://example.com/webhook',
                    'events': ['message.received', 'call.ended'],
                    'is_active': True,
                }
            ],
        })
    
    elif request.method == 'POST':
        data = request.get_json() or {}
        return jsonify({
            'success': True,
            'webhook': {
                'id': str(uuid.uuid4()),
                'url': data.get('url'),
                'events': data.get('events', []),
                'is_active': True,
                'created_at': datetime.utcnow().isoformat(),
            },
        })


@test_api_bp.route('/webhooks/<webhook_id>/test', methods=['POST'])
@jwt_required()
def test_webhook(webhook_id):
    """Test a webhook"""
    return jsonify({
        'success': True,
        'message': 'Test webhook triggered',
        'payload': {
            'event': 'test.event',
            'timestamp': datetime.utcnow().isoformat(),
            'data': {'test': True},
        },
    })


# ═══════════════════════════════════════════════════════════════════════════════
# FULL API DOCUMENTATION
# ═══════════════════════════════════════════════════════════════════════════════

@test_api_bp.route('/docs', methods=['GET'])
def get_api_docs():
    """Get full API documentation"""
    return jsonify({
        'name': 'VipChat API',
        'version': '2.0.0',
        'description': 'Advanced messaging and calling platform API',
        'sandbox_mode': True,
        'endpoints': {
            'authentication': {
                'POST /api/test/auth': {
                    'description': 'Test authentication (login/signup)',
                    'body': {'action': 'login|signup', 'phone': '', 'password': ''},
                },
            },
            'messages': {
                'POST /api/test/messages': {
                    'description': 'Test messaging operations',
                    'body': {'action': 'send|list', 'receiver_id': '', 'content': ''},
                },
            },
            'calls': {
                'POST /api/test/calls': {
                    'description': 'Test call operations',
                    'body': {'action': 'initiate|history', 'callee_id': '', 'call_type': 'audio|video'},
                },
            },
            'contacts': {
                'GET /api/test/contacts': 'List contacts',
                'POST /api/test/contacts': 'Add contact',
            },
            'groups': {
                'GET /api/test/groups': 'List groups',
                'POST /api/test/groups': 'Create group',
            },
        },
        'authentication': {
            'header': 'X-API-Key',
            'sandbox_key_prefix': 'vipchat_test_',
            'production_key_prefix': 'vipchat_sk_',
        },
        'rate_limits': {
            'sandbox': '1000/hour',
            'free': '100/hour',
            'pro': '1000/hour',
            'enterprise': '10000/hour',
        },
    })