import React, { useState, useEffect, useRef } from 'react';
import {
  FiArrowLeft, FiLock, FiBell, FiDownload, FiDatabase,
  FiHelpCircle, FiInfo, FiChevronRight,
  FiCheck, FiShield, FiSend, FiSmartphone, FiZap, FiShoppingBag,
  FiSearch, FiBriefcase, FiEdit3,
} from 'react-icons/fi';
import { subscribeToPush, unsubscribeFromPush } from '../services/pushService';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../services/store';
import GetVerifiedModal from '../components/GetVerifiedModal';
import { VerifiedBadgeInline } from '../components/VerifiedBadge';
import DeviceSessionsModal from '../components/DeviceSessionsModal';
import ContactsSyncPanel from '../components/ContactsSyncPanel';

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#25D366]' : 'bg-gray-200'}`}>
      <motion.div
        animate={{ x: value ? 18 : 2 }}
        transition={{ type:'spring', stiffness:500, damping:30 }}
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
      />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-3">
      <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
        <Icon size={15} className="text-[#25D366]" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50/50 transition">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function SelectRow({ label, sub, value, options, onChange }) {
  const current = options.find(o => o.value === value);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50/50 transition text-left">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#25D366] font-semibold">{current?.label || value}</span>
          <FiChevronRight size={14} className={`text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute right-5 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-10 min-w-[160px] overflow-hidden">
          {options.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-green-50 transition
                ${opt.value === value ? 'text-[#25D366] font-semibold' : 'text-gray-700'}`}>
              {opt.label}
              {opt.value === value && <FiCheck size={13} strokeWidth={3} className="text-[#25D366]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ label, sub, icon: Icon, iconBg = 'bg-gray-100', iconColor = 'text-gray-500', onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 transition text-left
        ${danger ? 'hover:bg-red-50' : 'hover:bg-gray-50/50'}`}>
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {Icon && <Icon size={14} className={iconColor} />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-800'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <FiChevronRight size={14} className={danger ? 'text-red-200' : 'text-gray-200'} />
    </button>
  );
}

// ── Rich Text Bio Editor ─────────────────────────────────────────────────────
function RichBioEditor({ initialValue, onSave }) {
  const editorRef = useRef(null);
  const [charCount, setCharCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [active, setActive] = useState(false);
  const MAX_CHARS = 500;

  const EMOJIS = ['😊', '🚀', '🎉', '💪', '🌟', '❤️', '🔥', '✨', '🎵', '📱', '💡', '🌍', '🏆', '💼', '🎯'];
  const FONT_STYLES = [
    { label: 'B', command: 'bold', className: 'font-bold', title: 'Bold' },
    { label: 'I', command: 'italic', className: 'italic', title: 'Italic' },
    { label: 'U', command: 'underline', className: 'underline', title: 'Underline' },
  ];
  const COLORS = [
    { color: '#25D366', title: 'Green' },
    { color: '#128C7E', title: 'Teal' },
    { color: '#075E54', title: 'Dark Teal' },
    { color: '#000000', title: 'Black' },
    { color: '#6B7280', title: 'Gray' },
  ];

  useEffect(() => {
    if (editorRef.current && initialValue) {
      editorRef.current.innerHTML = initialValue;
      setCharCount(editorRef.current.innerText.length);
    }
  }, [initialValue]);

  const applyFormat = (command, value) => {
    document.execCommand(command, false, value || null);
    editorRef.current?.focus();
  };

  const insertEmoji = (emoji) => {
    editorRef.current?.focus();
    document.execCommand('insertText', false, emoji);
  };

  const handleInput = () => {
    const text = editorRef.current?.innerText || '';
    if (text.length > MAX_CHARS) {
      document.execCommand('undo');
    } else {
      setCharCount(text.length);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const html = editorRef.current?.innerHTML || '';
    await onSave(html);
    setSaving(false);
    setActive(false);
  };

  const handleClear = () => {
    if (editorRef.current) editorRef.current.innerHTML = '';
    setCharCount(0);
    editorRef.current?.focus();
  };

  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      {/* Toolbar */}
      {active && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center gap-1 px-3 py-2 bg-gray-50 border-b border-gray-100">
          {FONT_STYLES.map(s => (
            <button key={s.command} type="button" title={s.title}
              onClick={() => applyFormat(s.command)}
              className="w-7 h-7 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 flex items-center justify-center text-xs transition">
              <span className={s.className}>{s.label}</span>
            </button>
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          {COLORS.map(c => (
            <button key={c.color} type="button" title={c.title}
              onClick={() => applyFormat('foreColor', c.color)}
              className="w-5 h-5 rounded-full border-2 border-white shadow-sm hover:scale-110 transition"
              style={{ backgroundColor: c.color }} />
          ))}
          <div className="w-px h-4 bg-gray-200 mx-1" />
          <div className="flex flex-wrap gap-1">
            {EMOJIS.map(emoji => (
              <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}
                className="text-base leading-none hover:scale-125 transition cursor-pointer">{emoji}</button>
            ))}
          </div>
          <div className="ml-auto">
            <button type="button" onClick={handleClear}
              className="text-xs text-gray-400 hover:text-red-400 transition px-2">Clear</button>
          </div>
        </motion.div>
      )}

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onFocus={() => setActive(true)}
        onBlur={() => {}}
        data-placeholder="Write a bio… (supports bold, italic, colors and emoji)"
        className="min-h-[80px] px-4 py-3 text-sm text-gray-800 focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-gray-300"
        style={{ lineHeight: 1.6 }}
      />

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
        <span className={`text-xs ${charCount > MAX_CHARS * 0.9 ? 'text-orange-500' : 'text-gray-400'}`}>
          {charCount}/{MAX_CHARS}
        </span>
        <button type="button" onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-[#25D366] text-white rounded-full hover:bg-[#1fbd5a] disabled:opacity-50 transition">
          {saving ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <FiCheck size={12} />}
          Save Bio
        </button>
      </div>
    </div>
  );
}

const PRIVACY_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My Contacts' },
  { value: 'nobody',   label: 'Nobody' },
];

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'security', label: 'Security' },
  { id: 'contacts', label: 'Contacts' },
  { id: 'verification', label: 'Verification' },
];

function VerificationTab({ user }) {
  const { setUser } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [verificationData, setVerificationData] = useState(null);
  const [loadingVer, setLoadingVer] = useState(true);

  useEffect(() => {
    api.get('/payments/my-verification')
      .then(({ data }) => setVerificationData(data))
      .catch(() => {})
      .finally(() => setLoadingVer(false));
  }, []);

  const handleVerifySuccess = async () => {
    try {
      const { data } = await api.get('/payments/my-verification');
      setVerificationData(data);
      if (data.badge_verified) {
        setUser({ ...user, badge_verified: true, verification_tier: data.verification_tier });
      }
    } catch {}
  };

  const isVerified = verificationData?.badge_verified || user?.badge_verified;
  const tier = verificationData?.verification_tier || user?.verification_tier;

  const fmtDate = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  };

  if (loadingVer) {
    return (
      <div className="flex items-center justify-center py-16">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status card */}
      <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`px-5 py-5 ${isVerified
          ? 'bg-gradient-to-r from-[#075E54] to-[#128C7E]'
          : 'bg-gradient-to-r from-gray-600 to-gray-500'}`}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/15 flex items-center justify-center text-3xl flex-shrink-0">
              {isVerified ? '✅' : '🔒'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-lg leading-snug flex items-center gap-2">
                {user?.full_name}
                {isVerified && <VerifiedBadgeInline user={user} size={16} />}
              </p>
              <p className="text-white/70 text-sm mt-0.5">
                {isVerified
                  ? `${tier === 'business' ? 'Business' : 'Personal'} Verified Account`
                  : 'Not yet verified'}
              </p>
              {isVerified && verificationData?.verified_at && (
                <p className="text-white/50 text-xs mt-1">
                  Verified on {fmtDate(verificationData.verified_at)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* CTA or already verified */}
        {isVerified ? (
          <div className="px-5 py-4 bg-green-50 border-t border-green-100 flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
              <FiCheck size={15} className="text-[#25D366]" strokeWidth={3} />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Your account is verified</p>
              <p className="text-xs text-green-600 mt-0.5">Your badge appears in all chats and your profile</p>
            </div>
          </div>
        ) : (
          <div className="px-5 py-4">
            <p className="text-sm text-gray-600 mb-3">
              Get a verified badge to build trust with your contacts. One-time payment — your badge never expires.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="w-full py-3 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#1fbd5a] hover:to-[#0e7a6c] text-white font-bold rounded-2xl transition flex items-center justify-center gap-2"
            >
              <FiShield size={17} />
              Get Verified — from $2.99
            </button>
          </div>
        )}
      </div>

      {/* Verification perks (shown when not verified) */}
      {!isVerified && (
        <div className="mx-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiShield} title="Why get verified?" desc="Benefits of a verified account" />
          {[
            { iconComp: 'check', title: 'Trusted badge', desc: 'A verified badge next to your name in all chats', color: 'text-green-500 bg-green-50' },
            { iconComp: 'search', title: 'Stand out', desc: 'Verified profiles appear first in search results', color: 'text-blue-500 bg-blue-50' },
            { iconComp: 'lock', title: 'Permanent', desc: 'One-time fee — your badge never expires', color: 'text-purple-500 bg-purple-50' },
            { iconComp: 'briefcase', title: 'Business tier', desc: 'Business plan available for brands and professionals', color: 'text-orange-500 bg-orange-50' },
          ].map(item => (
            <div key={item.title} className="flex items-start gap-3 px-5 py-3.5 border-b border-gray-50">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${item.color}`}>
                {item.iconComp === 'check' && <FiCheck size={15} />}
                {item.iconComp === 'search' && <FiSearch size={15} />}
                {item.iconComp === 'lock' && <FiLock size={15} />}
                {item.iconComp === 'briefcase' && <FiBriefcase size={15} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment history */}
      {verificationData?.payment_history?.length > 0 && (
        <div className="mx-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiDatabase} title="Payment History" desc="Your verification payments" />
          {verificationData.payment_history.map(p => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-50">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-sm
                ${p.status === 'completed' ? 'bg-green-50' : p.status === 'failed' ? 'bg-red-50' : 'bg-yellow-50'}`}>
                {p.status === 'completed' ? '✅' : p.status === 'failed' ? '❌' : '⏳'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 capitalize">{p.tier} · via {p.provider}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  ${p.amount.toFixed(2)} {p.currency} · {new Date(p.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize
                ${p.status === 'completed' ? 'bg-green-100 text-green-700' :
                  p.status === 'failed' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-700'}`}>
                {p.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GetVerifiedModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); handleVerifySuccess(); }}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, setUser } = useAuthStore();
  const [activeTab, setActiveTab] = useState('general');
  const [showDeviceSessions, setShowDeviceSessions] = useState(false);
  const [settings, setSettings] = useState({
    read_receipts: true,
    last_seen_privacy: 'everyone',
    profile_photo_privacy: 'everyone',
    about_privacy: 'everyone',
    status_privacy: 'contacts',
    auto_download_photos: true,
    auto_download_videos: false,
    auto_download_documents: false,
    show_notifications: true,
    show_preview: true,
    message_sound: true,
    group_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bioExpanded, setBioExpanded] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  useEffect(() => {
    const verifiedParam = searchParams.get('verified');
    if (verifiedParam === 'success') {
      setActiveTab('verification');
      toast.success('Payment received! Checking your badge status…', { duration: 4000 });
      let attempts = 0;
      const maxAttempts = 20;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const { data } = await api.get('/payments/my-verification');
          if (data.badge_verified) {
            clearInterval(interval);
            setUser({ ...user, badge_verified: true, verification_tier: data.verification_tier });
            toast.success('Your verified badge is now active! ✅', { duration: 5000 });
          } else if (attempts >= maxAttempts) {
            clearInterval(interval);
            toast('Badge activation is taking longer than expected. Refresh in a moment.', { icon: 'ℹ️', duration: 6000 });
          }
        } catch {
          if (attempts >= maxAttempts) clearInterval(interval);
        }
      }, 3000);
      return () => clearInterval(interval);
    } else if (verifiedParam === 'cancel') {
      toast('Payment cancelled. You can try again anytime.', { icon: 'ℹ️' });
    }
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(s => ({ ...s, ...data }));
    } catch { toast.error('Could not load settings'); }
    finally { setLoading(false); }
  };

  const updateSetting = async (key, value) => {
    setSaving(true);
    setSettings(s => ({ ...s, [key]: value }));
    try {
      await api.put('/settings', { [key]: value });
    } catch {
      setSettings(s => ({ ...s, [key]: !value }));
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async (value) => {
    if (value) {
      const ok = await subscribeToPush();
      if (!ok) {
        toast.error('Could not enable notifications. Check browser permissions.');
        return;
      }
      toast.success('Push notifications enabled');
    } else {
      await unsubscribeFromPush();
      toast('Push notifications disabled');
    }
    await updateSetting('show_notifications', value);
  };

  const sendTestNotification = async () => {
    try {
      await api.post('/push/test');
      toast.success('Test notification sent!');
    } catch {
      toast.error('Could not send test notification');
    }
  };

  const handleBackup = async () => {
    try {
      await api.post('/settings/backup');
      toast.success('Backup created successfully');
    } catch { toast.error('Backup failed'); }
  };

  const handleBioSave = async (html) => {
    try {
      await api.put('/settings', { bio: html });
      setUser({ ...user, bio: html });
      toast.success('Bio saved!');
      setBioExpanded(false);
    } catch { toast.error('Failed to save bio'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
          className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <button onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition">
          <FiArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400">Manage your preferences</p>
        </div>
        {saving && (
          <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
            className="w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full" />
        )}
      </div>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-100 px-4 flex gap-1 flex-shrink-0">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative px-4 py-3 text-sm font-semibold transition ${
              activeTab === tab.id ? 'text-[#25D366]' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="settings-tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366] rounded-full"
              />
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'general' ? (
            <motion.div key="general" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Account summary */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <button onClick={() => navigate(-1)}
                  className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/50 transition text-left">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 overflow-hidden">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : user?.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 flex items-center gap-1.5">
                      {user?.full_name}
                      <VerifiedBadgeInline user={user} size={14} />
                    </p>
                    <p className="text-sm text-gray-400">{user?.phone_number}</p>
                    {user?.bio
                      ? <p className="text-xs text-gray-400 truncate mt-0.5" dangerouslySetInnerHTML={{ __html: user.bio }} />
                      : <p className="text-xs text-[#25D366] mt-0.5">Add a bio →</p>}
                  </div>
                  <FiChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                </button>

                {/* Bio editor */}
                <div className="border-t border-gray-50 px-4 py-3">
                  <button
                    onClick={() => setBioExpanded(e => !e)}
                    className="flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-[#25D366] transition w-full text-left"
                  >
                    <FiEdit3 size={14} className="text-[#25D366]" />
                    <span>{bioExpanded ? 'Hide bio editor' : 'Edit bio'}</span>
                    <motion.div animate={{ rotate: bioExpanded ? 90 : 0 }} className="ml-auto">
                      <FiChevronRight size={14} className="text-gray-300" />
                    </motion.div>
                  </button>
                  <AnimatePresence>
                    {bioExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pt-3">
                          <RichBioEditor initialValue={user?.bio || ''} onSave={handleBioSave} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Verification shortcut */}
              {!user?.badge_verified && (
                <div className="mx-4 mt-4">
                  <button
                    onClick={() => setActiveTab('verification')}
                    className="w-full flex items-center gap-3 p-4 bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl shadow-sm text-left"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center text-xl flex-shrink-0">✅</div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-white">Get Verified</p>
                      <p className="text-xs text-white/70 mt-0.5">Earn a verified badge — from $2.99 one-time</p>
                    </div>
                    <FiChevronRight size={16} className="text-white/50" />
                  </button>
                </div>
              )}

              {/* Privacy */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiLock} title="Privacy" desc="Control who can see your information" />

                <SelectRow label="Last Seen" sub="Who can see when you were last online"
                  value={settings.last_seen_privacy} options={PRIVACY_OPTIONS}
                  onChange={v => updateSetting('last_seen_privacy', v)} />
                <SelectRow label="Profile Photo" sub="Who can see your profile picture"
                  value={settings.profile_photo_privacy} options={PRIVACY_OPTIONS}
                  onChange={v => updateSetting('profile_photo_privacy', v)} />
                <SelectRow label="Status" sub="Who can see your status updates"
                  value={settings.status_privacy} options={PRIVACY_OPTIONS}
                  onChange={v => updateSetting('status_privacy', v)} />
                <ToggleRow label="Read Receipts" sub="Let others know you've read their messages"
                  value={settings.read_receipts} onChange={v => updateSetting('read_receipts', v)} />
              </div>

              {/* Notifications */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiBell} title="Notifications" desc="Manage alerts and sounds" />

                <ToggleRow label="Push Notifications" sub="Receive notifications when a new message arrives"
                  value={settings.show_notifications} onChange={handlePushToggle} />
                {settings.show_notifications && (
                  <div className="px-5 pb-4">
                    <button onClick={sendTestNotification}
                      className="flex items-center gap-2 text-xs font-semibold text-[#25D366] hover:text-[#1aa355] transition">
                      <FiSend size={12}/> Send a test notification
                    </button>
                  </div>
                )}
                <ToggleRow label="Message Preview" sub="Show message content in notifications"
                  value={settings.show_preview} onChange={v => updateSetting('show_preview', v)} />
                <ToggleRow label="Message Sounds" sub="Play sound when a message is received"
                  value={settings.message_sound ?? true} onChange={v => updateSetting('message_sound', v)} />
                <ToggleRow label="Group Notifications" sub="Get notified for new group messages"
                  value={settings.group_notifications ?? true} onChange={v => updateSetting('group_notifications', v)} />
              </div>

              {/* Storage & Data */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiDownload} title="Storage & Data" desc="Manage auto-download settings" />

                <ToggleRow label="Auto-Download Photos" sub="Automatically save received photos"
                  value={settings.auto_download_photos} onChange={v => updateSetting('auto_download_photos', v)} />
                <ToggleRow label="Auto-Download Videos" sub="Automatically save received videos"
                  value={settings.auto_download_videos} onChange={v => updateSetting('auto_download_videos', v)} />
                <ToggleRow label="Auto-Download Documents" sub="Automatically save received documents"
                  value={settings.auto_download_documents} onChange={v => updateSetting('auto_download_documents', v)} />
              </div>

              {/* Backup */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiDatabase} title="Backup & Restore" desc="Keep your chats safe" />
                <ActionRow label="Create Backup" sub="Export your messages as a JSON file"
                  icon={FiDatabase} iconBg="bg-blue-50" iconColor="text-blue-500" onClick={handleBackup} />
              </div>

              {/* Help & About */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiHelpCircle} title="Help & About" />
                <ActionRow label="Help Center" sub="FAQ and support articles"
                  icon={FiHelpCircle} iconBg="bg-purple-50" iconColor="text-purple-500"
                  onClick={() => toast('Help center coming soon!')} />
                <ActionRow label="About VipChat" sub="Version 2.0.0 · Privacy policy"
                  icon={FiInfo} iconBg="bg-gray-100" iconColor="text-gray-500"
                  onClick={() => toast('VipChat v2.0.0 – End-to-end encrypted messaging', { icon: 'ℹ️' })} />
              </div>

              <div className="mx-4 my-6 text-center">
                <p className="text-xs text-gray-300">VipChat v2.0.0 · End-to-end encrypted</p>
                <p className="text-xs text-gray-300 mt-0.5">Your messages are protected with industry-standard encryption</p>
              </div>
            </motion.div>
          ) : activeTab === 'security' ? (
            <motion.div key="security" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Active Devices */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiShield} title="Active Devices" desc="Manage sessions and linked devices" />
                <ActionRow label="Linked Devices" sub="View and manage all active sessions"
                  icon={FiSmartphone} iconBg="bg-blue-50" iconColor="text-blue-500"
                  onClick={() => setShowDeviceSessions(true)} />
              </div>

              {/* Account */}
              <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <SectionHeader icon={FiZap} title="Account & Billing" desc="Subscription and marketplace" />
                <ActionRow label="Subscription Plan" sub="Upgrade to Pro or Business"
                  icon={FiZap} iconBg="bg-amber-50" iconColor="text-amber-500"
                  onClick={() => navigate('/subscription')} />
                <ActionRow label="Marketplace" sub="Browse, sell, and manage products"
                  icon={FiShoppingBag} iconBg="bg-purple-50" iconColor="text-purple-500"
                  onClick={() => navigate('/marketplace')} />
              </div>

              {/* Security info */}
              <div className="mx-4 mt-4 mb-8 bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <FiShield size={20} className="text-white" />
                  <p className="font-bold text-white">End-to-End Encrypted</p>
                </div>
                <p className="text-white/70 text-sm">
                  All your messages are protected with industry-standard end-to-end encryption.
                  No one — not even VipChat — can read your messages.
                </p>
              </div>
            </motion.div>
          ) : activeTab === 'contacts' ? (
            <motion.div key="contacts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="px-4 pt-4 pb-8">
                <ContactsSyncPanel />
              </div>
            </motion.div>
          ) : (
            <motion.div key="verification" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <VerificationTab user={user} />
              <div className="h-6" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {showDeviceSessions && (
        <DeviceSessionsModal onClose={() => setShowDeviceSessions(false)} />
      )}

    </div>
  );
}
