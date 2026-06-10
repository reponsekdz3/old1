"""
Shared Notes / Wiki — Collaborative markdown notes per chat or group.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from app.models.gift_models import SharedNote, NoteRevision

notes_bp = Blueprint('notes', __name__, url_prefix='/api/notes')


def _can_access(note, user_id):
    if note.is_public:
        return True
    if note.owner_id == user_id:
        return True
    if note.chat_with_id and note.chat_with_id == user_id:
        return True
    if note.group_id:
        from app.models.models import Group
        g = Group.query.get(note.group_id)
        return g and any(m.id == user_id for m in g.members)
    return False


@notes_bp.route('', methods=['GET'])
@jwt_required()
def list_notes():
    user_id = get_jwt_identity()
    chat_with_id = request.args.get('chat_with_id')
    group_id = request.args.get('group_id')

    if chat_with_id:
        notes = SharedNote.query.filter(
            db.or_(
                db.and_(SharedNote.owner_id == user_id, SharedNote.chat_with_id == chat_with_id),
                db.and_(SharedNote.owner_id == chat_with_id, SharedNote.chat_with_id == user_id),
            )
        ).order_by(SharedNote.updated_at.desc()).all()
    elif group_id:
        notes = SharedNote.query.filter_by(group_id=group_id).order_by(SharedNote.updated_at.desc()).all()
    else:
        notes = SharedNote.query.filter_by(owner_id=user_id).order_by(SharedNote.updated_at.desc()).all()

    return jsonify({'notes': [n.to_dict() for n in notes]}), 200


@notes_bp.route('', methods=['POST'])
@jwt_required()
def create_note():
    user_id = get_jwt_identity()
    data = request.json or {}
    title = (data.get('title') or 'Untitled Note').strip()[:255]
    content = data.get('content', '')

    note = SharedNote(
        title=title, content=content, owner_id=user_id,
        chat_with_id=data.get('chat_with_id'),
        group_id=data.get('group_id'),
        is_public=bool(data.get('is_public', False)),
        last_edited_by=user_id,
    )
    db.session.add(note)
    db.session.flush()
    db.session.add(NoteRevision(note_id=note.id, editor_id=user_id, content_snapshot=content, version=1))
    db.session.commit()
    return jsonify({'note': note.to_dict()}), 201


@notes_bp.route('/<note_id>', methods=['GET'])
@jwt_required()
def get_note(note_id):
    user_id = get_jwt_identity()
    note = SharedNote.query.get_or_404(note_id)
    if not _can_access(note, user_id):
        return jsonify({'error': 'Access denied'}), 403
    return jsonify({'note': note.to_dict()}), 200


@notes_bp.route('/<note_id>', methods=['PUT'])
@jwt_required()
def update_note(note_id):
    user_id = get_jwt_identity()
    note = SharedNote.query.get_or_404(note_id)
    if not _can_access(note, user_id):
        return jsonify({'error': 'Access denied'}), 403

    data = request.json or {}
    if 'title' in data:
        note.title = str(data['title'])[:255]
    if 'content' in data:
        note.content = data['content']
        note.version += 1
        note.last_edited_by = user_id
        db.session.add(NoteRevision(note_id=note.id, editor_id=user_id,
                                    content_snapshot=data['content'], version=note.version))
    if 'is_public' in data:
        note.is_public = bool(data['is_public'])
    db.session.commit()

    try:
        socketio = current_app.extensions.get('socketio')
        if socketio:
            if note.chat_with_id:
                socketio.emit('note_updated', {'note_id': note.id, 'title': note.title},
                              room=f'user_{note.chat_with_id}')
            elif note.group_id:
                socketio.emit('note_updated', {'note_id': note.id, 'title': note.title},
                              room=f'group_{note.group_id}')
    except Exception:
        pass
    return jsonify({'note': note.to_dict()}), 200


@notes_bp.route('/<note_id>/revisions', methods=['GET'])
@jwt_required()
def get_revisions(note_id):
    user_id = get_jwt_identity()
    note = SharedNote.query.get_or_404(note_id)
    if not _can_access(note, user_id):
        return jsonify({'error': 'Access denied'}), 403
    revs = NoteRevision.query.filter_by(note_id=note_id).order_by(NoteRevision.version.desc()).all()
    return jsonify({'revisions': [r.to_dict() for r in revs]}), 200


@notes_bp.route('/<note_id>/revisions/<int:version>/restore', methods=['POST'])
@jwt_required()
def restore_revision(note_id, version):
    user_id = get_jwt_identity()
    note = SharedNote.query.get_or_404(note_id)
    if note.owner_id != user_id:
        return jsonify({'error': 'Only the owner can restore revisions'}), 403
    rev = NoteRevision.query.filter_by(note_id=note_id, version=version).first_or_404()
    note.content = rev.content_snapshot
    note.version += 1
    note.last_edited_by = user_id
    db.session.add(NoteRevision(note_id=note.id, editor_id=user_id,
                                content_snapshot=rev.content_snapshot, version=note.version))
    db.session.commit()
    return jsonify({'note': note.to_dict()}), 200


@notes_bp.route('/<note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    user_id = get_jwt_identity()
    note = SharedNote.query.get_or_404(note_id)
    if note.owner_id != user_id:
        return jsonify({'error': 'Only the owner can delete this note'}), 403
    db.session.delete(note)
    db.session.commit()
    return jsonify({'deleted': True}), 200
