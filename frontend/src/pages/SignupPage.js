import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiLock, FiUser, FiArrowRight, FiEye, FiEyeOff, FiCheck, FiShield } from 'react-icons/fi';

const FEATURES = [
  { icon: '💬', title: 'Real-time Chat', desc: 'Instant messages, delivered in milliseconds' },
  { icon: '🎤', title: 'Voice & Video Calls', desc: 'Crystal-clear calls worldwide, free' },
  { icon: '📸', title: 'Rich Media', desc: 'Photos, videos, documents & voice notes' },
  { icon: '🔒', title: 'End-to-End Encrypted', desc: 'Only you and your contacts can read messages' },
];

export default function SignupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({ phone_number: '', full_name: '', password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleStep1 = (e) => {
    e.preventDefault();
    if (!formData.phone_number.trim() || !formData.full_name.trim()) {
      toast.error('Please fill in all fields');
      return;
    }
    setStep(2);
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    if (formData.password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    if (formData.password !== formData.confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', {
        phone_number: formData.phone_number,
        full_name: formData.full_name,
        password: formData.password,
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
      toast.success(`Welcome to Bitese, ${data.user.full_name}! 🎉`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  const pwStrength = () => {
    const p = formData.password;
    if (!p) return null;
    if (p.length < 6) return { label: 'Too short', color: 'bg-red-400', width: '25%' };
    if (p.length < 8) return { label: 'Weak', color: 'bg-orange-400', width: '50%' };
    if (p.length < 12 && /[A-Z]/.test(p) && /[0-9]/.test(p)) return { label: 'Good', color: 'bg-yellow-400', width: '75%' };
    if (p.length >= 12 && /[A-Z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p)) return { label: 'Strong 🔐', color: 'bg-[#25D366]', width: '100%' };
    return { label: 'Fair', color: 'bg-blue-400', width: '60%' };
  };

  const strength = pwStrength();

  return (
    <div className="flex min-h-screen overflow-hidden font-sans">
      {/* ── LEFT panel ── */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-[#075E54] via-[#0d7a6b] to-[#128C7E] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ width: `${50+i*25}px`, height: `${50+i*25}px`, top: `${(i*8)%90}%`, left: `${(i*11)%90}%`, opacity: 0.4 }}/>
          ))}
        </div>
        <div className="relative z-10 px-10 pt-10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold">Bitese</h1>
              <p className="text-white/50 text-xs">Join millions of users</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">Connect with<br />everyone,<br />instantly</h2>
            <p className="text-white/60 mb-10 text-base">The messaging app built for privacy, speed, and real human connection.</p>
          </motion.div>
          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-3.5 border border-white/15">
                <div className="text-2xl mb-1.5">{f.icon}</div>
                <p className="text-white font-semibold text-sm leading-tight">{f.title}</p>
                <p className="text-white/50 text-xs mt-0.5">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
        {/* 2-day confirmation notice */}
        <div className="relative z-10 mx-10 mb-8 bg-white/10 rounded-2xl p-4 border border-white/20">
          <div className="flex items-start gap-3">
            <FiShield className="text-[#25D366] mt-0.5 flex-shrink-0" size={16}/>
            <div>
              <p className="text-white text-sm font-semibold">2-Day Confirmation</p>
              <p className="text-white/50 text-xs mt-0.5">After 2 days of use, we'll ask you to confirm your account via a quick SMS code — keeping your account secure.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Signup form ── */}
      <div className="w-full lg:w-[480px] flex flex-col justify-center bg-white relative overflow-y-auto">
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#075E54] to-[#25D366]"/>
        <div className="px-8 sm:px-12 py-10 max-w-md mx-auto w-full">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Bitese</span>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6">
            {[1,2].map(s => (
              <React.Fragment key={s}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step >= s ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-400'}`}>
                  {step > s ? <FiCheck size={13} strokeWidth={3}/> : s}
                </div>
                {s < 2 && <div className={`flex-1 h-1 rounded-full transition-all ${step > s ? 'bg-[#25D366]' : 'bg-gray-100'}`}/>}
              </React.Fragment>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onSubmit={handleStep1} className="space-y-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-0.5">Create Account</h2>
                  <p className="text-gray-400 text-sm mb-5">No phone verification needed — start instantly</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={17}/>
                    <input type="tel" value={formData.phone_number}
                      onChange={e => setFormData(p => ({ ...p, phone_number: e.target.value }))}
                      placeholder="+256 701 234 567" required
                      className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-green-50 transition text-sm"/>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                  <div className="relative">
                    <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={17}/>
                    <input type="text" value={formData.full_name}
                      onChange={e => setFormData(p => ({ ...p, full_name: e.target.value }))}
                      placeholder="Your full name" required
                      className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-green-50 transition text-sm"/>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.99 }} type="submit"
                  className="w-full bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 text-base shadow-lg shadow-green-100">
                  Continue <FiArrowRight size={18}/>
                </motion.button>
              </motion.form>
            ) : (
              <motion.form key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                onSubmit={handleSignup} className="space-y-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-0.5">Set Password</h2>
                  <p className="text-gray-400 text-sm mb-4">Choose a strong password to protect your account</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={17}/>
                    <input type={showPassword ? 'text' : 'password'} value={formData.password}
                      onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                      placeholder="Min. 8 characters" required autoComplete="new-password"
                      className="w-full pl-11 pr-12 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-green-50 transition text-sm"/>
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPassword ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                    </button>
                  </div>
                  {strength && (
                    <div className="mt-2">
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div className={`h-full rounded-full ${strength.color}`} initial={{ width: 0 }} animate={{ width: strength.width }} transition={{ duration: 0.3 }}/>
                      </div>
                      <p className={`text-xs mt-1 font-medium ${strength.color.replace('bg-','text-')}`}>{strength.label}</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                  <div className="relative">
                    <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={17}/>
                    <input type={showConfirm ? 'text' : 'password'} value={formData.confirmPassword}
                      onChange={e => setFormData(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="Re-enter password" required autoComplete="new-password"
                      className={`w-full pl-11 pr-12 py-3.5 border-2 rounded-2xl focus:outline-none focus:ring-4 transition text-sm ${
                        formData.confirmPassword && formData.password !== formData.confirmPassword
                          ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
                          : 'border-gray-200 focus:border-[#25D366] focus:ring-green-50'
                      }`}/>
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {showConfirm ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                    </button>
                  </div>
                  {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                    <p className="text-red-500 text-xs mt-1">Passwords don't match</p>
                  )}
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl hover:bg-gray-50 transition text-sm">
                    ← Back
                  </button>
                  <motion.button whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
                    className="flex-1 bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-100">
                    {loading
                      ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"/>
                      : 'Create Account 🎉'}
                  </motion.button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-[#25D366] font-bold hover:underline">Sign in</button>
          </p>
        </div>
      </div>
    </div>
  );
}
