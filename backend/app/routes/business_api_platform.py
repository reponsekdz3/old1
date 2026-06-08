"""
VipChat Business API Platform
Real API-as-a-Product marketplace where developers/businesses can:
- Sell their APIs as products with sandbox + production keys
- Subscribe to other developer APIs
- Track usage with rate limiting
- Earn revenue from API consumption
- Get sandbox testing environment
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid
import secrets
import hashlib
import hmac
import json
import logging

logger = logging.getLogger(__name__)

biz_api_bp = Blueprint('business_api_platform', __name__, url_prefix='/api/biz-api')

# Subscription tiers with request limits
SUBSCRIPTION_TIERS = {
    'free': {
        'label': 'Free',
        'price_monthly': 0.0,
        'requests_per_month': 1000,
        'requests_per_minute': 10,
        'features': ['sandbox_access', 'basic_support'],
    },
    'starter': {
        'label': 'Starter',
        'price_monthly': 9.99,
        'requests_per_month': 50000,
        'requests_per_minute': 60,
        'features': ['sandbox_access', 'production_access', 'email_support', 'webhooks'],
    },
    'professional': {
        'label': 'Professional',
        'price_monthly': 49.99,
        'requests_per_month': 500000,
        'requests_per_minute': 300,
        'features': ['sandbox_access', 'production_access', 'priority_support', 'webhooks', 'analytics', 'custom_domain'],
    },
    'enterprise': {
        'label': 'Enterprise',
        'price_monthly': 199.99,
        'requests_per_month': -1,  # Unlimited
        'requests_per_minute': 1000,
        'features': ['unlimited_requests', 'dedicated_support', 'sla_99_9', 'custom_integration', 'ip_whitelisting'],
    },
}


# ─────────────────────── MODELS ───────────────────────────────────────────────

class APIProduct(db.Model):
    """An API product listed for sale on the platform."""
    __tablename__ = 'api_products'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey('users.id'), nullable=False)

    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    description = Column(Text, nullable=True)
    short_description = Column(String(500), nullable=True)
    category = Column(String(100), nullable=True)  # messaging, payments, analytics, ai, etc.
    tags = Column(Text, nullable=True)

    # Documentation
    base_url = Column(String(500), nullable=True)   # Production base URL
    sandbox_url = Column(String(500), nullable=True)  # Sandbox base URL
    docs_url = Column(String(500), nullable=True)
    openapi_spec = Column(Text, nullable=True)  # OpenAPI/Swagger JSON spec
    readme = Column(Text, nullable=True)        # Full markdown documentation

    # Pricing per tier (JSON: {"free": 0, "starter": 9.99, ...})
    pricing_json = Column(Text, nullable=True)

    # Revenue sharing: owner gets this percentage of subscription revenue
    revenue_share_pct = Column(Float, default=0.70)  # 70% to owner, 30% platform

    # Status
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)  # Admin approval
    is_featured = Column(Boolean, default=False)
    version = Column(String(20), default='1.0.0')

    # Stats
    subscriber_count = Column(Integer, default=0)
    total_requests = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    owner = relationship('User', foreign_keys=[owner_id], backref='api_products')
    subscriptions = relationship('APISubscription', backref='api_product', cascade='all, delete-orphan')
    endpoints = relationship('APIEndpoint', backref='api_product', cascade='all, delete-orphan')

    def to_dict(self, full=False):
        pricing = json.loads(self.pricing_json) if self.pricing_json else {}
        d = {
            'id': self.id,
            'owner_id': self.owner_id,
            'owner_name': self.owner.full_name if self.owner else None,
            'owner_verified': bool(self.owner.badge_verified) if self.owner else False,
            'name': self.name,
            'slug': self.slug,
            'description': self.description if full else (self.description or '')[:300],
            'short_description': self.short_description,
            'category': self.category,
            'tags': self.tags.split(',') if self.tags else [],
            'base_url': self.base_url,
            'sandbox_url': self.sandbox_url,
            'docs_url': self.docs_url,
            'pricing': pricing,
            'is_featured': self.is_featured,
            'version': self.version,
            'subscriber_count': self.subscriber_count,
            'total_requests': self.total_requests,
            'created_at': self.created_at.isoformat(),
        }
        if full:
            d['openapi_spec'] = json.loads(self.openapi_spec) if self.openapi_spec else None
            d['readme'] = self.readme
            d['endpoints'] = [e.to_dict() for e in self.endpoints]
        return d


class APIEndpoint(db.Model):
    """Individual endpoint documentation for an API product."""
    __tablename__ = 'api_endpoints'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    api_product_id = Column(String(36), ForeignKey('api_products.id'), nullable=False)
    method = Column(String(10), nullable=False)     # GET, POST, PUT, DELETE, PATCH
    path = Column(String(500), nullable=False)
    summary = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    request_body_example = Column(Text, nullable=True)  # JSON
    response_example = Column(Text, nullable=True)       # JSON
    required_tier = Column(String(50), default='free')
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'method': self.method,
            'path': self.path,
            'summary': self.summary,
            'description': self.description,
            'request_body_example': json.loads(self.request_body_example) if self.request_body_example else None,
            'response_example': json.loads(self.response_example) if self.response_example else None,
            'required_tier': self.required_tier,
        }


class APISubscription(db.Model):
    """A subscriber's access to an API product."""
    __tablename__ = 'api_subscriptions'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subscriber_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    api_product_id = Column(String(36), ForeignKey('api_products.id'), nullable=False)

    tier = Column(String(50), default='free')
    status = Column(String(20), default='active')  # active | suspended | cancelled
    payment_provider = Column(String(50), nullable=True)
    payment_ref = Column(String(255), nullable=True)
    price_paid = Column(Float, default=0.0)

    # API Keys
    production_key = Column(String(128), unique=True, nullable=True)
    sandbox_key = Column(String(128), unique=True, nullable=True)
    key_prefix = Column(String(20), nullable=True)  # First chars shown in UI

    # Usage tracking (current month)
    requests_this_month = Column(Integer, default=0)
    requests_this_minute = Column(Integer, default=0)
    last_minute_reset = Column(DateTime, default=datetime.utcnow)
    last_reset_month = Column(Integer, default=lambda: datetime.utcnow().month)

    # Webhook
    webhook_url = Column(Text, nullable=True)
    webhook_secret = Column(String(64), nullable=True)

    started_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)  # None = monthly recurring
    cancelled_at = Column(DateTime, nullable=True)

    subscriber = relationship('User', foreign_keys=[subscriber_id], backref='api_subscriptions')

    @staticmethod
    def _gen_key(prefix='vk'):
        raw = secrets.token_urlsafe(40)
        return f'{prefix}_{raw}'

    def generate_keys(self):
        self.production_key = self._gen_key('vk_live')
        self.sandbox_key = self._gen_key('vk_test')
        self.key_prefix = self.production_key[:12] + '...'

    def is_active(self):
        if self.status != 'active':
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def tier_config(self):
        return SUBSCRIPTION_TIERS.get(self.tier, SUBSCRIPTION_TIERS['free'])

    def check_rate_limit(self):
        """Returns (allowed: bool, reason: str)"""
        cfg = self.tier_config()

        # Per-minute reset
        if (datetime.utcnow() - (self.last_minute_reset or datetime.utcnow())).seconds >= 60:
            self.requests_this_minute = 0
            self.last_minute_reset = datetime.utcnow()

        # Monthly reset
        current_month = datetime.utcnow().month
        if self.last_reset_month != current_month:
            self.requests_this_month = 0
            self.last_reset_month = current_month

        if self.requests_this_minute >= cfg['requests_per_minute']:
            return False, f"Rate limit exceeded: {cfg['requests_per_minute']}/min"

        if cfg['requests_per_month'] != -1 and self.requests_this_month >= cfg['requests_per_month']:
            return False, f"Monthly quota exceeded: {cfg['requests_per_month']}/month"

        return True, 'ok'

    def to_dict(self, show_keys=False):
        cfg = self.tier_config()
        d = {
            'id': self.id,
            'api_product_id': self.api_product_id,
            'tier': self.tier,
            'tier_label': cfg['label'],
            'status': self.status,
            'price_paid': self.price_paid,
            'key_prefix': self.key_prefix,
            'requests_this_month': self.requests_this_month,
            'requests_this_minute': self.requests_this_minute,
            'monthly_limit': cfg['requests_per_month'],
            'per_minute_limit': cfg['requests_per_minute'],
            'features': cfg['features'],
            'webhook_url': self.webhook_url,
            'started_at': self.started_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
        }
        if show_keys:
            d['production_key'] = self.production_key
            d['sandbox_key'] = self.sandbox_key
        return d


class APIUsageLog(db.Model):
    """Per-request usage log for analytics."""
    __tablename__ = 'api_usage_logs'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    subscription_id = Column(String(36), ForeignKey('api_subscriptions.id'), nullable=False)
    api_product_id = Column(String(36), ForeignKey('api_products.id'), nullable=False)
    subscriber_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    endpoint = Column(String(500), nullable=True)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    is_sandbox = Column(Boolean, default=False)
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'subscription_id': self.subscription_id,
            'endpoint': self.endpoint,
            'method': self.method,
            'status_code': self.status_code,
            'response_time_ms': self.response_time_ms,
            'is_sandbox': self.is_sandbox,
            'created_at': self.created_at.isoformat(),
        }


class APIEarnings(db.Model):
    """API provider earnings ledger."""
    __tablename__ = 'api_earnings'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    owner_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    api_product_id = Column(String(36), ForeignKey('api_products.id'), nullable=False)
    subscription_id = Column(String(36), ForeignKey('api_subscriptions.id'), nullable=False)
    gross_amount = Column(Float, nullable=False)
    platform_fee = Column(Float, nullable=False)
    net_amount = Column(Float, nullable=False)
    status = Column(String(20), default='pending')  # pending | available | withdrawn
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship('User', foreign_keys=[owner_id])

    def to_dict(self):
        return {
            'id': self.id,
            'api_product_id': self.api_product_id,
            'gross_amount': self.gross_amount,
            'platform_fee': self.platform_fee,
            'net_amount': self.net_amount,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


# ─────────────────────── ROUTES ───────────────────────────────────────────────

@biz_api_bp.route('/products', methods=['GET'])
def list_api_products():
    """Browse available API products."""
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 50)
        category = request.args.get('category', '').strip()
        search = request.args.get('search', '').strip()

        q = APIProduct.query.filter(
            APIProduct.is_active == True,
            APIProduct.is_approved == True,
        )
        if category:
            q = q.filter(APIProduct.category == category)
        if search:
            q = q.filter(
                db.or_(
                    APIProduct.name.ilike(f'%{search}%'),
                    APIProduct.description.ilike(f'%{search}%'),
                    APIProduct.tags.ilike(f'%{search}%'),
                )
            )

        q = q.order_by(APIProduct.is_featured.desc(), APIProduct.subscriber_count.desc())
        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'products': [p.to_dict() for p in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
            'tiers': SUBSCRIPTION_TIERS,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/products/<product_id_or_slug>', methods=['GET'])
def get_api_product(product_id_or_slug):
    try:
        product = (
            APIProduct.query.get(product_id_or_slug)
            or APIProduct.query.filter_by(slug=product_id_or_slug).first()
        )
        if not product or not product.is_active:
            return jsonify({'error': 'API product not found'}), 404
        return jsonify(product.to_dict(full=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/products', methods=['POST'])
@jwt_required()
def create_api_product():
    """API provider creates a new API product listing."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        for f in ['name', 'slug', 'short_description']:
            if not data.get(f):
                return jsonify({'error': f'{f} is required'}), 400

        # Unique slug
        slug = data['slug'].lower().strip().replace(' ', '-')
        if APIProduct.query.filter_by(slug=slug).first():
            return jsonify({'error': f'Slug "{slug}" is taken'}), 409

        product = APIProduct(
            owner_id=user_id,
            name=data['name'].strip()[:255],
            slug=slug,
            description=data.get('description', ''),
            short_description=data['short_description'][:500],
            category=data.get('category', 'general'),
            tags=','.join(data['tags']) if isinstance(data.get('tags'), list) else data.get('tags', ''),
            base_url=data.get('base_url'),
            sandbox_url=data.get('sandbox_url'),
            docs_url=data.get('docs_url'),
            readme=data.get('readme'),
            openapi_spec=json.dumps(data['openapi_spec']) if data.get('openapi_spec') else None,
            pricing_json=json.dumps(data.get('pricing', {})),
            version=data.get('version', '1.0.0'),
        )
        db.session.add(product)
        db.session.flush()

        # Add endpoints
        for ep in data.get('endpoints', []):
            endpoint = APIEndpoint(
                api_product_id=product.id,
                method=ep.get('method', 'GET').upper(),
                path=ep.get('path', '/'),
                summary=ep.get('summary'),
                description=ep.get('description'),
                request_body_example=json.dumps(ep['request_body_example']) if ep.get('request_body_example') else None,
                response_example=json.dumps(ep['response_example']) if ep.get('response_example') else None,
                required_tier=ep.get('required_tier', 'free'),
            )
            db.session.add(endpoint)

        db.session.commit()
        return jsonify({'success': True, 'product': product.to_dict(full=True)}), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('create_api_product error')
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/products/<product_id>', methods=['PUT'])
@jwt_required()
def update_api_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = APIProduct.query.get(product_id)
        if not product or product.owner_id != user_id:
            return jsonify({'error': 'Not found or forbidden'}), 403

        data = request.get_json() or {}
        for field in ['name', 'description', 'short_description', 'category',
                      'base_url', 'sandbox_url', 'docs_url', 'readme', 'version']:
            if field in data:
                setattr(product, field, data[field])
        if 'tags' in data:
            product.tags = ','.join(data['tags']) if isinstance(data['tags'], list) else data['tags']
        if 'pricing' in data:
            product.pricing_json = json.dumps(data['pricing'])
        if 'openapi_spec' in data:
            product.openapi_spec = json.dumps(data['openapi_spec'])

        db.session.commit()
        return jsonify({'success': True, 'product': product.to_dict(full=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Subscriptions ──────────────────────────────────────────────────────────────

@biz_api_bp.route('/products/<product_id>/subscribe', methods=['POST'])
@jwt_required()
def subscribe(product_id):
    """Subscribe to an API product (creates keys immediately)."""
    try:
        user_id = get_jwt_identity()
        product = APIProduct.query.get(product_id)
        if not product or not product.is_active:
            return jsonify({'error': 'API product not found'}), 404
        if product.owner_id == user_id:
            return jsonify({'error': 'Cannot subscribe to your own API'}), 400

        data = request.get_json() or {}
        tier = data.get('tier', 'free')
        if tier not in SUBSCRIPTION_TIERS:
            return jsonify({'error': f'Invalid tier. Choose: {list(SUBSCRIPTION_TIERS.keys())}'}), 400

        # Check existing
        existing = APISubscription.query.filter_by(
            subscriber_id=user_id,
            api_product_id=product_id,
            status='active',
        ).first()
        if existing:
            # Upgrade/downgrade
            existing.tier = tier
            db.session.commit()
            return jsonify({'success': True, 'subscription': existing.to_dict(show_keys=True)}), 200

        tier_cfg = SUBSCRIPTION_TIERS[tier]
        price = tier_cfg['price_monthly']

        # For paid tiers, require payment_ref
        if price > 0 and not data.get('payment_ref') and not data.get('skip_payment'):
            return jsonify({
                'error': 'Payment required',
                'price': price,
                'currency': 'USD',
                'message': 'Create a Stripe/PayPal/Flutterwave payment first, then pass payment_ref',
            }), 402

        sub = APISubscription(
            subscriber_id=user_id,
            api_product_id=product_id,
            tier=tier,
            status='active',
            payment_provider=data.get('payment_provider'),
            payment_ref=data.get('payment_ref'),
            price_paid=price,
            expires_at=datetime.utcnow() + timedelta(days=30) if price > 0 else None,
            webhook_url=data.get('webhook_url'),
        )
        sub.generate_keys()
        if data.get('webhook_url'):
            sub.webhook_secret = secrets.token_hex(32)

        db.session.add(sub)

        # Update product stats
        product.subscriber_count = (product.subscriber_count or 0) + 1

        # Record earnings if paid
        if price > 0:
            platform_fee = round(price * 0.30, 2)
            net = round(price - platform_fee, 2)
            earning = APIEarnings(
                owner_id=product.owner_id,
                api_product_id=product.id,
                subscription_id=sub.id,
                gross_amount=price,
                platform_fee=platform_fee,
                net_amount=net,
                status='pending',
            )
            db.session.add(earning)

        db.session.commit()
        return jsonify({
            'success': True,
            'subscription': sub.to_dict(show_keys=True),
            'message': f'Subscribed to {product.name} ({tier} tier). Keep your keys safe!'
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('subscribe error')
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/subscriptions', methods=['GET'])
@jwt_required()
def list_subscriptions():
    """List all API subscriptions for current user."""
    try:
        user_id = get_jwt_identity()
        subs = APISubscription.query.filter_by(subscriber_id=user_id).all()
        result = []
        for s in subs:
            sd = s.to_dict(show_keys=True)
            product = APIProduct.query.get(s.api_product_id)
            sd['api_name'] = product.name if product else None
            sd['api_category'] = product.category if product else None
            result.append(sd)
        return jsonify({'subscriptions': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/subscriptions/<sub_id>/rotate-keys', methods=['POST'])
@jwt_required()
def rotate_keys(sub_id):
    """Rotate API keys for a subscription (security)."""
    try:
        user_id = get_jwt_identity()
        sub = APISubscription.query.get(sub_id)
        if not sub or sub.subscriber_id != user_id:
            return jsonify({'error': 'Subscription not found'}), 404
        sub.generate_keys()
        db.session.commit()
        return jsonify({
            'success': True,
            'production_key': sub.production_key,
            'sandbox_key': sub.sandbox_key,
            'message': 'Keys rotated. Update your applications immediately.',
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/subscriptions/<sub_id>/cancel', methods=['POST'])
@jwt_required()
def cancel_subscription(sub_id):
    try:
        user_id = get_jwt_identity()
        sub = APISubscription.query.get(sub_id)
        if not sub or sub.subscriber_id != user_id:
            return jsonify({'error': 'Subscription not found'}), 404
        sub.status = 'cancelled'
        sub.cancelled_at = datetime.utcnow()
        product = APIProduct.query.get(sub.api_product_id)
        if product:
            product.subscriber_count = max(0, (product.subscriber_count or 1) - 1)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── API Key validation (proxy check) ──────────────────────────────────────────

@biz_api_bp.route('/validate-key', methods=['POST'])
def validate_api_key():
    """
    Validate an API key and record usage.
    Used by API providers to check if a consumer key is valid.
    This endpoint itself is exempt from CSRF (called server-to-server).
    """
    try:
        data = request.get_json() or {}
        api_key = data.get('api_key') or request.headers.get('X-API-Key')
        api_product_id = data.get('api_product_id')
        endpoint = data.get('endpoint', '')
        method = data.get('method', 'GET')
        is_sandbox = False

        if not api_key:
            return jsonify({'valid': False, 'error': 'API key required'}), 401

        # Find subscription by key
        if api_key.startswith('vk_test_'):
            is_sandbox = True
            sub = APISubscription.query.filter_by(sandbox_key=api_key, status='active').first()
        else:
            sub = APISubscription.query.filter_by(production_key=api_key, status='active').first()

        if not sub:
            return jsonify({'valid': False, 'error': 'Invalid or revoked API key'}), 401

        # Check expiry
        if sub.expires_at and datetime.utcnow() > sub.expires_at:
            return jsonify({'valid': False, 'error': 'Subscription expired'}), 401

        # Check product match
        if api_product_id and sub.api_product_id != api_product_id:
            return jsonify({'valid': False, 'error': 'Key not valid for this product'}), 401

        # Rate limit check
        allowed, reason = sub.check_rate_limit()
        if not allowed:
            db.session.commit()
            return jsonify({'valid': False, 'error': reason, 'rate_limited': True}), 429

        # Increment counters
        sub.requests_this_month += 1
        sub.requests_this_minute += 1

        # Update product total
        product = APIProduct.query.get(sub.api_product_id)
        if product:
            product.total_requests = (product.total_requests or 0) + 1

        # Log usage
        log = APIUsageLog(
            subscription_id=sub.id,
            api_product_id=sub.api_product_id,
            subscriber_id=sub.subscriber_id,
            endpoint=endpoint,
            method=method,
            status_code=data.get('status_code'),
            response_time_ms=data.get('response_time_ms'),
            is_sandbox=is_sandbox,
        )
        db.session.add(log)
        db.session.commit()

        tier_cfg = sub.tier_config()
        return jsonify({
            'valid': True,
            'subscriber_id': sub.subscriber_id,
            'subscription_id': sub.id,
            'tier': sub.tier,
            'is_sandbox': is_sandbox,
            'requests_this_month': sub.requests_this_month,
            'monthly_limit': tier_cfg['requests_per_month'],
            'features': tier_cfg['features'],
        }), 200
    except Exception as e:
        db.session.rollback()
        logger.exception('validate_api_key error')
        return jsonify({'valid': False, 'error': str(e)}), 500


# ── Analytics for API providers ────────────────────────────────────────────────

@biz_api_bp.route('/products/<product_id>/analytics', methods=['GET'])
@jwt_required()
def get_api_analytics(product_id):
    """Analytics dashboard for API providers."""
    try:
        user_id = get_jwt_identity()
        product = APIProduct.query.get(product_id)
        if not product or product.owner_id != user_id:
            return jsonify({'error': 'Not found or forbidden'}), 403

        days = int(request.args.get('days', 30))
        since = datetime.utcnow() - timedelta(days=days)

        logs = APIUsageLog.query.filter(
            APIUsageLog.api_product_id == product_id,
            APIUsageLog.created_at >= since,
        ).all()

        total_requests = len(logs)
        sandbox_requests = sum(1 for l in logs if l.is_sandbox)
        production_requests = total_requests - sandbox_requests

        # Group by day
        from collections import defaultdict
        daily = defaultdict(int)
        for l in logs:
            day_key = l.created_at.strftime('%Y-%m-%d')
            daily[day_key] += 1

        # Status codes distribution
        status_dist = defaultdict(int)
        for l in logs:
            if l.status_code:
                bucket = f'{l.status_code // 100}xx'
                status_dist[bucket] += 1

        # Average response time
        times = [l.response_time_ms for l in logs if l.response_time_ms]
        avg_response_ms = round(sum(times) / len(times), 1) if times else 0

        # Earnings
        earnings = APIEarnings.query.filter_by(api_product_id=product_id).all()
        total_earnings = sum(e.net_amount for e in earnings)
        pending_earnings = sum(e.net_amount for e in earnings if e.status == 'pending')

        # Subscriptions breakdown by tier
        subs = APISubscription.query.filter_by(api_product_id=product_id, status='active').all()
        tier_breakdown = defaultdict(int)
        for s in subs:
            tier_breakdown[s.tier] += 1

        return jsonify({
            'period_days': days,
            'total_requests': total_requests,
            'sandbox_requests': sandbox_requests,
            'production_requests': production_requests,
            'daily_requests': dict(sorted(daily.items())),
            'status_distribution': dict(status_dist),
            'avg_response_ms': avg_response_ms,
            'active_subscribers': len(subs),
            'tier_breakdown': dict(tier_breakdown),
            'total_earnings': round(total_earnings, 2),
            'pending_earnings': round(pending_earnings, 2),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@biz_api_bp.route('/subscriptions/<sub_id>/usage', methods=['GET'])
@jwt_required()
def get_usage(sub_id):
    """Usage history for a subscription."""
    try:
        user_id = get_jwt_identity()
        sub = APISubscription.query.get(sub_id)
        if not sub or sub.subscriber_id != user_id:
            return jsonify({'error': 'Subscription not found'}), 404

        days = int(request.args.get('days', 7))
        since = datetime.utcnow() - timedelta(days=days)
        logs = APIUsageLog.query.filter(
            APIUsageLog.subscription_id == sub_id,
            APIUsageLog.created_at >= since,
        ).order_by(APIUsageLog.created_at.desc()).limit(200).all()

        tier_cfg = sub.tier_config()
        return jsonify({
            'subscription': sub.to_dict(),
            'logs': [l.to_dict() for l in logs],
            'monthly_limit': tier_cfg['requests_per_month'],
            'requests_this_month': sub.requests_this_month,
            'usage_pct': round(
                (sub.requests_this_month / tier_cfg['requests_per_month'] * 100)
                if tier_cfg['requests_per_month'] > 0 else 0, 1
            ),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Provider earnings ──────────────────────────────────────────────────────────

@biz_api_bp.route('/earnings', methods=['GET'])
@jwt_required()
def get_earnings():
    """API provider earnings dashboard."""
    try:
        user_id = get_jwt_identity()
        earnings = APIEarnings.query.filter_by(owner_id=user_id)\
            .order_by(APIEarnings.created_at.desc()).limit(100).all()

        total = sum(e.net_amount for e in earnings)
        available = sum(e.net_amount for e in earnings if e.status == 'available')
        pending = sum(e.net_amount for e in earnings if e.status == 'pending')

        return jsonify({
            'total_earned': round(total, 2),
            'available': round(available, 2),
            'pending': round(pending, 2),
            'earnings': [e.to_dict() for e in earnings],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Subscription payment (Stripe) ──────────────────────────────────────────────

@biz_api_bp.route('/products/<product_id>/subscribe/stripe', methods=['POST'])
@jwt_required()
def subscribe_stripe(product_id):
    """Create Stripe Checkout Session for API subscription."""
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if not stripe_lib.api_key:
            return jsonify({'error': 'Stripe not configured'}), 503

        user_id = get_jwt_identity()
        product = APIProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'API product not found'}), 404

        data = request.get_json() or {}
        tier = data.get('tier', 'starter')
        tier_cfg = SUBSCRIPTION_TIERS.get(tier, {})
        price = tier_cfg.get('price_monthly', 0)
        if price <= 0:
            return jsonify({'error': 'Free tier does not require payment'}), 400

        user = User.query.get(user_id)
        base_url = request.host_url.rstrip('/')

        session = stripe_lib.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'{product.name} — {tier_cfg["label"]} API Subscription',
                        'description': f'Monthly API access: {tier_cfg["requests_per_month"]:,} requests/month',
                    },
                    'unit_amount': int(price * 100),
                    'recurring': {'interval': 'month'},
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{base_url}/business-api?subscribed=true&product={product_id}&tier={tier}',
            cancel_url=f'{base_url}/business-api?cancelled=true',
            customer_email=user.email if user and user.email else None,
            metadata={
                'user_id': user_id,
                'api_product_id': product_id,
                'tier': tier,
            },
        )

        return jsonify({'checkout_url': session.url, 'session_id': session.id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Sandbox testing proxy ──────────────────────────────────────────────────────

@biz_api_bp.route('/sandbox/<product_slug>/test', methods=['GET', 'POST', 'PUT', 'DELETE', 'PATCH'])
def sandbox_proxy(product_slug):
    """
    Sandbox test proxy — validates sandbox key and logs the request.
    Actual proxying to the seller's sandbox_url is done by the client directly
    using the key; this endpoint provides key validation and usage logging.
    """
    try:
        api_key = request.headers.get('X-API-Key') or request.args.get('api_key')
        if not api_key or not api_key.startswith('vk_test_'):
            return jsonify({'error': 'Sandbox key required (vk_test_...)', 'sandbox': True}), 401

        sub = APISubscription.query.filter_by(sandbox_key=api_key, status='active').first()
        if not sub:
            return jsonify({'error': 'Invalid sandbox key', 'sandbox': True}), 401

        product = APIProduct.query.filter_by(slug=product_slug).first()
        if not product:
            return jsonify({'error': 'API product not found'}), 404
        if sub.api_product_id != product.id:
            return jsonify({'error': 'Key not valid for this API'}), 401

        # Log the sandbox request
        log = APIUsageLog(
            subscription_id=sub.id,
            api_product_id=product.id,
            subscriber_id=sub.subscriber_id,
            endpoint=request.path,
            method=request.method,
            status_code=200,
            is_sandbox=True,
        )
        db.session.add(log)
        sub.requests_this_month += 1
        db.session.commit()

        return jsonify({
            'sandbox': True,
            'message': 'Sandbox key validated. Direct requests to the sandbox_url in the API docs.',
            'sandbox_url': product.sandbox_url,
            'api_name': product.name,
            'tier': sub.tier,
            'features': sub.tier_config()['features'],
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Tiers reference ────────────────────────────────────────────────────────────

@biz_api_bp.route('/tiers', methods=['GET'])
def get_tiers():
    return jsonify({'tiers': SUBSCRIPTION_TIERS}), 200
