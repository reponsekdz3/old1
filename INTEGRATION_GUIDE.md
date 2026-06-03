# Integration & Deployment Guide - Complete E2EE Implementation

## Overview

This guide covers integrating and deploying BiteSe's complete end-to-end encryption system including WebRTC E2EE, Signal Protocol, and advanced monetization security.

---

## 1. Application Integration

### Step 1.1: Update Application Initialization

Edit `backend/app/__init__.py`:

```python
from flask import Flask
from flask_jwt_extended import JWTManager
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from app.routes.webrtc_e2ee import webrtc_e2ee_bp
from app.routes.e2ee import e2ee_bp
from app.routes.e2ee_enhanced import e2ee_enhanced_bp
from app.routes.monetization import monetization_bp
from app.infrastructure.scalability import CacheManager

def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config['JSON_SORT_KEYS'] = False
    app.config['PROPAGATE_EXCEPTIONS'] = True
    
    # Initialize extensions
    JWTManager(app)
    
    # Initialize cache manager for encryption keys
    cache_manager = CacheManager()
    app.cache_manager = cache_manager
    
    # Rate limiting for security endpoints
    limiter = Limiter(
        app=app,
        key_func=get_remote_address,
        storage_uri="redis://localhost:6379"
    )
    app.limiter = limiter
    
    # Register blueprints
    app.register_blueprint(webrtc_e2ee_bp)  # NEW
    app.register_blueprint(e2ee_bp)
    app.register_blueprint(e2ee_enhanced_bp)
    app.register_blueprint(monetization_bp)
    
    return app
```

### Step 1.2: Update Requirements

Add to `backend/requirements.txt`:

```
# Cryptography & Security
cryptography>=42.0.0
PyNaCl>=1.5.0
bcrypt>=4.0.0

# WebRTC & Real-time
python-socketio>=5.10.0
python-engineio>=4.8.0

# Encryption & Key Management
keyring>=24.0.0
hvac>=1.2.0

# Signal Protocol (if using existing implementation)
# signal-protocol-python>=0.8.0 (or similar)

# Existing dependencies (keep all)
Flask>=3.0.0
Flask-SQLAlchemy>=3.0.0
Flask-JWT-Extended>=4.5.0
Flask-CORS>=4.0.0
psycopg2-binary>=2.9.0
redis>=5.0.0
stripe>=7.0.0
python-dotenv>=1.0.0
sqlalchemy>=2.0.0
alembic>=1.13.0
Werkzeug>=3.0.0
Pillow>=10.0.0
```

### Step 1.3: Environment Variables

Create/Update `backend/.env`:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bitese

# JWT
JWT_SECRET_KEY=your_256_bit_random_secret_key_here

# Encryption
ENCRYPTION_MASTER_PASSWORD=your_strong_master_password_min_32_chars

# Redis (for caching & sessions)
REDIS_URL=redis://localhost:6379/0

# Stripe (for monetization)
STRIPE_SECRET_KEY=sk_test_your_stripe_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_public_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Security
SECURITY_AUDIT_LOG_ENABLED=true
SECURITY_AUDIT_LOG_LEVEL=INFO

# WebRTC
WEBRTC_STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
WEBRTC_TURN_SERVERS=turn:turnserver.com:3478

# Environment
FLASK_ENV=production
DEBUG=false
```

---

## 2. Database Setup

### Step 2.1: Create Migration

```bash
cd backend
flask db init  # If not already done
flask db migrate -m "Add WebRTC E2EE and enhanced security tables"
```

### Step 2.2: Update Models

Ensure `backend/app/models/e2ee_models.py` includes:

```python
from datetime import datetime
from app.models.models import db

class E2EEKeyBundle(db.Model):
    __tablename__ = 'e2ee_key_bundles'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, unique=True, nullable=False)
    identity_key_pub = db.Column(db.Text, nullable=False)
    signed_prekey_id = db.Column(db.Integer)
    signed_prekey_pub = db.Column(db.Text)
    signed_prekey_sig = db.Column(db.Text)
    registration_id = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class E2EEOneTimePreKey(db.Model):
    __tablename__ = 'e2ee_one_time_prekeys'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, nullable=False)
    key_id = db.Column(db.Integer, nullable=False)
    public_key = db.Column(db.Text, nullable=False)
    used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class SecurityAuditLog(db.Model):
    __tablename__ = 'security_audit_logs'
    
    id = db.Column(db.String, primary_key=True)
    user_id = db.Column(db.String)
    event_type = db.Column(db.String(100), nullable=False)
    severity = db.Column(db.String(20))  # INFO, WARNING, ERROR, CRITICAL
    description = db.Column(db.Text)
    ip_address = db.Column(db.String)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class WebRTCSession(db.Model):
    __tablename__ = 'webrtc_sessions'
    
    id = db.Column(db.String, primary_key=True)
    call_id = db.Column(db.String, unique=True)
    caller_id = db.Column(db.String, nullable=False)
    callee_id = db.Column(db.String, nullable=False)
    status = db.Column(db.String(20))  # pending, active, ended
    media_encryption = db.Column(db.String(50))  # aes-256-gcm, chacha20-poly1305
    encrypted_packets = db.Column(db.Integer, default=0)
    bandwidth_used = db.Column(db.BigInteger, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime)
```

### Step 2.3: Run Migrations

```bash
flask db upgrade
```

---

## 3. Service Configuration

### Step 3.1: Redis Setup

```bash
# Start Redis
redis-server

# Or with Docker
docker run -d -p 6379:6379 redis:latest
```

### Step 3.2: Stripe Webhooks

```bash
# Setup webhook endpoint (requires Stripe CLI)
stripe listen --forward-to localhost:5000/api/v2/monetization/webhook

# Get signing secret from output, add to .env
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 3.3: Encryption Keys Setup

```python
# In backend app initialization
from app.security.encryption import KeyManager

key_manager = KeyManager()
master_password = os.getenv('ENCRYPTION_MASTER_PASSWORD')
master_key = key_manager.generate_master_key(master_password)
# Key is now stored in encrypted format in database
```

---

## 4. Testing

### Step 4.1: Install Test Dependencies

```bash
pip install pytest pytest-cov pytest-xdist pytest-timeout
```

### Step 4.2: Run Tests

```bash
# Run all tests
pytest tests/ -v

# Run only E2EE tests
pytest tests/test_webrtc_e2ee.py -v

# Run only security tests
pytest tests/test_comprehensive_security.py -v

# Run with coverage
pytest tests/ --cov=app --cov-report=html

# Run specific test class
pytest tests/test_webrtc_e2ee.py::TestWebRTCE2EE -v

# Run marked tests
pytest -m security -v
pytest -m e2ee -v
pytest -m webrtc -v
```

### Step 4.3: Performance Testing

```bash
# Run with timing information
pytest tests/ -v --durations=10

# Run with profiling
pytest tests/ -v --profile
```

---

## 5. Deployment

### Step 5.1: Production Configuration

```python
# config.py or similar
import os

class ProductionConfig:
    DEBUG = False
    TESTING = False
    
    # Database (use managed PostgreSQL)
    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Security
    SESSION_COOKIE_SECURE = True
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Strict'
    
    # Cryptography
    ENCRYPTION_ALGORITHM = 'AES-256-GCM'
    KEY_ROTATION_DAYS = 7
    SESSION_TIMEOUT_HOURS = 24
    
    # Rate limiting
    RATELIMIT_STORAGE_URL = os.getenv('REDIS_URL')
    
    # CORS
    CORS_ORIGINS = os.getenv('CORS_ORIGINS', '').split(',')
```

### Step 5.2: Docker Deployment

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Run migrations and start app
CMD ["sh", "-c", "flask db upgrade && gunicorn -w 4 -b 0.0.0.0:5000 app:app"]
```

### Step 5.3: Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: bitese
      POSTGRES_USER: bitese
      POSTGRES_PASSWORD: secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgresql://bitese:secure_password@db:5432/bitese
      REDIS_URL: redis://redis:6379/0
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      ENCRYPTION_MASTER_PASSWORD: ${ENCRYPTION_MASTER_PASSWORD}
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY}
    ports:
      - "5000:5000"
    depends_on:
      - db
      - redis
    volumes:
      - ./backend:/app

volumes:
  postgres_data:
```

### Step 5.4: Start Services

```bash
# Development
python backend/app.py

# Docker
docker-compose up -d

# Production with Gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 backend.app:create_app()
```

---

## 6. Monitoring & Security

### Step 6.1: Enable Audit Logging

```python
# In app initialization
from app.models.e2ee_models import SecurityAuditLogger

logger = SecurityAuditLogger()

# Log events
logger.log_event(
    event_type='CALL_INITIATED',
    user_id='user_123',
    severity='INFO',
    description='User initiated encrypted call'
)
```

### Step 6.2: Set Up Monitoring

```python
# Metrics endpoint
@app.route('/metrics')
def metrics():
    return {
        'calls_active': len(webrtc_e2ee.active_sessions),
        'group_calls_active': len(group_call_e2ee.group_sessions),
        'encryption_keys_cached': cache_manager.get_size(),
        'total_packets_encrypted': total_packets,
        'total_bandwidth_used_mb': total_bandwidth / (1024*1024)
    }
```

### Step 6.3: Security Alerts

```python
# Alert on suspicious patterns
from app.models.e2ee_models import SecurityAuditLogger

if logger.is_suspicious_pattern(
    user_id='user_123',
    event_type='AUTH_FAILED',
    threshold=5,
    time_window_minutes=10
):
    # Send alert
    send_security_alert(
        user_id='user_123',
        alert_type='SUSPICIOUS_ACTIVITY',
        severity='HIGH'
    )
```

---

## 7. API Client Implementation

### Step 7.1: JavaScript/React Client

```javascript
// Initialize WebRTC E2EE
class BitesE2EE {
  async initiateCall(calleeId) {
    const response = await fetch('/api/v2/webrtc/call/initiate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        callee_id: calleeId,
        ice_ufrag: this.generateICEUfrag(),
        ice_pwd: this.generateICEPwd(),
        dtls_fingerprint: this.getDTLSFingerprint()
      })
    });
    
    return response.json();
  }
  
  async encryptMediaPacket(callId, packet, algorithm) {
    const response = await fetch(`/api/v2/webrtc/call/${callId}/encrypt-packet`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        packet: this.toBase64(packet),
        algorithm: algorithm || 'aes-256-gcm',
        aad: this.generateAAD()
      })
    });
    
    return response.json();
  }
}
```

---

## 8. Troubleshooting

### Issue: DTLS Verification Fails
**Solution:**
- Verify fingerprints match exactly (case-sensitive)
- Check certificate expiration
- Ensure DTLS handshake completes

### Issue: Media Decryption Fails
**Solution:**
- Verify key material matches
- Check nonce uniqueness
- Validate authentication tag

### Issue: High Bandwidth Usage
**Solution:**
- Check compression settings
- Verify codec selection
- Monitor packet loss

### Issue: Key Rotation Not Working
**Solution:**
- Check Redis connection
- Verify time synchronization
- Check key derivation function

---

## 9. Maintenance

### Regular Tasks

```bash
# Monthly: Rotate Stripe API keys
# Every 3 months: Update cryptography library
pip install --upgrade cryptography

# Weekly: Review security audit logs
SELECT * FROM security_audit_logs 
WHERE severity IN ('ERROR', 'CRITICAL')
ORDER BY created_at DESC LIMIT 100;

# Daily: Check active sessions
SELECT COUNT(*) FROM webrtc_sessions WHERE status = 'active';
```

### Backup Strategy

```bash
# Backup encryption keys
pg_dump -U bitese bitese > backup_keys.sql

# Backup Redis state
redis-cli BGSAVE
```

---

## 10. Support

### Issues or Questions?
- **Security Issues**: security@bitese.com
- **Enterprise Support**: enterprise@bitese.com
- **Documentation**: See SECURITY_IMPLEMENTATION.md

---

## ✨ You're Ready!

Your BiteSe application now has:
- ✅ Complete end-to-end encryption for all communications
- ✅ Production-grade Signal Protocol implementation
- ✅ WebRTC voice/video encryption
- ✅ Comprehensive security testing
- ✅ Enterprise-scale monetization
- ✅ Audit logging and compliance

Deploy with confidence! 🚀🔐
