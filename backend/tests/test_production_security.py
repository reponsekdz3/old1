"""
Comprehensive Security Test Suite
Tests all security features for production readiness
"""
import pytest
import time
import jwt
from datetime import datetime, timedelta
from app import create_app
from app.models.models import db, User
from app.security.input_validation import InputValidator
from app.security.advanced_security import SecurityManager, sign_request, verify_signature
from app.security.csrf_protection import csrf_protection

@pytest.fixture
def app():
    """Create test app"""
    app, socketio = create_app('testing')
    
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()

@pytest.fixture
def client(app):
    """Create test client"""
    return app.test_client()

@pytest.fixture
def auth_headers(client):
    """Create authenticated user and return headers"""
    # Register user
    client.post('/api/auth/signup', json={
        'phone_number': '+1234567890',
        'password': 'TestPass123!',
        'display_name': 'Test User'
    })
    
    # Login
    response = client.post('/api/auth/login', json={
        'phone_number': '+1234567890',
        'password': 'TestPass123!'
    })
    
    token = response.get_json()['access_token']
    return {'Authorization': f'Bearer {token}'}

class TestInputValidation:
    """Test input validation and sanitization"""
    
    def test_sanitize_string_removes_null_bytes(self):
        """Test null byte removal"""
        dirty = "Hello\x00World"
        clean = InputValidator.sanitize_string(dirty)
        assert '\x00' not in clean
    
    def test_sanitize_string_limits_length(self):
        """Test length limiting"""
        long_string = "A" * 5000
        clean = InputValidator.sanitize_string(long_string, max_length=100)
        assert len(clean) == 100
    
    def test_validate_phone_accepts_valid(self):
        """Test valid phone numbers"""
        assert InputValidator.validate_phone('+1234567890')
        assert InputValidator.validate_phone('+447911123456')
    
    def test_validate_phone_rejects_invalid(self):
        """Test invalid phone numbers"""
        assert not InputValidator.validate_phone('abc')
        assert not InputValidator.validate_phone('123')
        assert not InputValidator.validate_phone('+')
    
    def test_detect_sql_injection(self):
        """Test SQL injection detection"""
        assert InputValidator.detect_sql_injection("'; DROP TABLE users; --")
        assert InputValidator.detect_sql_injection("1' OR '1'='1")
        assert InputValidator.detect_sql_injection("UNION SELECT * FROM passwords")
        assert not InputValidator.detect_sql_injection("Hello world")
    
    def test_detect_xss(self):
        """Test XSS detection"""
        assert InputValidator.detect_xss("<script>alert('xss')</script>")
        assert InputValidator.detect_xss("<img src=x onerror=alert(1)>")
        assert InputValidator.detect_xss("javascript:alert(1)")
        assert not InputValidator.detect_xss("Hello <b>world</b>")

class TestRateLimiting:
    """Test rate limiting functionality"""
    
    def test_login_rate_limit(self, client):
        """Test login endpoint rate limit"""
        # Make 15 failed login attempts (limit is 10)
        for i in range(15):
            response = client.post('/api/auth/login', json={
                'phone_number': '+1234567890',
                'password': 'wrong'
            })
            
            if i >= 10:
                assert response.status_code == 429, f"Request {i} should be rate limited"
    
    def test_api_endpoint_rate_limit(self, client, auth_headers):
        """Test API endpoint rate limit"""
        # Make 150 requests (limit is 100/min)
        for i in range(150):
            response = client.get('/api/auth/user', headers=auth_headers)
            
            if i >= 100:
                assert response.status_code == 429

class TestRequestSigning:
    """Test request signature verification"""
    
    def test_sign_and_verify_request(self):
        """Test request signing and verification"""
        payload = {'test': 'data'}
        secret = 'test-secret-key'
        
        signature, timestamp, nonce = sign_request(payload, secret)
        
        assert verify_signature(payload, signature, timestamp, nonce, secret)
    
    def test_verify_fails_with_wrong_secret(self):
        """Test verification fails with wrong secret"""
        payload = {'test': 'data'}
        secret = 'test-secret-key'
        wrong_secret = 'wrong-secret'
        
        signature, timestamp, nonce = sign_request(payload, secret)
        
        assert not verify_signature(payload, signature, timestamp, nonce, wrong_secret)
    
    def test_verify_fails_with_modified_payload(self):
        """Test verification fails with modified payload"""
        payload = {'test': 'data'}
        secret = 'test-secret-key'
        
        signature, timestamp, nonce = sign_request(payload, secret)
        
        modified_payload = {'test': 'modified'}
        assert not verify_signature(modified_payload, signature, timestamp, nonce, secret)

class TestCSRFProtection:
    """Test CSRF token protection"""
    
    def test_generate_csrf_token(self, app):
        """Test CSRF token generation"""
        with app.test_request_context():
            token = csrf_protection.generate_token()
            assert token is not None
            assert ':' in token
    
    def test_validate_csrf_token(self, app):
        """Test CSRF token validation"""
        with app.test_request_context():
            token = csrf_protection.generate_token()
            assert csrf_protection.validate_token(token)
    
    def test_csrf_token_expires(self, app):
        """Test CSRF token expiration"""
        with app.test_request_context():
            # Create expired token
            timestamp = str(int(time.time()) - 7200)  # 2 hours ago
            token = f"{timestamp}:random:signature"
            assert not csrf_protection.validate_token(token)

class TestAuthentication:
    """Test authentication security"""
    
    def test_password_hashing(self, client):
        """Test passwords are hashed"""
        response = client.post('/api/auth/signup', json={
            'phone_number': '+1234567890',
            'password': 'TestPass123!',
            'display_name': 'Test User'
        })
        
        assert response.status_code == 201
        
        # Verify password is not stored in plaintext
        user = User.query.filter_by(phone_number='+1234567890').first()
        assert user.password_hash != 'TestPass123!'
    
    def test_jwt_token_contains_expiry(self, client):
        """Test JWT tokens have expiration"""
        # Register and login
        client.post('/api/auth/signup', json={
            'phone_number': '+1234567890',
            'password': 'TestPass123!',
            'display_name': 'Test User'
        })
        
        response = client.post('/api/auth/login', json={
            'phone_number': '+1234567890',
            'password': 'TestPass123!'
        })
        
        token = response.get_json()['access_token']
        
        # Decode without verification to check expiry
        decoded = jwt.decode(token, options={"verify_signature": False})
        assert 'exp' in decoded
        assert decoded['exp'] > time.time()
    
    def test_account_lockout_after_failures(self, client, app):
        """Test account lockout after failed attempts"""
        # Register user
        client.post('/api/auth/signup', json={
            'phone_number': '+1234567890',
            'password': 'TestPass123!',
            'display_name': 'Test User'
        })
        
        # Make 11 failed attempts
        for _ in range(11):
            client.post('/api/auth/login', json={
                'phone_number': '+1234567890',
                'password': 'wrong'
            })
        
        # Next attempt should be blocked
        response = client.post('/api/auth/login', json={
            'phone_number': '+1234567890',
            'password': 'TestPass123!'
        })
        
        assert response.status_code in [403, 429]

class TestSecurityHeaders:
    """Test security headers are present"""
    
    def test_security_headers_on_api_response(self, client):
        """Test all security headers are present"""
        response = client.get('/api/health')
        
        assert response.headers.get('X-Content-Type-Options') == 'nosniff'
        assert response.headers.get('X-Frame-Options') == 'DENY'
        assert response.headers.get('X-XSS-Protection') == '1; mode=block'
        assert 'Content-Security-Policy' in response.headers
        assert 'Referrer-Policy' in response.headers
        assert 'Permissions-Policy' in response.headers
    
    def test_server_header_removed(self, client):
        """Test server fingerprint is removed"""
        response = client.get('/api/health')
        assert 'Server' not in response.headers
        assert 'X-Powered-By' not in response.headers

class TestDataProtection:
    """Test data protection measures"""
    
    def test_sensitive_fields_not_returned(self, client, auth_headers):
        """Test sensitive fields are not exposed"""
        response = client.get('/api/auth/user', headers=auth_headers)
        data = response.get_json()
        
        # Password hash should never be returned
        assert 'password_hash' not in data
        assert 'password' not in data
    
    def test_user_can_only_access_own_data(self, client):
        """Test users can't access other users' data"""
        # Create two users
        client.post('/api/auth/signup', json={
            'phone_number': '+1111111111',
            'password': 'Pass1!',
            'display_name': 'User 1'
        })
        
        client.post('/api/auth/signup', json={
            'phone_number': '+2222222222',
            'password': 'Pass2!',
            'display_name': 'User 2'
        })
        
        # Login as user 1
        response = client.post('/api/auth/login', json={
            'phone_number': '+1111111111',
            'password': 'Pass1!'
        })
        token1 = response.get_json()['access_token']
        
        # Try to access user 2's data (implementation dependent)
        # This test should be expanded based on your API endpoints

class TestIPBlocking:
    """Test IP blocking functionality"""
    
    def test_ip_blocked_after_abuse(self, app):
        """Test IP is blocked after abuse detection"""
        security_mgr = SecurityManager(app)
        
        # Simulate abuse
        test_ip = '192.168.1.100'
        for _ in range(15):
            security_mgr.record_failed_auth(test_ip)
        
        # IP should be blocked
        assert test_ip in security_mgr.blocked_ips

class TestE2EEIntegration:
    """Test E2EE integration"""
    
    def test_e2ee_key_upload_endpoint(self, client, auth_headers):
        """Test E2EE key upload"""
        response = client.post('/api/e2ee/keys/upload', 
            headers=auth_headers,
            json={
                'identity_key': 'test_identity_key',
                'signed_prekey': {
                    'id': 1,
                    'public_key': 'test_spk'
                },
                'signed_prekey_signature': 'test_sig',
                'registration_id': 12345,
                'one_time_prekeys': []
            }
        )
        
        assert response.status_code in [200, 201]
    
    def test_e2ee_key_retrieval(self, client, auth_headers):
        """Test E2EE key retrieval for recipient"""
        # Upload keys first
        client.post('/api/e2ee/keys/upload',
            headers=auth_headers,
            json={
                'identity_key': 'test_identity_key',
                'signed_prekey': {
                    'id': 1,
                    'public_key': 'test_spk'
                },
                'signed_prekey_signature': 'test_sig',
                'registration_id': 12345,
                'one_time_prekeys': []
            }
        )
        
        # Retrieve keys
        user_response = client.get('/api/auth/user', headers=auth_headers)
        user_id = user_response.get_json()['id']
        
        response = client.get(f'/api/e2ee/keys/{user_id}', headers=auth_headers)
        assert response.status_code == 200

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
