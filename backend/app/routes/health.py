from flask import jsonify

def register_health_routes(app):
    @app.route('/api/health', methods=['GET'])
    def health_check():
        return jsonify({
            'status': 'healthy',
            'service': 'vipchat-backend',
            'version': '1.0.0'
        }), 200
