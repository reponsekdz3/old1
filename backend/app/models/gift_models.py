from app.models.models import db
from datetime import datetime
import uuid


class GiftItem(db.Model):
    __tablename__ = 'gift_items'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = db.Column(db.String(100), nullable=False)
    emoji = db.Column(db.String(20), nullable=False)
    animation_type = db.Column(db.String(50), default='float')
    coin_cost = db.Column(db.Integer, nullable=False)
    usd_value = db.Column(db.Float, nullable=False)
    platform_fee_pct = db.Column(db.Float, default=0.30)
    category = db.Column(db.String(50), default='basic')
    is_active = db.Column(db.Boolean, default=True)
    sort_order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id, 'name': self.name, 'emoji': self.emoji,
            'animation_type': self.animation_type, 'coin_cost': self.coin_cost,
            'usd_value': self.usd_value, 'platform_fee_pct': self.platform_fee_pct,
            'category': self.category, 'is_active': self.is_active, 'sort_order': self.sort_order,
        }


class EscrowWallet(db.Model):
    __tablename__ = 'escrow_wallets'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), unique=True, nullable=False)
    coin_balance = db.Column(db.Integer, default=0)
    usd_earned = db.Column(db.Float, default=0.0)
    total_spent_usd = db.Column(db.Float, default=0.0)
    total_gifted_coins = db.Column(db.Integer, default=0)
    total_received_usd = db.Column(db.Float, default=0.0)
    is_locked = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref=db.backref('escrow_wallet', uselist=False))

    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id,
            'coin_balance': self.coin_balance, 'usd_earned': round(self.usd_earned, 2),
            'total_spent_usd': round(self.total_spent_usd, 2),
            'total_gifted_coins': self.total_gifted_coins,
            'total_received_usd': round(self.total_received_usd, 2),
            'is_locked': self.is_locked,
        }


class WalletDeposit(db.Model):
    __tablename__ = 'wallet_deposits'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    provider = db.Column(db.String(30), nullable=False)
    provider_ref = db.Column(db.String(255), nullable=True)
    amount_usd = db.Column(db.Float, nullable=False)
    coins_credited = db.Column(db.Integer, nullable=False)
    status = db.Column(db.String(20), default='pending')
    webhook_verified = db.Column(db.Boolean, default=False)
    metadata_json = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    user = db.relationship('User', backref='wallet_deposits')

    def to_dict(self):
        return {
            'id': self.id, 'provider': self.provider, 'provider_ref': self.provider_ref,
            'amount_usd': round(self.amount_usd, 2), 'coins_credited': self.coins_credited,
            'status': self.status, 'created_at': self.created_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
        }


class GiftTransaction(db.Model):
    __tablename__ = 'gift_transactions'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    recipient_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    gift_item_id = db.Column(db.String(36), db.ForeignKey('gift_items.id'), nullable=False)
    quantity = db.Column(db.Integer, default=1)
    coins_deducted = db.Column(db.Integer, nullable=False)
    usd_credited = db.Column(db.Float, nullable=False)
    platform_fee_usd = db.Column(db.Float, nullable=False)
    context = db.Column(db.String(30), default='live')
    context_id = db.Column(db.String(36), nullable=True)
    message = db.Column(db.String(200), nullable=True)
    is_anonymous = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    sender = db.relationship('User', foreign_keys=[sender_id], backref='gifts_sent')
    recipient = db.relationship('User', foreign_keys=[recipient_id], backref='gifts_received')
    gift_item = db.relationship('GiftItem', backref='transactions')

    __table_args__ = (
        db.Index('ix_gift_txn_recipient', 'recipient_id'),
        db.Index('ix_gift_txn_sender', 'sender_id'),
        db.Index('ix_gift_txn_context', 'context', 'context_id'),
        db.Index('ix_gift_txn_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name if not self.is_anonymous else 'Anonymous',
            'sender_avatar': self.sender.avatar_url if not self.is_anonymous else None,
            'recipient_id': self.recipient_id,
            'recipient_name': self.recipient.full_name,
            'gift': self.gift_item.to_dict(),
            'quantity': self.quantity,
            'coins_deducted': self.coins_deducted,
            'usd_credited': round(self.usd_credited, 4),
            'platform_fee_usd': round(self.platform_fee_usd, 4),
            'context': self.context,
            'context_id': self.context_id,
            'message': self.message,
            'is_anonymous': self.is_anonymous,
            'created_at': self.created_at.isoformat(),
        }


class WithdrawalRequest(db.Model):
    __tablename__ = 'withdrawal_requests'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    amount_usd = db.Column(db.Float, nullable=False)
    method = db.Column(db.String(30), nullable=False)
    payout_details = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(20), default='pending')
    admin_note = db.Column(db.Text, nullable=True)
    provider_ref = db.Column(db.String(255), nullable=True)
    requested_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, nullable=True)
    processed_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    user = db.relationship('User', foreign_keys=[user_id], backref='withdrawal_requests')
    processor = db.relationship('User', foreign_keys=[processed_by])

    def to_dict(self):
        return {
            'id': self.id, 'user_id': self.user_id, 'user_name': self.user.full_name,
            'amount_usd': round(self.amount_usd, 2), 'method': self.method,
            'status': self.status, 'admin_note': self.admin_note,
            'provider_ref': self.provider_ref,
            'requested_at': self.requested_at.isoformat(),
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
        }


class PinnedChat(db.Model):
    __tablename__ = 'pinned_chats'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    chat_with_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    pin_order = db.Column(db.Integer, default=0)
    pinned_at = db.Column(db.DateTime, default=datetime.utcnow)
    user = db.relationship('User', foreign_keys=[user_id], backref='pinned_chats')
    chat_with = db.relationship('User', foreign_keys=[chat_with_id])
    group = db.relationship('Group')

    def to_dict(self):
        return {
            'id': self.id, 'chat_with_id': self.chat_with_id, 'group_id': self.group_id,
            'pin_order': self.pin_order, 'pinned_at': self.pinned_at.isoformat(),
        }


class SharedNote(db.Model):
    __tablename__ = 'shared_notes'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, default='')
    owner_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    chat_with_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    group_id = db.Column(db.String(36), db.ForeignKey('groups.id'), nullable=True)
    is_public = db.Column(db.Boolean, default=False)
    version = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_edited_by = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    owner = db.relationship('User', foreign_keys=[owner_id], backref='owned_notes')
    editor = db.relationship('User', foreign_keys=[last_edited_by])
    group = db.relationship('Group')
    revisions = db.relationship('NoteRevision', backref='note', cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id, 'title': self.title, 'content': self.content,
            'owner_id': self.owner_id, 'owner_name': self.owner.full_name,
            'chat_with_id': self.chat_with_id, 'group_id': self.group_id,
            'is_public': self.is_public, 'version': self.version,
            'created_at': self.created_at.isoformat(), 'updated_at': self.updated_at.isoformat(),
            'last_edited_by': self.last_edited_by,
            'last_editor_name': self.editor.full_name if self.editor else None,
        }


class NoteRevision(db.Model):
    __tablename__ = 'note_revisions'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    note_id = db.Column(db.String(36), db.ForeignKey('shared_notes.id'), nullable=False)
    editor_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    content_snapshot = db.Column(db.Text, nullable=False)
    version = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    editor = db.relationship('User')

    def to_dict(self):
        return {
            'id': self.id, 'editor_id': self.editor_id,
            'editor_name': self.editor.full_name, 'version': self.version,
            'created_at': self.created_at.isoformat(),
        }


class DocumentVault(db.Model):
    __tablename__ = 'document_vault'
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    doc_type = db.Column(db.String(50), nullable=False)
    label = db.Column(db.String(100), nullable=False)
    encrypted_data = db.Column(db.Text, nullable=False)
    file_url = db.Column(db.String(500), nullable=True)
    thumbnail_url = db.Column(db.String(500), nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_archived = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    user = db.relationship('User', backref='vault_documents')

    def to_dict(self):
        return {
            'id': self.id, 'doc_type': self.doc_type, 'label': self.label,
            'file_url': self.file_url, 'thumbnail_url': self.thumbnail_url,
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_archived': self.is_archived,
            'created_at': self.created_at.isoformat(), 'updated_at': self.updated_at.isoformat(),
        }
