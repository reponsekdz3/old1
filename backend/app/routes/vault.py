"""
Document Vault — Encrypted personal document storage.
Client-side AES-256-GCM encryption; server stores only ciphertext.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db
from app.models.gift_models import DocumentVault
from datetime import datetime

vault_bp = Blueprint('vault', __name__, url_prefix='/api/vault')

DOC_TYPES = [
    'passport', 'national_id', 'driver_license', 'credit_card', 'health_card',
    'social_security', 'tax_id', 'birth_certificate', 'visa', 'insurance',
    'certificate', 'other',
]

DOC_META = {
    'passport':          {'label': 'Passport',             'icon': '🛂', 'color': '#3b82f6'},
    'national_id':       {'label': 'National ID',          'icon': '🪪', 'color': '#10b981'},
    'driver_license':    {'label': "Driver's License",     'icon': '🚗', 'color': '#f59e0b'},
    'credit_card':       {'label': 'Credit / Debit Card',  'icon': '💳', 'color': '#8b5cf6'},
    'health_card':       {'label': 'Health Card',          'icon': '🏥', 'color': '#ef4444'},
    'social_security':   {'label': 'Social Security',      'icon': '🔐', 'color': '#6366f1'},
    'tax_id':            {'label': 'Tax ID / TIN',         'icon': '📋', 'color': '#14b8a6'},
    'birth_certificate': {'label': 'Birth Certificate',    'icon': '👶', 'color': '#f97316'},
    'visa':              {'label': 'Visa',                 'icon': '✈️', 'color': '#0ea5e9'},
    'insurance':         {'label': 'Insurance Policy',     'icon': '🛡️', 'color': '#84cc16'},
    'certificate':       {'label': 'Certificate / Diploma','icon': '🎓', 'color': '#ec4899'},
    'other':             {'label': 'Other Document',       'icon': '📄', 'color': '#6b7280'},
}


@vault_bp.route('/types', methods=['GET'])
def list_types():
    return jsonify({'types': DOC_META}), 200


@vault_bp.route('', methods=['GET'])
@jwt_required()
def list_documents():
    user_id = get_jwt_identity()
    include_archived = request.args.get('archived', 'false').lower() == 'true'
    q = DocumentVault.query.filter_by(user_id=user_id)
    if not include_archived:
        q = q.filter_by(is_archived=False)
    docs = q.order_by(DocumentVault.created_at.desc()).all()
    return jsonify({'documents': [d.to_dict() for d in docs]}), 200


@vault_bp.route('', methods=['POST'])
@jwt_required()
def create_document():
    user_id = get_jwt_identity()
    data = request.json or {}
    doc_type = data.get('doc_type', 'other')
    if doc_type not in DOC_TYPES:
        doc_type = 'other'
    label = (data.get('label') or '').strip()[:100]
    encrypted_data = data.get('encrypted_data', '')
    if not label or not encrypted_data:
        return jsonify({'error': 'label and encrypted_data are required'}), 400

    expires_at = None
    try:
        if data.get('expires_at'):
            expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', ''))
    except Exception:
        pass

    doc = DocumentVault(
        user_id=user_id, doc_type=doc_type, label=label,
        encrypted_data=encrypted_data,
        file_url=data.get('file_url'), thumbnail_url=data.get('thumbnail_url'),
        expires_at=expires_at,
    )
    db.session.add(doc)
    db.session.commit()
    return jsonify({'document': doc.to_dict()}), 201


@vault_bp.route('/<doc_id>', methods=['GET'])
@jwt_required()
def get_document(doc_id):
    user_id = get_jwt_identity()
    doc = DocumentVault.query.filter_by(id=doc_id, user_id=user_id).first_or_404()
    result = doc.to_dict()
    result['encrypted_data'] = doc.encrypted_data
    return jsonify({'document': result}), 200


@vault_bp.route('/<doc_id>', methods=['PUT'])
@jwt_required()
def update_document(doc_id):
    user_id = get_jwt_identity()
    doc = DocumentVault.query.filter_by(id=doc_id, user_id=user_id).first_or_404()
    data = request.json or {}
    if 'label' in data:
        doc.label = str(data['label'])[:100]
    if 'encrypted_data' in data:
        doc.encrypted_data = data['encrypted_data']
    if 'doc_type' in data and data['doc_type'] in DOC_TYPES:
        doc.doc_type = data['doc_type']
    if 'expires_at' in data:
        try:
            doc.expires_at = datetime.fromisoformat(data['expires_at'].replace('Z', ''))
        except Exception:
            doc.expires_at = None
    if 'thumbnail_url' in data:
        doc.thumbnail_url = data['thumbnail_url']
    if 'file_url' in data:
        doc.file_url = data['file_url']
    db.session.commit()
    return jsonify({'document': doc.to_dict()}), 200


@vault_bp.route('/<doc_id>/archive', methods=['POST'])
@jwt_required()
def toggle_archive(doc_id):
    user_id = get_jwt_identity()
    doc = DocumentVault.query.filter_by(id=doc_id, user_id=user_id).first_or_404()
    doc.is_archived = not doc.is_archived
    db.session.commit()
    return jsonify({'is_archived': doc.is_archived}), 200


@vault_bp.route('/<doc_id>', methods=['DELETE'])
@jwt_required()
def delete_document(doc_id):
    user_id = get_jwt_identity()
    doc = DocumentVault.query.filter_by(id=doc_id, user_id=user_id).first_or_404()
    db.session.delete(doc)
    db.session.commit()
    return jsonify({'deleted': True}), 200
