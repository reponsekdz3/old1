import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FiArrowLeft, FiGift, FiTrendingUp, FiTrendingDown, FiDollarSign,
  FiCreditCard, FiZap, FiGlobe, FiSend, FiCheck, FiX, FiChevronRight,
  FiAward, FiUsers, FiClock, FiShield,
} from 'react-icons/fi';
import { SiBitcoin } from 'react-icons/si';
import api from '../services/api';
import toast from 'react-hot-toast';

const TOPUP_AMOUNTS = [5, 10, 25, 50, 100, 250];

const PAYMENT_METHODS = [
  { id: 'stripe',       label: 'Card (Stripe)',   sublabel: 'Visa, Mastercard, Amex', icon: FiCreditCard, color: 'from-indigo-500 to-purple-600' },
  { id: 'paypal',       label: 'PayPal',           sublabel: 'Fast & secure',           icon: FiZap,        color: 'from-blue-500 to-blue-700' },
  { id: 'flutterwave',  label: 'Flutterwave',      sublabel: 'Africa & global',         icon: FiGlobe,      color: 'from-orange-400 to-rose-500' },
];

const WITHDRAW_METHODS = [
  { id: 'paypal',      label: 'PayPal',      icon: FiZap },
  { id: 'flutterwave', label: 'Flutterwave', icon: FiGlobe },
];

function StatCard({ label, value, sub, color = 'text-gray-900', icon: Icon }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        {Icon && <Icon size={14} className="text-gray-400" />}
        <p className="text-xs font-medium text-gray-500">{label}</p>
      </div>
      <p className={`text-xl font-black ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DepositModal({ onClose, onSuccess }) {
  const [amount, setAmount] = useState(10);
  const [method, setMethod] = useState('stripe');
  const [loading, setLoading] = useState(false);

  const pay = async () => {
    setLoading(true);
    try {
      const r = await api.post(`/gifts/deposit/${method}`, { amount_usd: amount });
      if (method === 'stripe' && r.data.checkout_url) {
        window.location.href = r.data.checkout_url;
      } else if (method === 'flutterwave' && r.data.payment_link) {
        window.location.href = r.data.payment_link;
      } else if (method === 'paypal' && r.data.approve_url) {
        window.location.href = r.data.approve_url;
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Payment error');
      setLoading(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10"
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black">Top Up Coins</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX size={15} /></button>
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">Select amount</p>
        <div className="grid grid-cols-3 gap-2 mb-5">
          {TOPUP_AMOUNTS.map(a => (
            <button key={a} onClick={() => setAmount(a)}
              className={`py-3 rounded-xl text-sm font-bold transition-all ${amount === a ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
              <p>${a}</p>
              <p className={`text-xs ${amount === a ? 'text-green-100' : 'text-gray-400'}`}>{(a * 100).toLocaleString()} coins</p>
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">Payment method</p>
        <div className="space-y-2 mb-5">
          {PAYMENT_METHODS.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${method === m.id ? 'border-[#25D366] bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${m.color} flex items-center justify-center flex-shrink-0`}>
                <m.icon size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">{m.label}</p>
                <p className="text-xs text-gray-400">{m.sublabel}</p>
              </div>
              {method === m.id && <FiCheck size={16} className="text-[#25D366]" />}
            </button>
          ))}
        </div>

        <button onClick={pay} disabled={loading}
          className="w-full bg-gradient-to-r from-[#25D366] to-emerald-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-60 shadow-md hover:shadow-lg transition-shadow">
          {loading ? 'Redirecting…' : `Pay $${amount} — Get ${(amount * 100).toLocaleString()} coins`}
        </button>
      </motion.div>
    </motion.div>
  );
}

function WithdrawModal({ wallet, onClose, onSuccess }) {
  const [amount, setAmount] = useState(Math.min(10, Math.floor(wallet.usd_earned)));
  const [method, setMethod] = useState('paypal');
  const [payoutDetail, setPayoutDetail] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!payoutDetail.trim()) return toast.error('Please enter your payout account');
    setLoading(true);
    try {
      await api.post('/gifts/withdraw', {
        amount_usd: amount, method,
        payout_details: { account: payoutDetail },
      });
      toast.success('Withdrawal request submitted! Admin will process within 24–48 hours.');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Withdrawal failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10"
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black">Withdraw Earnings</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX size={15} /></button>
        </div>

        <div className="bg-green-50 rounded-xl p-3 mb-5 text-sm text-green-700 font-medium">
          Available: <span className="font-black">${wallet.usd_earned.toFixed(2)}</span>
          <p className="text-xs text-green-600 mt-0.5">Minimum withdrawal: $10.00</p>
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">Amount (USD)</p>
        <input type="number" min={10} max={wallet.usd_earned} step="0.01" value={amount}
          onChange={e => setAmount(parseFloat(e.target.value) || 0)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold mb-4 focus:outline-none focus:border-[#25D366]" />

        <p className="text-xs font-medium text-gray-500 mb-2">Payout method</p>
        <div className="flex gap-2 mb-4">
          {WITHDRAW_METHODS.map(m => (
            <button key={m.id} onClick={() => setMethod(m.id)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${method === m.id ? 'border-[#25D366] bg-green-50 text-[#25D366]' : 'border-gray-100 text-gray-600'}`}>
              {m.label}
            </button>
          ))}
        </div>

        <p className="text-xs font-medium text-gray-500 mb-2">
          {method === 'paypal' ? 'PayPal email address' : 'Flutterwave account / phone'}
        </p>
        <input type="text" placeholder={method === 'paypal' ? 'your@paypal.com' : '+234...'} value={payoutDetail}
          onChange={e => setPayoutDetail(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm mb-5 focus:outline-none focus:border-[#25D366]" />

        <button onClick={submit} disabled={loading || amount < 10 || amount > wallet.usd_earned}
          className="w-full bg-gradient-to-r from-[#25D366] to-emerald-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-60 shadow-md">
          {loading ? 'Submitting…' : `Request Withdrawal — $${amount.toFixed(2)}`}
        </button>
      </motion.div>
    </motion.div>
  );
}

function TxnRow({ txn, type }) {
  const isGiftSent = type === 'sent';
  const isDeposit = type === 'deposit';
  const isWithdraw = type === 'withdraw';
  const isGiftReceived = type === 'received';

  let icon = isGiftSent ? '🎁' : isDeposit ? '💰' : isWithdraw ? '💸' : '🎁';
  let label = isGiftSent ? `Sent ${txn.gift?.name}` : isDeposit ? `Top-up via ${txn.provider}` : isWithdraw ? `Withdrawal` : `Received ${txn.gift?.name}`;
  let sub = isGiftSent ? `to ${txn.recipient_name}` : isDeposit ? `${txn.coins_credited?.toLocaleString()} coins` : isWithdraw ? txn.method : `from ${txn.sender_name}`;
  let amount = isGiftSent ? `-${txn.coins_deducted} 🪙` : isDeposit ? `+${txn.coins_credited?.toLocaleString()} 🪙` : isWithdraw ? `-$${txn.amount_usd?.toFixed(2)}` : `+$${txn.usd_credited?.toFixed(4)}`;
  let amtColor = (isDeposit || isGiftReceived) ? 'text-green-600' : 'text-red-500';
  let statusBadge = txn.status ? txn.status : null;

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center text-xl flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{label}</p>
        <p className="text-xs text-gray-400 truncate">{sub} · {new Date(txn.created_at || txn.requested_at).toLocaleDateString()}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${amtColor}`}>{amount}</p>
        {statusBadge && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
            statusBadge === 'completed' ? 'bg-green-100 text-green-700' :
            statusBadge === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
          }`}>{statusBadge}</span>
        )}
      </div>
    </div>
  );
}

export default function GiftWalletPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [topGifters, setTopGifters] = useState([]);
  const [topEarners, setTopEarners] = useState([]);

  const load = useCallback(() => {
    api.get('/gifts/wallet')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load wallet'))
      .finally(() => setLoading(false));
    api.get('/gifts/top-gifters?limit=5').then(r => setTopGifters(r.data.top_gifters)).catch(() => {});
    api.get('/gifts/top-earners?limit=5').then(r => setTopEarners(r.data.top_earners)).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const depositId = searchParams.get('deposit_id');
    if (searchParams.get('deposit_success') && depositId) {
      api.post(`/gifts/deposit/${depositId}/verify`)
        .then(r => { if (r.data.status === 'completed') toast.success(`🪙 ${r.data.coins?.toLocaleString()} coins added!`); })
        .catch(() => {});
    }
    if (searchParams.get('deposit_success')) setShowDeposit(false);
  }, [load, searchParams]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'deposits', label: 'Top-ups' },
    { id: 'sent', label: 'Gifts Sent' },
    { id: 'received', label: 'Received' },
    { id: 'withdrawals', label: 'Withdrawals' },
    { id: 'leaderboard', label: '🏆 Top' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const wallet = data?.wallet || {};

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#25D366] to-emerald-600 pt-12 pb-8 px-5">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <FiArrowLeft size={16} className="text-white" />
          </button>
          <h1 className="text-white font-black text-lg">Gift Wallet</h1>
        </div>

        <div className="text-center">
          <p className="text-white/70 text-xs font-medium mb-1">Coin Balance</p>
          <p className="text-5xl font-black text-white mb-1">🪙 {(wallet.coin_balance || 0).toLocaleString()}</p>
          <p className="text-white/60 text-xs">≈ ${((wallet.coin_balance || 0) / 100).toFixed(2)} USD</p>
        </div>

        {(wallet.usd_earned || 0) > 0 && (
          <div className="mt-4 bg-white/20 rounded-2xl px-4 py-3 text-center">
            <p className="text-white/80 text-xs mb-0.5">Creator Earnings</p>
            <p className="text-2xl font-black text-white">${(wallet.usd_earned || 0).toFixed(2)}</p>
            <p className="text-white/60 text-[10px]">Available to withdraw</p>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDeposit(true)}
            className="flex-1 bg-white text-[#25D366] py-3 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2">
            <span>+</span> Add Coins
          </motion.button>
          {(wallet.usd_earned || 0) >= 10 && (
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowWithdraw(true)}
              className="flex-1 bg-white/20 text-white py-3 rounded-2xl font-bold text-sm border border-white/30 flex items-center justify-center gap-2">
              <FiSend size={13} /> Withdraw
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 px-5 -mt-3 mb-4">
        {[
          { label: 'Coins Gifted', value: (wallet.total_gifted_coins || 0).toLocaleString(), icon: '🎁' },
          { label: 'Gifts Received', value: (data?.gifts_received?.length || 0), icon: '💝' },
          { label: 'Total Spent', value: `$${(wallet.total_spent_usd || 0).toFixed(0)}`, icon: '💳' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 text-center">
            <p className="text-lg">{s.icon}</p>
            <p className="text-base font-black text-gray-900">{s.value}</p>
            <p className="text-[10px] text-gray-400 font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-5 mb-3 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === t.id ? 'bg-[#25D366] text-white' : 'bg-white text-gray-500 border border-gray-200'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-10">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {activeTab === 'overview' && (
            <div className="p-4">
              <p className="text-xs font-semibold text-gray-400 mb-3">RECENT ACTIVITY</p>
              {[
                ...(data?.deposits || []).slice(0, 3).map(d => ({ ...d, _type: 'deposit' })),
                ...(data?.gifts_sent || []).slice(0, 3).map(d => ({ ...d, _type: 'sent' })),
                ...(data?.gifts_received || []).slice(0, 3).map(d => ({ ...d, _type: 'received' })),
              ].sort((a, b) => new Date(b.created_at || b.requested_at) - new Date(a.created_at || a.requested_at))
               .slice(0, 10)
               .map((item, i) => <TxnRow key={i} txn={item} type={item._type} />)
              }
              {!data?.deposits?.length && !data?.gifts_sent?.length && (
                <div className="text-center py-8 text-gray-400">
                  <FiGift size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">No activity yet</p>
                  <p className="text-xs mt-1">Top up coins and start gifting!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'deposits' && (
            <div className="p-4">
              {(data?.deposits || []).length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No deposits yet</p>
              ) : (data.deposits.map((d, i) => <TxnRow key={i} txn={d} type="deposit" />))}
            </div>
          )}

          {activeTab === 'sent' && (
            <div className="p-4">
              {(data?.gifts_sent || []).length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No gifts sent yet</p>
              ) : (data.gifts_sent.map((d, i) => <TxnRow key={i} txn={d} type="sent" />))}
            </div>
          )}

          {activeTab === 'received' && (
            <div className="p-4">
              {(data?.gifts_received || []).length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No gifts received yet</p>
              ) : (data.gifts_received.map((d, i) => <TxnRow key={i} txn={d} type="received" />))}
            </div>
          )}

          {activeTab === 'withdrawals' && (
            <div className="p-4">
              {(data?.withdrawals || []).length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">No withdrawals yet</p>
              ) : (data.withdrawals.map((d, i) => <TxnRow key={i} txn={d} type="withdraw" />))}
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3">🏅 TOP GIFTERS</p>
                {topGifters.map((u, i) => (
                  <div key={u.user_id} className="flex items-center gap-3 py-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.user_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{u.user_name}</p>
                      <p className="text-xs text-gray-400">{u.gift_count} gifts</p>
                    </div>
                    <p className="text-sm font-black text-yellow-600">🪙{u.total_coins?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-bold text-gray-500 mb-3">💰 TOP EARNERS</p>
                {topEarners.map((u, i) => (
                  <div key={u.user_id} className="flex items-center gap-3 py-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                      i === 0 ? 'bg-yellow-400 text-white' : i === 1 ? 'bg-gray-300 text-gray-700' : i === 2 ? 'bg-orange-300 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</div>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {u.user_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{u.user_name}</p>
                      <p className="text-xs text-gray-400">{u.gift_count} gifts received</p>
                    </div>
                    <p className="text-sm font-black text-green-600">${u.total_usd?.toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {showDeposit && <DepositModal onClose={() => setShowDeposit(false)} onSuccess={load} />}
        {showWithdraw && wallet && <WithdrawModal wallet={wallet} onClose={() => setShowWithdraw(false)} onSuccess={load} />}
      </AnimatePresence>
    </div>
  );
}
