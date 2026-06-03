"""
Unit tests for /api/auth/* endpoints.
"""
import pytest


class TestSignup:
    def test_signup_success(self, client, db_session):
        resp = client.post('/api/auth/signup', json={
            'phone_number': '+256711000099',
            'full_name': 'Test User',
            'password': 'StrongPass123!',
        })
        assert resp.status_code == 201
        data = resp.get_json()
        assert 'access_token' in data
        assert 'refresh_token' in data
        assert data['user']['phone_number'] == '+256711000099'

    def test_signup_missing_fields(self, client, db_session):
        resp = client.post('/api/auth/signup', json={'phone_number': '+256711000098'})
        assert resp.status_code == 400
        assert 'error' in resp.get_json()

    def test_signup_short_password(self, client, db_session):
        resp = client.post('/api/auth/signup', json={
            'phone_number': '+256711000097',
            'full_name': 'Short',
            'password': 'abc',
        })
        assert resp.status_code == 400

    def test_signup_duplicate_phone(self, client, db_session, user_a):
        resp = client.post('/api/auth/signup', json={
            'phone_number': user_a.phone_number,
            'full_name': 'Duplicate',
            'password': 'StrongPass123!',
        })
        assert resp.status_code == 409

    def test_signup_invalid_email(self, client, db_session):
        resp = client.post('/api/auth/signup', json={
            'phone_number': '+256711000096',
            'full_name': 'Email Test',
            'password': 'StrongPass123!',
            'email': 'not-an-email',
        })
        assert resp.status_code == 400

    def test_signup_underage(self, client, db_session):
        resp = client.post('/api/auth/signup', json={
            'phone_number': '+256711000095',
            'full_name': 'Kid',
            'password': 'StrongPass123!',
            'age': 12,
        })
        assert resp.status_code == 400


class TestLogin:
    def test_login_success(self, client, db_session, user_a):
        resp = client.post('/api/auth/login', json={
            'phone_number': user_a.phone_number,
            'password': 'SecurePass123!',
        })
        assert resp.status_code == 200
        data = resp.get_json()
        assert 'access_token' in data
        assert data['user']['id'] == user_a.id

    def test_login_wrong_password(self, client, db_session, user_a):
        resp = client.post('/api/auth/login', json={
            'phone_number': user_a.phone_number,
            'password': 'WrongPassword!',
        })
        assert resp.status_code == 401

    def test_login_nonexistent_user(self, client, db_session):
        resp = client.post('/api/auth/login', json={
            'phone_number': '+256799999999',
            'password': 'SomePass123!',
        })
        assert resp.status_code == 401

    def test_login_missing_fields(self, client, db_session):
        resp = client.post('/api/auth/login', json={'phone_number': '+256711000001'})
        assert resp.status_code == 400


class TestGetUser:
    def test_get_user_authenticated(self, client, db_session, user_a, auth_headers_a):
        resp = client.get('/api/auth/user', headers=auth_headers_a)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['id'] == user_a.id
        assert data['phone_number'] == user_a.phone_number

    def test_get_user_unauthenticated(self, client, db_session):
        resp = client.get('/api/auth/user')
        assert resp.status_code == 401


class TestTokenRefresh:
    def test_refresh_token(self, client, db_session, user_a):
        login = client.post('/api/auth/login', json={
            'phone_number': user_a.phone_number,
            'password': 'SecurePass123!',
        })
        refresh_token = login.get_json()['refresh_token']
        resp = client.post('/api/auth/refresh', headers={
            'Authorization': f'Bearer {refresh_token}',
        })
        assert resp.status_code == 200
        assert 'access_token' in resp.get_json()


class TestLogout:
    def test_logout_invalidates_token(self, client, db_session, user_a, auth_headers_a):
        # logout
        resp = client.post('/api/auth/logout', headers=auth_headers_a)
        assert resp.status_code == 200
        # subsequent request with same token should fail
        resp2 = client.get('/api/auth/user', headers=auth_headers_a)
        assert resp2.status_code == 401
