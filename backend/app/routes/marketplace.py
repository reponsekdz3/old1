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
    wishlist_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_approved = Column(Boolean, default=True)
    is_free = Column(Boolean, default=False)
    is_featured = Column(Boolean, default=False)
    is_boosted = Column(Boolean, default=False)
    boost_expires_at = Column(DateTime, nullable=True)
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
            'is_featured': self.is_featured,
            'is_boosted': self.is_boosted,
            'wishlist_count': self.wishlist_count,
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
    payout_status = Column(String(20), default='pending')
    escrow_released_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    buyer = relationship('User', foreign_keys=[buyer_id], backref='marketplace_purchases')

    def to_dict(self):
        escrow_released = (
            self.escrow_released_at is not None
            and self.escrow_released_at <= datetime.utcnow()
        )
        return {
            'id': self.id,
            'buyer_id': self.buyer_id,
            'product_id': self.product_id,
            'amount_paid': self.amount_paid,
            'currency': self.currency,
            'payment_provider': self.payment_provider,
            'status': self.status,
            'payout_status': 'available' if escrow_released else self.payout_status,
            'escrow_released_at': self.escrow_released_at.isoformat() if self.escrow_released_at else None,
            'created_at': self.created_at.isoformat(),
        }


class MarketplaceReview(db.Model):
    __tablename__ = 'marketplace_reviews'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=False)
    reviewer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    helpful_count = Column(Integer, default=0)
    is_verified_purchase = Column(Boolean, default=False)
    is_moderated = Column(Boolean, default=False)
    seller_reply = Column(Text, nullable=True)
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
            'media_url': self.media_url,
            'helpful_count': self.helpful_count,
            'is_verified_purchase': self.is_verified_purchase,
            'is_moderated': self.is_moderated,
            'seller_reply': self.seller_reply,
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


class MarketplaceDownloadToken(db.Model):
    __tablename__ = 'marketplace_download_tokens'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    token = Column(String(128), unique=True, nullable=False)
    purchase_id = Column(String(36), ForeignKey('marketplace_purchases.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=False)
    buyer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    download_limit = Column(Integer, default=3)
    download_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    product = relationship('MarketplaceProduct', foreign_keys=[product_id])
    buyer = relationship('User', foreign_keys=[buyer_id])

    def is_valid(self):
        return self.download_count < self.download_limit and datetime.utcnow() < self.expires_at

    def to_dict(self):
        return {
            'id': self.id,
            'token': self.token,
            'product_id': self.product_id,
            'expires_at': self.expires_at.isoformat(),
            'downloads_remaining': max(0, self.download_limit - self.download_count),
            'created_at': self.created_at.isoformat(),
        }


class MarketplaceDispute(db.Model):
    __tablename__ = 'marketplace_disputes'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    buyer_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    seller_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    product_id = Column(String(36), ForeignKey('marketplace_products.id'), nullable=False)
    purchase_id = Column(String(36), ForeignKey('marketplace_purchases.id'), nullable=False)
    reason = Column(Text, nullable=False)
    buyer_statement = Column(Text, nullable=True)
    seller_statement = Column(Text, nullable=True)
    status = Column(String(30), default='open')  # open | seller_responded | resolved | closed
    resolution = Column(Text, nullable=True)
    resolved_by = Column(String(36), ForeignKey('users.id'), nullable=True)
    seller_respond_by = Column(DateTime, nullable=True)  # 48h deadline
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    buyer = relationship('User', foreign_keys=[buyer_id])
    seller = relationship('User', foreign_keys=[seller_id])
    product = relationship('MarketplaceProduct', foreign_keys=[product_id])

    def to_dict(self):
        return {
            'id': self.id,
            'buyer_id': self.buyer_id,
            'buyer_name': self.buyer.full_name if self.buyer else None,
            'seller_id': self.seller_id,
            'seller_name': self.seller.full_name if self.seller else None,
            'product_id': self.product_id,
            'product_title': self.product.title if self.product else None,
            'purchase_id': self.purchase_id,
            'reason': self.reason,
            'buyer_statement': self.buyer_statement,
            'seller_statement': self.seller_statement,
            'status': self.status,
            'resolution': self.resolution,
            'seller_respond_by': self.seller_respond_by.isoformat() if self.seller_respond_by else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
        }


def _generate_download_token(purchase_id: str, product_id: str) -> str:
    """Generate a signed HMAC-SHA256 download token."""
    import hmac as hmac_mod
    import hashlib
    import os
    secret = os.environ.get('SECRET_KEY', '')
    if not secret:
        raise RuntimeError('SECRET_KEY env var is required for download token generation')
    expiry = int((datetime.utcnow() + __import__('datetime').timedelta(hours=24)).timestamp())
    msg = f'{purchase_id}:{product_id}:{expiry}'
    sig = hmac_mod.new(secret.encode(), msg.encode(), hashlib.sha256).hexdigest()
    return f'{expiry}.{sig}'


def _deliver_purchase_async(purchase_id: str):
    """Create download token and notify buyer. Called in the same request context."""
    try:
        purchase = MarketplacePurchase.query.get(purchase_id)
        if not purchase or not purchase.product:
            return
        product = purchase.product
        if not product.file_url:
            return

        token_str = _generate_download_token(purchase_id, product.id)
        from datetime import timedelta
        dl_token = MarketplaceDownloadToken(
            token=token_str,
            purchase_id=purchase_id,
            product_id=product.id,
            buyer_id=purchase.buyer_id,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            download_limit=3,
        )
        db.session.add(dl_token)
        db.session.commit()

        # Send in-app message
        try:
            from app.models.models import Message
            from app.models.models import MessageStatus
            system_msg = Message()
            system_msg.sender_id = purchase.product.seller_id
            system_msg.receiver_id = purchase.buyer_id
            system_msg.content = (
                f'🎉 Your purchase is ready!\n\n'
                f'**{product.title}**\n\n'
                f'Download link (valid 24h, 3 downloads):\n'
                f'/api/marketplace/download/{token_str}\n\n'
                f'Enjoy your purchase!'
            )
            system_msg.status = MessageStatus.SENT
            db.session.add(system_msg)
            db.session.commit()
        except Exception:
            pass

    except Exception:
        logger.exception('_deliver_purchase_async error')


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

        q = MarketplaceProduct.query.filter(
            MarketplaceProduct.is_active == True,
            MarketplaceProduct.is_approved == True,
        )

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

        # Optional rating filter via correlated subquery
        min_rating = request.args.get('min_rating', type=float)
        seller_verified_only = request.args.get('verified_seller', '').lower() == 'true'
        if min_rating is not None:
            from sqlalchemy import select, func as sqlfunc
            avg_sq = select(sqlfunc.avg(MarketplaceReview.rating)).where(
                MarketplaceReview.product_id == MarketplaceProduct.id
            ).correlate(MarketplaceProduct).scalar_subquery()
            q = q.filter(avg_sq >= min_rating)
        if seller_verified_only:
            q = q.join(User, MarketplaceProduct.seller_id == User.id).filter(User.badge_verified == True)

        if sort == 'price_asc':
            q = q.order_by(MarketplaceProduct.price.asc())
        elif sort == 'price_desc':
            q = q.order_by(MarketplaceProduct.price.desc())
        elif sort == 'popular' or sort == 'best_seller':
            q = q.order_by(MarketplaceProduct.download_count.desc())
        elif sort == 'top_rated':
            from sqlalchemy import select, func as sqlfunc
            rating_sq = select(sqlfunc.avg(MarketplaceReview.rating)).where(
                MarketplaceReview.product_id == MarketplaceProduct.id
            ).correlate(MarketplaceProduct).scalar_subquery()
            q = q.order_by(rating_sq.desc())
        elif sort == 'featured':
            q = q.order_by(
                MarketplaceProduct.is_boosted.desc(),
                MarketplaceProduct.is_featured.desc(),
                MarketplaceProduct.created_at.desc(),
            )
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
        user = User.query.get(user_id)
        if product.seller_id != user_id and not (user and user.is_admin):
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


@marketplace_bp.route('/download/<token>', methods=['GET'])
def download_by_token(token):
    """Validate signed download token and serve or redirect to file."""
    try:
        dl = MarketplaceDownloadToken.query.filter_by(token=token).first()
        if not dl:
            return jsonify({'error': 'Invalid download token'}), 404
        if not dl.is_valid():
            return jsonify({'error': 'Download link expired or exhausted'}), 410

        dl.download_count += 1
        db.session.commit()

        product = dl.product
        if not product or not product.file_url:
            return jsonify({'error': 'File not available'}), 404

        # Serve file directly if it's a local upload path
        if product.file_url.startswith('/uploads/'):
            import os
            file_path = os.path.join(
                os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
                product.file_url.lstrip('/')
            )
            if os.path.exists(file_path):
                from flask import send_file
                return send_file(file_path, as_attachment=True,
                                 download_name=f'{product.title}.{product.file_type or "bin"}')

        from flask import redirect
        return redirect(product.file_url)

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/purchases/<purchase_id>/dispute', methods=['POST'])
@jwt_required()
def open_dispute(purchase_id):
    """Open a buyer protection dispute on a purchase."""
    try:
        user_id = get_jwt_identity()
        purchase = MarketplacePurchase.query.get(purchase_id)
        if not purchase:
            return jsonify({'error': 'Purchase not found'}), 404
        if purchase.buyer_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if purchase.status != 'completed':
            return jsonify({'error': 'Can only dispute completed purchases'}), 400

        from datetime import timedelta
        existing = MarketplaceDispute.query.filter_by(purchase_id=purchase_id).first()
        if existing:
            return jsonify({'error': 'Dispute already open', 'dispute': existing.to_dict()}), 409

        data = request.get_json() or {}
        reason = data.get('reason', '').strip()
        if not reason:
            return jsonify({'error': 'Reason is required'}), 400

        product = MarketplaceProduct.query.get(purchase.product_id)
        if not product:
            return jsonify({'error': 'Product not found'}), 404

        dispute = MarketplaceDispute(
            buyer_id=user_id,
            seller_id=product.seller_id,
            product_id=product.id,
            purchase_id=purchase_id,
            reason=reason[:1000],
            buyer_statement=data.get('statement', '').strip()[:2000],
            status='open',
            seller_respond_by=datetime.utcnow() + timedelta(hours=48),
        )
        db.session.add(dispute)
        db.session.commit()
        return jsonify({'dispute': dispute.to_dict()}), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/disputes', methods=['GET'])
@jwt_required()
def list_disputes():
    """List disputes involving the current user (as buyer or seller)."""
    try:
        user_id = get_jwt_identity()
        role = request.args.get('role', 'buyer')
        if role == 'seller':
            disputes = MarketplaceDispute.query.filter_by(seller_id=user_id).order_by(MarketplaceDispute.created_at.desc()).all()
        else:
            disputes = MarketplaceDispute.query.filter_by(buyer_id=user_id).order_by(MarketplaceDispute.created_at.desc()).all()
        return jsonify({'disputes': [d.to_dict() for d in disputes]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/disputes/<dispute_id>/respond', methods=['POST'])
@jwt_required()
def respond_dispute(dispute_id):
    """Seller responds to a dispute."""
    try:
        user_id = get_jwt_identity()
        dispute = MarketplaceDispute.query.get(dispute_id)
        if not dispute:
            return jsonify({'error': 'Not found'}), 404
        if dispute.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        data = request.get_json() or {}
        dispute.seller_statement = data.get('statement', '').strip()[:2000]
        dispute.status = 'seller_responded'
        db.session.commit()
        return jsonify({'dispute': dispute.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/disputes/<dispute_id>/resolve', methods=['POST'])
@jwt_required()
def resolve_dispute(dispute_id):
    """Admin: resolve a dispute."""
    try:
        user_id = get_jwt_identity()
        from app.models.models import User as UserModel
        user = UserModel.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403

        dispute = MarketplaceDispute.query.get(dispute_id)
        if not dispute:
            return jsonify({'error': 'Not found'}), 404

        data = request.get_json() or {}
        dispute.resolution = data.get('resolution', '').strip()[:2000]
        dispute.status = 'resolved'
        dispute.resolved_by = user_id
        db.session.commit()
        return jsonify({'dispute': dispute.to_dict()}), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/admin/disputes', methods=['GET'])
@jwt_required()
def admin_list_disputes():
    """Admin: list all disputes."""
    try:
        user_id = get_jwt_identity()
        from app.models.models import User as UserModel
        user = UserModel.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403

        status = request.args.get('status', '')
        q = MarketplaceDispute.query
        if status:
            q = q.filter_by(status=status)
        disputes = q.order_by(MarketplaceDispute.created_at.desc()).limit(100).all()
        return jsonify({'disputes': [d.to_dict() for d in disputes]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/admin/products', methods=['GET'])
@jwt_required()
def admin_list_products():
    """Admin: list all products with approval capability."""
    try:
        user_id = get_jwt_identity()
        from app.models.models import User as UserModel
        user = UserModel.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 25)), 100)
        q = MarketplaceProduct.query.order_by(MarketplaceProduct.created_at.desc())
        paginated = q.paginate(page=page, per_page=per_page, error_out=False)
        return jsonify({
            'products': [p.to_dict(include_file=True) for p in paginated.items],
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/admin/products/<product_id>/feature', methods=['POST'])
@jwt_required()
def admin_feature_product(product_id):
    """Admin: feature or unfeature a product."""
    try:
        user_id = get_jwt_identity()
        from app.models.models import User as UserModel
        user = UserModel.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403

        product = MarketplaceProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Not found'}), 404
        data = request.get_json() or {}
        featured = bool(data.get('featured', True))
        product.is_featured = featured
        db.session.commit()
        return jsonify({'message': 'Updated', 'is_featured': featured}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/my-purchases/<purchase_id>/download-token', methods=['POST'])
@jwt_required()
def get_download_token(purchase_id):
    """Get or create a download token for a completed purchase."""
    try:
        user_id = get_jwt_identity()
        purchase = MarketplacePurchase.query.get(purchase_id)
        if not purchase or purchase.buyer_id != user_id or purchase.status != 'completed':
            return jsonify({'error': 'Purchase not found or not completed'}), 404

        from datetime import timedelta
        existing = MarketplaceDownloadToken.query.filter_by(
            purchase_id=purchase_id, buyer_id=user_id
        ).filter(
            MarketplaceDownloadToken.expires_at > datetime.utcnow(),
            MarketplaceDownloadToken.download_count < MarketplaceDownloadToken.download_limit,
        ).first()

        if existing:
            return jsonify({'token': existing.to_dict()}), 200

        product = purchase.product
        if not product or not product.file_url:
            return jsonify({'error': 'No file available for this product'}), 404

        token_str = _generate_download_token(purchase_id, product.id)
        dl = MarketplaceDownloadToken(
            token=token_str,
            purchase_id=purchase_id,
            product_id=product.id,
            buyer_id=user_id,
            expires_at=datetime.utcnow() + timedelta(hours=24),
            download_limit=3,
        )
        db.session.add(dl)
        db.session.commit()
        return jsonify({'token': dl.to_dict()}), 201

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

        if payment_provider == 'paypal':
            from flask import current_app
            paypal_client_id = current_app.config.get('PAYPAL_CLIENT_ID', '')
            if not paypal_client_id:
                return jsonify({'error': 'PayPal not configured on this server'}), 503

            purchase = MarketplacePurchase()
            purchase.buyer_id = user_id
            purchase.product_id = product_id
            purchase.amount_paid = product.price
            purchase.currency = product.currency
            purchase.payment_provider = 'paypal'
            purchase.status = 'pending'
            db.session.add(purchase)
            db.session.commit()

            return jsonify({
                'payment_provider': 'paypal',
                'purchase_id': purchase.id,
                'amount': product.price,
                'currency': product.currency,
                'product_title': product.title,
                'paypal_client_id': paypal_client_id,
            }), 200

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
        review.media_url = data.get('media_url', '').strip() or None
        review.is_verified_purchase = has_purchase
        db.session.add(review)
        db.session.commit()
        return jsonify(review.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/reviews/<review_id>/helpful', methods=['POST'])
@jwt_required()
def mark_review_helpful(review_id):
    """Mark a review as helpful (increments helpful_count)."""
    try:
        review = MarketplaceReview.query.get(review_id)
        if not review:
            return jsonify({'error': 'Not found'}), 404
        review.helpful_count = (review.helpful_count or 0) + 1
        db.session.commit()
        return jsonify({'helpful_count': review.helpful_count}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/reviews/<review_id>/reply', methods=['POST'])
@jwt_required()
def seller_reply_review(review_id):
    """Seller replies to a review on their product."""
    try:
        user_id = get_jwt_identity()
        review = MarketplaceReview.query.get(review_id)
        if not review:
            return jsonify({'error': 'Not found'}), 404
        product = MarketplaceProduct.query.get(review.product_id)
        if not product or product.seller_id != user_id:
            return jsonify({'error': 'Forbidden — only the product seller can reply'}), 403
        data = request.get_json() or {}
        review.seller_reply = data.get('reply', '').strip()[:1000]
        db.session.commit()
        return jsonify(review.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/admin/reviews/<review_id>/moderate', methods=['POST'])
@jwt_required()
def admin_moderate_review(review_id):
    """Admin: hide (moderate) or restore a review."""
    try:
        user_id = get_jwt_identity()
        from app.models.models import User as UserModel
        user = UserModel.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403
        review = MarketplaceReview.query.get(review_id)
        if not review:
            return jsonify({'error': 'Not found'}), 404
        data = request.get_json() or {}
        review.is_moderated = bool(data.get('moderate', True))
        db.session.commit()
        return jsonify({'message': 'Updated', 'is_moderated': review.is_moderated}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/admin/products/<product_id>/approve', methods=['POST'])
@jwt_required()
def admin_approve_product(product_id):
    """Admin: approve or reject a product listing."""
    try:
        user_id = get_jwt_identity()
        from app.models.models import User as UserModel
        user = UserModel.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403
        product = MarketplaceProduct.query.get(product_id)
        if not product:
            return jsonify({'error': 'Not found'}), 404
        data = request.get_json() or {}
        approved = bool(data.get('approved', True))
        product.is_approved = approved
        if not approved:
            product.is_active = False
        db.session.commit()
        return jsonify({'message': 'Updated', 'is_approved': approved}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@marketplace_bp.route('/products/<product_id>/boost', methods=['POST'])
@jwt_required()
def boost_product(product_id):
    """Seller: boost their product (paid feature via Stripe or PayPal)."""
    try:
        user_id = get_jwt_identity()
        product = MarketplaceProduct.query.get(product_id)
        if not product or product.seller_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        data = request.get_json() or {}
        payment_provider = data.get('payment_provider', 'stripe')
        boost_days = int(data.get('days', 7))
        boost_price = 4.99 * (boost_days / 7)

        if payment_provider == 'paypal':
            paypal_id = current_app.config.get('PAYPAL_CLIENT_ID', '').strip()
            paypal_secret = current_app.config.get('PAYPAL_CLIENT_SECRET', '').strip()
            if not paypal_id or not paypal_secret:
                return jsonify({'error': 'PayPal not configured'}), 503
            from app.services.monetization import PayPalPaymentProcessor
            from app.models.models import Payment
            sandbox = current_app.config.get('PAYPAL_SANDBOX', 'false').lower() == 'true'
            pp = PayPalPaymentProcessor(paypal_id, paypal_secret, sandbox=sandbox)
            base_url = request.host_url.rstrip('/')
            result = pp.create_order(
                amount=round(boost_price, 2),
                currency='USD',
                description=f'Product Boost — {boost_days} days for "{product.title}"',
                return_url=f'{base_url}/marketplace?boost_success={product_id}',
                cancel_url=f'{base_url}/marketplace?boost_cancel=1',
            )
            payment = Payment()
            payment.user_id = user_id
            payment.provider = 'paypal'
            payment.amount = round(boost_price, 2)
            payment.currency = 'USD'
            payment.status = 'pending'
            payment.tier = 'boost'
            payment.provider_payment_id = result['order_id']
            import json as _json
            payment.metadata_json = _json.dumps({
                'purpose': 'boost', 'product_id': product_id, 'boost_days': boost_days,
            })
            db.session.add(payment)
            db.session.commit()
            return jsonify({
                'order_id': result['order_id'],
                'approve_url': result['approve_url'],
                'payment_id': payment.id,
                'boost_days': boost_days,
                'amount': round(boost_price, 2),
            }), 200

        # Stripe fallback
        import stripe
        stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if not stripe.api_key:
            return jsonify({'error': 'Payment not configured'}), 503
        base_url = request.host_url.rstrip('/')
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': f'Product Boost — {boost_days} days'},
                    'unit_amount': int(boost_price * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{base_url}/marketplace?boost_success={product_id}',
            cancel_url=f'{base_url}/marketplace?boost_cancel=1',
            metadata={'type': 'boost', 'product_id': product_id,
                      'boost_days': str(boost_days), 'seller_id': user_id},
        )
        return jsonify({'checkout_url': session.url, 'boost_days': boost_days}), 200
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
                if purchase and purchase.status != 'completed':
                    purchase.status = 'completed'
                    purchase.payment_ref = session_obj.get('id')
                    if purchase.product:
                        purchase.product.download_count = (purchase.product.download_count or 0) + 1
                    db.session.commit()
                    _deliver_purchase_async(purchase_id)

        return jsonify({'received': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 400
