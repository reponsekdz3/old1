from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from app.models.community_models import Channel, ChannelPost, ChannelPostReaction
from datetime import datetime
import secrets
import string

channels_bp = Blueprint('channels', __name__, url_prefix='/api/channels')

def generate_invite_link():
    code = ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(12))
    return f"https://vipchat.app/join/{code}"

@channels_bp.route('', methods=['POST'])
@jwt_required()
def create_channel():
    """Create a new channel"""
    try:
        creator_id = get_jwt_identity()
        data = request.json
        
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        
        if not name:
            return jsonify({'error': 'Channel name required'}), 400
        
        channel = Channel(
            name=name,
            description=description,
            creator_id=creator_id,
            invite_link=generate_invite_link()
        )
        
        creator = User.query.get(creator_id)
        channel.subscribers.append(creator)
        channel.admins.append(creator)
        
        db.session.add(channel)
        db.session.commit()
        
        return jsonify({
            'message': 'Channel created successfully',
            'channel': channel.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@channels_bp.route('', methods=['GET'])
@jwt_required()
def get_user_channels():
    """Get all channels user subscribed to"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        channels = [c.to_dict() for c in user.subscribed_channels]
        return jsonify({'channels': channels}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>', methods=['GET'])
@jwt_required()
def get_channel(channel_id):
    """Get channel details"""
    try:
        channel = Channel.query.get(channel_id)
        
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
        
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        data = channel.to_dict()
        data['is_subscribed'] = user in channel.subscribers
        data['is_admin'] = user in channel.admins
        
        return jsonify(data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>/subscribe', methods=['POST'])
@jwt_required()
def subscribe_channel(channel_id):
    """Subscribe to a channel"""
    try:
        user_id = get_jwt_identity()
        
        channel = Channel.query.get(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
        
        user = User.query.get(user_id)
        if user in channel.subscribers:
            return jsonify({'error': 'Already subscribed'}), 409
        
        channel.subscribers.append(user)
        channel.subscriber_count = len(channel.subscribers)
        db.session.commit()
        
        return jsonify({
            'message': 'Subscribed successfully',
            'channel': channel.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>/unsubscribe', methods=['POST'])
@jwt_required()
def unsubscribe_channel(channel_id):
    """Unsubscribe from a channel"""
    try:
        user_id = get_jwt_identity()
        
        channel = Channel.query.get(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
        
        user = User.query.get(user_id)
        if user not in channel.subscribers:
            return jsonify({'error': 'Not subscribed'}), 404
        
        channel.subscribers.remove(user)
        channel.subscriber_count = len(channel.subscribers)
        db.session.commit()
        
        return jsonify({'message': 'Unsubscribed successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>/posts', methods=['POST'])
@jwt_required()
def create_post(channel_id):
    """Create a channel post (admins only)"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        channel = Channel.query.get(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
        
        user = User.query.get(user_id)
        if user not in channel.admins:
            return jsonify({'error': 'Only admins can post'}), 403
        
        content = data.get('content', '').strip()
        if not content:
            return jsonify({'error': 'Content required'}), 400
        
        post = ChannelPost(
            channel_id=channel_id,
            author_id=user_id,
            content=content,
            media_url=data.get('media_url'),
            media_type=data.get('media_type')
        )
        
        db.session.add(post)
        db.session.commit()
        
        return jsonify({
            'message': 'Post created',
            'post': post.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>/posts', methods=['GET'])
@jwt_required()
def get_channel_posts(channel_id):
    """Get channel posts"""
    try:
        user_id = get_jwt_identity()
        
        channel = Channel.query.get(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
        
        user = User.query.get(user_id)
        if user not in channel.subscribers:
            return jsonify({'error': 'Not subscribed'}), 403
        
        posts = ChannelPost.query.filter_by(channel_id=channel_id)\
            .order_by(ChannelPost.created_at.desc()).limit(50).all()
        
        return jsonify({
            'posts': [p.to_dict() for p in posts]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/posts/<post_id>/react', methods=['POST'])
@jwt_required()
def react_to_post(post_id):
    """React to a channel post"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        emoji = data.get('emoji')
        
        if not emoji:
            return jsonify({'error': 'Emoji required'}), 400
        
        post = ChannelPost.query.get(post_id)
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        existing = ChannelPostReaction.query.filter_by(
            post_id=post_id,
            user_id=user_id
        ).first()
        
        if existing:
            existing.emoji = emoji
        else:
            reaction = ChannelPostReaction(
                post_id=post_id,
                user_id=user_id,
                emoji=emoji
            )
            db.session.add(reaction)
        
        post.reactions_count = len(post.reactions)
        db.session.commit()
        
        return jsonify({'message': 'Reaction added'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/posts/<post_id>/view', methods=['POST'])
@jwt_required()
def view_post(post_id):
    """Increment post view count"""
    try:
        post = ChannelPost.query.get(post_id)
        if not post:
            return jsonify({'error': 'Post not found'}), 404
        
        post.views_count += 1
        db.session.commit()
        
        return jsonify({'message': 'View recorded'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/discover', methods=['GET'])
@jwt_required()
def discover_channels():
    """Discover popular channels"""
    try:
        channels = Channel.query.order_by(
            Channel.subscriber_count.desc()
        ).limit(50).all()
        
        return jsonify({
            'channels': [c.to_dict() for c in channels]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@channels_bp.route('/<channel_id>/admins', methods=['POST'])
@jwt_required()
def add_channel_admin(channel_id):
    """Add channel admin"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        new_admin_id = data.get('admin_id')
        
        channel = Channel.query.get(channel_id)
        if not channel:
            return jsonify({'error': 'Channel not found'}), 404
        
        if channel.creator_id != user_id:
            return jsonify({'error': 'Only creator can add admins'}), 403
        
        new_admin = User.query.get(new_admin_id)
        if new_admin not in channel.subscribers:
            return jsonify({'error': 'User must be subscribed first'}), 400
        
        if new_admin not in channel.admins:
            channel.admins.append(new_admin)
            db.session.commit()
        
        return jsonify({'message': 'Admin added successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
