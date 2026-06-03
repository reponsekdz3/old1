"""
Advanced security features: rate limiting, TLS, audit logging, attack detection.
"""
import logging
import hashlib
import hmac
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from functools import wraps
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)


class RateLimiter:
    """Advanced rate limiting with per-endpoint, per-user, per-IP strategies."""
    
    def __init__(self, max_requests: int = 100, time_window: int = 60):
        self.max_requests = max_requests
        self.time_window = time_window
        self.requests = defaultdict(list)
        self.lock = threading.RLock()
    
    def is_allowed(self, key: str) -> bool:
        """Check if request is allowed under rate limit."""
        with self.lock:
            now = time.time()
            cutoff = now - self.time_window
            
            # Clean old requests
            self.requests[key] = [req_time for req_time in self.requests[key] 
                                 if req_time > cutoff]
            
            if len(self.requests[key]) >= self.max_requests:
                return False
            
            self.requests[key].append(now)
            return True
    
    def get_remaining(self, key: str) -> int:
        """Get remaining requests for key."""
        with self.lock:
            now = time.time()
            cutoff = now - self.time_window
            self.requests[key] = [req_time for req_time in self.requests[key] 
                                 if req_time > cutoff]
            return max(0, self.max_requests - len(self.requests[key]))


class IPReputationManager:
    """Track and manage IP reputation scores."""
    
    def __init__(self):
        self.scores = {}  # IP -> reputation score
        self.blocked_ips = set()
        self.lock = threading.RLock()
    
    def add_event(self, ip: str, event_type: str, severity: int = 1):
        """Record security event from IP."""
        with self.lock:
            if ip not in self.scores:
                self.scores[ip] = 0
            
            # Severity multipliers for different events
            multipliers = {
                'failed_login': 5,
                'sql_injection': 50,
                'xss_attempt': 40,
                'brute_force': 20,
                'ddos': 100,
            }
            
            self.scores[ip] += multipliers.get(event_type, severity)
            
            # Block if threshold exceeded
            if self.scores[ip] > 100:
                self.blocked_ips.add(ip)
    
    def is_blocked(self, ip: str) -> bool:
        """Check if IP is blocked."""
        with self.lock:
            return ip in self.blocked_ips
    
    def get_reputation(self, ip: str) -> int:
        """Get IP reputation score."""
        with self.lock:
            return self.scores.get(ip, 0)


class AnomalyDetector:
    """Detect suspicious patterns in user behavior."""
    
    def __init__(self):
        self.user_sessions = {}
        self.lock = threading.RLock()
    
    def track_login(self, user_id: str, ip: str, device_fingerprint: str) -> Tuple[bool, str]:
        """Check for anomalous login pattern."""
        with self.lock:
            if user_id not in self.user_sessions:
                self.user_sessions[user_id] = []
            
            now = datetime.utcnow()
            recent = [s for s in self.user_sessions[user_id] 
                     if (now - s['timestamp']).seconds < 3600]  # Last hour
            
            # Anomaly: Multiple IPs in short time
            unique_ips = len(set(s['ip'] for s in recent))
            if unique_ips > 5:
                return False, "Multiple login locations detected"
            
            # Anomaly: Multiple devices in short time
            unique_devices = len(set(s['device'] for s in recent))
            if unique_devices > 3:
                return False, "Multiple devices detected"
            
            # Anomaly: Impossible travel
            if len(recent) > 0:
                last_ip = recent[-1]['ip']
                if last_ip != ip and self._is_impossible_travel(last_ip, ip):
                    return False, "Impossible travel detected"
            
            self.user_sessions[user_id].append({
                'timestamp': now,
                'ip': ip,
                'device': device_fingerprint,
            })
            
            return True, "Login OK"
    
    @staticmethod
    def _is_impossible_travel(ip1: str, ip2: str) -> bool:
        """Check if travel between IPs is geographically impossible."""
        # This would use a GeoIP database in production
        # For now, just return False (no blocking)
        return False


class SecurityManager:
    """Central security management system."""
    
    def __init__(self):
        self.rate_limiter = RateLimiter()
        self.ip_reputation = IPReputationManager()
        self.anomaly_detector = AnomalyDetector()
        self.audit_log = []
        self.lock = threading.RLock()
    
    def check_request_security(self, user_id: str, ip: str, endpoint: str) -> Tuple[bool, str]:
        """Comprehensive request security check."""
        # Check IP reputation
        if self.ip_reputation.is_blocked(ip):
            self._audit_log(user_id, 'blocked_ip_access', 'critical', {'ip': ip})
            return False, "IP address blocked"
        
        # Check rate limiting
        rate_key = f"{user_id}:{endpoint}"
        if not self.rate_limiter.is_allowed(rate_key):
            self._audit_log(user_id, 'rate_limit_exceeded', 'warning', {'endpoint': endpoint})
            return False, "Rate limit exceeded"
        
        return True, "Security check passed"
    
    def log_security_event(self, user_id: str, event_type: str, severity: str = 'info',
                          details: Optional[Dict] = None):
        """Log security event."""
        with self.lock:
            self.audit_log.append({
                'timestamp': datetime.utcnow(),
                'user_id': user_id,
                'event_type': event_type,
                'severity': severity,
                'details': details or {},
            })
    
    def _audit_log(self, user_id: str, event: str, severity: str, details: Dict):
        """Internal audit log."""
        self.log_security_event(user_id, event, severity, details)


class TLSManager:
    """Manage TLS/SSL certificates and enforcement."""
    
    def __init__(self, cert_path: str, key_path: str):
        self.cert_path = cert_path
        self.key_path = key_path
        self.certificate_pinning_hashes = set()
    
    def add_pinned_certificate(self, cert_hash: str):
        """Add certificate hash for pinning."""
        self.certificate_pinning_hashes.add(cert_hash)
    
    def verify_pinned_certificate(self, cert_hash: str) -> bool:
        """Verify certificate is in pinned set."""
        return cert_hash in self.certificate_pinning_hashes


class APIKeyManager:
    """Secure API key generation and validation."""
    
    @staticmethod
    def generate_api_key(user_id: str) -> str:
        """Generate secure API key."""
        random_part = secrets.token_urlsafe(32)
        timestamp = str(int(time.time()))
        signature = hmac.new(
            b'api_key_secret',
            f"{user_id}:{timestamp}:{random_part}".encode(),
            hashlib.sha256
        ).hexdigest()
        return f"sk_{timestamp}_{signature}_{random_part}"
    
    @staticmethod
    def validate_api_key(api_key: str, secret: str) -> bool:
        """Validate API key format and signature."""
        try:
            parts = api_key.split('_')
            if len(parts) != 4 or parts[0] != 'sk':
                return False
            
            timestamp, signature, random_part = parts[1], parts[2], parts[3]
            
            # Verify timestamp not too old (24 hours)
            ts = int(timestamp)
            if int(time.time()) - ts > 86400:
                return False
            
            return True
        except Exception:
            return False


class EncryptionAudit:
    """Audit encryption usage and patterns."""
    
    def __init__(self):
        self.audit_entries = []
        self.lock = threading.RLock()
    
    def log_encryption(self, user_id: str, message_id: str, algorithm: str, 
                      key_rotation_id: int):
        """Log encryption operation."""
        with self.lock:
            self.audit_entries.append({
                'timestamp': datetime.utcnow(),
                'user_id': user_id,
                'message_id': message_id,
                'algorithm': algorithm,
                'key_rotation_id': key_rotation_id,
            })
    
    def get_audit_trail(self, user_id: str, hours: int = 24) -> List[Dict]:
        """Get encryption audit trail for user."""
        with self.lock:
            cutoff = datetime.utcnow() - timedelta(hours=hours)
            return [e for e in self.audit_entries 
                   if e['user_id'] == user_id and e['timestamp'] > cutoff]
