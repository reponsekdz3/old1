"""
VipChat App Distribution Endpoints
Serves APK metadata and the APK file itself.
Place the built APK at:  backend/uploads/releases/vipchat.apk
"""

from flask import Blueprint, jsonify, send_file, request, current_app
import os
import time

app_dist_bp = Blueprint('app_distribution', __name__, url_prefix='/api/app')

APK_DIR      = os.path.join('uploads', 'releases')
APK_FILENAME = 'vipchat.apk'
APK_PATH     = os.path.join(APK_DIR, APK_FILENAME)

APP_VERSION  = '2.0.0'
BUILD_NUMBER = 1
PACKAGE_NAME = 'com.vipchat.app'

PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.vipchat.app'
APP_STORE_URL  = 'https://apps.apple.com/app/vipchat'


def _apk_size_mb():
    try:
        size_bytes = os.path.getsize(APK_PATH)
        return round(size_bytes / (1024 * 1024), 1)
    except OSError:
        return 0


@app_dist_bp.route('/info', methods=['GET'])
def app_info():
    """Return metadata about the available app downloads."""
    apk_available = os.path.isfile(APK_PATH)
    return jsonify({
        'version':        APP_VERSION,
        'build_number':   BUILD_NUMBER,
        'package':        PACKAGE_NAME,
        'apk_available':  apk_available,
        'apk_size_mb':    _apk_size_mb() if apk_available else 0,
        'apk_url':        '/api/app/download' if apk_available else None,
        'play_store_url': PLAY_STORE_URL,
        'app_store_url':  APP_STORE_URL,
        'min_android':    '7.0',
        'min_ios':        '14.0',
        'updated_at':     int(os.path.getmtime(APK_PATH)) if apk_available else None,
    })


@app_dist_bp.route('/download', methods=['GET'])
def download_apk():
    """Stream the APK file for direct download."""
    os.makedirs(APK_DIR, exist_ok=True)

    if not os.path.isfile(APK_PATH):
        return jsonify({
            'error':   'APK not yet available',
            'message': 'The Android APK is being prepared. Check back soon or use the Play Store / PWA options.',
            'play_store_url': PLAY_STORE_URL,
        }), 404

    download_name = f'VipChat-v{APP_VERSION}.apk'
    return send_file(
        APK_PATH,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/vnd.android.package-archive',
    )


@app_dist_bp.route('/upload-apk', methods=['POST'])
def upload_apk():
    """
    Admin endpoint to upload a new APK build.
    Requires the X-Admin-Secret header matching APP_ADMIN_SECRET env var.
    Usage:  curl -X POST /api/app/upload-apk \
               -H "X-Admin-Secret: <secret>" \
               -F "apk=@path/to/vipchat.apk"
    """
    admin_secret = os.environ.get('APP_ADMIN_SECRET', '')
    if not admin_secret:
        return jsonify({'error': 'APK upload not configured (APP_ADMIN_SECRET not set)'}), 503

    provided = request.headers.get('X-Admin-Secret', '')
    if not provided or provided != admin_secret:
        return jsonify({'error': 'Unauthorized'}), 403

    if 'apk' not in request.files:
        return jsonify({'error': 'No APK file in request (field name: apk)'}), 400

    file = request.files['apk']
    if not file.filename or not file.filename.lower().endswith('.apk'):
        return jsonify({'error': 'File must have .apk extension'}), 400

    os.makedirs(APK_DIR, exist_ok=True)
    file.save(APK_PATH)

    return jsonify({
        'success':    True,
        'message':    'APK uploaded successfully',
        'size_mb':    _apk_size_mb(),
        'version':    APP_VERSION,
        'download_url': '/api/app/download',
    }), 200
