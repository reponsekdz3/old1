"""
Signal Protocol key bundle models, JWT blocklist, security audit log,
and subscription plan models.
"""
from datetime import datetime
import json
import uuid

from flask import request as _flask_request

from app.models.models import db


# ── Audit helper ─────────────────────────────────────────────────────────────

def log_security_event(user_id, event_type, severity='info', details=None):
    """Insert an immutable audit-log row (fire-and-forget; does not raise)."""
    try:
        ip = None
        ua = None
        try:
            ip = _flask_request.remote_addr
            ua = (_flask_request.headers.get('User-Agent') or '')[:500]
        except RuntimeError:
            pass

        entry = SecurityAuditLog(
            user_id=user_id,
            event_type=event_type,
            severity=severity,
            ip_address=ip,
            user_agent=ua,
            details=json.dumps(details) if details else None,
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        try:
            db.session.rollback()
        except Exception:
            pass


# ── Signal Protocol E2EE ──────────────────────────────────────────────────────

class E2EEKeyBundle(db.Model):
    """Stores a user's public Signal Protocol key bundle (identity + signed prekey)."""
    __tablename__ = 'e2ee_key_bundles'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, unique=True)

    # Ed25519 Identity Key — long-term public key (base64url)
    identity_key_pub = db.Column(db.Text, nullable=False)

    # X25519 Signed PreKey — medium-term
    signed_prekey_id = db.Column(db.Integer, nullable=False)
    signed_prekey_pub = db.Column(db.Text, nullable=False)
    signed_prekey_sig = db.Column(db.Text, nullable=False)   # Ed25519 sig over SPK_pub

    # 14-bit random registration ID (session deduplication)
    registration_id = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='e2ee_bundle', uselist=False)

    __table_args__ = (
        db.Index('ix_e2ee_bundle_user', 'user_id'),
    )

    def _build_base_dict(self):
        return {
            'user_id': self.user_id,
            'identity_key': self.identity_key_pub,
            'signed_prekey': {
                'id': self.signed_prekey_id,
                'public_key': self.signed_prekey_pub,
                'signature': self.signed_prekey_sig,
            },
            'registration_id': self.registration_id,
        }

    def to_dict(self, include_opk=True):
        return self.to_public_bundle(pop_opk=include_opk)

    def to_public_bundle(self, pop_opk=True):
        """Return the public key bundle dict.  If pop_opk=True, atomically
        consume one unused one-time prekey and include it."""
        bundle = self._build_base_dict()
        if pop_opk:
            opk = (
                E2EEOneTimePreKey.query
                .filter_by(user_id=self.user_id, is_used=False)
                .order_by(E2EEOneTimePreKey.created_at.asc())
                .first()
            )
            if opk:
                bundle['one_time_prekey'] = {
                    'id': opk.key_id,
                    'public_key': opk.public_key,
                }
                opk.is_used = True
                opk.used_at = datetime.utcnow()
                try:
                    db.session.commit()
                except Exception:
                    db.session.rollback()
            else:
                bundle['one_time_prekey'] = None
        return bundle


class E2EEOneTimePreKey(db.Model):
    """One-time PreKeys for X3DH — consumed exactly once per session establishment."""
    __tablename__ = 'e2ee_one_time_prekeys'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    key_id = db.Column(db.Integer, nullable=False)
    public_key = db.Column(db.Text, nullable=False)
    is_used = db.Column(db.Boolean, default=False)
    used_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='e2ee_one_time_prekeys')

    __table_args__ = (
        db.UniqueConstraint('user_id', 'key_id', name='uq_e2ee_user_key_id'),
        db.Index('ix_e2ee_otpk_user_unused', 'user_id', 'is_used'),
    )


# ── JWT Token Revocation ──────────────────────────────────────────────────────

class JWTBlocklist(db.Model):
    """Revoked JWT tokens — checked on every authenticated request."""
    __tablename__ = 'jwt_blocklist'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    jti = db.Column(db.String(64), nullable=False, unique=True)
    token_type = db.Column(db.String(16), nullable=False, default='access')
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    revoked_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=False)

    __table_args__ = (
        db.Index('ix_jwt_blocklist_jti', 'jti'),
        db.Index('ix_jwt_blocklist_expires', 'expires_at'),
    )


# ── Security Audit Log ────────────────────────────────────────────────────────

class SecurityAuditLog(db.Model):
    """Immutable audit trail for every sensitive action in the platform."""
    __tablename__ = 'security_audit_logs'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=True)
    event_type = db.Column(db.String(64), nullable=False)
    severity = db.Column(db.String(16), default='info')   # info | warning | critical
    ip_address = db.Column(db.String(45), nullable=True)
    user_agent = db.Column(db.String(500), nullable=True)
    details = db.Column(db.Text, nullable=True)            # JSON payload
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship('User', backref='audit_logs')

    __table_args__ = (
        db.Index('ix_audit_user_event', 'user_id', 'event_type'),
        db.Index('ix_audit_severity', 'severity'),
        db.Index('ix_audit_created', 'created_at'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'user_name': self.user.full_name if self.user else None,
            'event_type': self.event_type,
            'severity': self.severity,
            'ip_address': self.ip_address,
            'details': self.details,
            'created_at': self.created_at.isoformat(),
        }


# ── Subscription Plans ────────────────────────────────────────────────────────

class SubscriptionPlan(db.Model):
    """User subscription plan (Free / Plus / Business)."""
    __tablename__ = 'subscription_plans'

    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False, unique=True)
    plan = db.Column(db.String(20), nullable=False, default='free')   # free | plus | business
    status = db.Column(db.String(20), nullable=False, default='active')  # active | cancelled | expired
    stripe_subscription_id = db.Column(db.String(255), nullable=True)
    current_period_start = db.Column(db.DateTime, nullable=True)
    current_period_end = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = db.relationship('User', backref='subscription', uselist=False)

    PLAN_LIMITS = {
        'free':     {'storage_mb': 100,   'group_size': 256,   'broadcast_lists': 0,    'api_calls_daily': 0,      'price_usd': 0},
        'plus':     {'storage_mb': 5000,  'group_size': 1024,  'broadcast_lists': 10,   'api_calls_daily': 0,      'price_usd': 4.99},
        'business': {'storage_mb': 50000, 'group_size': 100000,'broadcast_lists': 1000, 'api_calls_daily': 100000, 'price_usd': 19.99},
    }

    def to_dict(self):
        return {
            'plan': self.plan,
            'status': self.status,
            'current_period_end': self.current_period_end.isoformat() if self.current_period_end else None,
            'limits': self.PLAN_LIMITS.get(self.plan, self.PLAN_LIMITS['free']),
        }
