#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# BITESE - Complete Enterprise Setup & Startup Script
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                   BITESE ENTERPRISE SETUP                             ║"
echo "║            End-to-End Encryption • Scalability • Security            ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 1. CHECK PREREQUISITES
# ─────────────────────────────────────────────────────────────────────────────
echo "📋 Checking prerequisites..."

if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed"
    exit 1
fi

if ! command -v redis-cli &> /dev/null; then
    echo "⚠️  Redis CLI not found - features may be limited"
fi

if ! command -v psql &> /dev/null; then
    echo "⚠️  PostgreSQL client not found - using SQLite (not recommended for production)"
fi

echo "✅ Python version: $(python3 --version)"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 2. ENVIRONMENT SETUP
# ─────────────────────────────────────────────────────────────────────────────
echo "📝 Setting up environment..."

if [ ! -f ".env" ]; then
    if [ -f ".env.complete" ]; then
        cp .env.complete .env
        echo "✅ Created .env from template"
    else
        echo "⚠️  .env file not found - using defaults"
    fi
else
    echo "✅ Using existing .env"
fi

export FLASK_ENV=${FLASK_ENV:-production}
export FLASK_APP=app:create_app
echo "   ├─ FLASK_ENV: $FLASK_ENV"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 3. PYTHON DEPENDENCIES
# ─────────────────────────────────────────────────────────────────────────────
echo "📦 Installing Python dependencies..."

if [ -d "venv" ]; then
    echo "   ├─ Activating virtual environment"
    source venv/bin/activate
else
    echo "   ├─ Creating virtual environment"
    python3 -m venv venv
    source venv/bin/activate
fi

echo "   ├─ Upgrading pip"
pip install --upgrade pip setuptools wheel > /dev/null 2>&1

echo "   ├─ Installing requirements"
pip install -r requirements.txt > /dev/null 2>&1
echo "✅ Dependencies installed"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 4. DATABASE INITIALIZATION
# ─────────────────────────────────────────────────────────────────────────────
echo "🗄️  Setting up database..."

if [ "$FLASK_ENV" = "production" ]; then
    echo "   ├─ Production mode: PostgreSQL required"
    echo "   ├─ Ensure DATABASE_URL is set in .env"
fi

echo "   ├─ Running migrations"
flask db upgrade 2>/dev/null || echo "   ⚠️  No migrations to run"

echo "✅ Database ready"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 5. REDIS VERIFICATION
# ─────────────────────────────────────────────────────────────────────────────
echo "⚡ Checking Redis..."

REDIS_URL=${REDIS_URL:-redis://localhost:6379/0}

if redis-cli -u "$REDIS_URL" ping &> /dev/null; then
    echo "✅ Redis connection OK"
    echo "   ├─ Running Redis initialization..."
    python3 << 'EOF'
import logging
from app.utils.initializer import RedisInitializer
logging.basicConfig(level=logging.INFO)
redis_init = RedisInitializer()
if redis_init.connect():
    redis_init.setup_key_namespaces()
EOF
else
    echo "⚠️  Redis not available - starting with limited functionality"
    echo "   └─ Some features (caching, E2EE keys) will not work"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 6. ENCRYPTION KEYS SETUP
# ─────────────────────────────────────────────────────────────────────────────
echo "🔐 Encryption initialization..."

ENCRYPTION_MASTER_PASSWORD=${ENCRYPTION_MASTER_PASSWORD:-}

if [ -z "$ENCRYPTION_MASTER_PASSWORD" ]; then
    echo "⚠️  ENCRYPTION_MASTER_PASSWORD not set"
    echo "   └─ E2EE features will not work until this is configured"
else
    echo "   ├─ Master password configured"
    echo "   ├─ Initializing Signal Protocol..."
    python3 << 'EOF'
import logging
from app.utils.initializer import EncryptionInitializer
logging.basicConfig(level=logging.INFO)
enc_init = EncryptionInitializer()
enc_init.setup_signal_protocol()
EOF
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 7. COMPLETE INITIALIZATION
# ─────────────────────────────────────────────────────────────────────────────
echo "🚀 Running complete initialization..."

python3 << 'EOF'
import logging
from app import create_app
from app.utils.initializer import initialize_app_complete

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

try:
    app = create_app()
    initialize_app_complete(app)
except Exception as e:
    logging.error(f"Initialization error: {e}")
    exit(1)
EOF

echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 8. STARTUP OPTIONS
# ─────────────────────────────────────────────────────────────────────────────
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                      STARTUP OPTIONS                                  ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""
echo "Choose how to start BiteSe:"
echo ""
echo "1) Development mode (Flask with auto-reload)"
echo "2) Production mode (Gunicorn with 4 workers)"
echo "3) Production mode (Gunicorn with 8 workers)"
echo "4) Production mode with SSL/TLS"
echo "5) Docker Compose (requires docker-compose.yml)"
echo "6) Exit setup"
echo ""
echo -n "Select option [1-6]: "
read -r OPTION

case $OPTION in
    1)
        echo ""
        echo "🚀 Starting in DEVELOPMENT mode..."
        echo "   Server: http://localhost:5000"
        echo "   Auto-reload: Enabled"
        echo ""
        python3 run.py
        ;;
    2)
        echo ""
        echo "🚀 Starting in PRODUCTION mode (4 workers)..."
        echo "   Server: http://0.0.0.0:5000"
        echo "   Workers: 4"
        echo ""
        gunicorn -w 4 -b 0.0.0.0:5000 'app:create_app()'
        ;;
    3)
        echo ""
        echo "🚀 Starting in PRODUCTION mode (8 workers)..."
        echo "   Server: http://0.0.0.0:5000"
        echo "   Workers: 8"
        echo ""
        gunicorn -w 8 -b 0.0.0.0:5000 'app:create_app()'
        ;;
    4)
        echo ""
        echo "🚀 Starting in PRODUCTION mode with SSL/TLS..."
        echo "   Server: https://0.0.0.0:5000"
        echo "   Checking for SSL certificates..."
        
        TLS_CERT=${TLS_CERT_PATH:-/etc/ssl/certs/bitese.crt}
        TLS_KEY=${TLS_KEY_PATH:-/etc/ssl/private/bitese.key}
        
        if [ -f "$TLS_CERT" ] && [ -f "$TLS_KEY" ]; then
            echo "   ✅ SSL certificates found"
            gunicorn -w 4 -b 0.0.0.0:5000 \
                --certfile="$TLS_CERT" \
                --keyfile="$TLS_KEY" \
                'app:create_app()'
        else
            echo "   ❌ SSL certificates not found at:"
            echo "      - $TLS_CERT"
            echo "      - $TLS_KEY"
            exit 1
        fi
        ;;
    5)
        echo ""
        echo "🚀 Starting with Docker Compose..."
        docker-compose up
        ;;
    6)
        echo ""
        echo "Setup completed! You can start BiteSe manually with:"
        echo ""
        echo "  Development:  python3 run.py"
        echo "  Production:   gunicorn -w 4 -b 0.0.0.0:5000 'app:create_app()'"
        echo ""
        exit 0
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac
