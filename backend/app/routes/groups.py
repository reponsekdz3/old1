from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, Group, GroupMessage, User, Poll, PollOption, PollVote
from datetime import datetime, timedelta

groups_bp = Blueprint('groups', __name__, url_prefix='/api/groups')

@groups_bp.route('', methods=['POST'])
@jwt_required()
def create_group():
    """Create a new group"""
    try:
        creator_id = get_jwt_identity()
        data = request.json
        
        name = data.get('name', '').strip()
        description = data.get('description', '').strip()
        member_ids = data.get('member_ids', [])
        
        if not name:
            return jsonify({'error': 'Group name is required'}), 400
        
        group = Group(
            name=name,
            description=description,
            creator_id=creator_id
        )
        
        # Add creator as member and admin
        creator = User.query.get(creator_id)
        group.members.append(creator)
        group.admins.append(creator)
        
        # Add other members
        for member_id in member_ids:
            if member_id != creator_id:
                member = User.query.get(member_id)
                if member:
                    group.members.append(member)
        
        db.session.add(group)
        db.session.commit()
        
        return jsonify({
            'message': 'Group created successfully',
            'group': group.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@groups_bp.route('', methods=['GET'])
@jwt_required()
def get_user_groups():
    """Get all groups for current user"""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        
        groups = [g.to_dict() for g in user.groups]
        return jsonify({'groups': groups}), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<group_id>', methods=['GET'])
@jwt_required()
def get_group(group_id):
    """Get group details"""
    try:
        user_id = get_jwt_identity()
        group = Group.query.get(group_id)
        
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        # Check if user is member
        user = User.query.get(user_id)
        if user not in group.members:
            return jsonify({'error': 'Not a group member'}), 403
        
        return jsonify(group.to_dict()), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<group_id>/messages', methods=['POST'])
@jwt_required()
def send_group_message(group_id):
    """Send message to group"""
    try:
        sender_id = get_jwt_identity()
        data = request.json
        
        content = data.get('content', '').strip()
        media_url = data.get('media_url')
        media_type = data.get('media_type')
        
        if not content and not media_url:
            return jsonify({'error': 'Message content or media required'}), 400
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        # Check membership
        sender = User.query.get(sender_id)
        if sender not in group.members:
            return jsonify({'error': 'Not a group member'}), 403
        
        message = GroupMessage(
            group_id=group_id,
            sender_id=sender_id,
            content=content,
            media_url=media_url,
            media_type=media_type
        )
        
        db.session.add(message)
        db.session.commit()
        
        return jsonify(message.to_dict()), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<group_id>/messages', methods=['GET'])
@jwt_required()
def get_group_messages(group_id):
    """Get group messages"""
    try:
        user_id = get_jwt_identity()
        limit = request.args.get('limit', 50, type=int)
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        user = User.query.get(user_id)
        if user not in group.members:
            return jsonify({'error': 'Not a group member'}), 403
        
        messages = GroupMessage.query.filter_by(group_id=group_id)\
            .order_by(GroupMessage.created_at.desc()).limit(limit).all()
        
        return jsonify({
            'messages': [m.to_dict() for m in reversed(messages)]
        }), 200
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<group_id>/members', methods=['POST'])
@jwt_required()
def add_group_member(group_id):
    """Add member to group"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        member_id = data.get('member_id')
        
        if not member_id:
            return jsonify({'error': 'Member ID required'}), 400
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        # Check if requester is admin
        requester = User.query.get(user_id)
        if requester not in group.admins:
            return jsonify({'error': 'Only admins can add members'}), 403
        
        new_member = User.query.get(member_id)
        if not new_member:
            return jsonify({'error': 'User not found'}), 404
        
        if new_member in group.members:
            return jsonify({'error': 'User already in group'}), 409
        
        group.members.append(new_member)
        db.session.commit()
        
        return jsonify({'message': 'Member added successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<group_id>/members/<member_id>', methods=['DELETE'])
@jwt_required()
def remove_group_member(group_id, member_id):
    """Remove member from group"""
    try:
        user_id = get_jwt_identity()
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        requester = User.query.get(user_id)
        if requester not in group.admins and user_id != member_id:
            return jsonify({'error': 'Only admins can remove members'}), 403
        
        member = User.query.get(member_id)
        if member in group.members:
            group.members.remove(member)
            if member in group.admins:
                group.admins.remove(member)
            db.session.commit()
        
        return jsonify({'message': 'Member removed successfully'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/<group_id>/admins', methods=['POST'])
@jwt_required()
def make_admin(group_id):
    """Make a member admin"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        member_id = data.get('member_id')
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        requester = User.query.get(user_id)
        if requester not in group.admins:
            return jsonify({'error': 'Only admins can promote members'}), 403
        
        member = User.query.get(member_id)
        if member not in group.members:
            return jsonify({'error': 'User not in group'}), 404
        
        if member not in group.admins:
            group.admins.append(member)
            db.session.commit()
        
        return jsonify({'message': 'Member promoted to admin'}), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Poll routes
@groups_bp.route('/<group_id>/polls', methods=['POST'])
@jwt_required()
def create_poll(group_id):
    """Create a poll in group"""
    try:
        creator_id = get_jwt_identity()
        data = request.json
        
        question = data.get('question', '').strip()
        options = data.get('options', [])
        duration_hours = data.get('duration_hours', 24)
        
        if not question or len(options) < 2:
            return jsonify({'error': 'Question and at least 2 options required'}), 400
        
        group = Group.query.get(group_id)
        if not group:
            return jsonify({'error': 'Group not found'}), 404
        
        creator = User.query.get(creator_id)
        if creator not in group.members:
            return jsonify({'error': 'Not a group member'}), 403
        
        poll = Poll(
            creator_id=creator_id,
            group_id=group_id,
            question=question,
            expires_at=datetime.utcnow() + timedelta(hours=duration_hours)
        )
        
        db.session.add(poll)
        db.session.flush()
        
        for option_text in options:
            option = PollOption(poll_id=poll.id, option_text=option_text)
            db.session.add(option)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Poll created successfully',
            'poll': poll.to_dict()
        }), 201
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@groups_bp.route('/polls/<poll_id>/vote', methods=['POST'])
@jwt_required()
def vote_poll(poll_id):
    """Vote on a poll"""
    try:
        user_id = get_jwt_identity()
        data = request.json
        option_id = data.get('option_id')
        
        if not option_id:
            return jsonify({'error': 'Option ID required'}), 400
        
        poll = Poll.query.get(poll_id)
        if not poll:
            return jsonify({'error': 'Poll not found'}), 404
        
        if poll.expires_at and poll.expires_at < datetime.utcnow():
            return jsonify({'error': 'Poll has expired'}), 400
        
        option = PollOption.query.get(option_id)
        if not option or option.poll_id != poll_id:
            return jsonify({'error': 'Invalid option'}), 400
        
        # Check if already voted
        existing_vote = PollVote.query.join(PollOption).filter(
            PollOption.poll_id == poll_id,
            PollVote.user_id == user_id
        ).first()
        
        if existing_vote:
            return jsonify({'error': 'Already voted'}), 409
        
        vote = PollVote(poll_option_id=option_id, user_id=user_id)
        option.votes_count += 1
        
        db.session.add(vote)
        db.session.commit()
        
        return jsonify({
            'message': 'Vote recorded',
            'poll': poll.to_dict()
        }), 200
    
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
