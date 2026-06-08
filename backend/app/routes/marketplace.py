"""
Marketplace API - Real upload, browse, buy, review, and messaging for digital goods.
"""
from flask import Blueprint, request, jsonify, current_app, send_from_directory
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from datetime import datetime
import uuid
import os
import logging

logger = logging.getLogger(__name__)
marketplace_bp = Blueprint('marketplace', __name__, url_prefix='/api/marketplace')

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads', 'marketplace')
os.makedirs(UPLOAD_DIR, exist_ok=True)
ALLOWED_EXTS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf', 'zip', 'mp3', 'mp4', 'mov', 'avi'}

CATEGORIES = ['Digital Art', 'Templates', 'Music', 'Videos', 'eBooks', 'Software', 'Courses', 'Photos', 'Other']


def _allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTS


def _safe_filename(filename):
    import re
    name = re.sub(r'[^\w\s\-.]', '', filename).strip()
    return name or 'file'


# ── Inline models (added to db via SQLAlchemy) ─────────────────────────────────

from app.models.models import db
from sqlalchemy import Column, String, Text, Float, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship

# Lazy-register marketplace tables only if not already present
import sqlalchemy as sa


class MarketplaceProduct(db.Model):
    __tablename__ = 'marketplace_products'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    seller_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default='USD')
    file_url = Column(Text, nullable=True)
    preview_url = Column(Text, nullable=True)
    thumbnail_url = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)
    download_count = Column(Integer, default=0)
    view_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_free = Column(Boolean, default=False)
    license_type = Column(String(50), default='standard')
    file_size = Column(Integer, nullable=True)
    file_type = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    seller = relationship('User', foreign_keys=[seller_id], backref='marketplace_products')
    purchases = relationship('MarketplacePurchase', backref='product', cascade='all, delete-orphan')
    reviews = relationship('MarketplaceReview', backref='product', cascade='all, delete-orphan')

    def to_dict(self, include_file=False):
        avg = 0.0
        if self.reviews:
            avg = sum(r.rating for r in self.reviews) / len(self.reviews)
        d = {
            'id': self.id,
            'seller_id': self.seller_id,
            'seller_name': self.seller.full_name if self.seller else None,
            'seller_avatar': self.seller.avatar_url if self.seller else None,
            'seller_verified': self.seller.badge_verified if self.seller else False,
            'title': self.title,
            'description': self.description,
            'category': self.category,
            'price': self.price,
            'currency': self.currency,
            'preview_url': self.preview_url,
            'thumbnail_url': self.thumbnail_url,
            'tags': self.tags.split(',') if self.tags else [],
            'download_count': self.download_count,
            'view_count': self.view_count,
            'is_active': self.is_active,
            'is_free': self.is_free,
            'license_type': self.license_type,
            'file_size': self.file_size,
            'file_type': self.file_type,
            'rating_avg': round(avg, 1),
            'rating_count': len(self.reviews),
            'created_at': self.created_at.isoformat(),
        }
        if include_file:
            d['file_url'] = self.file_url
        return d


class MarketplacePurchase(db.Model):
    __tablename__ = 'marketplace_purchases'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    buyer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=False)
    amount_paid = Column(Float, nullable=False, default=0.0)
    currency = Column(String(10), default='USD')
    payment_provider = Column(String(50), nullable=True)
    payment_ref = Column(String(255), nullable=True)
    status = Column(String(20), default='completed')
    created_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship('User', foreign_keys=[buyer_id], backref='marketplace_purchases')

    def to_dict(self):
        return {
            'id': self.id,
            'buyer_id': self.buyer_id,
            'product_id': self.product_id,
            'amount_paid': self.amount_paid,
            'currency': self.currency,
            'payment_provider': self.payment_provider,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
        }


class MarketplaceReview(db.Model):
    __tablename__ = 'marketplace_reviews'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=False)
    reviewer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    reviewer = relationship('User', foreign_keys=[reviewer_id])

    def to_dict(self):
        return {
            'id': self.id,
            'product_id': self.product_id,
            'reviewer_id': self.reviewer_id,
            'reviewer_name': self.reviewer.full_name if self.reviewer else None,
            'reviewer_avatar': self.reviewer.avatar_url if self.reviewer else None,
            'rating': self.rating,
            'comment': self.comment,
            'created_at': self.created_at.isoformat(),
        }


class MarketplaceMessage(db.Model):
    __tablename__ = 'marketplace_messages'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    sender_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    receiver_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=True)
    content = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    sender = relationship('User', foreign_keys=[sender_id])
    receiver = relationship('User', foreign_keys=[receiver_id])

    def to_dict(self):
        return {
            'id': self.id,
            'sender_id': self.sender_id,
            'sender_name': self.sender.full_name if self.sender else None,
            'sender_avatar': self.sender.avatar_url if self.sender else None,
            'receiver_id': self.receiver_id,
            'product_id': self.product_id,
            'content': self.content,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat(),
        }


# ── Routes ─────────────────────────────────────────────────────────────────────

@marketplace_bp.route('/categories', methods=['GET'])
def get_categories():
    return jsonify({'categories': CATEGORIES}), 200


@marketplace_bp.route('/products', methods=['GET'])
def list_products():
    try:
        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 20)), 50)
        category = request.args.get('category', '').strip()
        search = request.args.get('search', '').strip()
        sort = request.args.get('sort', 'newest')
        min_price = request.args.get('min_price', type=float)
        max_price = request.args.get('max_price', type=float)
        free_only = request.args.get('free', '').lower() == 'true'

        q = MarketplaceProduct.query.filter_by(is_active=True)

        if category:
            q = q.filter(MarketplaceProduct.category == category)
        if search:
            q = q.filter(
                db.or_(
                    MarketplaceProduct.title.ilike(f'%{search}%'),
                    MarketplaceProduct.description.ilike(f'%{search}%'),
                    MarketplaceProduct.tags.ilike(f'%{search}%'),
                )
            )
        if free_only:
            q = q.filter(MarketplaceProduct.is_free == True)
        if min_price is not None:
            q = q.filter(MarketplaceProduct.price >= min_price)
        if max_price is not None:
            q = q.filter(MarketplaceProduct.price <= max_price)

        if sort == 'price_asc':
            q = q.order_by(MarketplaceProduct.price.asc())
        elif sort == 'price_desc':
            q = q.order_by(MarketplaceProduct.price.desc())
        elif sort == 'popular':
            q = q.order_by(MarketplaceProduct.download_count.desc())
        else:
            q = q.order_by(MarketplaceProduct.created_at.desc())

        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        return jsonify({
            'products': [p.to_dict() for p in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
            'per_page': per_page,
        }), 200
    except Exception as e:
        logger.exception('list_products error')
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>', methods=['GET'])
def get_product(product_id):
    try:
        product = MarketplaceProduct.query.get(product_id)
        if not product or not product.is_active:
            return jsonify({'error': 'Product not found'}), 404
        product.view_count = (product.view_count or 0) + 1
        db.session.commit()
        return jsonify(product.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products', methods=['POST'])
@jwt_required()
def create_product():
    try:
        user_id = get_jwt_identity()
        data = request.form

        title = data.get('title', '').strip()
        if not title:
            return jsonify({'error': 'Title is required'}), 400

        price = float(data.get('price', 0))
        is_free = price == 0

        product = MarketplaceProduct()
        product.seller_id = user_id
        product.title = title
        product.description = data.get('description', '')
        product.category = data.get('category', 'Other')
        product.price = price
        product.currency = data.get('currency', 'USD')
        product.tags = data.get('tags', '')
        product.is_free = is_free
        product.license_type = data.get('license_type', 'standard')

        if 'file' in request.files:
            f = request.files['file']
            if f and f.filename and _allowed_file(f.filename):
                ext = f.filename.rsplit('.', 1)[1].lower()
                fname = f'{product.id or str(uuid.uuid4())}_{_safe_filename(f.filename)}'
                fpath = os.path.join(UPLOAD_DIR, fname)
                f.save(fpath)
                product.file_url = f'/uploads/marketplace/{fname}'
                product.file_type = ext
                product.file_size = os.path.getsize(fpath)

        if 'preview' in request.files:
            pf = request.files['preview']
            if pf and pf.filename:
                pext = pf.filename.rsplit('.', 1)[1].lower() if '.' in pf.filename else 'jpg'
                pfname = f'preview_{product.id or str(uuid.uuid4())}.{pext}'
                pfpath = os.path.join(UPLOAD_DIR, pfname)
                pf.save(pfpath)
                product.preview_url = f'/uploads/marketplace/{pfname}'
                product.thumbnail_url = product.preview_url

        db.session.add(product)
        db.session.commit()
        return jsonify(product.to_dict()), 201
    except Exception as e:
        logger.exception('create_product error')
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>', methods=['PUT'])
@jwt_required()
def update_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Not found'}), 404
        if product.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        data = request.get_json() or {}
        for field in ['title', 'description', 'category', 'tags', 'license_type']:
            if field in data:
                setattr(product, field, data[field])
        if 'price' in data:
            product.price = float(data['price'])
            product.is_free = product.price == 0
        if 'is_active' in data:
            product.is_active = bool(data['is_active'])

        db.session.commit()
        return jsonify(product.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>', methods=['DELETE'])
@jwt_required()
def delete_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Not found'}), 404
        user = User.query.get(user_id)
        if product.seller_id != user_id and not (user and user.is_admin):
            return jsonify({'error': 'Forbidden'}), 403
        product.is_active = False
        db.session.commit()
        return jsonify({'message': 'Product removed'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>/purchase', methods=['POST'])
@jwt_required()
def purchase_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product or not product.is_active:
            return jsonify({'error': 'Product not found'}), 404
        if product.seller_id == user_id:
            return jsonify({'error': 'Cannot buy your own product'}), 400

        existing = MarketplacePurchase.query.filter_by(
            buyer_id=user_id, product_id=product_id, status='completed'
        ).first()
        if existing:
            return jsonify({'error': 'Already purchased', 'purchase_id': existing.id}), 409

        data = request.get_json() or {}

        if product.is_free or product.price == 0:
            purchase = MarketplacePurchase()
            purchase.buyer_id = user_id
            purchase.product_id = product_id
            purchase.amount_paid = 0
            purchase.status = 'completed'
            purchase.payment_provider = 'free'
            db.session.add(purchase)
            product.download_count = (product.download_count or 0) + 1
            db.session.commit()
            return jsonify({
                'message': 'Download ready',
                'purchase': purchase.to_dict(),
                'download_url': product.file_url,
            }), 200

        payment_provider = data.get('payment_provider', 'stripe')

        if payment_provider == 'stripe':
            try:
                import stripe
                stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
                if not stripe.api_key:
                    return jsonify({'error': 'Payment not configured'}), 503

                purchase = MarketplacePurchase()
                purchase.buyer_id = user_id
                purchase.product_id = product_id
                purchase.amount_paid = product.price
                purchase.currency = product.currency
                purchase.payment_provider = 'stripe'
                purchase.status = 'pending'
                db.session.add(purchase)
                db.session.commit()

                base_url = request.host_url.rstrip('/')
                session = stripe.checkout.Session.create(
                    payment_method_types=['card'],
                    line_items=[{
                        'price_data': {
                            'currency': product.currency.lower(),
                            'product_data': {
                                'name': product.title,
                                'description': (product.description or '')[:255],
                            },
                            'unit_amount': int(product.price * 100),
                        },
                        'quantity': 1,
                    }],
                    mode='payment',
                    success_url=f'{base_url}/marketplace?purchase_success={purchase.id}',
                    cancel_url=f'{base_url}/marketplace?purchase_cancel=1',
                    metadata={
                        'purchase_id': str(purchase.id),
                        'buyer_id': str(user_id),
                        'product_id': str(product_id),
                        'type': 'marketplace',
                    },
                )
                purchase.payment_ref = session.id
                db.session.commit()
                return jsonify({'checkout_url': session.url, 'purchase_id': purchase.id}), 200
            except Exception as stripe_err:
                db.session.rollback()
                return jsonify({'error': f'Payment error: {str(stripe_err)}'}), 500

        return jsonify({'error': 'Unsupported payment provider'}), 400

    except Exception as e:
        db.session.rollback()
        logger.exception('purchase_product error')
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>/download', methods=['GET'])
@jwt_required()
def download_product(product_id):
    try:
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Not found'}), 404

        is_seller = product.seller_id == user_id
        has_purchase = MarketplacePurchase.query.filter_by(
            buyer_id=user_id, product_id=product_id, status='completed'
        ).first() is not None

        if not is_seller and not has_purchase and not product.is_free:
            return jsonify({'error': 'Purchase required'}), 403

        if not product.file_url:
            return jsonify({'error': 'No file available'}), 404

        if not is_seller:
            product.download_count = (product.download_count or 0) + 1
            db.session.commit()

        return jsonify({'download_url': product.file_url, 'filename': product.title}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>/reviews', methods=['GET'])
def get_reviews(product_id):
    try:
        reviews = MarketplaceReview.query.filter_by(product_id=product_id).order_by(
            MarketplaceReview.created_at.desc()
        ).all()
        return jsonify({'reviews': [r.to_dict() for r in reviews]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>/reviews', methods=['POST'])
@jwt_required()
def add_review(product_id):
    try:
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Not found'}), 404

        has_purchase = MarketplacePurchase.query.filter_by(
            buyer_id=user_id, product_id=product_id, status='completed'
        ).first() is not None
        if not has_purchase and not product.is_free:
            return jsonify({'error': 'Must purchase before reviewing'}), 403

        existing = MarketplaceReview.query.filter_by(product_id=product_id, reviewer_id=user_id).first()
        if existing:
            return jsonify({'error': 'Already reviewed'}), 409

        data = request.get_json() or {}
        rating = int(data.get('rating', 5))
        if rating < 1 or rating > 5:
            return jsonify({'error': 'Rating must be 1-5'}), 400

        review = MarketplaceReview()
        review.product_id = product_id
        review.reviewer_id = user_id
        review.rating = rating
        review.comment = data.get('comment', '').strip()[:1000]
        db.session.add(review)
        db.session.commit()
        return jsonify(review.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/my-products', methods=['GET'])
@jwt_required()
def my_products():
    try:
        user_id = get_jwt_identity()
        products = MarketplaceProduct.query.filter_by(seller_id=user_id).order_by(
            MarketplaceProduct.created_at.desc()
        ).all()
        return jsonify({'products': [p.to_dict(include_file=True) for p in products]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/my-purchases', methods=['GET'])
@jwt_required()
def my_purchases():
    try:
        user_id = get_jwt_identity()
        purchases = MarketplacePurchase.query.filter_by(
            buyer_id=user_id, status='completed'
        ).order_by(MarketplacePurchase.created_at.desc()).all()
        result = []
        for p in purchases:
            d = p.to_dict()
            if p.product:
                d['product'] = p.product.to_dict(include_file=True)
            result.append(d)
        return jsonify({'purchases': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/messages', methods=['GET'])
@jwt_required()
def get_messages():
    try:
        user_id = get_jwt_identity()
        other_id = request.args.get('with')
        if not other_id:
            return jsonify({'error': 'with param required'}), 400
        msgs = MarketplaceMessage.query.filter(
            db.or_(
                db.and_(MarketplaceMessage.sender_id == user_id, MarketplaceMessage.receiver_id == other_id),
                db.and_(MarketplaceMessage.sender_id == other_id, MarketplaceMessage.receiver_id == user_id),
            )
        ).order_by(MarketplaceMessage.created_at.asc()).all()
        for m in msgs:
            if m.receiver_id == user_id and not m.is_read:
                m.is_read = True
        db.session.commit()
        return jsonify({'messages': [m.to_dict() for m in msgs]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/messages', methods=['POST'])
@jwt_required()
def send_message():
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        receiver_id = data.get('receiver_id', '').strip()
        content = data.get('content', '').strip()
        product_id = data.get('product_id')
        if not receiver_id or not content:
            return jsonify({'error': 'receiver_id and content required'}), 400
        msg = MarketplaceMessage()
        msg.sender_id = user_id
        msg.receiver_id = receiver_id
        msg.product_id = product_id
        msg.content = content[:2000]
        db.session.add(msg)
        db.session.commit()
        return jsonify(msg.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/messages/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    try:
        user_id = get_jwt_identity()
        msgs = MarketplaceMessage.query.filter(
            db.or_(
                MarketplaceMessage.sender_id == user_id,
                MarketplaceMessage.receiver_id == user_id,
            )
        ).order_by(MarketplaceMessage.created_at.desc()).all()
        seen = set()
        convos = []
        for m in msgs:
            other = m.receiver_id if m.sender_id == user_id else m.sender_id
            if other not in seen:
                seen.add(other)
                other_user = User.query.get(other)
                unread = MarketplaceMessage.query.filter_by(
                    sender_id=other, receiver_id=user_id, is_read=False
                ).count()
                convos.append({
                    'user_id': other,
                    'user_name': other_user.full_name if other_user else 'Unknown',
                    'user_avatar': other_user.avatar_url if other_user else None,
                    'last_message': m.content,
                    'last_message_at': m.created_at.isoformat(),
                    'unread_count': unread,
                })
        return jsonify({'conversations': convos}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/stripe/webhook', methods=['POST'])
def stripe_webhook():
    try:
        import stripe
        stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        payload = request.get_data(as_text=True)
        sig = request.headers.get('Stripe-Signature', '')
        secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

        if secret:
            event = stripe.Webhook.construct_event(payload, sig, secret)
        else:
            import json
            event = json.loads(payload)

        if event.get('type') == 'checkout.session.completed':
            session_obj = event['data']['object']
            meta = session_obj.get('metadata', {})
            if meta.get('type') == 'marketplace':
                purchase_id = meta.get('purchase_id')
                purchase = MarketplacePurchase.query.get(purchase_id)
                if purchase:
                    purchase.status = 'completed'
                    purchase.payment_ref = session_obj.get('id')
                    if purchase.product:
                        purchase.product.download_count = (purchase.product.download_count or 0) + 1
                    db.session.commit()

        return jsonify({'received': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400
