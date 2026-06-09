import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCheck, FiZap, FiShield, FiArrowLeft, FiX, FiRefreshCw,
  FiGlobe, FiLock, FiAward, FiRepeat,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    period: 'forever',
    color: '#6b7280',
    gradient: 'from-gray-500 to-gray-700',
    badge: null,
    highlight: false,
    features: [
      'Up to 100 contacts',
      '1:1 & Group messaging',
      'Voice & video calls',
      '2GB file sharing',
      'Basic status updates',
      'Web & mobile access',
      'Watch VipTrends',
      'Digital Wallet',
    ],
    limits: ['100MB max file size', 'Ads shown', 'No screen share in calls'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 4.99,
    period: 'month',
    color: '#25D366',
    gradient: 'from-[#25D366] to-[#075E54]',
    badge: 'Most Popular',
    highlight: true,
    features: [
      'Unlimited contacts',
      'Priority messaging',
      'HD video calls (up to 50 people)',
      '25GB file sharing',
      'Advanced status analytics',
      'Custom chat themes',
      'Message scheduling',
      'Screen sharing in calls',
      'Ad-free VipTrends',
      'No ads',
      'Priority support 24/7',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'Business',
    price: 14.99,
    period: 'month',
    color: '#7c3aed',
    gradient: 'from-purple-500 to-purple-800',
    badge: 'Best Value',
    highlight: false,
    features: [
      'Everything in Pro',
      '100GB file sharing',
      'API access (100k calls/mo)',
      'Admin dashboard',
      'Team management',
      'Custom branding',
      'Dedicated account manager',
      'SLA 99.99% uptime',
      'Advanced analytics',
      'Bulk messaging',
      'Trends upload (business)',
      'Wallet priority withdrawals',
    ],
    limits: [],
  },
];

const PAYMENT_METHODS = [
  { id: 'stripe', label: 'Credit / Debit Card', iconName: 'card', sublabel: 'Visa, Mastercard, Amex', color: 'bg-blue-500' },
  { id: 'paypal', label: 'PayPal', iconName: 'paypal', sublabel: 'Fast & secure', color: 'bg-sky-500' },
  { id: 'flutterwave', label: 'Flutterwave', iconName: 'globe', sublabel: 'Africa & global markets', color: 'bg-orange-500' },
  { id: 'crypto', label: 'Crypto / Bitcoin', iconName: 'bitcoin', sublabel: 'BTC, ETH, USDC, DAI', color: 'bg-amber-500' },
  { id: 'wallet', label: 'VipChat Wallet', iconName: 'wallet', sublabel: 'Instant — use your balance', color: 'bg-emerald-500' },
];

function PlanCard({ plan, current, onUpgrade, loading }) {
  const isCurrent = current?.plan === plan.id;
  const isDowngrade = current && PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === current.plan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden border-2 transition-all ${
        plan.highlight
          ? 'border-[#25D366] shadow-xl shadow-green-100 scale-[1.02]'
          : isCurrent
          ? 'border-[#25D366] shadow-lg'
          : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}
    >
      {plan.badge && (
        <div className={`absolute top-4 right-4 text-white text-xs font-bold px-2.5 py-1 rounded-full bg-gradient-to-r ${plan.gradient}`}>
          {plan.badge}
        </div>
      )}
      <div className={`bg-gradient-to-br ${plan.gradient} p-6 text-white`}>
        <h3 className="text-xl font-bold flex items-center gap-2">
          {plan.name}
          {plan.id === 'free' && <FiRepeat size={14} className="text-white/70" />}
        </h3>
        <div className="mt-2 flex items-end gap-1">
          {plan.price === 0
            ? <>
                <span className="text-3xl font-extrabold">Free</span>
                <span className="text-white/70 text-sm pb-0.5">forever</span>
              </>
            : <>
                <span className="text-3xl font-extrabold">${plan.price}</span>
                <span className="text-white/70 text-sm pb-0.5">/{plan.period}</span>
              </>
          }
        </div>
        {plan.price > 0 && (
          <p className="text-white/60 text-xs mt-1">
            Billed monthly · Cancel anytime
          </p>
        )}
      </div>
      <div className="bg-white p-6">
        <ul className="space-y-2 mb-6">
          {plan.features.map(f => (
            <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
              <FiCheck size={16} className="text-[#25D366] flex-shrink-0 mt-0.5" />
              {f}
            </li>
          ))}
          {plan.limits.map(l => (
            <li key={l} className="flex items-start gap-2 text-sm text-gray-400">
              <FiX size={16} className="text-gray-300 flex-shrink-0 mt-0.5" />
              {l}
            </li>
          ))}
        </ul>

        {isCurrent ? (
          <div className="w-full py-3 bg-green-50 border-2 border-[#25D366] text-[#25D366] font-bold text-sm rounded-2xl flex items-center justify-center gap-2">
            <FiCheck size={16} /> Current Plan
          </div>
        ) : plan.price === 0 ? (
          <div className="w-full py-3 bg-gray-50 text-gray-400 font-semibold text-sm rounded-2xl text-center">
            Free Forever
          </div>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            disabled={loading || isDowngrade}
            className={`w-full py-3 rounded-2xl font-bold text-sm transition flex items-center justify-center gap-2 ${
              isDowngrade
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : `bg-gradient-to-r ${plan.gradient} text-white hover:opacity-90 shadow-lg`
            }`}
          >
            {loading ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : isDowngrade ? 'Downgrade' : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function PaymentModal({ plan, onClose, onSuccess }) {
  const [method, setMethod] = useState('stripe');
  const [loading, setLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);

  useEffect(() => {
    api.get('/wallet/balance').then(({ data }) => setWalletBalance(data.wallet?.balance_usd)).catch(() => {});
  }, []);

  const handlePay = async () => {
    setLoading(true);
    try {
      if (method === 'stripe') {
        const { data } = await api.post('/payments/stripe/create-checkout-session', { tier: plan.id === 'enterprise' ? 'business' : 'personal', plan: plan.id });
        if (data.url) window.location.href = data.url;

      } else if (method === 'paypal') {
        const { data } = await api.post('/payments/paypal/create-order', { tier: plan.id === 'enterprise' ? 'business' : 'personal', plan: plan.id });
        const approvalUrl = data.links?.find(l => l.rel === 'approve')?.href || data.approve_url;
        if (approvalUrl) window.location.href = approvalUrl;
        else toast.error('PayPal order creation failed');

      } else if (method === 'flutterwave') {
        const { data } = await api.post('/payments/flutterwave/initialize', { tier: plan.id === 'enterprise' ? 'business' : 'personal', plan: plan.id });
        if (window.FlutterwaveCheckout) {
          window.FlutterwaveCheckout({
            public_key: data.public_key,
            tx_ref: data.tx_ref,
            amount: plan.price,
            currency: 'USD',
            payment_options: 'card, mobilemoney, ussd, bank_transfer',
            customer: { email: data.customer_email || '', name: data.customer_name || '', phone_number: data.customer_phone || '' },
            customizations: { title: `VipChat ${plan.name}`, description: `${plan.name} plan — $${plan.price}/mo`, logo: '/logo192.png' },
            callback: async (response) => {
              if (response.status === 'successful') {
                try {
                  await api.post(`/payments/flutterwave/verify/${data.tx_ref}`);
                  toast.success(`${plan.name} plan activated!`);
                  onSuccess?.();
                  onClose();
                } catch { toast.error('Verification failed. Contact support.'); }
              }
            },
            onclose: () => {},
          });
        } else toast.error('Flutterwave not loaded. Try card payment.');

      } else if (method === 'crypto') {
        const { data } = await api.post('/wallet/topup/crypto/create', { amount: plan.price });
        if (data.hosted_url) {
          window.open(data.hosted_url, '_blank');
          toast(`Pay $${plan.price} in crypto to activate your plan. It will activate after confirmation.`, { duration: 6000 });
        }

      } else if (method === 'wallet') {
        if (walletBalance === null || walletBalance < plan.price) {
          toast.error(`Insufficient wallet balance. Need $${plan.price.toFixed(2)}.`);
          setLoading(false);
          return;
        }
        await api.post('/v2/monetization/subscription/upgrade', { tier: plan.id, payment_method: 'wallet' });
        toast.success(`${plan.name} plan activated!`);
        onSuccess?.();
        onClose();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Payment failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Upgrade to {plan.name}</h3>
            <p className="text-[#25D366] font-bold">${plan.price}/month</p>
          </div>
          <button onClick={onClose}><FiX size={20} className="text-gray-400" /></button>
        </div>

        <p className="text-sm font-semibold text-gray-600 mb-3">Choose payment method:</p>
        <div className="space-y-2 mb-5">
          {PAYMENT_METHODS.map(pm => (
            <button key={pm.id} onClick={() => setMethod(pm.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${method === pm.id ? 'border-[#25D366] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className={`w-9 h-9 rounded-xl ${pm.color} flex items-center justify-center flex-shrink-0`}>
                {pm.iconName === 'card' && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
                {pm.iconName === 'paypal' && <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 0 0-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 0 0 .554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 0 1 .92-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.773-4.471z"/></svg>}
                {pm.iconName === 'globe' && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>}
                {pm.iconName === 'bitcoin' && <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M23.638 14.904c-1.602 6.43-8.113 10.34-14.542 8.736C2.67 22.05-1.244 15.525.362 9.105 1.962 2.67 8.475-1.243 14.9.358c6.43 1.605 10.342 8.115 8.738 14.548v-.002zm-6.35-4.613c.24-1.59-.974-2.45-2.64-3.03l.54-2.153-1.315-.33-.525 2.107c-.345-.087-.705-.167-1.064-.25l.526-2.127-1.32-.33-.54 2.165c-.285-.067-.565-.132-.84-.2l-1.815-.45-.35 1.407s.975.225.955.236c.535.136.63.486.615.766l-1.477 5.92c-.075.166-.24.406-.614.314.015.02-.96-.24-.96-.24l-.66 1.51 1.71.426.93.242-.54 2.19 1.32.327.54-2.17c.36.1.705.19 1.05.273l-.51 2.154 1.32.33.545-2.19c2.24.427 3.93.257 4.64-1.774.57-1.637-.03-2.58-1.217-3.196.854-.193 1.5-.76 1.68-1.93h.01zm-3.01 4.22c-.404 1.64-3.157.75-4.05.53l.72-2.9c.896.23 3.757.67 3.33 2.37zm.41-4.24c-.37 1.49-2.662.735-3.405.55l.654-2.64c.744.18 3.137.524 2.75 2.09z"/></svg>}
                {pm.iconName === 'wallet' && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6z"/><circle cx="17" cy="16" r="1" fill="currentColor"/></svg>}
              </div>
              <div className="text-left flex-1">
                <p className="text-sm font-bold text-gray-900">{pm.label}</p>
                <p className="text-xs text-gray-500">{pm.sublabel}
                  {pm.id === 'wallet' && walletBalance !== null && (
                    <span className={`ml-1 font-bold ${walletBalance >= plan.price ? 'text-green-600' : 'text-red-500'}`}>
                      · Balance: ${walletBalance.toFixed(2)}
                    </span>
                  )}
                </p>
              </div>
              {method === pm.id && <FiCheck size={16} className="text-[#25D366] flex-shrink-0" />}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-4 bg-gray-50 rounded-xl p-3">
          <FiLock size={14} className="text-gray-400 flex-shrink-0" />
          <p className="text-xs text-gray-500">Payments are secured with 256-bit encryption. Cancel anytime from settings.</p>
        </div>

        <button onClick={handlePay} disabled={loading}
          className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2">
          {loading
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            : <>Pay ${plan.price} with {PAYMENT_METHODS.find(p => p.id === method)?.label}</>}
        </button>
      </motion.div>
    </div>
  );
}

export default function SubscriptionPage({ onBack }) {
  const [current, setCurrent] = useState(null);
  const [loading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  useEffect(() => {
    api.get('/v2/monetization/subscription/current')
      .then(({ data }) => setCurrent(data))
      .catch(() => setCurrent({ plan: 'free', status: 'active' }))
      .finally(() => setPageLoading(false));
  }, []);

  const handleUpgrade = (plan) => {
    if (plan.price === 0) return;
    setSelectedPlan(plan);
    setShowPaymentModal(true);
  };

  const handlePaymentSuccess = () => {
    setShowPaymentModal(false);
    setPageLoading(true);
    api.get('/v2/monetization/subscription/current')
      .then(({ data }) => setCurrent(data))
      .finally(() => setPageLoading(false));
    toast.success('Plan upgraded! Enjoy your new features.');
  };

  const API_PLANS = [
    { name: 'Free API', price: 0, features: ['100 messages/day', '10 req/min', 'Test sandbox'] },
    { name: 'Starter API', price: 4, features: ['1,000 messages/day', '30 req/min', '5 broadcast lists', 'Webhooks'] },
    { name: 'Pro API', price: 9, features: ['10,000 messages/day', '100 req/min', '50 broadcasts', 'Analytics'] },
    { name: 'Enterprise API', price: 29, features: ['Unlimited messages', '500 req/min', '20 webhooks', 'SLA + support'] },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition">
              <FiArrowLeft size={20} className="text-gray-600" />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-sm text-gray-500">Choose the plan that fits your needs</p>
          </div>
          {current && (
            <div className="ml-auto flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-1.5">
              <FiZap size={14} className="text-[#25D366]" />
              <span className="text-sm font-bold text-[#25D366] capitalize">{current.plan}</span>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="text-3xl sm:text-4xl font-black text-gray-900 mb-3">
            Simple, Affordable Pricing
          </motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-gray-500 max-w-xl mx-auto">
            Free forever for essentials. Upgrade anytime — no contracts, cancel anytime.
            Pay with card, PayPal, Flutterwave, Crypto, or your VipChat Wallet.
          </motion.p>

          {/* Payment badges */}
          <div className="flex flex-wrap gap-2 justify-center mt-4">
            {['💳 Card', '🅿️ PayPal', '🌍 Flutterwave', '₿ Bitcoin', '⟠ Ethereum', '👛 Wallet'].map(m => (
              <span key={m} className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1 rounded-full font-semibold">
                {m}
              </span>
            ))}
          </div>
        </div>

        {/* Plan cards */}
        {pageLoading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-16">
            {PLANS.map((plan, i) => (
              <motion.div key={plan.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}>
                <PlanCard plan={plan} current={current} onUpgrade={handleUpgrade} loading={loading} />
              </motion.div>
            ))}
          </div>
        )}

        {/* Feature comparison */}
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 mb-10 overflow-x-auto">
          <h3 className="text-lg font-bold text-gray-900 mb-5">Feature Comparison</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-gray-500 font-semibold pb-3 pr-4">Feature</th>
                {PLANS.map(p => (
                  <th key={p.id} className="text-center font-bold pb-3 px-2" style={{ color: p.color }}>{p.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'Monthly Price', values: ['Free', '$4.99', '$14.99'] },
                { label: 'Contacts', values: ['100', 'Unlimited', 'Unlimited'] },
                { label: 'File Storage', values: ['2 GB', '25 GB', '100 GB'] },
                { label: 'Group calls', values: ['Up to 8', 'Up to 50', 'Up to 100'] },
                { label: 'Screen sharing', values: ['✗', '✓', '✓'] },
                { label: 'API access', values: ['✗', '✗', '100k calls/mo'] },
                { label: 'Ads', values: ['Shown', 'Ad-free', 'Ad-free'] },
                { label: 'Trends upload', values: ['✗', '✓', '✓ (Business)'] },
                { label: 'Wallet', values: ['✓', '✓', '✓ Priority'] },
                { label: 'Support', values: ['Community', '24/7 Priority', 'Dedicated'] },
              ].map(row => (
                <tr key={row.label} className="border-b border-gray-50">
                  <td className="py-2.5 pr-4 text-gray-700 font-medium">{row.label}</td>
                  {row.values.map((v, i) => (
                    <td key={i} className="py-2.5 text-center text-gray-600 px-2">
                      {v === '✓' ? <FiCheck size={16} className="text-[#25D366] mx-auto" /> :
                       v === '✗' ? <FiX size={16} className="text-gray-300 mx-auto" /> : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* API Plans */}
        <div className="mb-10">
          <div className="text-center mb-6">
            <h3 className="text-2xl font-bold text-gray-900">VipChat API Plans</h3>
            <p className="text-gray-500 text-sm mt-1">For developers & businesses — affordable pricing</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {API_PLANS.map((ap, i) => (
              <motion.div key={ap.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition">
                <p className="font-bold text-gray-900 text-sm">{ap.name}</p>
                <p className="text-2xl font-black text-[#25D366] mt-1">
                  {ap.price === 0 ? 'Free' : `$${ap.price}`}
                  {ap.price > 0 && <span className="text-sm text-gray-400 font-normal">/mo</span>}
                </p>
                <ul className="mt-3 space-y-1.5">
                  {ap.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-gray-600">
                      <FiCheck size={11} className="text-[#25D366] flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div className="flex flex-wrap gap-4 justify-center text-sm text-gray-500">
          {[
            { icon: FiShield, text: '256-bit encrypted payments' },
            { icon: FiRefreshCw, text: 'Cancel anytime' },
            { icon: FiGlobe, text: 'Global payment methods' },
            { icon: FiAward, text: '30-day money back guarantee' },
          ].map(b => (
            <div key={b.text} className="flex items-center gap-1.5">
              <b.icon size={14} className="text-[#25D366]" />
              <span>{b.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Payment modal */}
      <AnimatePresence>
        {showPaymentModal && selectedPlan && (
          <PaymentModal
            plan={selectedPlan}
            onClose={() => setShowPaymentModal(false)}
            onSuccess={handlePaymentSuccess}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
