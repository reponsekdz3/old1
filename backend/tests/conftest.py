"""
pytest fixtures: in-memory SQLite app, test client, seeded users, JWT tokens.
"""
import pytest
from datetime import timedelta

from app import create_app
from app.models.models import db as _db, User


@pytest.fixture(scope='session')
def app():
    """Create application with SQLite in-memory DB."""
    flask_app = create_app('testing')
    flask_app.config.update({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'JWT_SECRET_KEY': 'test-secret-key-not-for-production',
        'JWT_ACCESS_TOKEN_EXPIRES': timedelta(hours=1),
        'WTF_CSRF_ENABLED': False,
        'RATELIMIT_ENABLED': False,
        'RATELIMIT_STORAGE_URI': 'memory://',
    })

    with flask_app.app_context():
        _db.create_all()
        yield flask_app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture(scope='session')
def client(app):
    return app.test_client()


@pytest.fixture(scope='function')
def db_session(app):
    """Each test gets a clean transaction that is rolled back after the test."""
    with app.app_context():
        connection = _db.engine.connect()
        transaction = connection.begin()

        from sqlalchemy.orm import sessionmaker, scoped_session
        session_factory = sessionmaker(bind=connection)
        scoped = scoped_session(session_factory)
        _db.session = scoped

        yield scoped

        scoped.remove()
        transaction.rollback()
        connection.close()


@pytest.fixture(scope='function')
def user_a(app, db_session):
    u = User(
        phone_number='+256700000001',
        full_name='Alice Test',
        email='alice@test.com',
        is_verified=True,
        status='available',
    )
    u.set_password('SecurePass123!')
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture(scope='function')
def user_b(app, db_session):
    u = User(
        phone_number='+256700000002',
        full_name='Bob Test',
        email='bob@test.com',
        is_verified=True,
        status='available',
    )
    u.set_password('SecurePass456!')
    db_session.add(u)
    db_session.commit()
    return u


@pytest.fixture(scope='function')
def auth_headers_a(app, client, user_a):
    resp = client.post('/api/auth/login', json={
        'phone_number': user_a.phone_number,
        'password': 'SecurePass123!',
    })
    token = resp.get_json().get('access_token', '')
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


@pytest.fixture(scope='function')
def auth_headers_b(app, client, user_b):
    resp = client.post('/api/auth/login', json={
        'phone_number': user_b.phone_number,
        'password': 'SecurePass456!',
    })
    token = resp.get_json().get('access_token', '')
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
