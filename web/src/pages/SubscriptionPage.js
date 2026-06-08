import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiCheck, FiZap, FiShield, FiStar, FiUsers, FiMessageCircle,
  FiVideo, FiArrowLeft, FiX, FiRefreshCw
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    color: '#6b7280',
    gradient: 'from-gray-400 to-gray-600',
    features: [
      'Up to 100 contacts',
      '1:1 & Group messaging',
      'Voice & video calls',
      '2GB file sharing',
      'Basic status updates',
      'Web & mobile access',
    ],
    limits: ['100MB max file size', 'No priority support', 'Ads shown'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    color: '#25D366',
    gradient: 'from-[#25D366] to-[#075E54]',
    badge: 'Most Popular',
    features: [
      'Unlimited contacts',
      'Priority messaging',
      'HD video calls (up to 50 people)',
      '25GB file sharing',
      'Advanced status analytics',
      'Custom chat themes',
      'Message scheduling',
      'No ads',
      'Priority support 24/7',
    ],
    limits: [],
  },
  {
    id: 'enterprise',
    name: 'Business',
    price: 29.99,
    color: '#7c3aed',
    gradient: 'from-purple-500 to-purple-800',
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
    ],
    limits: [],
  },
];

function PlanCard({ plan, current, onUpgrade, loading }) {
  const isCurrent = current?.plan === plan.id;
  const isDowngrade = current && PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === current.plan);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative rounded-3xl overflow-hidden border-2 transition-all ${
        isCurrent ? 'border-[#25D366] shadow-lg' : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
      }`}
    >
      {plan.badge && (
        <div className="absolute top-4 right-4 bg-[#25D366] text-white text-xs font-bold px-2.5 py-1 rounded-full">
          {plan.badge}
        </div>
      )}
      <div className={`bg-gradient-to-br ${plan.gradient} p-6 text-white`}>
        <h3 className="text-xl font-bold">{plan.name}</h3>
        <div className="mt-2">
          {plan.price === 0
            ? <span className="text-3xl font-extrabold">Free</span>
            : <><span className="text-3xl font-extrabold">${plan.price}</span><span className="text-white/70">/mo</span></>
          }
        </div>
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
          <div className="w-full py-3 bg-gray-50 border border-gray-200 text-gray-600 font-semibold text-center rounded-2xl text-sm">
            Current Plan
          </div>
        ) : (
          <button
            onClick={() => onUpgrade(plan)}
            disabled={loading || isDowngrade}
            className="w-full py-3 font-bold text-sm rounded-2xl transition disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: plan.color, color: 'white' }}
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : isDowngrade ? 'Downgrade (contact support)' : plan.price === 0 ? 'Switch to Free' : `Upgrade to ${plan.name}`}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function SubscriptionPage({ onBack }) {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    setLoading(true);
    try {
      const res = await api.get('/v2/monetization/subscription/current');
      setSubscription(res.data);
    } catch {
      setSubscription({ plan: 'free', status: 'active' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan) => {
    if (plan.price === 0) {
      toast('Contact support to downgrade', { icon: 'ℹ️' });
      return;
    }
    setUpgrading(true);
    try {
      const res = await api.post('/v2/monetization/subscription/upgrade', {
        plan: plan.id,
        payment_provider: 'stripe',
      });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else {
        toast.success(`Upgraded to ${plan.name}!`);
        loadSubscription();
      }
    } catch (e) {
      const msg = e.response?.data?.error || 'Upgrade failed';
      if (msg.includes('not configured')) {
        toast.error('Payment not configured. Set STRIPE_SECRET_KEY.');
      } else {
        toast.error(msg);
      }
    } finally {
      setUpgrading(false);
    }
  };

  const currentPlan = PLANS.find(p => p.id === subscription?.plan) || PLANS[0];

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded-full hover:bg-white/10">
            <FiArrowLeft size={20} />
          </button>
        )}
        <FiZap size={22} />
        <div className="flex-1">
          <h1 className="font-bold text-lg">Subscription</h1>
          <p className="text-white/70 text-xs">Manage your plan</p>
        </div>
        <button onClick={loadSubscription} className="p-2 rounded-full hover:bg-white/10">
          <FiRefreshCw size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {/* Current Plan Banner */}
        {!loading && subscription && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`bg-gradient-to-r ${currentPlan.gradient} rounded-3xl p-5 text-white`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/70 text-sm">Current Plan</p>
                <h2 className="text-2xl font-extrabold">{currentPlan.name}</h2>
                <p className="text-white/80 text-sm mt-1">
                  Status: <span className="font-semibold capitalize">{subscription.status || 'active'}</span>
                  {subscription.expires_at && (
                    <> · Renews {new Date(subscription.expires_at).toLocaleDateString()}</>
                  )}
                </p>
              </div>
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center">
                {currentPlan.id === 'free' ? <FiStar size={28} />
                  : currentPlan.id === 'pro' ? <FiZap size={28} />
                  : <FiShield size={28} />}
              </div>
            </div>
          </motion.div>
        )}

        {/* Usage Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: FiMessageCircle, label: 'Messages', value: '∞', sub: 'sent' },
            { icon: FiUsers, label: 'Contacts', value: user ? '—' : '0', sub: 'synced' },
            { icon: FiVideo, label: 'Calls', value: '∞', sub: 'available' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-2xl p-3 text-center shadow-sm">
              <s.icon size={20} className="mx-auto text-[#25D366] mb-1" />
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Plans */}
        <div>
          <h2 className="font-bold text-gray-900 mb-3">Choose a Plan</h2>
          <div className="space-y-4">
            {PLANS.map(plan => (
              <PlanCard
                key={plan.id}
                plan={plan}
                current={subscription}
                onUpgrade={handleUpgrade}
                loading={upgrading}
              />
            ))}
          </div>
        </div>

        {/* Features comparison */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">Why upgrade?</h3>
          <div className="space-y-3">
            {[
              { icon: FiZap, text: 'Priority message delivery across all devices' },
              { icon: FiShield, text: 'Advanced end-to-end encryption with audit log' },
              { icon: FiUsers, text: 'HD group video calls with up to 50 participants' },
              { icon: FiMessageCircle, text: 'Message scheduling and automated replies' },
              { icon: FiStar, text: 'Verified badge on your profile' },
            ].map(f => (
              <div key={f.text} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#e7f8f0] rounded-xl flex items-center justify-center flex-shrink-0">
                  <f.icon size={16} className="text-[#25D366]" />
                </div>
                <p className="text-sm text-gray-700 mt-1">{f.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center text-xs text-gray-400 pb-4">
          Secure payments via Stripe · Cancel anytime · No hidden fees
        </div>
      </div>
    </div>
  );
}
