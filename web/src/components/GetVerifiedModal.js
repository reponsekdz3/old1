import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiCheck, FiShield, FiBriefcase, FiCreditCard, FiZap } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../services/store';

const TIERS = [
  {
    id: 'personal',
    label: 'Personal',
    price: '$2.99',
    badge: '✅',
    color: 'from-[#25D366] to-[#128C7E]',
    ring: 'ring-[#25D366]',
    icon: FiShield,
    perks: [
      'Blue verified badge on your profile',
      'Badge shown in all chats & groups',
      'Trusted profile indicator',
      'One-time payment — never expires',
    ],
  },
  {
    id: 'business',
    label: 'Business',
    price: '$9.99',
    badge: '🏢',
    color: 'from-[#0070f3] to-[#00c6ff]',
    ring: 'ring-blue-500',
    icon: FiBriefcase,
    perks: [
      'Gold verified badge + business label',
      'Badge shown in all chats & groups',
      'Priority in search results',
      'One-time payment — never expires',
    ],
  },
];

function loadFlutterwaveScript() {
  return new Promise((resolve) => {
    if (window.FlutterwaveCheckout) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.flutterwave.com/v3.js';
    script.onload = resolve;
    document.head.appendChild(script);
  });
}

export default function GetVerifiedModal({ onClose, onSuccess }) {
  const { user, setUser } = useAuthStore();
  const [selectedTier, setSelectedTier] = useState('personal');
  const [step, setStep] = useState('select');
  const [loading, setLoading] = useState(false);

  const baseUrl = window.location.origin;

  const handleStripe = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/payments/stripe/create-checkout-session', {
        tier: selectedTier,
      });
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start Stripe checkout');
      setLoading(false);
    }
  }, [selectedTier, baseUrl]);

  const handleFlutterwave = useCallback(async () => {
    setLoading(true);
    try {
      await loadFlutterwaveScript();
      const { data } = await api.post('/payments/flutterwave/initialize', { tier: selectedTier });

      window.FlutterwaveCheckout({
        public_key: data.public_key,
        tx_ref: data.tx_ref,
        amount: data.amount,
        currency: data.currency,
        payment_options: 'card, mobilemoneyghana, ussd, mobilemoneyuganda, mobilemoneyzambia, mobilemoneyrwanda, mobilemoneymozambique, account',
        customer: {
          email: data.customer_email,
          name: data.customer_name,
          phone_number: data.customer_phone,
        },
        customizations: {
          title: 'VipChat Verification',
          description: data.description,
          logo: 'https://vipchat.replit.app/logo192.png',
        },
        callback: async function (paymentData) {
          if (paymentData.status === 'successful' || paymentData.status === 'completed') {
            try {
              const verifyResp = await api.post(`/payments/flutterwave/verify/${data.tx_ref}`);
              if (verifyResp.data.verified) {
                setStep('success');
                if (setUser) {
                  setUser({
                    ...user,
                    badge_verified: true,
                    verification_tier: selectedTier,
                  });
                }
                if (onSuccess) onSuccess();
              } else {
                toast.error('Payment verification failed. Contact support.');
              }
            } catch {
              toast.error('Could not verify payment. Contact support.');
            }
          } else {
            toast.error('Payment was not completed.');
          }
          setLoading(false);
        },
        onclose: function () {
          setLoading(false);
        },
      });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not start Flutterwave checkout');
      setLoading(false);
    }
  }, [selectedTier, user, setUser, onSuccess]);

  const tier = TIERS.find(t => t.id === selectedTier);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
        <motion.div
          initial={{ y: '100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {step === 'success' ? (
            <div className="p-8 text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center"
              >
                <FiCheck size={40} className="text-white" strokeWidth={3} />
              </motion.div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">You're Verified! ✅</h2>
              <p className="text-gray-500 text-sm mb-6">
                Your VipChat profile now has a verified badge. It will appear next to your name in all chats and your profile.
              </p>
              <button
                onClick={onClose}
                className="w-full py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-2xl transition"
              >
                Awesome, thanks!
              </button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] px-5 pt-6 pb-5 flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Get Verified ✅</h2>
                  <p className="text-white/70 text-sm mt-0.5">One-time fee · Badge never expires</p>
                </div>
                <button onClick={onClose} className="p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition">
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto max-h-[80vh]">
                {/* Tier selector */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Choose your plan</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {TIERS.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTier(t.id)}
                      className={`relative border-2 rounded-2xl p-4 text-left transition-all ${
                        selectedTier === t.id
                          ? `border-[#25D366] bg-green-50 ring-2 ${t.ring}`
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {selectedTier === t.id && (
                        <motion.div
                          layoutId="tier-check"
                          className="absolute top-3 right-3 w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center"
                        >
                          <FiCheck size={11} className="text-white" strokeWidth={3} />
                        </motion.div>
                      )}
                      <span className="text-2xl">{t.badge}</span>
                      <p className="font-bold text-gray-900 mt-2 text-sm">{t.label}</p>
                      <p className="text-lg font-extrabold text-[#25D366]">{t.price}</p>
                      <p className="text-[10px] text-gray-400">one-time</p>
                    </button>
                  ))}
                </div>

                {/* Perks */}
                <div className="bg-gray-50 rounded-2xl p-4 mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">What you get</p>
                  <ul className="space-y-2">
                    {tier?.perks.map((perk, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700">
                        <div className="w-5 h-5 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <FiCheck size={11} className="text-[#25D366]" strokeWidth={3} />
                        </div>
                        {perk}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Payment buttons */}
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Pay securely with</p>

                <button
                  onClick={handleStripe}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-[#635BFF] hover:bg-[#5046e5] disabled:bg-gray-200 text-white font-bold rounded-2xl transition mb-3"
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <FiCreditCard size={18} />
                      Pay with Card (Stripe) · {tier?.price}
                    </>
                  )}
                </button>

                <button
                  onClick={handleFlutterwave}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-3 py-3.5 bg-gradient-to-r from-[#F5A623] to-[#F7971E] hover:from-[#e5960f] hover:to-[#e8881c] disabled:from-gray-200 disabled:to-gray-200 text-white font-bold rounded-2xl transition mb-4"
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <FiZap size={18} />
                      Pay with Mobile Money (Flutterwave) · {tier?.price}
                    </>
                  )}
                </button>

                <p className="text-center text-[11px] text-gray-400">
                  🔒 Payments processed securely by Stripe & Flutterwave.<br />
                  Your card details are never stored on our servers.
                </p>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
