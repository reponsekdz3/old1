"""
WSGI entry point for VipChat Backend
Used by Gunicorn in production Docker container
"""
import os
import sys

# Add app directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app

# Create application instance
app, socketio = create_app(config_name=os.getenv('FLASK_ENV', 'production'))

# For Gunicorn with gevent-websocket
application = app

if __name__ == '__main__':
    # This is only used for development
    socketio.run(app, host='0.0.0.0', port=8000, debug=False)
