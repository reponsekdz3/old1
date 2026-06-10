from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Status, Contact
from app.services.app_services import ContactService
from datetime import datetime, timedelta

contacts_bp = Blueprint('contacts', __name__, url_prefix='/api/contacts')

@contacts_bp.route('', methods=['GET'])
@jwt_required()
def get_all_contacts():
    try:
        user_id = get_jwt_identity()
        contacts = ContactService.get_contacts(user_id)
        return jsonify({'contacts': contacts}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('', methods=['POST'])
@jwt_required()
def add_contact():
    try:
        user_id = get_jwt_identity()
        data = request.json
        phone_number = data.get('phone_number', '').strip()
        contact_name = data.get('contact_name', '').strip()
        if not phone_number:
            return jsonify({'error': 'Phone number is required'}), 400
        result = ContactService.add_contact(user_id, phone_number, contact_name)
        if result['success']:
            return jsonify(result['contact']), 201
        else:
            return jsonify({'error': result['error']}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>', methods=['GET'])
@jwt_required()
def get_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        # contact_id can be a contact UUID OR a user UUID (activeChat is always user ID)
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            # Try by contact_user_id
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        return jsonify(contact.to_dict()), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>', methods=['PUT'])
@jwt_required()
def update_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        data = request.json
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        if 'contact_name' in data:
            contact.contact_name = data['contact_name']
        db.session.commit()
        return jsonify(contact.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>/block', methods=['PUT'])
@jwt_required()
def block_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        contact.is_blocked = True
        db.session.commit()
        return jsonify({'message': 'Contact blocked'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>/unblock', methods=['PUT'])
@jwt_required()
def unblock_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            contact = Contact.query.filter_by(contact_user_id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        contact.is_blocked = False
        db.session.commit()
        return jsonify({'message': 'Contact unblocked'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/<contact_id>', methods=['DELETE'])
@jwt_required()
def delete_contact(contact_id):
    try:
        user_id = get_jwt_identity()
        contact = Contact.query.filter_by(id=contact_id, user_id=user_id).first()
        if not contact:
            return jsonify({'error': 'Contact not found'}), 404
        db.session.delete(contact)
        db.session.commit()
        return jsonify({'message': 'Contact deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/search', methods=['GET'])
@jwt_required()
def search_contacts():
    try:
        user_id = get_jwt_identity()
        query = request.args.get('q', '').strip()
        if not query:
            return jsonify({'contacts': []}), 200
        contacts = Contact.query.filter(
            Contact.user_id == user_id,
            db.or_(
                Contact.contact_name.ilike(f'%{query}%'),
                Contact.phone_number.ilike(f'%{query}%'),
            )
        ).limit(20).all()
        return jsonify({'contacts': [c.to_dict() for c in contacts]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/search-users', methods=['GET'])
@jwt_required()
def search_users():
    """Search all registered users by name/phone/email"""
    try:
        user_id = get_jwt_identity()
        query_str = request.args.get('q', '').strip()
        if not query_str or len(query_str) < 2:
            return jsonify({'users': []}), 200
        users = User.query.filter(
            User.id != user_id,
            db.or_(
                User.full_name.ilike(f'%{query_str}%'),
                User.phone_number.ilike(f'%{query_str}%'),
                User.email.ilike(f'%{query_str}%'),
            )
        ).limit(15).all()
        return jsonify({'users': [u.to_dict() for u in users]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@contacts_bp.route('/sync-phone', methods=['POST'])
@jwt_required()
def sync_phone_contacts():
    """Accept phone numbers from device, return which are on VipChat."""
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        phone_numbers = data.get('phone_numbers', [])
        if not phone_numbers:
            return jsonify({'registered': [], 'unregistered': []}), 200

        def normalize(p):
            return str(p).strip().replace(' ', '').replace('-', '').replace('(', '').replace(')', '').replace('\u00a0', '')

        normalized_map = {}
        for p in phone_numbers:
            if p:
                norm = normalize(p)
                if norm:
                    normalized_map[norm] = p

        current_user = User.query.get(user_id)
        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        registered = []
        unregistered = []

        for norm, original in normalized_map.items():
            user = User.query.filter_by(phone_number=norm).first()
            if not user and not norm.startswith('+'):
                user = User.query.filter_by(phone_number='+' + norm).first()
            if not user and norm.startswith('+'):
                user = User.query.filter_by(phone_number=norm[1:]).first()

            if user and user.id != user_id:
                registered.append({
                    'phone_number': original,
                    'normalized_phone': norm,
                    'id': user.id,
                    'full_name': user.full_name,
                    'avatar_url': user.avatar_url,
                    'about': getattr(user, 'about', None) or getattr(user, 'bio', None) or 'Hey there! I am using VipChat.',
                    'is_online': getattr(user, 'is_online', False),
                })
            else:
                unregistered.append(original)

        return jsonify({
            'registered': registered,
            'unregistered': unregistered,
            'total_checked': len(normalized_map),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Status routes ─────────────────────────────────────────────────────────────
status_bp = Blueprint('status', __name__, url_prefix='/api/status')


def _build_status_item(s, current_user):
    """Build a status dict with all enhanced fields."""
    content = s.content or ''
    bg_color = s.background_color or '#008069'
    mtype = s.media_type or 'text'
    # Backwards-compat: parse legacy __bg:...__  prefix
    if content.startswith('__bg:'):
        parts = content.split('__', 3)
        if len(parts) >= 3:
            bg_color = parts[1].replace('bg:', '')
            content = parts[2] if len(parts) > 2 else ''
    is_viewed = current_user in s.viewers
    # Aggregate reactions
    reaction_summary = {}
    for r in (s.reactions or []):
        reaction_summary[r.emoji] = reaction_summary.get(r.emoji, 0) + 1
    my_reaction = None
    for r in (s.reactions or []):
        if r.user_id == current_user.id:
            my_reaction = r.emoji
            break
    return {
        'id': s.id,
        'user_id': s.user_id,
        'content': content,
        'background_color': bg_color,
        'font_style': getattr(s, 'font_style', None) or 'sans',
        'text_color': getattr(s, 'text_color', None) or '#ffffff',
        'text_align': getattr(s, 'text_align', None) or 'center',
        'media_url': s.media_url,
        'media_type': mtype,
        'link_url': getattr(s, 'link_url', None),
        'link_title': getattr(s, 'link_title', None),
        'link_description': getattr(s, 'link_description', None),
        'link_image': getattr(s, 'link_image', None),
        'music_name': getattr(s, 'music_name', None),
        'music_url': getattr(s, 'music_url', None),
        'privacy': getattr(s, 'privacy', None) or 'everyone',
        'duration_hours': getattr(s, 'duration_hours', None) or 24,
        'created_at': s.created_at.isoformat(),
        'expires_at': s.expires_at.isoformat(),
        'viewers_count': len(s.viewers),
        'viewed': is_viewed,
        'reactions': reaction_summary,
        'my_reaction': my_reaction,
        'total_reactions': len(s.reactions or []),
    }


def _do_create_status():
    """Shared logic for POST /api/status and /api/status/create."""
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        content = data.get('content', '').strip()
        media_url = data.get('media_url')
        media_type = data.get('media_type', 'text')
        background_color = data.get('background_color', '#008069')
        font_style = data.get('font_style', 'sans')
        text_color = data.get('text_color', '#ffffff')
        text_align = data.get('text_align', 'center')
        link_url = data.get('link_url')
        link_title = data.get('link_title')
        link_description = data.get('link_description')
        link_image = data.get('link_image')
        music_name = data.get('music_name')
        music_url = data.get('music_url')
        privacy = data.get('privacy', 'everyone')
        duration_hours = int(data.get('duration_hours', 24))

        if not content and not media_url and not link_url:
            return jsonify({'error': 'Content, media, or link required'}), 400

        # Backwards-compat: strip old __bg:...__  prefix if present
        if content and content.startswith('__bg:'):
            parts = content.split('__', 3)
            if len(parts) >= 3:
                background_color = parts[1].replace('bg:', '')
                content = parts[2] if len(parts) > 2 else ''

        expires_at = datetime.utcnow() + timedelta(hours=max(1, min(duration_hours, 72)))

        status = Status()
        status.user_id = user_id
        status.content = content
        status.media_url = media_url
        status.media_type = media_type
        status.background_color = background_color
        status.expires_at = expires_at
        try:
            status.font_style = font_style
            status.text_color = text_color
            status.text_align = text_align
            status.link_url = link_url
            status.link_title = link_title
            status.link_description = link_description
            status.link_image = link_image
            status.music_name = music_name
            status.music_url = music_url
            status.privacy = privacy
            status.duration_hours = duration_hours
        except Exception:
            pass

        db.session.add(status)
        db.session.commit()
        return jsonify({'message': 'Status created', 'status': status.to_dict()}), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('', methods=['POST'])
@jwt_required()
def create_status():
    return _do_create_status()


@status_bp.route('/create', methods=['POST'])
@jwt_required()
def create_status_alias():
    """Alias kept for backwards compatibility."""
    return _do_create_status()


@status_bp.route('/all', methods=['GET'])
@jwt_required()
def get_all_statuses():
    """Get statuses from all contacts + self, grouped by user."""
    try:
        user_id = get_jwt_identity()
        now = datetime.utcnow()
        current_user = User.query.get(user_id)

        my_contacts = Contact.query.filter_by(user_id=user_id, is_blocked=False).all()
        contact_user_ids = [c.contact_user_id for c in my_contacts if c.contact_user_id]
        contact_user_ids.append(user_id)

        # Get muted users
        try:
            from app.models.models import StatusMute
            muted_ids = {m.muted_user_id for m in StatusMute.query.filter_by(user_id=user_id).all()}
        except Exception:
            muted_ids = set()

        # Get close friends list
        try:
            from app.models.models import CloseFriend
            close_friend_ids = {cf.friend_user_id for cf in CloseFriend.query.filter_by(user_id=user_id).all()}
        except Exception:
            close_friend_ids = set()

        all_statuses = Status.query.filter(
            Status.user_id.in_(contact_user_ids),
            Status.expires_at > now,
        ).order_by(Status.created_at.desc()).all()

        grouped = {}
        for s in all_statuses:
            uid = s.user_id
            # Skip muted (except own)
            if uid != user_id and uid in muted_ids:
                continue
            # Privacy filter: close_friends only visible to close friends
            privacy_val = getattr(s, 'privacy', 'everyone') or 'everyone'
            if uid != user_id and privacy_val == 'close_friends' and uid not in close_friend_ids:
                continue

            if uid not in grouped:
                grouped[uid] = {
                    'user_id': uid,
                    'owner_name': s.user.full_name,
                    'owner_avatar': s.user.avatar_url,
                    'is_close_friend': uid in close_friend_ids,
                    'is_muted': False,
                    'viewed': False,
                    'latest_at': s.created_at.isoformat(),
                    'statuses': [],
                }

            item = _build_status_item(s, current_user)
            is_viewed = item['viewed']
            if is_viewed:
                grouped[uid]['viewed'] = True
            grouped[uid]['statuses'].append(item)

        my_statuses_raw = grouped.pop(user_id, None)
        statuses_list = sorted(grouped.values(), key=lambda x: x['latest_at'], reverse=True)

        return jsonify({
            'statuses': statuses_list,
            'my_statuses': my_statuses_raw['statuses'] if my_statuses_raw else [],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@status_bp.route('/<user_id_or_status_id>', methods=['GET'])
@jwt_required()
def get_user_status(user_id_or_status_id):
    try:
        statuses = Status.query.filter_by(user_id=user_id_or_status_id).filter(
            Status.expires_at > datetime.utcnow()
        ).order_by(Status.created_at.desc()).all()
        return jsonify({'statuses': [s.to_dict() for s in statuses]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@status_bp.route('/<status_id>/view', methods=['POST'])
@jwt_required()
def view_status(status_id):
    try:
        from sqlalchemy import text
        viewer_id = get_jwt_identity()
        status = Status.query.get(status_id)
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        viewer = User.query.get(viewer_id)
        if viewer and viewer not in status.viewers:
            status.viewers.append(viewer)
            db.session.flush()
            # Set the viewed_at timestamp directly on the association row
            try:
                db.session.execute(
                    text("UPDATE status_viewers SET viewed_at = :ts "
                         "WHERE status_id = :sid AND user_id = :uid"),
                    {'ts': datetime.utcnow(), 'sid': status_id, 'uid': viewer_id}
                )
            except Exception:
                pass
            db.session.commit()
        else:
            # Already viewed — still return ok
            pass
        return jsonify({'message': 'Viewed', 'viewers_count': len(status.viewers)}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/<status_id>', methods=['DELETE'])
@jwt_required()
def delete_status(status_id):
    try:
        user_id = get_jwt_identity()
        status = Status.query.filter_by(id=status_id, user_id=user_id).first()
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        db.session.delete(status)
        db.session.commit()
        return jsonify({'message': 'Status deleted'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/<status_id>/viewers', methods=['GET'])
@jwt_required()
def get_status_viewers(status_id):
    """Return the list of users who have viewed a status (owner only), with real timestamps."""
    try:
        from sqlalchemy import text
        user_id = get_jwt_identity()
        status = Status.query.get(status_id)
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        if status.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403

        # Fetch viewed_at timestamps directly from the association table
        rows = db.session.execute(
            text("SELECT sv.user_id, sv.viewed_at, u.full_name, u.avatar_url "
                 "FROM status_viewers sv "
                 "JOIN users u ON u.id = sv.user_id "
                 "WHERE sv.status_id = :sid "
                 "ORDER BY CASE WHEN sv.viewed_at IS NULL THEN 1 ELSE 0 END, "
                 "sv.viewed_at DESC"),
            {'sid': status_id}
        ).fetchall()

        viewers = [
            {
                'id': r.user_id,
                'full_name': r.full_name,
                'avatar_url': r.avatar_url,
                'viewed_at': r.viewed_at.isoformat() if r.viewed_at else None,
            }
            for r in rows
        ]
        return jsonify({'viewers': viewers, 'count': len(viewers)}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@status_bp.route('/<status_id>/react', methods=['POST'])
@jwt_required()
def react_to_status(status_id):
    """Persist a reaction; replace any prior reaction from the same user."""
    try:
        from app.models.models import StatusReaction
        user_id = get_jwt_identity()
        status = Status.query.get(status_id)
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        data = request.get_json() or {}
        emoji = data.get('emoji', '❤️')
        allowed = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '👏', '😍', '🤣']
        if emoji not in allowed:
            emoji = '❤️'
        # Upsert reaction
        existing = StatusReaction.query.filter_by(status_id=status_id, user_id=user_id).first()
        if existing:
            existing.emoji = emoji
        else:
            reaction = StatusReaction(status_id=status_id, user_id=user_id, emoji=emoji)
            db.session.add(reaction)
        # Mark as viewed
        viewer = User.query.get(user_id)
        if viewer and viewer not in status.viewers:
            status.viewers.append(viewer)
        db.session.commit()
        # Return updated reaction summary
        reaction_summary = {}
        for r in status.reactions:
            reaction_summary[r.emoji] = reaction_summary.get(r.emoji, 0) + 1
        return jsonify({'ok': True, 'emoji': emoji, 'reactions': reaction_summary}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/<status_id>/reactions', methods=['GET'])
@jwt_required()
def get_status_reactions(status_id):
    """Get all reactions for a status."""
    try:
        from app.models.models import StatusReaction
        user_id = get_jwt_identity()
        status = Status.query.get(status_id)
        if not status:
            return jsonify({'error': 'Status not found'}), 404
        if status.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        reactions = StatusReaction.query.filter_by(status_id=status_id).all()
        return jsonify({
            'reactions': [r.to_dict() for r in reactions],
            'count': len(reactions),
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@status_bp.route('/mute/<target_user_id>', methods=['POST'])
@jwt_required()
def mute_status(target_user_id):
    """Mute a contact's statuses."""
    try:
        from app.models.models import StatusMute
        user_id = get_jwt_identity()
        existing = StatusMute.query.filter_by(user_id=user_id, muted_user_id=target_user_id).first()
        if not existing:
            mute = StatusMute(user_id=user_id, muted_user_id=target_user_id)
            db.session.add(mute)
            db.session.commit()
        return jsonify({'ok': True, 'muted': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/mute/<target_user_id>', methods=['DELETE'])
@jwt_required()
def unmute_status(target_user_id):
    """Unmute a contact's statuses."""
    try:
        from app.models.models import StatusMute
        user_id = get_jwt_identity()
        StatusMute.query.filter_by(user_id=user_id, muted_user_id=target_user_id).delete()
        db.session.commit()
        return jsonify({'ok': True, 'muted': False}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/close-friends', methods=['GET'])
@jwt_required()
def get_close_friends():
    """Get current user's close friends list."""
    try:
        from app.models.models import CloseFriend
        user_id = get_jwt_identity()
        cfs = CloseFriend.query.filter_by(user_id=user_id).all()
        friend_ids = [cf.friend_user_id for cf in cfs]
        users = User.query.filter(User.id.in_(friend_ids)).all() if friend_ids else []
        return jsonify({
            'close_friends': [{'id': u.id, 'full_name': u.full_name, 'avatar_url': u.avatar_url} for u in users]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@status_bp.route('/close-friends/<friend_user_id>', methods=['POST'])
@jwt_required()
def add_close_friend(friend_user_id):
    """Add a user to close friends."""
    try:
        from app.models.models import CloseFriend
        user_id = get_jwt_identity()
        existing = CloseFriend.query.filter_by(user_id=user_id, friend_user_id=friend_user_id).first()
        if not existing:
            cf = CloseFriend(user_id=user_id, friend_user_id=friend_user_id)
            db.session.add(cf)
            db.session.commit()
        return jsonify({'ok': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/close-friends/<friend_user_id>', methods=['DELETE'])
@jwt_required()
def remove_close_friend(friend_user_id):
    """Remove a user from close friends."""
    try:
        from app.models.models import CloseFriend
        user_id = get_jwt_identity()
        CloseFriend.query.filter_by(user_id=user_id, friend_user_id=friend_user_id).delete()
        db.session.commit()
        return jsonify({'ok': True}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@status_bp.route('/link-preview', methods=['POST'])
@jwt_required()
def fetch_link_preview():
    """Fetch Open Graph metadata for a URL to build a link status preview."""
    try:
        data = request.get_json() or {}
        url = data.get('url', '').strip()
        if not url or not url.startswith(('http://', 'https://')):
            return jsonify({'error': 'Invalid URL'}), 400
        import requests as req_lib
        headers = {'User-Agent': 'VipChatBot/1.0 (+https://vipchat.app)'}
        resp = req_lib.get(url, headers=headers, timeout=5, allow_redirects=True)
        html = resp.text[:50000]
        import re
        def og(prop):
            m = re.search(rf'<meta[^>]+property=["\']og:{prop}["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
            if m: return m.group(1)
            m = re.search(rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:{prop}["\']', html, re.I)
            return m.group(1) if m else None
        def meta(name):
            m = re.search(rf'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
            return m.group(1) if m else None
        title = og('title') or (re.search(r'<title[^>]*>([^<]+)</title>', html, re.I) or [None, ''])[1] or ''
        description = og('description') or meta('description') or ''
        image = og('image') or ''
        return jsonify({'title': title[:200], 'description': description[:500], 'image': image[:512], 'url': url}), 200
    except Exception as e:
        return jsonify({'title': '', 'description': '', 'image': '', 'url': data.get('url', '')}), 200
