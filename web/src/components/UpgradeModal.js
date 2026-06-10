import React from 'react';
import { motion } from 'framer-motion';
import { FiX, FiZap, FiCheck, FiArrowRight } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';

const FEATURES = [
  { label: 'Unlimited messages per day', pro: true, free: '200/day' },
  { label: 'Video & audio calls', pro: true, free: '10 min limit' },
  { label: 'Live streaming', pro: true, free: false },
  { label: 'Unlimited marketplace products', pro: true, free: '3 max' },
  { label: 'File uploads up to 2GB', pro: true, free: '25MB max' },
  { label: 'Advanced analytics', pro: true, free: false },
  { label: 'Priority support', pro: true, free: false },
  { label: 'Custom branding', pro: true, free: false },
  { label: 'API access', pro: true, free: false },
  { label: 'Unlimited scheduled messages', pro: true, free: '2 max' },
];

export default function UpgradeModal({ onClose, feature, title, description }) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] p-7 text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{
            backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 50%)',
          }} />
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 hover:bg-white/20 rounded-full transition">
            <FiX size={18} />
          </button>
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-4">
            <FiZap size={28} />
          </div>
          <h2 className="font-bold text-2xl mb-1">Upgrade to Pro</h2>
          <p className="text-white/80 text-sm">
            {description || (feature ? `"${feature}" requires a Pro plan.` : 'Unlock the full VipChat experience.')}
          </p>
        </div>

        {/* Feature comparison */}
        <div className="p-5">
          <div className="grid grid-cols-3 text-xs font-bold text-gray-400 mb-3 uppercase tracking-wide px-2">
            <span className="col-span-1">Feature</span>
            <span className="text-center">Free</span>
            <span className="text-center text-[#25D366]">Pro</span>
          </div>
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {FEATURES.map((f, i) => (
              <div key={i} className={`grid grid-cols-3 items-center px-2 py-2 rounded-lg transition ${f.label.toLowerCase().includes((feature||'').toLowerCase()) ? 'bg-[#25D366]/5 border border-[#25D366]/20' : 'hover:bg-gray-50'}`}>
                <span className="text-xs text-gray-700 col-span-1 pr-2">{f.label}</span>
                <span className="text-center">
                  {f.free === false ? (
                    <span className="text-red-400 text-xs font-medium">✕</span>
                  ) : (
                    <span className="text-gray-400 text-xs">{f.free}</span>
                  )}
                </span>
                <span className="text-center">
                  {f.pro === true ? (
                    <FiCheck size={14} className="text-[#25D366] mx-auto" strokeWidth={3} />
                  ) : (
                    <span className="text-[#25D366] text-xs font-medium">{f.pro}</span>
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Pricing + CTA */}
        <div className="px-5 pb-6">
          <div className="flex gap-3 mb-4">
            <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
              <p className="text-xs text-gray-400">Monthly</p>
              <p className="text-xl font-bold text-gray-800 mt-0.5">$4.99<span className="text-xs font-normal text-gray-400">/mo</span></p>
            </div>
            <div className="flex-1 bg-[#25D366]/5 rounded-xl p-3 text-center border border-[#25D366]/20 relative">
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#25D366] text-white text-[10px] font-bold px-2 py-0.5 rounded-full">BEST VALUE</span>
              <p className="text-xs text-gray-400">Yearly</p>
              <p className="text-xl font-bold text-[#25D366] mt-0.5">$3.33<span className="text-xs font-normal text-gray-400">/mo</span></p>
            </div>
          </div>

          <button
            onClick={() => { navigate('/subscription'); onClose?.(); }}
            className="w-full bg-gradient-to-r from-[#075E54] to-[#25D366] text-white rounded-xl py-3.5 font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition active:scale-95"
          >
            <FiZap size={16} /> Upgrade Now <FiArrowRight size={15} />
          </button>
          <p className="text-center text-xs text-gray-400 mt-3">
            Cancel anytime · 7-day free trial · No credit card required
          </p>
        </div>
      </motion.div>
    </div>
  );
}
