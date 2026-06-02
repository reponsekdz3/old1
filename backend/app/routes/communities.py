from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Group
from app.models.community_models import Community, CommunityAnnouncement, CommunityGroup
from datetime import datetime
import secrets
import string

communities_bp = Blueprint('communities', __name__, url_prefix='/api/communities')

def generate_invite_code():
    return ''.join(secrets.choice(string.ascii_uppercase + string.digits) for _ in range(8))

@communities_bp.route('', methods=['POST'])
@jwt_required()
def create_community():
    """Create a new community"""
    try:
        creator_id = get_jwt_identity()
        data = request.json
        
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        is_public = data.get('is_public', False)
        
        if not name:
            return jsonify({'error': 'Community name required'}), 400
        
        community = Community(
            name=name,
            description=description,
            creator_id=creator_id,
            invite_code=generate_invite_code(),
            is_public=is_public
        )
        
        creator = User.query.get(creator_id)
        community.members.append(creator)
        community.admins.append(creator)
        
        db.session.add(community)
        db.session.commit()
        
        return jsonify({
            'message': 'Community created successfully',
            'community': community.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communities_bp.route('', methods=['GET'])
@jwt_required()
def get_user_communities():
    """Get all communities user is part of"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        communities = [c.to_dict() for c in user.communities]
        return jsonify({'communities': communities}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>', methods=['GET'])
@jwt_required()
def get_community(community_id):
    """Get community details"""
    try:
        user_id = get_jwt_identity()
        community = Community.query.get(community_id)
        
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        user = User.query.get(user_id)
        if user not in community.members:
            return jsonify({'error': 'Not a member'}), 403
        
        data = community.to_dict()
        data['groups'] = [cg.group.to_dict() for cg in community.groups]
        data['is_admin'] = user in community.admins
        
        return jsonify(data), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/join', methods=['POST'])
@jwt_required()
def join_community(community_id):
    """Join a community"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        invite_code = data.get('invite_code')
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        if not community.is_public and community.invite_code != invite_code:
            return jsonify({'error': 'Invalid invite code'}), 403
        
        user = User.query.get(user_id)
        if user in community.members:
            return jsonify({'error': 'Already a member'}), 409
        
        community.members.append(user)
        community.member_count = len(community.members)
        db.session.commit()
        
        return jsonify({
            'message': 'Joined community successfully',
            'community': community.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/leave', methods=['POST'])
@jwt_required()
def leave_community(community_id):
    """Leave a community"""
    try:
        user_id = get_jwt_identity()
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        user = User.query.get(user_id)
        if user not in community.members:
            return jsonify({'error': 'Not a member'}), 404
        
        if community.creator_id == user_id:
            return jsonify({'error': 'Creator cannot leave. Transfer ownership first'}), 400
        
        community.members.remove(user)
        if user in community.admins:
            community.admins.remove(user)
        
        community.member_count = len(community.members)
        db.session.commit()
        
        return jsonify({'message': 'Left community successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/announcements', methods=['POST'])
@jwt_required()
def create_announcement(community_id):
    """Create community announcement (admins only)"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        user = User.query.get(user_id)
        if user not in community.admins:
            return jsonify({'error': 'Only admins can post announcements'}), 403
        
        content = data.get('content', '').strip()
        if not content:
            return jsonify({'error': 'Content required'}), 400
        
        announcement = CommunityAnnouncement(
            community_id=community_id,
            sender_id=user_id,
            content=content,
            media_url=data.get('media_url'),
            media_type=data.get('media_type')
        )
        
        db.session.add(announcement)
        db.session.commit()
        
        return jsonify({
            'message': 'Announcement posted',
            'announcement': announcement.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/announcements', methods=['GET'])
@jwt_required()
def get_announcements(community_id):
    """Get community announcements"""
    try:
        user_id = get_jwt_identity()
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        user = User.query.get(user_id)
        if user not in community.members:
            return jsonify({'error': 'Not a member'}), 403
        
        announcements = CommunityAnnouncement.query.filter_by(
            community_id=community_id
        ).order_by(CommunityAnnouncement.created_at.desc()).limit(50).all()
        
        return jsonify({
            'announcements': [a.to_dict() for a in announcements]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/groups', methods=['POST'])
@jwt_required()
def add_group_to_community(community_id):
    """Add existing group to community"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        group_id = data.get('group_id')
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        user = User.query.get(user_id)
        if user not in community.admins:
            return jsonify({'error': 'Only admins can add groups'}), 403
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        existing = CommunityGroup.query.filter_by(
            community_id=community_id,
            group_id=group_id
        ).first()
        
        if existing:
            return jsonify({'error': 'Group already in community'}), 409
        
        community_group = CommunityGroup(
            community_id=community_id,
            group_id=group_id
        )
        
        db.session.add(community_group)
        db.session.commit()
        
        return jsonify({
            'message': 'Group added to community',
            'group': group.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/members', methods=['GET'])
@jwt_required()
def get_community_members(community_id):
    """Get all community members"""
    try:
        user_id = get_jwt_identity()
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        user = User.query.get(user_id)
        if user not in community.members:
            return jsonify({'error': 'Not a member'}), 403
        
        members = [{
            'id': m.id,
            'full_name': m.full_name,
            'phone_number': m.phone_number,
            'avatar_url': m.avatar_url,
            'is_admin': m in community.admins
        } for m in community.members]
        
        return jsonify({'members': members}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/<community_id>/admins', methods=['POST'])
@jwt_required()
def make_community_admin(community_id):
    """Make member a community admin"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        member_id = data.get('member_id')
        
        community = Community.query.get(community_id)
        if not community:
            return jsonify({'error': 'Community not found'}), 404
        
        if community.creator_id != user_id:
            return jsonify({'error': 'Only creator can make admins'}), 403
        
        member = User.query.get(member_id)
        if member not in community.members:
            return jsonify({'error': 'User not a member'}), 404
        
        if member not in community.admins:
            community.admins.append(member)
            db.session.commit()
        
        return jsonify({'message': 'Member promoted to admin'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@communities_bp.route('/discover', methods=['GET'])
@jwt_required()
def discover_communities():
    """Discover public communities"""
    try:
        communities = Community.query.filter_by(is_public=True)\
            .order_by(Community.member_count.desc()).limit(50).all()
        
        return jsonify({
            'communities': [c.to_dict() for c in communities]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500
