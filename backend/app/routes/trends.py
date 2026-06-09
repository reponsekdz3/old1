"""
VipChat Trends — YouTube-like shorts/reels/videos section.
Public browsing (no auth required). Ads in videos for free plan users.
Sponsors, businesses, and admins can upload.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.models import db, User
from datetime import datetime, timedelta
import uuid, json, os

trends_bp = Blueprint('trends', __name__, url_prefix='/api/trends')

# ── Inline models ─────────────────────────────────────────────────────────────
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, Boolean, Integer


class TrendVideo(db.Model):
    __tablename__ = 'trend_videos'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    video_url = Column(Text, nullable=False)       # uploaded media URL
    thumbnail_url = Column(Text)
    duration_sec = Column(Integer, default=30)    # video duration in seconds
    category = Column(String(64), default='general')  # general | music | sports | gaming | news | comedy | education | tech
    tags = Column(Text, default='')               # comma-separated
    uploader_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    uploader_name = Column(String(128))
    uploader_type = Column(String(32), default='user')  # user | business | sponsor | admin
    views = Column(Integer, default=0)
    likes = Column(Integer, default=0)
    shares = Column(Integer, default=0)
    comments_count = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)
    is_ad = Column(Boolean, default=False)        # if this is an ad video
    ad_skip_after_sec = Column(Integer, default=10)  # skip allowed after N seconds
    ad_url = Column(Text)                         # click-through URL for ads
    ad_sponsor_name = Column(String(128))
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self, include_user_data=False):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'video_url': self.video_url,
            'thumbnail_url': self.thumbnail_url,
            'duration_sec': self.duration_sec,
            'category': self.category,
            'tags': self.tags.split(',') if self.tags else [],
            'uploader_name': self.uploader_name,
            'uploader_type': self.uploader_type,
            'views': self.views,
            'likes': self.likes,
            'shares': self.shares,
            'comments_count': self.comments_count,
            'is_featured': self.is_featured,
            'is_ad': self.is_ad,
            'ad_skip_after_sec': self.ad_skip_after_sec if self.is_ad else None,
            'ad_url': self.ad_url if self.is_ad else None,
            'ad_sponsor_name': self.ad_sponsor_name if self.is_ad else None,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TrendComment(db.Model):
    __tablename__ = 'trend_comments'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey('trend_videos.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    user_name = Column(String(128))
    content = Column(Text, nullable=False)
    likes = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_name': self.user_name,
            'content': self.content,
            'likes': self.likes,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class TrendLike(db.Model):
    __tablename__ = 'trend_likes'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    video_id = Column(String(36), ForeignKey('trend_videos.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


def _optional_auth():
    """Returns user_id if logged in, else None."""
    try:
        verify_jwt_in_request(optional=True)
        return get_jwt_identity()
    except Exception:
        return None


def _user_is_pro(user_id):
    """Returns True if user has pro/enterprise subscription (no ads)."""
    if not user_id:
        return False
    try:
        from app.models.e2ee_models import SubscriptionPlan
        sub = SubscriptionPlan.query.filter_by(user_id=user_id, status='active').first()
        return sub and sub.plan in ('pro', 'enterprise', 'business')
    except Exception:
        return False


# ── Public: browse feed ───────────────────────────────────────────────────────
@trends_bp.route('/feed', methods=['GET'])
def get_feed():
    """Public feed — no auth needed. Returns videos + ads for free users."""
    try:
        user_id = _optional_auth()
        is_pro = _user_is_pro(user_id)
        category = request.args.get('category', '')
        sort = request.args.get('sort', 'trending')  # trending | latest | popular
        page = request.args.get('page', 1, type=int)
        per_page = 20

        q = TrendVideo.query.filter_by(is_active=True, is_ad=False)
        if category and category != 'all':
            q = q.filter_by(category=category)

        if sort == 'latest':
            q = q.order_by(TrendVideo.created_at.desc())
        elif sort == 'popular':
            q = q.order_by(TrendVideo.views.desc())
        else:  # trending — weighted score
            q = q.order_by((TrendVideo.views + TrendVideo.likes * 5 + TrendVideo.shares * 10).desc())

        total = q.count()
        videos = q.offset((page - 1) * per_page).limit(per_page).all()
        result = [v.to_dict() for v in videos]

        # Inject ad every ~5 videos for non-pro users
        if not is_pro and page == 1:
            ads = TrendVideo.query.filter_by(is_active=True, is_ad=True).order_by(
                TrendVideo.created_at.desc()
            ).limit(5).all()
            for i, ad in enumerate(ads):
                insert_at = min((i + 1) * 5, len(result))
                result.insert(insert_at, {**ad.to_dict(), '_is_injected_ad': True})

        return jsonify({
            'videos': result,
            'total': total,
            'page': page,
            'pages': (total + per_page - 1) // per_page,
            'is_pro': is_pro,
            'logged_in': user_id is not None,
            'categories': ['all', 'general', 'music', 'sports', 'gaming', 'news', 'comedy', 'education', 'tech'],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Public: get single video ──────────────────────────────────────────────────
@trends_bp.route('/video/<video_id>', methods=['GET'])
def get_video(video_id):
    try:
        user_id = _optional_auth()
        video = TrendVideo.query.filter_by(id=video_id, is_active=True).first()
        if not video:
            return jsonify({'error': 'Video not found'}), 404

        # Increment views
        video.views = (video.views or 0) + 1
        db.session.commit()

        # Check if user liked
        liked = False
        if user_id:
            liked = TrendLike.query.filter_by(video_id=video_id, user_id=user_id).first() is not None

        # Get pre-roll ad (for free users)
        is_pro = _user_is_pro(user_id)
        pre_roll_ad = None
        if not is_pro:
            ad = TrendVideo.query.filter_by(is_active=True, is_ad=True).order_by(
                TrendVideo.views.asc()
            ).first()
            if ad:
                pre_roll_ad = ad.to_dict()

        comments = TrendComment.query.filter_by(video_id=video_id).order_by(
            TrendComment.created_at.desc()
        ).limit(50).all()

        return jsonify({
            'video': video.to_dict(),
            'liked': liked,
            'pre_roll_ad': pre_roll_ad,
            'comments': [c.to_dict() for c in comments],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Like/unlike a video ───────────────────────────────────────────────────────
@trends_bp.route('/video/<video_id>/like', methods=['POST'])
@jwt_required()
def toggle_like(video_id):
    try:
        user_id = get_jwt_identity()
        video = TrendVideo.query.get(video_id)
        if not video:
            return jsonify({'error': 'Video not found'}), 404
        existing = TrendLike.query.filter_by(video_id=video_id, user_id=user_id).first()
        if existing:
            db.session.delete(existing)
            video.likes = max(0, (video.likes or 0) - 1)
            liked = False
        else:
            like = TrendLike(video_id=video_id, user_id=user_id)
            db.session.add(like)
            video.likes = (video.likes or 0) + 1
            liked = True
        db.session.commit()
        return jsonify({'liked': liked, 'total_likes': video.likes}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Comment ───────────────────────────────────────────────────────────────────
@trends_bp.route('/video/<video_id>/comment', methods=['POST'])
@jwt_required()
def post_comment(video_id):
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        video = TrendVideo.query.get(video_id)
        if not video:
            return jsonify({'error': 'Video not found'}), 404
        data = request.json or {}
        content = (data.get('content') or '').strip()
        if not content or len(content) > 1000:
            return jsonify({'error': 'Comment must be 1–1000 characters'}), 400
        comment = TrendComment(
            video_id=video_id, user_id=user_id,
            user_name=user.full_name if user else 'Anonymous',
            content=content,
        )
        db.session.add(comment)
        video.comments_count = (video.comments_count or 0) + 1
        db.session.commit()
        return jsonify({'comment': comment.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Track view / share ─────────────────────────────────────────────────────────
@trends_bp.route('/video/<video_id>/track', methods=['POST'])
def track_event(video_id):
    try:
        data = request.json or {}
        event = data.get('event')  # share | ad_view | ad_click | ad_skip
        video = TrendVideo.query.get(video_id)
        if not video:
            return jsonify({'error': 'Not found'}), 404
        if event == 'share':
            video.shares = (video.shares or 0) + 1
            db.session.commit()
        return jsonify({'ok': True}), 200
    except Exception:
        return jsonify({'ok': True}), 200


# ── Upload video (auth required — uploader must be business/sponsor/admin) ────
@trends_bp.route('/upload', methods=['POST'])
@jwt_required()
def upload_video():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.json or {}
        title = (data.get('title') or '').strip()
        video_url = (data.get('video_url') or '').strip()
        if not title or not video_url:
            return jsonify({'error': 'title and video_url required'}), 400

        is_ad_upload = data.get('is_ad', False)
        if is_ad_upload and not getattr(user, 'is_admin', False):
            # Check if user is a business/sponsor (has a business API client)
            try:
                from app.routes.business_api_platform import APIClient
                client = APIClient.query.filter_by(user_id=user_id, is_active=True).first()
                if not client:
                    return jsonify({'error': 'Ad uploads require a Business API subscription'}), 403
            except Exception:
                pass

        video = TrendVideo(
            title=title,
            description=(data.get('description') or '').strip(),
            video_url=video_url,
            thumbnail_url=data.get('thumbnail_url'),
            duration_sec=int(data.get('duration_sec', 30)),
            category=data.get('category', 'general'),
            tags=','.join(data.get('tags', [])),
            uploader_id=user_id,
            uploader_name=user.full_name,
            uploader_type='admin' if getattr(user, 'is_admin', False) else data.get('uploader_type', 'user'),
            is_ad=is_ad_upload,
            ad_skip_after_sec=max(10, int(data.get('ad_skip_after_sec', 10))),
            ad_url=data.get('ad_url'),
            ad_sponsor_name=data.get('ad_sponsor_name'),
            is_active=getattr(user, 'is_admin', False),  # admins auto-approved; others need review
        )
        db.session.add(video)
        db.session.commit()
        return jsonify({
            'video': video.to_dict(),
            'pending_review': not video.is_active,
            'message': 'Video uploaded! Pending admin review.' if not video.is_active else 'Video published.',
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Search ─────────────────────────────────────────────────────────────────────
@trends_bp.route('/search', methods=['GET'])
def search_videos():
    try:
        q_str = (request.args.get('q') or '').strip()
        page = request.args.get('page', 1, type=int)
        per_page = 20
        if not q_str:
            return jsonify({'videos': [], 'total': 0}), 200
        q = TrendVideo.query.filter(
            TrendVideo.is_active == True,
            TrendVideo.is_ad == False,
            (TrendVideo.title.ilike(f'%{q_str}%') | TrendVideo.description.ilike(f'%{q_str}%') | TrendVideo.tags.ilike(f'%{q_str}%')),
        ).order_by(TrendVideo.views.desc())
        total = q.count()
        videos = q.offset((page-1)*per_page).limit(per_page).all()
        return jsonify({'videos': [v.to_dict() for v in videos], 'total': total, 'page': page}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Admin: moderate videos ─────────────────────────────────────────────────────
@trends_bp.route('/admin/videos', methods=['GET'])
@jwt_required()
def admin_list_videos():
    try:
        user_id = get_jwt_identity()
        me = User.query.get(user_id)
        if not getattr(me, 'is_admin', False):
            return jsonify({'error': 'Admin only'}), 403
        page = request.args.get('page', 1, type=int)
        status = request.args.get('status', 'all')
        q = TrendVideo.query
        if status == 'pending':
            q = q.filter_by(is_active=False, is_ad=False)
        elif status == 'active':
            q = q.filter_by(is_active=True)
        elif status == 'ads':
            q = q.filter_by(is_ad=True)
        total = q.count()
        videos = q.order_by(TrendVideo.created_at.desc()).offset((page-1)*25).limit(25).all()
        return jsonify({'videos': [v.to_dict() for v in videos], 'total': total, 'page': page}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trends_bp.route('/admin/videos/<video_id>/approve', methods=['POST'])
@jwt_required()
def admin_approve_video(video_id):
    try:
        user_id = get_jwt_identity()
        me = User.query.get(user_id)
        if not getattr(me, 'is_admin', False):
            return jsonify({'error': 'Admin only'}), 403
        video = TrendVideo.query.get(video_id)
        if not video:
            return jsonify({'error': 'Not found'}), 404
        video.is_active = True
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@trends_bp.route('/admin/videos/<video_id>/reject', methods=['POST'])
@jwt_required()
def admin_reject_video(video_id):
    try:
        user_id = get_jwt_identity()
        me = User.query.get(user_id)
        if not getattr(me, 'is_admin', False):
            return jsonify({'error': 'Admin only'}), 403
        video = TrendVideo.query.get(video_id)
        if not video:
            return jsonify({'error': 'Not found'}), 404
        db.session.delete(video)
        db.session.commit()
        return jsonify({'success': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@trends_bp.route('/admin/videos/<video_id>/feature', methods=['POST'])
@jwt_required()
def admin_feature_video(video_id):
    try:
        user_id = get_jwt_identity()
        me = User.query.get(user_id)
        if not getattr(me, 'is_admin', False):
            return jsonify({'error': 'Admin only'}), 403
        video = TrendVideo.query.get(video_id)
        if not video:
            return jsonify({'error': 'Not found'}), 404
        video.is_featured = not video.is_featured
        db.session.commit()
        return jsonify({'featured': video.is_featured}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Stats endpoint ────────────────────────────────────────────────────────────
@trends_bp.route('/stats', methods=['GET'])
def get_stats():
    try:
        total_videos = TrendVideo.query.filter_by(is_active=True, is_ad=False).count()
        total_views = db.session.query(db.func.sum(TrendVideo.views)).filter_by(is_active=True).scalar() or 0
        total_ads = TrendVideo.query.filter_by(is_active=True, is_ad=True).count()
        featured = TrendVideo.query.filter_by(is_active=True, is_featured=True, is_ad=False).order_by(
            TrendVideo.views.desc()
        ).limit(6).all()
        return jsonify({
            'total_videos': total_videos,
            'total_views': total_views,
            'total_ads': total_ads,
            'featured': [v.to_dict() for v in featured],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
