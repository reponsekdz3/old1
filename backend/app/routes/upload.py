from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from werkzeug.utils import secure_filename
import os
from datetime import datetime
import uuid
from PIL import Image
import mimetypes

upload_bp = Blueprint('upload', __name__, url_prefix='/api/upload')

UPLOAD_FOLDER = 'uploads'
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'mov', 'avi', 'mkv', 'webm'}
ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'ogg', 'm4a', 'aac'}
ALLOWED_DOCUMENT_EXTENSIONS = {'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar'}

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB
MAX_AUDIO_SIZE = 20 * 1024 * 1024  # 20MB
MAX_DOCUMENT_SIZE = 50 * 1024 * 1024  # 50MB

def allowed_file(filename, allowed_extensions):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in allowed_extensions

def get_file_type(filename):
    ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if ext in ALLOWED_IMAGE_EXTENSIONS:
        return 'image'
    elif ext in ALLOWED_VIDEO_EXTENSIONS:
        return 'video'
    elif ext in ALLOWED_AUDIO_EXTENSIONS:
        return 'audio'
    elif ext in ALLOWED_DOCUMENT_EXTENSIONS:
        return 'document'
    return 'unknown'

def compress_image(image_path, max_size=(1920, 1920), quality=85):
    """Compress and resize image"""
    try:
        with Image.open(image_path) as img:
            # Convert RGBA to RGB if necessary
            if img.mode in ('RGBA', 'LA', 'P'):
                background = Image.new('RGB', img.size, (255, 255, 255))
                background.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
                img = background
            
            # Resize if larger than max_size
            img.thumbnail(max_size, Image.Resampling.LANCZOS)
            
            # Save with compression
            img.save(image_path, 'JPEG', quality=quality, optimize=True)
            return True
    except Exception as e:
        print(f"Image compression error: {e}")
        return False

def generate_thumbnail(video_path):
    """Generate thumbnail for video (placeholder - requires ffmpeg)"""
    # In production, use ffmpeg to extract first frame
    # For now, return None
    return None

@upload_bp.route('/image', methods=['POST'])
@jwt_required()
def upload_image():
    """Upload and process image"""
    try:
        user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, ALLOWED_IMAGE_EXTENSIONS):
            return jsonify({'error': 'Invalid file type. Allowed: ' + ', '.join(ALLOWED_IMAGE_EXTENSIONS)}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_IMAGE_SIZE:
            return jsonify({'error': f'File too large. Max size: {MAX_IMAGE_SIZE / (1024*1024)}MB'}), 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{uuid.uuid4().hex}.{ext}"
        
        # Create upload directory
        upload_dir = os.path.join(UPLOAD_FOLDER, 'images')
        os.makedirs(upload_dir, exist_ok=True)
        
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        # Compress image
        compress_image(filepath)
        
        # Get final file size
        final_size = os.path.getsize(filepath)
        
        return jsonify({
            'url': f"/uploads/images/{filename}",
            'filename': filename,
            'size': final_size,
            'type': 'image'
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/video', methods=['POST'])
@jwt_required()
def upload_video():
    """Upload video file"""
    try:
        user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, ALLOWED_VIDEO_EXTENSIONS):
            return jsonify({'error': 'Invalid file type. Allowed: ' + ', '.join(ALLOWED_VIDEO_EXTENSIONS)}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_VIDEO_SIZE:
            return jsonify({'error': f'File too large. Max size: {MAX_VIDEO_SIZE / (1024*1024)}MB'}), 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{uuid.uuid4().hex}.{ext}"
        
        # Create upload directory
        upload_dir = os.path.join(UPLOAD_FOLDER, 'videos')
        os.makedirs(upload_dir, exist_ok=True)
        
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        # Generate thumbnail (placeholder)
        thumbnail_url = generate_thumbnail(filepath)
        
        return jsonify({
            'url': f"/uploads/videos/{filename}",
            'filename': filename,
            'size': file_size,
            'type': 'video',
            'thumbnail_url': thumbnail_url
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/audio', methods=['POST'])
@jwt_required()
def upload_audio():
    """Upload audio file"""
    try:
        user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, ALLOWED_AUDIO_EXTENSIONS):
            return jsonify({'error': 'Invalid file type. Allowed: ' + ', '.join(ALLOWED_AUDIO_EXTENSIONS)}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_AUDIO_SIZE:
            return jsonify({'error': f'File too large. Max size: {MAX_AUDIO_SIZE / (1024*1024)}MB'}), 400
        
        # Generate unique filename
        ext = file.filename.rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{uuid.uuid4().hex}.{ext}"
        
        # Create upload directory
        upload_dir = os.path.join(UPLOAD_FOLDER, 'audio')
        os.makedirs(upload_dir, exist_ok=True)
        
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        return jsonify({
            'url': f"/uploads/audio/{filename}",
            'filename': filename,
            'size': file_size,
            'type': 'audio'
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/document', methods=['POST'])
@jwt_required()
def upload_document():
    """Upload document file"""
    try:
        user_id = get_jwt_identity()
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename, ALLOWED_DOCUMENT_EXTENSIONS):
            return jsonify({'error': 'Invalid file type. Allowed: ' + ', '.join(ALLOWED_DOCUMENT_EXTENSIONS)}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_DOCUMENT_SIZE:
            return jsonify({'error': f'File too large. Max size: {MAX_DOCUMENT_SIZE / (1024*1024)}MB'}), 400
        
        # Generate unique filename
        original_name = secure_filename(file.filename)
        ext = original_name.rsplit('.', 1)[1].lower()
        filename = f"{user_id}_{uuid.uuid4().hex}.{ext}"
        
        # Create upload directory
        upload_dir = os.path.join(UPLOAD_FOLDER, 'documents')
        os.makedirs(upload_dir, exist_ok=True)
        
        filepath = os.path.join(upload_dir, filename)
        file.save(filepath)
        
        return jsonify({
            'url': f"/uploads/documents/{filename}",
            'filename': filename,
            'original_name': original_name,
            'size': file_size,
            'type': 'document'
        }), 201
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@upload_bp.route('/multi', methods=['POST'])
@jwt_required()
def upload_multiple():
    """Upload multiple files at once"""
    try:
        user_id = get_jwt_identity()
        
        if 'files' not in request.files:
            return jsonify({'error': 'No files provided'}), 400
        
        files = request.files.getlist('files')
        
        if not files:
            return jsonify({'error': 'No files selected'}), 400
        
        uploaded_files = []
        errors = []
        
        for file in files:
            try:
                if file.filename == '':
                    continue

                file_type = get_file_type(file.filename)
                if file_type == 'unknown':
                    errors.append(f"{file.filename}: Invalid file type")
                    continue

                safe_name = secure_filename(file.filename)
                ext = safe_name.rsplit('.', 1)[1].lower() if '.' in safe_name else 'bin'
                filename = f"{user_id}_{uuid.uuid4().hex}.{ext}"

                # Check size
                file.seek(0, os.SEEK_END)
                file_size = file.tell()
                file.seek(0)

                size_limits = {
                    'image': MAX_IMAGE_SIZE,
                    'video': MAX_VIDEO_SIZE,
                    'audio': MAX_AUDIO_SIZE,
                    'document': MAX_DOCUMENT_SIZE,
                }
                if file_size > size_limits.get(file_type, MAX_DOCUMENT_SIZE):
                    errors.append(f"{file.filename}: File too large")
                    continue

                sub_dir = f"{file_type}s"
                upload_dir = os.path.join(UPLOAD_FOLDER, sub_dir)
                os.makedirs(upload_dir, exist_ok=True)
                filepath = os.path.join(upload_dir, filename)
                file.save(filepath)

                # Compress images
                if file_type == 'image':
                    compress_image(filepath)

                file_url = f"/uploads/{sub_dir}/{filename}"
                result = {
                    'url': file_url,
                    'filename': filename,
                    'original_name': safe_name,
                    'size': file_size,
                    'type': file_type,
                }
                if file_type == 'video':
                    result['thumbnail_url'] = generate_thumbnail(filepath)
                uploaded_files.append(result)

            except Exception as e:
                errors.append(f"{file.filename}: {str(e)}")
        
        return jsonify({
            'uploaded': uploaded_files,
            'errors': errors,
            'total': len(files),
            'success': len(uploaded_files)
        }), 201 if uploaded_files else 400
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
