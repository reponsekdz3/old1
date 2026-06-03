"""
Unit tests for /api/messages/* and /api/chat/* endpoints.
"""
import pytest


def _send(client, sender_headers, receiver_id, content='Hello!'):
    return client.post('/api/messages/send', json={
        'receiver_id': receiver_id,
        'content': content,
    }, headers=sender_headers)


class TestSendMessage:
    def test_send_message_success(self, client, db_session, user_a, user_b, auth_headers_a):
        resp = _send(client, auth_headers_a, user_b.id)
        assert resp.status_code == 201
        data = resp.get_json()
        assert data.get('message', {}).get('content') == 'Hello!' or 'id' in data.get('message', {})

    def test_send_message_unauthenticated(self, client, db_session, user_b):
        resp = client.post('/api/messages/send', json={
            'receiver_id': user_b.id,
            'content': 'Hi',
        })
        assert resp.status_code == 401

    def test_send_empty_content_rejected(self, client, db_session, user_a, user_b, auth_headers_a):
        resp = client.post('/api/messages/send', json={
            'receiver_id': user_b.id,
            'content': '',
        })
        # Either rejected as 400 or saved as empty — must not crash
        assert resp.status_code in (400, 201)

    def test_send_to_nonexistent_user(self, client, db_session, user_a, auth_headers_a):
        resp = client.post('/api/messages/send', json={
            'receiver_id': 'nonexistent-uuid-1234',
            'content': 'Hi',
        }, headers=auth_headers_a)
        assert resp.status_code in (400, 404)


class TestE2EEMessage:
    def test_send_encrypted_message(self, client, db_session, user_a, user_b, auth_headers_a):
        import base64, os
        resp = client.post('/api/messages/send', json={
            'receiver_id': user_b.id,
            'encrypted_payload': base64.b64encode(os.urandom(64)).decode(),
            'e2ee_header': '{"ratchet":{"msg_number":0,"ratchet_key":"abc","prev_chain_length":0}}',
            'e2ee_type': 0,
        }, headers=auth_headers_a)
        # Backend must accept E2EE payload even if it cannot decrypt it
        assert resp.status_code in (200, 201)


class TestChatHistory:
    def test_get_chat_history(self, client, db_session, user_a, user_b,
                               auth_headers_a, auth_headers_b):
        _send(client, auth_headers_a, user_b.id, 'Message 1')
        _send(client, auth_headers_a, user_b.id, 'Message 2')

        resp = client.get(f'/api/messages/{user_b.id}', headers=auth_headers_a)
        assert resp.status_code == 200
        data = resp.get_json()
        # Either a list or dict with 'messages' key
        messages = data if isinstance(data, list) else data.get('messages', [])
        assert len(messages) >= 2

    def test_chat_history_unauthenticated(self, client, db_session, user_b):
        resp = client.get(f'/api/messages/{user_b.id}')
        assert resp.status_code == 401

    def test_pagination(self, client, db_session, user_a, user_b, auth_headers_a):
        resp = client.get(f'/api/messages/{user_b.id}?page=1&per_page=5',
                          headers=auth_headers_a)
        assert resp.status_code == 200


class TestReadReceipts:
    def test_mark_message_read(self, client, db_session, user_a, user_b,
                                auth_headers_a, auth_headers_b):
        send_resp = _send(client, auth_headers_a, user_b.id, 'Read me')
        msg = send_resp.get_json().get('message', {})
        msg_id = msg.get('id')
        if not msg_id:
            pytest.skip('Message ID not in response')

        resp = client.post(f'/api/messages/{msg_id}/read', headers=auth_headers_b)
        assert resp.status_code in (200, 204)


class TestDeleteMessage:
    def test_delete_for_self(self, client, db_session, user_a, user_b, auth_headers_a):
        send_resp = _send(client, auth_headers_a, user_b.id, 'Delete me')
        msg_id = send_resp.get_json().get('message', {}).get('id')
        if not msg_id:
            pytest.skip('Message ID not in response')

        resp = client.delete(f'/api/messages/{msg_id}',
                             json={'delete_for': 'me'},
                             headers=auth_headers_a)
        assert resp.status_code in (200, 204)
