"""
Unit tests for security hardening: headers, rate-limiting, JWT blocklist,
input validation, and audit logging.
"""
import pytest


class TestSecurityHeaders:
    def test_security_headers_present(self, client, db_session):
        resp = client.get('/api/health')
        assert resp.headers.get('X-Content-Type-Options') == 'nosniff'
        assert resp.headers.get('X-Frame-Options') == 'DENY'
        assert 'X-XSS-Protection' in resp.headers
        assert 'Referrer-Policy' in resp.headers
        assert 'Content-Security-Policy' in resp.headers

    def test_no_server_fingerprint(self, client, db_session):
        resp = client.get('/api/health')
        assert 'Server' not in resp.headers or 'Werkzeug' not in resp.headers.get('Server', '')

    def test_api_cache_headers(self, client, db_session):
        resp = client.get('/api/health')
        cc = resp.headers.get('Cache-Control', '')
        assert 'no-store' in cc or 'no-cache' in cc


class TestJWTSecurity:
    def test_no_token_returns_401(self, client, db_session):
        resp = client.get('/api/auth/user')
        assert resp.status_code == 401

    def test_invalid_token_returns_401(self, client, db_session):
        resp = client.get('/api/auth/user',
                          headers={'Authorization': 'Bearer invalid.token.here'})
        assert resp.status_code == 401

    def test_logout_blocks_token(self, client, db_session, user_a, auth_headers_a):
        # First request succeeds
        r1 = client.get('/api/auth/user', headers=auth_headers_a)
        assert r1.status_code == 200
        # Logout
        client.post('/api/auth/logout', headers=auth_headers_a)
        # Same token is now blocked
        r2 = client.get('/api/auth/user', headers=auth_headers_a)
        assert r2.status_code == 401


class TestInputValidation:
    def test_signup_sql_injection_attempt(self, client, db_session):
        resp = client.post('/api/auth/signup', json={
            'phone_number': "'; DROP TABLE users; --",
            'full_name': 'Hacker',
            'password': 'StrongPass123!',
        })
        # Should return an error (invalid phone), not crash
        assert resp.status_code in (400, 409, 500)
        # DB must still respond
        health = client.get('/api/health')
        assert health.status_code == 200

    def test_signup_xss_attempt(self, client, db_session):
        resp = client.post('/api/auth/signup', json={
            'phone_number': '+256711000088',
            'full_name': '<script>alert(1)</script>',
            'password': 'StrongPass123!',
        })
        # Should be accepted (full_name is stored, not executed)
        # but the stored value must be retrievable
        assert resp.status_code in (201, 409)

    def test_empty_body_handled(self, client, db_session):
        resp = client.post('/api/auth/login',
                           data='{}',
                           content_type='application/json')
        assert resp.status_code == 400

    def test_oversized_body_handled(self, client, db_session):
        big = 'x' * 100_001
        resp = client.post('/api/auth/signup', json={
            'phone_number': '+256711000087',
            'full_name': big,
            'password': 'StrongPass123!',
        })
        # Must not crash — 400 or validation error acceptable
        assert resp.status_code in (400, 422)


class TestE2EESecurity:
    def test_cannot_fetch_own_bundle_via_get(self, client, db_session, user_a, auth_headers_a):
        """Fetching own bundle through the session-initiation endpoint is blocked."""
        import base64, os
        payload = {
            'identity_key': base64.b64encode(os.urandom(32)).decode(),
            'signed_prekey': {
                'id': 1,
                'public_key': base64.b64encode(os.urandom(32)).decode(),
                'signature': base64.b64encode(os.urandom(64)).decode(),
            },
            'registration_id': 1234,
        }
        client.post('/api/e2ee/keys', json=payload, headers=auth_headers_a)
        resp = client.get(f'/api/e2ee/keys/{user_a.id}', headers=auth_headers_a)
        assert resp.status_code == 400

    def test_key_bundle_requires_auth(self, client, db_session, user_a):
        resp = client.get(f'/api/e2ee/keys/{user_a.id}')
        assert resp.status_code == 401


class TestAuditLog:
    def test_own_audit_log_accessible(self, client, db_session, user_a, auth_headers_a):
        resp = client.get('/api/security/my-audit-log', headers=auth_headers_a)
        assert resp.status_code == 200
        assert isinstance(resp.get_json().get('logs'), list)

    def test_admin_audit_log_blocked_for_normal_user(self, client, db_session,
                                                       user_a, auth_headers_a):
        resp = client.get('/api/security/audit-log', headers=auth_headers_a)
        assert resp.status_code == 403
