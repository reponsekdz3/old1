"""
Gift & Escrow System — Real money flows through Stripe, PayPal, Flutterwave.
Coins = internal currency. Creators earn USD from received gifts (70% share).
Platform fee = 30%.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from app.models.gift_models import (
    GiftItem, EscrowWallet, WalletDeposit, GiftTransaction, WithdrawalRequest
)
from datetime import datetime
from sqlalchemy import func
import uuid, json, os

gifts_bp = Blueprint('gifts', __name__, url_prefix='/api/gifts')

COINS_PER_USD = 100
MIN_WITHDRAW_USD = 10.0

DEFAULT_GIFTS = [
    {'name': 'Rose',     'emoji': '🌹', 'animation_type': 'float',   'coin_cost': 1,    'usd_value': 0.007,  'category': 'basic',     'sort_order': 1},
    {'name': 'Heart',    'emoji': '❤️',  'animation_type': 'heart',   'coin_cost': 5,    'usd_value': 0.035,  'category': 'basic',     'sort_order': 2},
    {'name': 'Clap',     'emoji': '👏',  'animation_type': 'float',   'coin_cost': 10,   'usd_value': 0.07,   'category': 'basic',     'sort_order': 3},
    {'name': 'Fire',     'emoji': '🔥',  'animation_type': 'explode', 'coin_cost': 20,   'usd_value': 0.14,   'category': 'basic',     'sort_order': 4},
    {'name': 'Mic',      'emoji': '🎤',  'animation_type': 'float',   'coin_cost': 30,   'usd_value': 0.21,   'category': 'basic',     'sort_order': 5},
    {'name': 'Diamond',  'emoji': '💎',  'animation_type': 'spin',    'coin_cost': 50,   'usd_value': 0.35,   'category': 'premium',   'sort_order': 6},
    {'name': 'Crown',    'emoji': '👑',  'animation_type': 'rain',    'coin_cost': 100,  'usd_value': 0.70,   'category': 'premium',   'sort_order': 7},
    {'name': 'Rocket',   'emoji': '🚀',  'animation_type': 'explode', 'coin_cost': 200,  'usd_value': 1.40,   'category': 'premium',   'sort_order': 8},
    {'name': 'Trophy',   'emoji': '🏆',  'animation_type': 'spin',    'coin_cost': 500,  'usd_value': 3.50,   'category': 'legendary', 'sort_order': 9},
    {'name': 'Galaxy',   'emoji': '🌌',  'animation_type': 'rain',    'coin_cost': 1000, 'usd_value': 7.00,   'category': 'legendary', 'sort_order': 10},
    {'name': 'VIP King', 'emoji': '🤴',  'animation_type': 'explode', 'coin_cost': 5000, 'usd_value': 35.00,  'category': 'legendary', 'sort_order': 11},
]


def _seed_gifts():
    if GiftItem.query.count() == 0:
        for g in DEFAULT_GIFTS:
            db.session.add(GiftItem(**g))
        db.session.commit()


def _get_or_create_wallet(user_id):
    wallet = EscrowWallet.query.filter_by(user_id=user_id).first()
    if not wallet:
        wallet = EscrowWallet(user_id=user_id)
        db.session.add(wallet)
        db.session.commit()
    return wallet


# ── Catalog ────────────────────────────────────────────────────────────────────
@gifts_bp.route('/catalog', methods=['GET'])
@jwt_required()
def get_catalog():
    _seed_gifts()
    items = GiftItem.query.filter_by(is_active=True).order_by(GiftItem.sort_order).all()
    wallet_id = get_jwt_identity()
    wallet = _get_or_create_wallet(wallet_id)
    return jsonify({'gifts': [g.to_dict() for g in items], 'coin_balance': wallet.coin_balance}), 200


# ── Wallet ─────────────────────────────────────────────────────────────────────
@gifts_bp.route('/wallet', methods=['GET'])
@jwt_required()
def get_wallet():
    user_id = get_jwt_identity()
    wallet = _get_or_create_wallet(user_id)
    deposits = WalletDeposit.query.filter_by(user_id=user_id).order_by(WalletDeposit.created_at.desc()).limit(30).all()
    withdrawals = WithdrawalRequest.query.filter_by(user_id=user_id).order_by(WithdrawalRequest.requested_at.desc()).limit(30).all()
    sent = GiftTransaction.query.filter_by(sender_id=user_id).order_by(GiftTransaction.created_at.desc()).limit(20).all()
    received = GiftTransaction.query.filter_by(recipient_id=user_id).order_by(GiftTransaction.created_at.desc()).limit(20).all()
    return jsonify({
        'wallet': wallet.to_dict(),
        'deposits': [d.to_dict() for d in deposits],
        'withdrawals': [w.to_dict() for w in withdrawals],
        'gifts_sent': [t.to_dict() for t in sent],
        'gifts_received': [t.to_dict() for t in received],
    }), 200


# ── Deposit: Stripe ────────────────────────────────────────────────────────────
@gifts_bp.route('/deposit/stripe', methods=['POST'])
@jwt_required()
def deposit_stripe():
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if not stripe_lib.api_key:
            return jsonify({'error': 'Stripe not configured on this server'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        amount_usd = float(data.get('amount_usd', 0))
        if amount_usd < 1:
            return jsonify({'error': 'Minimum deposit is $1.00'}), 400

        coins = int(amount_usd * COINS_PER_USD)
        deposit = WalletDeposit(user_id=user_id, provider='stripe',
                                 amount_usd=amount_usd, coins_credited=coins, status='pending')
        db.session.add(deposit)
        db.session.commit()

        base_url = request.host_url.rstrip('/')
        session = stripe_lib.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{'price_data': {
                'currency': 'usd',
                'product_data': {'name': f'VipChat Gift Coins — {coins:,} coins',
                                 'description': 'Top up your VipChat gift wallet'},
                'unit_amount': int(amount_usd * 100),
            }, 'quantity': 1}],
            mode='payment',
            success_url=f'{base_url}/gift-wallet?deposit_success=1&deposit_id={deposit.id}',
            cancel_url=f'{base_url}/gift-wallet',
            metadata={'user_id': str(user_id), 'deposit_id': str(deposit.id), 'coins': str(coins)},
        )
        deposit.provider_ref = session.id
        db.session.commit()
        return jsonify({'checkout_url': session.url, 'deposit_id': deposit.id}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Deposit: Flutterwave ───────────────────────────────────────────────────────
@gifts_bp.route('/deposit/flutterwave', methods=['POST'])
@jwt_required()
def deposit_flutterwave():
    try:
        import requests as req
        secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
        if not secret:
            return jsonify({'error': 'Flutterwave not configured'}), 503

        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.json or {}
        amount_usd = float(data.get('amount_usd', 0))
        if amount_usd < 1:
            return jsonify({'error': 'Minimum deposit is $1.00'}), 400

        coins = int(amount_usd * COINS_PER_USD)
        tx_ref = f'vipchat-coins-{uuid.uuid4().hex[:12]}'
        deposit = WalletDeposit(user_id=user_id, provider='flutterwave', provider_ref=tx_ref,
                                 amount_usd=amount_usd, coins_credited=coins, status='pending')
        db.session.add(deposit)
        db.session.commit()

        base_url = request.host_url.rstrip('/')
        payload = {
            'tx_ref': tx_ref, 'amount': amount_usd, 'currency': 'USD',
            'redirect_url': f'{base_url}/gift-wallet?flw_tx_ref={tx_ref}&deposit_id={deposit.id}',
            'customer': {'email': user.email or f'{user.phone_number}@vipchat.app', 'name': user.full_name},
            'customizations': {'title': 'VipChat Gift Coins', 'description': f'{coins:,} coins'},
        }
        r = req.post('https://api.flutterwave.com/v3/payments', json=payload,
                     headers={'Authorization': f'Bearer {secret}'}, timeout=15)
        rdata = r.json()
        if rdata.get('status') == 'success':
            return jsonify({'payment_link': rdata['data']['link'], 'deposit_id': deposit.id}), 200
        return jsonify({'error': rdata.get('message', 'Flutterwave error')}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Deposit: PayPal ────────────────────────────────────────────────────────────
@gifts_bp.route('/deposit/paypal', methods=['POST'])
@jwt_required()
def deposit_paypal():
    try:
        import requests as req, base64
        client_id = os.environ.get('PAYPAL_CLIENT_ID', '')
        client_secret = os.environ.get('PAYPAL_CLIENT_SECRET', '')
        if not client_id or not client_secret:
            return jsonify({'error': 'PayPal not configured on this server'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        amount_usd = float(data.get('amount_usd', 0))
        if amount_usd < 1:
            return jsonify({'error': 'Minimum deposit is $1.00'}), 400

        coins = int(amount_usd * COINS_PER_USD)
        creds = base64.b64encode(f'{client_id}:{client_secret}'.encode()).decode()
        token_r = req.post('https://api-m.sandbox.paypal.com/v1/oauth2/token',
                            data={'grant_type': 'client_credentials'},
                            headers={'Authorization': f'Basic {creds}'}, timeout=15)
        access_token = token_r.json().get('access_token')

        deposit = WalletDeposit(user_id=user_id, provider='paypal',
                                 amount_usd=amount_usd, coins_credited=coins, status='pending')
        db.session.add(deposit)
        db.session.commit()

        base_url = request.host_url.rstrip('/')
        order_r = req.post('https://api-m.sandbox.paypal.com/v2/checkout/orders', json={
            'intent': 'CAPTURE',
            'purchase_units': [{'amount': {'currency_code': 'USD', 'value': f'{amount_usd:.2f}'}}],
            'application_context': {
                'return_url': f'{base_url}/gift-wallet?paypal_deposit_id={deposit.id}',
                'cancel_url': f'{base_url}/gift-wallet',
            }
        }, headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}, timeout=15)
        odata = order_r.json()
        approve_url = next((l['href'] for l in odata.get('links', []) if l['rel'] == 'approve'), None)
        deposit.provider_ref = odata.get('id')
        db.session.commit()
        if approve_url:
            return jsonify({'approve_url': approve_url, 'deposit_id': deposit.id}), 200
        return jsonify({'error': 'Could not create PayPal order'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Webhooks ───────────────────────────────────────────────────────────────────
@gifts_bp.route('/webhook/stripe', methods=['POST'])
def stripe_webhook():
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')
        payload = request.get_data()
        sig = request.headers.get('Stripe-Signature', '')
        try:
            event = stripe_lib.Webhook.construct_event(payload, sig, webhook_secret)
        except Exception:
            return jsonify({'error': 'Invalid signature'}), 400

        if event['type'] == 'checkout.session.completed':
            meta = event['data']['object'].get('metadata', {})
            deposit_id = meta.get('deposit_id')
            if deposit_id:
                dep = WalletDeposit.query.get(deposit_id)
                if dep and dep.status == 'pending':
                    dep.status = 'completed'
                    dep.webhook_verified = True
                    dep.completed_at = datetime.utcnow()
                    w = _get_or_create_wallet(dep.user_id)
                    w.coin_balance += dep.coins_credited
                    w.total_spent_usd += dep.amount_usd
                    db.session.commit()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@gifts_bp.route('/webhook/flutterwave', methods=['POST'])
def flutterwave_webhook():
    try:
        secret_hash = current_app.config.get('FLUTTERWAVE_WEBHOOK_HASH', '')
        sig = request.headers.get('Verif-Hash', '')
        if secret_hash and sig != secret_hash:
            return jsonify({'error': 'Invalid signature'}), 400
        data = request.json or {}
        if data.get('status') == 'successful':
            tx_ref = (data.get('data') or {}).get('tx_ref', '')
            dep = WalletDeposit.query.filter_by(provider_ref=tx_ref, provider='flutterwave').first()
            if dep and dep.status == 'pending':
                dep.status = 'completed'
                dep.webhook_verified = True
                dep.completed_at = datetime.utcnow()
                w = _get_or_create_wallet(dep.user_id)
                w.coin_balance += dep.coins_credited
                w.total_spent_usd += dep.amount_usd
                db.session.commit()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@gifts_bp.route('/webhook/paypal', methods=['POST'])
def paypal_webhook():
    try:
        data = request.json or {}
        if data.get('event_type') == 'CHECKOUT.ORDER.APPROVED':
            order_id = (data.get('resource') or {}).get('id', '')
            dep = WalletDeposit.query.filter_by(provider_ref=order_id, provider='paypal').first()
            if dep and dep.status == 'pending':
                dep.status = 'completed'
                dep.webhook_verified = True
                dep.completed_at = datetime.utcnow()
                w = _get_or_create_wallet(dep.user_id)
                w.coin_balance += dep.coins_credited
                w.total_spent_usd += dep.amount_usd
                db.session.commit()
        return jsonify({'status': 'ok'}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Verify deposit after redirect ──────────────────────────────────────────────
@gifts_bp.route('/deposit/<deposit_id>/verify', methods=['POST'])
@jwt_required()
def verify_deposit(deposit_id):
    user_id = get_jwt_identity()
    dep = WalletDeposit.query.filter_by(id=deposit_id, user_id=user_id).first_or_404()
    if dep.status == 'completed':
        return jsonify({'status': 'completed', 'coins': dep.coins_credited}), 200

    if dep.provider == 'flutterwave' and dep.provider_ref:
        try:
            import requests as req
            secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
            r = req.get(f'https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref={dep.provider_ref}',
                        headers={'Authorization': f'Bearer {secret}'}, timeout=10)
            if (r.json().get('data') or {}).get('status') == 'successful':
                dep.status = 'completed'
                dep.completed_at = datetime.utcnow()
                w = _get_or_create_wallet(user_id)
                w.coin_balance += dep.coins_credited
                w.total_spent_usd += dep.amount_usd
                db.session.commit()
                return jsonify({'status': 'completed', 'coins': dep.coins_credited}), 200
        except Exception:
            pass
    return jsonify({'status': dep.status}), 200


# ── Send Gift ──────────────────────────────────────────────────────────────────
@gifts_bp.route('/send', methods=['POST'])
@jwt_required()
def send_gift():
    user_id = get_jwt_identity()
    data = request.json or {}
    gift_id = data.get('gift_id')
    recipient_id = data.get('recipient_id')
    quantity = max(1, min(int(data.get('quantity', 1)), 100))
    context = data.get('context', 'live')
    context_id = data.get('context_id')
    message = (data.get('message') or '')[:200]
    is_anonymous = bool(data.get('is_anonymous', False))

    if not gift_id or not recipient_id:
        return jsonify({'error': 'gift_id and recipient_id are required'}), 400
    if user_id == recipient_id:
        return jsonify({'error': 'You cannot gift yourself'}), 400

    gift = GiftItem.query.filter_by(id=gift_id, is_active=True).first()
    if not gift:
        return jsonify({'error': 'Gift not found'}), 404
    recipient = User.query.get(recipient_id)
    if not recipient:
        return jsonify({'error': 'Recipient not found'}), 404

    sender_wallet = _get_or_create_wallet(user_id)
    if sender_wallet.is_locked:
        return jsonify({'error': 'Your wallet is locked. Contact support.'}), 403

    total_coins = gift.coin_cost * quantity
    if sender_wallet.coin_balance < total_coins:
        return jsonify({'error': 'Insufficient coins', 'needed': total_coins, 'have': sender_wallet.coin_balance}), 402

    platform_fee = gift.usd_value * gift.platform_fee_pct * quantity
    creator_usd = gift.usd_value * (1 - gift.platform_fee_pct) * quantity

    sender_wallet.coin_balance -= total_coins
    sender_wallet.total_gifted_coins += total_coins

    recipient_wallet = _get_or_create_wallet(recipient_id)
    recipient_wallet.usd_earned += creator_usd
    recipient_wallet.total_received_usd += creator_usd

    txn = GiftTransaction(
        sender_id=user_id, recipient_id=recipient_id, gift_item_id=gift_id,
        quantity=quantity, coins_deducted=total_coins, usd_credited=creator_usd,
        platform_fee_usd=platform_fee, context=context, context_id=context_id,
        message=message, is_anonymous=is_anonymous,
    )
    db.session.add(txn)
    db.session.commit()

    try:
        socketio = current_app.extensions.get('socketio')
        if socketio:
            payload = txn.to_dict()
            socketio.emit('gift_received', {'transaction': payload, 'context': context, 'context_id': context_id},
                          room=f'user_{recipient_id}')
            if context_id:
                socketio.emit('gift_event', payload, room=f'{context}_{context_id}')
    except Exception:
        pass

    return jsonify({'transaction': txn.to_dict(), 'new_balance': sender_wallet.coin_balance}), 201


# ── Leaderboard (per context) ──────────────────────────────────────────────────
@gifts_bp.route('/leaderboard', methods=['GET'])
def gift_leaderboard():
    context = request.args.get('context', 'live')
    context_id = request.args.get('context_id')
    limit = min(int(request.args.get('limit', 10)), 50)

    q = (db.session.query(
        GiftTransaction.sender_id,
        func.sum(GiftTransaction.coins_deducted).label('total_coins'),
        func.count(GiftTransaction.id).label('gift_count'),
    ).filter(GiftTransaction.context == context))
    if context_id:
        q = q.filter(GiftTransaction.context_id == context_id)
    rows = q.group_by(GiftTransaction.sender_id).order_by(func.sum(GiftTransaction.coins_deducted).desc()).limit(limit).all()

    result = []
    for row in rows:
        u = User.query.get(row.sender_id)
        if u:
            result.append({'user_id': u.id, 'user_name': u.full_name, 'user_avatar': u.avatar_url,
                           'total_coins': int(row.total_coins), 'gift_count': int(row.gift_count)})
    return jsonify({'leaderboard': result}), 200


# ── Top Gifters / Earners ──────────────────────────────────────────────────────
@gifts_bp.route('/top-gifters', methods=['GET'])
def top_gifters():
    limit = min(int(request.args.get('limit', 20)), 100)
    rows = (db.session.query(GiftTransaction.sender_id,
                              func.sum(GiftTransaction.coins_deducted).label('tc'),
                              func.count(GiftTransaction.id).label('gc'))
            .group_by(GiftTransaction.sender_id).order_by(func.sum(GiftTransaction.coins_deducted).desc()).limit(limit).all())
    result = []
    for row in rows:
        u = User.query.get(row.sender_id)
        if u:
            result.append({'user_id': u.id, 'user_name': u.full_name, 'user_avatar': u.avatar_url,
                           'total_coins': int(row.tc), 'gift_count': int(row.gc)})
    return jsonify({'top_gifters': result}), 200


@gifts_bp.route('/top-earners', methods=['GET'])
def top_earners():
    limit = min(int(request.args.get('limit', 20)), 100)
    rows = (db.session.query(GiftTransaction.recipient_id,
                              func.sum(GiftTransaction.usd_credited).label('tusd'),
                              func.count(GiftTransaction.id).label('gc'))
            .group_by(GiftTransaction.recipient_id).order_by(func.sum(GiftTransaction.usd_credited).desc()).limit(limit).all())
    result = []
    for row in rows:
        u = User.query.get(row.recipient_id)
        if u:
            result.append({'user_id': u.id, 'user_name': u.full_name, 'user_avatar': u.avatar_url,
                           'total_usd': round(float(row.tusd), 2), 'gift_count': int(row.gc)})
    return jsonify({'top_earners': result}), 200


# ── Withdrawal ─────────────────────────────────────────────────────────────────
@gifts_bp.route('/withdraw', methods=['POST'])
@jwt_required()
def request_withdrawal():
    user_id = get_jwt_identity()
    data = request.json or {}
    amount_usd = float(data.get('amount_usd', 0))
    method = data.get('method', '')
    payout_details = data.get('payout_details', {})

    if method not in ('paypal', 'stripe', 'flutterwave'):
        return jsonify({'error': 'Method must be paypal, stripe, or flutterwave'}), 400
    if amount_usd < MIN_WITHDRAW_USD:
        return jsonify({'error': f'Minimum withdrawal is ${MIN_WITHDRAW_USD:.2f}'}), 400

    wallet = _get_or_create_wallet(user_id)
    if wallet.usd_earned < amount_usd:
        return jsonify({'error': f'Insufficient earnings. You have ${wallet.usd_earned:.2f}'}), 402

    wallet.usd_earned -= amount_usd
    req_obj = WithdrawalRequest(user_id=user_id, amount_usd=amount_usd, method=method,
                                 payout_details=json.dumps(payout_details), status='pending')
    db.session.add(req_obj)
    db.session.commit()
    return jsonify({'request': req_obj.to_dict(), 'remaining_earnings': round(wallet.usd_earned, 2)}), 201


# ── Admin: all withdrawal requests ────────────────────────────────────────────
@gifts_bp.route('/admin/withdrawals', methods=['GET'])
@jwt_required()
def admin_withdrawals():
    from functools import wraps
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403
    status = request.args.get('status', 'pending')
    reqs = WithdrawalRequest.query.filter_by(status=status).order_by(WithdrawalRequest.requested_at.desc()).all()
    return jsonify({'withdrawals': [r.to_dict() for r in reqs]}), 200


@gifts_bp.route('/admin/withdrawals/<req_id>', methods=['PUT'])
@jwt_required()
def admin_process_withdrawal(req_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403
    data = request.json or {}
    action = data.get('action')  # approve | reject | paid
    req_obj = WithdrawalRequest.query.get_or_404(req_id)
    if action == 'approve':
        req_obj.status = 'approved'
    elif action == 'reject':
        req_obj.status = 'rejected'
        req_obj.admin_note = data.get('note', '')
        # Refund earnings
        wallet = _get_or_create_wallet(req_obj.user_id)
        wallet.usd_earned += req_obj.amount_usd
    elif action == 'paid':
        req_obj.status = 'paid'
        req_obj.provider_ref = data.get('provider_ref', '')
    else:
        return jsonify({'error': 'Invalid action'}), 400
    req_obj.processed_by = user_id
    req_obj.processed_at = datetime.utcnow()
    db.session.commit()
    return jsonify({'withdrawal': req_obj.to_dict()}), 200


# ── Admin: gift catalog management ────────────────────────────────────────────
@gifts_bp.route('/admin/catalog', methods=['POST'])
@jwt_required()
def admin_create_gift():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403
    data = request.json or {}
    gift = GiftItem(
        name=data['name'], emoji=data['emoji'],
        animation_type=data.get('animation_type', 'float'),
        coin_cost=int(data['coin_cost']), usd_value=float(data['usd_value']),
        platform_fee_pct=float(data.get('platform_fee_pct', 0.30)),
        category=data.get('category', 'basic'), sort_order=int(data.get('sort_order', 99)),
    )
    db.session.add(gift)
    db.session.commit()
    return jsonify({'gift': gift.to_dict()}), 201


@gifts_bp.route('/admin/catalog/<gift_id>', methods=['PUT'])
@jwt_required()
def admin_update_gift(gift_id):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_admin:
        return jsonify({'error': 'Admin only'}), 403
    gift = GiftItem.query.get_or_404(gift_id)
    data = request.json or {}
    for field in ('name', 'emoji', 'animation_type', 'category'):
        if field in data:
            setattr(gift, field, data[field])
    for field in ('coin_cost', 'sort_order'):
        if field in data:
            setattr(gift, field, int(data[field]))
    for field in ('usd_value', 'platform_fee_pct'):
        if field in data:
            setattr(gift, field, float(data[field]))
    if 'is_active' in data:
        gift.is_active = bool(data['is_active'])
    db.session.commit()
    return jsonify({'gift': gift.to_dict()}), 200
