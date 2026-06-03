"""
Monetization API endpoints - subscriptions, payments, billing.
"""
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app.models.models import db, User
from app.models.e2ee_models import SubscriptionPlan
from app.services.monetization import (
    StripePaymentProcessor, PayPalPaymentProcessor, CryptoPaymentProcessor,
    BillingService, SubscriptionTier, SubscriptionPlanConfig,
    RevenueAnalytics, ReferralProgram
)
from datetime import datetime, timedelta
import logging
import os

logger = logging.getLogger(__name__)
monetization_bp = Blueprint('monetization', __name__, url_prefix='/api/v2/monetization')

# Initialize payment processors
stripe_processor = StripePaymentProcessor(os.getenv('STRIPE_API_KEY', ''))
paypal_processor = PayPalPaymentProcessor(
    os.getenv('PAYPAL_CLIENT_ID', ''),
    os.getenv('PAYPAL_CLIENT_SECRET', '')
)
crypto_processor = CryptoPaymentProcessor()

billing_service = BillingService(stripe_processor)
revenue_analytics = RevenueAnalytics()
referral_program = ReferralProgram()


@monetization_bp.route('/plans', methods=['GET'])
def get_subscription_plans():
    """Get available subscription plans."""
    try:
        plans = []
        for tier_name, config in SubscriptionPlanConfig.PLANS.items():
            plans.append({
                'tier': tier_name,
                'name': config['name'],
                'price_usd': config['price_usd'],
                'billing_cycle': config['billing_cycle'],
                'features': config['features'],
            })
        
        return jsonify({'plans': plans}), 200
    
    except Exception as e:
        logger.error(f"Plan retrieval failed: {e}")
        return jsonify({'error': 'Retrieval failed'}), 500


@monetization_bp.route('/subscription/current', methods=['GET'])
@jwt_required()
def get_current_subscription():
    """Get current user subscription."""
    try:
        user_id = get_jwt_identity()
        
        subscription = SubscriptionPlan.query.filter_by(user_id=user_id).first()
        if not subscription:
            # Default to free
            subscription = SubscriptionPlan()
            subscription.user_id = user_id
            subscription.plan = 'free'
            subscription.status = 'active'
            db.session.add(subscription)
            db.session.commit()
        
        return jsonify(subscription.to_dict()), 200
    
    except Exception as e:
        logger.error(f"Subscription retrieval failed: {e}")
        return jsonify({'error': 'Retrieval failed'}), 500


@monetization_bp.route('/subscription/upgrade', methods=['POST'])
@jwt_required()
def upgrade_subscription():
    """Upgrade subscription to higher tier."""
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        new_tier = data.get('tier')
        payment_method = data.get('payment_method', 'stripe')
        
        if not new_tier:
            return jsonify({'error': 'tier required'}), 400
        
        if new_tier not in [t.value for t in SubscriptionTier]:
            return jsonify({'error': 'Invalid tier'}), 400
        
        # Get or create subscription
        subscription = SubscriptionPlan.query.filter_by(user_id=user_id).first()
        if not subscription:
            subscription = SubscriptionPlan()
            subscription.user_id = user_id
            db.session.add(subscription)
        
        # Get current user for payment
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Create/update Stripe customer
        if not subscription.stripe_subscription_id:
            stripe_customer_id = stripe_processor.create_customer(
                user_id, user.email, user.full_name
            )
        else:
            stripe_customer_id = subscription.stripe_subscription_id.split(':')[0]
        
        # Create subscription
        stripe_subscription = stripe_processor.create_subscription(
            stripe_customer_id,
            price_id=f"price_{new_tier}"  # Use tier name as price ID
        )
        
        # Update subscription record
        if stripe_subscription:
            subscription.plan = new_tier
            subscription.status = stripe_subscription.get('status', 'active')
            subscription.stripe_subscription_id = stripe_subscription.get('subscription_id', '')
            subscription.current_period_start = datetime.fromtimestamp(
                stripe_subscription.get('current_period_start', datetime.utcnow().timestamp())
            )
            subscription.current_period_end = datetime.fromtimestamp(
                stripe_subscription.get('current_period_end', (datetime.utcnow() + timedelta(days=30)).timestamp())
            )
            subscription.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        # Record transaction
        plan_config = SubscriptionPlanConfig.PLANS[new_tier]
        revenue_analytics.record_transaction(user_id, plan_config['price_usd'], new_tier, payment_method)
        
        logger.info(f"User {user_id} upgraded to {new_tier}")
        
        return jsonify({
            'success': True,
            'tier': new_tier,
            'current_period_end': subscription.current_period_end.isoformat(),
            'features': SubscriptionPlanConfig.PLANS[new_tier]['features'],
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Subscription upgrade failed: {e}")
        return jsonify({'error': 'Upgrade failed'}), 500


@monetization_bp.route('/subscription/downgrade', methods=['POST'])
@jwt_required()
def downgrade_subscription():
    """Downgrade to free tier."""
    try:
        user_id = get_jwt_identity()
        
        subscription = SubscriptionPlan.query.filter_by(user_id=user_id).first()
        if not subscription:
            return jsonify({'error': 'No subscription found'}), 404
        
        # Cancel with Stripe
        if subscription.stripe_subscription_id:
            billing_service.downgrade_subscription(user_id, subscription.stripe_subscription_id)
        
        # Update to free
        subscription.plan = 'free'
        subscription.status = 'active'
        subscription.current_period_start = datetime.utcnow()
        subscription.current_period_end = None
        subscription.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        logger.info(f"User {user_id} downgraded to free")
        
        return jsonify({
            'success': True,
            'plan': 'free',
            'features': SubscriptionPlanConfig.PLANS['free']['features'],
        }), 200
    
    except Exception as e:
        db.session.rollback()
        logger.error(f"Subscription downgrade failed: {e}")
        return jsonify({'error': 'Downgrade failed'}), 500


@monetization_bp.route('/invoices', methods=['GET'])
@jwt_required()
def get_invoices():
    """Get user's invoice history."""
    try:
        user_id = get_jwt_identity()
        
        subscription = SubscriptionPlan.query.filter_by(user_id=user_id).first()
        if not subscription or not subscription.stripe_subscription_id:
            return jsonify({'invoices': []}), 200
        
        stripe_customer_id = subscription.stripe_subscription_id.split(':')[0]
        invoices = stripe_processor.get_invoice_history(stripe_customer_id)
        
        return jsonify({'invoices': invoices}), 200
    
    except Exception as e:
        logger.error(f"Invoice retrieval failed: {e}")
        return jsonify({'error': 'Retrieval failed'}), 500


@monetization_bp.route('/coupon/apply', methods=['POST'])
@jwt_required()
def apply_coupon():
    """Apply coupon code to account."""
    try:
        user_id = get_jwt_identity()
        data = request.json or {}
        
        coupon_code = data.get('code')
        if not coupon_code:
            return jsonify({'error': 'code required'}), 400
        
        success, coupon_info = billing_service.apply_coupon(user_id, coupon_code)
        
        if not success or not coupon_info:
            return jsonify({'error': 'Invalid coupon'}), 400
        
        return jsonify({
            'success': True,
            'discount': coupon_info.get('discount', 0),
            'valid_tiers': coupon_info.get('valid_tiers', []),
        }), 200
    
    except Exception as e:
        logger.error(f"Coupon application failed: {e}")
        return jsonify({'error': 'Application failed'}), 500


@monetization_bp.route('/referral/code', methods=['GET'])
@jwt_required()
def get_referral_code():
    """Get user's referral code."""
    try:
        user_id = get_jwt_identity()
        
        # Create new code if doesn't exist
        code = referral_program.create_referral_code(user_id)
        
        return jsonify({
            'referral_code': code,
            'share_url': f"https://bitese.app/join?ref={code}",
        }), 200
    
    except Exception as e:
        logger.error(f"Referral code generation failed: {e}")
        return jsonify({'error': 'Generation failed'}), 500


@monetization_bp.route('/referral/earnings', methods=['GET'])
@jwt_required()
def get_referral_earnings():
    """Get referral program earnings."""
    try:
        user_id = get_jwt_identity()
        
        earnings = referral_program.get_referral_earnings(user_id)
        
        return jsonify(earnings), 200
    
    except Exception as e:
        logger.error(f"Earnings retrieval failed: {e}")
        return jsonify({'error': 'Retrieval failed'}), 500


@monetization_bp.route('/referral/apply', methods=['POST'])
def apply_referral():
    """Apply referral code for new user."""
    try:
        data = request.json or {}
        
        referral_code = data.get('code')
        new_user_id = data.get('user_id')
        
        if not referral_code or not new_user_id:
            return jsonify({'error': 'code and user_id required'}), 400
        
        success, message = referral_program.apply_referral(referral_code, new_user_id)
        
        if not success:
            return jsonify({'error': message}), 400
        
        return jsonify({
            'success': True,
            'message': message,
            'bonus': referral_program.rewards_config['referee_bonus'],
        }), 200
    
    except Exception as e:
        logger.error(f"Referral application failed: {e}")
        return jsonify({'error': 'Application failed'}), 500


@monetization_bp.route('/analytics/mrr', methods=['GET'])
def get_mrr():
    """Get Monthly Recurring Revenue (admin only)."""
    try:
        # TODO: Add admin check
        mrr = revenue_analytics.get_mrr()
        
        return jsonify({'mrr_usd': mrr}), 200
    
    except Exception as e:
        logger.error(f"MRR calculation failed: {e}")
        return jsonify({'error': 'Calculation failed'}), 500


@monetization_bp.route('/analytics/cohorts', methods=['GET'])
def get_cohort_analysis():
    """Get cohort analysis (admin only)."""
    try:
        # TODO: Add admin check
        cohorts = revenue_analytics.get_cohort_analysis(datetime.utcnow() - timedelta(days=30))
        
        return jsonify({'cohorts': cohorts}), 200
    
    except Exception as e:
        logger.error(f"Cohort analysis failed: {e}")
        return jsonify({'error': 'Analysis failed'}), 500
