"""
Monetization System - Payments, Subscriptions, and Revenue Management
Supports multiple payment providers and advanced billing features.
"""
import logging
import json
from typing import Dict, Optional, List, Tuple
from datetime import datetime, timedelta
from enum import Enum
import stripe
from app.models.models import db

logger = logging.getLogger(__name__)


class SubscriptionTier(Enum):
    """Subscription tiers."""
    FREE = "free"
    BASIC = "basic"
    PROFESSIONAL = "professional"
    ENTERPRISE = "enterprise"


class PaymentMethod(Enum):
    """Payment methods."""
    STRIPE = "stripe"
    PAYPAL = "paypal"
    GOOGLE_PAY = "google_pay"
    APPLE_PAY = "apple_pay"
    CRYPTO = "crypto"


class SubscriptionPlanConfig:
    """Subscription plan configurations."""
    
    PLANS = {
        SubscriptionTier.FREE.value: {
            'name': 'Free',
            'price_usd': 0,
            'billing_cycle': None,
            'features': {
                'max_messages_per_day': 100,
                'max_group_size': 50,
                'max_storage_gb': 1,
                'e2ee': True,
                'video_calls': False,
                'api_access': False,
                'priority_support': False,
                'custom_branding': False,
                'analytics': False,
            }
        },
        SubscriptionTier.BASIC.value: {
            'name': 'Basic',
            'price_usd': 4.99,
            'billing_cycle': 'monthly',
            'features': {
                'max_messages_per_day': 10000,
                'max_group_size': 500,
                'max_storage_gb': 50,
                'e2ee': True,
                'video_calls': True,
                'api_access': False,
                'priority_support': False,
                'custom_branding': False,
                'analytics': False,
            }
        },
        SubscriptionTier.PROFESSIONAL.value: {
            'name': 'Professional',
            'price_usd': 14.99,
            'billing_cycle': 'monthly',
            'features': {
                'max_messages_per_day': 'unlimited',
                'max_group_size': 5000,
                'max_storage_gb': 500,
                'e2ee': True,
                'video_calls': True,
                'api_access': True,
                'priority_support': True,
                'custom_branding': True,
                'analytics': True,
            }
        },
        SubscriptionTier.ENTERPRISE.value: {
            'name': 'Enterprise',
            'price_usd': 99.99,
            'billing_cycle': 'monthly',
            'features': {
                'max_messages_per_day': 'unlimited',
                'max_group_size': 'unlimited',
                'max_storage_gb': 'unlimited',
                'e2ee': True,
                'video_calls': True,
                'api_access': True,
                'priority_support': True,
                'custom_branding': True,
                'analytics': True,
                'sso': True,
                'advanced_security': True,
                'dedicated_support': True,
            }
        }
    }


class StripePaymentProcessor:
    """Handle Stripe payments."""
    
    def __init__(self, api_key: str):
        stripe.api_key = api_key
    
    def create_customer(self, user_id: str, email: str, name: str) -> str:
        """Create Stripe customer."""
        try:
            customer = stripe.Customer.create(
                email=email,
                name=name,
                metadata={'user_id': user_id}
            )
            return customer.id
        except stripe.error.StripeError as e:
            logger.error(f"Stripe customer creation failed: {e}")
            raise
    
    def create_subscription(self, customer_id: str, price_id: str) -> Dict:
        """Create subscription."""
        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{'price': price_id}],
            )
            return {
                'subscription_id': subscription.id,
                'status': subscription.status,
                'current_period_start': subscription.current_period_start,
                'current_period_end': subscription.current_period_end,
            }
        except stripe.error.StripeError as e:
            logger.error(f"Stripe subscription creation failed: {e}")
            raise
    
    def cancel_subscription(self, subscription_id: str) -> bool:
        """Cancel subscription."""
        try:
            stripe.Subscription.delete(subscription_id)
            return True
        except stripe.error.StripeError as e:
            logger.error(f"Stripe subscription cancellation failed: {e}")
            return False
    
    def get_invoice_history(self, customer_id: str) -> List[Dict]:
        """Get customer invoice history."""
        try:
            invoices = stripe.Invoice.list(customer=customer_id, limit=100)
            return [
                {
                    'id': inv.id,
                    'amount': inv.amount_paid,
                    'date': inv.created,
                    'status': inv.status,
                    'pdf_url': inv.invoice_pdf,
                }
                for inv in invoices
            ]
        except stripe.error.StripeError as e:
            logger.error(f"Stripe invoice retrieval failed: {e}")
            return []


class PayPalPaymentProcessor:
    """Handle PayPal payments."""
    
    def __init__(self, client_id: str, client_secret: str):
        self.client_id = client_id
        self.client_secret = client_secret
    
    def create_payment(self, user_id: str, amount: float, currency: str = 'USD') -> Dict:
        """Create PayPal payment."""
        # Implementation would integrate with PayPal API
        # This is a placeholder
        return {
            'payment_id': f'paypal_{user_id}_{int(datetime.utcnow().timestamp())}',
            'status': 'pending'
        }
    
    def execute_payment(self, payment_id: str, payer_id: str) -> bool:
        """Execute PayPal payment."""
        # Implementation would call PayPal API
        return True


class CryptoPaymentProcessor:
    """Handle cryptocurrency payments."""
    
    def __init__(self):
        self.supported_coins = ['BTC', 'ETH', 'USDC', 'USDT']
    
    def create_payment_request(self, user_id: str, amount_usd: float, 
                              coin: str = 'BTC') -> Dict:
        """Create crypto payment request."""
        if coin not in self.supported_coins:
            raise ValueError(f"Unsupported coin: {coin}")
        
        # Would integrate with payment processor like Coinbase Commerce
        return {
            'payment_id': f'crypto_{user_id}_{coin}_{int(datetime.utcnow().timestamp())}',
            'address': '1A1z7agoat4oPLx2weKH844KHeJFAsPRA',  # Example
            'amount': amount_usd,
            'coin': coin,
            'status': 'pending'
        }
    
    def verify_payment(self, payment_id: str) -> bool:
        """Verify crypto payment received."""
        # Would check blockchain
        return True


class BillingService:
    """Manage billing operations."""
    
    def __init__(self, stripe_processor: StripePaymentProcessor):
        self.stripe = stripe_processor
    
    def upgrade_subscription(self, user_id: str, stripe_customer_id: str,
                            new_tier: SubscriptionTier) -> Dict:
        """Upgrade user subscription."""
        try:
            plan_config = SubscriptionPlanConfig.PLANS[new_tier.value]
            
            # In production, would create/update Stripe subscription
            result = {
                'tier': new_tier.value,
                'price': plan_config['price_usd'],
                'features': plan_config['features'],
                'effective_date': datetime.utcnow().isoformat(),
            }
            
            return result
        except Exception as e:
            logger.error(f"Subscription upgrade failed: {e}")
            raise
    
    def downgrade_subscription(self, user_id: str, stripe_customer_id: str) -> bool:
        """Downgrade to free tier."""
        try:
            # Cancel existing subscription
            self.stripe.cancel_subscription(stripe_customer_id)
            return True
        except Exception as e:
            logger.error(f"Subscription downgrade failed: {e}")
            return False
    
    def apply_coupon(self, user_id: str, coupon_code: str) -> Tuple[bool, Optional[Dict]]:
        """Apply coupon to account."""
        # Would validate and apply coupon
        coupons = {
            'WELCOME10': {'discount': 0.10, 'valid_tiers': ['basic', 'professional']},
            'ANNUAL20': {'discount': 0.20, 'valid_tiers': ['professional', 'enterprise']},
        }
        
        if coupon_code in coupons:
            return True, coupons[coupon_code]
        return False, None
    
    def generate_invoice(self, user_id: str, billing_period: Dict) -> Dict:
        """Generate invoice for billing period."""
        invoice = {
            'invoice_id': f'INV_{user_id}_{int(datetime.utcnow().timestamp())}',
            'user_id': user_id,
            'billing_period': billing_period,
            'items': [],
            'subtotal': 0,
            'tax': 0,
            'total': 0,
            'issued_at': datetime.utcnow().isoformat(),
            'due_at': (datetime.utcnow() + timedelta(days=30)).isoformat(),
        }
        
        return invoice


class RevenueAnalytics:
    """Analyze revenue and usage metrics."""
    
    def __init__(self):
        self.metrics = {}
    
    def record_transaction(self, user_id: str, amount: float, tier: str,
                          payment_method: str):
        """Record transaction for analytics."""
        self.metrics[f"txn_{user_id}_{int(datetime.utcnow().timestamp())}"] = {
            'user_id': user_id,
            'amount': amount,
            'tier': tier,
            'payment_method': payment_method,
            'timestamp': datetime.utcnow().isoformat(),
        }
    
    def get_mrr(self, days: int = 30) -> float:
        """Get Monthly Recurring Revenue."""
        cutoff = datetime.utcnow() - timedelta(days=days)
        total = 0
        
        for key, txn in self.metrics.items():
            try:
                txn_time = datetime.fromisoformat(txn['timestamp'])
                if txn_time > cutoff:
                    total += txn['amount']
            except:
                pass
        
        return total
    
    def get_cohort_analysis(self, start_date: datetime) -> Dict:
        """Analyze user cohorts by subscription tier."""
        cohorts = {}
        
        for key, txn in self.metrics.items():
            tier = txn['tier']
            if tier not in cohorts:
                cohorts[tier] = {'count': 0, 'revenue': 0}
            
            cohorts[tier]['count'] += 1
            cohorts[tier]['revenue'] += txn['amount']
        
        return cohorts
    
    def get_churn_rate(self, days: int = 30) -> float:
        """Calculate estimated churn rate."""
        # Placeholder: would analyze subscription changes
        return 0.05  # 5% monthly churn estimate
    
    def get_ltv(self, user_id: str) -> float:
        """Calculate customer lifetime value."""
        total_revenue = 0
        user_txns = [txn for txn in self.metrics.values() 
                    if txn['user_id'] == user_id]
        
        for txn in user_txns:
            total_revenue += txn['amount']
        
        return total_revenue


class ReferralProgram:
    """Manage referral rewards program."""
    
    def __init__(self):
        self.referrals = {}
        self.rewards_config = {
            'referrer_bonus': 10.0,    # $10 credit
            'referee_bonus': 5.0,      # $5 credit
            'commission_rate': 0.10,   # 10% of referred subscription
        }
    
    def create_referral_code(self, user_id: str) -> str:
        """Create unique referral code."""
        import secrets
        code = f"REF_{secrets.token_urlsafe(12).upper()}"
        self.referrals[code] = {'referrer_id': user_id, 'referrals': []}
        return code
    
    def apply_referral(self, referral_code: str, new_user_id: str) -> Tuple[bool, str]:
        """Apply referral for new user."""
        if referral_code not in self.referrals:
            return False, "Invalid referral code"
        
        referrer_id = self.referrals[referral_code]['referrer_id']
        self.referrals[referral_code]['referrals'].append(new_user_id)
        
        return True, f"Referred by {referrer_id}"
    
    def get_referral_earnings(self, user_id: str) -> Dict:
        """Get referral earnings for user."""
        code = next((c for c, data in self.referrals.items() 
                    if data['referrer_id'] == user_id), None)
        
        if not code:
            return {'earnings': 0, 'referrals': []}
        
        referral_count = len(self.referrals[code]['referrals'])
        earnings = referral_count * self.rewards_config['referrer_bonus']
        
        return {
            'earnings': earnings,
            'referrals': referral_count,
            'potential_earnings': earnings + (referral_count * 0.10 * 10),  # Commission estimate
        }
