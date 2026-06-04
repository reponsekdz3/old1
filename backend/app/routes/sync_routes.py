"""
Ultra-Efficient Sync Routes - Minimal Data Transfer
- Binary encoding (MessagePack)
- LZ4 compression
- Delta sync only
- Batch operations
"""

from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
import msgpack
import lz4.frame
import time
import json
from services.offline_sync import offline_sync, BinaryProtocol, DeltaSync
from services.distributed_queue import message_queue, broadcast_queue

sync_bp = Blueprint('sync', __name__)


@sync_bp.route('/api/sync/messages', methods=['GET'])
@jwt_required()
async def sync_messages():
    """Sync messages with delta encoding - returns only new messages"""
    user_id = get_jwt_identity()
    last_token = request.args.get('token')
    limit = min(int(request.args.get('limit', 100)), 500)
    
    # Get binary-encoded messages
    data = await offline_sync.sync_messages(user_id, last_token, limit)
    
    # Return as binary
    from flask import Response
    return Response(
        data,
        mimetype='application/msgpack',
        headers={
            'Content-Encoding': 'lz4',
            'X-Sync-Token': offline_sync.get_sync_token(user_id),
            'Cache-Control': 'no-store',
        }
    )


@sync_bp.route('/api/sync/deltas', methods=['GET'])
@jwt_required()
async def get_deltas():
    """Get pending deltas for incremental sync"""
    user_id = get_jwt_identity()
    last_id = request.args.get('last_id', '0')
    
    data = await offline_sync.get_pending_deltas(user_id, last_id)
    
    from flask import Response
    return Response(
        data,
        mimetype='application/msgpack',
        headers={
            'Content-Encoding': 'lz4',
            'X-Delta-Count': str(len(data)),
        }
    )


@sync_bp.route('/api/sync/contacts', methods=['POST'])
@jwt_required()
async def sync_contacts():
    """Sync contacts using phone hash matching - privacy-preserving"""
    user_id = get_jwt_identity()
    
    # Get device contacts (hashed phone numbers)
    data = request.get_json()
    device_contacts = data.get('contacts', [])
    
    # Return binary-encoded matches
    result = await offline_sync.sync_contacts(user_id, device_contacts)
    
    from flask import Response
    return Response(result, mimetype='application/msgpack')


@sync_bp.route('/api/sync/batch', methods=['POST'])
@jwt_required()
async def batch_sync():
    """Batch sync multiple entities in one request"""
    user_id = get_jwt_identity()
    
    # Decompress request
    if request.content_type == 'application/msgpack':
        data = BinaryProtocol.decode(request.data)
    else:
        data = request.get_json()
    
    results = {}
    
    # Sync messages
    if 'messages' in data:
        results['messages'] = await offline_sync.sync_messages(
            user_id,
            data['messages'].get('token'),
            data['messages'].get('limit', 100)
        )
    
    # Sync contacts
    if 'contacts' in data:
        results['contacts'] = await offline_sync.sync_contacts(
            user_id,
            data['contacts']
        )
    
    # Get deltas
    if 'deltas' in data:
        results['deltas'] = await offline_sync.get_pending_deltas(
            user_id,
            data['deltas'].get('last_id', '0')
        )
    
    # Compress response
    return Response(
        BinaryProtocol.encode(results, compress=True),
        mimetype='application/msgpack'
    )


@sync_bp.route('/api/sync/status', methods=['GET'])
@jwt_required()
def sync_status():
    """Get sync status and pending counts"""
    user_id = get_jwt_identity()
    
    import redis
    r = redis.Redis()
    
    queue_len = r.xlen(f"delta_queue:{user_id}")
    
    return jsonify({
        'pending_deltas': queue_len,
        'server_time': int(time.time() * 1000),
        'sync_token': offline_sync.get_sync_token(user_id),
    })


@sync_bp.route('/api/sync/push', methods=['POST'])
@jwt_required()
async def push_update():
    """Push update from client (offline -> online sync)"""
    user_id = get_jwt_identity()
    
    data = request.get_json()
    entity_type = data.get('type')
    entity_data = data.get('data')
    
    # Store in database
    if entity_type == 'message':
        from app.models.models import Message, db
        msg = Message(
            conversation_id=entity_data.get('conversation_id'),
            sender_id=user_id,
            content=entity_data.get('content'),
            attachment_url=entity_data.get('attachment_url'),
            attachment_type=entity_data.get('attachment_type'),
        )
        db.session.add(msg)
        db.session.commit()
        
        # Broadcast to recipient
        await message_queue.publish('messages', {
            'type': 'new_message',
            'message': {
                'id': str(msg.id),
                'c': str(msg.conversation_id),
                's': str(user_id),
                't': msg.content,
                'ts': int(msg.created_at.timestamp() * 1000),
            }
        }, partition_key=entity_data.get('recipient_id'))
        
        return jsonify({'success': True, 'id': str(msg.id)})
    
    return jsonify({'success': False}), 400


@sync_bp.route('/api/compress/test', methods=['POST'])
def test_compression():
    """Test compression ratio"""
    data = request.get_json()
    
    json_size = len(json.dumps(data))
    msgpack_size = len(msgpack.packb(data))
    compressed_size = len(lz4.frame.compress(msgpack.packb(data)))
    
    return jsonify({
        'json_bytes': json_size,
        'msgpack_bytes': msgpack_size,
        'compressed_bytes': compressed_size,
        'savings_percent': round((1 - compressed_size / json_size) * 100, 2),
    })


@sync_bp.route('/api/sync/conflict', methods=['POST'])
@jwt_required()
def resolve_conflict():
    """Resolve sync conflicts"""
    user_id = get_jwt_identity()
    data = request.get_json()
    
    # Conflict resolution: server wins, client wins, or merge
    strategy = data.get('strategy', 'server_wins')
    
    if strategy == 'merge':
        # Merge client and server versions
        server_version = data.get('server', {})
        client_version = data.get('client', {})
        
        merged = DeltaSync.apply_delta(server_version, client_version)
        return jsonify({'merged': merged, 'strategy': 'merged'})
    
    return jsonify({
        'resolved': data.get('server') if strategy == 'server_wins' else data.get('client'),
        'strategy': strategy
    })
