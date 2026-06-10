"""My Explorer — file manager API: browse, ZIP download, delete files."""
import io
import os
import zipfile
import logging
import urllib.request
from datetime import datetime

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity

from app.models.models import db, Message

logger = logging.getLogger(__name__)
explorer_bp = Blueprint('explorer', __name__, url_prefix='/api/explorer')

UPLOADS_BASE = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 'uploads'
)

TYPE_GROUPS = {
    'image':    ['image'],
    'video':    ['video'],
    'voice':    ['voice', 'audio'],
    'document': ['document', 'file'],
}


def _local_path(url: str):
    """Resolve a /uploads/... URL to an absolute local filesystem path."""
    if '/uploads/' not in url:
        return None
    rel = url.split('/uploads/', 1)[1].split('?')[0]
    p = os.path.join(UPLOADS_BASE, rel)
    return p if os.path.exists(p) else None


def _file_bytes(url: str):
    """Return raw bytes for a file URL (local first, then HTTP fallback)."""
    local = _local_path(url)
    if local:
        with open(local, 'rb') as f:
            return f.read()
    with urllib.request.urlopen(url, timeout=12) as r:
        return r.read()


# ── Endpoints ────────────────────────────────────────────────────────────────

@explorer_bp.route('/files', methods=['GET'])
@jwt_required()
def get_files():
    """Paginated list of the caller's media files, optionally filtered by type."""
    user_id = get_jwt_identity()
    page     = max(1, int(request.args.get('page', 1)))
    limit    = min(100, max(1, int(request.args.get('limit', 50))))
    ftype    = request.args.get('type', 'all')
    sort     = request.args.get('sort', 'newest')   # newest | oldest | largest | smallest
    search   = request.args.get('q', '').strip()

    q = Message.query.filter(
        db.or_(Message.sender_id == user_id, Message.receiver_id == user_id),
        Message.media_url.isnot(None),
        Message.is_deleted_everyone == False,
    )

    if ftype != 'all':
        q = q.filter(Message.media_type.in_(TYPE_GROUPS.get(ftype, [ftype])))

    if sort == 'oldest':
        q = q.order_by(Message.created_at.asc())
    elif sort == 'largest':
        q = q.order_by(Message.media_size.desc().nullslast())
    elif sort == 'smallest':
        q = q.order_by(Message.media_size.asc().nullsfirst())
    else:
        q = q.order_by(Message.created_at.desc())

    total    = q.count()
    messages = q.offset((page - 1) * limit).limit(limit).all()

    files = []
    for msg in messages:
        is_sent = msg.sender_id == user_id
        partner = msg.receiver if is_sent else msg.sender
        files.append({
            'id':              msg.id,
            'url':             msg.media_url,
            'type':            msg.media_type or 'file',
            'size':            msg.media_size,
            'duration':        msg.media_duration,
            'thumbnail':       msg.thumbnail_url,
            'created_at':      msg.created_at.isoformat(),
            'chat_partner':    partner.full_name if partner else 'Unknown',
            'chat_partner_id': partner.id        if partner else None,
            'is_sent':         is_sent,
            'view_once':       getattr(msg, 'view_once', False),
        })

    return jsonify({
        'files':    files,
        'total':    total,
        'page':     page,
        'pages':    max(1, (total + limit - 1) // limit),
        'has_more': page * limit < total,
    })


@explorer_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_stats():
    """Aggregate counts and sizes by media type."""
    user_id = get_jwt_identity()

    base = Message.query.filter(
        db.or_(Message.sender_id == user_id, Message.receiver_id == user_id),
        Message.media_url.isnot(None),
        Message.is_deleted_everyone == False,
    )

    def _count(*types):
        return base.filter(Message.media_type.in_(types)).count()

    def _size(*types):
        from sqlalchemy import func
        row = db.session.query(func.sum(Message.media_size)).filter(
            db.or_(Message.sender_id == user_id, Message.receiver_id == user_id),
            Message.media_url.isnot(None),
            Message.is_deleted_everyone == False,
            Message.media_type.in_(types),
        ).scalar()
        return int(row or 0)

    return jsonify({
        'total':    base.count(),
        'image':    {'count': _count('image'),                   'bytes': _size('image')},
        'video':    {'count': _count('video'),                   'bytes': _size('video')},
        'voice':    {'count': _count('voice', 'audio'),          'bytes': _size('voice', 'audio')},
        'document': {'count': _count('document', 'file'),        'bytes': _size('document', 'file')},
    })


@explorer_bp.route('/download-zip', methods=['POST'])
@jwt_required()
def download_zip():
    """Zip up to 50 selected files and stream the archive."""
    user_id = get_jwt_identity()
    data = request.json or {}
    urls = data.get('urls', [])

    if not urls:
        return jsonify({'error': 'No files selected'}), 400
    if len(urls) > 50:
        return jsonify({'error': 'Maximum 50 files per ZIP download'}), 400

    # Verify ownership — only files the user sent or received
    owned = {
        m.media_url
        for m in Message.query.filter(
            db.or_(Message.sender_id == user_id, Message.receiver_id == user_id),
            Message.media_url.in_(urls),
        ).all()
    }

    buf   = io.BytesIO()
    added = 0
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for url in urls:
            if url not in owned:
                continue
            try:
                filename = url.split('/')[-1].split('?')[0] or f'file_{added+1}'
                raw      = _file_bytes(url)
                zf.writestr(filename, raw)
                added += 1
            except Exception as exc:
                logger.warning('ZIP skip %s: %s', url, exc)

    if added == 0:
        return jsonify({'error': 'None of the requested files could be read'}), 400

    buf.seek(0)
    ts = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
    return send_file(
        buf,
        mimetype='application/zip',
        as_attachment=True,
        download_name=f'vipchat_{ts}.zip',
    )


@explorer_bp.route('/files/<message_id>', methods=['DELETE'])
@jwt_required()
def delete_file(message_id):
    """Soft-delete a sent message's media from the explorer view."""
    user_id = get_jwt_identity()
    msg = Message.query.get(message_id)
    if not msg:
        return jsonify({'error': 'Message not found'}), 404
    if msg.sender_id != user_id and msg.receiver_id != user_id:
        return jsonify({'error': 'Forbidden'}), 403

    if msg.sender_id == user_id:
        msg.is_deleted_sender = True
    else:
        msg.is_deleted_receiver = True

    db.session.commit()
    return jsonify({'ok': True})
