from functools import wraps
from flask import request, jsonify, g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
import re
import time

# ── Rate limiting (in-memory, per-IP) ───────────────────────────────────────
_rate_data = {}

def rate_limit(max_requests=60, window_seconds=60):
    """Simple in-memory rate limiter per IP."""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            ip = request.remote_addr or 'unknown'
            key = f"{ip}:{request.endpoint}"
            now = time.time()

            if key not in _rate_data:
                _rate_data[key] = []

            # Purge old timestamps
            _rate_data[key] = [t for t in _rate_data[key] if now - t < window_seconds]

            if len(_rate_data[key]) >= max_requests:
                return jsonify({'error': 'Too many requests. Please slow down.'}), 429

            _rate_data[key].append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator


def sanitize_string(value, max_len=2000):
    """Strip dangerous characters from input strings."""
    if not isinstance(value, str):
        return value
    # Remove null bytes and control chars except newline/tab
    value = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', value)
    return value[:max_len]


def sanitize_request_json(data, allowed_keys=None, max_len=2000):
    """Recursively sanitize all string values in a JSON dict."""
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


def add_security_headers(response):
    """Add security headers to every response."""
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'DENY'
    response.headers['X-XSS-Protection'] = '1; mode=block'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = 'camera=*, microphone=*, geolocation=*'
    return response
