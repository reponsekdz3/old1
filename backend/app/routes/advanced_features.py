from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, Message, StarredMessage, MediaGallery, LiveLocation, User
from datetime import datetime, timedelta
import os
import base64
from werkzeug.utils import secure_filename

advanced_messages_bp = Blueprint('advanced_messages', __name__, url_prefix='/api/messages')

@advanced_messages_bp.route('/<message_id>/forward', methods=['POST'])
@jwt_required()
def forward_message(message_id):
    """Forward message to multiple recipients"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        recipient_ids = data.get('recipient_ids', [])
        
        if not recipient_ids:
            return jsonify({'error': 'Recipients required'}), 400
        
        original_message = Message.query.get(message_id)
        if not original_message:
            return jsonify({'error': 'Message not found'}), 404
        
        forwarded_messages = []
        for recipient_id in recipient_ids:
            new_message = Message(
                sender_id=user_id,
                receiver_id=recipient_id,
                content=original_message.content,
                media_url=original_message.media_url,
                media_type=original_message.media_type,
                forwarded_from_id=message_id
            )
            db.session.add(new_message)
            forwarded_messages.append(new_message)
        
        original_message.forward_count += len(recipient_ids)
        db.session.commit()
        
        return jsonify({
            'message': 'Messages forwarded successfully',
            'count': len(forwarded_messages),
            'messages': [m.to_dict() for m in forwarded_messages]
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/<message_id>/star', methods=['POST'])
@jwt_required()
def star_message(message_id):
    """Star a message"""
    try:
        user_id = get_jwt_identity()
        
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        existing = StarredMessage.query.filter_by(
            user_id=user_id,
            message_id=message_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Message already starred'}), 409
        
        starred = StarredMessage(user_id=user_id, message_id=message_id)
        db.session.add(starred)
        db.session.commit()
        
        return jsonify({'message': 'Message starred successfully'}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/<message_id>/star', methods=['DELETE'])
@jwt_required()
def unstar_message(message_id):
    """Unstar a message"""
    try:
        user_id = get_jwt_identity()
        
        starred = StarredMessage.query.filter_by(
            user_id=user_id,
            message_id=message_id
        ).first()
        
        if not starred:
            return jsonify({'error': 'Message not starred'}), 404
        
        db.session.delete(starred)
        db.session.commit()
        
        return jsonify({'message': 'Message unstarred successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/starred', methods=['GET'])
@jwt_required()
def get_starred_messages():
    """Get all starred messages"""
    try:
        user_id = get_jwt_identity()
        
        starred = StarredMessage.query.filter_by(user_id=user_id).all()
        messages = [s.message.to_dict() for s in starred if s.message]
        
        return jsonify({'starred_messages': messages}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/search', methods=['GET'])
@jwt_required()
def search_messages():
    """Search messages"""
    try:
        user_id = get_jwt_identity()
        query = request.args.get('q', '').strip()
        chat_with_id = request.args.get('chat_with_id')
        
        if not query:
            return jsonify({'error': 'Search query required'}), 400
        
        messages_query = Message.query.filter(
            db.or_(
                db.and_(Message.sender_id == user_id, Message.is_deleted_sender == False),
                db.and_(Message.receiver_id == user_id, Message.is_deleted_receiver == False)
            ),
            Message.content.ilike(f'%{query}%')
        )
        
        if chat_with_id:
            messages_query = messages_query.filter(
                db.or_(
                    db.and_(Message.sender_id == user_id, Message.receiver_id == chat_with_id),
                    db.and_(Message.sender_id == chat_with_id, Message.receiver_id == user_id)
                )
            )
        
        messages = messages_query.order_by(Message.created_at.desc()).limit(50).all()
        
        return jsonify({
            'results': [m.to_dict() for m in messages],
            'count': len(messages)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/<message_id>/delete-for-everyone', methods=['DELETE'])
@jwt_required()
def delete_for_everyone(message_id):
    """Delete message for everyone"""
    try:
        user_id = get_jwt_identity()
        
        message = Message.query.get(message_id)
        if not message:
            return jsonify({'error': 'Message not found'}), 404
        
        if message.sender_id != user_id:
            return jsonify({'error': 'Can only delete your own messages'}), 403
        
        # Check if message is within 1 hour
        time_diff = datetime.utcnow() - message.created_at
        if time_diff > timedelta(hours=1):
            return jsonify({'error': 'Can only delete messages within 1 hour'}), 400
        
        message.is_deleted_everyone = True
        message.content = "This message was deleted"
        db.session.commit()
        
        return jsonify({'message': 'Message deleted for everyone'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/voice', methods=['POST'])
@jwt_required()
def send_voice_message():
    """Send voice message"""
    try:
        user_id = get_jwt_identity()
        receiver_id = request.form.get('receiver_id')
        audio_data = request.files.get('audio')
        duration = request.form.get('duration', type=int)
        
        if not audio_data or not receiver_id:
            return jsonify({'error': 'Audio and receiver required'}), 400
        
        # Save audio file
        filename = secure_filename(f"{user_id}_{datetime.utcnow().timestamp()}.ogg")
        upload_folder = os.path.join('uploads', 'voice')
        os.makedirs(upload_folder, exist_ok=True)
        filepath = os.path.join(upload_folder, filename)
        audio_data.save(filepath)
        
        message = Message(
            sender_id=user_id,
            receiver_id=receiver_id,
            content="Voice message",
            media_url=f"/uploads/voice/{filename}",
            media_type='voice',
            media_duration=duration,
            media_size=os.path.getsize(filepath)
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify(message.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/location', methods=['POST'])
@jwt_required()
def send_location():
    """Send location or live location"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        receiver_id = data.get('receiver_id')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        location_name = data.get('location_name')
        is_live = data.get('is_live', False)
        duration = data.get('duration', 15)  # minutes
        
        if not all([receiver_id, latitude, longitude]):
            return jsonify({'error': 'Receiver, latitude, and longitude required'}), 400
        
        message = Message(
            sender_id=user_id,
            receiver_id=receiver_id,
            content=location_name or "Location",
            media_type='location',
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
            is_live_location=is_live,
            live_location_duration=duration if is_live else None
        )
        
        db.session.add(message)
        db.session.flush()
        
        if is_live:
            live_location = LiveLocation(
                user_id=user_id,
                message_id=message.id,
                latitude=latitude,
                longitude=longitude,
                expires_at=datetime.utcnow() + timedelta(minutes=duration)
            )
            db.session.add(live_location)
        
        db.session.commit()
        
        return jsonify(message.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/live-location/<message_id>', methods=['PUT'])
@jwt_required()
def update_live_location(message_id):
    """Update live location"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        
        live_location = LiveLocation.query.filter_by(
            message_id=message_id,
            user_id=user_id,
            is_active=True
        ).first()
        
        if not live_location:
            return jsonify({'error': 'Live location not found'}), 404
        
        if datetime.utcnow() > live_location.expires_at:
            live_location.is_active = False
            db.session.commit()
            return jsonify({'error': 'Live location expired'}), 400
        
        live_location.latitude = latitude
        live_location.longitude = longitude
        db.session.commit()
        
        return jsonify({'message': 'Location updated'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/contact', methods=['POST'])
@jwt_required()
def send_contact():
    """Send contact card"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        receiver_id = data.get('receiver_id')
        contact_name = data.get('contact_name')
        contact_phone = data.get('contact_phone')
        
        if not all([receiver_id, contact_name, contact_phone]):
            return jsonify({'error': 'All fields required'}), 400
        
        message = Message(
            sender_id=user_id,
            receiver_id=receiver_id,
            content=f"Contact: {contact_name}",
            media_type='contact',
            contact_name=contact_name,
            contact_phone=contact_phone
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify(message.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@advanced_messages_bp.route('/media-gallery/<chat_with_id>', methods=['GET'])
@jwt_required()
def get_media_gallery(chat_with_id):
    """Get media gallery for a chat"""
    try:
        user_id = get_jwt_identity()
        media_type = request.args.get('type', 'image')  # image, video, document
        
        messages = Message.query.filter(
            db.or_(
                db.and_(Message.sender_id == user_id, Message.receiver_id == chat_with_id),
                db.and_(Message.sender_id == chat_with_id, Message.receiver_id == user_id)
            ),
            Message.media_type == media_type,
            Message.media_url.isnot(None)
        ).order_by(Message.created_at.desc()).limit(100).all()
        
        return jsonify({
            'media': [m.to_dict() for m in messages],
            'count': len(messages)
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

broadcast_bp = Blueprint('broadcast', __name__, url_prefix='/api/broadcast')

@broadcast_bp.route('/send', methods=['POST'])
@jwt_required()
def send_broadcast():
    """Send broadcast message"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        recipient_ids = data.get('recipient_ids', [])
        content = data.get('content')
        media_url = data.get('media_url')
        
        if not recipient_ids or not (content or media_url):
            return jsonify({'error': 'Recipients and content required'}), 400
        
        messages = []
        for recipient_id in recipient_ids:
            message = Message(
                sender_id=user_id,
                receiver_id=recipient_id,
                content=content,
                media_url=media_url
            )
            db.session.add(message)
            messages.append(message)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Broadcast sent',
            'count': len(messages)
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

archive_bp = Blueprint('archive', __name__, url_prefix='/api/archive')

@archive_bp.route('/chat/<chat_id>', methods=['POST'])
@jwt_required()
def archive_chat(chat_id):
    """Archive a chat"""
    try:
        from app.models.models import ArchivedChat
        user_id = get_jwt_identity()
        
        existing = ArchivedChat.query.filter_by(
            user_id=user_id,
            chat_with_id=chat_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Chat already archived'}), 409
        
        archived = ArchivedChat(user_id=user_id, chat_with_id=chat_id)
        db.session.add(archived)
        db.session.commit()
        
        return jsonify({'message': 'Chat archived'}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@archive_bp.route('/chat/<chat_id>', methods=['DELETE'])
@jwt_required()
def unarchive_chat(chat_id):
    """Unarchive a chat"""
    try:
        from app.models.models import ArchivedChat
        user_id = get_jwt_identity()
        
        archived = ArchivedChat.query.filter_by(
            user_id=user_id,
            chat_with_id=chat_id
        ).first()
        
        if not archived:
            return jsonify({'error': 'Chat not archived'}), 404
        
        db.session.delete(archived)
        db.session.commit()
        
        return jsonify({'message': 'Chat unarchived'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

calls_bp = Blueprint('calls', __name__, url_prefix='/api/calls')

@calls_bp.route('/initiate', methods=['POST'])
@jwt_required()
def initiate_call():
    """Initiate voice/video call"""
    try:
        from app.models.models import Call
        caller_id = get_jwt_identity()
        data = request.json
        
        receiver_id = data.get('receiver_id')
        call_type = data.get('call_type', 'voice')  # voice or video
        
        if not receiver_id:
            return jsonify({'error': 'Receiver required'}), 400
        
        call = Call(
            caller_id=caller_id,
            receiver_id=receiver_id,
            call_type=call_type,
            status='initiated'
        )
        
        db.session.add(call)
        db.session.commit()
        
        return jsonify({'call': call.to_dict(), 'call_id': call.id}), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calls_bp.route('/<call_id>/answer', methods=['PUT'])
@jwt_required()
def answer_call(call_id):
    """Answer a call"""
    try:
        from app.models.models import Call
        user_id = get_jwt_identity()
        
        call = Call.query.get(call_id)
        if not call:
            return jsonify({'error': 'Call not found'}), 404
        
        if call.receiver_id != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        
        call.status = 'answered'
        db.session.commit()
        
        return jsonify(call.to_dict()), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calls_bp.route('/<call_id>/end', methods=['PUT'])
@jwt_required()
def end_call(call_id):
    """End a call"""
    try:
        from app.models.models import Call
        user_id = get_jwt_identity()
        data = request.json
        
        call = Call.query.get(call_id)
        if not call:
            return jsonify({'error': 'Call not found'}), 404
        
        if call.caller_id != user_id and call.receiver_id != user_id:
            return jsonify({'error': 'Not authorized'}), 403
        
        call.status = 'ended'
        call.ended_at = datetime.utcnow()
        call.duration = data.get('duration', 0)
        db.session.commit()
        
        return jsonify(call.to_dict()), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@calls_bp.route('/history', methods=['GET'])
@jwt_required()
def get_call_history():
    """Get call history"""
    try:
        from app.models.models import Call
        user_id = get_jwt_identity()
        
        calls = Call.query.filter(
            db.or_(Call.caller_id == user_id, Call.receiver_id == user_id)
        ).order_by(Call.started_at.desc()).limit(50).all()
        
        return jsonify({
            'calls': [c.to_dict() for c in calls]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
