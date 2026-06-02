from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, Message, MessageStatus, User, StarredMessage, MessageReaction
from datetime import datetime
import requests as http_requests
import logging

logger = logging.getLogger(__name__)
messages_bp = Blueprint('messages', __name__, url_prefix='/api/messages')

@messages_bp.route('/<receiver_id>', methods=['POST'])
@jwt_required()
def send_message(receiver_id):
    try:
        sender_id = get_jwt_identity()
        data = request.json or {}
        content = data.get('content', '').strip() or None
        media_url = data.get('media_url')
        media_type = data.get('media_type')
        replied_to_id = data.get('replied_to_id')
        contact_name = data.get('contact_name')
        contact_phone = data.get('contact_phone')
        latitude = data.get('latitude')
        longitude = data.get('longitude')
        location_name = data.get('location_name')

        if not content and not media_url and not (latitude and longitude) and not contact_phone:
            return jsonify({'error': 'Message content required'}), 400

        receiver = User.query.get(receiver_id)
        if not receiver:
            return jsonify({'error': 'Receiver not found'}), 404

        if getattr(receiver, 'is_banned', False):
            return jsonify({'error': 'User unavailable'}), 403

        msg = Message(
            sender_id=sender_id,
            receiver_id=receiver_id,
            content=content,
            media_url=media_url,
            media_type=media_type,
            replied_to_id=replied_to_id,
            contact_name=contact_name,
            contact_phone=contact_phone,
            latitude=latitude,
            longitude=longitude,
            location_name=location_name,
            status=MessageStatus.SENT,
        )
        db.session.add(msg)
        db.session.commit()

        # Fire push notification to receiver (non-blocking)
        try:
            from app.utils.push_sender import push_to_user
            sender = User.query.get(sender_id)
            sender_name = sender.full_name if sender else 'Someone'
            preview = (content[:60] + '…') if content and len(content) > 60 else (content or f'[{media_type or "attachment"}]')
            push_to_user(receiver_id, sender_name, preview)
        except Exception:
            pass

        return jsonify(msg.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/chat/<user_id>', methods=['GET'])
@jwt_required()
def get_chat_history(user_id):
    try:
        current_user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)

        query = Message.query.filter(
            db.or_(
                db.and_(Message.sender_id == current_user_id, Message.receiver_id == user_id),
                db.and_(Message.sender_id == user_id, Message.receiver_id == current_user_id),
            ),
            Message.is_deleted_everyone == False,
        ).order_by(Message.created_at.asc())

        pagination = query.paginate(page=page, per_page=per_page, error_out=False)

        # Auto-mark received messages as delivered
        undelivered = Message.query.filter(
            Message.sender_id == user_id,
            Message.receiver_id == current_user_id,
            Message.status == MessageStatus.SENT,
        ).all()
        for m in undelivered:
            m.status = MessageStatus.DELIVERED
        if undelivered:
            db.session.commit()

        return jsonify({
            'messages': [m.to_dict() for m in pagination.items],
            'total': pagination.total,
            'pages': pagination.pages,
            'page': page,
            'has_prev': pagination.has_prev,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/chat/<user_id>/read-all', methods=['PUT'])
@jwt_required()
def mark_all_read(user_id):
    try:
        current_user_id = get_jwt_identity()
        Message.query.filter(
            Message.sender_id == user_id,
            Message.receiver_id == current_user_id,
            Message.status != MessageStatus.READ,
        ).update({Message.status: MessageStatus.READ})
        db.session.commit()
        return jsonify({'message': 'All marked read'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/read', methods=['PUT'])
@jwt_required()
def mark_as_read(message_id):
    try:
        user_id = get_jwt_identity()
        msg = Message.query.filter_by(id=message_id, receiver_id=user_id).first()
        if not msg:
            return jsonify({'error': 'Not found'}), 404
        msg.status = MessageStatus.READ
        db.session.commit()
        return jsonify({'message': 'Read'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/delivered', methods=['PUT'])
@jwt_required()
def mark_as_delivered(message_id):
    try:
        user_id = get_jwt_identity()
        msg = Message.query.filter_by(id=message_id, receiver_id=user_id).first()
        if msg and msg.status == MessageStatus.SENT:
            msg.status = MessageStatus.DELIVERED
            db.session.commit()
        return jsonify({'message': 'Delivered'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/edit', methods=['PUT'])
@jwt_required()
def edit_message(message_id):
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        new_content = data.get('content', '').strip()
        if not new_content:
            return jsonify({'error': 'Content required'}), 400
        msg = Message.query.filter_by(id=message_id, sender_id=user_id).first()
        if not msg:
            return jsonify({'error': 'Not found'}), 404
        msg.content = new_content
        msg.is_edited = True
        msg.edited_at = datetime.utcnow()
        db.session.commit()
        return jsonify(msg.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/delete', methods=['DELETE'])
@jwt_required()
def delete_message(message_id):
    try:
        user_id = get_jwt_identity()
        delete_for = request.args.get('for', 'me')
        msg = Message.query.get(message_id)
        if not msg:
            return jsonify({'error': 'Not found'}), 404
        if msg.sender_id != user_id and msg.receiver_id != user_id:
            return jsonify({'error': 'Unauthorized'}), 403
        if delete_for == 'everyone' and msg.sender_id == user_id:
            msg.is_deleted_everyone = True
            msg.content = 'This message was deleted'
            msg.media_url = None
        elif msg.sender_id == user_id:
            msg.is_deleted_sender = True
        else:
            msg.is_deleted_receiver = True
        db.session.commit()
        return jsonify({'message': 'Deleted', 'id': message_id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/react', methods=['POST'])
@jwt_required()
def add_reaction(message_id):
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        emoji = data.get('emoji', '').strip()
        if not emoji:
            return jsonify({'error': 'Emoji required'}), 400
        MessageReaction.query.filter_by(message_id=message_id, user_id=user_id).delete()
        reaction = MessageReaction(message_id=message_id, user_id=user_id, reaction_emoji=emoji)
        db.session.add(reaction)
        db.session.commit()
        msg = Message.query.get(message_id)
        return jsonify(msg.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/react', methods=['DELETE'])
@jwt_required()
def remove_reaction(message_id):
    try:
        user_id = get_jwt_identity()
        MessageReaction.query.filter_by(message_id=message_id, user_id=user_id).delete()
        db.session.commit()
        return jsonify({'message': 'Removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/star', methods=['POST'])
@jwt_required()
def star_message(message_id):
    try:
        user_id = get_jwt_identity()
        existing = StarredMessage.query.filter_by(user_id=user_id, message_id=message_id).first()
        if existing:
            return jsonify({'message': 'Already starred'}), 200
        starred = StarredMessage(user_id=user_id, message_id=message_id)
        db.session.add(starred)
        db.session.commit()
        return jsonify({'message': 'Starred'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/star', methods=['DELETE'])
@jwt_required()
def unstar_message(message_id):
    try:
        user_id = get_jwt_identity()
        starred = StarredMessage.query.filter_by(user_id=user_id, message_id=message_id).first()
        if starred:
            db.session.delete(starred)
            db.session.commit()
        return jsonify({'message': 'Unstarred'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/starred', methods=['GET'])
@jwt_required()
def get_starred():
    try:
        user_id = get_jwt_identity()
        starred = StarredMessage.query.filter_by(user_id=user_id).order_by(StarredMessage.created_at.desc()).all()
        result = [s.message.to_dict() for s in starred if s.message]
        return jsonify({'messages': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/search', methods=['GET'])
@jwt_required()
def search_messages():
    try:
        user_id = get_jwt_identity()
        q = request.args.get('q', '').strip()
        chat_with = request.args.get('chat_with')
        if not q or len(q) < 2:
            return jsonify({'messages': []}), 200
        query = Message.query.filter(
            db.or_(Message.sender_id == user_id, Message.receiver_id == user_id),
            Message.content.ilike(f'%{q}%'),
            Message.is_deleted_everyone == False,
        )
        if chat_with:
            query = query.filter(
                db.or_(
                    db.and_(Message.sender_id == user_id, Message.receiver_id == chat_with),
                    db.and_(Message.sender_id == chat_with, Message.receiver_id == user_id),
                )
            )
        messages = query.order_by(Message.created_at.desc()).limit(30).all()
        return jsonify({'messages': [m.to_dict() for m in messages]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/<message_id>/forward', methods=['POST'])
@jwt_required()
def forward_message(message_id):
    try:
        sender_id = get_jwt_identity()
        data = request.json or {}
        recipient_ids = data.get('recipient_ids', [])
        if not recipient_ids:
            return jsonify({'error': 'Recipients required'}), 400
        original = Message.query.get(message_id)
        if not original:
            return jsonify({'error': 'Not found'}), 404
        forwarded = []
        for rid in recipient_ids:
            new_msg = Message(
                sender_id=sender_id,
                receiver_id=rid,
                content=original.content,
                media_url=original.media_url,
                media_type=original.media_type,
                forwarded_from_id=message_id,
            )
            db.session.add(new_msg)
            forwarded.append(new_msg)
        original.forward_count = (original.forward_count or 0) + len(recipient_ids)
        db.session.commit()
        return jsonify({'message': 'Forwarded', 'count': len(forwarded)}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@messages_bp.route('/link-preview', methods=['GET'])
@jwt_required()
def link_preview():
    """Fetch OpenGraph / meta data for a URL to show link previews in chat."""
    url = request.args.get('url', '').strip()
    if not url or not url.startswith(('http://', 'https://')):
        return jsonify({'error': 'Invalid URL'}), 400
    try:
        from html.parser import HTMLParser
        from urllib.parse import urlparse

        class OGParser(HTMLParser):
            def __init__(self):
                super().__init__()
                self.og = {}
                self._in_title = False
                self._buf = []
            def handle_starttag(self, tag, attrs):
                a = dict(attrs)
                if tag == 'meta':
                    prop = a.get('property', '') or a.get('name', '')
                    content = a.get('content', '')
                    if prop in ('og:title', 'twitter:title') and 'title' not in self.og:
                        self.og['title'] = content
                    elif prop in ('og:description', 'twitter:description', 'description') and 'description' not in self.og:
                        self.og['description'] = content
                    elif prop in ('og:image', 'twitter:image:src', 'twitter:image') and 'image' not in self.og:
                        self.og['image'] = content
                    elif prop == 'og:site_name':
                        self.og['site_name'] = content
                elif tag == 'title':
                    self._in_title = True
            def handle_data(self, data):
                if self._in_title:
                    self._buf.append(data)
            def handle_endtag(self, tag):
                if tag == 'title':
                    self._in_title = False
                    if self._buf and 'title' not in self.og:
                        self.og['title'] = ''.join(self._buf).strip()
                    self._buf = []

        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; BiteseBot/1.0; +https://bitese.app)',
            'Accept': 'text/html,application/xhtml+xml',
        }
        resp = http_requests.get(url, timeout=6, headers=headers, allow_redirects=True)
        parser = OGParser()
        parser.feed(resp.text[:80000])
        og = parser.og

        parsed = urlparse(url)
        domain = parsed.netloc.replace('www.', '')

        return jsonify({
            'url': url,
            'title': og.get('title', domain),
            'description': og.get('description', ''),
            'image': og.get('image', ''),
            'domain': domain,
            'site_name': og.get('site_name', domain),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 422


@messages_bp.route('/unread-count', methods=['GET'])
@jwt_required()
def unread_count():
    try:
        user_id = get_jwt_identity()
        count = Message.query.filter(
            Message.receiver_id == user_id,
            Message.status != MessageStatus.READ,
            Message.is_deleted_everyone == False,
        ).count()
        return jsonify({'unread': count}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
