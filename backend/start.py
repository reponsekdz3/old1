"""
VipChat Backend Startup Script — initializes DB tables, then starts the server.
"""
import os
import sys
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import create_app

app, socketio = create_app('development')

with app.app_context():
    from app.models.models import db
    try:
        db.create_all()
        logger.info("✓ Database tables created/verified")
    except Exception as e:
        logger.error(f"DB init error: {e}")

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    logger.info(f"Starting VipChat on port {port}")
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=True,
        allow_unsafe_werkzeug=True,
        use_reloader=False,
    )
