import React, { useState, useRef } from 'react';
import {
  FiX, FiCamera, FiLogOut, FiGrid, FiStar, FiSettings,
  FiEdit2, FiCheck, FiMail, FiCalendar, FiGlobe, FiHome,
  FiPhone, FiUser, FiInfo, FiChevronRight, FiAlertCircle,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../services/store';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import QRScannerModal from './QRScannerModal';
import { PHONE_COUNTRIES, getFlag } from '../data/phoneCountries';

const ALL_COUNTRIES = [...new Set(PHONE_COUNTRIES.map(c => c.name))].sort();

function getCountryFlag(countryName) {
  const c = PHONE_COUNTRIES.find(p => p.name === countryName);
  return c ? getFlag(c.iso2) : '🌍';
}

function profileCompleteness(user) {
  const fields = ['full_name','bio','avatar_url','email','age','country','city'];
  const filled = fields.filter(f => user?.[f]).length;
  return Math.round((filled / fields.length) * 100);
}

export default function ProfilePanel({ onClose }) {
  const { user, setUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url || null);
  const [countrySearch, setCountrySearch] = useState('');
  const [showCountryDrop, setShowCountryDrop] = useState(false);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || '',
    email: user?.email || '',
    age: user?.age ? String(user.age) : '',
    country: user?.country || '',
    city: user?.city || '',
  });
  const [errors, setErrors] = useState({});

  const pct = profileCompleteness(user);

  const set = (k, v) => {
    setForm(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(p => ({ ...p, [k]: '' }));
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image must be < 5MB'); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const validate = () => {
    const e = {};
    if (!form.full_name.trim()) e.full_name = 'Name is required';
    if (form.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) e.email = 'Invalid email';
    if (form.age) {
      const a = parseInt(form.age);
      if (isNaN(a) || a < 13 || a > 120) e.age = 'Age must be 13–120';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      let avatarUrl = user?.avatar_url;
      if (avatarFile) {
        const fd = new FormData();
        fd.append('file', avatarFile);
        const up = await api.post('/upload/image', fd);
        avatarUrl = up.data.url;
      }
      const payload = {
        full_name: form.full_name.trim(),
        bio: form.bio.trim(),
        avatar_url: avatarUrl,
        email: form.email.trim() || null,
        age: form.age ? parseInt(form.age) : null,
        country: form.country || null,
        city: form.city.trim() || null,
      };
      const { data } = await api.put('/auth/profile', payload);
      setUser(data.user);
      setEditing(false);
      setAvatarFile(null);
      toast.success('Profile updated ✓');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(user?.avatar_url || null);
    setForm({
      full_name: user?.full_name || '',
      bio: user?.bio || '',
      email: user?.email || '',
      age: user?.age ? String(user.age) : '',
      country: user?.country || '',
      city: user?.city || '',
    });
    setErrors({});
  };

  const handleLogout = () => {
    useAuthStore.getState().logout();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
    toast.success('Logged out');
  };

  const filteredCountries = ALL_COUNTRIES.filter(c =>
    c.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const inputCls = (err) =>
    `w-full px-4 py-2.5 border-2 rounded-xl focus:outline-none focus:ring-2 transition text-sm
    ${err ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : 'border-gray-200 focus:border-[#25D366] focus:ring-green-50'}`;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex justify-start" onClick={onClose}>
        <motion.div
          initial={{ x: -380 }} animate={{ x: 0 }} exit={{ x: -380 }}
          transition={{ type:'spring', damping:28, stiffness:280 }}
          className="w-full max-w-sm bg-white h-full overflow-y-auto shadow-2xl flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] text-white px-5 pt-12 pb-6 flex-shrink-0">
            <div className="flex items-start justify-between mb-5">
              <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition">
                <FiX size={20} />
              </button>
              {!editing && (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-xl transition text-sm font-semibold">
                  <FiEdit2 size={13} /> Edit
                </button>
              )}
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-4xl font-bold shadow-xl ring-4 ring-white/20">
                  {avatarPreview
                    ? <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                    : user?.full_name?.[0]?.toUpperCase()}
                </div>
                {editing && (
                  <button onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 bg-[#25D366] text-white p-2 rounded-full shadow-lg hover:bg-[#1fbd5a] transition border-2 border-white">
                    <FiCamera size={14} />
                  </button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
              <h3 className="text-lg font-bold mt-3">{user?.full_name}</h3>
              <p className="text-white/60 text-sm">{user?.phone_number}</p>
              {user?.status && (
                <span className={`mt-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold
                  ${user.status === 'available' ? 'bg-[#25D366]/30 text-green-100' : 'bg-white/10 text-white/70'}`}>
                  ● {user.status}
                </span>
              )}
            </div>

            {/* Completeness bar */}
            {!editing && pct < 100 && (
              <div className="mt-4 bg-white/10 rounded-xl p-3">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-white/70">Profile completeness</span>
                  <span className="text-white font-bold">{pct}%</span>
                </div>
                <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-[#25D366] rounded-full"
                    initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }} />
                </div>
                <p className="text-white/50 text-[10px] mt-1.5">Complete your profile to get discovered</p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {editing ? (
              /* ── EDIT MODE ── */
              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Full Name *</label>
                  <div className="relative">
                    <FiUser className="absolute left-3 top-1/2 -translate-y-1/2 text-[#25D366]" size={15} />
                    <input value={form.full_name} onChange={e => set('full_name', e.target.value)}
                      className={`${inputCls(errors.full_name)} pl-9`} placeholder="Your full name" />
                  </div>
                  {errors.full_name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><FiAlertCircle size={10}/>{errors.full_name}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Bio</label>
                  <div className="relative">
                    <FiInfo className="absolute left-3 top-3 text-[#25D366]" size={15} />
                    <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
                      rows={2} maxLength={139} placeholder="Hey there! I am using VipChat."
                      className={`${inputCls(false)} pl-9 resize-none`} />
                  </div>
                  <p className="text-[10px] text-gray-400 text-right mt-0.5">{form.bio.length}/139</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                  <div className="relative">
                    <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 text-[#25D366]" size={15} />
                    <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                      className={`${inputCls(errors.email)} pl-9`} placeholder="you@example.com" />
                  </div>
                  {errors.email && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><FiAlertCircle size={10}/>{errors.email}</p>}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Age</label>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 -translate-y-1/2 text-[#25D366]" size={15} />
                    <input type="number" min="13" max="120" value={form.age} onChange={e => set('age', e.target.value)}
                      className={`${inputCls(errors.age)} pl-9`} placeholder="Your age" />
                  </div>
                  {errors.age && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><FiAlertCircle size={10}/>{errors.age}</p>}
                </div>

                {/* Country dropdown */}
                <div className="relative">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Country</label>
                  <div className="relative">
                    <FiGlobe className="absolute left-3 top-1/2 -translate-y-1/2 text-[#25D366]" size={15} />
                    <input type="text"
                      value={form.country || countrySearch}
                      onChange={e => { setCountrySearch(e.target.value); set('country',''); setShowCountryDrop(true); }}
                      onFocus={() => setShowCountryDrop(true)}
                      placeholder="Select your country"
                      className={`${inputCls(false)} pl-9`} />
                    {form.country && (
                      <button type="button" onClick={() => { set('country',''); setCountrySearch(''); }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs">✕</button>
                    )}
                  </div>
                  <AnimatePresence>
                    {showCountryDrop && filteredCountries.length > 0 && !form.country && (
                      <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-4 }}
                        className="absolute z-50 left-0 right-0 top-full mt-1 border border-gray-200 rounded-xl bg-white shadow-xl max-h-40 overflow-y-auto">
                        {filteredCountries.slice(0,20).map(c => (
                          <button key={c} type="button"
                            onClick={() => { set('country',c); setCountrySearch(c); setShowCountryDrop(false); }}
                            className="w-full text-left px-4 py-2 text-sm hover:bg-green-50 flex items-center gap-2">
                            <span>{getCountryFlag(c)}</span> {c}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">City</label>
                  <div className="relative">
                    <FiHome className="absolute left-3 top-1/2 -translate-y-1/2 text-[#25D366]" size={15} />
                    <input value={form.city} onChange={e => set('city', e.target.value)}
                      className={`${inputCls(false)} pl-9`} placeholder="Your city" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button onClick={handleCancel}
                    className="flex-1 border-2 border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2">
                    {saving
                      ? <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
                          className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      : <><FiCheck size={14} /> Save</>}
                  </button>
                </div>
              </div>
            ) : (
              /* ── VIEW MODE ── */
              <div>
                {/* Info cards */}
                <div className="px-5 pt-4 space-y-2">
                  {[
                    { icon: FiUser,     label: 'Name',    value: user?.full_name },
                    { icon: FiInfo,     label: 'Bio',     value: user?.bio || 'Hey there! I am using VipChat.' },
                    { icon: FiPhone,    label: 'Phone',   value: user?.phone_number },
                    { icon: FiMail,     label: 'Email',   value: user?.email || <span className="text-gray-400 italic text-sm">Not set</span> },
                    { icon: FiCalendar, label: 'Age',     value: user?.age ? `${user.age} years old` : <span className="text-gray-400 italic text-sm">Not set</span> },
                    { icon: FiGlobe,    label: 'Country', value: user?.country
                        ? <span className="flex items-center gap-1.5">{getCountryFlag(user.country)} {user.country}</span>
                        : <span className="text-gray-400 italic text-sm">Not set</span> },
                    { icon: FiHome,     label: 'City',    value: user?.city || <span className="text-gray-400 italic text-sm">Not set</span> },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-start gap-3 py-2.5 border-b border-gray-50">
                      <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Icon size={14} className="text-[#25D366]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 font-medium">{label}</p>
                        <p className="text-sm text-gray-800 font-medium mt-0.5 break-words">{value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Menu */}
                <div className="mt-4 border-t border-gray-100">
                  {[
                    { icon: FiGrid,     label: 'QR Code',         sub: 'Scan or share your code',          action: () => setShowQR(true) },
                    { icon: FiStar,     label: 'Starred Messages', sub: 'View your starred messages',      action: () => { navigate('/starred'); onClose(); } },
                    { icon: FiSettings, label: 'Settings',         sub: 'Privacy, security, notifications', action: () => { navigate('/settings'); onClose(); } },
                  ].map(item => (
                    <button key={item.label} onClick={item.action}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition border-b border-gray-50">
                      <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <item.icon size={16} className="text-gray-600" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                      </div>
                      <FiChevronRight size={16} className="text-gray-300" />
                    </button>
                  ))}

                  <button onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-red-50 transition text-red-500">
                    <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center flex-shrink-0">
                      <FiLogOut size={16} className="text-red-500" />
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">Log Out</p>
                      <p className="text-xs text-red-400 mt-0.5">Sign out of your account</p>
                    </div>
                  </button>
                </div>

                <div className="px-5 py-5 text-center">
                  <p className="text-xs text-gray-300">VipChat v1.0.0 · End-to-end encrypted</p>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {showQR && (
        <QRScannerModal onClose={() => setShowQR(false)} onSuccess={() => setShowQR(false)} />
      )}
    </>
  );
}
