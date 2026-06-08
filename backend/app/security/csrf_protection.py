"""
CSRF Protection for VipChat API
Implements token-based CSRF protection for state-changing operations
"""
from flask import request, jsonify, session
from functools import wraps
import secrets
import hmac
import hashlib
import time

class CSRFProtection:
    def __init__(self, app=None):
        self.app = app
        self.secret_key = None
        self.token_duration = 3600  # 1 hour
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        self.app = app
        self.secret_key = app.config.get('SECRET_KEY', 'default-secret')
        app.before_request(self._before_request)
    
    def generate_token(self):
        """Generate a CSRF token"""
        timestamp = str(int(time.time()))
        random_data = secrets.token_hex(32)
        data = f"{timestamp}:{random_data}"
        
        signature = hmac.new(
            self.secret_key.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        
        token = f"{data}:{signature}"
        session['csrf_token'] = token
        return token
    
    def validate_token(self, token):
        """Validate CSRF token"""
        if not token:
            return False
        
        try:
            parts = token.split(':')
            if len(parts) != 3:
                return False
            
            timestamp, random_data, signature = parts
            
            # Check expiration
            token_time = int(timestamp)
            if time.time() - token_time > self.token_duration:
                return False
            
            # Verify signature
            data = f"{timestamp}:{random_data}"
            expected_sig = hmac.new(
                self.secret_key.encode(),
                data.encode(),
                hashlib.sha256
            ).hexdigest()
            
            return hmac.compare_digest(signature, expected_sig)
        except Exception:
            return False
    
    # Public routes that are exempt from CSRF (they use rate limiting + other protections)
    EXEMPT_PATHS = {
        '/api/auth/signup',
        '/api/auth/login',
        '/api/auth/send-verification-sms',
        '/api/auth/send-reconfirmation-sms',
        '/api/auth/verify-sms',
        '/api/auth/refresh',
        '/api/auth/qr-session/create',
        '/api/auth/qr-session/confirm',
        '/api/payments/stripe/webhook',
        '/api/payments/flutterwave/webhook',
        '/api/csrf-token',
    }

    def _before_request(self):
        """Check CSRF token on mutating requests"""
        if request.method in ['POST', 'PUT', 'DELETE', 'PATCH']:
            # Skip CSRF for exempt public routes
            if request.path in self.EXEMPT_PATHS:
                return

            # Skip CSRF for API with JWT (already protected by token auth)
            if request.headers.get('Authorization'):
                return

            token = request.headers.get('X-CSRF-Token') or request.form.get('csrf_token')

            if not token or not self.validate_token(token):
                return jsonify({'error': 'Invalid CSRF token'}), 403

def csrf_protect(f):
    """Decorator to require CSRF token validation"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        token = request.headers.get('X-CSRF-Token')
        
        if not token:
            return jsonify({'error': 'CSRF token required'}), 403
        
        csrf = CSRFProtection()
        if not csrf.validate_token(token):
            return jsonify({'error': 'Invalid CSRF token'}), 403
        
        return f(*args, **kwargs)
    return wrapper

csrf_protection = CSRFProtection()
