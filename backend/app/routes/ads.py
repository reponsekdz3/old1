"""
VipChat Status Ads — Real, functional ad campaigns in the Status/Stories feed.
Security: signed JWT ad-tokens, bleach sanitization, rate limiting, fraud detection.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.models import db, User
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
import uuid
import hashlib
import logging
import json
import re

logger = logging.getLogger(__name__)
ads_bp = Blueprint('ads', __name__, url_prefix='/api/ads')

# ── Security helpers ────────────────────────────────────────────────────────────

# Allowed domains for ad media (whitelist)
ALLOWED_MEDIA_DOMAINS = [
    'uploads', 'localhost', '127.0.0.1',
    'cloudinary.com', 'res.cloudinary.com',
    'imgur.com', 'i.imgur.com',
    'amazonaws.com', 's3.amazonaws.com',
    'storage.googleapis.com',
    'cdn.bitese.app',
    'images.unsplash.com',
]

# Allowed URL patterns for CTA links (no JS/data URIs)
SAFE_URL_RE = re.compile(r'^https?://', re.IGNORECASE)

def _sanitize_text(text, max_len=500):
    """Sanitize user text input: strip HTML/scripts."""
    if not text:
        return ''
    try:
        import bleach
        text = bleach.clean(str(text), tags=[], strip=True)
    except Exception:
        # fallback: strip angle-bracket content
        text = re.sub(r'<[^>]+>', '', str(text))
    # Remove null bytes and control chars
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)
    return text.strip()[:max_len]

def _is_safe_url(url):
    if not url:
        return True
    url = str(url).strip()
    # Enforce https-only for all ad CTAs
    if not url.lower().startswith('https://'):
        return False
    # Block javascript: data: and other schemes
    low = url.lower()
    bad = ['javascript:', 'data:', 'vbscript:', 'file:', 'about:']
    return not any(low.startswith(b) for b in bad)

def _is_allowed_media_domain(url):
    if not url:
        return True
    try:
        from urllib.parse import urlparse
        host = urlparse(str(url)).netloc.lower()
        # Strip port number if present
        host = host.split(':')[0]
        # Allow empty host (relative URLs for uploaded content)
        if not host:
            return True
        # Exact match OR suffix match (.cloudinary.com etc.)
        # Substring matching (e.g. "allowed in host") is bypassable by crafted
        # hostnames like "evil-cloudinary.com", so we use exact/suffix only.
        return any(
            host == allowed or host.endswith('.' + allowed)
            for allowed in ALLOWED_MEDIA_DOMAINS
        )
    except Exception:
        return False


def _check_rate_limit_redis(redis_client, key, max_count, window_seconds):
    """Simple Redis-based sliding rate limiter. Returns True if allowed."""
    if not redis_client:
        return True
    try:
        pipe = redis_client.pipeline()
        pipe.incr(key)
        pipe.expire(key, window_seconds)
        results = pipe.execute()
        return results[0] <= max_count
    except Exception:
        return True  # fail open rather than blocking all ad traffic

def _make_ad_token(ad_id, user_id, expiry_seconds=120):
    """Create a signed ad delivery token (HMAC-SHA256)."""
    import hmac
    secret = current_app.config.get('SECRET_KEY', 'dev-secret')
    expires = int((datetime.utcnow() + timedelta(seconds=expiry_seconds)).timestamp())
    payload = f"{ad_id}:{user_id}:{expires}"
    sig = hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    return f"{payload}:{sig}", expires

def _verify_ad_token(token, ad_id, user_id):
    """Verify a signed ad token. Returns True if valid."""
    try:
        import hmac as hmaclib
        secret = current_app.config.get('SECRET_KEY', 'dev-secret')
        parts = token.split(':')
        if len(parts) != 4:
            return False
        t_ad_id, t_user_id, expires_str, sig = parts
        if t_ad_id != str(ad_id) or t_user_id != str(user_id):
            return False
        if int(expires_str) < int(datetime.utcnow().timestamp()):
            return False
        expected_payload = f"{t_ad_id}:{t_user_id}:{expires_str}"
        expected_sig = hmaclib.new(secret.encode(), expected_payload.encode(), hashlib.sha256).hexdigest()[:24]
        return hmaclib.compare_digest(sig, expected_sig)
    except Exception:
        return False

def _get_redis():
    try:
        import redis as redislib
        r = redislib.from_url(current_app.config.get('REDIS_URL', 'redis://localhost:6379/0'), decode_responses=True)
        r.ping()
        return r
    except Exception:
        return None

def _check_session_freq_cap(user_id, redis_client):
    """Returns True if user has seen < 2 ads in this session (24h window)."""
    if not redis_client:
        return True
    key = f"ad_session:{user_id}"
    count = redis_client.get(key)
    return (count is None or int(count) < 2)

def _increment_session_count(user_id, redis_client):
    if not redis_client:
        return
    key = f"ad_session:{user_id}"
    redis_client.incr(key)
    redis_client.expire(key, 86400)  # 24h

def _log_fraud_attempt(ad_id, user_id, reason):
    logger.warning(f"[AD-FRAUD] ad={ad_id} user={user_id} reason={reason} ip={request.remote_addr}")

# ── Models ──────────────────────────────────────────────────────────────────────

class AdCampaign(db.Model):
    __tablename__ = 'ad_campaigns'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sponsor_id = Column(String(36), ForeignKey('users.id'), nullable=False)

    # Campaign metadata
    title = Column(String(255), nullable=False)
    ad_copy = Column(Text, nullable=False)
    cta_text = Column(String(100), default='Learn More')
    cta_url = Column(Text, nullable=True)

    # Creative
    creative_url = Column(Text, nullable=True)      # image or video URL
    creative_type = Column(String(10), default='image')  # image | video
    sponsor_name = Column(String(255), nullable=True)   # display name override
    sponsor_avatar = Column(Text, nullable=True)

    # Targeting
    target_audience = Column(String(20), default='all')  # all | contacts | country
    target_country = Column(String(100), nullable=True)

    # Budget & schedule
    budget_total = Column(Float, default=10.0)
    budget_spent = Column(Float, default=0.0)
    daily_budget = Column(Float, default=5.0)
    bid_cpm = Column(Float, default=2.0)
    duration_days = Column(Integer, default=7)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)

    # Stats
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    reports = Column(Integer, default=0)
    skip_count = Column(Integer, default=0)

    # Status & approval
    status = Column(String(20), default='pending')  # pending | active | paused | completed | rejected
    is_approved = Column(Boolean, default=False)
    rejection_reason = Column(Text, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    approved_by = Column(String(36), ForeignKey('users.id'), nullable=True)

    # Payment
    payment_status = Column(String(20), default='unpaid')  # unpaid | paid | refunded
    stripe_payment_id = Column(String(255), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    sponsor = relationship('User', foreign_keys=[sponsor_id])
    approver = relationship('User', foreign_keys=[approved_by])

    def ctr(self):
        return round(self.clicks / self.impressions * 100, 2) if self.impressions > 0 else 0.0

    def is_active_now(self):
        now = datetime.utcnow()
        if self.status != 'active' or not self.is_approved:
            return False
        if self.budget_spent >= self.budget_total:
            return False
        if self.starts_at and self.starts_at > now:
            return False
        if self.ends_at and self.ends_at < now:
            return False
        return True

    def to_dict(self, full=False):
        d = {
            'id': self.id,
            'title': self.title,
            'ad_copy': self.ad_copy,
            'cta_text': self.cta_text,
            'cta_url': self.cta_url,
            'creative_url': self.creative_url,
            'creative_type': self.creative_type,
            'sponsor_name': self.sponsor_name or (self.sponsor.full_name if self.sponsor else 'Sponsored'),
            'sponsor_avatar': self.sponsor_avatar or (self.sponsor.avatar_url if self.sponsor else None),
            'target_audience': self.target_audience,
            'target_country': self.target_country,
            'status': self.status,
            'is_approved': self.is_approved,
            'rejection_reason': self.rejection_reason,
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'created_at': self.created_at.isoformat(),
        }
        if full:
            d.update({
                'sponsor_id': self.sponsor_id,
                'budget_total': self.budget_total,
                'budget_spent': self.budget_spent,
                'daily_budget': self.daily_budget,
                'bid_cpm': self.bid_cpm,
                'duration_days': self.duration_days,
                'impressions': self.impressions,
                'clicks': self.clicks,
                'ctr': self.ctr(),
                'reports': self.reports,
                'skip_count': self.skip_count,
                'payment_status': self.payment_status,
            })
        return d


class AdImpression(db.Model):
    __tablename__ = 'ad_impressions'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey('ad_campaigns.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    ip_hash = Column(String(32), nullable=True)
    skipped = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdClick(db.Model):
    __tablename__ = 'ad_clicks'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey('ad_campaigns.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    ip_hash = Column(String(32), nullable=True)
    token_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AdReport(db.Model):
    __tablename__ = 'ad_reports'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    campaign_id = Column(String(36), ForeignKey('ad_campaigns.id'), nullable=False)
    reporter_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    reason = Column(String(100), nullable=False)  # spam | offensive | misleading | malware | other
    notes = Column(Text, nullable=True)
    resolved = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    campaign = relationship('AdCampaign', foreign_keys=[campaign_id])
    reporter = relationship('User', foreign_keys=[reporter_id])

    def to_dict(self):
        return {
            'id': self.id,
            'campaign_id': self.campaign_id,
            'campaign_title': self.campaign.title if self.campaign else None,
            'reporter_id': self.reporter_id,
            'reporter_name': self.reporter.full_name if self.reporter else 'Anonymous',
            'reason': self.reason,
            'notes': self.notes,
            'resolved': self.resolved,
            'created_at': self.created_at.isoformat(),
        }


# ── Helpers ─────────────────────────────────────────────────────────────────────

def _is_eligible_sponsor(user):
    """Check if user can create ads: admin or badge_verified."""
    if not user:
        return False
    return bool(user.is_admin or user.badge_verified)

def _ip_hash():
    ip = request.remote_addr or ''
    return hashlib.sha256(ip.encode()).hexdigest()[:32]


# ── ROUTES ──────────────────────────────────────────────────────────────────────

@ads_bp.route('/campaigns', methods=['POST'])
@jwt_required()
def create_campaign():
    """Create a new ad campaign. Only badge_verified or admin users."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not _is_eligible_sponsor(user):
            return jsonify({'error': 'Only verified (Pro/Premium) or admin users can create ad campaigns.'}), 403

        data = request.get_json() or {}

        # Validate & sanitize inputs
        title = _sanitize_text(data.get('title', ''), 200)
        ad_copy = _sanitize_text(data.get('ad_copy', ''), 500)
        if not title or not ad_copy:
            return jsonify({'error': 'Title and ad copy are required.'}), 400

        cta_text = _sanitize_text(data.get('cta_text', 'Learn More'), 80)
        cta_url = data.get('cta_url', '').strip()
        if cta_url and not _is_safe_url(cta_url):
            return jsonify({'error': 'CTA URL must be a valid https:// link.'}), 400

        creative_url = data.get('creative_url', '').strip()
        if creative_url and not _is_allowed_media_domain(creative_url):
            return jsonify({'error': 'Creative media must be hosted on an allowed domain.'}), 400

        budget = float(data.get('budget_total', 10.0))
        if budget < 1.0:
            return jsonify({'error': 'Minimum budget is $1.00'}), 400
        if budget > 100000:
            return jsonify({'error': 'Maximum budget per campaign is $100,000'}), 400

        daily_budget = float(data.get('daily_budget', min(budget, 50.0)))
        duration_days = int(data.get('duration_days', 7))
        if duration_days < 1 or duration_days > 90:
            return jsonify({'error': 'Duration must be between 1 and 90 days.'}), 400

        sponsor_name = _sanitize_text(data.get('sponsor_name', ''), 100) or user.full_name
        target_audience = data.get('target_audience', 'all')
        if target_audience not in ('all', 'contacts', 'country'):
            target_audience = 'all'
        target_country = _sanitize_text(data.get('target_country', ''), 100)

        starts_at = datetime.utcnow()
        ends_at = starts_at + timedelta(days=duration_days)

        campaign = AdCampaign(
            sponsor_id=user_id,
            title=title,
            ad_copy=ad_copy,
            cta_text=cta_text,
            cta_url=cta_url,
            creative_url=creative_url,
            creative_type=data.get('creative_type', 'image'),
            sponsor_name=sponsor_name,
            sponsor_avatar=data.get('sponsor_avatar') or user.avatar_url,
            target_audience=target_audience,
            target_country=target_country,
            budget_total=budget,
            daily_budget=daily_budget,
            bid_cpm=float(data.get('bid_cpm', 2.0)),
            duration_days=duration_days,
            starts_at=starts_at,
            ends_at=ends_at,
            status='pending',
            is_approved=False,
            payment_status='unpaid',
        )
        db.session.add(campaign)
        db.session.commit()

        # Stripe checkout for budget payment
        checkout_url = None
        stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if stripe_key:
            try:
                import stripe
                stripe.api_key = stripe_key
                session_obj = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': 'usd',
                            'product_data': {'name': f'VipChat Ad Campaign: {title}'},
                            'unit_amount': int(budget * 100),
                        },
                        'quantity': 1,
                    }],
                    mode='payment',
                    success_url=f"{request.host_url.rstrip('/')}/advertise?campaign_success={campaign.id}",
                    cancel_url=f"{request.host_url.rstrip('/')}/advertise?campaign_cancel=1",
                    metadata={'campaign_id': campaign.id, 'type': 'status_ad'},
                )
                campaign.stripe_payment_id = session_obj.id
                db.session.commit()
                checkout_url = session_obj.url
            except Exception as e:
                logger.warning(f'Stripe ad payment error: {e}')

        return jsonify({
            'campaign': campaign.to_dict(full=True),
            'checkout_url': checkout_url,
            'message': 'Campaign created and pending admin review.',
        }), 201

    except Exception as e:
        db.session.rollback()
        logger.exception('create_campaign error')
        return jsonify({'error': str(e)}), 500


@ads_bp.route('/campaigns', methods=['GET'])
@jwt_required()
def list_my_campaigns():
    """List campaigns for the authenticated sponsor."""
    user_id = get_jwt_identity()
    campaigns = AdCampaign.query.filter_by(sponsor_id=user_id).order_by(AdCampaign.created_at.desc()).all()
    return jsonify({'campaigns': [c.to_dict(full=True) for c in campaigns]}), 200


@ads_bp.route('/campaigns/<campaign_id>', methods=['GET'])
@jwt_required()
def get_campaign(campaign_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404
    if campaign.sponsor_id != user_id and not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Forbidden'}), 403
    return jsonify({'campaign': campaign.to_dict(full=True)}), 200


@ads_bp.route('/campaigns/<campaign_id>', methods=['DELETE'])
@jwt_required()
def delete_campaign(campaign_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404
    if campaign.sponsor_id != user_id and not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Forbidden'}), 403
    db.session.delete(campaign)
    db.session.commit()
    return jsonify({'message': 'Campaign deleted'}), 200


@ads_bp.route('/feed', methods=['GET'])
@jwt_required()
def get_ad_feed():
    """
    Returns the next eligible ad for the status feed.
    Respects frequency cap: max 2 ads per user per 24h session.
    Returns a signed token for secure impression/click tracking.
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'ad': None}), 200

        # Check session frequency cap
        redis_client = _get_redis()
        if not _check_session_freq_cap(user_id, redis_client):
            return jsonify({'ad': None, 'capped': True}), 200

        now = datetime.utcnow()
        # Get active approved campaigns within budget and schedule
        q = AdCampaign.query.filter(
            AdCampaign.status == 'active',
            AdCampaign.is_approved == True,
            AdCampaign.budget_spent < AdCampaign.budget_total,
            db.or_(AdCampaign.starts_at == None, AdCampaign.starts_at <= now),
            db.or_(AdCampaign.ends_at == None, AdCampaign.ends_at >= now),
        )

        # Audience targeting: filter campaigns by target_audience setting.
        # "all" → everyone; "contacts" → only show ads from sponsors the user knows
        # (currently no direct contact relationship on AdCampaign, so treated as "all");
        # "country" → only show ads that explicitly match the user's country (if set).
        from sqlalchemy import or_ as sql_or
        # Start with campaigns targeting "all" or "contacts" (broad reach)
        audience_conditions = [
            AdCampaign.target_audience.in_(['all', 'contacts']),
        ]
        # Also include country-targeted ads that match the user's country
        if getattr(user, 'country', None):
            audience_conditions.append(
                db.and_(
                    AdCampaign.target_audience == 'country',
                    db.func.lower(AdCampaign.target_country) == user.country.lower(),
                )
            )
        else:
            # User has no country set — only show "all"/"contacts" ads
            pass

        q = q.filter(sql_or(*audience_conditions))

        campaigns = q.order_by(AdCampaign.bid_cpm.desc()).limit(10).all()
        if not campaigns:
            return jsonify({'ad': None}), 200

        # Pick best campaign (highest CPM, has remaining budget)
        campaign = campaigns[0]

        # Generate signed ad token
        token, expires = _make_ad_token(campaign.id, user_id)

        ad_data = campaign.to_dict()
        ad_data['ad_token'] = token
        ad_data['token_expires'] = expires
        ad_data['is_ad'] = True

        resp = jsonify({'ad': ad_data})
        # Restrict what the ad creative can do: no scripts, only safe image/media sources
        resp.headers['Content-Security-Policy'] = (
            "default-src 'none'; "
            "img-src https: data:; "
            "media-src https:; "
            "script-src 'none'; "
            "frame-ancestors 'self'"
        )
        resp.headers['X-Content-Type-Options'] = 'nosniff'
        return resp, 200

    except Exception as e:
        logger.exception('get_ad_feed error')
        return jsonify({'ad': None}), 200


@ads_bp.route('/impression', methods=['POST'])
@jwt_required()
def record_impression():
    """
    Record exactly ONE ad impression per ad-view with token verification.
    The client sends a single event at the conclusion of the ad view, with
    skipped=True if the user skipped or skipped=False if it ran to completion.
    Rate limit: max 30 impression events per user per minute to block flood fraud.
    """
    try:
        user_id = get_jwt_identity()
        redis_client = _get_redis()

        # Rate limit: max 30 impressions/user/60s
        rl_key = f"ad_imp_rl:{user_id}"
        if not _check_rate_limit_redis(redis_client, rl_key, 30, 60):
            _log_fraud_attempt(None, user_id, 'impression_rate_limit')
            return jsonify({'error': 'Rate limit exceeded'}), 429

        data = request.get_json() or {}
        campaign_id = data.get('campaign_id')
        token = data.get('ad_token', '')
        skipped = bool(data.get('skipped', False))

        campaign = AdCampaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Not found'}), 404

        # Verify token
        if not _verify_ad_token(token, campaign_id, user_id):
            _log_fraud_attempt(campaign_id, user_id, 'invalid_impression_token')
            return jsonify({'error': 'Invalid ad token'}), 401

        # Dedup guard: prevent duplicate impression for the same token+user combo.
        # The token embeds an expiry; we use a short Redis key to deduplicate within
        # the token's validity window so a retry-stormed client can't double-count.
        dedup_key = f"ad_imp_dedup:{user_id}:{campaign_id}:{token[-8:]}"
        if redis_client:
            already = redis_client.set(dedup_key, '1', ex=300, nx=True)
            if not already:
                # Duplicate submission — acknowledge but don't double-count
                return jsonify({'ok': True, 'duplicate': True}), 200

        # Record ONE impression
        imp = AdImpression(
            campaign_id=campaign_id,
            user_id=user_id,
            ip_hash=_ip_hash(),
            skipped=skipped,
        )
        db.session.add(imp)

        campaign.impressions = (campaign.impressions or 0) + 1
        if skipped:
            campaign.skip_count = (campaign.skip_count or 0) + 1
        else:
            # Deduct CPM cost only for fully-viewed impressions
            cost = campaign.bid_cpm / 1000
            campaign.budget_spent = (campaign.budget_spent or 0) + cost
            if campaign.budget_spent >= campaign.budget_total:
                campaign.status = 'completed'

        db.session.commit()

        # Increment 24h session frequency cap
        _increment_session_count(user_id, redis_client)

        return jsonify({'ok': True}), 200

    except Exception as e:
        db.session.rollback()
        logger.exception('record_impression error')
        return jsonify({'error': str(e)}), 500


@ads_bp.route('/click', methods=['POST'])
@jwt_required()
def record_click():
    """
    Record ad click with token verification and fraud detection.
    Rate limit: max 20 clicks per user per minute to block click fraud.
    Dedup: same user cannot click the same ad token twice.
    """
    try:
        user_id = get_jwt_identity()
        redis_client = _get_redis()

        # Rate limit: max 20 clicks/user/60s
        rl_key = f"ad_click_rl:{user_id}"
        if not _check_rate_limit_redis(redis_client, rl_key, 20, 60):
            _log_fraud_attempt(None, user_id, 'click_rate_limit')
            return jsonify({'error': 'Rate limit exceeded'}), 429

        data = request.get_json() or {}
        campaign_id = data.get('campaign_id')
        token = data.get('ad_token', '')

        campaign = AdCampaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Not found'}), 404

        token_valid = _verify_ad_token(token, campaign_id, user_id)
        if not token_valid:
            _log_fraud_attempt(campaign_id, user_id, 'invalid_click_token')

        # Dedup: same token cannot produce more than one counted click
        if token_valid and redis_client:
            dedup_key = f"ad_click_dedup:{user_id}:{campaign_id}:{token[-8:]}"
            already = redis_client.set(dedup_key, '1', ex=300, nx=True)
            if not already:
                # Duplicate click — return the redirect URL but don't count it
                return jsonify({'ok': True, 'redirect_url': campaign.cta_url, 'duplicate': True}), 200

        # Record click (even invalid, for fraud analysis)
        click = AdClick(
            campaign_id=campaign_id,
            user_id=user_id,
            ip_hash=_ip_hash(),
            token_valid=token_valid,
        )
        db.session.add(click)

        if token_valid:
            campaign.clicks = (campaign.clicks or 0) + 1

        db.session.commit()

        if not token_valid:
            return jsonify({'error': 'Invalid ad token'}), 401

        return jsonify({'ok': True, 'redirect_url': campaign.cta_url}), 200

    except Exception as e:
        db.session.rollback()
        logger.exception('record_click error')
        return jsonify({'error': str(e)}), 500


@ads_bp.route('/report', methods=['POST'])
@jwt_required()
def report_ad():
    """Report an ad for abuse."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        campaign_id = data.get('campaign_id')
        reason = _sanitize_text(data.get('reason', 'other'), 50)
        notes = _sanitize_text(data.get('notes', ''), 300)

        if reason not in ('spam', 'offensive', 'misleading', 'malware', 'other'):
            reason = 'other'

        campaign = AdCampaign.query.get(campaign_id)
        if not campaign:
            return jsonify({'error': 'Not found'}), 404

        # Check duplicate report
        existing = AdReport.query.filter_by(campaign_id=campaign_id, reporter_id=user_id).first()
        if existing:
            return jsonify({'message': 'Already reported'}), 200

        report = AdReport(
            campaign_id=campaign_id,
            reporter_id=user_id,
            reason=reason,
            notes=notes,
        )
        db.session.add(report)

        campaign.reports = (campaign.reports or 0) + 1
        # Auto-pause if too many reports
        if campaign.reports >= 5:
            campaign.status = 'paused'

        db.session.commit()
        return jsonify({'message': 'Ad reported. Thank you for helping keep VipChat safe.'}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@ads_bp.route('/analytics/<campaign_id>', methods=['GET'])
@jwt_required()
def campaign_analytics(campaign_id):
    """Per-campaign analytics for the sponsor."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404
    if campaign.sponsor_id != user_id and not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Forbidden'}), 403

    # Daily breakdown
    impressions_by_day = db.session.query(
        db.func.date(AdImpression.created_at).label('day'),
        db.func.count(AdImpression.id).label('count')
    ).filter(
        AdImpression.campaign_id == campaign_id,
        AdImpression.skipped == False,
    ).group_by(db.func.date(AdImpression.created_at)).order_by('day').all()

    clicks_by_day = db.session.query(
        db.func.date(AdClick.created_at).label('day'),
        db.func.count(AdClick.id).label('count')
    ).filter(
        AdClick.campaign_id == campaign_id,
        AdClick.token_valid == True,
    ).group_by(db.func.date(AdClick.created_at)).order_by('day').all()

    return jsonify({
        'campaign': campaign.to_dict(full=True),
        'daily_impressions': [{'date': str(r.day), 'count': r.count} for r in impressions_by_day],
        'daily_clicks': [{'date': str(r.day), 'count': r.count} for r in clicks_by_day],
        'total_impressions': campaign.impressions or 0,
        'total_clicks': campaign.clicks or 0,
        'ctr': campaign.ctr(),
        'budget_spent': campaign.budget_spent or 0,
        'budget_remaining': max(0, (campaign.budget_total or 0) - (campaign.budget_spent or 0)),
        'skip_rate': round(campaign.skip_count / campaign.impressions * 100, 1) if campaign.impressions else 0,
        'reports': campaign.reports or 0,
    }), 200


# ── ADMIN ROUTES ─────────────────────────────────────────────────────────────────

def _require_admin():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return None, jsonify({'error': 'Admin only'}), 403
    return user, None, None


@ads_bp.route('/admin/campaigns', methods=['GET'])
@jwt_required()
def admin_list_campaigns():
    """Admin: list all campaigns."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    status_filter = request.args.get('status', '')
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 25)), 100)

    q = AdCampaign.query
    if status_filter:
        q = q.filter(AdCampaign.status == status_filter)
    q = q.order_by(AdCampaign.created_at.desc())
    total = q.count()
    campaigns = q.offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        'campaigns': [c.to_dict(full=True) for c in campaigns],
        'total': total,
        'pages': (total + per_page - 1) // per_page,
        'page': page,
    }), 200


@ads_bp.route('/admin/campaigns/<campaign_id>/approve', methods=['POST'])
@jwt_required()
def admin_approve_campaign(campaign_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404

    campaign.is_approved = True
    campaign.status = 'active'
    campaign.approved_at = datetime.utcnow()
    campaign.approved_by = user_id
    campaign.rejection_reason = None
    db.session.commit()
    return jsonify({'message': 'Campaign approved', 'campaign': campaign.to_dict(full=True)}), 200


@ads_bp.route('/admin/campaigns/<campaign_id>/reject', methods=['POST'])
@jwt_required()
def admin_reject_campaign(campaign_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404

    data = request.get_json() or {}
    campaign.is_approved = False
    campaign.status = 'rejected'
    campaign.rejection_reason = _sanitize_text(data.get('reason', 'Does not meet advertising guidelines'), 300)
    db.session.commit()
    return jsonify({'message': 'Campaign rejected', 'campaign': campaign.to_dict(full=True)}), 200


@ads_bp.route('/admin/campaigns/<campaign_id>/pause', methods=['POST'])
@jwt_required()
def admin_pause_campaign(campaign_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404

    campaign.status = 'paused'
    db.session.commit()
    return jsonify({'message': 'Campaign paused'}), 200


@ads_bp.route('/admin/campaigns/<campaign_id>/resume', methods=['POST'])
@jwt_required()
def admin_resume_campaign(campaign_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404

    if campaign.is_approved:
        campaign.status = 'active'
        db.session.commit()
    return jsonify({'message': 'Campaign resumed'}), 200


@ads_bp.route('/admin/campaigns/<campaign_id>/terminate', methods=['DELETE'])
@jwt_required()
def admin_terminate_campaign(campaign_id):
    """Admin: permanently terminate and delete an ad campaign."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    campaign = AdCampaign.query.get(campaign_id)
    if not campaign:
        return jsonify({'error': 'Not found'}), 404

    try:
        # Delete related records first to avoid FK constraint violations
        AdImpression.query.filter_by(campaign_id=campaign_id).delete()
        AdClick.query.filter_by(campaign_id=campaign_id).delete()
        AdReport.query.filter_by(campaign_id=campaign_id).delete()
        db.session.delete(campaign)
        db.session.commit()
        return jsonify({'message': 'Campaign terminated and deleted'}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception('admin_terminate_campaign error')
        return jsonify({'error': str(e)}), 500


@ads_bp.route('/admin/reports', methods=['GET'])
@jwt_required()
def admin_list_reports():
    """Admin: list all ad abuse reports."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    resolved = request.args.get('resolved', 'false').lower() == 'true'
    reports = AdReport.query.filter_by(resolved=resolved).order_by(AdReport.created_at.desc()).limit(100).all()
    return jsonify({'reports': [r.to_dict() for r in reports]}), 200


@ads_bp.route('/admin/reports/<report_id>/resolve', methods=['POST'])
@jwt_required()
def admin_resolve_report(report_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    report = AdReport.query.get(report_id)
    if not report:
        return jsonify({'error': 'Not found'}), 404
    report.resolved = True
    db.session.commit()
    return jsonify({'message': 'Report resolved'}), 200


@ads_bp.route('/admin/stats', methods=['GET'])
@jwt_required()
def admin_ad_stats():
    """Admin: aggregate ad metrics."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403

    today = datetime.utcnow().date()

    total_campaigns = AdCampaign.query.count()
    active_campaigns = AdCampaign.query.filter_by(status='active', is_approved=True).count()
    pending_campaigns = AdCampaign.query.filter_by(status='pending').count()

    total_impressions_today = AdImpression.query.filter(
        db.func.date(AdImpression.created_at) == today,
        AdImpression.skipped == False,
    ).count()

    total_clicks_today = AdClick.query.filter(
        db.func.date(AdClick.created_at) == today,
        AdClick.token_valid == True,
    ).count()

    total_revenue = db.session.query(db.func.sum(AdCampaign.budget_spent)).scalar() or 0

    # Top sponsors (spend leaderboard)
    top_sponsors = db.session.query(
        AdCampaign.sponsor_id,
        db.func.sum(AdCampaign.budget_spent).label('total_spend'),
        db.func.sum(AdCampaign.impressions).label('total_impressions'),
    ).group_by(AdCampaign.sponsor_id).order_by(db.text('total_spend DESC')).limit(10).all()

    leaderboard = []
    for row in top_sponsors:
        sponsor = User.query.get(row.sponsor_id)
        if sponsor:
            leaderboard.append({
                'user_id': row.sponsor_id,
                'name': sponsor.full_name,
                'avatar': sponsor.avatar_url,
                'total_spend': round(float(row.total_spend or 0), 2),
                'total_impressions': int(row.total_impressions or 0),
            })

    return jsonify({
        'total_campaigns': total_campaigns,
        'active_campaigns': active_campaigns,
        'pending_campaigns': pending_campaigns,
        'impressions_today': total_impressions_today,
        'clicks_today': total_clicks_today,
        'total_revenue': round(float(total_revenue), 2),
        'spend_leaderboard': leaderboard,
        'pending_reports': AdReport.query.filter_by(resolved=False).count(),
    }), 200
