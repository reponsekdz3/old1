import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiGift, FiX, FiCoin, FiZap, FiSend, FiInfo } from 'react-icons/fi';
import { GiDiamondRing, GiCrown, GiRose } from 'react-icons/gi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const CATEGORY_COLORS = {
  basic: 'from-gray-100 to-gray-200 border-gray-200',
  premium: 'from-purple-50 to-indigo-50 border-purple-200',
  legendary: 'from-yellow-50 to-orange-50 border-yellow-300',
};

const CATEGORY_LABELS = { basic: 'Basic', premium: 'Premium', legendary: 'Legendary ✨' };

function FloatingGift({ gift, onDone }) {
  const count = Math.max(1, Math.min(gift.quantity || 1, 12));
  const particles = Array.from({ length: count });

  const animations = {
    float: { y: [-10, -180], opacity: [1, 0], scale: [1.2, 0.5] },
    heart: { y: [-10, -200], x: [0, Math.random() > 0.5 ? 40 : -40], opacity: [1, 0], scale: [1.4, 0.6] },
    explode: { y: [-10, -80], opacity: [1, 0], scale: [1.8, 0], rotate: [0, 360] },
    spin: { y: [-10, -150], rotate: [0, 720], opacity: [1, 0], scale: [1.3, 0.4] },
    rain: { y: [0, 200], opacity: [1, 0], scale: [1.2, 0.8] },
  };

  const anim = animations[gift.animation_type] || animations.float;

  useEffect(() => {
    const t = setTimeout(onDone, 2800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-end justify-center pb-20">
      {particles.map((_, i) => (
        <motion.div
          key={i}
          className="absolute text-4xl select-none"
          style={{
            left: `${30 + Math.random() * 40}%`,
            bottom: `${10 + Math.random() * 30}%`,
          }}
          animate={anim}
          transition={{ duration: 2.5, delay: i * 0.12, ease: 'easeOut' }}
        >
          {gift.emoji}
        </motion.div>
      ))}
      <motion.div
        className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-black/80 text-white text-sm font-bold px-4 py-2 rounded-full whitespace-nowrap"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -20] }}
        transition={{ duration: 2.5, times: [0, 0.15, 0.7, 1] }}
      >
        {gift.name} {gift.quantity > 1 ? `×${gift.quantity}` : ''} · {gift.coins_deducted} coins
      </motion.div>
    </div>
  );
}

export function GiftOverlayManager({ events }) {
  return (
    <AnimatePresence>
      {events.map(ev => (
        <motion.div key={ev.id} className="pointer-events-none absolute inset-0 z-50">
          <FloatingGift gift={{ ...ev.gift, quantity: ev.quantity, coins_deducted: ev.coins_deducted }} onDone={() => {}} />
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

export default function GiftSystem({ recipientId, recipientName, context = 'chat', contextId, onClose, onSent, socket }) {
  const navigate = useNavigate();
  const [gifts, setGifts] = useState([]);
  const [balance, setBalance] = useState(0);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState('');
  const [isAnon, setIsAnon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [activeGift, setActiveGift] = useState(null);
  const [tab, setTab] = useState('basic');

  useEffect(() => {
    api.get('/gifts/catalog')
      .then(r => { setGifts(r.data.gifts); setBalance(r.data.coin_balance); })
      .catch(() => toast.error('Failed to load gifts'))
      .finally(() => setLoading(false));
  }, []);

  const sendGift = useCallback(async () => {
    if (!selected) return;
    setSending(true);
    try {
      const r = await api.post('/gifts/send', {
        gift_id: selected.id,
        recipient_id: recipientId,
        quantity,
        context,
        context_id: contextId,
        message,
        is_anonymous: isAnon,
      });
      setBalance(r.data.new_balance);
      const giftData = { ...selected, quantity, coins_deducted: r.data.transaction.coins_deducted };
      setActiveGift(giftData);
      toast.success(`${selected.emoji} Gift sent!`);
      onSent?.(giftData);
      setSelected(null);
      setQuantity(1);
      setMessage('');
    } catch (err) {
      const msg = err?.response?.data?.error || 'Failed to send gift';
      if (msg.includes('Insufficient')) {
        toast.error(`${msg} — top up your wallet?`, { duration: 4000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setSending(false);
    }
  }, [selected, recipientId, quantity, context, contextId, message, isAnon]);

  const categories = ['basic', 'premium', 'legendary'];
  const filtered = gifts.filter(g => g.category === tab);

  return (
    <>
      {activeGift && (
        <AnimatePresence>
          <div className="pointer-events-none fixed inset-0 z-[60]">
            <FloatingGift gift={activeGift} onDone={() => setActiveGift(null)} />
          </div>
        </AnimatePresence>
      )}

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
              <FiGift size={15} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Send a Gift to {recipientName}</p>
              <p className="text-xs text-gray-400">Support your favorite creator</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/gift-wallet')}
              className="flex items-center gap-1.5 bg-yellow-50 border border-yellow-200 text-yellow-700 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-yellow-100 transition"
            >
              <span>🪙</span> {balance.toLocaleString()} coins
            </button>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200">
              <FiX size={15} />
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 px-5 pt-3">
          {categories.map(cat => (
            <button key={cat} onClick={() => setTab(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                tab === cat
                  ? 'bg-[#25D366] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Gift grid */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {loading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="animate-pulse h-20 bg-gray-100 rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3">
              {filtered.map(gift => (
                <motion.button
                  key={gift.id}
                  whileTap={{ scale: 0.93 }}
                  onClick={() => setSelected(g => g?.id === gift.id ? null : gift)}
                  className={`relative flex flex-col items-center gap-1 p-3 rounded-2xl border-2 transition-all ${
                    selected?.id === gift.id
                      ? 'border-[#25D366] bg-green-50 shadow-md'
                      : `bg-gradient-to-br ${CATEGORY_COLORS[gift.category]} hover:shadow-sm`
                  }`}
                >
                  <span className="text-3xl">{gift.emoji}</span>
                  <p className="text-[10px] font-bold text-gray-700 text-center leading-tight">{gift.name}</p>
                  <div className="flex items-center gap-0.5">
                    <span className="text-[9px] text-yellow-600 font-bold">🪙{gift.coin_cost}</span>
                  </div>
                  {selected?.id === gift.id && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#25D366] rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full" />
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          )}
        </div>

        {/* Send panel — shown when gift selected */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-gray-100 overflow-hidden"
            >
              <div className="px-5 py-4 space-y-3">
                {/* Quantity */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-600">Quantity</p>
                  <div className="flex items-center gap-3">
                    {[1, 5, 10, 50].map(q => (
                      <button key={q} onClick={() => setQuantity(q)}
                        className={`w-8 h-8 rounded-xl text-xs font-bold transition-all ${
                          quantity === q ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                    <input
                      type="number" min={1} max={100} value={quantity}
                      onChange={e => setQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                      className="w-16 text-center text-xs font-bold border border-gray-200 rounded-xl py-1.5 focus:outline-none focus:border-[#25D366]"
                    />
                  </div>
                </div>

                {/* Message */}
                <input
                  type="text" placeholder="Add a message (optional)"
                  value={message} onChange={e => setMessage(e.target.value)} maxLength={200}
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#25D366]"
                />

                {/* Anonymous + Send */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                    <input type="checkbox" checked={isAnon} onChange={e => setIsAnon(e.target.checked)}
                      className="rounded" />
                    Send anonymously
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-gray-400">
                      Cost: <span className="font-bold text-yellow-600">🪙{(selected.coin_cost * quantity).toLocaleString()}</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={sendGift}
                      disabled={sending || balance < selected.coin_cost * quantity}
                      className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white px-5 py-2 rounded-xl text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow-md transition-shadow"
                    >
                      <FiSend size={13} />
                      {sending ? 'Sending…' : `Send ${selected.emoji}`}
                    </motion.button>
                  </div>
                </div>

                {balance < selected.coin_cost * quantity && (
                  <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
                    <FiInfo size={12} />
                    <span>Not enough coins. </span>
                    <button onClick={() => navigate('/gift-wallet')} className="font-bold underline">Top up wallet →</button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom safe area */}
        <div className="pb-safe" />
      </motion.div>
    </>
  );
}
