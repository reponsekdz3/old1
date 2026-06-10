#!/bin/bash
set -e

echo "=========================================="
echo "VipChat Backend Startup"
echo "=========================================="

# Wait for MySQL to be ready
echo "Waiting for MySQL to be ready..."
until mysql -h"${MYSQL_HOST}" -u"${MYSQL_USER}" -p"${MYSQL_PASSWORD}" -e "SELECT 1" &>/dev/null; do
    echo "MySQL is unavailable - sleeping"
    sleep 2
done
echo "✓ MySQL is ready"

# Wait for Redis to be ready
if [ -n "${REDIS_URL}" ]; then
    echo "Waiting for Redis to be ready..."
    until redis-cli -u "${REDIS_URL}" ping &>/dev/null; do
        echo "Redis is unavailable - sleeping"
        sleep 2
    done
    echo "✓ Redis is ready"
fi

# Initialize database tables
echo "Initializing database tables..."
python -c "
from app import create_app
from app.database import db

app, socketio = create_app()
with app.app_context():
    db.create_all()
    print('✓ Database tables created')
"

# Start the application
echo "Starting VipChat backend server..."
exec "$@"
