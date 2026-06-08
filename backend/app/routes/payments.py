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

        payment = Payment()
        payment.user_id = user_id
        payment.provider = 'stripe'
        payment.amount = t['amount_usd']
        payment.currency = 'USD'
        payment.status = 'pending'
        payment.tier = tier
        
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
                'user_id': str(user_id),
                'tier': tier,
                'payment_id': str(payment.id),
            },
            customer_email=user.email if user.email else 'noemail@vipchat.app',
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
        except Exception as sig_err:  # type: ignore
            if 'Signature' in str(sig_err):
                return jsonify({'error': 'Invalid webhook signature'}), 400
            return jsonify({'error': f'Webhook parse error: {sig_err}'}), 400

        event_type = event.get('type') if hasattr(event, 'get') else event['type']  # type: ignore
        if event_type == 'checkout.session.completed':
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

        payment = Payment()
        payment.user_id = user_id
        payment.provider = 'flutterwave'
        payment.amount = t['amount_usd']
        payment.currency = 'USD'
        payment.status = 'pending'
        payment.tier = tier
        payment.provider_payment_id = tx_ref
        payment.metadata_json = json.dumps({'tx_ref': tx_ref})
        
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


def _get_paypal():
    """Return a configured PayPalPaymentProcessor or None if credentials missing."""
    from app.services.monetization import PayPalPaymentProcessor
    client_id = current_app.config.get('PAYPAL_CLIENT_ID', '').strip()
    client_secret = current_app.config.get('PAYPAL_CLIENT_SECRET', '').strip()
    if not client_id or not client_secret:
        return None
    sandbox = current_app.config.get('PAYPAL_SANDBOX', 'false').lower() == 'true'
    return PayPalPaymentProcessor(client_id, client_secret, sandbox=sandbox)


@payments_bp.route('/paypal/create-order', methods=['POST'])
@jwt_required()
def paypal_create_order():
    """Create a PayPal order for verification badge or marketplace purchase."""
    try:
        pp = _get_paypal()
        if not pp:
            return jsonify({'error': 'PayPal is not configured on this server. Please contact support.'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        purpose = data.get('purpose', 'verification')

        if purpose == 'verification':
            tier = data.get('tier', 'personal')
            if tier not in TIERS:
                return jsonify({'error': 'Invalid tier'}), 400
            t = TIERS[tier]
            amount = t['amount_usd']
            description = f'VipChat {t["label"]} Badge'
        elif purpose == 'marketplace':
            from app.routes.marketplace import MarketplaceProduct
            product_id = data.get('product_id', '')
            product = MarketplaceProduct.query.get(product_id)
            if not product or not product.is_active:
                return jsonify({'error': 'Product not found'}), 404
            amount = product.price
            description = product.title[:127]
            tier = None
            t = None
        else:
            return jsonify({'error': 'Invalid purpose'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        payment = Payment()
        payment.user_id = user_id
        payment.provider = 'paypal'
        payment.amount = amount
        payment.currency = 'USD'
        payment.status = 'pending'
        payment.tier = tier if purpose == 'verification' else 'marketplace'
        payment.metadata_json = json.dumps({'purpose': purpose, **(
            {'tier': tier} if purpose == 'verification' else {'product_id': data.get('product_id', '')}
        )})
        db.session.add(payment)
        db.session.commit()

        base_url = request.host_url.rstrip('/')
        result = pp.create_order(
            amount=amount,
            currency='USD',
            description=description,
            return_url=f'{base_url}/marketplace?paypal_success={payment.id}' if purpose == 'marketplace' else f'{base_url}/settings?paypal_success={payment.id}',
            cancel_url=f'{base_url}/marketplace?paypal_cancel=1' if purpose == 'marketplace' else f'{base_url}/settings?paypal_cancel=1',
        )
        payment.provider_payment_id = result['order_id']
        db.session.commit()

        return jsonify({
            'order_id': result['order_id'],
            'approve_url': result['approve_url'],
            'payment_id': payment.id,
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/paypal/capture-order', methods=['POST'])
@jwt_required()
def paypal_capture_order():
    """Capture a PayPal order after buyer approval."""
    try:
        pp = _get_paypal()
        if not pp:
            return jsonify({'error': 'PayPal is not configured'}), 503

        user_id = get_jwt_identity()
        data = request.json or {}
        order_id = data.get('order_id', '').strip()
        payment_id = data.get('payment_id', '').strip()

        if not order_id:
            return jsonify({'error': 'order_id required'}), 400

        payment = Payment.query.get(payment_id) if payment_id else None
        if not payment:
            return jsonify({'error': 'payment_id required; create-order must be called first'}), 400
        if payment.user_id != user_id:
            return jsonify({'error': 'Forbidden'}), 403
        if payment.status == 'completed':
            return jsonify({'error': 'Already captured', 'payment': payment.to_dict()}), 200

        # Validate payment record links to the right order
        stored_order_id = payment.provider_payment_id or ''
        if stored_order_id and stored_order_id != order_id:
            return jsonify({'error': 'order_id does not match payment record'}), 400

        capture = pp.capture_order(order_id)
        if capture['status'] != 'COMPLETED':
            return jsonify({'error': f'Capture failed: {capture["status"]}'}), 400

        # Validate captured amount matches intended amount (within $0.01 tolerance)
        captured_amount = float(capture.get('amount', 0))
        if abs(captured_amount - payment.amount) > 0.01:
            import logging
            logging.getLogger(__name__).error(
                'PayPal amount mismatch: expected %.2f captured %.2f for payment %s',
                payment.amount, captured_amount, payment.id
            )
            return jsonify({'error': 'Captured amount does not match order amount'}), 400

        if payment:
            payment.status = 'completed'
            payment.provider_payment_id = capture['capture_id']
            orig_meta = json.loads(payment.metadata_json or '{}')
            orig_meta.update({
                'order_id': order_id,
                'capture_id': capture['capture_id'],
                'payer_email': capture.get('payer_email', ''),
                'amount': capture['amount'],
            })
            payment.metadata_json = json.dumps(orig_meta)
            db.session.commit()
            meta = orig_meta
            purpose = meta.get('purpose', 'verification')
        else:
            purpose = data.get('purpose', 'verification')

        if purpose == 'verification' and payment:
            tier = payment.tier or json.loads(payment.metadata_json or '{}').get('tier', 'personal')
            _mark_user_verified(user_id, tier, capture['capture_id'])

        elif purpose == 'marketplace' and payment:
            from app.routes.marketplace import MarketplacePurchase, _deliver_purchase_async
            meta = json.loads(payment.metadata_json or '{}')
            product_id = meta.get('product_id', '')
            # Resolve the pending purchase created by /products/<id>/purchase
            purchase = MarketplacePurchase.query.filter_by(
                buyer_id=user_id, product_id=product_id, status='pending',
                payment_provider='paypal',
            ).first()
            if purchase:
                purchase.status = 'completed'
                purchase.payment_ref = capture['capture_id']
                purchase.amount_paid = capture['amount']
                db.session.commit()
                _deliver_purchase_async(purchase.id)
            else:
                # No pending purchase found; check if already completed (idempotent)
                already = MarketplacePurchase.query.filter_by(
                    buyer_id=user_id, product_id=product_id, status='completed'
                ).first()
                if not already and product_id:
                    purchase = MarketplacePurchase()
                    purchase.buyer_id = user_id
                    purchase.product_id = product_id
                    purchase.amount_paid = capture['amount']
                    purchase.currency = capture.get('currency', 'USD')
                    purchase.payment_provider = 'paypal'
                    purchase.payment_ref = capture['capture_id']
                    purchase.status = 'completed'
                    db.session.add(purchase)
                    db.session.commit()
                    _deliver_purchase_async(purchase.id)

        return jsonify({'captured': True, 'capture_id': capture['capture_id']}), 200

    except Exception as e:
        db.session.rollback()
        import logging
        logging.getLogger(__name__).exception('paypal_capture_order error')
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/paypal/webhook', methods=['POST'])
def paypal_webhook():
    """Verify and process PayPal webhook events."""
    try:
        from flask import current_app
        client_id = current_app.config.get('PAYPAL_CLIENT_ID', '')
        client_secret = current_app.config.get('PAYPAL_CLIENT_SECRET', '')
        webhook_id = current_app.config.get('PAYPAL_WEBHOOK_ID', '')

        if not client_id or not client_secret:
            return jsonify({'error': 'PayPal not configured'}), 503

        if not webhook_id:
            return jsonify({'error': 'PAYPAL_WEBHOOK_ID not configured; webhook rejected'}), 503

        payload = request.get_data()
        from app.services.monetization import PayPalPaymentProcessor
        sandbox = current_app.config.get('PAYPAL_SANDBOX', 'false').lower() == 'true'
        pp = PayPalPaymentProcessor(client_id, client_secret, sandbox=sandbox)
        if not pp.verify_webhook(dict(request.headers), payload, webhook_id):
            return jsonify({'error': 'Invalid webhook signature'}), 400

        event = json.loads(payload)
        event_type = event.get('event_type', '')
        resource = event.get('resource', {})

        if event_type == 'PAYMENT.CAPTURE.COMPLETED':
            capture_id = resource.get('id', '')
            order_id = resource.get('supplementary_data', {}).get(
                'related_ids', {}).get('order_id', '')
            amount = float(resource.get('amount', {}).get('value', 0))

            payment = Payment.query.filter_by(provider_payment_id=capture_id).first()
            if not payment:
                payment = Payment.query.filter_by(provider_payment_id=order_id).first()

            if payment and payment.status == 'pending':
                payment.status = 'completed'
                payment.provider_payment_id = capture_id
                db.session.commit()

                meta = json.loads(payment.metadata_json or '{}')
                purpose = meta.get('purpose', 'verification')
                if purpose == 'verification':
                    tier = payment.tier or meta.get('tier', 'personal')
                    _mark_user_verified(payment.user_id, tier, capture_id)
                elif purpose == 'marketplace':
                    from app.routes.marketplace import MarketplacePurchase, _deliver_purchase_async
                    product_id = meta.get('product_id', '')
                    existing = MarketplacePurchase.query.filter_by(
                        buyer_id=payment.user_id, product_id=product_id, status='completed'
                    ).first()
                    if not existing and product_id:
                        purchase = MarketplacePurchase()
                        purchase.buyer_id = payment.user_id
                        purchase.product_id = product_id
                        purchase.amount_paid = amount
                        purchase.currency = 'USD'
                        purchase.payment_provider = 'paypal'
                        purchase.payment_ref = capture_id
                        purchase.status = 'completed'
                        db.session.add(purchase)
                        db.session.commit()
                        _deliver_purchase_async(purchase.id)
                elif purpose == 'api_subscription':
                    from app.routes.api_billing import ApiSubscription
                    plan = meta.get('plan', 'starter')
                    sub = ApiSubscription.query.filter_by(user_id=payment.user_id).first()
                    if sub:
                        sub.plan = plan
                        sub.status = 'active'
                        sub.stripe_subscription_id = capture_id
                        db.session.commit()

        return jsonify({'received': True}), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/paypal/transactions', methods=['GET'])
@jwt_required()
def paypal_transactions():
    """Admin: list all PayPal transactions with optional refund capability."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403

        page = int(request.args.get('page', 1))
        per_page = min(int(request.args.get('per_page', 25)), 100)

        q = Payment.query.filter_by(provider='paypal').order_by(Payment.created_at.desc())
        paginated = q.paginate(page=page, per_page=per_page, error_out=False)

        payments_data = []
        for p in paginated.items:
            d = p.to_dict()
            payer = User.query.get(p.user_id)
            d['user_name'] = payer.full_name if payer else None
            d['user_phone'] = payer.phone_number if payer else None
            payments_data.append(d)

        return jsonify({
            'transactions': payments_data,
            'total': paginated.total,
            'pages': paginated.pages,
            'page': page,
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500


@payments_bp.route('/paypal/refund', methods=['POST'])
@jwt_required()
def paypal_refund():
    """Admin: issue a PayPal refund on a capture."""
    try:
        user_id = get_jwt_identity()
        user = User.query.get(user_id)
        if not user or not user.is_admin:
            return jsonify({'error': 'Admin only'}), 403

        pp = _get_paypal()
        if not pp:
            return jsonify({'error': 'PayPal not configured'}), 503

        data = request.json or {}
        payment_id = data.get('payment_id', '')
        payment = Payment.query.get(payment_id)
        if not payment or payment.provider != 'paypal':
            return jsonify({'error': 'PayPal payment not found'}), 404
        if payment.status != 'completed':
            return jsonify({'error': 'Payment not completed'}), 400

        capture_id = payment.provider_payment_id
        amount = data.get('amount')
        result = pp.refund_capture(capture_id, amount=amount)

        payment.status = 'refunded'
        db.session.commit()

        return jsonify({'refund_id': result['refund_id'], 'status': result['status']}), 200

    except Exception as e:
        db.session.rollback()
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
