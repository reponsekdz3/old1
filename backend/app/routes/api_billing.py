"""
VipChat API Billing — Real paid API tiers, usage metering, invoicing.
"""
from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
import uuid
import logging

logger = logging.getLogger(__name__)
api_billing_bp = Blueprint('api_billing', __name__, url_prefix='/api/billing')

# ── Models ─────────────────────────────────────────────────────────────────────

class ApiSubscription(db.Model):
    __tablename__ = 'api_subscriptions'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False, unique=True)
    plan = Column(String(30), default='free')  # free | starter | pro | enterprise
    status = Column(String(20), default='active')  # active | cancelled | past_due | trialing
    stripe_subscription_id = Column(String(255), nullable=True)
    stripe_customer_id = Column(String(255), nullable=True)
    current_period_start = Column(DateTime, nullable=True)
    current_period_end = Column(DateTime, nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    trial_ends_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship('User', foreign_keys=[user_id])

    PLAN_LIMITS = {
        'free':       {'messages_per_day': 100, 'req_per_min': 10,  'broadcasts': 0,    'webhooks': 0,    'price': 0,   'price_id': None},
        'starter':    {'messages_per_day': 1000, 'req_per_min': 30, 'broadcasts': 5,    'webhooks': 1,    'price': 9,   'price_id': 'starter_monthly'},
        'pro':        {'messages_per_day': 10000,'req_per_min': 100,'broadcasts': 50,   'webhooks': 5,    'price': 29,  'price_id': 'pro_monthly'},
        'enterprise': {'messages_per_day': -1,   'req_per_min': 500,'broadcasts': -1,   'webhooks': 20,   'price': 99,  'price_id': 'enterprise_monthly'},
    }

    def to_dict(self):
        limits = self.PLAN_LIMITS.get(self.plan, self.PLAN_LIMITS['free'])
        return {
            'id': self.id,
            'plan': self.plan,
            'status': self.status,
            'limits': limits,
            'current_period_end': self.current_period_end.isoformat() if self.current_period_end else None,
            'cancel_at_period_end': self.cancel_at_period_end,
            'trial_ends_at': self.trial_ends_at.isoformat() if self.trial_ends_at else None,
            'created_at': self.created_at.isoformat(),
        }


class ApiInvoice(db.Model):
    __tablename__ = 'api_invoices'
    __table_args__ = {'extend_existing': True}

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    subscription_id = Column(String(36), ForeignKey('api_subscriptions.id'), nullable=True)
    plan = Column(String(30), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String(10), default='USD')
    status = Column(String(20), default='paid')  # paid | pending | failed | refunded
    stripe_invoice_id = Column(String(255), nullable=True)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship('User', foreign_keys=[user_id])

    def to_dict(self):
        return {
            'id': self.id,
            'plan': self.plan,
            'amount': self.amount,
            'currency': self.currency,
            'status': self.status,
            'period_start': self.period_start.isoformat() if self.period_start else None,
            'period_end': self.period_end.isoformat() if self.period_end else None,
            'paid_at': self.paid_at.isoformat() if self.paid_at else None,
            'created_at': self.created_at.isoformat(),
        }


class ApiUsageRecord(db.Model):
    __tablename__ = 'api_usage_records'

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey('users.id'), nullable=False)
    endpoint = Column(String(255), nullable=True)
    method = Column(String(10), nullable=True)
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        db.Index('ix_api_usage_user_date', 'user_id', 'created_at'),
        {'extend_existing': True},
    )


# ── Routes ─────────────────────────────────────────────────────────────────────

@api_billing_bp.route('/subscription', methods=['GET'])
@jwt_required()
def get_subscription():
    """Get current API subscription."""
    user_id = get_jwt_identity()
    sub = ApiSubscription.query.filter_by(user_id=user_id).first()
    if not sub:
        # Create free plan
        sub = ApiSubscription(user_id=user_id, plan='free', status='active')
        db.session.add(sub)
        db.session.commit()
    return jsonify({'subscription': sub.to_dict()}), 200


@api_billing_bp.route('/subscription/upgrade', methods=['POST'])
@jwt_required()
def upgrade_subscription():
    """Upgrade to a paid API plan via Stripe."""
    try:
        user_id = get_jwt_identity()
        data = request.get_json() or {}
        plan = data.get('plan', 'pro')

        limits = ApiSubscription.PLAN_LIMITS.get(plan)
        if not limits or limits['price'] == 0:
            return jsonify({'error': 'Invalid plan or free plan selected'}), 400

        stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if not stripe_key:
            return jsonify({'error': 'Payment not configured. Add STRIPE_SECRET_KEY.'}), 503

        import stripe
        stripe.api_key = stripe_key

        user = User.query.get(user_id)
        sub = ApiSubscription.query.filter_by(user_id=user_id).first()
        if not sub:
            sub = ApiSubscription(user_id=user_id, plan='free', status='active')
            db.session.add(sub)
            db.session.commit()

        # Create/retrieve Stripe customer
        if not sub.stripe_customer_id:
            customer = stripe.Customer.create(
                email=getattr(user, 'email', None) or f'{user_id}@vipchat.app',
                name=user.full_name,
                metadata={'user_id': user_id},
            )
            sub.stripe_customer_id = customer.id
            db.session.commit()

        # Create checkout session
        session = stripe.checkout.Session.create(
            customer=sub.stripe_customer_id,
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': 'usd',
                    'recurring': {'interval': 'month'},
                    'product_data': {
                        'name': f'VipChat API — {plan.title()} Plan',
                        'description': f'{limits["messages_per_day"]} messages/day, {limits["req_per_min"]} req/min',
                    },
                    'unit_amount': limits['price'] * 100,
                },
                'quantity': 1,
            }],
            mode='subscription',
            success_url=f'{request.host_url.rstrip("/")}/api-platform?upgrade_success={plan}',
            cancel_url=f'{request.host_url.rstrip("/")}/api-platform?upgrade_cancel=1',
            metadata={'user_id': user_id, 'plan': plan, 'type': 'api_subscription'},
        )

        return jsonify({'checkout_url': session.url, 'plan': plan}), 200

    except Exception as e:
        logger.exception('upgrade_subscription error')
        return jsonify({'error': str(e)}), 500


@api_billing_bp.route('/subscription/cancel', methods=['POST'])
@jwt_required()
def cancel_subscription():
    """Cancel API subscription at period end."""
    try:
        user_id = get_jwt_identity()
        sub = ApiSubscription.query.filter_by(user_id=user_id).first()
        if not sub or sub.plan == 'free':
            return jsonify({'error': 'No paid subscription to cancel'}), 400

        stripe_key = current_app.config.get('STRIPE_SECRET_KEY', '')
        if stripe_key and sub.stripe_subscription_id:
            import stripe
            stripe.api_key = stripe_key
            stripe.Subscription.modify(sub.stripe_subscription_id, cancel_at_period_end=True)

        sub.cancel_at_period_end = True
        db.session.commit()
        return jsonify({'message': 'Subscription will cancel at period end', 'subscription': sub.to_dict()}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500


@api_billing_bp.route('/invoices', methods=['GET'])
@jwt_required()
def get_invoices():
    """Get billing history."""
    user_id = get_jwt_identity()
    invoices = ApiInvoice.query.filter_by(user_id=user_id).order_by(ApiInvoice.created_at.desc()).limit(24).all()
    return jsonify({'invoices': [i.to_dict() for i in invoices]}), 200


@api_billing_bp.route('/usage', methods=['GET'])
@jwt_required()
def get_usage():
    """Get API usage statistics."""
    user_id = get_jwt_identity()
    days = int(request.args.get('days', 30))
    since = datetime.utcnow() - timedelta(days=days)

    # Daily usage
    from sqlalchemy import func
    daily = db.session.query(
        func.date(ApiUsageRecord.created_at).label('date'),
        func.count(ApiUsageRecord.id).label('requests'),
    ).filter(
        ApiUsageRecord.user_id == user_id,
        ApiUsageRecord.created_at >= since,
    ).group_by(func.date(ApiUsageRecord.created_at)).all()

    today = datetime.utcnow().date()
    today_count = db.session.query(func.count(ApiUsageRecord.id)).filter(
        ApiUsageRecord.user_id == user_id,
        func.date(ApiUsageRecord.created_at) == today,
    ).scalar() or 0

    total = db.session.query(func.count(ApiUsageRecord.id)).filter_by(user_id=user_id).scalar() or 0

    sub = ApiSubscription.query.filter_by(user_id=user_id).first()
    plan = sub.plan if sub else 'free'
    limits = ApiSubscription.PLAN_LIMITS.get(plan, ApiSubscription.PLAN_LIMITS['free'])

    return jsonify({
        'today': today_count,
        'total': total,
        'daily': [{'date': str(d.date), 'requests': d.requests} for d in daily],
        'plan': plan,
        'daily_limit': limits['messages_per_day'],
        'remaining_today': max(0, limits['messages_per_day'] - today_count) if limits['messages_per_day'] > 0 else -1,
    }), 200


@api_billing_bp.route('/plans', methods=['GET'])
def get_plans():
    """Get all available API plans."""
    plans = []
    for plan_name, limits in ApiSubscription.PLAN_LIMITS.items():
        plans.append({
            'id': plan_name,
            'name': plan_name.title(),
            'price': limits['price'],
            'price_monthly': f'${limits["price"]}/mo',
            'messages_per_day': limits['messages_per_day'],
            'req_per_min': limits['req_per_min'],
            'broadcasts': limits['broadcasts'],
            'webhooks': limits['webhooks'],
            'features': _plan_features(plan_name),
        })
    return jsonify({'plans': plans}), 200


def _plan_features(plan):
    base = ['REST API access', 'SDK support', 'Basic analytics']
    if plan == 'free':
        return base + ['100 messages/day', 'Community support']
    elif plan == 'starter':
        return base + ['1,000 messages/day', '5 broadcasts/mo', '1 webhook', 'Email support', 'Sandbox testing']
    elif plan == 'pro':
        return base + ['10,000 messages/day', '50 broadcasts/mo', '5 webhooks',
                       'Priority support', 'Advanced analytics', 'Team members', 'Custom templates']
    elif plan == 'enterprise':
        return base + ['Unlimited messages', 'Unlimited broadcasts', '20 webhooks',
                       'Dedicated support', 'SLA guarantee', 'Custom domain', 'White-label',
                       'SAML SSO', 'Audit logs', 'On-premise option']
    return base


@api_billing_bp.route('/webhook', methods=['POST'])
def stripe_billing_webhook():
    """Handle Stripe webhook for subscription events."""
    payload = request.get_data()
    sig = request.headers.get('Stripe-Signature', '')
    webhook_secret = current_app.config.get('STRIPE_WEBHOOK_SECRET', '')

    if webhook_secret:
        try:
            import stripe
            stripe.api_key = current_app.config.get('STRIPE_SECRET_KEY', '')
            event = stripe.Webhook.construct_event(payload, sig, webhook_secret)
        except Exception as e:
            return jsonify({'error': str(e)}), 400
    else:
        import json
        try:
            event = json.loads(payload)
        except Exception:
            return jsonify({'error': 'Invalid payload'}), 400

    try:
        event_type = event.get('type', '')
        data_obj = event.get('data', {}).get('object', {})
        meta = data_obj.get('metadata', {})

        if event_type in ('checkout.session.completed',):
            if meta.get('type') == 'api_subscription':
                user_id = meta.get('user_id')
                plan = meta.get('plan', 'pro')
                if user_id:
                    sub = ApiSubscription.query.filter_by(user_id=user_id).first()
                    if sub:
                        sub.plan = plan
                        sub.status = 'active'
                        sub.current_period_start = datetime.utcnow()
                        sub.current_period_end = datetime.utcnow() + timedelta(days=30)

                        limits = ApiSubscription.PLAN_LIMITS.get(plan, {})
                        inv = ApiInvoice(
                            user_id=user_id,
                            plan=plan,
                            amount=limits.get('price', 0),
                            status='paid',
                            paid_at=datetime.utcnow(),
                            period_start=sub.current_period_start,
                            period_end=sub.current_period_end,
                        )
                        db.session.add(inv)
                        db.session.commit()

        elif event_type == 'customer.subscription.deleted':
            stripe_sub_id = data_obj.get('id')
            if stripe_sub_id:
                sub = ApiSubscription.query.filter_by(stripe_subscription_id=stripe_sub_id).first()
                if sub:
                    sub.plan = 'free'
                    sub.status = 'cancelled'
                    db.session.commit()

    except Exception as e:
        logger.exception(f'Billing webhook error: {e}')

    return jsonify({'received': True}), 200
