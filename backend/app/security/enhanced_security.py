"""
Enhanced Security Module for VipChat
Features: Request signing, rate limiting, encryption, CSRF protection, audit logging
Security Level: Enterprise-grade with multiple layers of protection
"""

import hashlib
import hmac
import time
import secrets
import logging
from functools import wraps
from datetime import datetime, timedelta
from flask import request, jsonify, g
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────────
# Security Configuration
# ─────────────────────────────────────────────────────────────────────────────────

SECURITY_CONFIG = {
    'request_signature_required': True,
    'signature_ttl_seconds': 300,  # 5 minutes
    'max_request_size': 10 * 1024 * 1024,  # 10MB
    'rate_limit_window': 60,  # 1 minute
    'max_failed_attempts': 10,
    'ban_duration_minutes': 30,
    'require_https': True,
    'content_security_policy': True,
    'enable_audit_logging': True,
}

# In-memory stores (use Redis in production)
_failed_attempts = defaultdict(list)
_banned_ips = {}
_rate_limit_store = defaultdict(list)
_nonces = set()
_nonces_lock = threading.Lock()

# ─────────────────────────────────────────────────────────────────────────────────
# Request Signature Verification
# ─────────────────────────────────────────────────────────────────────────────────

def generate_signature(payload: str, timestamp: str, nonce: str, secret_key: str) -> str:
    """Generate HMAC-SHA256 signature for request"""
    message = f"{payload}:{timestamp}:{nonce}"
    signature = hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    return signature


def verify_request_signature(f):
    """Decorator to verify request signature"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not SECURITY_CONFIG['request_signature_required']:
            return f(*args, **kwargs)
        
        # Skip for GET requests without body
        if request.method == 'GET' and not request.data:
            return f(*args, **kwargs)
        
        signature = request.headers.get('X-Signature')
        timestamp = request.headers.get('X-Timestamp')
        nonce = request.headers.get('X-Nonce')
        
        if not all([signature, timestamp, nonce]):
            logger.warning(f"[Security] Missing signature headers from {request.remote_addr}")
            return jsonify({'error': 'Missing security headers'}), 401
        
        # Check timestamp (prevent replay attacks)
        try:
            ts = int(timestamp)
            if abs(time.time() - ts) > SECURITY_CONFIG['signature_ttl_seconds']:
                logger.warning(f"[Security] Expired timestamp from {request.remote_addr}")
                return jsonify({'error': 'Request expired'}), 401
        except ValueError:
            return jsonify({'error': 'Invalid timestamp'}), 401
        
        # Check nonce (prevent replay)
        with _nonces_lock:
            if nonce in _nonces:
                logger.warning(f"[Security] Duplicate nonce from {request.remote_addr}")
                return jsonify({'error': 'Duplicate request'}), 401
            _nonces.add(nonce)
            # Clean old nonces
            if len(_nonces) > 10000:
                _nonces.clear()
        
        # Verify signature
        from flask import current_app
        secret = current_app.config.get('SECRET_KEY', 'default-secret')
        payload = request.get_data(as_text=True)
        expected = generate_signature(payload, timestamp, nonce, secret)
        
        if not hmac.compare_digest(signature, expected):
            logger.warning(f"[Security] Invalid signature from {request.remote_addr}")
            return jsonify({'error': 'Invalid signature'}), 401
        
        return f(*args, **kwargs)
    return decorated_function


# ─────────────────────────────────────────────────────────────────────────────────
# Rate Limiting
# ─────────────────────────────────────────────────────────────────────────────────

def rate_limit(max_requests: int = 100, window_seconds: int = 60, key_func=None):
    """Advanced rate limiting decorator"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Get rate limit key
            if key_func:
                key = key_func()
            else:
                key = get_jwt_identity() or request.remote_addr
            
            # Check if IP is banned
            if key in _banned_ips:
                ban_expiry = _banned_ips[key]
                if datetime.utcnow() < ban_expiry:
                    logger.warning(f"[Security] Banned IP/ user {key} attempted access")
                    return jsonify({
                        'error': 'Account temporarily locked',
                        'retry_after': int((ban_expiry - datetime.utcnow()).total_seconds())
                    }), 429
                else:
                    del _banned_ips[key]
            
            # Check rate limit
            now = time.time()
            window_start = now - window_seconds
            
            # Clean old requests
            _rate_limit_store[key] = [
                t for t in _rate_limit_store[key] if t > window_start
            ]
            
            if len(_rate_limit_store[key]) >= max_requests:
                logger.warning(f"[Security] Rate limit exceeded for {key}")
                return jsonify({
                    'error': 'Rate limit exceeded',
                    'retry_after': int(window_seconds - (now - _rate_limit_store[key][0]))
                }), 429
            
            _rate_limit_store[key].append(now)
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


def check_failed_attempts(ip: str) -> bool:
    """Check if IP has too many failed attempts"""
    attempts = _failed_attempts.get(ip, [])
    now = time.time()
    
    # Clean old attempts (older than 1 hour)
    attempts = [t for t in attempts if now - t < 3600]
    _failed_attempts[ip] = attempts
    
    return len(attempts) >= SECURITY_CONFIG['max_failed_attempts']


def record_failed_attempt(ip: str):
    """Record a failed login attempt"""
    _failed_attempts[ip].append(time.time())
    
    if check_failed_attempts(ip):
        # Ban the IP
        ban_expiry = datetime.utcnow() + timedelta(minutes=SECURITY_CONFIG['ban_duration_minutes'])
        _banned_ips[ip] = ban_expiry
        logger.warning(f"[Security] IP {ip} banned until {ban_expiry}")


def clear_failed_attempts(ip: str):
    """Clear failed attempts on successful login"""
    if ip in _failed_attempts:
        del _failed_attempts[ip]


# ─────────────────────────────────────────────────────────────────────────────────
# Input Validation & Sanitization
# ─────────────────────────────────────────────────────────────────────────────────

def validate_input(f):
    """Validate and sanitize all input"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Check request size
        if request.content_length and request.content_length > SECURITY_CONFIG['max_request_size']:
            return jsonify({'error': 'Request too large'}), 413
        
        # Sanitize JSON body
        if request.is_json:
            try:
                data = request.get_json()
                if data:
                    sanitized = sanitize_dict(data)
                    request._cached_json = (sanitized, True)
            except Exception as e:
                logger.warning(f"[Security] Invalid JSON: {e}")
                return jsonify({'error': 'Invalid request body'}), 400
        
        # Check for null bytes
        if request.data and b'\x00' in request.data:
            logger.warning(f"[Security] Null bytes in request from {request.remote_addr}")
            return jsonify({'error': 'Invalid characters in request'}), 400
        
        return f(*args, **kwargs)
    return decorated_function


def sanitize_dict(data: dict, max_depth: int = 10) -> dict:
    """Recursively sanitize dictionary values"""
    if max_depth <= 0:
        return data
    
    result = {}
    for key, value in data.items():
        # Sanitize key
        if isinstance(key, str):
            key = sanitize_string(key)
        
        # Sanitize value
        if isinstance(value, str):
            value = sanitize_string(value)
        elif isinstance(value, dict):
            value = sanitize_dict(value, max_depth - 1)
        elif isinstance(value, list):
            value = [sanitize_string(v) if isinstance(v, str) else v for v in value]
        
        result[key] = value
    
    return result


def sanitize_string(s: str, max_length: int = 10000) -> str:
    """Sanitize a string value"""
    # Remove null bytes
    s = s.replace('\x00', '')
    
    # Limit length
    if len(s) > max_length:
        s = s[:max_length]
    
    # Strip whitespace
    s = s.strip()
    
    return s


# ─────────────────────────────────────────────────────────────────────────────────
# CSRF Protection
# ─────────────────────────────────────────────────────────────────────────────────

def generate_csrf_token() -> str:
    """Generate a CSRF token"""
    return secrets.token_urlsafe(32)


def validate_csrf_token(f):
    """Validate CSRF token for state-changing requests"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method in ['GET', 'HEAD', 'OPTIONS']:
            return f(*args, **kwargs)
        
        token = request.headers.get('X-CSRF-Token')
        cookie_token = request.cookies.get('csrf_token')
        
        if not token or not cookie_token:
            logger.warning(f"[Security] Missing CSRF token from {request.remote_addr}")
            return jsonify({'error': 'CSRF token required'}), 403
        
        if not hmac.compare_digest(token, cookie_token):
            logger.warning(f"[Security] Invalid CSRF token from {request.remote_addr}")
            return jsonify({'error': 'Invalid CSRF token'}), 403
        
        return f(*args, **kwargs)
    return decorated_function


# ─────────────────────────────────────────────────────────────────────────────────
# Security Headers Middleware
# ─────────────────────────────────────────────────────────────────────────────────

def add_security_headers(response):
    """Add comprehensive security headers to all responses"""
    
    # Prevent clickjacking
    response.headers['X-Frame-Options'] = 'DENY'
    
    # Prevent MIME-type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # XSS Protection
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Referrer Policy
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    
    # Content Security Policy
    if SECURITY_CONFIG['content_security_policy']:
        response.headers['Content-Security-Policy'] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: blob: https:; "
            "media-src 'self' blob:; "
            "connect-src 'self' wss: https:; "
            "font-src 'self'; "
            "object-src 'none'; "
            "frame-ancestors 'none'; "
            "form-action 'self'; "
            "base-uri 'self';"
        )
    
    # HSTS (HTTPS enforcement)
    if SECURITY_CONFIG['require_https']:
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
    
    # Permissions Policy
    response.headers['Permissions-Policy'] = (
        'geolocation=(self), '
        'microphone=(self), '
        'camera=(self), '
        'fullscreen=(self), '
        'payment=()'
    )
    
    # Remove server fingerprinting
    response.headers.pop('Server', None)
    response.headers.pop('X-Powered-By', None)
    
    # Prevent caching of API responses
    if request.path.startswith('/api/'):
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    
    return response


# ─────────────────────────────────────────────────────────────────────────────────
# Audit Logging
# ─────────────────────────────────────────────────────────────────────────────────

def audit_log(action: str, include_body: bool = False):
    """Log security-relevant actions"""
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            user_id = None
            try:
                verify_jwt_in_request(optional=True)
                user_id = get_jwt_identity()
            except:
                pass
            
            # Log the request
            log_data = {
                'timestamp': datetime.utcnow().isoformat(),
                'action': action,
                'user_id': user_id,
                'ip': request.remote_addr,
                'method': request.method,
                'path': request.path,
                'user_agent': request.user_agent.string[:255] if request.user_agent else None,
            }
            
            if include_body and request.is_json:
                body = request.get_json()
                # Remove sensitive fields
                safe_body = {k: v for k, v in (body or {}).items() 
                           if k not in ['password', 'token', 'secret', 'key']}
                log_data['body'] = safe_body
            
            logger.info(f"[AUDIT] {log_data}")
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator


# ─────────────────────────────────────────────────────────────────────────────────
# Encryption Utilities
# ─────────────────────────────────────────────────────────────────────────────────

def encrypt_data(data: str, key: str) -> str:
    """Encrypt sensitive data using AES-256-GCM"""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import os
        
        aesgcm = AESGCM(key.encode()[:32].ljust(32, b'\0'))
        nonce = os.urandom(12)
        
        encrypted = aesgcm.encrypt(nonce, data.encode(), None)
        
        # Return nonce + ciphertext (base64)
        import base64
        return base64.b64encode(nonce + encrypted).decode()
    except Exception as e:
        logger.error(f"[Security] Encryption failed: {e}")
        raise


def decrypt_data(encrypted_data: str, key: str) -> str:
    """Decrypt data encrypted with encrypt_data"""
    try:
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        import base64
        
        aesgcm = AESGCM(key.encode()[:32].ljust(32, b'\0'))
        
        # Decode and split nonce/ciphertext
        raw = base64.b64decode(encrypted_data)
        nonce = raw[:12]
        ciphertext = raw[12:]
        
        decrypted = aesgcm.decrypt(nonce, ciphertext, None)
        return decrypted.decode()
    except Exception as e:
        logger.error(f"[Security] Decryption failed: {e}")
        raise


# ─────────────────────────────────────────────────────────────────────────────────
# Security Middleware Class
# ─────────────────────────────────────────────────────────────────────────────────

class SecurityMiddleware:
    """Flask middleware for security features"""
    
    def __init__(self, app=None):
        self.app = app
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize security middleware with Flask app"""
        # Add security headers to all responses
        app.after_request(add_security_headers)
        
        # Register before_request handler
        @app.before_request
        def before_request():
            g.request_start_time = time.time()
            
            # Check if IP is banned
            ip = request.remote_addr
            if ip in _banned_ips:
                ban_expiry = _banned_ips[ip]
                if datetime.utcnow() < ban_expiry:
                    return jsonify({
                        'error': 'Access denied',
                        'reason': 'IP temporarily blocked'
                    }), 403
                else:
                    del _banned_ips[ip]
            
            # Validate request for API endpoints
            if request.path.startswith('/api/'):
                # Check request size
                if request.content_length and request.content_length > SECURITY_CONFIG['max_request_size']:
                    return jsonify({'error': 'Request too large'}), 413
        
        logger.info("[Security] Middleware initialized")
