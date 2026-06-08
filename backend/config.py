import os
from datetime import timedelta


def _resolve_db_url():
    """
    Priority:
    1. MYSQL_DATABASE_URL  — explicit MySQL override
    2. DATABASE_URL        — PostgreSQL / MySQL / any SQLAlchemy URL
    3. Local MySQL via MYSQL_* env vars
    4. SQLite fallback (development only)
    """
    # 1. Explicit MySQL URL
    mysql_url = os.environ.get('MYSQL_DATABASE_URL', '')
    if mysql_url:
        if mysql_url.startswith('mysql://'):
            mysql_url = mysql_url.replace('mysql://', 'mysql+pymysql://', 1)
        return mysql_url

    # 2. Generic DATABASE_URL
    db_url = os.environ.get('DATABASE_URL', '')
    if db_url:
        if db_url.startswith('postgres://'):
            db_url = db_url.replace('postgres://', 'postgresql://', 1)
        if db_url.startswith('mysql://'):
            db_url = db_url.replace('mysql://', 'mysql+pymysql://', 1)
        return db_url

    # 3. MySQL from individual env vars
    mysql_host = os.environ.get('MYSQL_HOST', '')
    mysql_user = os.environ.get('MYSQL_USER', '')
    mysql_pass = os.environ.get('MYSQL_PASSWORD', '')
    mysql_db   = os.environ.get('MYSQL_DATABASE', 'vipchat')
    mysql_port = os.environ.get('MYSQL_PORT', '3306')
    if mysql_host and mysql_user:
        return (
            f'mysql+pymysql://{mysql_user}:{mysql_pass}@{mysql_host}:{mysql_port}/{mysql_db}'
            '?charset=utf8mb4'
        )

    # 4. SQLite fallback
    return 'sqlite:///vipchat.db'


def _mysql_engine_options(is_mysql: bool) -> dict:
    opts = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }
    if is_mysql:
        opts.update({
            'pool_size': int(os.environ.get('DB_POOL_SIZE', 10)),
            'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 20)),
            'connect_args': {
                'connect_timeout': 10,
                'charset': 'utf8mb4',
            },
        })
    return opts


_DB_URL = _resolve_db_url()
_IS_MYSQL = 'mysql' in _DB_URL


class Config:
    """Base configuration — MySQL-first, SQLite fallback."""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'vipchat-dev-secret-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'vipchat-jwt-secret-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    SQLALCHEMY_DATABASE_URI = _DB_URL
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = _mysql_engine_options(_IS_MYSQL)

    # Redis
    REDIS_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')

    # SocketIO
    SOCKETIO_CORS_ALLOWED_ORIGINS = os.environ.get('ALLOWED_ORIGINS', '*')
    SOCKETIO_ASYNC_MODE = 'threading'

    # Africa's Talking (SMS OTP)
    AFRICAN_TALKING_USERNAME = os.environ.get('AFRICAN_TALKING_USERNAME', '')
    AFRICAN_TALKING_API_KEY = os.environ.get('AFRICAN_TALKING_API_KEY', '')

    # Stripe
    STRIPE_SECRET_KEY = os.environ.get('STRIPE_SECRET_KEY', '')
    STRIPE_PUBLISHABLE_KEY = os.environ.get('STRIPE_PUBLISHABLE_KEY', '')
    STRIPE_WEBHOOK_SECRET = os.environ.get('STRIPE_WEBHOOK_SECRET', '')

    # Flutterwave
    FLUTTERWAVE_SECRET_KEY = os.environ.get('FLUTTERWAVE_SECRET_KEY', '')
    FLUTTERWAVE_PUBLIC_KEY = os.environ.get('FLUTTERWAVE_PUBLIC_KEY', '')
    FLUTTERWAVE_ENCRYPTION_KEY = os.environ.get('FLUTTERWAVE_ENCRYPTION_KEY', '')
    FLUTTERWAVE_WEBHOOK_HASH = os.environ.get('FLUTTERWAVE_WEBHOOK_HASH', '')

    # Security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

    # E2EE & Signal Protocol
    E2EE_ENABLED = True
    E2EE_FORCE_ON_MESSAGES = True
    E2EE_KEY_BUNDLE_EXPIRY_DAYS = 7
    E2EE_OTK_REFRESH_THRESHOLD = 20
    E2EE_OTK_PREGENERATE_COUNT = 100
    SIGNAL_PROTOCOL_VERSION = 3
    SIGNAL_MAX_FORWARD_JUMPS = 5
    ENCRYPTION_ALGORITHM = 'AES-256-GCM'
    ENCRYPTION_KEY_ROTATION_DAYS = 90
    ENCRYPTION_MASTER_PASSWORD = os.environ.get('ENCRYPTION_MASTER_PASSWORD', '')

    # Advanced Security
    RATE_LIMIT_ENABLED = True
    RATE_LIMIT_DEFAULT = '100/minute'
    RATE_LIMIT_STORAGE_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    TLS_CERT_PATH = os.environ.get('TLS_CERT_PATH', '/etc/ssl/certs/vipchat.crt')
    TLS_KEY_PATH = os.environ.get('TLS_KEY_PATH', '/etc/ssl/private/vipchat.key')
    AUDIT_LOG_ENABLED = True
    AUDIT_LOG_RETENTION_DAYS = 365
    SECURITY_LOG_LEVEL = os.environ.get('SECURITY_LOG_LEVEL', 'INFO')

    # Scalability
    SHARD_COUNT = int(os.environ.get('SHARD_COUNT', 256))
    SHARDING_STRATEGY = os.environ.get('SHARDING_STRATEGY', 'consistent_hash')
    CACHE_TTL_SECONDS = int(os.environ.get('CACHE_TTL_SECONDS', 3600))
    MAX_CONNECTION_POOL_SIZE = int(os.environ.get('MAX_POOL_SIZE', 100))
    MESSAGE_QUEUE_BATCH_SIZE = int(os.environ.get('MQ_BATCH_SIZE', 1000))
    MESSAGE_QUEUE_FLUSH_INTERVAL_MS = int(os.environ.get('MQ_FLUSH_MS', 100))

    # CDN
    CDN_ENABLED = os.environ.get('CDN_ENABLED', 'true').lower() == 'true'
    CDN_URL = os.environ.get('CDN_URL', '')
    CDN_API_KEY = os.environ.get('CDN_API_KEY', '')

    # WebRTC
    WEBRTC_ENABLED = True
    WEBRTC_ICE_SERVERS = os.environ.get('WEBRTC_ICE_SERVERS', 'stun:stun.l.google.com:19302').split(',')
    WEBRTC_TURN_USERNAME = os.environ.get('WEBRTC_TURN_USERNAME', '')
    WEBRTC_TURN_PASSWORD = os.environ.get('WEBRTC_TURN_PASSWORD', '')
    WEBRTC_TURN_URL = os.environ.get('WEBRTC_TURN_URL', '')
    WEBRTC_MAX_BANDWIDTH_MBPS = int(os.environ.get('WEBRTC_MAX_BW', 50))
    WEBRTC_SESSION_TIMEOUT_SECONDS = int(os.environ.get('WEBRTC_TIMEOUT', 3600))

    # Monetization
    FEATURE_PAYMENTS = os.environ.get('FEATURE_PAYMENTS', 'true').lower() == 'true'
    MONETIZATION_ENABLED = True
    PAYMENT_PROCESSING_TIMEOUT_SECONDS = 30
    WEBHOOK_SIGNATURE_VERIFICATION = True
    BILLING_CYCLE_DAY = 1

    # Feature Flags
    FEATURE_E2EE = True
    FEATURE_GROUP_CALLS = True
    FEATURE_CHANNELS = True
    FEATURE_COMMUNITIES = True
    FEATURE_VERIFICATION = True
    FEATURE_BUSINESS_API = True
    FEATURE_MARKETPLACE = True
    FEATURE_B2B = True

    # Performance
    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = True
    SEND_FILE_MAX_AGE_DEFAULT = 31536000  # 1 year


class DevelopmentConfig(Config):
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False


class TestingConfig(Config):
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    SESSION_COOKIE_SECURE = False


class ProductionConfig(Config):
    DEBUG = False
    TESTING = False
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Strict'
    E2EE_FORCE_ON_MESSAGES = True
    RATE_LIMIT_DEFAULT = '50/minute'
    CACHE_TTL_SECONDS = 7200
    WEBRTC_SESSION_TIMEOUT_SECONDS = 7200
    WEBRTC_MAX_BANDWIDTH_MBPS = 10
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.environ.get('DB_POOL_SIZE', 20)),
        'pool_recycle': 300,
        'pool_pre_ping': True,
        'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 40)),
        'connect_args': {'connect_timeout': 10},
    }


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
