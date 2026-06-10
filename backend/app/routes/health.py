from flask import jsonify
import time
import psutil

start_time = time.time()

def register_health_routes(app):
    """Register health check and monitoring endpoints"""
    
    @app.route('/health', methods=['GET'])
    def health_check():
        """Basic health check endpoint for Docker and load balancers"""
        return jsonify({
            'status': 'healthy',
            'timestamp': time.time(),
            'uptime': time.time() - start_time
        }), 200
    
    @app.route('/health/ready', methods=['GET'])
    def readiness_check():
        """Readiness check - verify all dependencies are available"""
        try:
            from app.database import db
            # Check database connection
            db.session.execute('SELECT 1')
            
            return jsonify({
                'status': 'ready',
                'database': 'connected',
                'timestamp': time.time()
            }), 200
        except Exception as e:
            return jsonify({
                'status': 'not_ready',
                'error': str(e),
                'timestamp': time.time()
            }), 503
    
    @app.route('/health/live', methods=['GET'])
    def liveness_check():
        """Liveness check - verify application is running"""
        return jsonify({
            'status': 'alive',
            'timestamp': time.time()
        }), 200
    
    @app.route('/metrics', methods=['GET'])
    def metrics():
        """Expose metrics for Prometheus"""
        try:
            cpu_percent = psutil.cpu_percent(interval=1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            
            metrics_data = f"""# HELP vipchat_cpu_usage_percent CPU usage percentage
# TYPE vipchat_cpu_usage_percent gauge
vipchat_cpu_usage_percent {cpu_percent}

# HELP vipchat_memory_usage_percent Memory usage percentage
# TYPE vipchat_memory_usage_percent gauge
vipchat_memory_usage_percent {memory.percent}

# HELP vipchat_memory_used_bytes Memory used in bytes
# TYPE vipchat_memory_used_bytes gauge
vipchat_memory_used_bytes {memory.used}

# HELP vipchat_disk_usage_percent Disk usage percentage
# TYPE vipchat_disk_usage_percent gauge
vipchat_disk_usage_percent {disk.percent}

# HELP vipchat_uptime_seconds Application uptime in seconds
# TYPE vipchat_uptime_seconds counter
vipchat_uptime_seconds {time.time() - start_time}
"""
            return metrics_data, 200, {'Content-Type': 'text/plain; charset=utf-8'}
        except Exception as e:
            return str(e), 500
