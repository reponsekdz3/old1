"""
Physical Goods Marketplace — VipChat
Real tangible product marketplace with:
- Product variants (size, color, material)
- Military-grade escrow (5-day buyer protection)
- Seller cashback (3% per sale)
- Loyalty rewards: free product after $500 in purchases
- Shipping & tracking integration
- Advanced anti-fraud & dispute resolution
- Multi-currency support
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.models import db, User
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid
import os
import json
import logging

logger = logging.getLogger(__name__)

physical_bp = Blueprint('physical_marketplace', __name__, url_prefix='/api/physical')

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'uploads', 'physical'
)
os.makedirs(UPLOAD_DIR, exist_ok=True)

PHYSICAL_CATEGORIES = [
    'Clothing & Fashion', 'Electronics', 'Home & Living', 'Sports & Outdoors',
    'Beauty & Personal Care', 'Books & Stationery', 'Toys & Games', 'Jewelry & Accessories',
    'Food & Groceries', 'Health & Wellness', 'Art & Crafts', 'Automotive',
    'Garden & Plants', 'Baby & Kids', 'Office Supplies', 'Other'
]

CLOTHING_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'One Size']
STANDARD_COLORS = [
    'Black', 'White', 'Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange',
    'Pink', 'Brown', 'Gray', 'Navy', 'Beige', 'Multicolor', 'Other'
]

CASHBACK_RATE = 0.03           # 3% cashback for sellers per sale
ESCROW_HOLD_DAYS = 5           # 5-day buyer protection window
LOYALTY_FREE_THRESHOLD = 500   # Buyer gets $10 coupon after $500 spent
PLATFORM_FEE_RATE = 0.05       # 5% platform fee on each sale


# ─────────────────────── MODELS ───────────────────────────────────────────────

class PhysicalProduct(db.Model):
    __tablename__ = 'physical_products'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_id = Column(String(36), ForeignKey('users.id'), nullable=False)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, default='Other')
    subcategory = Column(String(100), nullable=True)
    brand = Column(String(100), nullable=True)
    sku = Column(String(100), nullable=True)

    # Pricing
    price = Column(Float, nullable=False)
    original_price = Column(Float, nullable=True)  # For showing discounts
    currency = Column(String(10), default='USD')
    bulk_discount_json = Column(Text, nullable=True)  # JSON: [{qty:10, discount:0.05}, ...]

    # Inventory
    stock_quantity = Column(Integer, default=0)
    low_stock_threshold = Column(Integer, default=5)
    track_inventory = Column(Boolean, default=True)
    allow_backorder = Column(Boolean, default=False)

    # Images (comma-separated URLs)
    images_json = Column(Text, nullable=True)   # JSON array of image URLs
    thumbnail_url = Column(Text, nullable=True)

    # Physical dimensions
    weight_kg = Column(Float, nullable=True)
    length_cm = Column(Float, nullable=True)
    width_cm = Column(Float, nullable=True)
    height_cm = Column(Float, nullable=True)

    # Product options
    has_variants = Column(Boolean, default=False)
    condition = Column(String(20), default='new')  # new | used | refurbished

    # Shipping
    ships_from_country = Column(String(100), nullable=True)
    ships_from_city = Column(String(100), nullable=True)
    shipping_cost = Column(Float, default=0.0)
    free_shipping_min = Column(Float, nullable=True)  # Free shipping above this amount
    estimated_delivery_days = Column(Integer, default=7)
    ships_internationally = Column(Boolean, default=False)

    # Return policy
    returns_accepted = Column(Boolean, default=True)
    return_days = Column(Integer, default=14)
    return_policy = Column(Text, nullable=True)

    # Stats
    view_count = Column(Integer, default=0)
    sale_count = Column(Integer, default=0)
    wishlist_count = Column(Integer, default=0)

    # Status
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)

    # Tags
    tags = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seller = relationship('User', foreign_keys=[seller_id], backref='physical_products')
    variants = relationship('PhysicalProductVariant', backref='product', cascade='all, delete-orphan')
    orders = relationship('PhysicalOrder', backref='product', cascade='all, delete-orphan')
    reviews = relationship('PhysicalReview', backref='product', cascade='all, delete-orphan')

    def avg_rating(self):
        if not self.reviews:
            return 0.0
        return round(sum(r.rating for r in self.reviews) / len(self.reviews), 1)

    def to_dict(self, full=False):
        images = json.loads(self.images_json) if self.images_json else []
        bulk = json.loads(self.bulk_discount_json) if self.bulk_discount_json else []
        d = {
            'id': self.id,
            'seller_id': self.seller_id,
            'seller_name': self.seller.full_name if self.seller else None,
            'seller_avatar': self.seller.avatar_url if self.seller else None,
            'seller_verified': bool(self.seller.badge_verified) if self.seller else False,
            'title': self.title,
            'description': self.description if full else (self.description or '')[:200],
            'category': self.category,
            'subcategory': self.subcategory,
            'brand': self.brand,
            'price': self.price,
            'original_price': self.original_price,
            'currency': self.currency,
            'bulk_discounts': bulk,
            'stock_quantity': self.stock_quantity,
            'in_stock': self.stock_quantity > 0 or not self.track_inventory,
            'condition': self.condition,
            'images': images,
            'thumbnail_url': self.thumbnail_url or (images[0] if images else None),
            'weight_kg': self.weight_kg,
            'shipping_cost': self.shipping_cost,
            'free_shipping_min': self.free_shipping_min,
            'estimated_delivery_days': self.estimated_delivery_days,
            'ships_internationally': self.ships_internationally,
            'ships_from_country': self.ships_from_country,
            'returns_accepted': self.returns_accepted,
            'return_days': self.return_days,
            'has_variants': self.has_variants,
            'tags': self.tags.split(',') if self.tags else [],
            'view_count': self.view_count,
            'sale_count': self.sale_count,
            'wishlist_count': self.wishlist_count,
            'is_featured': self.is_featured,
            'rating_avg': self.avg_rating(),
            'rating_count': len(self.reviews),
            'created_at': self.created_at.isoformat(),
        }
        if self.has_variants:
            d['variants'] = [v.to_dict() for v in self.variants]
        if full:
            d['return_policy'] = self.return_policy
            d['sku'] = self.sku
        return d


class PhysicalProductVariant(db.Model):
    __tablename__ = 'physical_product_variants'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey('physical_products.id'), nullable=False)
    size = Column(String(50), nullable=True)
    color = Column(String(50), nullable=True)
    material = Column(String(100), nullable=True)
    extra_attributes = Column(Text, nullable=True)  # JSON for custom attrs
    sku = Column(String(100), nullable=True)
    price_modifier = Column(Float, default=0.0)  # Additional charge on top of base price
    stock_quantity = Column(Integer, default=0)
    image_url = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'size': self.size,
            'color': self.color,
            'material': self.material,
            'extra': json.loads(self.extra_attributes) if self.extra_attributes else {},
            'sku': self.sku,
            'price_modifier': self.price_modifier,
            'stock_quantity': self.stock_quantity,
            'image_url': self.image_url,
            'is_active': self.is_active,
        }


class PhysicalOrder(db.Model):
    """A physical goods order with full escrow lifecycle."""
    __tablename__ = 'physical_orders'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_number = Column(String(20), unique=True, nullable=False)
    buyer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    seller_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('physical_products.id'), nullable=False)
    variant_id = Column(String(36), ForeignKey('physical_product_variants.id'), nullable=True)

    # Pricing
    quantity = Column(Integer, default=1)
    unit_price = Column(Float, nullable=False)
    shipping_cost = Column(Float, default=0.0)
    discount_amount = Column(Float, default=0.0)  # Cashback/coupon applied
    platform_fee = Column(Float, default=0.0)
    total_amount = Column(Float, nullable=False)
    currency = Column(String(10), default='USD')

    # Payment
    payment_provider = Column(String(50), nullable=True)  # stripe | paypal | flutterwave
    payment_ref = Column(String(255), nullable=True)
    payment_status = Column(String(20), default='pending')  # pending | paid | refunded | failed

    # Escrow
    escrow_status = Column(String(20), default='held')  # held | released | disputed | refunded
    escrow_held_at = Column(DateTime, nullable=True)
    escrow_release_date = Column(DateTime, nullable=True)  # buyer_protection_days after delivery
    escrow_released_at = Column(DateTime, nullable=True)

    # Shipping
    status = Column(String(30), default='awaiting_payment')
    # awaiting_payment | paid | processing | shipped | delivered | completed | cancelled | disputed | refunded
    shipping_name = Column(String(255), nullable=True)
    shipping_address_line1 = Column(String(255), nullable=True)
    shipping_address_line2 = Column(String(255), nullable=True)
    shipping_city = Column(String(100), nullable=True)
    shipping_state = Column(String(100), nullable=True)
    shipping_zip = Column(String(20), nullable=True)
    shipping_country = Column(String(100), nullable=True)
    shipping_phone = Column(String(50), nullable=True)

    # Tracking
    tracking_number = Column(String(200), nullable=True)
    tracking_carrier = Column(String(100), nullable=True)
    tracking_url = Column(Text, nullable=True)
    shipped_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)

    # Cashback
    seller_cashback_amount = Column(Float, default=0.0)
    seller_cashback_credited = Column(Boolean, default=False)

    # Loyalty
    buyer_loyalty_points = Column(Float, default=0.0)  # Amount (USD) credited to loyalty

    # Notes
    buyer_note = Column(Text, nullable=True)
    seller_note = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship('User', foreign_keys=[buyer_id], backref='physical_orders_as_buyer')
    seller = relationship('User', foreign_keys=[seller_id], backref='physical_orders_as_seller')
    variant = relationship('PhysicalProductVariant', foreign_keys=[variant_id])

    def seller_payout_amount(self):
        """What seller receives after platform fee."""
        return round(self.total_amount - self.platform_fee, 2)

    def to_dict(self, full=False):
        d = {
            'id': self.id,
            'order_number': self.order_number,
            'buyer_id': self.buyer_id,
            'seller_id': self.seller_id,
            'product_id': self.product_id,
            'variant_id': self.variant_id,
            'quantity': self.quantity,
            'unit_price': self.unit_price,
            'shipping_cost': self.shipping_cost,
            'discount_amount': self.discount_amount,
            'platform_fee': self.platform_fee,
            'total_amount': self.total_amount,
            'currency': self.currency,
            'payment_provider': self.payment_provider,
            'payment_status': self.payment_status,
            'escrow_status': self.escrow_status,
            'escrow_release_date': self.escrow_release_date.isoformat() if self.escrow_release_date else None,
            'escrow_released_at': self.escrow_released_at.isoformat() if self.escrow_released_at else None,
            'status': self.status,
            'tracking_number': self.tracking_number,
            'tracking_carrier': self.tracking_carrier,
            'tracking_url': self.tracking_url,
            'shipped_at': self.shipped_at.isoformat() if self.shipped_at else None,
            'delivered_at': self.delivered_at.isoformat() if self.delivered_at else None,
            'seller_cashback_amount': self.seller_cashback_amount,
            'seller_cashback_credited': self.seller_cashback_credited,
            'buyer_loyalty_points': self.buyer_loyalty_points,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }
        if full:
            d['shipping_name'] = self.shipping_name
            d['shipping_address_line1'] = self.shipping_address_line1
            d['shipping_address_line2'] = self.shipping_address_line2
            d['shipping_city'] = self.shipping_city
            d['shipping_state'] = self.shipping_state
            d['shipping_zip'] = self.shipping_zip
            d['shipping_country'] = self.shipping_country
            d['shipping_phone'] = self.shipping_phone
            d['buyer_note'] = self.buyer_note
            d['seller_note'] = self.seller_note
        return d


class SellerWallet(db.Model):
    """Seller earnings wallet with cashback tracking."""
    __tablename__ = 'seller_wallets'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), unique=True, nullable=False)
    available_balance = Column(Float, default=0.0)     # Ready to withdraw
    pending_balance = Column(Float, default=0.0)       # In escrow
    total_earned = Column(Float, default=0.0)
    total_cashback = Column(Float, default=0.0)
    total_withdrawn = Column(Float, default=0.0)
    total_sales = Column(Integer, default=0)
    currency = Column(String(10), default='USD')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', foreign_keys=[user_id], backref='seller_wallet')

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'available_balance': round(self.available_balance, 2),
            'pending_balance': round(self.pending_balance, 2),
            'total_earned': round(self.total_earned, 2),
            'total_cashback': round(self.total_cashback, 2),
            'total_withdrawn': round(self.total_withdrawn, 2),
            'total_sales': self.total_sales,
            'currency': self.currency,
        }


class BuyerLoyaltyWallet(db.Model):
    """Buyer loyalty rewards wallet."""
    __tablename__ = 'buyer_loyalty_wallets'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), unique=True, nullable=False)
    loyalty_balance = Column(Float, default=0.0)   # Redeemable credit
    total_spent = Column(Float, default=0.0)
    total_earned = Column(Float, default=0.0)
    free_product_credits = Column(Integer, default=0)  # Number of free product claims available
    currency = Column(String(10), default='USD')
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', foreign_keys=[user_id], backref='loyalty_wallet')

    def to_dict(self):
        return {
            'user_id': self.user_id,
            'loyalty_balance': round(self.loyalty_balance, 2),
            'total_spent': round(self.total_spent, 2),
            'total_earned': round(self.total_earned, 2),
            'free_product_credits': self.free_product_credits,
            'currency': self.currency,
        }


class PhysicalReview(db.Model):
    __tablename__ = 'physical_reviews'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey('physical_products.id'), nullable=False)
    order_id = Column(String(36), ForeignKey('physical_orders.id'), nullable=False)
    reviewer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    rating = Column(Integer, nullable=False)
    title = Column(String(255), nullable=True)
    body = Column(Text, nullable=True)
    images_json = Column(Text, nullable=True)
    is_verified_purchase = Column(Boolean, default=True)
    helpful_count = Column(Integer, default=0)
    seller_reply = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    reviewer = relationship('User', foreign_keys=[reviewer_id])

    def to_dict(self):
        images = json.loads(self.images_json) if self.images_json else []
        return {
            'id': self.id,
            'product_id': self.product_id,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer.full_name if self.reviewer else None,
            'reviewer_avatar': self.reviewer.avatar_url if self.reviewer else None,
            'rating': self.rating,
            'title': self.title,
            'body': self.body,
            'images': images,
            'is_verified_purchase': self.is_verified_purchase,
            'helpful_count': self.helpful_count,
            'seller_reply': self.seller_reply,
            'created_at': self.created_at.isoformat(),
        }


class PhysicalDispute(db.Model):
    __tablename__ = 'physical_disputes'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    order_id = Column(String(36), ForeignKey('physical_orders.id'), nullable=False)
    buyer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    seller_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    reason = Column(String(100), nullable=False)
    # not_received | item_not_as_described | damaged | wrong_item | other
    buyer_statement = Column(Text, nullable=False)
    evidence_json = Column(Text, nullable=True)  # JSON array of image URLs as evidence
    seller_response = Column(Text, nullable=True)
    status = Column(String(30), default='open')  # open | seller_responded | resolved_buyer | resolved_seller | escalated
    resolution = Column(Text, nullable=True)
    refund_amount = Column(Float, default=0.0)
    seller_respond_deadline = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship('User', foreign_keys=[buyer_id])
    seller = relationship('User', foreign_keys=[seller_id])

    def to_dict(self):
        return {
            'id': self.id,
            'order_id': self.order_id,
            'buyer_id': self.buyer_id,
            'seller_id': self.seller_id,
            'reason': self.reason,
            'buyer_statement': self.buyer_statement,
            'evidence': json.loads(self.evidence_json) if self.evidence_json else [],
            'seller_response': self.seller_response,
            'status': self.status,
            'resolution': self.resolution,
            'refund_amount': self.refund_amount,
            'seller_respond_deadline': self.seller_respond_deadline.isoformat() if self.seller_respond_deadline else None,
            'created_at': self.created_at.isoformat(),
        }


# ─────────────────────── HELPERS ──────────────────────────────────────────────

def _gen_order_number():
    import random, string
    return 'VP' + ''.join(random.choices(string.digits, k=10))


def _get_or_create_seller_wallet(user_id):
    wallet = SellerWallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        wallet = SellerWallet(user_id=user_id)
        db.session.add(wallet)
        db.session.flush()
    return wallet


def _get_or_create_buyer_wallet(user_id):
    wallet = BuyerLoyaltyWallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        wallet = BuyerLoyaltyWallet(user_id=user_id)
        db.session.add(wallet)
        db.session.flush()
    return wallet


def _credit_seller_cashback(order: PhysicalOrder):
    """Credit 3% cashback to seller wallet when escrow releases."""
    cashback = round(order.total_amount * CASHBACK_RATE, 2)
    wallet = _get_or_create_seller_wallet(order.seller_id)
    wallet.available_balance += order.seller_payout_amount()
    wallet.total_cashback += cashback
    wallet.total_earned += order.seller_payout_amount()
    wallet.total_sales += 1
    wallet.available_balance += cashback  # cashback is on top
    order.seller_cashback_amount = cashback
    order.seller_cashback_credited = True
    logger.info(f"Cashback ${cashback} credited to seller {order.seller_id}")


def _credit_buyer_loyalty(order: PhysicalOrder):
    """Credit loyalty points (1% of spend) to buyer; grant free credit milestones."""
    wallet = _get_or_create_buyer_wallet(order.buyer_id)
    loyalty_credit = round(order.total_amount * 0.01, 2)
    wallet.loyalty_balance += loyalty_credit
    wallet.total_spent += order.total_amount
    wallet.total_earned += loyalty_credit
    order.buyer_loyalty_points = loyalty_credit

    # Milestone: every $500 spent → $10 free product credit
    milestones_before = int((wallet.total_spent - order.total_amount) / LOYALTY_FREE_THRESHOLD)
    milestones_after = int(wallet.total_spent / LOYALTY_FREE_THRESHOLD)
    if milestones_after > milestones_before:
        new_credits = milestones_after - milestones_before
        wallet.free_product_credits += new_credits
        logger.info(f"Buyer {order.buyer_id} earned {new_credits} free product credit(s)")


# ─────────────────────── ROUTES ───────────────────────────────────────────────

@physical_bp.route('/categories', methods=['GET'])
def get_categories():
    return jsonify({
        'categories': PHYSICAL_CATEGORIES,
        'sizes': CLOTHING_SIZES,
        'colors': STANDARD_COLORS,
    }), 200


@physical_bp.route('/products', methods=['GET'])
def list_products():
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 24)), 60)
        category = request.args.get('category', '').strip()
        search = request.args.get('search', '').strip()
        sort = request.args.get('sort', 'newest')
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        condition = request.args.get('condition', '').strip()
        free_shipping = request.args.get('free_shipping', '').lower() == 'true'
        ships_intl = request.args.get('ships_internationally', '').lower() == 'true'
        in_stock_only = request.args.get('in_stock', '').lower() == 'true'

        q = PhysicalProduct.query.filter(
            PhysicalProduct.is_active == True,
            PhysicalProduct.is_approved == True,
        )

        if category:
            q = q.filter(PhysicalProduct.category == category)
        if search:
            q = q.filter(
                db.or_(
                    PhysicalProduct.title.ilike(f'%{search}%'),
                    PhysicalProduct.description.ilike(f'%{search}%'),
                    PhysicalProduct.tags.ilike(f'%{search}%'),
                    PhysicalProduct.brand.ilike(f'%{search}%'),
                )
            )
        if condition:
            q = q.filter(PhysicalProduct.condition == condition)
        if free_shipping:
            q = q.filter(PhysicalProduct.shipping_cost == 0)
        if ships_intl:
            q = q.filter(PhysicalProduct.ships_internationally == True)
        if in_stock_only:
            q = q.filter(PhysicalProduct.stock_quantity > 0)
        if min_price is not None:
            q = q.filter(PhysicalProduct.price >= min_price)
        if max_price is not None:
            q = q.filter(PhysicalProduct.price <= max_price)

        if sort == 'price_asc':
            q = q.order_by(PhysicalProduct.price.asc())
        elif sort == 'price_desc':
            q = q.order_by(PhysicalProduct.price.desc())
        elif sort == 'popular':
            q = q.order_by(PhysicalProduct.sale_count.desc())
        elif sort == 'top_rated':
            q = q.order_by(PhysicalProduct.view_count.desc())  # Approximate
        elif sort == 'featured':
            q = q.order_by(PhysicalProduct.is_featured.desc(), PhysicalProduct.created_at.desc())
        else:  # newest
            q = q.order_by(PhysicalProduct.created_at.desc())

        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'products': [p.to_dict() for p in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
            'per_page': per_page,
        }), 200
    except Exception as e:
        logger.exception('list_physical_products error')
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/products/<product_id>', methods=['GET'])
def get_product(product_id):
    try:
        product = PhysicalProduct.query.get(product_id)
        if not product or not product.is_active:
            return jsonify({'error': 'Product not found'}), 404
        product.view_count = (product.view_count or 0) + 1
        db.session.commit()
        return jsonify(product.to_dict(full=True)), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/products', methods=['POST'])
@jwt_required()
def create_product():
    """Seller creates a physical product listing."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        required = ['title', 'price', 'category']
        for f in required:
            if not data.get(f):
                return jsonify({'error': f'{f} is required'}), 400

        if float(data['price']) < 0:
            return jsonify({'error': 'Price must be positive'}), 400

        product = PhysicalProduct(
            seller_id=user_id,
            title=data['title'].strip()[:255],
            description=data.get('description', ''),
            category=data.get('category', 'Other'),
            subcategory=data.get('subcategory'),
            brand=data.get('brand'),
            sku=data.get('sku'),
            price=float(data['price']),
            original_price=float(data['original_price']) if data.get('original_price') else None,
            currency=data.get('currency', 'USD'),
            stock_quantity=int(data.get('stock_quantity', 0)),
            track_inventory=data.get('track_inventory', True),
            allow_backorder=data.get('allow_backorder', False),
            condition=data.get('condition', 'new'),
            weight_kg=float(data['weight_kg']) if data.get('weight_kg') else None,
            length_cm=float(data['length_cm']) if data.get('length_cm') else None,
            width_cm=float(data['width_cm']) if data.get('width_cm') else None,
            height_cm=float(data['height_cm']) if data.get('height_cm') else None,
            ships_from_country=data.get('ships_from_country'),
            ships_from_city=data.get('ships_from_city'),
            shipping_cost=float(data.get('shipping_cost', 0)),
            free_shipping_min=float(data['free_shipping_min']) if data.get('free_shipping_min') else None,
            estimated_delivery_days=int(data.get('estimated_delivery_days', 7)),
            ships_internationally=data.get('ships_internationally', False),
            returns_accepted=data.get('returns_accepted', True),
            return_days=int(data.get('return_days', 14)),
            return_policy=data.get('return_policy'),
            tags=','.join(data['tags']) if isinstance(data.get('tags'), list) else data.get('tags', ''),
            images_json=json.dumps(data.get('images', [])),
            thumbnail_url=data.get('thumbnail_url') or (data['images'][0] if data.get('images') else None),
            has_variants=bool(data.get('variants')),
            bulk_discount_json=json.dumps(data.get('bulk_discounts', [])),
        )
        db.session.add(product)
        db.session.flush()

        # Create variants if provided
        for v in data.get('variants', []):
            variant = PhysicalProductVariant(
                product_id=product.id,
                size=v.get('size'),
                color=v.get('color'),
                material=v.get('material'),
                extra_attributes=json.dumps(v.get('extra', {})) if v.get('extra') else None,
                sku=v.get('sku'),
                price_modifier=float(v.get('price_modifier', 0)),
                stock_quantity=int(v.get('stock_quantity', 0)),
                image_url=v.get('image_url'),
            )
            db.session.add(variant)

        db.session.commit()
        return jsonify({'success': True, 'product': product.to_dict(full=True)}), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('create_physical_product error')
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/products/<product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = PhysicalProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        if product.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        data = request.get_json() or {}
        updatable = [
            'title', 'description', 'category', 'subcategory', 'brand', 'sku',
            'price', 'original_price', 'stock_quantity', 'allow_backorder',
            'condition', 'weight_kg', 'shipping_cost', 'free_shipping_min',
            'estimated_delivery_days', 'ships_internationally', 'returns_accepted',
            'return_days', 'return_policy', 'ships_from_country', 'ships_from_city',
        ]
        for field in updatable:
            if field in data:
                setattr(product, field, data[field])

        if 'images' in data:
            product.images_json = json.dumps(data['images'])
            if data['images']:
                product.thumbnail_url = data['images'][0]
        if 'tags' in data:
            product.tags = ','.join(data['tags']) if isinstance(data['tags'], list) else data['tags']
        if 'bulk_discounts' in data:
            product.bulk_discount_json = json.dumps(data['bulk_discounts'])

        db.session.commit()
        return jsonify({'success': True, 'product': product.to_dict(full=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/products/<product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = PhysicalProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        if product.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        product.is_active = False  # Soft delete
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/products/<product_id>/upload-image', methods=['POST'])
@jwt_required()
def upload_product_image(product_id):
    """Upload a product image. Returns the URL."""
    try:
        user_id = get_jwt_identity()
        product = PhysicalProduct.query.get(product_id)
        if not product or product.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        file = request.files['image']
        if not file.filename:
            return jsonify({'error': 'Empty filename'}), 400

        ext = file.filename.rsplit('.', 1)[-1].lower()
        if ext not in {'jpg', 'jpeg', 'png', 'webp', 'gif'}:
            return jsonify({'error': 'Only jpg/jpeg/png/webp/gif allowed'}), 400

        filename = f"{uuid.uuid4().hex}.{ext}"
        filepath = os.path.join(UPLOAD_DIR, filename)
        file.save(filepath)

        url = f"/uploads/physical/{filename}"
        return jsonify({'success': True, 'url': url}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Orders ─────────────────────────────────────────────────────────────────────

@physical_bp.route('/orders', methods=['POST'])
@jwt_required()
def create_order():
    """
    Create an order. Payment provider will call /orders/<id>/confirm-payment
    after capturing funds.
    """
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}

        product_id = data.get('product_id')
        if not product_id:
            return jsonify({'error': 'product_id is required'}), 400

        product = PhysicalProduct.query.get(product_id)
        if not product or not product.is_active:
            return jsonify({'error': 'Product not found or unavailable'}), 404
        if product.seller_id == user_id:
            return jsonify({'error': 'Cannot buy your own product'}), 400

        quantity = max(1, int(data.get('quantity', 1)))
        variant_id = data.get('variant_id')

        # Check stock
        if product.track_inventory:
            if variant_id:
                variant = PhysicalProductVariant.query.get(variant_id)
                if not variant or variant.product_id != product_id:
                    return jsonify({'error': 'Invalid variant'}), 400
                available_stock = variant.stock_quantity
            else:
                available_stock = product.stock_quantity

            if available_stock < quantity and not product.allow_backorder:
                return jsonify({'error': f'Only {available_stock} in stock'}), 400

        # Check shipping address
        required_address = ['shipping_name', 'shipping_address_line1', 'shipping_city',
                             'shipping_country']
        for f in required_address:
            if not data.get(f):
                return jsonify({'error': f'{f} is required for shipping'}), 400

        # Calculate price
        unit_price = product.price
        if variant_id:
            variant = PhysicalProductVariant.query.get(variant_id)
            if variant:
                unit_price += variant.price_modifier

        # Bulk discount
        discount_pct = 0.0
        if product.bulk_discount_json:
            bulk = json.loads(product.bulk_discount_json)
            for tier in sorted(bulk, key=lambda x: x.get('qty', 0), reverse=True):
                if quantity >= tier.get('qty', 999999):
                    discount_pct = tier.get('discount', 0)
                    break

        subtotal = unit_price * quantity
        discount_amount = round(subtotal * discount_pct, 2)
        subtotal_after_discount = subtotal - discount_amount

        # Loyalty wallet discount
        loyalty_discount = 0.0
        if data.get('use_loyalty_credit'):
            buyer_wallet = _get_or_create_buyer_wallet(user_id)
            loyalty_discount = min(buyer_wallet.loyalty_balance, subtotal_after_discount)
            loyalty_discount = round(loyalty_discount, 2)
            discount_amount += loyalty_discount
            buyer_wallet.loyalty_balance -= loyalty_discount
            db.session.flush()

        shipping = product.shipping_cost
        if product.free_shipping_min and subtotal_after_discount >= product.free_shipping_min:
            shipping = 0.0

        platform_fee = round(subtotal_after_discount * PLATFORM_FEE_RATE, 2)
        total = round(subtotal_after_discount - loyalty_discount + shipping, 2)
        if total < 0:
            total = 0.0

        order = PhysicalOrder(
            order_number=_gen_order_number(),
            buyer_id=user_id,
            seller_id=product.seller_id,
            product_id=product_id,
            variant_id=variant_id,
            quantity=quantity,
            unit_price=unit_price,
            shipping_cost=shipping,
            discount_amount=discount_amount,
            platform_fee=platform_fee,
            total_amount=total,
            currency=data.get('currency', product.currency),
            payment_provider=data.get('payment_provider', 'stripe'),
            status='awaiting_payment',
            escrow_status='held',
            # Shipping
            shipping_name=data['shipping_name'],
            shipping_address_line1=data['shipping_address_line1'],
            shipping_address_line2=data.get('shipping_address_line2'),
            shipping_city=data['shipping_city'],
            shipping_state=data.get('shipping_state'),
            shipping_zip=data.get('shipping_zip'),
            shipping_country=data['shipping_country'],
            shipping_phone=data.get('shipping_phone'),
            buyer_note=data.get('buyer_note'),
        )
        db.session.add(order)
        db.session.commit()

        return jsonify({'success': True, 'order': order.to_dict(full=True)}), 201
    except Exception as e:
        db.session.rollback()
        logger.exception('create_order error')
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/confirm-payment', methods=['POST'])
@jwt_required()
def confirm_payment(order_id):
    """Called after successful payment capture. Moves order to 'paid' and starts escrow."""
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.buyer_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if order.payment_status == 'paid':
            return jsonify({'order': order.to_dict(full=True)}), 200  # Idempotent

        data = request.get_json() or {}
        order.payment_ref = data.get('payment_ref') or data.get('payment_intent_id') or data.get('transaction_id')
        order.payment_status = 'paid'
        order.status = 'paid'
        order.escrow_held_at = datetime.utcnow()

        # Deduct stock
        product = PhysicalProduct.query.get(order.product_id)
        if product and product.track_inventory:
            if order.variant_id:
                variant = PhysicalProductVariant.query.get(order.variant_id)
                if variant:
                    variant.stock_quantity = max(0, variant.stock_quantity - order.quantity)
            else:
                product.stock_quantity = max(0, product.stock_quantity - order.quantity)
            product.sale_count = (product.sale_count or 0) + order.quantity

        # Update seller pending balance
        seller_wallet = _get_or_create_seller_wallet(order.seller_id)
        seller_wallet.pending_balance += order.seller_payout_amount()

        # Credit buyer loyalty points
        _credit_buyer_loyalty(order)

        db.session.commit()

        return jsonify({'success': True, 'order': order.to_dict(full=True)}), 200
    except Exception as e:
        db.session.rollback()
        logger.exception('confirm_payment error')
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/ship', methods=['POST'])
@jwt_required()
def ship_order(order_id):
    """Seller marks order as shipped with tracking information."""
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if order.status not in ('paid', 'processing'):
            return jsonify({'error': f'Cannot ship order with status: {order.status}'}), 400

        data = request.get_json() or {}
        if not data.get('tracking_number'):
            return jsonify({'error': 'tracking_number is required'}), 400

        order.tracking_number = data['tracking_number']
        order.tracking_carrier = data.get('tracking_carrier', 'Other')
        order.tracking_url = data.get('tracking_url')
        order.status = 'shipped'
        order.shipped_at = datetime.utcnow()
        order.seller_note = data.get('seller_note')
        db.session.commit()

        return jsonify({'success': True, 'order': order.to_dict(full=True)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/confirm-delivery', methods=['POST'])
@jwt_required()
def confirm_delivery(order_id):
    """Buyer confirms delivery — releases escrow immediately."""
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.buyer_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if order.status not in ('shipped', 'delivered'):
            return jsonify({'error': 'Order not yet shipped'}), 400
        if order.escrow_status == 'released':
            return jsonify({'order': order.to_dict()}), 200

        order.status = 'completed'
        order.delivered_at = order.delivered_at or datetime.utcnow()
        order.escrow_status = 'released'
        order.escrow_released_at = datetime.utcnow()

        # Release escrow → move from pending to available + credit cashback
        seller_wallet = _get_or_create_seller_wallet(order.seller_id)
        payout = order.seller_payout_amount()
        seller_wallet.pending_balance = max(0, seller_wallet.pending_balance - payout)
        _credit_seller_cashback(order)

        db.session.commit()
        return jsonify({'success': True, 'order': order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/auto-release-check', methods=['POST'])
@jwt_required()
def auto_release_check(order_id):
    """
    Check if escrow should auto-release (5 days after shipping with no dispute).
    Called by frontend polling or scheduled task.
    """
    try:
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.escrow_status != 'held':
            return jsonify({'escrow_status': order.escrow_status}), 200
        if order.payment_status != 'paid':
            return jsonify({'escrow_status': 'held'}), 200

        # Auto-release 5 days after shipping (or 7 days after payment if not yet shipped)
        release_reference = order.shipped_at or order.escrow_held_at
        if not release_reference:
            return jsonify({'escrow_status': 'held'}), 200

        auto_release_at = release_reference + timedelta(days=ESCROW_HOLD_DAYS)
        if datetime.utcnow() >= auto_release_at:
            order.status = 'completed'
            order.delivered_at = order.delivered_at or datetime.utcnow()
            order.escrow_status = 'released'
            order.escrow_released_at = datetime.utcnow()

            seller_wallet = _get_or_create_seller_wallet(order.seller_id)
            payout = order.seller_payout_amount()
            seller_wallet.pending_balance = max(0, seller_wallet.pending_balance - payout)
            _credit_seller_cashback(order)

            db.session.commit()
            return jsonify({'escrow_status': 'released', 'auto_released': True}), 200

        return jsonify({
            'escrow_status': 'held',
            'auto_release_at': auto_release_at.isoformat(),
            'days_remaining': (auto_release_at - datetime.utcnow()).days,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Orders listing ─────────────────────────────────────────────────────────────

@physical_bp.route('/orders', methods=['GET'])
@jwt_required()
def get_orders():
    """Get buyer or seller orders."""
    try:
        user_id = get_jwt_identity()
        role = request.args.get('role', 'buyer')  # buyer | seller
        status_filter = request.args.get('status', '').strip()
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 50)

        if role == 'seller':
            q = PhysicalOrder.query.filter_by(seller_id=user_id)
        else:
            q = PhysicalOrder.query.filter_by(buyer_id=user_id)

        if status_filter:
            q = q.filter(PhysicalOrder.status == status_filter)

        q = q.order_by(PhysicalOrder.created_at.desc())
        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        orders_with_products = []
        for o in paginated.items:
            od = o.to_dict(full=(o.buyer_id == user_id))
            product = PhysicalProduct.query.get(o.product_id)
            od['product_title'] = product.title if product else None
            od['product_thumbnail'] = product.thumbnail_url if product else None
            if o.variant_id:
                variant = PhysicalProductVariant.query.get(o.variant_id)
                od['variant'] = variant.to_dict() if variant else None
            orders_with_products.append(od)

        return jsonify({
            'orders': orders_with_products,
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>', methods=['GET'])
@jwt_required()
def get_order(order_id):
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.buyer_id != user_id and order.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        od = order.to_dict(full=True)
        product = PhysicalProduct.query.get(order.product_id)
        od['product'] = product.to_dict() if product else None
        return jsonify(od), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Disputes ───────────────────────────────────────────────────────────────────

@physical_bp.route('/orders/<order_id>/dispute', methods=['POST'])
@jwt_required()
def open_dispute(order_id):
    """Buyer opens a dispute — holds escrow and notifies seller."""
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.buyer_id != user_id:
            return jsonify({'error': 'Only buyer can open a dispute'}), 403
        if order.status in ('completed', 'cancelled', 'refunded'):
            return jsonify({'error': f'Cannot dispute a {order.status} order'}), 400

        # Check dispute window: must be within 30 days of delivery or 45 days of order
        if order.delivered_at:
            cutoff = order.delivered_at + timedelta(days=30)
        else:
            cutoff = order.created_at + timedelta(days=45)
        if datetime.utcnow() > cutoff:
            return jsonify({'error': 'Dispute window has closed'}), 400

        existing = PhysicalDispute.query.filter_by(
            order_id=order_id, status='open'
        ).first()
        if existing:
            return jsonify({'error': 'A dispute is already open for this order'}), 409

        data = request.get_json() or {}
        if not data.get('reason') or not data.get('buyer_statement'):
            return jsonify({'error': 'reason and buyer_statement are required'}), 400

        dispute = PhysicalDispute(
            order_id=order_id,
            buyer_id=user_id,
            seller_id=order.seller_id,
            reason=data['reason'],
            buyer_statement=data['buyer_statement'],
            evidence_json=json.dumps(data.get('evidence', [])),
            seller_respond_deadline=datetime.utcnow() + timedelta(hours=48),
        )
        db.session.add(dispute)

        # Freeze escrow
        order.escrow_status = 'disputed'
        order.status = 'disputed'

        db.session.commit()
        return jsonify({'success': True, 'dispute': dispute.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/disputes/<dispute_id>/respond', methods=['POST'])
@jwt_required()
def respond_dispute(dispute_id):
    """Seller responds to dispute."""
    try:
        user_id = get_jwt_identity()
        dispute = PhysicalDispute.query.get(dispute_id)
        if not dispute:
            return jsonify({'error': 'Dispute not found'}), 404
        if dispute.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if dispute.status != 'open':
            return jsonify({'error': f'Dispute is {dispute.status}'}), 400

        data = request.get_json() or {}
        if not data.get('seller_response'):
            return jsonify({'error': 'seller_response is required'}), 400

        dispute.seller_response = data['seller_response']
        dispute.status = 'seller_responded'
        db.session.commit()
        return jsonify({'success': True, 'dispute': dispute.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/disputes/<dispute_id>/resolve', methods=['POST'])
@jwt_required()
def resolve_dispute(dispute_id):
    """
    Admin (or auto-resolver) resolves dispute.
    outcome: 'buyer' → full refund | 'seller' → release escrow
    """
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not getattr(user, 'is_admin', False):
            # Allow buyer to request refund if seller missed deadline
            dispute = PhysicalDispute.query.get(dispute_id)
            if not dispute:
                return jsonify({'error': 'Dispute not found'}), 404
            if dispute.buyer_id != user_id:
                return jsonify({'error': 'Forbidden — admin only'}), 403
            # Check if seller missed 48h deadline
            if dispute.seller_respond_deadline and datetime.utcnow() < dispute.seller_respond_deadline:
                return jsonify({'error': 'Seller still has time to respond'}), 400
            if dispute.status not in ('open', 'seller_responded'):
                return jsonify({'error': f'Dispute is {dispute.status}'}), 400
            # Auto-resolve in buyer's favor since seller missed deadline
            outcome = 'buyer'
        else:
            dispute = PhysicalDispute.query.get(dispute_id)
            if not dispute:
                return jsonify({'error': 'Dispute not found'}), 404
            data = request.get_json() or {}
            outcome = data.get('outcome', 'buyer')  # 'buyer' | 'seller'

        order = PhysicalOrder.query.get(dispute.order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404

        if outcome == 'buyer':
            # Full refund to buyer
            order.status = 'refunded'
            order.payment_status = 'refunded'
            order.escrow_status = 'refunded'
            dispute.refund_amount = order.total_amount
            # Restore stock
            product = PhysicalProduct.query.get(order.product_id)
            if product and product.track_inventory:
                if order.variant_id:
                    variant = PhysicalProductVariant.query.get(order.variant_id)
                    if variant:
                        variant.stock_quantity += order.quantity
                else:
                    product.stock_quantity += order.quantity

            # Deduct pending from seller wallet
            seller_wallet = _get_or_create_seller_wallet(order.seller_id)
            seller_wallet.pending_balance = max(0, seller_wallet.pending_balance - order.seller_payout_amount())
            dispute.status = 'resolved_buyer'
        else:
            # Release escrow to seller
            order.status = 'completed'
            order.escrow_status = 'released'
            order.escrow_released_at = datetime.utcnow()
            seller_wallet = _get_or_create_seller_wallet(order.seller_id)
            payout = order.seller_payout_amount()
            seller_wallet.pending_balance = max(0, seller_wallet.pending_balance - payout)
            _credit_seller_cashback(order)
            dispute.status = 'resolved_seller'

        dispute.resolution = f"Resolved in favor of {'buyer (refund issued)' if outcome == 'buyer' else 'seller (funds released)'}"
        db.session.commit()
        return jsonify({'success': True, 'dispute': dispute.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Wallet & Loyalty ───────────────────────────────────────────────────────────

@physical_bp.route('/wallet/seller', methods=['GET'])
@jwt_required()
def get_seller_wallet():
    try:
        user_id = get_jwt_identity()
        wallet = _get_or_create_seller_wallet(user_id)
        db.session.commit()

        # Recent orders for context
        recent = PhysicalOrder.query.filter_by(
            seller_id=user_id
        ).order_by(PhysicalOrder.created_at.desc()).limit(5).all()

        return jsonify({
            'wallet': wallet.to_dict(),
            'recent_orders': [o.to_dict() for o in recent],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/wallet/buyer', methods=['GET'])
@jwt_required()
def get_buyer_wallet():
    try:
        user_id = get_jwt_identity()
        wallet = _get_or_create_buyer_wallet(user_id)
        db.session.commit()

        next_milestone = LOYALTY_FREE_THRESHOLD - (wallet.total_spent % LOYALTY_FREE_THRESHOLD)
        return jsonify({
            'wallet': wallet.to_dict(),
            'next_free_credit_in': round(next_milestone, 2),
            'loyalty_threshold': LOYALTY_FREE_THRESHOLD,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Reviews ────────────────────────────────────────────────────────────────────

@physical_bp.route('/products/<product_id>/reviews', methods=['GET'])
def get_reviews(product_id):
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 50)
        reviews = PhysicalReview.query.filter_by(product_id=product_id)\
            .order_by(PhysicalReview.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            'reviews': [r.to_dict() for r in reviews.items],
            'total': reviews.total,
            'pages': reviews.pages,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/review', methods=['POST'])
@jwt_required()
def post_review(order_id):
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order:
            return jsonify({'error': 'Order not found'}), 404
        if order.buyer_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if order.status not in ('completed', 'delivered'):
            return jsonify({'error': 'Can only review completed orders'}), 400

        existing = PhysicalReview.query.filter_by(
            order_id=order_id, reviewer_id=user_id
        ).first()
        if existing:
            return jsonify({'error': 'Already reviewed this order'}), 409

        data = request.get_json() or {}
        rating = int(data.get('rating', 0))
        if not 1 <= rating <= 5:
            return jsonify({'error': 'Rating must be 1-5'}), 400

        review = PhysicalReview(
            product_id=order.product_id,
            order_id=order_id,
            reviewer_id=user_id,
            rating=rating,
            title=data.get('title', '')[:255],
            body=data.get('body', ''),
            images_json=json.dumps(data.get('images', [])),
            is_verified_purchase=True,
        )
        db.session.add(review)
        db.session.commit()
        return jsonify({'success': True, 'review': review.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Wishlist ───────────────────────────────────────────────────────────────────

@physical_bp.route('/products/<product_id>/wishlist', methods=['POST'])
@jwt_required()
def toggle_wishlist(product_id):
    try:
        user_id = get_jwt_identity()
        product = PhysicalProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404
        # Simple counter toggle (full wishlist table can be added for production)
        product.wishlist_count = max(0, (product.wishlist_count or 0) + 1)
        db.session.commit()
        return jsonify({'success': True, 'wishlist_count': product.wishlist_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Seller stats ───────────────────────────────────────────────────────────────

@physical_bp.route('/seller/stats', methods=['GET'])
@jwt_required()
def get_seller_stats():
    try:
        user_id = get_jwt_identity()
        products = PhysicalProduct.query.filter_by(
            seller_id=user_id, is_active=True
        ).all()

        total_sales = sum(p.sale_count for p in products)
        total_views = sum(p.view_count for p in products)

        orders = PhysicalOrder.query.filter_by(seller_id=user_id).all()
        total_revenue = sum(o.seller_payout_amount() for o in orders if o.payment_status == 'paid')
        pending_orders = [o for o in orders if o.status in ('paid', 'processing')]
        shipped_orders = [o for o in orders if o.status == 'shipped']

        wallet = _get_or_create_seller_wallet(user_id)
        db.session.commit()

        return jsonify({
            'total_products': len(products),
            'total_sales': total_sales,
            'total_views': total_views,
            'total_revenue': round(total_revenue, 2),
            'pending_orders': len(pending_orders),
            'shipped_orders': len(shipped_orders),
            'wallet': wallet.to_dict(),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Payment initiation for physical orders ─────────────────────────────────────

@physical_bp.route('/orders/<order_id>/payment/stripe', methods=['POST'])
@jwt_required()
def create_stripe_payment(order_id):
    """Create a Stripe PaymentIntent for a physical order."""
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if not stripe_lib.api_key:
            return jsonify({'error': 'Stripe not configured'}), 503

        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order or order.buyer_id != user_id:
            return jsonify({'error': 'Order not found'}), 404
        if order.payment_status == 'paid':
            return jsonify({'error': 'Already paid'}), 400

        product = PhysicalProduct.query.get(order.product_id)
        user = User.query.get(user_id)

        amount_cents = int(round(order.total_amount * 100))

        intent = stripe_lib.PaymentIntent.create(
            amount=amount_cents,
            currency=order.currency.lower(),
            metadata={
                'order_id': order.id,
                'buyer_id': user_id,
                'seller_id': order.seller_id,
                'product_title': product.title if product else '',
            },
            receipt_email=user.email if user and user.email else None,
            description=f"VipChat order #{order.order_number}: {product.title if product else 'physical goods'}",
        )

        order.payment_ref = intent.id
        db.session.commit()

        return jsonify({
            'client_secret': intent.client_secret,
            'payment_intent_id': intent.id,
            'amount': order.total_amount,
            'currency': order.currency,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/payment/paypal', methods=['POST'])
@jwt_required()
def create_paypal_payment(order_id):
    """Create a PayPal order for a physical order."""
    try:
        import requests as http
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order or order.buyer_id != user_id:
            return jsonify({'error': 'Order not found'}), 404
        if order.payment_status == 'paid':
            return jsonify({'error': 'Already paid'}), 400

        client_id = current_app.config.get('PAYPAL_CLIENT_ID', os.environ.get('PAYPAL_CLIENT_ID', ''))
        client_secret = current_app.config.get('PAYPAL_CLIENT_SECRET', os.environ.get('PAYPAL_CLIENT_SECRET', ''))
        if not client_id or not client_secret:
            return jsonify({'error': 'PayPal not configured'}), 503

        product = PhysicalProduct.query.get(order.product_id)
        sandbox = os.environ.get('PAYPAL_SANDBOX', 'true').lower() == 'true'
        base = 'https://api-m.sandbox.paypal.com' if sandbox else 'https://api-m.paypal.com'

        # Get token
        token_resp = http.post(
            f'{base}/v1/oauth2/token',
            data='grant_type=client_credentials',
            auth=(client_id, client_secret),
            headers={'Content-Type': 'application/x-www-form-urlencoded'},
            timeout=15,
        )
        if token_resp.status_code != 200:
            return jsonify({'error': 'PayPal auth failed'}), 502
        access_token = token_resp.json()['access_token']

        # Create order
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {access_token}',
        }
        payload = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'reference_id': order.id,
                'description': f"Order #{order.order_number}: {product.title if product else 'Goods'}",
                'amount': {
                    'currency_code': order.currency.upper(),
                    'value': f'{order.total_amount:.2f}',
                },
            }],
        }
        pp_resp = http.post(f'{base}/v2/checkout/orders', json=payload, headers=headers, timeout=15)
        if pp_resp.status_code not in (200, 201):
            return jsonify({'error': f'PayPal order creation failed: {pp_resp.text}'}), 502

        pp_order = pp_resp.json()
        order.payment_ref = pp_order['id']
        db.session.commit()

        return jsonify({
            'paypal_order_id': pp_order['id'],
            'status': pp_order['status'],
            'amount': order.total_amount,
            'currency': order.currency,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/payment/flutterwave', methods=['POST'])
@jwt_required()
def create_flutterwave_payment(order_id):
    """Initialize Flutterwave inline payment for a physical order."""
    try:
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order or order.buyer_id != user_id:
            return jsonify({'error': 'Order not found'}), 404
        if order.payment_status == 'paid':
            return jsonify({'error': 'Already paid'}), 400

        fw_public = current_app.config.get('FLUTTERWAVE_PUBLIC_KEY', '')
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
        if not fw_public or not fw_secret:
            return jsonify({'error': 'Flutterwave not configured'}), 503

        user = User.query.get(user_id)
        product = PhysicalProduct.query.get(order.product_id)
        tx_ref = f'vp-{order.order_number}-{uuid.uuid4().hex[:6]}'
        order.payment_ref = tx_ref
        db.session.commit()

        return jsonify({
            'public_key': fw_public,
            'tx_ref': tx_ref,
            'amount': order.total_amount,
            'currency': order.currency.upper(),
            'customer_email': (user.email if user and user.email else 'buyer@vipchat.app'),
            'customer_name': user.full_name if user else 'Buyer',
            'customer_phone': user.phone_number if user else '',
            'meta': {'order_id': order.id},
            'description': f"Order #{order.order_number}: {product.title if product else 'Goods'}",
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@physical_bp.route('/orders/<order_id>/payment/flutterwave/verify', methods=['POST'])
@jwt_required()
def verify_flutterwave_payment(order_id):
    """Verify Flutterwave payment after inline success callback."""
    try:
        import requests as http
        user_id = get_jwt_identity()
        order = PhysicalOrder.query.get(order_id)
        if not order or order.buyer_id != user_id:
            return jsonify({'error': 'Order not found'}), 404

        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
        if not fw_secret:
            return jsonify({'error': 'Flutterwave not configured'}), 503

        data = request.get_json() or {}
        tx_ref = data.get('tx_ref') or order.payment_ref

        headers = {'Authorization': f'Bearer {fw_secret}'}
        resp = http.get(
            f'https://api.flutterwave.com/v3/transactions?tx_ref={tx_ref}',
            headers=headers, timeout=15,
        )
        if resp.status_code != 200:
            return jsonify({'error': 'Could not verify with Flutterwave'}), 502

        transactions = resp.json().get('data', [])
        if not transactions:
            return jsonify({'verified': False, 'error': 'Transaction not found'}), 200

        tx = transactions[0]
        if tx.get('status') != 'successful':
            return jsonify({'verified': False, 'error': f"Transaction status: {tx.get('status')}"}), 200

        # Amount check
        if abs(float(tx.get('amount', 0)) - order.total_amount) > 0.01:
            return jsonify({'verified': False, 'error': 'Amount mismatch'}), 200

        # Confirm payment
        order.payment_ref = tx_ref
        order.payment_status = 'paid'
        order.status = 'paid'
        order.escrow_held_at = datetime.utcnow()

        product = PhysicalProduct.query.get(order.product_id)
        if product and product.track_inventory:
            if order.variant_id:
                variant = PhysicalProductVariant.query.get(order.variant_id)
                if variant:
                    variant.stock_quantity = max(0, variant.stock_quantity - order.quantity)
            else:
                product.stock_quantity = max(0, product.stock_quantity - order.quantity)
            product.sale_count = (product.sale_count or 0) + order.quantity

        seller_wallet = _get_or_create_seller_wallet(order.seller_id)
        seller_wallet.pending_balance += order.seller_payout_amount()
        _credit_buyer_loyalty(order)

        db.session.commit()
        return jsonify({'verified': True, 'order': order.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Stripe webhook for physical orders ────────────────────────────────────────

@physical_bp.route('/stripe/webhook', methods=['POST'])
def stripe_webhook_physical():
    """Process Stripe PaymentIntent webhooks for physical orders."""
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        webhook_secret = current_app.config.get('STRIPE_PHYSICAL_WEBHOOK_SECRET',
                                                  current_app.config.get('STRIPE_WEBHOOK_SECRET', ''))

        payload = request.get_data()
        sig = request.headers.get('Stripe-Signature', '')

        if webhook_secret:
            try:
                event = stripe_lib.Webhook.construct_event(payload, sig, webhook_secret)
            except Exception as e:
                return jsonify({'error': str(e)}), 400
        else:
            event = json.loads(payload)

        etype = event.get('type', '')

        if etype == 'payment_intent.succeeded':
            pi = event['data']['object']
            order_id = pi.get('metadata', {}).get('order_id')
            if order_id:
                order = PhysicalOrder.query.get(order_id)
                if order and order.payment_status != 'paid':
                    order.payment_status = 'paid'
                    order.status = 'paid'
                    order.payment_ref = pi['id']
                    order.escrow_held_at = datetime.utcnow()

                    product = PhysicalProduct.query.get(order.product_id)
                    if product and product.track_inventory:
                        if order.variant_id:
                            variant = PhysicalProductVariant.query.get(order.variant_id)
                            if variant:
                                variant.stock_quantity = max(0, variant.stock_quantity - order.quantity)
                        else:
                            product.stock_quantity = max(0, product.stock_quantity - order.quantity)
                        product.sale_count = (product.sale_count or 0) + order.quantity

                    seller_wallet = _get_or_create_seller_wallet(order.seller_id)
                    seller_wallet.pending_balance += order.seller_payout_amount()
                    _credit_buyer_loyalty(order)
                    db.session.commit()

        elif etype == 'payment_intent.payment_failed':
            pi = event['data']['object']
            order_id = pi.get('metadata', {}).get('order_id')
            if order_id:
                order = PhysicalOrder.query.get(order_id)
                if order and order.payment_status == 'pending':
                    order.payment_status = 'failed'
                    order.status = 'cancelled'
                    db.session.commit()

        return jsonify({'received': True}), 200
    except Exception as e:
        logger.exception('stripe_webhook_physical error')
        return jsonify({'error': str(e)}), 500
