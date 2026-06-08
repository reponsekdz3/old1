"""
VipChat Marketplace Advanced — Ads, B2B, Analytics, Promotions
Real, functional, enterprise-grade marketplace extensions.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.models import db, User
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
import uuid
import logging

logger = logging.getLogger(__name__)
marketplace_adv_bp = Blueprint('marketplace_advanced', __name__, url_prefix='/api/marketplace')

# ── Ad Models ──────────────────────────────────────────────────────────────────

class MarketplaceAd(db.Model):
    __tablename__ = 'marketplace_ads'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    advertiser_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=True)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    cta_text = Column(String(100), default='Learn More')
    cta_url = Column(Text, nullable=True)

    ad_type = Column(String(30), default='banner')  # banner | featured | sidebar | spotlight
    placement = Column(String(30), default='homepage')  # homepage | category | search | sidebar

    # Billing
    budget_total = Column(Float, default=0.0)
    budget_spent = Column(Float, default=0.0)
    bid_cpm = Column(Float, default=1.0)   # Cost per 1000 impressions
    bid_cpc = Column(Float, default=0.5)   # Cost per click
    billing_type = Column(String(10), default='cpm')  # cpm | cpc | flat

    # Stats
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    conversions = Column(Integer, default=0)

    # Status
    status = Column(String(20), default='pending')  # pending | active | paused | completed | rejected
    is_approved = Column(Boolean, default=False)
    starts_at = Column(DateTime, nullable=True)
    ends_at = Column(DateTime, nullable=True)

    # Stripe payment
    stripe_payment_intent = Column(String(255), nullable=True)
    payment_status = Column(String(30), default='unpaid')  # unpaid | paid | refunded

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    advertiser = relationship('User', foreign_keys=[advertiser_id])

    def to_dict(self, public=True):
        ctr = round((self.clicks / self.impressions * 100), 2) if self.impressions > 0 else 0
        d = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'image_url': self.image_url,
            'cta_text': self.cta_text,
            'cta_url': self.cta_url,
            'ad_type': self.ad_type,
            'placement': self.placement,
            'status': self.status,
            'is_approved': self.is_approved,
            'starts_at': self.starts_at.isoformat() if self.starts_at else None,
            'ends_at': self.ends_at.isoformat() if self.ends_at else None,
            'created_at': self.created_at.isoformat(),
            'product_id': self.product_id,
        }
        if not public:
            d.update({
                'advertiser_id': self.advertiser_id,
                'budget_total': self.budget_total,
                'budget_spent': self.budget_spent,
                'bid_cpm': self.bid_cpm,
                'bid_cpc': self.bid_cpc,
                'billing_type': self.billing_type,
                'impressions': self.impressions,
                'clicks': self.clicks,
                'conversions': self.conversions,
                'ctr': ctr,
                'payment_status': self.payment_status,
            })
        return d


class MarketplaceAdClick(db.Model):
    __tablename__ = 'marketplace_ad_clicks'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ad_id = Column(String(36), ForeignKey('marketplace_ads.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    ip_hash = Column(String(64), nullable=True)
    event_type = Column(String(20), default='click')  # impression | click | conversion
    created_at = Column(DateTime, default=datetime.utcnow)


# ── B2B Models ─────────────────────────────────────────────────────────────────

class B2BListing(db.Model):
    __tablename__ = 'b2b_listings'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_id = Column(String(36), ForeignKey('users.id'), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    industry = Column(String(100), nullable=True)

    # Pricing
    unit_price = Column(Float, nullable=False, default=0.0)
    min_order_qty = Column(Integer, default=1)
    bulk_pricing = Column(Text, nullable=True)  # JSON: [{qty: 100, price: 0.80}, ...]

    # Product details
    product_specs = Column(Text, nullable=True)  # JSON
    sample_available = Column(Boolean, default=False)
    sample_price = Column(Float, default=0.0)
    lead_time_days = Column(Integer, default=7)
    stock_qty = Column(Integer, nullable=True)

    # Media
    images = Column(Text, nullable=True)  # JSON list of image URLs

    # Status
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    view_count = Column(Integer, default=0)
    inquiry_count = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seller = relationship('User', foreign_keys=[seller_id])
    inquiries = relationship('B2BInquiry', backref='listing', cascade='all, delete-orphan')

    def to_dict(self):
        import json
        return {
            'id': self.id,
            'seller_id': self.seller_id,
            'seller_name': self.seller.full_name if self.seller else None,
            'seller_avatar': self.seller.avatar_url if self.seller else None,
            'seller_verified': self.seller.badge_verified if self.seller else False,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'industry': self.industry,
            'unit_price': self.unit_price,
            'min_order_qty': self.min_order_qty,
            'bulk_pricing': json.loads(self.bulk_pricing) if self.bulk_pricing else [],
            'product_specs': json.loads(self.product_specs) if self.product_specs else {},
            'sample_available': self.sample_available,
            'sample_price': self.sample_price,
            'lead_time_days': self.lead_time_days,
            'stock_qty': self.stock_qty,
            'images': json.loads(self.images) if self.images else [],
            'is_active': self.is_active,
            'is_verified': self.is_verified,
            'view_count': self.view_count,
            'inquiry_count': self.inquiry_count,
            'created_at': self.created_at.isoformat(),
        }


class B2BInquiry(db.Model):
    __tablename__ = 'b2b_inquiries'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    listing_id = Column(String(36), ForeignKey('b2b_listings.id'), nullable=False)
    buyer_id = Column(String(36), ForeignKey('users.id'), nullable=False)

    quantity = Column(Integer, nullable=False, default=1)
    message = Column(Text, nullable=False)
    budget_range = Column(String(100), nullable=True)
    delivery_country = Column(String(100), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)

    status = Column(String(30), default='pending')  # pending | quoted | accepted | rejected | closed
    quoted_price = Column(Float, nullable=True)
    quote_message = Column(Text, nullable=True)
    quoted_at = Column(DateTime, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship('User', foreign_keys=[buyer_id])

    def to_dict(self):
        return {
            'id': self.id,
            'listing_id': self.listing_id,
            'buyer_id': self.buyer_id,
            'buyer_name': self.buyer.full_name if self.buyer else None,
            'buyer_avatar': self.buyer.avatar_url if self.buyer else None,
            'quantity': self.quantity,
            'message': self.message,
            'budget_range': self.budget_range,
            'delivery_country': self.delivery_country,
            'contact_email': self.contact_email,
            'contact_phone': self.contact_phone,
            'status': self.status,
            'quoted_price': self.quoted_price,
            'quote_message': self.quote_message,
            'quoted_at': self.quoted_at.isoformat() if self.quoted_at else None,
            'created_at': self.created_at.isoformat(),
        }


# ── Analytics Model ────────────────────────────────────────────────────────────

class MarketplaceAnalyticEvent(db.Model):
    __tablename__ = 'marketplace_analytic_events'
    __table_args__ = (
        db.Index('ix_analytic_events_product_id', 'product_id'),
        db.Index('ix_analytic_events_user_id', 'user_id'),
        db.Index('ix_analytic_events_type_date', 'event_type', 'created_at'),
        {'extend_existing': True},
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=True)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=True)
    event_type = Column(String(30), nullable=False)  # view | purchase | search | share | wishlist
    value = Column(Float, default=0.0)
    meta = Column(Text, nullable=True)
    ip_hash = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_analytic_events_product_id', 'product_id'),
        db.Index('ix_analytic_events_user_id', 'user_id'),
        db.Index('ix_analytic_events_type_date', 'event_type', 'created_at'),
    )


# ── Wishlist Model ─────────────────────────────────────────────────────────────

class MarketplaceWishlist(db.Model):
    __tablename__ = 'marketplace_wishlists'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


# ── Helper ─────────────────────────────────────────────────────────────────────

def _record_event(event_type, product_id=None, user_id=None, value=0.0, meta=None):
    try:
        import hashlib
        ip = request.remote_addr or ''
        ev = MarketplaceAnalyticEvent(
            product_id=product_id,
            user_id=user_id,
            event_type=event_type,
            value=value,
            meta=meta,
            ip_hash=hashlib.sha256(ip.encode()).hexdigest()[:16],
        )
        db.session.add(ev)
        db.session.commit()
    except Exception:
        pass


# ── AD ROUTES ─────────────────────────────────────────────────────────────────

@marketplace_adv_bp.route('/ads', methods=['GET'])
def list_ads():
    """Get active approved ads for display."""
    placement = request.args.get('placement', 'homepage')
    ad_type = request.args.get('type', '')
    limit = min(int(request.args.get('limit', 5)), 20)

    now = datetime.utcnow()
    q = MarketplaceAd.query.filter(
        MarketplaceAd.status == 'active',
        MarketplaceAd.is_approved == True,
        db.or_(MarketplaceAd.starts_at == None, MarketplaceAd.starts_at <= now),
        db.or_(MarketplaceAd.ends_at == None, MarketplaceAd.ends_at >= now),
        MarketplaceAd.budget_total > MarketplaceAd.budget_spent,
    )
    if placement:
        q = q.filter(MarketplaceAd.placement == placement)
    if ad_type:
        q = q.filter(MarketplaceAd.ad_type == ad_type)

    ads = q.order_by(MarketplaceAd.bid_cpm.desc()).limit(limit).all()

    # Record impressions
    for ad in ads:
        ad.impressions = (ad.impressions or 0) + 1
        cost = ad.bid_cpm / 1000 if ad.billing_type == 'cpm' else 0
        ad.budget_spent = (ad.budget_spent or 0) + cost
        if ad.budget_spent >= ad.budget_total:
            ad.status = 'completed'
    try:
        db.session.commit()
    except Exception:
        db.session.rollback()

    return jsonify({'ads': [a.to_dict(public=True) for a in ads]}), 200


@marketplace_adv_bp.route('/ads', methods=['POST'])
@jwt_required()
def create_ad():
    """Create a new ad campaign."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        title = data.get('title', '').strip()
        if not title:
            return jsonify({'error': 'Title required'}), 400

        budget = float(data.get('budget_total', 10.0))
        if budget < 1.0:
            return jsonify({'error': 'Minimum budget is $1.00'}), 400

        ad = MarketplaceAd()
        ad.advertiser_id = user_id
        ad.product_id = data.get('product_id')
        ad.title = title
        ad.description = data.get('description', '')
        ad.image_url = data.get('image_url', '')
        ad.cta_text = data.get('cta_text', 'View Product')
        ad.cta_url = data.get('cta_url', '')
        ad.ad_type = data.get('ad_type', 'featured')
        ad.placement = data.get('placement', 'homepage')
        ad.budget_total = budget
        ad.bid_cpm = float(data.get('bid_cpm', 2.0))
        ad.bid_cpc = float(data.get('bid_cpc', 0.5))
        ad.billing_type = data.get('billing_type', 'cpm')
        ad.status = 'pending'
        ad.is_approved = False

        # Parse dates
        if data.get('starts_at'):
            try:
                ad.starts_at = datetime.fromisoformat(data['starts_at'].replace('Z', ''))
            except Exception:
                pass
        if data.get('ends_at'):
            try:
                ad.ends_at = datetime.fromisoformat(data['ends_at'].replace('Z', ''))
            except Exception:
                pass

        db.session.add(ad)
        db.session.commit()

        # Process payment if Stripe configured
        stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        checkout_url = None
        if stripe_key:
            try:
                import stripe
                stripe.api_key = stripe_key
                session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': 'usd',
                            'product_data': {'name': f'Ad Campaign: {title}'},
                            'unit_amount': int(budget * 100),
                        },
                        'quantity': 1,
                    }],
                    mode='payment',
                    success_url=f'{request.host_url.rstrip("/")}/marketplace?ad_success={ad.id}',
                    cancel_url=f'{request.host_url.rstrip("/")}/marketplace?ad_cancel=1',
                    metadata={'ad_id': ad.id, 'type': 'marketplace_ad'},
                )
                ad.stripe_payment_intent = session.id
                db.session.commit()
                checkout_url = session.url
            except Exception as se:
                logger.warning(f'Stripe ad payment error: {se}')

        return jsonify({
            'ad': ad.to_dict(public=False),
            'checkout_url': checkout_url,
            'message': 'Ad campaign created. Pending review.',
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('create_ad error')
        return jsonify({'error': str(e)}), 500


@marketplace_adv_bp.route('/ads/my', methods=['GET'])
@jwt_required()
def my_ads():
    """Get all ads for the current user."""
    user_id = get_jwt_identity()
    ads = MarketplaceAd.query.filter_by(advertiser_id=user_id).order_by(MarketplaceAd.created_at.desc()).all()
    return jsonify({'ads': [a.to_dict(public=False) for a in ads]}), 200


@marketplace_adv_bp.route('/ads/<ad_id>/click', methods=['POST'])
def track_ad_click(ad_id):
    """Track an ad click."""
    try:
        ad = MarketplaceAd.query.get(ad_id)
        if not ad:
            return jsonify({'error': 'Not found'}), 404

        ad.clicks = (ad.clicks or 0) + 1
        if ad.billing_type == 'cpc':
            ad.budget_spent = (ad.budget_spent or 0) + ad.bid_cpc
            if ad.budget_spent >= ad.budget_total:
                ad.status = 'completed'

        # Try to get user id
        user_id = None
        try:
            verify_jwt_in_request(optional=True)
            user_id = get_jwt_identity()
        except Exception:
            pass

        click_ev = MarketplaceAdClick(ad_id=ad_id, user_id=user_id, event_type='click')
        db.session.add(click_ev)
        db.session.commit()
        return jsonify({'ok': True, 'redirect_url': ad.cta_url}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_adv_bp.route('/ads/<ad_id>/approve', methods=['POST'])
@jwt_required()
def approve_ad(ad_id):
    """Admin: approve an ad."""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not getattr(user, 'is_admin', False):
        return jsonify({'error': 'Forbidden'}), 403
    ad = MarketplaceAd.query.get(ad_id)
    if not ad:
        return jsonify({'error': 'Not found'}), 404
    ad.is_approved = True
    ad.status = 'active'
    db.session.commit()
    return jsonify({'message': 'Ad approved', 'ad': ad.to_dict(public=False)}), 200


# ── B2B ROUTES ─────────────────────────────────────────────────────────────────

B2B_INDUSTRIES = [
    'Manufacturing', 'Technology', 'Agriculture', 'Healthcare', 'Construction',
    'Textiles', 'Food & Beverage', 'Electronics', 'Automotive', 'Chemicals',
    'Logistics', 'Mining', 'Energy', 'Real Estate', 'Services', 'Other',
]
B2B_CATEGORIES = [
    'Raw Materials', 'Components & Parts', 'Finished Goods', 'Equipment & Machinery',
    'Office Supplies', 'Software & SaaS', 'Professional Services', 'Consulting',
    'Wholesale Products', 'OEM Manufacturing', 'Custom Orders', 'Other',
]


@marketplace_adv_bp.route('/b2b/categories', methods=['GET'])
def b2b_categories():
    return jsonify({'industries': B2B_INDUSTRIES, 'categories': B2B_CATEGORIES}), 200


@marketplace_adv_bp.route('/b2b/listings', methods=['GET'])
def list_b2b():
    """Browse B2B listings."""
    page = int(request.args.get('page', 1))
    per_page = min(int(request.args.get('per_page', 20)), 50)
    search = request.args.get('search', '').strip()
    category = request.args.get('category', '')
    industry = request.args.get('industry', '')
    min_qty = request.args.get('min_qty', type=int)
    max_price = request.args.get('max_price', type=float)

    q = B2BListing.query.filter_by(is_active=True)
    if search:
        q = q.filter(db.or_(
            B2BListing.title.ilike(f'%{search}%'),
            B2BListing.description.ilike(f'%{search}%'),
        ))
    if category:
        q = q.filter(B2BListing.category == category)
    if industry:
        q = q.filter(B2BListing.industry == industry)
    if min_qty:
        q = q.filter(B2BListing.min_order_qty <= min_qty)
    if max_price:
        q = q.filter(B2BListing.unit_price <= max_price)

    paginated = q.order_by(B2BListing.created_at.desc()).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'listings': [l.to_dict() for l in paginated.items],
        'total': paginated.total,
        'pages': paginated.pages,
        'page': page,
    }), 200


@marketplace_adv_bp.route('/b2b/listings', methods=['POST'])
@jwt_required()
def create_b2b_listing():
    """Create a B2B listing."""
    try:
        import json
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        title = data.get('title', '').strip()
        if not title:
            return jsonify({'error': 'Title required'}), 400

        listing = B2BListing()
        listing.seller_id = user_id
        listing.title = title
        listing.description = data.get('description', '')
        listing.category = data.get('category', 'Other')
        listing.industry = data.get('industry', 'Other')
        listing.unit_price = float(data.get('unit_price', 0))
        listing.min_order_qty = int(data.get('min_order_qty', 1))
        listing.sample_available = bool(data.get('sample_available', False))
        listing.sample_price = float(data.get('sample_price', 0))
        listing.lead_time_days = int(data.get('lead_time_days', 7))
        listing.stock_qty = data.get('stock_qty')

        if data.get('bulk_pricing'):
            listing.bulk_pricing = json.dumps(data['bulk_pricing'])
        if data.get('product_specs'):
            listing.product_specs = json.dumps(data['product_specs'])
        if data.get('images'):
            listing.images = json.dumps(data['images'])

        db.session.add(listing)
        db.session.commit()
        return jsonify({'listing': listing.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('create_b2b_listing error')
        return jsonify({'error': str(e)}), 500


@marketplace_adv_bp.route('/b2b/listings/<listing_id>', methods=['GET'])
def get_b2b_listing(listing_id):
    listing = B2BListing.query.get(listing_id)
    if not listing or not listing.is_active:
        return jsonify({'error': 'Not found'}), 404
    listing.view_count = (listing.view_count or 0) + 1
    db.session.commit()
    return jsonify(listing.to_dict()), 200


@marketplace_adv_bp.route('/b2b/listings/<listing_id>/inquire', methods=['POST'])
@jwt_required()
def create_inquiry(listing_id):
    """Send a B2B inquiry / RFQ."""
    try:
        user_id = get_jwt_identity()
        listing = B2BListing.query.get(listing_id)
        if not listing or not listing.is_active:
            return jsonify({'error': 'Listing not found'}), 404
        if listing.seller_id == user_id:
            return jsonify({'error': 'Cannot inquire on your own listing'}), 400

        data = request.get_json() or {}
        qty = int(data.get('quantity', listing.min_order_qty))
        if qty < listing.min_order_qty:
            return jsonify({'error': f'Minimum order quantity is {listing.min_order_qty}'}), 400

        inq = B2BInquiry()
        inq.listing_id = listing_id
        inq.buyer_id = user_id
        inq.quantity = qty
        inq.message = data.get('message', '').strip() or 'Requesting quote'
        inq.budget_range = data.get('budget_range', '')
        inq.delivery_country = data.get('delivery_country', '')
        inq.contact_email = data.get('contact_email', '')
        inq.contact_phone = data.get('contact_phone', '')

        listing.inquiry_count = (listing.inquiry_count or 0) + 1

        db.session.add(inq)
        db.session.commit()

        return jsonify({'inquiry': inq.to_dict(), 'message': 'Inquiry sent to seller'}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_adv_bp.route('/b2b/inquiries', methods=['GET'])
@jwt_required()
def my_inquiries():
    """Get inquiries for seller's listings and buyer's sent inquiries."""
    user_id = get_jwt_identity()
    role = request.args.get('role', 'seller')  # seller | buyer

    if role == 'seller':
        my_listing_ids = [l.id for l in B2BListing.query.filter_by(seller_id=user_id).all()]
        inquiries = B2BInquiry.query.filter(B2BInquiry.listing_id.in_(my_listing_ids)).order_by(B2BInquiry.created_at.desc()).all()
    else:
        inquiries = B2BInquiry.query.filter_by(buyer_id=user_id).order_by(B2BInquiry.created_at.desc()).all()

    return jsonify({'inquiries': [i.to_dict() for i in inquiries]}), 200


@marketplace_adv_bp.route('/b2b/inquiries/<inquiry_id>/quote', methods=['POST'])
@jwt_required()
def send_quote(inquiry_id):
    """Seller sends a quote response."""
    try:
        user_id = get_jwt_identity()
        inq = B2BInquiry.query.get(inquiry_id)
        if not inq:
            return jsonify({'error': 'Not found'}), 404

        listing = B2BListing.query.get(inq.listing_id)
        if not listing or listing.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        data = request.get_json() or {}
        inq.quoted_price = float(data.get('quoted_price', 0))
        inq.quote_message = data.get('quote_message', '')
        inq.status = 'quoted'
        inq.quoted_at = datetime.utcnow()
        db.session.commit()

        return jsonify({'inquiry': inq.to_dict(), 'message': 'Quote sent'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_adv_bp.route('/b2b/my-listings', methods=['GET'])
@jwt_required()
def my_b2b_listings():
    user_id = get_jwt_identity()
    listings = B2BListing.query.filter_by(seller_id=user_id).order_by(B2BListing.created_at.desc()).all()
    return jsonify({'listings': [l.to_dict() for l in listings]}), 200


# ── ANALYTICS ROUTES ───────────────────────────────────────────────────────────

@marketplace_adv_bp.route('/analytics/seller', methods=['GET'])
@jwt_required()
def seller_analytics():
    """Seller analytics dashboard."""
    from app.routes.marketplace import MarketplaceProduct, MarketplacePurchase, MarketplaceReview
    user_id = get_jwt_identity()

    products = MarketplaceProduct.query.filter_by(seller_id=user_id, is_active=True).all()
    product_ids = [p.id for p in products]

    if not product_ids:
        return jsonify({
            'summary': {'total_products': 0, 'total_revenue': 0, 'total_sales': 0,
                       'total_views': 0, 'total_downloads': 0, 'avg_rating': 0},
            'products': [], 'revenue_by_day': [], 'top_products': [],
        }), 200

    total_revenue = db.session.query(db.func.sum(MarketplacePurchase.amount_paid)).filter(
        MarketplacePurchase.product_id.in_(product_ids),
        MarketplacePurchase.status == 'completed'
    ).scalar() or 0

    total_sales = MarketplacePurchase.query.filter(
        MarketplacePurchase.product_id.in_(product_ids),
        MarketplacePurchase.status == 'completed'
    ).count()

    # Revenue by day (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    daily = db.session.query(
        db.func.date(MarketplacePurchase.created_at).label('date'),
        db.func.sum(MarketplacePurchase.amount_paid).label('revenue'),
        db.func.count(MarketplacePurchase.id).label('sales'),
    ).filter(
        MarketplacePurchase.product_id.in_(product_ids),
        MarketplacePurchase.status == 'completed',
        MarketplacePurchase.created_at >= thirty_days_ago,
    ).group_by(db.func.date(MarketplacePurchase.created_at)).all()

    revenue_by_day = [{'date': str(d.date), 'revenue': float(d.revenue or 0), 'sales': int(d.sales)} for d in daily]

    # Product breakdown
    product_data = []
    for p in products:
        sales = MarketplacePurchase.query.filter_by(product_id=p.id, status='completed').count()
        rev = db.session.query(db.func.sum(MarketplacePurchase.amount_paid)).filter_by(product_id=p.id, status='completed').scalar() or 0
        avg_rating = db.session.query(db.func.avg(MarketplaceReview.rating)).filter_by(product_id=p.id).scalar() or 0
        product_data.append({
            **p.to_dict(),
            'total_sales': sales,
            'total_revenue': float(rev),
            'avg_rating': round(float(avg_rating), 1),
        })

    top_products = sorted(product_data, key=lambda x: x['total_revenue'], reverse=True)[:5]

    all_ratings = []
    for p in products:
        for r in p.reviews:
            all_ratings.append(r.rating)
    avg_rating = round(sum(all_ratings) / len(all_ratings), 1) if all_ratings else 0

    return jsonify({
        'summary': {
            'total_products': len(products),
            'total_revenue': round(float(total_revenue), 2),
            'total_sales': total_sales,
            'total_views': sum(p.view_count or 0 for p in products),
            'total_downloads': sum(p.download_count or 0 for p in products),
            'avg_rating': avg_rating,
        },
        'products': product_data,
        'revenue_by_day': revenue_by_day,
        'top_products': top_products,
    }), 200


@marketplace_adv_bp.route('/analytics/global', methods=['GET'])
def global_analytics():
    """Public marketplace analytics."""
    from app.routes.marketplace import MarketplaceProduct, MarketplacePurchase
    total_products = MarketplaceProduct.query.filter_by(is_active=True).count()
    total_sellers = db.session.query(db.func.count(db.func.distinct(MarketplaceProduct.seller_id))).filter_by(is_active=True).scalar() or 0
    total_sales = MarketplacePurchase.query.filter_by(status='completed').count()
    total_revenue = db.session.query(db.func.sum(MarketplacePurchase.amount_paid)).filter_by(status='completed').scalar() or 0
    total_b2b = B2BListing.query.filter_by(is_active=True).count()

    return jsonify({
        'total_products': total_products,
        'total_sellers': total_sellers,
        'total_sales': total_sales,
        'total_revenue': round(float(total_revenue), 2),
        'total_b2b_listings': total_b2b,
    }), 200


# ── WISHLIST ROUTES ────────────────────────────────────────────────────────────

@marketplace_adv_bp.route('/wishlist', methods=['GET'])
@jwt_required()
def get_wishlist():
    from app.routes.marketplace import MarketplaceProduct
    user_id = get_jwt_identity()
    items = MarketplaceWishlist.query.filter_by(user_id=user_id).order_by(MarketplaceWishlist.created_at.desc()).all()
    product_ids = [i.product_id for i in items]
    products = MarketplaceProduct.query.filter(MarketplaceProduct.id.in_(product_ids)).all()
    return jsonify({'wishlist': [p.to_dict() for p in products]}), 200


@marketplace_adv_bp.route('/wishlist/<product_id>', methods=['POST', 'DELETE'])
@jwt_required()
def toggle_wishlist(product_id):
    user_id = get_jwt_identity()
    existing = MarketplaceWishlist.query.filter_by(user_id=user_id, product_id=product_id).first()

    if request.method == 'DELETE' or existing:
        if existing:
            db.session.delete(existing)
            db.session.commit()
        return jsonify({'wishlisted': False}), 200
    else:
        item = MarketplaceWishlist(user_id=user_id, product_id=product_id)
        db.session.add(item)
        db.session.commit()
        _record_event('wishlist', product_id=product_id, user_id=user_id)
        return jsonify({'wishlisted': True}), 201


# ── FEATURED / PROMOTED ────────────────────────────────────────────────────────

@marketplace_adv_bp.route('/featured', methods=['GET'])
def get_featured():
    """Get featured/promoted products for homepage."""
    from app.routes.marketplace import MarketplaceProduct
    limit = min(int(request.args.get('limit', 8)), 20)

    # Get products with active ad campaigns first, then top sellers
    promoted_product_ids = [
        a.product_id for a in
        MarketplaceAd.query.filter(
            MarketplaceAd.status == 'active',
            MarketplaceAd.is_approved == True,
            MarketplaceAd.product_id != None,
        ).order_by(MarketplaceAd.bid_cpm.desc()).limit(limit).all()
        if a.product_id
    ]

    promoted = MarketplaceProduct.query.filter(
        MarketplaceProduct.id.in_(promoted_product_ids),
        MarketplaceProduct.is_active == True,
    ).all() if promoted_product_ids else []

    remaining = limit - len(promoted)
    if remaining > 0:
        top_products = MarketplaceProduct.query.filter(
            MarketplaceProduct.is_active == True,
            ~MarketplaceProduct.id.in_(promoted_product_ids),
        ).order_by(MarketplaceProduct.download_count.desc()).limit(remaining).all()
    else:
        top_products = []

    all_products = promoted + top_products
    return jsonify({
        'featured': [p.to_dict() for p in all_products],
        'promoted_count': len(promoted),
    }), 200


@marketplace_adv_bp.route('/promote/<product_id>', methods=['POST'])
@jwt_required()
def promote_product(product_id):
    """Quick-promote a product by creating an ad campaign."""
    try:
        from app.routes.marketplace import MarketplaceProduct
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product or product.seller_id != user_id:
            return jsonify({'error': 'Product not found or not yours'}), 404

        data = request.get_json() or {}
        budget = float(data.get('budget', 10.0))
        days = int(data.get('days', 7))

        ad = MarketplaceAd()
        ad.advertiser_id = user_id
        ad.product_id = product_id
        ad.title = product.title
        ad.description = (product.description or '')[:200]
        ad.image_url = product.thumbnail_url or product.preview_url or ''
        ad.cta_text = 'Buy Now'
        ad.cta_url = f'/marketplace?product={product_id}'
        ad.ad_type = 'featured'
        ad.placement = 'homepage'
        ad.budget_total = budget
        ad.bid_cpm = max(1.0, budget / days / 10)
        ad.billing_type = 'cpm'
        ad.starts_at = datetime.utcnow()
        ad.ends_at = datetime.utcnow() + timedelta(days=days)
        ad.status = 'pending'
        ad.is_approved = False

        db.session.add(ad)
        db.session.commit()

        checkout_url = None
        stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if stripe_key:
            try:
                import stripe
                stripe.api_key = stripe_key
                session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': 'usd',
                            'product_data': {'name': f'Promote: {product.title} ({days} days)'},
                            'unit_amount': int(budget * 100),
                        },
                        'quantity': 1,
                    }],
                    mode='payment',
                    success_url=f'{request.host_url.rstrip("/")}/marketplace?promote_success={ad.id}',
                    cancel_url=f'{request.host_url.rstrip("/")}/marketplace',
                    metadata={'ad_id': ad.id, 'type': 'promote_product'},
                )
                ad.stripe_payment_intent = session.id
                db.session.commit()
                checkout_url = session.url
            except Exception as se:
                logger.warning(f'Stripe promote error: {se}')

        return jsonify({
            'ad': ad.to_dict(public=False),
            'checkout_url': checkout_url,
            'message': f'Promotion created for {days} days. Pending payment & review.',
        }), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('promote_product error')
        return jsonify({'error': str(e)}), 500
