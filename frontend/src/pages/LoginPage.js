import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiLock, FiArrowRight, FiEye, FiEyeOff, FiMic, FiCheck } from 'react-icons/fi';

/* ── Left panel chat data ─────────────────────────────────────────────────── */
const BUBBLES = [
  { id: 1, side: 'left', type: 'text', text: "Hey! Just landed in Kampala 🛬", time: '9:41', avatar: 'A', delay: 0 },
  { id: 2, side: 'right', type: 'text', text: "Can't wait to see you! 🥰", time: '9:42', delay: 0.3, status: 'read' },
  { id: 3, side: 'left', type: 'voice', duration: '0:08', time: '9:43', avatar: 'A', delay: 0.6 },
  { id: 4, side: 'right', type: 'image', time: '9:44', delay: 0.9, status: 'delivered', caption: 'At the airport!' },
  { id: 5, side: 'left', type: 'link', url: 'maps.google.com', title: 'Uganda National Park Guide', desc: 'Everything you need to know about visiting...', time: '9:45', avatar: 'A', delay: 1.2 },
  { id: 6, side: 'right', type: 'text', text: "Meeting at 3pm ✅ See you there!", time: '9:46', delay: 1.5, status: 'read', reaction: '❤️' },
  { id: 7, side: 'left', type: 'text', text: "On my way! 🚗💨", time: '9:47', avatar: 'A', delay: 1.8 },
];

const CONTACTS = [
  { name: 'Amara K.', time: '9:47', preview: 'On my way! 🚗', unread: 2, online: true },
  { name: 'Tech Squad', time: '9:30', preview: 'David: Meeting starts now', unread: 5 },
  { name: 'Sarah M.', time: 'Yesterday', preview: 'Voice message', unread: 0 },
];

function Ticks({ status }) {
  if (status === 'read') return <span className="inline-flex"><FiCheck size={9} className="text-blue-400 -mr-1.5" strokeWidth={3}/><FiCheck size={9} className="text-blue-400" strokeWidth={3}/></span>;
  if (status === 'delivered') return <span className="inline-flex"><FiCheck size={9} className="text-white/50 -mr-1.5" strokeWidth={3}/><FiCheck size={9} className="text-white/50" strokeWidth={3}/></span>;
  return null;
}

function VoiceBars({ animated }) {
  const heights = [3, 5, 4, 7, 5, 3, 6, 4, 5, 3, 6, 5, 4, 7, 5];
  return (
    <div className="flex items-end gap-0.5 h-5">
      {heights.map((h, i) => (
        <motion.div key={i} className="w-0.5 bg-[#25D366] rounded-full"
          animate={animated ? { height: [`${h*2}px`, `${h*3}px`, `${h*2}px`] } : { height: `${h*2}px` }}
          transition={animated ? { duration: 0.6, repeat: Infinity, delay: i * 0.05 } : {}} />
      ))}
    </div>
  );
}

function ChatBubble({ bubble }) {
  const isOwn = bubble.side === 'right';
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: bubble.delay, duration: 0.4, type: 'spring', bounce: 0.3 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}
    >
      {!isOwn && (
        <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[10px] font-bold mr-1.5 flex-shrink-0 mt-auto">
          {bubble.avatar}
        </div>
      )}
      <div className="relative max-w-[75%]">
        <div className={`rounded-xl px-2.5 py-1.5 shadow-sm ${isOwn ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
          {/* Voice note */}
          {bubble.type === 'voice' && (
            <div className="flex items-center gap-2 min-w-[140px] py-0.5">
              <div className="w-7 h-7 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
                <FiMic size={12} className="text-white" />
              </div>
              <VoiceBars animated={true} />
              <span className="text-[10px] text-gray-500 flex-shrink-0">{bubble.duration}</span>
            </div>
          )}
          {/* Image */}
          {bubble.type === 'image' && (
            <div className="rounded-lg overflow-hidden w-32 h-24 relative mb-0.5">
              <div className="w-full h-full bg-gradient-to-br from-orange-300 via-pink-300 to-purple-400 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/70" fill="currentColor" viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
              </div>
              {bubble.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] px-1.5 py-0.5">{bubble.caption}</div>
              )}
            </div>
          )}
          {/* Link preview */}
          {bubble.type === 'link' && (
            <div className="rounded-lg overflow-hidden border border-gray-100 min-w-[190px]">
              <div className="h-16 bg-gradient-to-br from-blue-400 to-teal-500 flex items-center justify-center">
                <svg className="w-8 h-8 text-white/80" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
              </div>
              <div className="p-1.5 bg-gray-50">
                <p className="text-[9px] text-[#25D366] font-semibold">{bubble.url}</p>
                <p className="text-[10px] font-semibold text-gray-800 leading-tight">{bubble.title}</p>
                <p className="text-[9px] text-gray-500 truncate">{bubble.desc}</p>
              </div>
            </div>
          )}
          {/* Text */}
          {bubble.type === 'text' && (
            <p className="text-sm text-gray-800 leading-snug">{bubble.text}</p>
          )}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <span className="text-[9px] text-gray-400">{bubble.time}</span>
            {isOwn && <Ticks status={bubble.status} />}
          </div>
        </div>
        {bubble.reaction && (
          <div className="absolute -bottom-2 right-2 bg-white rounded-full shadow px-1 text-xs border border-gray-100">{bubble.reaction}</div>
        )}
      </div>
    </motion.div>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [formData, setFormData] = useState({ phone_number: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeContact, setActiveContact] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setActiveContact(c => (c + 1) % CONTACTS.length), 4000);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', formData);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.full_name}!`);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen overflow-hidden font-sans">
      {/* ── LEFT: Animated WhatsApp preview ── */}
      <div className="hidden lg:flex flex-col flex-1 bg-[#075E54] relative overflow-hidden select-none">
        {/* Subtle pattern */}
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, rgba(255,255,255,0.07) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(255,255,255,0.05) 0%, transparent 50%)' }} />

        {/* App chrome */}
        <div className="relative z-10 flex flex-col h-full max-w-sm mx-auto w-full px-0">
          {/* Top bar */}
          <div className="bg-[#075E54] px-4 pt-10 pb-2">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-white text-xl font-bold tracking-wide">Bitese</h1>
              <div className="flex items-center gap-1">
                {['Chats','Status','Calls'].map((t, i) => (
                  <span key={t} className={`text-xs px-2 py-1 rounded-full ${i===0 ? 'text-white font-semibold border-b-2 border-[#25D366]' : 'text-white/50'}`}>{t}</span>
                ))}
              </div>
            </div>
            {/* Search bar */}
            <div className="bg-[#128C7E] rounded-full px-3 py-1.5 flex items-center gap-2 mb-2">
              <svg className="w-3.5 h-3.5 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
              <span className="text-white/50 text-xs">Search</span>
            </div>
          </div>

          {/* Contact list */}
          <div className="bg-white/5 flex-shrink-0">
            {CONTACTS.map((c, i) => (
              <motion.div key={i} animate={{ backgroundColor: activeContact === i ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0)' }}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 cursor-pointer">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 relative ${['bg-[#25D366]','bg-purple-500','bg-orange-400'][i]}`}>
                  {c.name[0]}
                  {c.online && <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#075E54]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-white text-sm font-semibold truncate">{c.name}</span>
                    <span className={`text-[10px] ml-2 flex-shrink-0 ${c.unread > 0 ? 'text-[#25D366]' : 'text-white/40'}`}>{c.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/50 text-xs truncate">{c.preview}</span>
                    {c.unread > 0 && <span className="ml-2 w-4 h-4 bg-[#25D366] text-white text-[9px] font-bold rounded-full flex items-center justify-center flex-shrink-0">{c.unread}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Chat window */}
          <div className="flex-1 flex flex-col bg-[#e5ddd5] overflow-hidden min-h-0">
            {/* Chat header */}
            <div className="bg-[#075E54] px-3 py-2 flex items-center gap-3 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-sm">A</div>
              <div className="flex-1">
                <p className="text-white text-sm font-semibold leading-tight">Amara K.</p>
                <p className="text-[#25D366] text-[10px]">online</p>
              </div>
              <div className="flex gap-2 text-white/60">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </div>
            </div>
            {/* Messages */}
            <div className="flex-1 overflow-hidden px-3 py-2 space-y-0.5">
              {BUBBLES.map(b => <ChatBubble key={b.id} bubble={b} />)}
            </div>
            {/* Input bar */}
            <div className="bg-[#f0f2f5] px-2 py-1.5 flex items-center gap-2 flex-shrink-0">
              <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-xs text-gray-400 shadow-sm">Type a message</div>
              <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center shadow">
                <FiMic size={14} className="text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom brand */}
        <div className="relative z-10 text-center pb-4">
          <p className="text-white/30 text-xs">© 2026 Bitese — End-to-end encrypted</p>
        </div>
      </div>

      {/* ── RIGHT: Login form ── */}
      <div className="w-full lg:w-[460px] flex flex-col justify-center bg-white relative overflow-y-auto">
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#075E54] to-[#25D366]"/>
        <div className="px-8 sm:px-12 py-12 max-w-md mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center shadow-lg shadow-green-200">
              <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/></svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bitese</h1>
              <p className="text-gray-400 text-xs">Your world, connected</p>
            </div>
          </div>

          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
            <h2 className="text-3xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-400 mb-8 text-sm">Sign in to continue your conversations</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                <div className="relative">
                  <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={17} />
                  <input type="tel" value={formData.phone_number}
                    onChange={e => setFormData(p => ({ ...p, phone_number: e.target.value }))}
                    placeholder="+256 701 234 567" required
                    className="w-full pl-11 pr-4 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-green-50 transition text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={17} />
                  <input type={showPassword ? 'text' : 'password'} value={formData.password}
                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                    placeholder="Enter your password" required autoComplete="current-password"
                    className="w-full pl-11 pr-12 py-3.5 border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-[#25D366] focus:ring-4 focus:ring-green-50 transition text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <FiEyeOff size={16}/> : <FiEye size={16}/>}
                  </button>
                </div>
              </div>

              <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                type="submit" disabled={loading}
                className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-4 rounded-2xl transition flex items-center justify-center gap-2 text-base shadow-lg shadow-green-100 mt-2">
                {loading
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"/>
                  : <><span>Sign In</span><FiArrowRight size={18}/></>}
              </motion.button>
            </form>

            <div className="flex items-center gap-3 my-6">
              <div className="flex-1 h-px bg-gray-100"/> <span className="text-gray-300 text-sm">or</span> <div className="flex-1 h-px bg-gray-100"/>
            </div>

            <button onClick={() => navigate('/signup')}
              className="w-full border-2 border-gray-200 hover:border-[#25D366] hover:bg-green-50 text-gray-700 font-semibold py-3.5 rounded-2xl transition text-sm flex items-center justify-center gap-2">
              Create a New Account <FiArrowRight size={15} className="text-[#25D366]"/>
            </button>

            <p className="text-center mt-6 text-xs text-gray-400 flex items-center justify-center gap-1.5">
              <svg className="w-3 h-3 text-[#25D366]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
              End-to-end encrypted · Your messages are private
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
