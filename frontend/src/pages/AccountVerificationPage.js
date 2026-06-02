import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { FiShield, FiArrowRight, FiLogOut, FiCheck } from 'react-icons/fi';

function AccountVerificationPage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuthStore();
  const [step, setStep] = useState('intro'); // intro | otp
  const [codeDigits, setCodeDigits] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const codeRefs = Array.from({ length: 6 }, () => React.createRef());

  useEffect(() => {
    let t;
    if (countdown > 0) t = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  const handleSendOTP = async () => {
    setSending(true);
    try {
      await api.post('/auth/send-reconfirmation-sms');
      toast.success('Verification code sent to your phone!');
      setStep('otp');
      setCountdown(60);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send code');
    } finally {
      setSending(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (!/^[0-9]?$/.test(value)) return;
    const newDigits = [...codeDigits];
    newDigits[index] = value;
    setCodeDigits(newDigits);
    if (value && index < 5) codeRefs[index + 1].current?.focus();
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeRefs[index - 1].current?.focus();
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    const code = codeDigits.join('');
    if (code.length !== 6) { toast.error('Enter the full 6-digit code'); return; }
    setLoading(true);
    try {
      const response = await api.post('/auth/confirm-account', { code });
      setUser({ ...user, account_confirmed_at: response.data.account_confirmed_at });
      toast.success('Account confirmed! Welcome back 🎉');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
  };

  const daysActive = user?.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 2;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex items-center justify-center px-4">
      {/* Background circles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div key={i} animate={{ y: [0, i % 2 === 0 ? 20 : -20, 0] }}
            transition={{ duration: 4 + i, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute rounded-full bg-white/10"
            style={{ width: `${60 + i * 30}px`, height: `${60 + i * 30}px`,
              top: `${10 + i * 11}%`, left: `${5 + i * 12}%` }} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md">
        {/* Shield icon */}
        <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
          className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-200">
          <FiShield size={36} className="text-white" />
        </motion.div>

        {step === 'intro' ? (
          <>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Account Confirmation</h1>
            <p className="text-gray-500 text-center text-sm mb-6">
              You've been using Bitese for <strong>{daysActive} days</strong>. To keep your account secure,
              please verify your phone number.
            </p>

            {/* Info card */}
            <div className="bg-[#f0f9f4] border border-[#25D366]/30 rounded-2xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#25D366]/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FiShield size={16} className="text-[#25D366]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800 mb-1">Why we ask this</p>
                  <p className="text-xs text-gray-600">
                    This one-time confirmation keeps your account safe and ensures only you can access your messages.
                  </p>
                </div>
              </div>
            </div>

            {/* Phone preview */}
            <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-6">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {user?.full_name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">{user?.full_name}</p>
                <p className="text-xs text-gray-500">{user?.phone_number}</p>
              </div>
            </div>

            <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
              onClick={handleSendOTP} disabled={sending}
              className="w-full bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 text-base shadow-lg shadow-green-200 mb-3">
              {sending ? (
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <><FiShield size={18} /><span>Send Verification Code</span><FiArrowRight size={18} /></>
              )}
            </motion.button>

            <button onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 py-3 text-gray-400 hover:text-gray-600 text-sm transition">
              <FiLogOut size={14} /> Sign out instead
            </button>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Enter OTP Code</h1>
            <p className="text-gray-500 text-center text-sm mb-6">
              Code sent to <strong>{user?.phone_number}</strong>
            </p>

            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex gap-2 justify-between">
                {codeDigits.map((d, i) => (
                  <input key={i} ref={codeRefs[i]} type="text" inputMode="numeric" maxLength={1} value={d}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleDigitKeyDown(i, e)}
                    className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-green-50 transition"
                    style={{ borderColor: d ? '#25D366' : '#e5e7eb' }} />
                ))}
              </div>

              <div className="text-center">
                {countdown > 0 ? (
                  <p className="text-sm text-gray-500">Resend in <span className="text-[#25D366] font-semibold">{countdown}s</span></p>
                ) : (
                  <button type="button" onClick={handleSendOTP} disabled={sending}
                    className="text-sm text-[#25D366] font-semibold hover:underline disabled:opacity-50">
                    {sending ? 'Sending...' : 'Resend Code'}
                  </button>
                )}
              </div>

              <motion.button whileTap={{ scale: 0.99 }} type="submit"
                disabled={loading || codeDigits.join('').length !== 6}
                className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 text-base shadow-lg shadow-green-100">
                {loading ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <><FiCheck size={18} strokeWidth={3} /><span>Confirm Account</span></>
                )}
              </motion.button>
            </form>

            <button onClick={() => setStep('intro')}
              className="w-full flex items-center justify-center gap-2 mt-4 py-3 text-gray-400 hover:text-gray-600 text-sm transition">
              ← Back
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default AccountVerificationPage;
