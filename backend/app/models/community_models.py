from datetime import datetime
import uuid
from app.models.models import db

class Community(db.Model):
    __tablename__ = 'communities'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    icon_url = db.Column(db.String(500), nullable=True)
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    invite_code = db.Column(db.String(20), unique=True, nullable=False)
    is_public = db.Column(db.Boolean, default=False)
    member_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    creator = db.relationship('User', foreign_keys=[creator_id])
    members = db.relationship('User', secondary='community_members', backref='communities')
    admins = db.relationship('User', secondary='community_admins', backref='admin_communities')
    groups = db.relationship('CommunityGroup', backref='community', cascade='all, delete-orphan')
    announcements = db.relationship('CommunityAnnouncement', backref='community', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'creator_id': self.creator_id,
            'invite_code': self.invite_code,
            'is_public': self.is_public,
            'member_count': len(self.members),
            'groups_count': len(self.groups),
            'created_at': self.created_at.isoformat()
        }

community_members = db.Table('community_members',
    db.Column('community_id', db.String(36), db.ForeignKey('communities.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow)
)

community_admins = db.Table('community_admins',
    db.Column('community_id', db.String(36), db.ForeignKey('communities.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True)
)

class CommunityGroup(db.Model):
    __tablename__ = 'community_groups'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    community_id = db.Column(db.String(36), db.ForeignKey('communities.id'), nullable=False)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    group = db.relationship('Group')

class CommunityAnnouncement(db.Model):
    __tablename__ = 'community_announcements'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    community_id = db.Column(db.String(36), db.ForeignKey('communities.id'), nullable=False)
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    media_url = db.Column(db.String(500), nullable=True)
    media_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sender = db.relationship('User')
    
    def to_dict(self):
        return {
            'id': self.id,
            'community_id': self.community_id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name,
            'sender_avatar': self.sender.avatar_url,
            'content': self.content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'created_at': self.created_at.isoformat()
        }

class Channel(db.Model):
    __tablename__ = 'channels'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    icon_url = db.Column(db.String(500), nullable=True)
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    invite_link = db.Column(db.String(100), unique=True, nullable=False)
    is_verified = db.Column(db.Boolean, default=False)
    subscriber_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    creator = db.relationship('User', foreign_keys=[creator_id])
    subscribers = db.relationship('User', secondary='channel_subscribers', backref='subscribed_channels')
    admins = db.relationship('User', secondary='channel_admins', backref='admin_channels')
    posts = db.relationship('ChannelPost', backref='channel', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'creator_id': self.creator_id,
            'invite_link': self.invite_link,
            'is_verified': self.is_verified,
            'subscriber_count': len(self.subscribers),
            'created_at': self.created_at.isoformat()
        }

channel_subscribers = db.Table('channel_subscribers',
    db.Column('channel_id', db.String(36), db.ForeignKey('channels.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('subscribed_at', db.DateTime, default=datetime.utcnow)
)

channel_admins = db.Table('channel_admins',
    db.Column('channel_id', db.String(36), db.ForeignKey('channels.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True)
)

class ChannelPost(db.Model):
    __tablename__ = 'channel_posts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel_id = db.Column(db.String(36), db.ForeignKey('channels.id'), nullable=False)
    author_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    media_url = db.Column(db.String(500), nullable=True)
    media_type = db.Column(db.String(50), nullable=True)
    views_count = db.Column(db.Integer, default=0)
    reactions_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    author = db.relationship('User')
    reactions = db.relationship('ChannelPostReaction', backref='post', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'channel_id': self.channel_id,
            'author_id': self.author_id,
            'author_name': self.author.full_name,
            'content': self.content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'views_count': self.views_count,
            'reactions_count': self.reactions_count,
            'created_at': self.created_at.isoformat()
        }

class ChannelPostReaction(db.Model):
    __tablename__ = 'channel_post_reactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    post_id = db.Column(db.String(36), db.ForeignKey('channel_posts.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    emoji = db.Column(db.String(10), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User')

class ContactRequest(db.Model):
    __tablename__ = 'contact_requests'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(20), default='pending')  # pending, accepted, rejected
    message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sender = db.relationship('User', foreign_keys=[sender_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name,
            'sender_avatar': self.sender.avatar_url,
            'receiver_id': self.receiver_id,
            'status': self.status,
            'message': self.message,
            'created_at': self.created_at.isoformat()
        }

class QRCode(db.Model):
    __tablename__ = 'qr_codes'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    qr_data = db.Column(db.Text, nullable=False)  # Encrypted user data
    qr_image_url = db.Column(db.String(500), nullable=False)
    scan_count = db.Column(db.Integer, default=0)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='qr_codes')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'qr_image_url': self.qr_image_url,
            'scan_count': self.scan_count,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }
