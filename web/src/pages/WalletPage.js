import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDollarSign, FiArrowUpRight, FiArrowDownLeft, FiSend,
  FiCreditCard, FiRefreshCw, FiCheck, FiArrowLeft,
  FiZap, FiShield, FiPlus, FiMinus, FiClock, FiGlobe,
  FiX, FiAlertCircle, FiLock, FiSearch,
  FiTrendingUp, FiTrendingDown, FiPrinter, FiCopy,
  FiEye, FiEyeOff, FiDownload,
} from 'react-icons/fi';
import { SiBitcoin, SiEthereum } from 'react-icons/si';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

const TOPUP_AMOUNTS = [5, 10, 25, 50, 100, 250];
const PAYMENT_METHODS = [
  { id: 'stripe', label: 'Card (Stripe)', sublabel: 'Visa, Mastercard, Amex', icon: FiCreditCard, color: 'from-indigo-500 to-purple-600' },
  { id: 'paypal', label: 'PayPal', sublabel: 'Fast & secure', icon: FiZap, color: 'from-blue-500 to-blue-700' },
  { id: 'flutterwave', label: 'Flutterwave', sublabel: 'Africa & global', icon: FiGlobe, color: 'from-orange-400 to-rose-500' },
  { id: 'crypto', label: 'Crypto / Bitcoin', sublabel: 'BTC, ETH, USDC, DAI', icon: SiBitcoin, color: 'from-orange-400 to-yellow-500' },
];

const TX_TYPE_LABELS = {
  topup: { label: 'Top-up', icon: FiArrowDownLeft, credit: true, bg: 'bg-green-100', color: 'text-green-600' },
  send: { label: 'Sent', icon: FiArrowUpRight, credit: false, bg: 'bg-red-100', color: 'text-red-500' },
  receive: { label: 'Received', icon: FiArrowDownLeft, credit: true, bg: 'bg-green-100', color: 'text-green-600' },
  withdraw: { label: 'Withdraw', icon: FiArrowUpRight, credit: false, bg: 'bg-orange-100', color: 'text-orange-500' },
  refund: { label: 'Refund', icon: FiArrowDownLeft, credit: true, bg: 'bg-blue-100', color: 'text-blue-500' },
  fee: { label: 'Fee', icon: FiMinus, credit: false, bg: 'bg-gray-100', color: 'text-gray-500' },
};

function Spinner() {
  return <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => toast.success('Copied!')).catch(() => toast.error('Could not copy'));
}

// ── Transaction Row ────────────────────────────────────────────────────────────
function TxnRow({ txn, onClick }) {
  const info = TX_TYPE_LABELS[txn.type] || TX_TYPE_LABELS.fee;
  const amount = Math.abs(txn.net_usd || txn.amount_usd || 0);
  const Icon = info.icon;
  return (
    <motion.div
      whileHover={{ x: 3 }}
      onClick={() => onClick(txn)}
      className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 transition group"
    >
      <div className={`w-10 h-10 rounded-2xl ${info.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={16} className={info.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {txn.description || info.label}
        </p>
        <p className="text-xs text-gray-400 mt-0.5 truncate">
          {txn.counterpart_name ? `${info.credit ? 'from' : 'to'} ${txn.counterpart_name} · ` : ''}
          {txn.created_at ? new Date(txn.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${info.credit ? 'text-green-600' : 'text-gray-900'}`}>
          {info.credit ? '+' : '-'}${amount.toFixed(2)}
        </p>
        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          txn.status === 'completed' ? 'bg-green-50 text-green-600' :
          txn.status === 'pending' ? 'bg-amber-50 text-amber-600' :
          'bg-red-50 text-red-500'
        }`}>{txn.status}</span>
      </div>
    </motion.div>
  );
}

// ── Transaction Detail Modal ───────────────────────────────────────────────────
function TxnDetailModal({ txn, onClose }) {
  if (!txn) return null;
  const info = TX_TYPE_LABELS[txn.type] || TX_TYPE_LABELS.fee;
  const amount = Math.abs(txn.net_usd || txn.amount_usd || 0);
  const Icon = info.icon;

  const printReceipt = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>VipChat Receipt</title>
    <style>body{font-family:sans-serif;padding:40px;max-width:400px;margin:auto}
    .amount{font-size:36px;font-weight:900;margin:16px 0}
    .row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #eee}
    .label{color:#888;font-size:12px}
    .val{font-weight:600;font-size:13px}
    .logo{font-size:22px;font-weight:900;color:#075E54;margin-bottom:8px}</style>
    </head><body>
    <div class="logo">VipChat Wallet</div>
    <div style="color:#888;font-size:12px">${new Date(txn.created_at).toLocaleString()}</div>
    <div class="amount">${info.credit ? '+' : '-'}$${amount.toFixed(2)}</div>
    <div class="row"><span class="label">Status</span><span class="val">${txn.status?.toUpperCase()}</span></div>
    <div class="row"><span class="label">Type</span><span class="val">${txn.type}</span></div>
    <div class="row"><span class="label">Description</span><span class="val">${txn.description || info.label}</span></div>
    ${txn.counterpart_name ? `<div class="row"><span class="label">${info.credit ? 'From' : 'To'}</span><span class="val">${txn.counterpart_name}</span></div>` : ''}
    <div class="row"><span class="label">Fee</span><span class="val">$${(txn.fee_usd || 0).toFixed(2)}</span></div>
    <div class="row"><span class="label">Transaction ID</span><span class="val" style="font-size:11px;font-family:monospace">${txn.id}</span></div>
    </body></html>`);
    w.document.close();
    w.print();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/60 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className={`${info.credit ? 'bg-gradient-to-br from-green-400 to-emerald-500' : 'bg-gradient-to-br from-gray-700 to-gray-900'} p-8 text-center text-white`}>
          <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4">
            <Icon size={28} className="text-white" />
          </div>
          <p className="text-4xl font-black mb-1">{info.credit ? '+' : '-'}${amount.toFixed(2)}</p>
          <span className={`text-xs font-bold px-3 py-1 rounded-full ${
            txn.status === 'completed' ? 'bg-white/20' : 'bg-amber-400/30 text-amber-200'
          }`}>{txn.status?.toUpperCase()}</span>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: 'Description', value: txn.description || info.label },
            { label: 'Type', value: txn.type },
            { label: 'Date', value: new Date(txn.created_at).toLocaleString() },
            txn.counterpart_name && { label: info.credit ? 'From' : 'To', value: txn.counterpart_name },
            { label: 'Fee', value: `$${(txn.fee_usd || 0).toFixed(2)}` },
            { label: 'Transaction ID', value: txn.id, mono: true, copy: true },
          ].filter(Boolean).map(row => (
            <div key={row.label} className="flex items-start justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex-shrink-0">{row.label}</p>
              <div className="flex items-center gap-1.5">
                <p className={`text-xs font-bold text-gray-800 text-right break-all ${row.mono ? 'font-mono' : ''}`}>{row.value}</p>
                {row.copy && (
                  <button onClick={() => copyToClipboard(row.value)} className="flex-shrink-0 text-gray-400 hover:text-gray-600">
                    <FiCopy size={11} />
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition">Close</button>
            <button onClick={printReceipt} className="flex-1 py-3 bg-gray-900 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-1.5 hover:bg-gray-700 transition">
              <FiPrinter size={14} />Receipt
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── PIN Modal ────────────────────────────────────────────────────────────────
function PinModal({ onConfirm, onClose, title = 'Confirm PIN', subtext = 'Enter your 6-digit security PIN to authorize this transaction' }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);

  const handleDigit = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const arr = pin.split('');
    arr[i] = val;
    const next = arr.join('').slice(0, 6);
    setPin(next);
    if (val && i < 5) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !pin[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  const handleConfirm = async () => {
    if (pin.length < 4) return toast.error('Enter your PIN (min 4 digits)');
    setLoading(true);
    try { await onConfirm(pin); }
    finally { setLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4"
    >
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl text-center"
      >
        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <FiLock size={26} className="text-[#25D366]" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-500 mb-6">{subtext}</p>
        <div className="flex justify-center gap-2 mb-6">
          {[0,1,2,3,4,5].map(i => (
            <input
              key={i}
              ref={el => inputs.current[i] = el}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={pin[i] || ''}
              onChange={e => handleDigit(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              autoFocus={i === 0}
              className="w-10 h-12 text-center text-xl font-black border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#25D366] transition"
            />
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition">Cancel</button>
          <button onClick={handleConfirm} disabled={loading || pin.length < 4}
            className="flex-1 py-3 bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white text-sm font-bold rounded-xl transition flex items-center justify-center gap-2">
            {loading ? <Spinner /> : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Top Up Modal ───────────────────────────────────────────────────────────────
function TopUpModal({ onClose, onSuccess }) {
  const [amount, setAmount] = useState(10);
  const [method, setMethod] = useState('stripe');
  const [loading, setLoading] = useState(false);
  const [cryptoData, setCryptoData] = useState(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  const handleTopUp = async () => {
    setLoading(true);
    try {
      if (method === 'stripe') {
        const { data } = await api.post('/wallet/topup/stripe', { amount });
        window.location.href = data.url;
      } else if (method === 'paypal') {
        const { data } = await api.post('/wallet/topup/paypal/create', { amount });
        if (data.approve_url) window.location.href = data.approve_url;
        else toast.error('Failed to create PayPal order');
      } else if (method === 'flutterwave') {
        const { data } = await api.post('/wallet/topup/flutterwave/init', { amount });
        if (window.FlutterwaveCheckout) {
          window.FlutterwaveCheckout({
            public_key: data.public_key,
            tx_ref: data.tx_ref,
            amount: data.amount,
            currency: data.currency,
            payment_options: 'card, mobilemoney, ussd',
            customer: { email: data.customer_email, name: data.customer_name, phone_number: data.customer_phone },
            customizations: { title: 'VipChat Wallet', description: data.description, logo: '/logo192.png' },
            callback: async (response) => {
              if (response.status === 'successful') {
                try {
                  await api.post(`/wallet/topup/flutterwave/verify/${data.tx_ref}`);
                  toast.success('Wallet topped up!');
                  onSuccess?.();
                  onClose();
                } catch { toast.error('Verification failed'); }
              }
            },
            onclose: () => {},
          });
        } else {
          toast.error('Flutterwave not available. Please try card payment.');
        }
      } else if (method === 'crypto') {
        const { data } = await api.post('/wallet/topup/crypto/create', { amount });
        setCryptoData(data);
        setPolling(true);
        pollRef.current = setInterval(async () => {
          try {
            const r = await api.get(`/wallet/topup/crypto/check/${data.txn_id}`);
            if (r.data.status === 'completed') {
              clearInterval(pollRef.current);
              setPolling(false);
              toast.success('Crypto payment confirmed!');
              onSuccess?.();
              onClose();
            }
          } catch {}
        }, 5000);
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to initiate payment');
    } finally { setLoading(false); }
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-[#075E54] to-[#25D366] p-6 text-white flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70 mb-1">Add Money</p>
            <p className="text-2xl font-black">Top Up Wallet</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/20 rounded-xl hover:bg-white/30 transition">
            <FiX size={18} />
          </button>
        </div>

        <div className="p-6">
          {cryptoData ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-orange-100 rounded-2xl flex items-center justify-center mx-auto">
                <SiBitcoin size={32} className="text-orange-500" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Pay with Crypto</p>
                <p className="text-gray-500 text-sm">Send ${amount} in BTC, ETH, USDC or DAI</p>
              </div>
              <a href={cryptoData.hosted_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3.5 rounded-2xl transition">
                Open Coinbase Commerce
              </a>
              {polling && (
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                  Waiting for payment confirmation...
                </div>
              )}
              <div className="flex gap-2 flex-wrap justify-center">
                {['BTC', 'ETH', 'USDC', 'DAI', 'LTC'].map(c => (
                  <span key={c} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full font-semibold">{c}</span>
                ))}
              </div>
            </div>
          ) : (
            <>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Amount (USD)</p>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {TOPUP_AMOUNTS.map(a => (
                  <button key={a} onClick={() => setAmount(a)}
                    className={`py-3 rounded-2xl text-sm font-black border-2 transition ${amount === a ? 'border-[#25D366] bg-green-50 text-[#25D366]' : 'border-gray-100 text-gray-600 hover:border-gray-300 bg-gray-50'}`}>
                    ${a}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 mb-5 border-2 border-gray-100 rounded-2xl px-4 py-3 focus-within:border-[#25D366] transition">
                <span className="text-gray-400 font-bold text-lg">$</span>
                <input type="number" value={amount}
                  onChange={e => setAmount(Math.max(1, Math.min(10000, parseFloat(e.target.value) || 0)))}
                  min="1" max="10000"
                  className="flex-1 text-sm font-semibold focus:outline-none bg-transparent" />
                <span className="text-xs text-gray-400 font-medium">USD</span>
              </div>

              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Payment Method</p>
              <div className="space-y-2 mb-5">
                {PAYMENT_METHODS.map(pm => (
                  <button key={pm.id} onClick={() => setMethod(pm.id)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition ${method === pm.id ? 'border-[#25D366] bg-green-50' : 'border-gray-100 hover:border-gray-200 bg-gray-50'}`}>
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pm.color} flex items-center justify-center flex-shrink-0`}>
                      <pm.icon size={18} className="text-white" />
                    </div>
                    <div className="text-left flex-1">
                      <p className="text-sm font-bold text-gray-900">{pm.label}</p>
                      <p className="text-xs text-gray-500">{pm.sublabel}</p>
                    </div>
                    {method === pm.id && (
                      <div className="w-5 h-5 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0">
                        <FiCheck size={12} className="text-white" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <button onClick={handleTopUp} disabled={loading || amount < 1}
                className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-black py-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
                {loading ? <Spinner /> : <><FiPlus size={16} />Add ${amount} via {PAYMENT_METHODS.find(p => p.id === method)?.label}</>}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Send Modal ────────────────────────────────────────────────────────────────
function SendModal({ balance, onClose, onSuccess, onPinRequired }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = () => {
    const amt = parseFloat(amount);
    if (!phone.trim()) return toast.error('Enter recipient phone number');
    if (!amt || amt < 0.5) return toast.error('Minimum transfer is $0.50');
    if (amt > balance) return toast.error('Insufficient balance');
    onPinRequired(async (pin) => {
      setLoading(true);
      try {
        const { data } = await api.post('/wallet/send', { recipient_phone: phone.trim(), amount: amt, note: note.trim(), pin });
        toast.success(`Sent $${data.sent} to ${data.recipient_name}!`);
        onSuccess?.();
        onClose();
      } catch (e) { toast.error(e.response?.data?.error || 'Send failed'); }
      finally { setLoading(false); }
    });
  };

  const amt = parseFloat(amount || 0);
  const fee = amt * 0.02;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70 mb-1">Instant Transfer</p>
            <p className="text-2xl font-black">Send Money</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/20 rounded-xl hover:bg-white/30 transition">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Recipient Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900"
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:border-[#25D366] focus:bg-white transition" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Amount (USD)</label>
            <div className="border-2 border-gray-100 rounded-2xl flex items-center gap-2 px-4 py-3 bg-gray-50 focus-within:border-[#25D366] focus-within:bg-white transition">
              <span className="text-gray-400 font-bold text-lg">$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0.5" step="0.01"
                className="flex-1 text-sm font-medium focus:outline-none bg-transparent" />
            </div>
            {amt > 0 && (
              <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5 px-1">
                <span>2% platform fee: ${fee.toFixed(2)}</span>
                <span>Recipient gets: ${(amt - fee).toFixed(2)}</span>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1 px-1">Balance: <span className="font-semibold text-gray-600">${balance.toFixed(2)}</span></p>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="For coffee ☕"
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:border-[#25D366] focus:bg-white transition" />
          </div>
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
            <FiShield size={14} className="text-blue-500 flex-shrink-0" />
            <p className="text-xs text-blue-700">PIN verification required to authorize transfer</p>
          </div>
          <button onClick={handleSend} disabled={loading || !phone || !amount}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 text-white font-black py-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
            {loading ? <Spinner /> : <><FiLock size={16} />Authorize & Send ${amt.toFixed(2)}</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Withdraw Modal ────────────────────────────────────────────────────────────
function WithdrawModal({ balance, onClose, onSuccess, onPinRequired }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('paypal');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);

  const METHODS = [
    { id: 'paypal', label: 'PayPal', placeholder: 'PayPal email address', icon: '💳' },
    { id: 'bank', label: 'Bank Transfer', placeholder: 'Account number / IBAN', icon: '🏦' },
    { id: 'crypto', label: 'Crypto Wallet', placeholder: 'BTC / ETH wallet address', icon: '₿' },
  ];

  const handleWithdraw = () => {
    const amt = parseFloat(amount);
    if (amt < 10) return toast.error('Minimum withdrawal is $10');
    if (!destination.trim()) return toast.error('Enter your payout destination');
    if (amt > balance) return toast.error('Insufficient balance');
    onPinRequired(async (pin) => {
      setLoading(true);
      try {
        await api.post('/wallet/withdraw', { amount: amt, method, destination: destination.trim(), pin });
        toast.success('Withdrawal request submitted! Processed within 1-3 business days.');
        onSuccess?.();
        onClose();
      } catch (e) { toast.error(e.response?.data?.error || 'Failed to submit withdrawal'); }
      finally { setLoading(false); }
    });
  };

  const curMethod = METHODS.find(m => m.id === method);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-br from-orange-500 to-rose-600 p-6 text-white flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-white/70 mb-1">Cash Out</p>
            <p className="text-2xl font-black">Withdraw Funds</p>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center bg-white/20 rounded-xl hover:bg-white/30 transition">
            <FiX size={18} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Payout Method</label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(m => (
                <button key={m.id} onClick={() => { setMethod(m.id); setDestination(''); }}
                  className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 transition ${method === m.id ? 'border-orange-400 bg-orange-50' : 'border-gray-100 bg-gray-50 hover:border-gray-200'}`}>
                  <span className="text-xl">{m.icon}</span>
                  <span className={`text-xs font-bold ${method === m.id ? 'text-orange-600' : 'text-gray-600'}`}>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">{curMethod?.label} Details</label>
            <input value={destination} onChange={e => setDestination(e.target.value)}
              placeholder={curMethod?.placeholder}
              className="w-full border-2 border-gray-100 rounded-2xl px-4 py-3 text-sm font-medium bg-gray-50 focus:outline-none focus:border-orange-400 focus:bg-white transition" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Amount (min $10)</label>
            <div className="border-2 border-gray-100 rounded-2xl flex items-center gap-2 px-4 py-3 bg-gray-50 focus-within:border-orange-400 focus-within:bg-white transition">
              <span className="text-gray-400 font-bold text-lg">$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="10.00" min="10" step="1"
                className="flex-1 text-sm font-medium focus:outline-none bg-transparent" />
            </div>
            <p className="text-xs text-gray-400 mt-1 px-1">Available: <span className="font-semibold text-gray-600">${balance.toFixed(2)}</span></p>
          </div>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-2">
            <FiAlertCircle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">Withdrawals are processed within 1-3 business days. PIN verification required.</p>
          </div>
          <button onClick={handleWithdraw} disabled={loading || !amount || !destination}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white font-black py-4 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20">
            {loading ? <Spinner /> : <><FiLock size={16} />Authorize Withdrawal</>}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Real Weekly Chart ─────────────────────────────────────────────────────────
function WeeklyChart({ transactions }) {
  const { days, amounts, maxAmount, totalSpent, lastWeekSpent } = useMemo(() => {
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const amounts = [0, 0, 0, 0, 0, 0, 0];
    const lastAmounts = [0, 0, 0, 0, 0, 0, 0];
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);

    transactions.forEach(t => {
      if (!['send', 'withdraw', 'fee'].includes(t.type)) return;
      const d = new Date(t.created_at);
      const dayIdx = (d.getDay() + 6) % 7;
      if (d >= weekAgo) {
        amounts[dayIdx] += Math.abs(t.amount_usd || 0);
      } else if (d >= twoWeeksAgo) {
        lastAmounts[dayIdx] += Math.abs(t.amount_usd || 0);
      }
    });

    const totalSpent = amounts.reduce((s, a) => s + a, 0);
    const lastWeekSpent = lastAmounts.reduce((s, a) => s + a, 0);
    const maxAmount = Math.max(...amounts, 0.01);

    return { days: DAYS, amounts, maxAmount, totalSpent, lastWeekSpent };
  }, [transactions]);

  const pctChange = lastWeekSpent > 0 ? ((totalSpent - lastWeekSpent) / lastWeekSpent) * 100 : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-sm font-bold text-gray-900">Weekly Spending</h3>
          <p className="text-xs text-gray-400 mt-0.5">${totalSpent.toFixed(2)} this week</p>
        </div>
        {pctChange !== null && (
          <div className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${pctChange <= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {pctChange <= 0 ? <FiTrendingDown size={12} /> : <FiTrendingUp size={12} />}
            {Math.abs(pctChange).toFixed(0)}% vs last week
          </div>
        )}
      </div>
      <div className="flex items-end justify-between h-28 gap-1.5">
        {amounts.map((amt, i) => {
          const today = new Date();
          const isToday = i === (today.getDay() + 6) % 7;
          const heightPct = (amt / maxAmount) * 100;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2" title={`${days[i]}: $${amt.toFixed(2)}`}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(heightPct, amt > 0 ? 8 : 2)}%` }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
                className={`w-full rounded-t-lg ${isToday ? 'bg-[#25D366]' : amt > 0 ? 'bg-[#075E54]/30' : 'bg-gray-100'}`}
              />
              <span className={`text-[10px] font-bold ${isToday ? 'text-[#25D366]' : 'text-gray-400'}`}>{days[i]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Monthly Summary ────────────────────────────────────────────────────────────
function MonthlySummary({ transactions }) {
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const txns = transactions.filter(t => new Date(t.created_at) >= monthStart);
    const income = txns.filter(t => ['topup', 'receive', 'refund'].includes(t.type))
      .reduce((s, t) => s + Math.abs(t.amount_usd || 0), 0);
    const expenses = txns.filter(t => ['send', 'withdraw', 'fee'].includes(t.type))
      .reduce((s, t) => s + Math.abs(t.amount_usd || 0), 0);
    return { income, expenses, net: income - expenses };
  }, [transactions]);

  const month = new Date().toLocaleString('en-US', { month: 'long' });

  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: `${month} Income`, value: `+$${stats.income.toFixed(2)}`, color: 'text-green-600', bg: 'from-green-50 to-emerald-50', border: 'border-green-100', icon: FiArrowDownLeft, iconColor: 'text-green-500' },
        { label: `${month} Spent`, value: `-$${stats.expenses.toFixed(2)}`, color: 'text-red-500', bg: 'from-red-50 to-rose-50', border: 'border-red-100', icon: FiArrowUpRight, iconColor: 'text-red-400' },
        { label: 'Net Flow', value: `${stats.net >= 0 ? '+' : ''}$${stats.net.toFixed(2)}`, color: stats.net >= 0 ? 'text-blue-600' : 'text-orange-500', bg: 'from-blue-50 to-indigo-50', border: 'border-blue-100', icon: stats.net >= 0 ? FiTrendingUp : FiTrendingDown, iconColor: stats.net >= 0 ? 'text-blue-500' : 'text-orange-400' },
      ].map(s => (
        <div key={s.label} className={`bg-gradient-to-br ${s.bg} border ${s.border} rounded-2xl p-3.5`}>
          <s.icon size={16} className={`${s.iconColor} mb-2`} />
          <p className={`text-base font-black ${s.color}`}>{s.value}</p>
          <p className="text-[10px] text-gray-500 font-medium mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main WalletPage ────────────────────────────────────────────────────────────
function WalletPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [txPage, setTxPage] = useState(1);
  const [txPages, setTxPages] = useState(1);
  const [loadingTx, setLoadingTx] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [txFilter, setTxFilter] = useState('all');
  const [txSearch, setTxSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const loadWallet = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await api.get('/wallet/balance');
      setWallet(data.wallet);
      setTransactions(data.recent_transactions || []);
    } catch {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadTransactions = async (pg = 1) => {
    setLoadingTx(true);
    try {
      const { data } = await api.get(`/wallet/transactions?page=${pg}`);
      setTransactions(data.transactions || []);
      setTxPages(data.pages || 1);
      setTxPage(pg);
    } catch {}
    finally { setLoadingTx(false); }
  };

  useEffect(() => {
    loadWallet();
    const topup = searchParams.get('topup');
    if (topup === 'success') toast.success('Payment successful! Balance updated shortly.');
  }, []);

  const requestPin = (action) => {
    setPendingAction(() => action);
    setShowPinModal(true);
  };

  const handlePinConfirm = async (pin) => {
    if (pendingAction) {
      await pendingAction(pin);
    }
    setShowPinModal(false);
    setPendingAction(null);
  };

  const filteredTxns = useMemo(() => {
    let txns = [...transactions];
    if (txFilter !== 'all') {
      const filterMap = {
        received: ['receive', 'refund'],
        sent: ['send'],
        topup: ['topup'],
        withdraw: ['withdraw'],
        fee: ['fee'],
      };
      txns = txns.filter(t => (filterMap[txFilter] || []).includes(t.type));
    }
    if (txSearch.trim()) {
      const q = txSearch.toLowerCase();
      txns = txns.filter(t =>
        t.description?.toLowerCase().includes(q) ||
        t.counterpart_name?.toLowerCase().includes(q) ||
        t.type?.toLowerCase().includes(q)
      );
    }
    return txns;
  }, [transactions, txFilter, txSearch]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin" style={{ borderWidth: 3 }} />
        <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Loading Wallet</p>
      </div>
    );
  }

  const bal = wallet?.balance_usd || 0;

  const FILTER_TABS = [
    { id: 'all', label: 'All' },
    { id: 'received', label: 'Received' },
    { id: 'sent', label: 'Sent' },
    { id: 'topup', label: 'Top-up' },
    { id: 'withdraw', label: 'Withdrawn' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header + Balance Card ── */}
      <div className={`${frozen ? 'bg-gradient-to-br from-gray-700 to-gray-900' : 'bg-gradient-to-br from-[#075E54] via-[#0a8a7a] to-[#25D366]'} pt-safe-top pb-10 px-4 transition-colors duration-500`}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6 pt-4">
            <button onClick={() => navigate('/')} className="p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl transition">
              <FiArrowLeft size={18} className="text-white" />
            </button>
            <h1 className="text-lg font-black text-white tracking-wide">VipChat Wallet</h1>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setFrozen(!frozen)}
                className={`p-2.5 ${frozen ? 'bg-red-500 hover:bg-red-600' : 'bg-white/20 hover:bg-white/30'} rounded-2xl transition-colors`}
                title={frozen ? 'Unfreeze Wallet' : 'Freeze Wallet'}>
                <FiLock size={16} className="text-white" />
              </button>
              <button onClick={() => loadWallet(true)}
                className={`p-2.5 bg-white/20 hover:bg-white/30 rounded-2xl transition ${refreshing ? 'animate-spin' : ''}`}>
                <FiRefreshCw size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/* Balance Card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-md rounded-3xl p-6 text-white relative overflow-hidden border border-white/10 shadow-2xl">
            {/* Decorative circles */}
            <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/5 rounded-full" />
            <div className="absolute -bottom-4 -left-4 w-20 h-20 bg-white/5 rounded-full" />

            {frozen && (
              <div className="absolute inset-0 bg-black/50 backdrop-blur-md flex flex-col items-center justify-center z-20 rounded-3xl">
                <FiLock size={40} className="text-white mb-3" />
                <p className="font-black text-white text-lg">Wallet Frozen</p>
                <button onClick={() => setFrozen(false)} className="mt-3 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-4 py-2 rounded-full transition">
                  Tap to Unfreeze
                </button>
              </div>
            )}

            <div className="relative z-10">
              <div className="flex items-center justify-between mb-1">
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">Available Balance</p>
                <button onClick={() => setBalanceVisible(!balanceVisible)} className="text-white/60 hover:text-white transition">
                  {balanceVisible ? <FiEye size={16} /> : <FiEyeOff size={16} />}
                </button>
              </div>
              <p className="text-5xl font-black mb-1 tracking-tight">
                {balanceVisible ? `$${bal.toFixed(2)}` : '••••••'}
              </p>
              <div className="flex items-center gap-1.5 mb-6">
                <FiShield size={11} className="text-green-300" />
                <p className="text-white/50 text-[10px] font-bold tracking-wider uppercase">256-bit Encrypted · FDIC Protected</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Add Money', icon: FiPlus, action: () => setModal('topup'), gradient: 'from-green-400/30 to-emerald-400/30' },
                  { label: 'Send', icon: FiSend, action: () => setModal('send'), gradient: 'from-blue-400/30 to-indigo-400/30' },
                  { label: 'Withdraw', icon: FiArrowUpRight, action: () => setModal('withdraw'), gradient: 'from-orange-400/30 to-rose-400/30' },
                ].map(btn => (
                  <button key={btn.label} onClick={btn.action} disabled={frozen}
                    className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl bg-gradient-to-br ${btn.gradient} border border-white/10 hover:border-white/20 transition ${frozen ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    <btn.icon size={20} className="text-white" />
                    <span className="text-xs font-bold text-white">{btn.label}</span>
                  </button>
                ))}
              </div>

              {wallet?.wallet_id && (
                <button onClick={() => copyToClipboard(wallet.wallet_id)}
                  className="mt-4 flex items-center gap-2 text-white/40 hover:text-white/70 transition w-full">
                  <span className="text-[10px] font-mono tracking-widest truncate">ID: {wallet.wallet_id}</span>
                  <FiCopy size={10} className="flex-shrink-0" />
                </button>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 pb-10 space-y-4">
        {/* Monthly Summary */}
        <MonthlySummary transactions={transactions} />

        {/* Weekly Spending Chart */}
        <WeeklyChart transactions={transactions} />

        {/* Security Badges */}
        <div className="flex gap-2 flex-wrap">
          {[
            { icon: FiShield, label: 'Bank-grade SSL' },
            { icon: FiZap, label: 'Instant transfers' },
            { icon: FiGlobe, label: 'Global payments' },
            { icon: FiCheck, label: '2FA Protected' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100">
              <b.icon size={11} className="text-[#25D366]" />
              <span className="text-xs font-semibold text-gray-600">{b.label}</span>
            </div>
          ))}
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-900">Transaction History</h3>
              <button onClick={() => loadTransactions(1)} disabled={loadingTx}
                className="text-xs font-bold text-[#25D366] flex items-center gap-1 hover:underline">
                {loadingTx ? <Spinner /> : <><FiRefreshCw size={11} />Load All</>}
              </button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <FiSearch size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={txSearch}
                onChange={e => setTxSearch(e.target.value)}
                placeholder="Search transactions…"
                className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[#25D366]/30 focus:border-[#25D366] transition"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar">
              {FILTER_TABS.map(f => (
                <button key={f.id} onClick={() => setTxFilter(f.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition ${txFilter === f.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredTxns.length === 0 ? (
            <div className="py-16 text-center">
              <FiClock size={36} className="mx-auto mb-3 text-gray-200" />
              <p className="text-sm font-bold text-gray-400">
                {txSearch || txFilter !== 'all' ? 'No matching transactions' : 'No transactions yet'}
              </p>
              {!txSearch && txFilter === 'all' && (
                <button onClick={() => setModal('topup')}
                  className="mt-3 text-xs font-bold text-[#25D366] hover:underline">
                  Add money to get started →
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filteredTxns.map(txn => (
                <TxnRow key={txn.id} txn={txn} onClick={setSelectedTxn} />
              ))}
            </div>
          )}

          {txPages > 1 && (
            <div className="flex items-center justify-center gap-3 px-5 py-4 border-t border-gray-50">
              <button onClick={() => loadTransactions(txPage - 1)} disabled={txPage <= 1 || loadingTx}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition">← Prev</button>
              <span className="text-xs font-bold text-gray-500">{txPage} / {txPages}</span>
              <button onClick={() => loadTransactions(txPage + 1)} disabled={txPage >= txPages || loadingTx}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 disabled:opacity-40 transition">Next →</button>
            </div>
          )}
        </div>

        {/* Accepted Payment Methods */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Accepted Payment Methods</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Visa / MC', bg: 'bg-blue-100', color: 'text-blue-600', icon: <FiCreditCard size={15} /> },
              { label: 'PayPal', bg: 'bg-sky-100', color: 'text-sky-600', icon: <FiZap size={15} /> },
              { label: 'Flutterwave', bg: 'bg-orange-100', color: 'text-orange-600', icon: <FiGlobe size={15} /> },
              { label: 'Bitcoin', bg: 'bg-amber-100', color: 'text-amber-600', icon: <SiBitcoin size={15} /> },
              { label: 'Ethereum', bg: 'bg-purple-100', color: 'text-purple-600', icon: <SiEthereum size={15} /> },
              { label: 'USDC', bg: 'bg-green-100', color: 'text-green-600', icon: <FiDollarSign size={15} /> },
              { label: 'Mobile Money', bg: 'bg-teal-100', color: 'text-teal-600', icon: <FiZap size={15} /> },
              { label: 'Bank Wire', bg: 'bg-indigo-100', color: 'text-indigo-600', icon: <FiShield size={15} /> },
            ].map(c => (
              <div key={c.label} className="flex flex-col items-center gap-1.5 p-2.5 bg-gray-50 rounded-xl">
                <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.color} flex items-center justify-center`}>{c.icon}</div>
                <span className="text-[9px] text-gray-500 font-bold text-center leading-tight">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Send promo */}
        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <FiSend size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-black">Send to Anyone on VipChat</p>
              <p className="text-xs text-white/70">Instant transfers by phone number · Only 2% fee</p>
            </div>
          </div>
          <button onClick={() => setModal('send')} disabled={frozen}
            className="w-full bg-white/20 hover:bg-white/30 text-white text-sm font-bold py-2.5 rounded-xl transition mt-1">
            Send Money Now →
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {modal === 'topup' && <TopUpModal onClose={() => setModal(null)} onSuccess={loadWallet} />}
        {modal === 'send' && (
          <SendModal
            balance={bal}
            onClose={() => setModal(null)}
            onSuccess={loadWallet}
            onPinRequired={requestPin}
          />
        )}
        {modal === 'withdraw' && (
          <WithdrawModal
            balance={bal}
            onClose={() => setModal(null)}
            onSuccess={loadWallet}
            onPinRequired={requestPin}
          />
        )}
        {selectedTxn && <TxnDetailModal txn={selectedTxn} onClose={() => setSelectedTxn(null)} />}
        {showPinModal && (
          <PinModal
            onConfirm={handlePinConfirm}
            onClose={() => { setShowPinModal(false); setPendingAction(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default WalletPage;
