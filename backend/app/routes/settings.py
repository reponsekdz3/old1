from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, UserSettings, MutedChat, User, Message
from datetime import datetime, timedelta
import io

settings_bp = Blueprint('settings', __name__, url_prefix='/api/settings')

@settings_bp.route('', methods=['GET'])
@jwt_required()
def get_settings():
    """Get user settings"""
    try:
        user_id = get_jwt_identity()
        
        settings = UserSettings.query.filter_by(user_id=user_id).first()
        if not settings:
            settings = UserSettings(user_id=user_id)
            db.session.add(settings)
            db.session.commit()
        
        return jsonify({
            'read_receipts': settings.read_receipts,
            'last_seen_privacy': settings.last_seen_privacy,
            'profile_photo_privacy': settings.profile_photo_privacy,
            'about_privacy': settings.about_privacy,
            'status_privacy': settings.status_privacy,
            'disappearing_messages_duration': settings.disappearing_messages_duration,
            'auto_download_photos': settings.auto_download_photos,
            'auto_download_videos': settings.auto_download_videos,
            'auto_download_documents': settings.auto_download_documents,
            'chat_wallpaper': settings.chat_wallpaper,
            'notification_sound': settings.notification_sound,
            'show_notifications': settings.show_notifications,
            'show_preview': settings.show_preview
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('', methods=['PUT'])
@jwt_required()
def update_settings():
    """Update user settings"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        settings = UserSettings.query.filter_by(user_id=user_id).first()
        if not settings:
            settings = UserSettings(user_id=user_id)
            db.session.add(settings)
        
        if 'read_receipts' in data:
            settings.read_receipts = data['read_receipts']
        if 'last_seen_privacy' in data:
            settings.last_seen_privacy = data['last_seen_privacy']
        if 'profile_photo_privacy' in data:
            settings.profile_photo_privacy = data['profile_photo_privacy']
        if 'about_privacy' in data:
            settings.about_privacy = data['about_privacy']
        if 'status_privacy' in data:
            settings.status_privacy = data['status_privacy']
        if 'disappearing_messages_duration' in data:
            settings.disappearing_messages_duration = data['disappearing_messages_duration']
        if 'auto_download_photos' in data:
            settings.auto_download_photos = data['auto_download_photos']
        if 'auto_download_videos' in data:
            settings.auto_download_videos = data['auto_download_videos']
        if 'auto_download_documents' in data:
            settings.auto_download_documents = data['auto_download_documents']
        if 'chat_wallpaper' in data:
            settings.chat_wallpaper = data['chat_wallpaper']
        if 'notification_sound' in data:
            settings.notification_sound = data['notification_sound']
        if 'show_notifications' in data:
            settings.show_notifications = data['show_notifications']
        if 'show_preview' in data:
            settings.show_preview = data['show_preview']
        
        db.session.commit()
        
        return jsonify({'message': 'Settings updated successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/mute/<chat_id>', methods=['POST'])
@jwt_required()
def mute_chat(chat_id):
    """Mute a chat"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        duration = data.get('duration', 'forever')  # 8hours, 1week, forever
        
        existing = MutedChat.query.filter_by(
            user_id=user_id,
            chat_with_id=chat_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Chat already muted'}), 409
        
        muted_until = None
        if duration == '8hours':
            muted_until = datetime.utcnow() + timedelta(hours=8)
        elif duration == '1week':
            muted_until = datetime.utcnow() + timedelta(weeks=1)
        
        muted = MutedChat(
            user_id=user_id,
            chat_with_id=chat_id,
            muted_until=muted_until
        )
        
        db.session.add(muted)
        db.session.commit()
        
        return jsonify({'message': 'Chat muted successfully'}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/mute/<chat_id>', methods=['DELETE'])
@jwt_required()
def unmute_chat(chat_id):
    """Unmute a chat"""
    try:
        user_id = get_jwt_identity()
        
        muted = MutedChat.query.filter_by(
            user_id=user_id,
            chat_with_id=chat_id
        ).first()
        
        if not muted:
            return jsonify({'error': 'Chat not muted'}), 404
        
        db.session.delete(muted)
        db.session.commit()
        
        return jsonify({'message': 'Chat unmuted successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/muted', methods=['GET'])
@jwt_required()
def get_muted_chats():
    """Get all muted chats"""
    try:
        user_id = get_jwt_identity()
        
        muted_chats = MutedChat.query.filter_by(user_id=user_id).all()
        
        result = []
        for muted in muted_chats:
            result.append({
                'chat_id': muted.chat_with_id or muted.group_id,
                'muted_until': muted.muted_until.isoformat() if muted.muted_until else None,
                'is_forever': muted.muted_until is None
            })
        
        return jsonify({'muted_chats': result}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/backup', methods=['POST'])
@jwt_required()
def create_backup():
    """Create chat backup"""
    try:
        from app.models.models import ChatBackup, Message
        import json
        import os
        
        user_id = get_jwt_identity()
        
        # Get all user messages
        messages = Message.query.filter(
            db.or_(Message.sender_id == user_id, Message.receiver_id == user_id)
        ).all()
        
        backup_data = {
            'user_id': user_id,
            'created_at': datetime.utcnow().isoformat(),
            'messages': [m.to_dict() for m in messages]
        }
        
        # Save backup file
        filename = f"backup_{user_id}_{datetime.utcnow().timestamp()}.json"
        backup_folder = os.path.join('backups')
        os.makedirs(backup_folder, exist_ok=True)
        filepath = os.path.join(backup_folder, filename)
        
        with open(filepath, 'w') as f:
            json.dump(backup_data, f)
        
        backup_size = os.path.getsize(filepath)
        
        backup = ChatBackup(
            user_id=user_id,
            backup_url=f"/backups/{filename}",
            backup_size=backup_size,
            message_count=len(messages)
        )
        
        db.session.add(backup)
        db.session.commit()
        
        return jsonify({
            'message': 'Backup created successfully',
            'backup_url': backup.backup_url,
            'size': backup_size,
            'message_count': len(messages)
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/backups', methods=['GET'])
@jwt_required()
def get_backups():
    """Get all backups"""
    try:
        from app.models.models import ChatBackup
        user_id = get_jwt_identity()
        
        backups = ChatBackup.query.filter_by(user_id=user_id)\
            .order_by(ChatBackup.created_at.desc()).all()
        
        return jsonify({
            'backups': [{
                'id': b.id,
                'backup_url': b.backup_url,
                'size': b.backup_size,
                'message_count': b.message_count,
                'created_at': b.created_at.isoformat()
            } for b in backups]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@settings_bp.route('/export-chat/<chat_id>', methods=['GET'])
@jwt_required()
def export_chat(chat_id):
    """Export chat as text file"""
    try:
        from app.models.models import Message
        import io
        
        user_id = get_jwt_identity()
        
        messages = Message.query.filter(
            db.or_(
                db.and_(Message.sender_id == user_id, Message.receiver_id == chat_id),
                db.and_(Message.sender_id == chat_id, Message.receiver_id == user_id)
            )
        ).order_by(Message.created_at).all()
        
        # Create text export
        export_text = f"Chat Export - {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}\n"
        export_text += "=" * 50 + "\n\n"
        
        for msg in messages:
            timestamp = msg.created_at.strftime('%Y-%m-%d %H:%M:%S')
            sender = msg.sender.full_name
            content = msg.content or f"[{msg.media_type}]"
            export_text += f"[{timestamp}] {sender}: {content}\n"
        
        # Create file-like object
        output = io.BytesIO()
        output.write(export_text.encode('utf-8'))
        output.seek(0)
        
        return send_file(
            output,
            mimetype='text/plain',
            as_attachment=True,
            download_name=f'chat_export_{chat_id}.txt'
        )
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
