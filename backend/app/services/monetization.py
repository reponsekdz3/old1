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
    """Real PayPal Orders v2 REST API integration via OAuth2 client-credentials."""

    LIVE_BASE = 'https://api-m.paypal.com'
    SANDBOX_BASE = 'https://api-m.sandbox.paypal.com'

    def __init__(self, client_id: str, client_secret: str, sandbox: bool = False):
        if not client_id or not client_secret:
            import warnings
            warnings.warn('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not set; PayPal calls will fail')
        self.client_id = client_id
        self.client_secret = client_secret
        self.base = self.SANDBOX_BASE if sandbox else self.LIVE_BASE
        self._token: Optional[str] = None
        self._token_expires: float = 0

    def _get_access_token(self) -> str:
        import time
        import requests as http
        if self._token and time.time() < self._token_expires - 30:
            return self._token
        resp = http.post(
            f'{self.base}/v1/oauth2/token',
            data={'grant_type': 'client_credentials'},
            auth=(self.client_id, self.client_secret),
            timeout=15,
        )
        resp.raise_for_status()
        data = resp.json()
        self._token = data['access_token']
        self._token_expires = time.time() + data.get('expires_in', 3600)
        return self._token

    def _headers(self) -> Dict:
        return {
            'Authorization': f'Bearer {self._get_access_token()}',
            'Content-Type': 'application/json',
        }

    def create_order(self, amount: float, currency: str = 'USD',
                     description: str = 'VipChat Purchase',
                     return_url: str = '', cancel_url: str = '') -> Dict:
        """Create a PayPal order. Returns order_id and approve_url."""
        import requests as http
        payload: Dict = {
            'intent': 'CAPTURE',
            'purchase_units': [{
                'amount': {'currency_code': currency, 'value': f'{amount:.2f}'},
                'description': description[:127],
            }],
        }
        if return_url and cancel_url:
            payload['application_context'] = {
                'return_url': return_url,
                'cancel_url': cancel_url,
                'brand_name': 'VipChat',
                'user_action': 'PAY_NOW',
            }
        resp = http.post(f'{self.base}/v2/checkout/orders', json=payload,
                         headers=self._headers(), timeout=20)
        resp.raise_for_status()
        data = resp.json()
        approve_url = next(
            (l['href'] for l in data.get('links', []) if l.get('rel') == 'approve'), ''
        )
        return {'order_id': data['id'], 'approve_url': approve_url, 'status': data['status']}

    def capture_order(self, order_id: str) -> Dict:
        """Capture a PayPal order. Returns capture details."""
        import requests as http
        resp = http.post(
            f'{self.base}/v2/checkout/orders/{order_id}/capture',
            headers=self._headers(),
            json={},
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        captures = (data.get('purchase_units', [{}])[0]
                    .get('payments', {}).get('captures', [{}]))
        capture = captures[0] if captures else {}
        return {
            'order_id': order_id,
            'capture_id': capture.get('id', ''),
            'status': data.get('status', ''),
            'amount': float(capture.get('amount', {}).get('value', 0)),
            'currency': capture.get('amount', {}).get('currency_code', 'USD'),
            'payer_email': (data.get('payer', {}).get('email_address', '')),
        }

    def refund_capture(self, capture_id: str, amount: Optional[float] = None,
                       currency: str = 'USD') -> Dict:
        """Issue a full or partial refund on a capture."""
        import requests as http
        payload: Dict = {}
        if amount is not None:
            payload['amount'] = {'value': f'{amount:.2f}', 'currency_code': currency}
        resp = http.post(
            f'{self.base}/v2/payments/captures/{capture_id}/refund',
            json=payload,
            headers=self._headers(),
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json()
        return {'refund_id': data.get('id', ''), 'status': data.get('status', '')}

    def get_order(self, order_id: str) -> Dict:
        """Fetch current order status."""
        import requests as http
        resp = http.get(f'{self.base}/v2/checkout/orders/{order_id}',
                        headers=self._headers(), timeout=15)
        resp.raise_for_status()
        return resp.json()

    def verify_webhook(self, headers: Dict, body: bytes, webhook_id: str) -> bool:
        """Verify a PayPal webhook event using PayPal's verification API.

        PayPal's /v1/notifications/verify-webhook-signature requires
        webhook_event to be the parsed JSON object of the raw event body,
        not a string representation.
        """
        import requests as http
        import json as _json
        try:
            event_obj = _json.loads(body)
        except Exception:
            return False
        payload = {
            'auth_algo': headers.get('PAYPAL-AUTH-ALGO', ''),
            'cert_url': headers.get('PAYPAL-CERT-URL', ''),
            'transmission_id': headers.get('PAYPAL-TRANSMISSION-ID', ''),
            'transmission_sig': headers.get('PAYPAL-TRANSMISSION-SIG', ''),
            'transmission_time': headers.get('PAYPAL-TRANSMISSION-TIME', ''),
            'webhook_id': webhook_id,
            'webhook_event': event_obj,
        }
        try:
            resp = http.post(
                f'{self.base}/v1/notifications/verify-webhook-signature',
                json=payload, headers=self._headers(), timeout=15,
            )
            resp.raise_for_status()
            return resp.json().get('verification_status') == 'SUCCESS'
        except Exception:
            return False


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
