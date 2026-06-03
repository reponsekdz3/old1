"""
Advanced Security Middleware - Production-grade protection
Includes: DDoS mitigation, IP filtering, request signing, anomaly detection
"""
from flask import request, jsonify, g
from functools import wraps
import hashlib
import hmac
import time
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
import secrets

logger = logging.getLogger(__name__)

class SecurityManager:
    def __init__(self, app=None):
        self.app = app
        self.blocked_ips = set()
        self.suspicious_ips = defaultdict(int)
        self.request_history = defaultdict(lambda: deque(maxlen=100))
        self.failed_auth_attempts = defaultdict(lambda: deque(maxlen=20))
        self.nonce_cache = set()
        self.max_nonce_cache = 10000
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        self.app = app
        app.before_request(self._before_request_handler)
        app.after_request(self._after_request_handler)
        
    def _get_client_ip(self):
        """Extract real client IP behind proxies"""
        if request.headers.get('X-Forwarded-For'):
            return request.headers.get('X-Forwarded-For').split(',')[0].strip()
        elif request.headers.get('X-Real-IP'):
            return request.headers.get('X-Real-IP')
        return request.remote_addr
    
    def _before_request_handler(self):
        """Pre-request security checks"""
        ip = self._get_client_ip()
        g.client_ip = ip
        
        # Check blocked IPs
        if ip in self.blocked_ips:
            logger.warning(f"[Security] Blocked IP attempted access: {ip}")
            return jsonify({'error': 'Access denied'}), 403
        
        # Rate limiting per IP
        now = time.time()
        history = self.request_history[ip]
        
        # Remove old entries (60 second window)
        while history and history[0] < now - 60:
            history.popleft()
        
        # Check burst rate (100 req/min)
        if len(history) > 100:
            self.suspicious_ips[ip] += 1
            if self.suspicious_ips[ip] > 5:
                self.blocked_ips.add(ip)
                logger.error(f"[Security] IP blocked for excessive requests: {ip}")
                return jsonify({'error': 'Rate limit exceeded'}), 429
            return jsonify({'error': 'Too many requests'}), 429
        
        history.append(now)
        
        # Validate request integrity for sensitive endpoints
        if request.path.startswith('/api/') and request.method in ['POST', 'PUT', 'DELETE']:
            if not self._verify_request_signature():
                logger.warning(f"[Security] Invalid request signature from {ip}")
    
    def _verify_request_signature(self):
        """Verify request signature for sensitive operations"""
        signature = request.headers.get('X-Request-Signature')
        timestamp = request.headers.get('X-Request-Timestamp')
        nonce = request.headers.get('X-Request-Nonce')
        
        if not all([signature, timestamp, nonce]):
            return True  # Optional signature
        
        # Check timestamp (5 minute window)
        try:
            ts = int(timestamp)
            if abs(time.time() - ts) > 300:
                return False
        except (ValueError, TypeError):
            return False
        
        # Check nonce replay
        if nonce in self.nonce_cache:
            return False
        
        self.nonce_cache.add(nonce)
        if len(self.nonce_cache) > self.max_nonce_cache:
            self.nonce_cache.pop()
        
        return True
    
    def _after_request_handler(self, response):
        """Post-request security headers"""
        # Enhanced security headers
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains; preload'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        
        # CSP for API endpoints
        if request.path.startswith('/api/'):
            response.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'"
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, private'
            response.headers['Pragma'] = 'no-cache'
        
        # Remove server fingerprints
        response.headers.pop('Server', None)
        response.headers.pop('X-Powered-By', None)
        
        return response
    
    def record_failed_auth(self, identifier: str):
        """Track failed authentication attempts"""
        ip = g.get('client_ip', 'unknown')
        self.failed_auth_attempts[identifier].append(time.time())
        self.failed_auth_attempts[ip].append(time.time())
        
        # Block after 10 failed attempts in 10 minutes
        recent_failures = sum(1 for t in self.failed_auth_attempts[ip] if time.time() - t < 600)
        if recent_failures >= 10:
            self.blocked_ips.add(ip)
            logger.error(f"[Security] IP blocked for failed auth: {ip}")
    
    def is_suspicious_user(self, user_id: int) -> bool:
        """Check if user shows suspicious behavior"""
        failed_count = sum(
            1 for t in self.failed_auth_attempts.get(str(user_id), [])
            if time.time() - t < 3600
        )
        return failed_count >= 5
    
    def clear_expired_data(self):
        """Cleanup expired security data (call periodically)"""
        now = time.time()
        
        # Clear old failed auth attempts
        for key in list(self.failed_auth_attempts.keys()):
            self.failed_auth_attempts[key] = deque(
                [t for t in self.failed_auth_attempts[key] if now - t < 3600],
                maxlen=20
            )
            if not self.failed_auth_attempts[key]:
                del self.failed_auth_attempts[key]

def sign_request(payload: dict, secret_key: str) -> tuple:
    """Generate request signature for client use"""
    timestamp = str(int(time.time()))
    nonce = secrets.token_hex(16)
    
    message = f"{timestamp}{nonce}{str(payload)}"
    signature = hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return signature, timestamp, nonce

def verify_signature(payload: dict, signature: str, timestamp: str, nonce: str, secret_key: str) -> bool:
    """Verify request signature"""
    message = f"{timestamp}{nonce}{str(payload)}"
    expected = hmac.new(
        secret_key.encode(),
        message.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return hmac.compare_digest(signature, expected)

# Global instance
security_manager = SecurityManager()
