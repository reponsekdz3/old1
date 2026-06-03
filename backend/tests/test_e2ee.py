"""
Unit tests for /api/e2ee/* endpoints.
"""
import pytest
import base64
import os


def _fake_b64():
    return base64.b64encode(os.urandom(32)).decode()


def _bundle_payload(spk_id=1):
    return {
        'identity_key': _fake_b64(),
        'signed_prekey': {
            'id': spk_id,
            'public_key': _fake_b64(),
            'signature': _fake_b64(),
        },
        'registration_id': 12345,
        'one_time_prekeys': [
            {'id': i, 'public_key': _fake_b64()}
            for i in range(10)
        ],
    }


class TestPublishKeyBundle:
    def test_publish_success(self, client, db_session, user_a, auth_headers_a):
        resp = client.post('/api/e2ee/keys', json=_bundle_payload(), headers=auth_headers_a)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data['one_time_prekeys_remaining'] == 10

    def test_publish_missing_identity_key(self, client, db_session, user_a, auth_headers_a):
        payload = _bundle_payload()
        del payload['identity_key']
        resp = client.post('/api/e2ee/keys', json=payload, headers=auth_headers_a)
        assert resp.status_code == 400

    def test_publish_missing_spk(self, client, db_session, user_a, auth_headers_a):
        payload = _bundle_payload()
        del payload['signed_prekey']
        resp = client.post('/api/e2ee/keys', json=payload, headers=auth_headers_a)
        assert resp.status_code == 400

    def test_publish_unauthenticated(self, client, db_session):
        resp = client.post('/api/e2ee/keys', json=_bundle_payload())
        assert resp.status_code == 401

    def test_update_bundle(self, client, db_session, user_a, auth_headers_a):
        client.post('/api/e2ee/keys', json=_bundle_payload(spk_id=1), headers=auth_headers_a)
        resp2 = client.post('/api/e2ee/keys', json=_bundle_payload(spk_id=2), headers=auth_headers_a)
        assert resp2.status_code == 201


class TestGetKeyBundle:
    def test_get_bundle_for_other_user(self, client, db_session, user_a, user_b,
                                       auth_headers_a, auth_headers_b):
        # B publishes keys
        client.post('/api/e2ee/keys', json=_bundle_payload(), headers=auth_headers_b)
        # A fetches B's bundle
        resp = client.get(f'/api/e2ee/keys/{user_b.id}', headers=auth_headers_a)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['e2ee_supported'] is True
        assert 'identity_key' in data
        assert 'signed_prekey' in data

    def test_get_bundle_no_keys(self, client, db_session, user_a, user_b, auth_headers_a):
        resp = client.get(f'/api/e2ee/keys/{user_b.id}', headers=auth_headers_a)
        assert resp.status_code == 404
        assert resp.get_json()['e2ee_supported'] is False

    def test_get_bundle_unauthenticated(self, client, db_session, user_b):
        resp = client.get(f'/api/e2ee/keys/{user_b.id}')
        assert resp.status_code == 401


class TestKeyStatus:
    def test_status_no_bundle(self, client, db_session, user_a, auth_headers_a):
        resp = client.get('/api/e2ee/keys/status', headers=auth_headers_a)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['has_bundle'] is False

    def test_status_with_bundle(self, client, db_session, user_a, auth_headers_a):
        client.post('/api/e2ee/keys', json=_bundle_payload(), headers=auth_headers_a)
        resp = client.get('/api/e2ee/keys/status', headers=auth_headers_a)
        assert resp.status_code == 200
        data = resp.get_json()
        assert data['has_bundle'] is True
        assert data['one_time_prekeys_remaining'] == 10
        assert data['low_prekeys'] is False


class TestUploadOneTimePreKeys:
    def test_upload_opks(self, client, db_session, user_a, auth_headers_a):
        # Publish initial bundle first
        client.post('/api/e2ee/keys', json=_bundle_payload(), headers=auth_headers_a)
        more = [{'id': 100 + i, 'public_key': _fake_b64()} for i in range(20)]
        resp = client.post('/api/e2ee/keys/one-time',
                           json={'one_time_prekeys': more},
                           headers=auth_headers_a)
        assert resp.status_code == 201
        assert resp.get_json()['added'] == 20

    def test_upload_too_many_opks(self, client, db_session, user_a, auth_headers_a):
        too_many = [{'id': i, 'public_key': _fake_b64()} for i in range(201)]
        resp = client.post('/api/e2ee/keys/one-time',
                           json={'one_time_prekeys': too_many},
                           headers=auth_headers_a)
        assert resp.status_code == 400


class TestSPKRotation:
    def test_rotate_spk(self, client, db_session, user_a, auth_headers_a):
        client.post('/api/e2ee/keys', json=_bundle_payload(spk_id=10), headers=auth_headers_a)
        resp = client.post('/api/e2ee/keys/rotate-spk', json={
            'signed_prekey': {
                'id': 11,
                'public_key': _fake_b64(),
                'signature': _fake_b64(),
            }
        }, headers=auth_headers_a)
        assert resp.status_code == 200

    def test_rotate_spk_no_bundle(self, client, db_session, user_a, auth_headers_a):
        resp = client.post('/api/e2ee/keys/rotate-spk', json={
            'signed_prekey': {'id': 99, 'public_key': _fake_b64(), 'signature': _fake_b64()}
        }, headers=auth_headers_a)
        assert resp.status_code == 404


class TestFingerprint:
    def test_safety_number(self, client, db_session, user_a, user_b,
                            auth_headers_a, auth_headers_b):
        client.post('/api/e2ee/keys', json=_bundle_payload(), headers=auth_headers_a)
        client.post('/api/e2ee/keys', json=_bundle_payload(), headers=auth_headers_b)
        resp = client.get(f'/api/e2ee/fingerprint/{user_b.id}', headers=auth_headers_a)
        assert resp.status_code == 200
        sn = resp.get_json()['safety_number']
        assert len(sn.replace(' ', '')) == 60   # 5 × 12 decimal digits
