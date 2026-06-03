from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
import re
import time
import hashlib
import hmac

# ── In-memory rate limiting (per-IP per-endpoint) ───────────────────────────
_rate_data = {}

def rate_limit(max_requests=60, window_seconds=60):
    """Sliding-window in-memory rate limiter per IP."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            ip = request.headers.get('X-Forwarded-For', request.remote_addr) or 'unknown'
            ip = ip.split(',')[0].strip()
            key = f"{ip}:{request.endpoint}"
            now = time.time()

            if key not in _rate_data:
                _rate_data[key] = []

            _rate_data[key] = [t for t in _rate_data[key] if now - t < window_seconds]

            if len(_rate_data[key]) >= max_requests:
                return jsonify({
                    'error': 'Too many requests. Please slow down.',
                    'retry_after': int(window_seconds - (now - _rate_data[key][0]))
                }), 429

            _rate_data[key].append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator


def sanitize_string(value, max_len=4000):
    """Strip null bytes and dangerous control characters from strings."""
    if not isinstance(value, str):
        return value
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
    return value[:max_len]


def sanitize_request_json(data, allowed_keys=None, max_len=4000):
    """Recursively sanitize all string values in a JSON body."""
    if not isinstance(data, dict):
        return data
    clean = {}
    for k, v in data.items():
        if allowed_keys and k not in allowed_keys:
            continue
        if isinstance(v, str):
            clean[k] = sanitize_string(v, max_len)
        elif isinstance(v, dict):
            clean[k] = sanitize_request_json(v, max_len=max_len)
        elif isinstance(v, list):
            clean[k] = [sanitize_string(i, max_len) if isinstance(i, str) else i for i in v]
        else:
            clean[k] = v
    return clean


def validate_content_type(allowed=('application/json',)):
    """Decorator: reject requests with wrong Content-Type on mutating methods."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            if request.method in ('POST', 'PUT', 'PATCH'):
                ct = request.content_type or ''
                if not any(ct.startswith(a) for a in allowed):
                    return jsonify({'error': 'Unsupported Content-Type'}), 415
            return f(*args, **kwargs)
        return wrapper
    return decorator


def require_json_body(f):
    """Decorator: return 400 if JSON body is missing on POST/PUT."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method in ('POST', 'PUT', 'PATCH'):
            if not request.is_json:
                return jsonify({'error': 'JSON body required'}), 400
        return f(*args, **kwargs)
    return wrapper


def add_security_headers(response):
    """Add hardened security headers to every response."""
    # Prevent MIME sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    # Deny framing (clickjacking protection)
    response.headers['X-Frame-Options'] = 'DENY'
    # Legacy XSS filter (for older browsers)
    response.headers['X-XSS-Protection'] = '1; mode=block'
    # Strict referrer policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    # Allow camera/mic/geo for the app features
    response.headers['Permissions-Policy'] = 'camera=*, microphone=*, geolocation=*'
    # Content-Security-Policy: restrict sources, allow WebSocket and media
    response.headers['Content-Security-Policy'] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' data: blob: https:; "
        "media-src 'self' blob: https:; "
        "connect-src 'self' wss: ws: https:; "
        "worker-src 'self' blob:; "
        "frame-ancestors 'none';"
    )
    # HSTS — enforce HTTPS for 1 year
    if request.is_secure:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    # Remove server fingerprinting
    response.headers.pop('Server', None)
    response.headers.pop('X-Powered-By', None)
    # Cache control for API responses
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
        response.headers['Pragma'] = 'no-cache'
    return response
