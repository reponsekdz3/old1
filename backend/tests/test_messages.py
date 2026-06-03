import pytest
from app import create_app
from models import db

@pytest.fixture
def app():
    app = create_app()
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def auth_token(client):
    client.post('/api/auth/signup', json={
        'username': 'sender',
        'phone': '+250788123456',
        'password': 'Test123!'
    })
    response = client.post('/api/auth/login', json={
        'phone': '+250788123456',
        'password': 'Test123!'
    })
    return response.json['access_token']

def test_send_message(client, auth_token):
    response = client.post('/api/messages/2', 
        json={'content': 'Hello', 'type': 'text'},
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    assert response.status_code in [200, 201]

def test_get_chat_history(client, auth_token):
    response = client.get('/api/messages/chat/2',
        headers={'Authorization': f'Bearer {auth_token}'}
    )
    assert response.status_code == 200
