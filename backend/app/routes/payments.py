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
            return jsonify({'error': 'Stripe is not configured on this server. Please contact support.'}), 503

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

        base_url = request.host_url.rstrip('/')

        session = stripe_lib.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'product_data': {
                        'name': f'VipChat {t["label"]} Badge',
                        'description': 'One-time fee to receive a verified ✅ badge on your VipChat profile',
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
        payment.metadata_json = json.dumps({'session_id': session.id})
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
    """
    Stripe sends a Stripe-Signature header with every webhook.
    We ALWAYS verify it — no unsigned fallback. Fail closed.
    """
    try:
        import stripe as stripe_lib
        stripe_lib.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

        if not webhook_secret:
            return jsonify({'error': 'Webhook secret not configured'}), 503

        payload = request.get_data()
        sig_header = request.headers.get('Stripe-Signature', '')

        try:
            event = stripe_lib.Webhook.construct_event(payload, sig_header, webhook_secret)
        except stripe_lib.error.SignatureVerificationError:
            return jsonify({'error': 'Invalid webhook signature'}), 400
        except Exception as parse_err:
            return jsonify({'error': f'Webhook parse error: {parse_err}'}), 400

        if event.get('type') == 'checkout.session.completed':
            session_obj = event['data']['object']
            meta = session_obj.get('metadata', {})
            user_id = meta.get('user_id')
            tier = meta.get('tier', 'personal')
            payment_id = meta.get('payment_id')

            if user_id and session_obj.get('payment_status') == 'paid':
                payment = Payment.query.get(payment_id) if payment_id else None
                if payment and payment.status == 'pending':
                    payment.status = 'completed'
                    payment.provider_payment_id = session_obj.get(
                        'payment_intent', payment.provider_payment_id
                    )
                    payment.metadata_json = json.dumps({
                        'stripe_session_id': session_obj.get('id'),
                        'payment_intent': session_obj.get('payment_intent'),
                        'payment_status': session_obj.get('payment_status'),
                    })
                    db.session.commit()
                _mark_user_verified(user_id, tier,
                                    session_obj.get('payment_intent', payment_id or ''))

        return jsonify({'received': True}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/flutterwave/initialize', methods=['POST'])
@jwt_required()
def flutterwave_initialize():
    try:
        fw_public = current_app.config.get('FLUTTERWAVE_PUBLIC_KEY', '')
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')

        if not fw_public or not fw_secret:
            return jsonify({'error': 'Flutterwave is not configured on this server. Please contact support.'}), 503

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
            metadata_json=json.dumps({'tx_ref': tx_ref}),
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
    """
    Called from frontend after Flutterwave inline checkout success callback.
    Always contacts Flutterwave's API to confirm the transaction — no dev shortcut.
    Requires FLUTTERWAVE_SECRET_KEY to be set; fails closed if missing.
    """
    try:
        import requests as http_req

        user_id = get_jwt_identity()
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')

        if not fw_secret:
            return jsonify({'error': 'Payment provider not configured. Contact support.'}), 503

        payment = Payment.query.filter(
            Payment.provider_payment_id == tx_ref,
            Payment.user_id == user_id,
        ).first()

        if not payment:
            return jsonify({'error': 'Payment record not found'}), 404

        if payment.status == 'completed':
            user = User.query.get(user_id)
            return jsonify({
                'verified': True,
                'badge_verified': bool(user.badge_verified) if user else True,
                'verification_tier': user.verification_tier if user else payment.tier,
            }), 200

        headers = {'Authorization': f'Bearer {fw_secret}'}
        resp = http_req.get(
            f'https://api.flutterwave.com/v3/transactions?tx_ref={tx_ref}',
            headers=headers,
            timeout=15,
        )

        if resp.status_code != 200:
            return jsonify({'error': 'Could not reach Flutterwave to verify payment'}), 502

        fw_data = resp.json()
        transactions = fw_data.get('data', [])

        if not transactions:
            return jsonify({'verified': False, 'error': 'No matching transaction found'}), 200

        tx = transactions[0]

        if tx.get('status') != 'successful':
            payment.status = 'failed'
            db.session.commit()
            return jsonify({'verified': False, 'error': f'Transaction status: {tx.get("status")}'}), 200

        actual_amount = float(tx.get('amount', 0))
        expected_amount = float(payment.amount)
        actual_currency = str(tx.get('currency', '')).upper()
        expected_currency = str(payment.currency).upper()

        if abs(actual_amount - expected_amount) > 0.01:
            payment.status = 'failed'
            db.session.commit()
            return jsonify({
                'verified': False,
                'error': f'Amount mismatch: paid {actual_amount} but expected {expected_amount}',
            }), 200

        if actual_currency != expected_currency:
            payment.status = 'failed'
            db.session.commit()
            return jsonify({
                'verified': False,
                'error': f'Currency mismatch: paid in {actual_currency} but expected {expected_currency}',
            }), 200

        flw_ref = tx.get('flw_ref', tx_ref)
        payment.status = 'completed'
        payment.provider_payment_id = flw_ref
        payment.metadata_json = json.dumps({
            'flw_ref': flw_ref,
            'tx_ref': tx_ref,
            'amount': actual_amount,
            'currency': actual_currency,
            'status': tx.get('status'),
        })
        db.session.commit()
        _mark_user_verified(user_id, payment.tier, flw_ref)

        user = User.query.get(user_id)
        return jsonify({
            'verified': True,
            'badge_verified': bool(user.badge_verified) if user else True,
            'verification_tier': user.verification_tier if user else payment.tier,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/flutterwave/webhook', methods=['POST'])
def flutterwave_webhook():
    """
    Flutterwave sends a verif-hash header set to the FLUTTERWAVE_WEBHOOK_HASH secret
    (configured separately in the Flutterwave dashboard — distinct from the API secret).
    Always verify; fail closed if hash is not configured.
    """
    try:
        webhook_hash = current_app.config.get('FLUTTERWAVE_WEBHOOK_HASH', '')
        fw_secret = current_app.config.get('FLUTTERWAVE_SECRET_KEY', '')

        if not webhook_hash:
            return jsonify({'error': 'Webhook hash not configured'}), 503

        verif_hash = request.headers.get('verif-hash', '')
        if verif_hash != webhook_hash:
            return jsonify({'error': 'Invalid webhook signature'}), 400

        data = request.json or {}
        event = data.get('event', '')

        if event == 'charge.completed':
            tx_data = data.get('data', {})
            status = tx_data.get('status', '')
            tx_ref = tx_data.get('tx_ref', '')
            flw_ref = tx_data.get('flw_ref', tx_ref)

            if status == 'successful' and tx_ref:
                payment = Payment.query.filter_by(provider_payment_id=tx_ref).first()
                if payment is None:
                    payment = Payment.query.filter_by(provider_payment_id=flw_ref).first()

                if payment and payment.status == 'pending':
                    actual_amount = float(tx_data.get('amount', 0))
                    expected_amount = float(payment.amount)
                    actual_currency = str(tx_data.get('currency', '')).upper()
                    expected_currency = str(payment.currency).upper()

                    amount_ok = abs(actual_amount - expected_amount) <= 0.01
                    currency_ok = actual_currency == expected_currency

                    if amount_ok and currency_ok:
                        payment.status = 'completed'
                        payment.provider_payment_id = flw_ref
                        payment.metadata_json = json.dumps({
                            'flw_ref': flw_ref,
                            'tx_ref': tx_ref,
                            'amount': actual_amount,
                            'currency': actual_currency,
                        })
                        db.session.commit()
                        _mark_user_verified(payment.user_id, payment.tier, flw_ref)
                    else:
                        payment.status = 'failed'
                        payment.metadata_json = json.dumps({
                            'error': 'amount or currency mismatch',
                            'actual_amount': actual_amount,
                            'expected_amount': expected_amount,
                            'actual_currency': actual_currency,
                            'expected_currency': expected_currency,
                        })
                        db.session.commit()

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
