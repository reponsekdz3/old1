from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User, Payment
from datetime import datetime
import json
import uuid

payments_bp = Blueprint('payments', __name__, url_prefix='/api/payments')

TIERS = {
    'personal': {'amount_usd': 2.99, 'amount_cents': 299, 'label': 'Personal Verified'},
    'business': {'amount_usd': 9.99, 'amount_cents': 999, 'label': 'Business Verified'},
}


def _mark_user_verified(user_id, tier, payment_ref):
    user = User.query.get(user_id)
    if user:
        user.badge_verified = True
        user.verification_tier = tier
        user.verified_at = datetime.utcnow()
        user.verification_payment_id = payment_ref
        db.session.commit()


@payments_bp.route('/stripe/create-checkout-session', methods=['POST'])
@jwt_required()
def create_stripe_session():
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')

        if not stripe_lib.api_key:
            return jsonify({'error': 'Stripe is not configured on this server'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        tier = data.get('tier', 'personal')

        if tier not in TIERS:
            return jsonify({'error': 'Invalid tier. Choose personal or business'}), 400

        t = TIERS[tier]
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        payment = Payment(
            user_id=user_id,
            provider='stripe',
            amount=t['amount_usd'],
            currency='USD',
            status='pending',
            tier=tier,
        )
        db.session.add(payment)
        db.session.commit()

        base_url = data.get('base_url', '')
        if not base_url:
            base_url = request.host_url.rstrip('/')

        session = stripe_lib.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'VipChat {t["label"]} Badge',
                        'description': f'One-time fee to receive a verified ✅ badge on your VipChat profile',
                    },
                    'unit_amount': t['amount_cents'],
                },
                'quantity': 1,
            }],
            mode='payment',
            success_url=f'{base_url}/settings?verified=success&payment_id={payment.id}',
            cancel_url=f'{base_url}/settings?verified=cancel',
            metadata={
                'user_id': user_id,
                'tier': tier,
                'payment_id': payment.id,
            },
            customer_email=user.email or None,
        )

        payment.provider_payment_id = session.id
        db.session.commit()

        return jsonify({
            'session_id': session.id,
            'url': session.url,
            'payment_id': payment.id,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/stripe/webhook', methods=['POST'])
def stripe_webhook():
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

        payload = request.get_data()
        sig_header = request.headers.get('Stripe-Signature', '')

        if webhook_secret:
            try:
                event = stripe_lib.Webhook.construct_event(payload, sig_header, webhook_secret)
            except stripe_lib.error.SignatureVerificationError:
                return jsonify({'error': 'Invalid signature'}), 400
        else:
            event = json.loads(payload)

        if event.get('type') == 'checkout.session.completed':
            session_obj = event['data']['object']
            meta = session_obj.get('metadata', {})
            user_id = meta.get('user_id')
            tier = meta.get('tier', 'personal')
            payment_id = meta.get('payment_id')

            if user_id and session_obj.get('payment_status') == 'paid':
                payment = Payment.query.get(payment_id) if payment_id else None
                if payment:
                    payment.status = 'completed'
                    db.session.commit()
                _mark_user_verified(user_id, tier, session_obj.get('payment_intent', payment_id or ''))

        return jsonify({'received': True}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/flutterwave/initialize', methods=['POST'])
@jwt_required()
def flutterwave_initialize():
    try:
        fw_public = current_app.config.get('FLUTTERWAVE_PUBLIC_KEY', '')
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')

        if not fw_public:
            return jsonify({'error': 'Flutterwave is not configured on this server'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        tier = data.get('tier', 'personal')

        if tier not in TIERS:
            return jsonify({'error': 'Invalid tier. Choose personal or business'}), 400

        t = TIERS[tier]
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        tx_ref = f'vipchat-{user_id[:8]}-{uuid.uuid4().hex[:8]}'

        payment = Payment(
            user_id=user_id,
            provider='flutterwave',
            amount=t['amount_usd'],
            currency='USD',
            status='pending',
            tier=tier,
            provider_payment_id=tx_ref,
        )
        db.session.add(payment)
        db.session.commit()

        return jsonify({
            'tx_ref': tx_ref,
            'public_key': fw_public,
            'amount': t['amount_usd'],
            'currency': 'USD',
            'plan_name': t['label'],
            'description': f'VipChat {t["label"]} Badge — one-time fee',
            'customer_email': user.email or '',
            'customer_name': user.full_name or 'VipChat User',
            'customer_phone': user.phone_number or '',
            'payment_id': payment.id,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/flutterwave/verify/<tx_ref>', methods=['POST'])
@jwt_required()
def flutterwave_verify(tx_ref):
    try:
        import requests as http_req

        user_id = get_jwt_identity()
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')

        payment = Payment.query.filter(
            Payment.provider_payment_id == tx_ref,
            Payment.user_id == user_id,
        ).first()

        if not payment:
            return jsonify({'error': 'Payment record not found'}), 404

        verified = False
        if fw_secret:
            headers = {'Authorization': f'Bearer {fw_secret}'}
            resp = http_req.get(
                f'https://api.flutterwave.com/v3/transactions?tx_ref={tx_ref}',
                headers=headers,
                timeout=10,
            )
            if resp.status_code == 200:
                fw_data = resp.json()
                transactions = fw_data.get('data', [])
                if transactions and transactions[0].get('status') == 'successful':
                    verified = True
        else:
            verified = True

        if verified:
            payment.status = 'completed'
            db.session.commit()
            _mark_user_verified(user_id, payment.tier, tx_ref)

        user = User.query.get(user_id)
        return jsonify({
            'verified': verified,
            'badge_verified': user.badge_verified if user else False,
            'verification_tier': user.verification_tier if user else None,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/flutterwave/webhook', methods=['POST'])
def flutterwave_webhook():
    try:
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')
        verif_hash = request.headers.get('verif-hash', '')

        if fw_secret and verif_hash != fw_secret:
            return jsonify({'error': 'Invalid signature'}), 400

        data = request.json or {}
        event = data.get('event', '')

        if event == 'charge.completed':
            tx_data = data.get('data', {})
            status = tx_data.get('status', '')
            tx_ref = tx_data.get('tx_ref', '')
            flw_ref = tx_data.get('flw_ref', tx_ref)

            if status == 'successful' and tx_ref:
                payment = Payment.query.filter_by(provider_payment_id=tx_ref).first()
                if payment and payment.status == 'pending':
                    payment.status = 'completed'
                    db.session.commit()
                    _mark_user_verified(payment.user_id, payment.tier, flw_ref)

        return jsonify({'status': 'success'}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/my-verification', methods=['GET'])
@jwt_required()
def my_verification():
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        payments = (
            Payment.query
            .filter_by(user_id=user_id)
            .order_by(Payment.created_at.desc())
            .all()
        )

        return jsonify({
            'badge_verified': bool(user.badge_verified),
            'verification_tier': user.verification_tier,
            'verified_at': user.verified_at.isoformat() if user.verified_at else None,
            'payment_history': [p.to_dict() for p in payments],
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500
