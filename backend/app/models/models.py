from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from enum import Enum

db = SQLAlchemy()

class MessageStatus(Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"

class Message(db.Model):
    __tablename__ = 'messages'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(500), nullable=True)
    media_type = db.Column(db.String(50), nullable=True)  # image, video, audio, document, voice, location, contact
    media_size = db.Column(db.Integer, nullable=True)
    media_duration = db.Column(db.Integer, nullable=True)  # for audio/video in seconds
    thumbnail_url = db.Column(db.String(500), nullable=True)
    status = db.Column(db.Enum(MessageStatus), default=MessageStatus.SENT)
    is_edited = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime, nullable=True)
    replied_to_id = db.Column(db.String(36), db.ForeignKey('messages.id'), nullable=True)
    forwarded_from_id = db.Column(db.String(36), db.ForeignKey('messages.id'), nullable=True)
    forward_count = db.Column(db.Integer, default=0)
    is_deleted_sender = db.Column(db.Boolean, default=False)
    is_deleted_receiver = db.Column(db.Boolean, default=False)
    is_deleted_everyone = db.Column(db.Boolean, default=False)
    disappear_at = db.Column(db.DateTime, nullable=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_name = db.Column(db.String(255), nullable=True)
    is_live_location = db.Column(db.Boolean, default=False)
    live_location_duration = db.Column(db.Integer, nullable=True)
    link_preview_title = db.Column(db.String(255), nullable=True)
    link_preview_description = db.Column(db.Text, nullable=True)
    link_preview_image = db.Column(db.String(500), nullable=True)
    link_preview_url = db.Column(db.String(500), nullable=True)
    contact_name = db.Column(db.String(255), nullable=True)
    contact_phone = db.Column(db.String(50), nullable=True)
    # ── Signal Protocol E2EE fields ──────────────────────────────────────
    encrypted_payload = db.Column(db.Text, nullable=True)   # base64 AES-256-GCM ciphertext
    e2ee_header = db.Column(db.Text, nullable=True)          # JSON: ratchet + optional X3DH header
    e2ee_type = db.Column(db.Integer, default=0, nullable=True)  # 0=ratchet, 1=prekey
    # ─────────────────────────────────────────────────────────────────────
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_messages_sender_id', 'sender_id'),
        db.Index('ix_messages_receiver_id', 'receiver_id'),
        db.Index('ix_messages_created_at', 'created_at'),
        db.Index('ix_messages_conversation', 'sender_id', 'receiver_id', 'created_at'),
    )

    sender = db.relationship('User', foreign_keys=[sender_id], backref='sent_messages')
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref='received_messages')
    replied_to = db.relationship('Message', remote_side=[id], foreign_keys=[replied_to_id], backref='replies')
    forwarded_from = db.relationship('Message', remote_side=[id], foreign_keys=[forwarded_from_id])
    reactions = db.relationship('MessageReaction', backref='message', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name,
            'sender_avatar': self.sender.avatar_url,
            'receiver_id': self.receiver_id,
            'content': self.content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'media_size': self.media_size,
            'media_duration': self.media_duration,
            'thumbnail_url': self.thumbnail_url,
            'status': self.status.value,
            'is_edited': self.is_edited,
            'edited_at': self.edited_at.isoformat() if self.edited_at else None,
            'replied_to_id': self.replied_to_id,
            'replied_to': self.replied_to.to_dict() if self.replied_to else None,
            'forwarded_from_id': self.forwarded_from_id,
            'forward_count': self.forward_count,
            'is_deleted_everyone': self.is_deleted_everyone,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'location_name': self.location_name,
            'is_live_location': self.is_live_location,
            'link_preview': {
                'title': self.link_preview_title,
                'description': self.link_preview_description,
                'image': self.link_preview_image,
                'url': self.link_preview_url
            } if self.link_preview_url else None,
            'contact': {
                'name': self.contact_name,
                'phone': self.contact_phone
            } if self.contact_phone else None,
            'created_at': self.created_at.isoformat(),
            'reactions': [r.to_dict() for r in self.reactions],
            'encrypted_payload': self.encrypted_payload,
            'e2ee_header': self.e2ee_header,
            'e2ee_type': self.e2ee_type,
        }

class MessageReaction(db.Model):
    __tablename__ = 'message_reactions'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    message_id = db.Column(db.String(36), db.ForeignKey('messages.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    reaction_emoji = db.Column(db.String(10), nullable=False)  # 👍 😂 ❤️ etc
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='reactions')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name,
            'emoji': self.reaction_emoji,
            'created_at': self.created_at.isoformat()
        }

class Status(db.Model):
    __tablename__ = 'statuses'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=True)
    media_url = db.Column(db.String(512), nullable=True)
    media_type = db.Column(db.String(20), nullable=True, default='text')  # text | image | video
    background_color = db.Column(db.String(20), nullable=True, default='#008069')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)
    
    user = db.relationship('User', backref='statuses')
    viewers = db.relationship('User', secondary='status_viewers', backref='viewed_statuses')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name,
            'user_avatar': self.user.avatar_url,
            'content': self.content or '',
            'media_url': self.media_url,
            'media_type': self.media_type or 'text',
            'background_color': self.background_color or '#008069',
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat(),
            'viewers_count': len(self.viewers)
        }

# Association table for status viewers
status_viewers = db.Table('status_viewers',
    db.Column('status_id', db.String(36), db.ForeignKey('statuses.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True)
)

class Contact(db.Model):
    __tablename__ = 'contacts'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    contact_name = db.Column(db.String(255), nullable=True)
    contact_user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    is_blocked = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', foreign_keys=[user_id], backref='my_contacts')
    contact_user = db.relationship('User', foreign_keys=[contact_user_id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'phone_number': self.phone_number,
            'contact_name': self.contact_name,
            'contact_user_id': self.contact_user_id,
            'is_blocked': self.is_blocked,
            'contact_info': self.contact_user.to_dict() if self.contact_user else None,
            'created_at': self.created_at.isoformat()
        }

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = db.Column(db.String(20), unique=True, nullable=False)
    full_name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=True)
    age = db.Column(db.Integer, nullable=True)
    country = db.Column(db.String(100), nullable=True)
    city = db.Column(db.String(100), nullable=True)
    password_hash = db.Column(db.Text, nullable=False)
    avatar_url = db.Column(db.Text, nullable=True)
    bio = db.Column(db.String(500), nullable=True)
    status = db.Column(db.String(50), default='available')  # available, away, offline
    is_verified = db.Column(db.Boolean, default=False)  # phone/account verification
    verification_code = db.Column(db.String(6), nullable=True)
    verification_attempts = db.Column(db.Integer, default=0)
    qr_code_url = db.Column(db.Text, nullable=True)
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    is_admin = db.Column(db.Boolean, default=False)
    is_banned = db.Column(db.Boolean, default=False)
    account_confirmed_at = db.Column(db.DateTime, nullable=True)
    # ── Payment-based verified badge (blue checkmark) ─────────────────────────
    badge_verified = db.Column(db.Boolean, default=False)
    verification_tier = db.Column(db.String(20), nullable=True)  # 'personal' | 'business'
    verified_at = db.Column(db.DateTime, nullable=True)
    verification_payment_id = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'phone_number': self.phone_number,
            'full_name': self.full_name,
            'email': self.email,
            'age': self.age,
            'country': self.country,
            'city': self.city,
            'avatar_url': self.avatar_url,
            'bio': self.bio,
            'status': self.status,
            'is_verified': self.is_verified,
            'qr_code_url': self.qr_code_url,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'is_admin': self.is_admin,
            'is_banned': self.is_banned,
            'account_confirmed_at': self.account_confirmed_at.isoformat() if self.account_confirmed_at else None,
            'badge_verified': self.badge_verified,
            'verification_tier': self.verification_tier,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'created_at': self.created_at.isoformat()
        }

class VerificationCode(db.Model):
    __tablename__ = 'verification_codes'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    phone_number = db.Column(db.String(20), nullable=False)
    code = db.Column(db.String(6), nullable=False)
    attempts = db.Column(db.Integer, default=0)
    expires_at = db.Column(db.DateTime, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def is_expired(self):
        return datetime.utcnow() > self.expires_at

# Group Chat Models
group_members = db.Table('group_members',
    db.Column('group_id', db.String(36), db.ForeignKey('groups.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True),
    db.Column('joined_at', db.DateTime, default=datetime.utcnow)
)

group_admins = db.Table('group_admins',
    db.Column('group_id', db.String(36), db.ForeignKey('groups.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True)
)

class Group(db.Model):
    __tablename__ = 'groups'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    avatar_url = db.Column(db.String(255), nullable=True)
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    creator = db.relationship('User', foreign_keys=[creator_id])
    members = db.relationship('User', secondary=group_members, backref='groups')
    admins = db.relationship('User', secondary=group_admins, backref='admin_groups')
    messages = db.relationship('GroupMessage', backref='group', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'avatar_url': self.avatar_url,
            'creator_id': self.creator_id,
            'members_count': len(self.members),
            'created_at': self.created_at.isoformat()
        }

class GroupMessage(db.Model):
    __tablename__ = 'group_messages'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=False)
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    media_url = db.Column(db.String(255), nullable=True)
    media_type = db.Column(db.String(50), nullable=True)
    replied_to_id = db.Column(db.String(36), db.ForeignKey('group_messages.id'), nullable=True)
    is_edited = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    sender = db.relationship('User', foreign_keys=[sender_id])
    replied_to = db.relationship('GroupMessage', remote_side=[id])
    
    def to_dict(self):
        return {
            'id': self.id,
            'group_id': self.group_id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name,
            'content': self.content,
            'media_url': self.media_url,
            'media_type': self.media_type,
            'replied_to_id': self.replied_to_id,
            'is_edited': self.is_edited,
            'created_at': self.created_at.isoformat()
        }

class StarredMessage(db.Model):
    __tablename__ = 'starred_messages'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    message_id = db.Column(db.String(36), db.ForeignKey('messages.id'), nullable=True)
    group_message_id = db.Column(db.String(36), db.ForeignKey('group_messages.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='starred_messages')
    message = db.relationship('Message')
    group_message = db.relationship('GroupMessage')

class ArchivedChat(db.Model):
    __tablename__ = 'archived_chats'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    chat_with_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    archived_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', foreign_keys=[user_id])
    chat_with = db.relationship('User', foreign_keys=[chat_with_id])
    group = db.relationship('Group')

class Call(db.Model):
    __tablename__ = 'calls'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    caller_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    receiver_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    call_type = db.Column(db.String(20), nullable=False)  # voice, video
    call_mode = db.Column(db.String(20), default='peer')  # peer, group
    status = db.Column(db.String(20), default='initiated')  # initiated, ringing, answered, ended, missed
    duration = db.Column(db.Integer, default=0)  # in seconds
    room_id = db.Column(db.String(255), nullable=True)  # For SFU room tracking
    recording = db.Column(db.Boolean, default=False)
    recording_url = db.Column(db.String(500), nullable=True)
    max_participants = db.Column(db.Integer, default=50)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    ended_at = db.Column(db.DateTime, nullable=True)
    
    caller = db.relationship('User', foreign_keys=[caller_id])
    receiver = db.relationship('User', foreign_keys=[receiver_id])
    group = db.relationship('Group', foreign_keys=[group_id])
    participants = db.relationship('CallParticipant', backref='call', cascade='all, delete-orphan', lazy='joined')
    
    __table_args__ = (
        db.Index('ix_calls_caller_id', 'caller_id'),
        db.Index('ix_calls_group_id', 'group_id'),
        db.Index('ix_calls_status', 'status'),
        db.Index('ix_calls_created_at', 'started_at'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'caller_id': self.caller_id,
            'caller_name': self.caller.full_name if self.caller else None,
            'caller_avatar': self.caller.avatar_url if self.caller else None,
            'receiver_id': self.receiver_id,
            'receiver_name': self.receiver.full_name if self.receiver else None,
            'receiver_avatar': self.receiver.avatar_url if self.receiver else None,
            'group_id': self.group_id,
            'group_name': self.group.name if self.group else None,
            'call_type': self.call_type,
            'call_mode': self.call_mode,
            'status': self.status,
            'duration': self.duration,
            'room_id': self.room_id,
            'recording': self.recording,
            'recording_url': self.recording_url,
            'max_participants': self.max_participants,
            'participants_count': len(self.participants),
            'started_at': self.started_at.isoformat(),
            'created_at': self.started_at.isoformat(),
            'ended_at': self.ended_at.isoformat() if self.ended_at else None
        }


class CallParticipant(db.Model):
    __tablename__ = 'call_participants'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    call_id = db.Column(db.String(36), db.ForeignKey('calls.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    role = db.Column(db.String(20), default='participant')  # host, participant, viewer
    status = db.Column(db.String(20), default='invited')  # invited, joined, left, declined
    audio_enabled = db.Column(db.Boolean, default=True)
    video_enabled = db.Column(db.Boolean, default=True)
    screen_share = db.Column(db.Boolean, default=False)
    video_quality = db.Column(db.String(20), default='medium')  # low, medium, high
    bandwidth_limit = db.Column(db.Integer, default=2500)  # kbps
    socket_id = db.Column(db.String(255), nullable=True)
    joined_at = db.Column(db.DateTime, nullable=True)
    left_at = db.Column(db.DateTime, nullable=True)
    duration = db.Column(db.Integer, default=0)  # seconds spent in call
    is_muted = db.Column(db.Boolean, default=False)
    is_video_muted = db.Column(db.Boolean, default=False)
    invited_at = db.Column(db.DateTime, default=datetime.utcnow)
    responded_at = db.Column(db.DateTime, nullable=True)
    
    user = db.relationship('User', backref='call_participations')
    
    __table_args__ = (
        db.Index('ix_call_participants_call_id', 'call_id'),
        db.Index('ix_call_participants_user_id', 'user_id'),
        db.Index('ix_call_participants_role', 'role'),
        db.Index('ix_call_participants_status', 'status'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'call_id': self.call_id,
            'user_id': self.user_id,
            'user_name': self.user.full_name,
            'user_avatar': self.user.avatar_url,
            'role': self.role,
            'status': self.status,
            'audio_enabled': self.audio_enabled,
            'video_enabled': self.video_enabled,
            'screen_share': self.screen_share,
            'video_quality': self.video_quality,
            'bandwidth_limit': self.bandwidth_limit,
            'is_muted': self.is_muted,
            'is_video_muted': self.is_video_muted,
            'joined_at': self.joined_at.isoformat() if self.joined_at else None,
            'left_at': self.left_at.isoformat() if self.left_at else None,
            'duration': self.duration,
            'invited_at': self.invited_at.isoformat(),
            'responded_at': self.responded_at.isoformat() if self.responded_at else None
        }

class Poll(db.Model):
    __tablename__ = 'polls'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    question = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    
    creator = db.relationship('User')
    group = db.relationship('Group')
    options = db.relationship('PollOption', backref='poll', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'creator_id': self.creator_id,
            'group_id': self.group_id,
            'question': self.question,
            'options': [o.to_dict() for o in self.options],
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }

class PollOption(db.Model):
    __tablename__ = 'poll_options'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    poll_id = db.Column(db.String(36), db.ForeignKey('polls.id'), nullable=False)
    option_text = db.Column(db.String(255), nullable=False)
    votes_count = db.Column(db.Integer, default=0)
    
    votes = db.relationship('PollVote', backref='option', cascade='all, delete-orphan')
    
    def to_dict(self):
        return {
            'id': self.id,
            'option_text': self.option_text,
            'votes_count': self.votes_count
        }

class PollVote(db.Model):
    __tablename__ = 'poll_votes'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    poll_option_id = db.Column(db.String(36), db.ForeignKey('poll_options.id'), nullable=False)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User')

class BroadcastList(db.Model):
    __tablename__ = 'broadcast_lists'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    creator_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    creator = db.relationship('User')
    recipients = db.relationship('User', secondary='broadcast_recipients', backref='broadcast_lists')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'recipients_count': len(self.recipients),
            'created_at': self.created_at.isoformat()
        }

broadcast_recipients = db.Table('broadcast_recipients',
    db.Column('broadcast_id', db.String(36), db.ForeignKey('broadcast_lists.id'), primary_key=True),
    db.Column('user_id', db.String(36), db.ForeignKey('users.id'), primary_key=True)
)

class UserSettings(db.Model):
    __tablename__ = 'user_settings'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, unique=True)
    read_receipts = db.Column(db.Boolean, default=True)
    last_seen_privacy = db.Column(db.String(20), default='everyone')  # everyone, contacts, nobody
    profile_photo_privacy = db.Column(db.String(20), default='everyone')
    about_privacy = db.Column(db.String(20), default='everyone')
    status_privacy = db.Column(db.String(20), default='contacts')  # everyone, contacts, selected, nobody
    disappearing_messages_duration = db.Column(db.Integer, default=0)  # 0=off, seconds
    auto_download_photos = db.Column(db.Boolean, default=True)
    auto_download_videos = db.Column(db.Boolean, default=False)
    auto_download_documents = db.Column(db.Boolean, default=False)
    chat_wallpaper = db.Column(db.String(500), nullable=True)
    notification_sound = db.Column(db.String(100), default='default')
    show_notifications = db.Column(db.Boolean, default=True)
    show_preview = db.Column(db.Boolean, default=True)
    
    user = db.relationship('User', backref='settings', uselist=False)

class MutedChat(db.Model):
    __tablename__ = 'muted_chats'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    chat_with_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    muted_until = db.Column(db.DateTime, nullable=True)  # None = forever
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', foreign_keys=[user_id])
    chat_with = db.relationship('User', foreign_keys=[chat_with_id])
    group = db.relationship('Group')

class ChatBackup(db.Model):
    __tablename__ = 'chat_backups'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    backup_url = db.Column(db.String(500), nullable=False)
    backup_size = db.Column(db.Integer, nullable=False)
    message_count = db.Column(db.Integer, default=0)
    media_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref='backups')

class MediaGallery(db.Model):
    __tablename__ = 'media_gallery'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    chat_with_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    message_id = db.Column(db.String(36), db.ForeignKey('messages.id'), nullable=False)
    media_type = db.Column(db.String(50), nullable=False)
    media_url = db.Column(db.String(500), nullable=False)
    thumbnail_url = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', foreign_keys=[user_id])
    chat_with = db.relationship('User', foreign_keys=[chat_with_id])
    message = db.relationship('Message')

class LiveLocation(db.Model):
    __tablename__ = 'live_locations'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    message_id = db.Column(db.String(36), db.ForeignKey('messages.id'), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    expires_at = db.Column(db.DateTime, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    user = db.relationship('User')
    message = db.relationship('Message')


class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    provider = db.Column(db.String(20), nullable=False)
    amount = db.Column(db.Float, nullable=False)
    currency = db.Column(db.String(10), default='USD')
    status = db.Column(db.String(20), default='pending')
    provider_payment_id = db.Column(db.String(255), nullable=True)
    tier = db.Column(db.String(20), nullable=False)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='payments')

    def to_dict(self):
        return {
            'id': self.id,
            'provider': self.provider,
            'amount': self.amount,
            'currency': self.currency,
            'status': self.status,
            'tier': self.tier,
            'created_at': self.created_at.isoformat(),
        }


class PushSubscription(db.Model):
    __tablename__ = 'push_subscriptions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    endpoint = db.Column(db.Text, nullable=False)
    p256dh = db.Column(db.Text, nullable=False)
    auth = db.Column(db.Text, nullable=False)
    active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User')


# ── Business API Platform models ──────────────────────────────────────────────

class ApiClient(db.Model):
    __tablename__ = 'api_clients'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    business_name = db.Column(db.String(255), nullable=False)
    api_key_hash = db.Column(db.String(255), nullable=False)
    api_key_prefix = db.Column(db.String(20), nullable=False)
    tier = db.Column(db.String(20), default='starter')
    is_active = db.Column(db.Boolean, default=True)
    webhook_url = db.Column(db.String(500), nullable=True)
    webhook_secret = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref=db.backref('api_client', uselist=False))
    subscriptions = db.relationship('ApiSubscription', backref='client', lazy=True, cascade='all, delete-orphan')
    usage_logs = db.relationship('ApiUsageLog', backref='client', lazy=True, cascade='all, delete-orphan')

    def to_dict(self, admin=False):
        d = {
            'id': self.id,
            'business_name': self.business_name,
            'api_key_prefix': self.api_key_prefix,
            'tier': self.tier,
            'is_active': self.is_active,
            'webhook_url': self.webhook_url,
            'created_at': self.created_at.isoformat(),
        }
        if admin:
            d['user_id'] = self.user_id
            d['user_name'] = self.user.full_name if self.user else None
        return d


class ApiSubscription(db.Model):
    __tablename__ = 'api_subscriptions'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(db.String(36), db.ForeignKey('api_clients.id'), nullable=False)
    stripe_subscription_id = db.Column(db.String(255), nullable=True)
    tier = db.Column(db.String(20), nullable=False)
    status = db.Column(db.String(20), default='active')
    current_period_end = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'tier': self.tier,
            'status': self.status,
            'current_period_end': self.current_period_end.isoformat() if self.current_period_end else None,
            'created_at': self.created_at.isoformat(),
        }


class ApiUsageLog(db.Model):
    __tablename__ = 'api_usage_logs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    client_id = db.Column(db.String(36), db.ForeignKey('api_clients.id'), nullable=False)
    endpoint = db.Column(db.String(255), nullable=False)
    method = db.Column(db.String(10), nullable=False)
    status_code = db.Column(db.Integer, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    message_count = db.Column(db.Integer, default=0)
    response_time_ms = db.Column(db.Integer, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'endpoint': self.endpoint,
            'method': self.method,
            'status_code': self.status_code,
            'timestamp': self.timestamp.isoformat(),
            'message_count': self.message_count,
            'response_time_ms': self.response_time_ms,
        }
