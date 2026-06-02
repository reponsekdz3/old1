import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiPhone, FiLock, FiUser, FiArrowRight, FiEye, FiEyeOff,
  FiCheck, FiMail, FiMapPin, FiCalendar, FiGlobe, FiHome,
  FiShield, FiAlertCircle,
} from 'react-icons/fi';

const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Angola','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bangladesh','Belarus','Belgium','Benin','Bolivia','Bosnia and Herzegovina',
  'Botswana','Brazil','Bulgaria','Burkina Faso','Burundi','Cambodia','Cameroon','Canada',
  'Central African Republic','Chad','Chile','China','Colombia','Congo','Costa Rica',
  'Croatia','Cuba','Czech Republic','Denmark','Dominican Republic','DR Congo','Ecuador',
  'Egypt','El Salvador','Ethiopia','Finland','France','Gabon','Ghana','Greece','Guatemala',
  'Guinea','Haiti','Honduras','Hungary','India','Indonesia','Iran','Iraq','Ireland','Israel',
  'Italy','Ivory Coast','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kosovo','Kuwait',
  'Kyrgyzstan','Laos','Lebanon','Libya','Madagascar','Malawi','Malaysia','Mali','Mexico',
  'Moldova','Mongolia','Morocco','Mozambique','Myanmar','Namibia','Nepal','Netherlands',
  'New Zealand','Nicaragua','Niger','Nigeria','North Korea','Norway','Oman','Pakistan',
  'Palestine','Panama','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania',
  'Russia','Rwanda','Saudi Arabia','Senegal','Sierra Leone','Somalia','South Africa',
  'South Korea','South Sudan','Spain','Sri Lanka','Sudan','Sweden','Switzerland','Syria',
  'Taiwan','Tajikistan','Tanzania','Thailand','Togo','Tunisia','Turkey','Turkmenistan',
  'Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay',
  'Uzbekistan','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

const STEPS = [
  { label: 'Account', icon: FiUser },
  { label: 'Profile', icon: FiMapPin },
  { label: 'Security', icon: FiShield },
];

const FEATURES = [
  { emoji: '💬', title: 'Real-time Messaging', desc: 'Instant delivery, end-to-end encrypted' },
  { emoji: '📞', title: 'Voice & Video Calls', desc: 'Crystal-clear HD calls worldwide, free' },
  { emoji: '📁', title: 'File Sharing', desc: 'Images, docs, voice notes up to 100MB' },
  { emoji: '👥', title: 'Groups & Communities', desc: 'Stay connected with everyone you care about' },
];

function Field({ label, icon: Icon, error, children }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366] z-10" size={16} />}
        {children}
      </div>
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <FiAlertCircle size={11} /> {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasIcon = true, error = false) {
  return `w-full ${hasIcon ? 'pl-11' : 'pl-4'} pr-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-4 transition text-sm bg-white
    ${error
      ? 'border-red-300 focus:border-red-400 focus:ring-red-50'
      : 'border-gray-200 focus:border-[#25D366] focus:ring-green-50'}`;
}

function PasswordStrength({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Very weak', color: 'bg-red-400', text: 'text-red-500' },
    { label: 'Weak', color: 'bg-orange-400', text: 'text-orange-500' },
    { label: 'Fair', color: 'bg-yellow-400', text: 'text-yellow-600' },
    { label: 'Good', color: 'bg-blue-400', text: 'text-blue-500' },
    { label: 'Strong 🔐', color: 'bg-[#25D366]', text: 'text-[#25D366]' },
  ];
  const lvl = levels[Math.min(score, 4)];

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map(i => (
          <motion.div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i <= score - 1 ? lvl.color : 'bg-gray-100'}`}
          />
        ))}
      </div>
      <p className={`text-xs font-medium ${lvl.text}`}>{lvl.label}</p>
    </div>
  );
}

export default function SignupPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const countryRef = useRef(null);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const [form, setForm] = useState({
    phone_number: '', full_name: '', email: '',
    age: '', country: '', city: '',
    password: '', confirmPassword: '',
  });
  const [errors, setErrors] = useState({});

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const validateStep0 = () => {
    const e = {};
    if (!form.phone_number.trim()) e.phone_number = 'Phone number is required';
    else if (!/^\+?[1-9]\d{6,14}$/.test(form.phone_number.replace(/\s/g, '')))
      e.phone_number = 'Enter a valid international phone number (e.g. +256701234567)';
    if (!form.full_name.trim()) e.full_name = 'Full name is required';
    else if (form.full_name.trim().length < 2) e.full_name = 'Name must be at least 2 characters';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email))
      e.email = 'Enter a valid email address';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep1 = () => {
    const e = {};
    if (form.age) {
      const a = parseInt(form.age);
      if (isNaN(a) || a < 13 || a > 120) e.age = 'Age must be between 13 and 120';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!form.confirmPassword) e.confirmPassword = 'Please confirm your password';
    else if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 0 && !validateStep0()) return;
    if (step === 1 && !validateStep1()) return;
    setStep(s => s + 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const payload = {
        phone_number: form.phone_number.replace(/\s/g, ''),
        full_name: form.full_name.trim(),
        password: form.password,
        email: form.email.trim() || undefined,
        age: form.age ? parseInt(form.age) : undefined,
        country: form.country || undefined,
        city: form.city.trim() || undefined,
      };
      const { data } = await api.post('/auth/signup', payload);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
      toast.success(`Welcome to Bitese, ${data.user.full_name}! 🎉`);
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed';
      toast.error(msg);
      if (msg.includes('phone')) setStep(0);
      else if (msg.includes('email')) { setStep(0); setErrors({ email: msg }); }
      else if (msg.includes('password')) { setErrors({ password: msg }); }
    } finally {
      setLoading(false);
    }
  };

  const stepContent = [
    /* ── Step 0: Account Info ── */
    <motion.div key="s0" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Create your account</h2>
        <p className="text-gray-400 text-sm mt-1">Start with your basic information</p>
      </div>

      <Field label="Phone Number *" icon={FiPhone} error={errors.phone_number}>
        <input type="tel" value={form.phone_number}
          onChange={e => set('phone_number', e.target.value)}
          placeholder="+256 701 234 567"
          className={inputCls(true, !!errors.phone_number)} />
      </Field>

      <Field label="Full Name *" icon={FiUser} error={errors.full_name}>
        <input type="text" value={form.full_name}
          onChange={e => set('full_name', e.target.value)}
          placeholder="Your full name"
          className={inputCls(true, !!errors.full_name)} />
      </Field>

      <Field label="Email Address (optional)" icon={FiMail} error={errors.email}>
        <input type="email" value={form.email}
          onChange={e => set('email', e.target.value)}
          placeholder="you@example.com"
          className={inputCls(true, !!errors.email)} />
        <p className="text-xs text-gray-400 mt-1">Used for account recovery and optional notifications</p>
      </Field>

      <button type="button" onClick={handleNext}
        className="w-full bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-100">
        Continue <FiArrowRight size={17} />
      </button>
    </motion.div>,

    /* ── Step 1: Profile Details ── */
    <motion.div key="s1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Your profile</h2>
        <p className="text-gray-400 text-sm mt-1">Help others know who you are (all optional)</p>
      </div>

      <Field label="Age" icon={FiCalendar} error={errors.age}>
        <input type="number" min="13" max="120" value={form.age}
          onChange={e => set('age', e.target.value)}
          placeholder="Your age (must be 13+)"
          className={inputCls(true, !!errors.age)} />
      </Field>

      <div className="space-y-1.5" ref={countryRef}>
        <label className="block text-sm font-semibold text-gray-700">Country</label>
        <div className="relative">
          <FiGlobe className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366] z-10" size={16} />
          <input
            type="text"
            value={form.country ? form.country : countrySearch}
            onChange={e => {
              setCountrySearch(e.target.value);
              set('country', '');
              setShowCountryDropdown(true);
            }}
            onFocus={() => setShowCountryDropdown(true)}
            placeholder="Search your country..."
            className={inputCls(true, false)}
          />
          {form.country && (
            <button type="button" onClick={() => { set('country', ''); setCountrySearch(''); setShowCountryDropdown(true); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
          )}
        </div>
        <AnimatePresence>
          {showCountryDropdown && filteredCountries.length > 0 && !form.country && (
            <motion.div
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              className="border border-gray-200 rounded-2xl bg-white shadow-xl max-h-44 overflow-y-auto z-50 relative"
            >
              {filteredCountries.slice(0, 30).map(c => (
                <button key={c} type="button"
                  onClick={() => { set('country', c); setCountrySearch(c); setShowCountryDropdown(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-green-50 hover:text-[#25D366] transition flex items-center gap-2">
                  <FiGlobe size={13} className="text-gray-300" /> {c}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Field label="City" icon={FiHome} error={errors.city}>
        <input type="text" value={form.city}
          onChange={e => set('city', e.target.value)}
          placeholder="Your city"
          className={inputCls(true, !!errors.city)} />
      </Field>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => setStep(0)}
          className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3 rounded-2xl hover:bg-gray-50 transition text-sm">
          ← Back
        </button>
        <button type="button" onClick={handleNext}
          className="flex-1 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold py-3 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-100">
          Continue <FiArrowRight size={17} />
        </button>
      </div>
    </motion.div>,

    /* ── Step 2: Password ── */
    <motion.form key="s2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
      onSubmit={handleSubmit} className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Secure your account</h2>
        <p className="text-gray-400 text-sm mt-1">Choose a strong password to keep your account safe</p>
      </div>

      <div className="bg-[#f0fdf4] border border-green-100 rounded-2xl p-3.5 flex items-start gap-3">
        <FiShield className="text-[#25D366] mt-0.5 flex-shrink-0" size={16} />
        <div>
          <p className="text-xs font-semibold text-green-800">Account summary</p>
          <p className="text-xs text-green-700 mt-0.5 leading-relaxed">
            <strong>{form.full_name}</strong> · {form.phone_number}
            {form.email && <> · {form.email}</>}
            {form.country && <> · {form.country}</>}
            {form.city && <>, {form.city}</>}
            {form.age && <> · Age {form.age}</>}
          </p>
        </div>
      </div>

      <Field label="Password *" icon={FiLock} error={errors.password}>
        <input type={showPassword ? 'text' : 'password'} value={form.password}
          onChange={e => set('password', e.target.value)}
          placeholder="Min. 8 characters" autoComplete="new-password"
          className={`${inputCls(true, !!errors.password)} pr-12`} />
        <button type="button" onClick={() => setShowPassword(v => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10">
          {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
        <PasswordStrength password={form.password} />
      </Field>

      <Field label="Confirm Password *" icon={FiLock} error={errors.confirmPassword}>
        <input type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
          onChange={e => set('confirmPassword', e.target.value)}
          placeholder="Re-enter your password" autoComplete="new-password"
          className={`${inputCls(true, !!errors.confirmPassword)} pr-12`} />
        <button type="button" onClick={() => setShowConfirm(v => !v)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 z-10">
          {showConfirm ? <FiEyeOff size={16} /> : <FiEye size={16} />}
        </button>
        {form.confirmPassword && form.password === form.confirmPassword && (
          <p className="text-xs text-[#25D366] mt-1 flex items-center gap-1">
            <FiCheck size={11} strokeWidth={3} /> Passwords match
          </p>
        )}
      </Field>

      <div className="flex gap-3 pt-1">
        <button type="button" onClick={() => setStep(1)}
          className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-3.5 rounded-2xl hover:bg-gray-50 transition text-sm">
          ← Back
        </button>
        <motion.button whileTap={{ scale: 0.99 }} type="submit" disabled={loading}
          className="flex-1 bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-100">
          {loading
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            : <><FiCheck size={16} strokeWidth={3} /> Create Account</>}
        </motion.button>
      </div>
    </motion.form>,
  ];

  return (
    <div className="flex min-h-screen overflow-hidden font-sans">
      {/* ── LEFT panel ── */}
      <div className="hidden lg:flex flex-col flex-1 bg-gradient-to-br from-[#064e45] via-[#075E54] to-[#0d7a6b] relative overflow-hidden select-none">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <motion.div key={i}
              className="absolute rounded-full border border-white/10"
              style={{ width: `${140 + i * 80}px`, height: `${140 + i * 80}px`, top: `${10 + i * 12}%`, left: `${-20 + i * 8}%` }}
              animate={{ rotate: i % 2 === 0 ? 360 : -360 }}
              transition={{ duration: 30 + i * 5, repeat: Infinity, ease: 'linear' }}
            />
          ))}
        </div>

        <div className="relative z-10 px-10 pt-10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center shadow-lg">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-white text-2xl font-bold tracking-tight">Bitese</h1>
              <p className="text-white/50 text-xs">Join millions of users</p>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10 py-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              Connect with<br />everyone,<br /><span className="text-[#25D366]">instantly.</span>
            </h2>
            <p className="text-white/60 mb-10 text-base max-w-xs">
              The messaging app built for speed, privacy, and real human connection.
            </p>
          </motion.div>

          <div className="grid grid-cols-2 gap-3">
            {FEATURES.map((f, i) => (
              <motion.div key={i}
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 + i * 0.1 }}
                className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 border border-white/15 hover:bg-white/15 transition">
                <div className="text-2xl mb-2">{f.emoji}</div>
                <p className="text-white font-semibold text-sm leading-tight">{f.title}</p>
                <p className="text-white/50 text-xs mt-1 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="relative z-10 mx-10 mb-8 bg-white/10 rounded-2xl p-4 border border-white/20 backdrop-blur">
          <div className="flex items-start gap-3">
            <FiShield className="text-[#25D366] mt-0.5 flex-shrink-0" size={16} />
            <div>
              <p className="text-white text-sm font-semibold">End-to-end encrypted</p>
              <p className="text-white/50 text-xs mt-0.5">All your messages and calls are private. Bitese cannot read them.</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Form ── */}
      <div className="w-full lg:w-[500px] flex flex-col justify-center bg-white relative overflow-y-auto">
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#075E54] to-[#25D366]" />
        <div className="px-8 sm:px-12 py-10 max-w-md mx-auto w-full">

          <div className="lg:hidden flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">Bitese</span>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-8">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = step > i;
              const active = step === i;
              return (
                <React.Fragment key={i}>
                  <div className={`flex flex-col items-center gap-1 ${active || done ? '' : 'opacity-40'}`}>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all
                      ${done ? 'bg-[#25D366]' : active ? 'bg-[#25D366] ring-4 ring-green-100' : 'bg-gray-100'}`}>
                      {done
                        ? <FiCheck size={15} className="text-white" strokeWidth={3} />
                        : <Icon size={15} className={active ? 'text-white' : 'text-gray-400'} />}
                    </div>
                    <span className={`text-[9px] font-semibold tracking-wide ${active ? 'text-[#25D366]' : done ? 'text-[#25D366]' : 'text-gray-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full mb-4 transition-colors ${step > i ? 'bg-[#25D366]' : 'bg-gray-100'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {stepContent[step]}
          </AnimatePresence>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <button onClick={() => navigate('/login')} className="text-[#25D366] font-bold hover:underline">
              Sign in
            </button>
          </p>

          <p className="text-center mt-3 text-xs text-gray-400 flex items-center justify-center gap-1.5">
            <svg className="w-3 h-3 text-[#25D366]" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            End-to-end encrypted · Your data stays private
          </p>
        </div>
      </div>
    </div>
  );
}
