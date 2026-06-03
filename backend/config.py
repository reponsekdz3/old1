import os
from datetime import timedelta


def _fix_db_url(url):
    """SQLAlchemy requires postgresql:// not postgres:// (Heroku/Render style)."""
    if url and url.startswith('postgres://'):
        return url.replace('postgres://', 'postgresql://', 1)
    return url


class Config:
    """Base configuration"""
    SECRET_KEY = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'jwt-secret-key-change-in-production')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Database — prefer PostgreSQL via DATABASE_URL, fall back to SQLite
    _db_url = _fix_db_url(os.environ.get('DATABASE_URL', 'sqlite:///vipchat.db'))
    SQLALCHEMY_DATABASE_URI = _db_url
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
    }

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
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ENTERPRISE FEATURES - End-to-End Encryption, Scalability, Monetization
    # ═══════════════════════════════════════════════════════════════════════════
    
    # E2EE & Signal Protocol Configuration
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
    
    # Advanced Security Configuration
    RATE_LIMIT_ENABLED = True
    RATE_LIMIT_DEFAULT = "100/minute"
    RATE_LIMIT_STORAGE_URL = os.environ.get('REDIS_URL', 'redis://localhost:6379/0')
    TLS_CERT_PATH = os.environ.get('TLS_CERT_PATH', '/etc/ssl/certs/bitese.crt')
    TLS_KEY_PATH = os.environ.get('TLS_KEY_PATH', '/etc/ssl/private/bitese.key')
    AUDIT_LOG_ENABLED = True
    AUDIT_LOG_RETENTION_DAYS = 365
    SECURITY_LOG_LEVEL = os.environ.get('SECURITY_LOG_LEVEL', 'INFO')
    
    # Scalability Configuration - Support 2 Billion+ Users
    SHARD_COUNT = int(os.environ.get('SHARD_COUNT', 256))
    SHARDING_STRATEGY = os.environ.get('SHARDING_STRATEGY', 'consistent_hash')
    CACHE_TTL_SECONDS = int(os.environ.get('CACHE_TTL_SECONDS', 3600))
    MAX_CONNECTION_POOL_SIZE = int(os.environ.get('MAX_POOL_SIZE', 100))
    MESSAGE_QUEUE_BATCH_SIZE = int(os.environ.get('MQ_BATCH_SIZE', 1000))
    MESSAGE_QUEUE_FLUSH_INTERVAL_MS = int(os.environ.get('MQ_FLUSH_MS', 100))
    
    # CDN Configuration
    CDN_ENABLED = os.environ.get('CDN_ENABLED', 'true').lower() == 'true'
    CDN_URL = os.environ.get('CDN_URL', 'https://cdn.bitese.app')
    CDN_API_KEY = os.environ.get('CDN_API_KEY', '')
    
    # WebRTC Configuration
    WEBRTC_ENABLED = True
    WEBRTC_ICE_SERVERS = os.environ.get('WEBRTC_ICE_SERVERS', 'stun:stun.l.google.com:19302').split(',')
    WEBRTC_TURN_USERNAME = os.environ.get('WEBRTC_TURN_USERNAME', '')
    WEBRTC_TURN_PASSWORD = os.environ.get('WEBRTC_TURN_PASSWORD', '')
    WEBRTC_TURN_URL = os.environ.get('WEBRTC_TURN_URL', 'turn:turnserver.example.com:3478')
    WEBRTC_MAX_BANDWIDTH_MBPS = int(os.environ.get('WEBRTC_MAX_BW', 50))
    WEBRTC_SESSION_TIMEOUT_SECONDS = int(os.environ.get('WEBRTC_TIMEOUT', 3600))
    
    # Monetization Configuration
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
    
    # Performance
    JSON_SORT_KEYS = False
    PROPAGATE_EXCEPTIONS = True
    SEND_FILE_MAX_AGE_DEFAULT = 31536000  # 1 year


class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False
    SESSION_COOKIE_SECURE = False


class TestingConfig(Config):
    """Testing configuration"""
    DEBUG = True
    TESTING = True
    SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)
    SESSION_COOKIE_SECURE = False


class ProductionConfig(Config):
    """Production configuration - Enterprise Grade"""
    DEBUG = False
    TESTING = False
    
    # Enhanced security for production
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Strict'
    
    # Enforce E2EE in production
    E2EE_FORCE_ON_MESSAGES = True
    
    # Production database with connection pooling
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.environ.get('DB_POOL_SIZE', 20)),
        'pool_recycle': 300,
        'pool_pre_ping': True,
        'max_overflow': int(os.environ.get('DB_MAX_OVERFLOW', 40)),
        'connect_args': {'connect_timeout': 10},
    }
    
    # Production rate limiting
    RATE_LIMIT_DEFAULT = "50/minute"
    
    # Production caching
    CACHE_TTL_SECONDS = 7200  # 2 hours
    
    # Production WebRTC
    WEBRTC_SESSION_TIMEOUT_SECONDS = 7200
    WEBRTC_MAX_BANDWIDTH_MBPS = 10


config = {
    'development': DevelopmentConfig,
    'testing': TestingConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig,
}
