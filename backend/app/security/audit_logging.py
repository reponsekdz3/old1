"""
Security Audit Logging - Enterprise Grade
Comprehensive logging of security events for compliance and forensics
"""
import logging
import json
from datetime import datetime
from functools import wraps
from flask import request, g
import traceback

class SecurityAuditLogger:
    """Centralized security audit logging"""
    
    def __init__(self, app=None):
        self.app = app
        self.logger = None
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        self.app = app
        self.logger = logging.getLogger('security_audit')
        self.logger.setLevel(logging.INFO)
        
        # File handler for audit logs
        handler = logging.FileHandler('logs/security_audit.log')
        handler.setLevel(logging.INFO)
        
        # JSON formatter for structured logs
        formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": %(message)s}'
        )
        handler.setFormatter(formatter)
        
        self.logger.addHandler(handler)
    
    def log_event(self, event_type, details, severity='INFO', user_id=None):
        """Log security event"""
        event = {
            'event_type': event_type,
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id or g.get('user_id'),
            'ip_address': g.get('client_ip', request.remote_addr),
            'user_agent': request.headers.get('User-Agent'),
            'endpoint': request.endpoint,
            'method': request.method,
            'details': details,
            'severity': severity
        }
        
        log_method = getattr(self.logger, severity.lower(), self.logger.info)
        log_method(json.dumps(event))
    
    def log_auth_attempt(self, phone_number, success, reason=None):
        """Log authentication attempt"""
        self.log_event(
            'AUTH_ATTEMPT',
            {
                'phone_number': phone_number,
                'success': success,
                'reason': reason
            },
            severity='WARNING' if not success else 'INFO'
        )
    
    def log_auth_success(self, user_id, phone_number):
        """Log successful authentication"""
        self.log_event(
            'AUTH_SUCCESS',
            {
                'phone_number': phone_number,
                'login_method': 'password'
            },
            user_id=user_id
        )
    
    def log_auth_failure(self, phone_number, reason):
        """Log failed authentication"""
        self.log_event(
            'AUTH_FAILURE',
            {
                'phone_number': phone_number,
                'reason': reason
            },
            severity='WARNING'
        )
    
    def log_permission_denied(self, resource, action, user_id=None):
        """Log permission denied"""
        self.log_event(
            'PERMISSION_DENIED',
            {
                'resource': resource,
                'action': action
            },
            severity='WARNING',
            user_id=user_id
        )
    
    def log_data_access(self, resource_type, resource_id, action='read'):
        """Log data access"""
        self.log_event(
            'DATA_ACCESS',
            {
                'resource_type': resource_type,
                'resource_id': resource_id,
                'action': action
            }
        )
    
    def log_data_modification(self, resource_type, resource_id, action, changes=None):
        """Log data modification"""
        self.log_event(
            'DATA_MODIFICATION',
            {
                'resource_type': resource_type,
                'resource_id': resource_id,
                'action': action,
                'changes': changes
            },
            severity='WARNING'
        )
    
    def log_security_incident(self, incident_type, details):
        """Log security incident"""
        self.log_event(
            'SECURITY_INCIDENT',
            {
                'incident_type': incident_type,
                'details': details
            },
            severity='ERROR'
        )
    
    def log_rate_limit_exceeded(self, endpoint, limit):
        """Log rate limit exceeded"""
        self.log_event(
            'RATE_LIMIT_EXCEEDED',
            {
                'endpoint': endpoint,
                'limit': limit
            },
            severity='WARNING'
        )
    
    def log_ip_blocked(self, ip_address, reason):
        """Log IP block"""
        self.log_event(
            'IP_BLOCKED',
            {
                'blocked_ip': ip_address,
                'reason': reason
            },
            severity='ERROR'
        )
    
    def log_suspicious_activity(self, activity_type, details):
        """Log suspicious activity"""
        self.log_event(
            'SUSPICIOUS_ACTIVITY',
            {
                'activity_type': activity_type,
                'details': details
            },
            severity='WARNING'
        )
    
    def log_exception(self, exception, context=None):
        """Log exception with traceback"""
        self.log_event(
            'EXCEPTION',
            {
                'exception_type': type(exception).__name__,
                'message': str(exception),
                'traceback': traceback.format_exc(),
                'context': context
            },
            severity='ERROR'
        )

def audit_log(event_type):
    """Decorator to automatically log endpoint access"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            logger = SecurityAuditLogger()
            
            # Log access
            logger.log_event(event_type, {
                'endpoint': request.endpoint,
                'args': str(args),
                'kwargs': str(kwargs)
            })
            
            try:
                result = f(*args, **kwargs)
                return result
            except Exception as e:
                logger.log_exception(e, {'endpoint': request.endpoint})
                raise
        return wrapper
    return decorator

# Global instance
security_audit = SecurityAuditLogger()
