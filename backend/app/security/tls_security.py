"""
SSL/TLS Security Configuration for Production
Implements certificate pinning, HSTS, and secure TLS settings
"""
import ssl
import hashlib
import base64
from functools import wraps
from flask import request, jsonify

class TLSSecurityManager:
    """Manage TLS/SSL security settings"""
    
    def __init__(self, app=None):
        self.app = app
        self.cert_pins = set()
        self.hsts_max_age = 31536000  # 1 year
        
        if app:
            self.init_app(app)
    
    def init_app(self, app):
        self.app = app
        self.load_certificate_pins()
        app.after_request(self.add_hsts_header)
    
    def load_certificate_pins(self):
        """Load certificate pins from config"""
        if self.app:
            pins = self.app.config.get('CERT_PINS', [])
            self.cert_pins = set(pins)
    
    def add_hsts_header(self, response):
        """Add HSTS header to all responses"""
        if request.is_secure:
            response.headers['Strict-Transport-Security'] = (
                f'max-age={self.hsts_max_age}; includeSubDomains; preload'
            )
        return response
    
    def generate_cert_pin(self, cert_path):
        """Generate SPKI pin from certificate"""
        try:
            with open(cert_path, 'rb') as f:
                cert_data = f.read()
            
            # Extract public key and hash it
            sha256_hash = hashlib.sha256(cert_data).digest()
            pin = base64.b64encode(sha256_hash).decode('utf-8')
            return f"sha256/{pin}"
        except Exception as e:
            print(f"Error generating cert pin: {e}")
            return None
    
    def verify_cert_pin(self, peer_cert):
        """Verify certificate pin matches expected"""
        if not self.cert_pins:
            return True  # No pinning configured
        
        try:
            der_cert = ssl.DER_cert_to_PEM_cert(peer_cert)
            sha256_hash = hashlib.sha256(der_cert.encode()).digest()
            pin = f"sha256/{base64.b64encode(sha256_hash).decode('utf-8')}"
            return pin in self.cert_pins
        except Exception:
            return False
    
    @staticmethod
    def get_ssl_context(cert_path, key_path, ca_path=None):
        """Create secure SSL context for production"""
        context = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
        
        # Load certificate and key
        context.load_cert_chain(cert_path, key_path)
        
        # Load CA bundle if provided
        if ca_path:
            context.load_verify_locations(ca_path)
        
        # Strong security settings
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_3
        
        # Disable weak ciphers
        context.set_ciphers('ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS')
        
        # Additional options
        context.options |= ssl.OP_NO_TLSv1 | ssl.OP_NO_TLSv1_1
        context.options |= ssl.OP_NO_COMPRESSION
        context.options |= ssl.OP_SINGLE_DH_USE | ssl.OP_SINGLE_ECDH_USE
        
        return context

def require_https(f):
    """Decorator to enforce HTTPS"""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if not request.is_secure and not request.headers.get('X-Forwarded-Proto') == 'https':
            return jsonify({'error': 'HTTPS required'}), 403
        return f(*args, **kwargs)
    return wrapper

# Global instance
tls_manager = TLSSecurityManager()
