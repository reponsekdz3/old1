import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiDollarSign, FiArrowUpRight, FiArrowDownLeft, FiSend,
  FiCreditCard, FiRefreshCw, FiCheck, FiArrowLeft,
  FiZap, FiShield, FiPlus, FiMinus, FiClock, FiGlobe,
  FiX, FiAlertCircle, FiLock,
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

function TxnRow({ txn }) {
  const typeInfo = {
    topup: { label: 'Top-up', icon: <FiArrowDownLeft size={14} />, color: 'text-green-500', bg: 'bg-green-50' },
    send: { label: 'Sent', icon: <FiArrowUpRight size={14} />, color: 'text-red-500', bg: 'bg-red-50' },
    receive: { label: 'Received', icon: <FiArrowDownLeft size={14} />, color: 'text-green-500', bg: 'bg-green-50' },
    withdraw: { label: 'Withdraw', icon: <FiArrowUpRight size={14} />, color: 'text-orange-500', bg: 'bg-orange-50' },
    refund: { label: 'Refund', icon: <FiArrowDownLeft size={14} />, color: 'text-blue-500', bg: 'bg-blue-50' },
    fee: { label: 'Fee', icon: <FiMinus size={14} />, color: 'text-gray-500', bg: 'bg-gray-50' },
  };
  const info = typeInfo[txn.type] || typeInfo.fee;
  const isCredit = ['topup', 'receive', 'refund'].includes(txn.type);
  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className={`w-9 h-9 rounded-xl ${info.bg} flex items-center justify-center flex-shrink-0`}>
        <span className={info.color}>{info.icon}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">
          {txn.description || info.label}
        </p>
        <p className="text-xs text-gray-400 truncate">
          {txn.counterpart_name ? `${isCredit ? 'from' : 'to'} ${txn.counterpart_name} · ` : ''}
          {txn.status === 'pending' ? '⏳ Pending' : txn.status === 'failed' ? '❌ Failed' : ''}
          {txn.created_at ? new Date(txn.created_at).toLocaleDateString() : ''}
        </p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-bold ${isCredit ? 'text-green-600' : 'text-gray-900'}`}>
          {isCredit ? '+' : '-'}${Math.abs(txn.net_usd || txn.amount_usd || 0).toFixed(2)}
        </p>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          txn.status === 'completed' ? 'bg-green-100 text-green-700' :
          txn.status === 'pending' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-600'
        }`}>{txn.status}</span>
      </div>
    </div>
  );
}

// ── Modals ─────────────────────────────────────────────────────────────────────
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
                } catch (e) { toast.error('Verification failed'); }
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
        // Start polling
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => () => clearInterval(pollRef.current), []);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Add Money</h3>
          <button onClick={onClose}><FiX size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

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
            {/* Amount selection */}
            <p className="text-sm font-semibold text-gray-700 mb-2">Amount (USD)</p>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {TOPUP_AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(a)}
                  className={`py-2.5 rounded-xl text-sm font-bold border-2 transition ${amount === a ? 'border-[#25D366] bg-green-50 text-[#25D366]' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                  ${a}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 mb-5">
              <span className="text-gray-400 font-bold">$</span>
              <input type="number" value={amount} onChange={e => setAmount(Math.max(1, Math.min(10000, parseFloat(e.target.value) || 0)))}
                min="1" max="10000" step="1"
                className="flex-1 border-2 border-gray-200 rounded-xl px-3 py-2 text-sm font-semibold focus:outline-none focus:border-[#25D366]" />
            </div>

            {/* Method selection */}
            <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
            <div className="space-y-2 mb-5">
              {PAYMENT_METHODS.map(pm => (
                <button key={pm.id} onClick={() => setMethod(pm.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition ${method === pm.id ? 'border-[#25D366] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${pm.color} flex items-center justify-center flex-shrink-0`}>
                    {pm.icon && <pm.icon size={20} className="text-white" />}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm font-bold text-gray-900">{pm.label}</p>
                    <p className="text-xs text-gray-500">{pm.sublabel}</p>
                  </div>
                  {method === pm.id && <FiCheck size={16} className="text-[#25D366]" />}
                </button>
              ))}
            </div>

            <button onClick={handleTopUp} disabled={loading || amount < 1}
              className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2">
              {loading
                ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <><FiPlus size={16} />Add ${amount} via {PAYMENT_METHODS.find(p => p.id === method)?.label}</>}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

function SendModal({ balance, onClose, onSuccess }) {
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const amt = parseFloat(amount);
    if (!phone.trim()) return toast.error('Enter recipient phone number');
    if (!amt || amt < 0.5) return toast.error('Minimum is $0.50');
    if (amt > balance) return toast.error('Insufficient balance');
    setLoading(true);
    try {
      const { data } = await api.post('/wallet/send', { recipient_phone: phone.trim(), amount: amt, note: note.trim() });
      toast.success(`Sent $${data.sent} to ${data.recipient_name}!`);
      onSuccess?.();
      onClose();
    } catch (e) { toast.error(e.response?.data?.error || 'Send failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Send Money</h3>
          <button onClick={onClose}><FiX size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Recipient Phone</label>
            <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567 8900"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Amount (USD)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold text-lg">$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="0.00" min="0.5" step="0.01"
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366]" />
            </div>
            <p className="text-xs text-gray-400 mt-1">2% platform fee applies. Balance: ${balance.toFixed(2)}</p>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="For coffee ☕"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366]" />
          </div>
          <button onClick={handleSend} disabled={loading || !phone || !amount}
            className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><FiSend size={15} />Send ${parseFloat(amount || 0).toFixed(2)}</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function WithdrawModal({ balance, onClose, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('paypal');
  const [destination, setDestination] = useState('');
  const [loading, setLoading] = useState(false);

  const handleWithdraw = async () => {
    const amt = parseFloat(amount);
    if (amt < 10) return toast.error('Minimum withdrawal is $10');
    if (!destination.trim()) return toast.error('Enter your payout destination');
    if (amt > balance) return toast.error('Insufficient balance');
    setLoading(true);
    try {
      await api.post('/wallet/withdraw', { amount: amt, method, destination: destination.trim() });
      toast.success('Withdrawal request submitted! Processed within 1-3 business days.');
      onSuccess?.();
      onClose();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setLoading(false); }
  };

  const METHODS = [
    { id: 'paypal', label: 'PayPal', placeholder: 'PayPal email address' },
    { id: 'bank', label: 'Bank Transfer', placeholder: 'Account number / IBAN' },
    { id: 'crypto', label: 'Crypto Wallet', placeholder: 'BTC / ETH wallet address' },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold text-gray-900">Withdraw Funds</h3>
          <button onClick={onClose}><FiX size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            {METHODS.map(m => (
              <button key={m.id} onClick={() => { setMethod(m.id); setDestination(''); }}
                className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition ${method === m.id ? 'border-[#25D366] bg-green-50 text-[#25D366]' : 'border-gray-200 text-gray-600'}`}>
                {m.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">
              {METHODS.find(m => m.id === method)?.label} Details
            </label>
            <input value={destination} onChange={e => setDestination(e.target.value)}
              placeholder={METHODS.find(m => m.id === method)?.placeholder}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366]" />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5 block">Amount (min $10)</label>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 font-bold text-lg">$</span>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                placeholder="10.00" min="10" step="1"
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366]" />
            </div>
            <p className="text-xs text-gray-400 mt-1">Available: ${balance.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
            <FiAlertCircle size={12} className="inline mr-1" />
            Withdrawals are processed within 1-3 business days. Minimum $10.
          </div>
          <button onClick={handleWithdraw} disabled={loading || !amount || !destination}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              : <><FiArrowUpRight size={15} />Request ${parseFloat(amount || 0).toFixed(2)} Withdrawal</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Main WalletPage ────────────────────────────────────────────────────────────
function PinModal({ onConfirm, onClose, title = "Confirm PIN", subtext = "Enter your 6-digit PIN to authorize this transaction" }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (pin.length < 4) return toast.error('Enter your PIN');
    setLoading(true);
    try {
      await onConfirm(pin);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-xs p-6 shadow-2xl text-center">
        <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <FiLock className="text-[#25D366]" size={24} />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-500 mb-6">{subtext}</p>
        
        <input 
          type="password" 
          value={pin} 
          onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="••••••"
          className="w-full text-center text-2xl tracking-[1em] font-bold border-2 border-gray-100 rounded-2xl py-3 focus:outline-none focus:border-[#25D366] mb-6"
          autoFocus
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-xl transition">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={loading || pin.length < 4}
            className="flex-1 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white text-sm font-bold rounded-xl transition shadow-lg shadow-green-100 flex items-center justify-center gap-2">
            {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function TransactionDetailDrawer({ txn, onClose }) {
  if (!txn) return null;
  const isCredit = ['topup', 'receive', 'refund'].includes(txn.type);
  
  return (
    <div className="fixed inset-0 z-50 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-black/20 pointer-events-auto" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }} 
        animate={{ x: 0 }} 
        exit={{ x: '100%' }}
        className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl pointer-events-auto p-6 flex flex-col"
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-xl font-bold text-gray-900">Transaction Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <FiX size={20} className="text-gray-400" />
          </button>
        </div>

        <div className="text-center mb-8">
          <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 ${isCredit ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
            {isCredit ? <FiArrowDownLeft size={32} /> : <FiArrowUpRight size={32} />}
          </div>
          <p className="text-3xl font-black text-gray-900">
            {isCredit ? '+' : '-'}${Math.abs(txn.net_usd || txn.amount_usd || 0).toFixed(2)}
          </p>
          <p className={`text-sm font-bold mt-1 ${txn.status === 'completed' ? 'text-green-600' : 'text-amber-600'}`}>
            {txn.status.toUpperCase()}
          </p>
        </div>

        <div className="space-y-4 flex-1">
          {[
            { label: 'Description', value: txn.description },
            { label: 'Transaction ID', value: txn.id, mono: true },
            { label: 'Date & Time', value: new Date(txn.created_at).toLocaleString() },
            { label: 'Type', value: txn.type },
            { label: 'Counterpart', value: txn.counterpart_name || 'N/A' },
            { label: 'Fee', value: `$${(txn.fee_usd || 0).toFixed(2)}` },
          ].map(row => (
            <div key={row.label} className="border-b border-gray-50 pb-3">
              <p className="text-xs font-semibold text-gray-400 uppercase">{row.label}</p>
              <p className={`text-sm font-bold text-gray-800 mt-0.5 ${row.mono ? 'font-mono' : ''}`}>{row.value}</p>
            </div>
          ))}
        </div>

        <button className="w-full bg-gray-900 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 mt-auto">
          <FiArrowDownLeft /> Download Receipt
        </button>
      </motion.div>
    </div>
  );
}

function WalletPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  useAuthStore();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // 'topup' | 'send' | 'withdraw'
  const [txPage, setTxPage] = useState(1);
  const [txPages, setTxPages] = useState(1);
  const [loadingTx, setLoadingTx] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [selectedTxn, setSelectedTxn] = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const [frozen, setFrozen] = useState(false);

  const loadWallet = async () => {
    try {
      const { data } = await api.get('/wallet/balance');
      setWallet(data.wallet);
      setTransactions(data.recent_transactions || []);
    } catch (e) {
      toast.error('Failed to load wallet');
    } finally {
      setLoading(false);
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
    // Handle return from payment provider
    const topup = searchParams.get('topup');
    if (topup === 'success') {
      toast.success('Payment successful! Balance updated shortly.');
    }
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className={`bg-gradient-to-br ${frozen ? 'from-gray-700 to-gray-900' : 'from-[#075E54] to-[#25D366]'} pt-safe-top pb-8 px-4 transition-colors duration-500`}>
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-3 mb-6 pt-4">
            <button onClick={() => navigate('/')} className="p-2 bg-white/20 rounded-full">
              <FiArrowLeft size={18} className="text-white" />
            </button>
            <h1 className="text-xl font-bold text-white">VipChat Wallet</h1>
            <div className="ml-auto flex gap-2">
              <button onClick={() => setFrozen(!frozen)} className={`p-2 ${frozen ? 'bg-red-500' : 'bg-white/20'} rounded-full transition-colors`}>
                <FiLock size={16} className="text-white" title={frozen ? "Unfreeze Wallet" : "Freeze Wallet"} />
              </button>
              <button onClick={loadWallet} className="p-2 bg-white/20 rounded-full">
                <FiRefreshCw size={16} className="text-white" />
              </button>
            </div>
          </div>

          {/* Balance card */}
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="bg-white/10 backdrop-blur-sm rounded-3xl p-6 text-white text-center relative overflow-hidden">
            {frozen && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md flex flex-col items-center justify-center z-10">
                <FiLock size={40} className="text-white mb-2" />
                <p className="font-bold">Wallet Frozen</p>
                <button onClick={() => setFrozen(false)} className="mt-2 text-xs bg-white/20 px-3 py-1 rounded-full">Tap to unfreeze</button>
              </div>
            )}
            <p className="text-white/70 text-sm font-medium mb-1">Available Balance</p>
            <p className="text-5xl font-black mb-1">
              ${(wallet?.balance_usd || 0).toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <FiShield size={12} className="text-green-300" />
              <p className="text-white/60 text-[10px] font-bold tracking-wider uppercase">Protected by 256-bit encryption</p>
            </div>

            <div className="flex gap-3 mt-6">
              {[
                { label: 'Add Money', icon: FiPlus, action: () => setModal('topup'), color: 'bg-white/20 hover:bg-white/30' },
                { label: 'Send', icon: FiSend, action: () => setModal('send'), color: 'bg-white/20 hover:bg-white/30' },
                { label: 'Withdraw', icon: FiArrowUpRight, action: () => setModal('withdraw'), color: 'bg-white/20 hover:bg-white/30' },
              ].map(btn => (
                <button key={btn.label} onClick={btn.action} disabled={frozen}
                  className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-2xl ${btn.color} transition ${frozen ? 'opacity-50 grayscale' : ''}`}>
                  <btn.icon size={20} className="text-white" />
                  <span className="text-xs font-semibold text-white">{btn.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Spending Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Weekly Spending</h3>
            <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full">-12% vs last week</span>
          </div>
          <div className="flex items-end justify-between h-32 gap-2 px-2">
            {[40, 65, 30, 85, 45, 70, 55].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <motion.div 
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  className={`w-full rounded-t-lg bg-gradient-to-t ${i === 3 ? 'from-[#075E54] to-[#25D366]' : 'from-gray-100 to-gray-200'}`}
                />
                <span className="text-[10px] text-gray-400 font-bold">{['M','T','W','T','F','S','S'][i]}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Security badges */}
        <div className="flex gap-3 flex-wrap">
          {[
            { icon: FiShield, label: 'Bank-grade security' },
            { icon: FiZap, label: 'Instant transfers' },
            { icon: FiGlobe, label: 'Global payments' },
          ].map(b => (
            <div key={b.label} className="flex items-center gap-1.5 bg-white rounded-xl px-3 py-2 shadow-sm border border-gray-100">
              <b.icon size={12} className="text-[#25D366]" />
              <span className="text-xs font-semibold text-gray-700">{b.label}</span>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-50 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">Recent Transactions</h3>
            <button onClick={() => loadTransactions(1)} className="text-[#25D366] text-xs font-bold">View All</button>
          </div>
          <div className="divide-y divide-gray-50">
            {transactions.slice(0, 5).map(txn => (
              <div key={txn.id} onClick={() => setSelectedTxn(txn)} className="cursor-pointer hover:bg-gray-50 transition p-1">
                <TxnRow txn={txn} />
              </div>
            ))}
            {transactions.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">No transactions yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Supported currencies */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Accepted Payments</p>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Card', bg: 'bg-blue-100', color: 'text-blue-600', icon: <FiCreditCard size={16} /> },
              { label: 'PayPal', bg: 'bg-sky-100', color: 'text-sky-600', icon: <FiZap size={16} /> },
              { label: 'Flutterwave', bg: 'bg-orange-100', color: 'text-orange-600', icon: <FiGlobe size={16} /> },
              { label: 'Bitcoin', bg: 'bg-amber-100', color: 'text-amber-600', icon: <SiBitcoin size={16} /> },
              { label: 'Ethereum', bg: 'bg-purple-100', color: 'text-purple-600', icon: <SiEthereum size={16} /> },
              { label: 'USDC', bg: 'bg-green-100', color: 'text-green-600', icon: <FiDollarSign size={16} /> },
              { label: 'DAI', bg: 'bg-yellow-100', color: 'text-yellow-600', icon: <FiShield size={16} /> },
              { label: 'Mobile', bg: 'bg-teal-100', color: 'text-teal-600', icon: <FiZap size={16} /> },
            ].map(c => (
              <div key={c.label} className="flex flex-col items-center gap-1 p-2 bg-gray-50 rounded-xl">
                <div className={`w-8 h-8 rounded-lg ${c.bg} ${c.color} flex items-center justify-center`}>{c.icon}</div>
                <span className="text-[10px] text-gray-500 font-semibold text-center">{c.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Transactions */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Transactions</h3>
            <button onClick={() => loadTransactions(1)} className="text-xs text-[#25D366] font-semibold hover:underline">
              {loadingTx ? <div className="w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /> : 'Refresh'}
            </button>
          </div>
          {transactions.length === 0 ? (
            <div className="py-16 text-center text-gray-400">
              <FiClock size={36} className="mx-auto mb-2 opacity-30" />
              <p>No transactions yet</p>
              <p className="text-xs mt-1">Add money to get started</p>
            </div>
          ) : (
            <div className="px-5">
              {transactions.map(txn => <TxnRow key={txn.id} txn={txn} />)}
            </div>
          )}
          {txPages > 1 && (
            <div className="flex items-center justify-center gap-2 px-5 py-3 border-t border-gray-100">
              <button onClick={() => loadTransactions(txPage - 1)} disabled={txPage <= 1}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 disabled:opacity-40">Prev</button>
              <span className="text-xs text-gray-500">Page {txPage} of {txPages}</span>
              <button onClick={() => loadTransactions(txPage + 1)} disabled={txPage >= txPages}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 disabled:opacity-40">Next</button>
            </div>
          )}
        </div>

        {/* Send money quick note */}
        <div className="bg-gradient-to-r from-[#25D366]/10 to-teal-50 rounded-2xl p-4 border border-[#25D366]/20">
          <p className="text-sm font-bold text-[#075E54] flex items-center gap-1.5"><FiSend size={14} /> Send to anyone on VipChat</p>
          <p className="text-xs text-gray-600 mt-1">Send money instantly using their phone number. Only 2% platform fee.</p>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'topup' && <TopUpModal onClose={() => setModal(null)} onSuccess={loadWallet} />}
        {modal === 'send' && <SendModal balance={wallet?.balance_usd || 0} onClose={() => setModal(null)} onSuccess={loadWallet} />}
        {modal === 'withdraw' && <WithdrawModal balance={wallet?.balance_usd || 0} onClose={() => setModal(null)} onSuccess={loadWallet} />}
        {selectedTxn && <TransactionDetailDrawer txn={selectedTxn} onClose={() => setSelectedTxn(null)} />}
        {showPinModal && <PinModal onConfirm={pendingAction} onClose={() => { setShowPinModal(false); setPendingAction(null); }} />}
      </AnimatePresence>
    </div>
  );
}

export default WalletPage;
