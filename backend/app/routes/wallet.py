"""
VipChat Digital Wallet — real endpoints for balance, top-up (Stripe/PayPal/Flutterwave/Crypto),
send between users, withdraw requests, and transaction history.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity, verify_jwt_in_request
from app.models.models import db, User
from datetime import datetime, timedelta
import uuid, json, os

wallet_bp = Blueprint('wallet', __name__, url_prefix='/api/wallet')

# ── Inline models (SQLite-compatible) ─────────────────────────────────────────
from sqlalchemy import Column, String, Float, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship


class WalletAccount(db.Model):
    __tablename__ = 'wallet_accounts'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), unique=True, nullable=False)
    balance_usd = Column(Float, default=0.0, nullable=False)
    btc_address = Column(String(64))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'balance_usd': round(self.balance_usd, 2),
            'btc_address': self.btc_address,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class WalletTransaction(db.Model):
    __tablename__ = 'wallet_transactions'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    wallet_id = Column(String(36), ForeignKey('wallet_accounts.id'), nullable=False)
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    type = Column(String(32), nullable=False)  # topup | send | receive | withdraw | refund | ad_earn | fee
    provider = Column(String(32))  # stripe | paypal | flutterwave | coinbase | internal
    amount_usd = Column(Float, nullable=False)
    fee_usd = Column(Float, default=0.0)
    net_usd = Column(Float, nullable=False)
    status = Column(String(32), default='pending')  # pending | completed | failed | refunded
    description = Column(Text)
    provider_ref = Column(String(128))
    counterpart_user_id = Column(String(36))
    counterpart_name = Column(String(128))
    metadata_json = Column(Text, default='{}')
    created_at = Column(DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'type': self.type,
            'provider': self.provider,
            'amount_usd': round(self.amount_usd, 2),
            'fee_usd': round(self.fee_usd, 4),
            'net_usd': round(self.net_usd, 2),
            'status': self.status,
            'description': self.description,
            'counterpart_name': self.counterpart_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class WithdrawRequest(db.Model):
    __tablename__ = 'withdraw_requests'
    __table_args__ = {'extend_existing': True}
    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    wallet_id = Column(String(36), ForeignKey('wallet_accounts.id'), nullable=False)
    amount_usd = Column(Float, nullable=False)
    method = Column(String(32), nullable=False)  # paypal | bank | crypto
    destination = Column(Text, nullable=False)  # email/account/address
    status = Column(String(32), default='pending')  # pending | approved | completed | rejected
    admin_note = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime)

    def to_dict(self):
        return {
            'id': self.id,
            'amount_usd': round(self.amount_usd, 2),
            'method': self.method,
            'destination': self.destination[:6] + '***' if self.destination else '',
            'status': self.status,
            'admin_note': self.admin_note,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


FEE_PCT = 0.02  # 2% platform fee on sends


def _get_or_create_wallet(user_id):
    w = WalletAccount.query.filter_by(user_id=user_id).first()
    if not w:
        w = WalletAccount(user_id=user_id, balance_usd=0.0)
        db.session.add(w)
        db.session.commit()
    return w


# ── GET balance ───────────────────────────────────────────────────────────────
@wallet_bp.route('/balance', methods=['GET'])
@jwt_required()
def get_balance():
    try:
        user_id = get_jwt_identity()
        wallet = _get_or_create_wallet(user_id)
        recent = WalletTransaction.query.filter_by(
            user_id=user_id
        ).order_by(WalletTransaction.created_at.desc()).limit(20).all()
        return jsonify({
            'wallet': wallet.to_dict(),
            'recent_transactions': [t.to_dict() for t in recent],
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Transaction history ───────────────────────────────────────────────────────
@wallet_bp.route('/transactions', methods=['GET'])
@jwt_required()
def list_transactions():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = 25
        q = WalletTransaction.query.filter_by(user_id=user_id).order_by(
            WalletTransaction.created_at.desc()
        )
        total = q.count()
        txns = q.offset((page - 1) * per_page).limit(per_page).all()
        return jsonify({
            'transactions': [t.to_dict() for t in txns],
            'total': total,
            'page': page,
            'pages': (total + per_page - 1) // per_page,
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Top-up via Stripe ─────────────────────────────────────────────────────────
@wallet_bp.route('/topup/stripe', methods=['POST'])
@jwt_required()
def topup_stripe():
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if not stripe_lib.api_key:
            return jsonify({'error': 'Stripe not configured'}), 503

        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.json or {}
        amount_usd = float(data.get('amount', 10))
        if amount_usd < 1 or amount_usd > 10000:
            return jsonify({'error': 'Amount must be between $1 and $10,000'}), 400

        wallet = _get_or_create_wallet(user_id)
        txn = WalletTransaction(
            wallet_id=wallet.id, user_id=user_id,
            type='topup', provider='stripe',
            amount_usd=amount_usd, fee_usd=0, net_usd=amount_usd,
            status='pending',
            description=f'Top-up via Stripe — ${amount_usd:.2f}',
        )
        db.session.add(txn)
        db.session.commit()

        base = request.host_url.rstrip('/')
        session = stripe_lib.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {'name': f'VipChat Wallet Top-up — ${amount_usd:.2f}'},
                    'unit_amount': int(amount_usd * 100),
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{base}/wallet?topup=success&txn_id={txn.id}',
            cancel_url=f'{base}/wallet?topup=cancel',
            metadata={'user_id': user_id, 'txn_id': txn.id, 'purpose': 'wallet_topup'},
            customer_email=getattr(user, 'email', None) or 'noemail@vipchat.app',
        )
        txn.provider_ref = session.id
        db.session.commit()
        return jsonify({'url': session.url, 'txn_id': txn.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Top-up via PayPal ─────────────────────────────────────────────────────────
@wallet_bp.route('/topup/paypal/create', methods=['POST'])
@jwt_required()
def topup_paypal_create():
    try:
        from app.services.monetization import PayPalPaymentProcessor
        client_id = current_app.config.get('PAYPAL_CLIENT_ID', '').strip()
        client_secret = current_app.config.get('PAYPAL_CLIENT_SECRET', '').strip()
        if not client_id or not client_secret:
            return jsonify({'error': 'PayPal not configured'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        amount_usd = float(data.get('amount', 10))
        if amount_usd < 1 or amount_usd > 10000:
            return jsonify({'error': 'Amount must be $1–$10,000'}), 400

        wallet = _get_or_create_wallet(user_id)
        txn = WalletTransaction(
            wallet_id=wallet.id, user_id=user_id,
            type='topup', provider='paypal',
            amount_usd=amount_usd, fee_usd=0, net_usd=amount_usd,
            status='pending',
            description=f'Top-up via PayPal — ${amount_usd:.2f}',
        )
        db.session.add(txn)
        db.session.commit()

        sandbox = current_app.config.get('PAYPAL_SANDBOX', 'false').lower() == 'true'
        pp = PayPalPaymentProcessor(client_id, client_secret, sandbox=sandbox)
        base = request.host_url.rstrip('/')
        order_data = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {'currency_code': 'USD', 'value': f'{amount_usd:.2f}'},
                'description': f'VipChat Wallet Top-up ${amount_usd:.2f}',
                'reference_id': txn.id,
            }],
            'application_context': {
                'return_url': f'{base}/wallet?topup=success&provider=paypal&txn_id={txn.id}',
                'cancel_url': f'{base}/wallet?topup=cancel',
            },
        }
        access_token = pp._get_access_token()
        api_base = 'https://api-m.sandbox.paypal.com' if sandbox else 'https://api-m.paypal.com'
        import requests as rq
        resp = rq.post(f'{api_base}/v2/checkout/orders', json=order_data,
                       headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}, timeout=15)
        order = resp.json()
        approval_url = next((l['href'] for l in order.get('links', []) if l['rel'] == 'approve'), None)
        txn.provider_ref = order.get('id')
        db.session.commit()
        return jsonify({'order_id': order.get('id'), 'approve_url': approval_url, 'txn_id': txn.id}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wallet_bp.route('/topup/paypal/capture', methods=['POST'])
@jwt_required()
def topup_paypal_capture():
    try:
        from app.services.monetization import PayPalPaymentProcessor
        user_id = get_jwt_identity()
        data = request.json or {}
        order_id = data.get('order_id')
        txn_id = data.get('txn_id')
        if not order_id or not txn_id:
            return jsonify({'error': 'order_id and txn_id required'}), 400

        txn = WalletTransaction.query.filter_by(id=txn_id, user_id=user_id).first()
        if not txn or txn.status == 'completed':
            return jsonify({'error': 'Transaction not found or already processed'}), 400

        client_id = current_app.config.get('PAYPAL_CLIENT_ID', '').strip()
        client_secret = current_app.config.get('PAYPAL_CLIENT_SECRET', '').strip()
        sandbox = current_app.config.get('PAYPAL_SANDBOX', 'false').lower() == 'true'
        pp = PayPalPaymentProcessor(client_id, client_secret, sandbox=sandbox)
        access_token = pp._get_access_token()
        api_base = 'https://api-m.sandbox.paypal.com' if sandbox else 'https://api-m.paypal.com'
        import requests as rq
        resp = rq.post(f'{api_base}/v2/checkout/orders/{order_id}/capture',
                       headers={'Authorization': f'Bearer {access_token}', 'Content-Type': 'application/json'}, timeout=15)
        captured = resp.json()
        if captured.get('status') == 'COMPLETED':
            txn.status = 'completed'
            wallet = WalletAccount.query.get(txn.wallet_id)
            wallet.balance_usd = (wallet.balance_usd or 0) + txn.net_usd
            db.session.commit()
            return jsonify({'success': True, 'balance': wallet.balance_usd}), 200
        return jsonify({'error': 'Capture not completed', 'status': captured.get('status')}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Top-up via Flutterwave ────────────────────────────────────────────────────
@wallet_bp.route('/topup/flutterwave/init', methods=['POST'])
@jwt_required()
def topup_flutterwave_init():
    try:
        fw_public = current_app.config.get('FLUTTERWAVE_PUBLIC_KEY', '')
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
        if not fw_public or not fw_secret:
            return jsonify({'error': 'Flutterwave not configured'}), 503

        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        data = request.json or {}
        amount_usd = float(data.get('amount', 10))
        if amount_usd < 1 or amount_usd > 10000:
            return jsonify({'error': 'Amount must be $1–$10,000'}), 400

        wallet = _get_or_create_wallet(user_id)
        tx_ref = f'vcwallet-{user_id[:8]}-{uuid.uuid4().hex[:8]}'
        txn = WalletTransaction(
            wallet_id=wallet.id, user_id=user_id,
            type='topup', provider='flutterwave',
            amount_usd=amount_usd, fee_usd=0, net_usd=amount_usd,
            status='pending', provider_ref=tx_ref,
            description=f'Top-up via Flutterwave — ${amount_usd:.2f}',
        )
        db.session.add(txn)
        db.session.commit()
        return jsonify({
            'tx_ref': tx_ref, 'public_key': fw_public,
            'amount': amount_usd, 'currency': 'USD',
            'txn_id': txn.id,
            'customer_email': getattr(user, 'email', '') or '',
            'customer_name': getattr(user, 'full_name', '') or 'VipChat User',
            'customer_phone': getattr(user, 'phone_number', '') or '',
            'description': f'VipChat Wallet Top-up ${amount_usd:.2f}',
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wallet_bp.route('/topup/flutterwave/verify/<tx_ref>', methods=['POST'])
@jwt_required()
def topup_flutterwave_verify(tx_ref):
    try:
        import requests as rq
        user_id = get_jwt_identity()
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
        if not fw_secret:
            return jsonify({'error': 'Flutterwave not configured'}), 503
        txn = WalletTransaction.query.filter_by(provider_ref=tx_ref, user_id=user_id).first()
        if not txn:
            return jsonify({'error': 'Transaction not found'}), 404
        if txn.status == 'completed':
            return jsonify({'success': True}), 200
        resp = rq.get(f'https://api.flutterwave.com/v3/transactions?tx_ref={tx_ref}',
                      headers={'Authorization': f'Bearer {fw_secret}'}, timeout=15)
        fw_data = resp.json()
        transactions = fw_data.get('data', [])
        if not transactions:
            return jsonify({'error': 'No transaction found'}), 400
        tx = transactions[0]
        if tx.get('status') == 'successful':
            actual = float(tx.get('amount', 0))
            if abs(actual - txn.amount_usd) > 0.5:
                return jsonify({'error': 'Amount mismatch'}), 400
            txn.status = 'completed'
            wallet = WalletAccount.query.get(txn.wallet_id)
            wallet.balance_usd = (wallet.balance_usd or 0) + txn.net_usd
            db.session.commit()
            return jsonify({'success': True, 'balance': wallet.balance_usd}), 200
        return jsonify({'error': f'Status: {tx.get("status")}'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Top-up via Coinbase Commerce (Bitcoin/Crypto) ─────────────────────────────
@wallet_bp.route('/topup/crypto/create', methods=['POST'])
@jwt_required()
def topup_crypto_create():
    """Create a Coinbase Commerce charge for Bitcoin/ETH/USDC top-up."""
    try:
        import requests as rq
        api_key = current_app.config.get('COINBASE_COMMERCE_API_KEY', '')
        if not api_key:
            return jsonify({'error': 'Crypto payments not configured. Set COINBASE_COMMERCE_API_KEY.'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        amount_usd = float(data.get('amount', 10))
        if amount_usd < 1 or amount_usd > 10000:
            return jsonify({'error': 'Amount must be $1–$10,000'}), 400

        wallet = _get_or_create_wallet(user_id)
        txn = WalletTransaction(
            wallet_id=wallet.id, user_id=user_id,
            type='topup', provider='coinbase',
            amount_usd=amount_usd, fee_usd=0, net_usd=amount_usd,
            status='pending',
            description=f'Top-up via Crypto — ${amount_usd:.2f}',
        )
        db.session.add(txn)
        db.session.commit()

        base = request.host_url.rstrip('/')
        charge_data = {
            'name': f'VipChat Wallet Top-up',
            'description': f'Add ${amount_usd:.2f} to your VipChat wallet',
            'local_price': {'amount': str(amount_usd), 'currency': 'USD'},
            'pricing_type': 'fixed_price',
            'metadata': {'user_id': user_id, 'txn_id': txn.id},
            'redirect_url': f'{base}/wallet?topup=success&provider=crypto&txn_id={txn.id}',
            'cancel_url': f'{base}/wallet?topup=cancel',
        }
        resp = rq.post('https://api.commerce.coinbase.com/charges', json=charge_data,
                       headers={'X-CC-Api-Key': api_key, 'X-CC-Version': '2018-03-22',
                                'Content-Type': 'application/json'}, timeout=15)
        charge = resp.json().get('data', {})
        charge_id = charge.get('id')
        hosted_url = charge.get('hosted_url')
        txn.provider_ref = charge_id
        db.session.commit()
        return jsonify({
            'charge_id': charge_id,
            'hosted_url': hosted_url,
            'txn_id': txn.id,
            'accepted_currencies': ['BTC', 'ETH', 'USDC', 'DAI', 'LTC'],
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@wallet_bp.route('/topup/crypto/check/<txn_id>', methods=['GET'])
@jwt_required()
def topup_crypto_check(txn_id):
    """Poll Coinbase Commerce charge status."""
    try:
        import requests as rq
        api_key = current_app.config.get('COINBASE_COMMERCE_API_KEY', '')
        user_id = get_jwt_identity()
        txn = WalletTransaction.query.filter_by(id=txn_id, user_id=user_id).first()
        if not txn:
            return jsonify({'error': 'Transaction not found'}), 404
        if txn.status == 'completed':
            return jsonify({'status': 'completed'}), 200
        if not txn.provider_ref:
            return jsonify({'status': txn.status}), 200

        resp = rq.get(f'https://api.commerce.coinbase.com/charges/{txn.provider_ref}',
                      headers={'X-CC-Api-Key': api_key, 'X-CC-Version': '2018-03-22'}, timeout=15)
        charge = resp.json().get('data', {})
        timeline = charge.get('timeline', [])
        completed = any(e.get('status') in ('COMPLETED', 'CONFIRMED') for e in timeline)
        if completed:
            txn.status = 'completed'
            wallet = WalletAccount.query.get(txn.wallet_id)
            wallet.balance_usd = (wallet.balance_usd or 0) + txn.net_usd
            db.session.commit()
        return jsonify({'status': 'completed' if completed else txn.status, 'charge': charge.get('code')}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Stripe webhook for wallet top-ups ─────────────────────────────────────────
@wallet_bp.route('/topup/stripe/webhook', methods=['POST'])
def wallet_stripe_webhook():
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')
        if not webhook_secret:
            return jsonify({'error': 'Webhook not configured'}), 503
        payload = request.get_data()
        sig = request.headers.get('Stripe-Signature', '')
        event = stripe_lib.Webhook.construct_event(payload, sig, webhook_secret)
        if event['type'] == 'checkout.session.completed':
            session_obj = event['data']['object']
            meta = session_obj.get('metadata', {})
            if meta.get('purpose') == 'wallet_topup':
                txn_id = meta.get('txn_id')
                txn = WalletTransaction.query.get(txn_id)
                if txn and txn.status == 'pending' and session_obj.get('payment_status') == 'paid':
                    txn.status = 'completed'
                    wallet = WalletAccount.query.get(txn.wallet_id)
                    wallet.balance_usd = (wallet.balance_usd or 0) + txn.net_usd
                    db.session.commit()
        return jsonify({'received': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# ── Send money to another user ────────────────────────────────────────────────
@wallet_bp.route('/send', methods=['POST'])
@jwt_required()
def send_money():
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        recipient_phone = data.get('recipient_phone', '').strip()
        amount_usd = float(data.get('amount', 0))
        note = data.get('note', '')

        if amount_usd < 0.50:
            return jsonify({'error': 'Minimum send amount is $0.50'}), 400

        recipient = User.query.filter_by(phone_number=recipient_phone).first()
        if not recipient:
            return jsonify({'error': 'Recipient not found. Check the phone number.'}), 404
        if recipient.id == user_id:
            return jsonify({'error': 'Cannot send money to yourself'}), 400

        sender_wallet = _get_or_create_wallet(user_id)
        fee = round(amount_usd * FEE_PCT, 4)
        total_deducted = amount_usd + fee
        if sender_wallet.balance_usd < total_deducted:
            return jsonify({'error': f'Insufficient balance. Need ${total_deducted:.2f} (includes ${fee:.2f} fee)'}), 400

        recipient_wallet = _get_or_create_wallet(recipient.id)
        sender = User.query.get(user_id)

        # Deduct from sender
        sender_wallet.balance_usd -= total_deducted
        send_txn = WalletTransaction(
            wallet_id=sender_wallet.id, user_id=user_id,
            type='send', provider='internal',
            amount_usd=amount_usd, fee_usd=fee, net_usd=amount_usd,
            status='completed',
            description=note or f'Sent to {recipient.full_name}',
            counterpart_user_id=recipient.id,
            counterpart_name=recipient.full_name,
        )
        db.session.add(send_txn)

        # Credit recipient
        recipient_wallet.balance_usd += amount_usd
        recv_txn = WalletTransaction(
            wallet_id=recipient_wallet.id, user_id=recipient.id,
            type='receive', provider='internal',
            amount_usd=amount_usd, fee_usd=0, net_usd=amount_usd,
            status='completed',
            description=note or f'Received from {sender.full_name}',
            counterpart_user_id=user_id,
            counterpart_name=sender.full_name,
        )
        db.session.add(recv_txn)
        db.session.commit()

        return jsonify({
            'success': True,
            'sent': amount_usd,
            'fee': fee,
            'new_balance': round(sender_wallet.balance_usd, 2),
            'recipient_name': recipient.full_name,
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Withdraw request ──────────────────────────────────────────────────────────
@wallet_bp.route('/withdraw', methods=['POST'])
@jwt_required()
def request_withdraw():
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        amount_usd = float(data.get('amount', 0))
        method = data.get('method', 'paypal')  # paypal | bank | crypto
        destination = data.get('destination', '').strip()

        min_withdraw = 10.0
        if amount_usd < min_withdraw:
            return jsonify({'error': f'Minimum withdrawal is ${min_withdraw:.2f}'}), 400
        if not destination:
            return jsonify({'error': 'Destination required'}), 400
        if method not in ('paypal', 'bank', 'crypto'):
            return jsonify({'error': 'Method must be paypal, bank, or crypto'}), 400

        wallet = _get_or_create_wallet(user_id)
        if wallet.balance_usd < amount_usd:
            return jsonify({'error': 'Insufficient balance'}), 400

        # Reserve balance
        wallet.balance_usd -= amount_usd
        wr = WithdrawRequest(
            user_id=user_id, wallet_id=wallet.id,
            amount_usd=amount_usd, method=method, destination=destination,
        )
        db.session.add(wr)
        hold_txn = WalletTransaction(
            wallet_id=wallet.id, user_id=user_id,
            type='withdraw', provider=method,
            amount_usd=amount_usd, fee_usd=0, net_usd=amount_usd,
            status='pending',
            description=f'Withdrawal request via {method}',
        )
        db.session.add(hold_txn)
        db.session.commit()
        return jsonify({
            'success': True,
            'request_id': wr.id,
            'message': 'Withdrawal request submitted. Processed within 1-3 business days.',
            'new_balance': round(wallet.balance_usd, 2),
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


# ── Admin: list withdrawals ────────────────────────────────────────────────────
@wallet_bp.route('/admin/withdrawals', methods=['GET'])
@jwt_required()
def admin_withdrawals():
    try:
        user_id = get_jwt_identity()
        me = User.query.get(user_id)
        if not getattr(me, 'is_admin', False):
            return jsonify({'error': 'Admin only'}), 403
        status = request.args.get('status', 'pending')
        page = request.args.get('page', 1, type=int)
        q = WithdrawRequest.query
        if status != 'all':
            q = q.filter_by(status=status)
        total = q.count()
        reqs = q.order_by(WithdrawRequest.created_at.desc()).offset((page-1)*25).limit(25).all()
        return jsonify({'requests': [r.to_dict() for r in reqs], 'total': total, 'page': page}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@wallet_bp.route('/admin/withdrawals/<req_id>/process', methods=['POST'])
@jwt_required()
def admin_process_withdrawal(req_id):
    try:
        user_id = get_jwt_identity()
        me = User.query.get(user_id)
        if not getattr(me, 'is_admin', False):
            return jsonify({'error': 'Admin only'}), 403
        data = request.json or {}
        action = data.get('action')  # approve | reject
        note = data.get('note', '')
        wr = WithdrawRequest.query.get(req_id)
        if not wr:
            return jsonify({'error': 'Not found'}), 404
        wr.status = 'completed' if action == 'approve' else 'rejected'
        wr.admin_note = note
        wr.processed_at = datetime.utcnow()
        if action == 'reject':
            # Refund reserved balance
            wallet = WalletAccount.query.get(wr.wallet_id)
            wallet.balance_usd += wr.amount_usd
            refund_txn = WalletTransaction(
                wallet_id=wallet.id, user_id=wr.user_id,
                type='refund', provider='internal',
                amount_usd=wr.amount_usd, fee_usd=0, net_usd=wr.amount_usd,
                status='completed',
                description=f'Withdrawal rejected: {note or "no reason given"}',
            )
            db.session.add(refund_txn)
        db.session.commit()
        return jsonify({'success': True, 'status': wr.status}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
