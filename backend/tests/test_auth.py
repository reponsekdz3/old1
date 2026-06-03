import pytest
from app import create_app
from models import db, User

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

def test_signup(client):
    response = client.post('/api/auth/signup', json={
        'username': 'testuser',
        'phone': '+250788123456',
        'password': 'Test123!'
    })
    assert response.status_code in [200, 201]

def test_login(client):
    client.post('/api/auth/signup', json={
        'username': 'testuser',
        'phone': '+250788123456',
        'password': 'Test123!'
    })
    response = client.post('/api/auth/login', json={
        'phone': '+250788123456',
        'password': 'Test123!'
    })
    assert response.status_code == 200
    assert 'access_token' in response.json

def test_rate_limit_login(client):
    for _ in range(15):
        client.post('/api/auth/login', json={
            'phone': '+250788123456',
            'password': 'wrong'
        })
    response = client.post('/api/auth/login', json={
        'phone': '+250788123456',
        'password': 'Test123!'
    })
    assert response.status_code == 429
