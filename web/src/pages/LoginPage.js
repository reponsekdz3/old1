import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  FiLock, FiArrowRight, FiEye, FiEyeOff,
  FiMic, FiVideo, FiPhone, FiImage, FiFile, FiMapPin,
  FiCheck, FiSmartphone, FiMonitor, FiRefreshCw, FiCamera,
} from 'react-icons/fi';
import PhoneInput from '../components/PhoneInput';
import { registerPushNotifications } from '../services/pushNotifications';

const CONTACTS = [
  { name: 'Amara K.', initial: 'A', color: 'bg-[#25D366]', time: '9:47', preview: 'On my way! 🚗💨', unread: 2, online: true },
  { name: 'Tech Squad', initial: 'T', color: 'bg-purple-500', time: '9:30', preview: 'David: Meeting starts now', unread: 5 },
  { name: 'Sarah M.', initial: 'S', color: 'bg-orange-400', time: 'Yesterday', preview: 'Voice message 🎤', unread: 0 },
  { name: 'James O.', initial: 'J', color: 'bg-blue-500', time: '8:15', preview: '📷 Photo', unread: 1, online: true },
];

const BUBBLES = [
  { id:1, side:'left',  type:'text',     text:"Hey! Just landed in Kampala 🛬",                        time:'9:41', avatar:'A', delay:0 },
  { id:2, side:'right', type:'text',     text:"Can't wait to see you! 🥰",                              time:'9:42', delay:0.25, status:'read' },
  { id:3, side:'left',  type:'voice',    duration:'0:08',                                              time:'9:43', avatar:'A', delay:0.5 },
  { id:4, side:'right', type:'image',    caption:'At the airport!',                                    time:'9:44', delay:0.75, status:'delivered' },
  { id:5, side:'left',  type:'link',     url:'maps.google.com', title:'Uganda National Park Guide',    time:'9:45', avatar:'A', delay:1.0 },
  { id:6, side:'right', type:'text',     text:'Meeting at 3pm ✅ See you there!',                      time:'9:46', delay:1.25, status:'read', reaction:'❤️' },
  { id:7, side:'left',  type:'location', place:'Entebbe Airport, Uganda',                              time:'9:47', avatar:'A', delay:1.5 },
  { id:8, side:'right', type:'text',     text:'On my way! 🚗💨',                                       time:'9:48', delay:1.75, status:'sent' },
];

const STATS = [
  { value:'2M+', label:'Messages daily' },
  { value:'195', label:'Countries' },
  { value:'99.9%', label:'Uptime' },
];

function Ticks({ status }) {
  if (status === 'read') return <span className="inline-flex"><FiCheck size={9} className="text-blue-400 -mr-1.5" strokeWidth={3} /><FiCheck size={9} className="text-blue-400" strokeWidth={3} /></span>;
  if (status === 'delivered') return <span className="inline-flex"><FiCheck size={9} className="text-white/50 -mr-1.5" strokeWidth={3} /><FiCheck size={9} className="text-white/50" strokeWidth={3} /></span>;
  if (status === 'sent') return <FiCheck size={9} className="text-white/50" strokeWidth={3} />;
  return null;
}

function VoiceBars() {
  const heights = [3,5,4,7,5,3,6,4,5,3,6,5,4,7,5];
  return (
    <div className="flex items-end gap-0.5 h-5">
      {heights.map((h,i) => (
        <motion.div key={i} className="w-0.5 bg-[#25D366] rounded-full"
          animate={{ height:[`${h*2}px`,`${h*3}px`,`${h*2}px`] }}
          transition={{ duration:0.6, repeat:Infinity, delay:i*0.05 }} />
      ))}
    </div>
  );
}

function ChatBubble({ bubble }) {
  const isOwn = bubble.side === 'right';
  return (
    <motion.div initial={{ opacity:0, y:10, scale:0.96 }} animate={{ opacity:1, y:0, scale:1 }}
      transition={{ delay:bubble.delay, duration:0.35, type:'spring', bounce:0.25 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1.5`}>
      {!isOwn && <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center text-white text-[10px] font-bold mr-1.5 flex-shrink-0 mt-auto">{bubble.avatar}</div>}
      <div className="relative max-w-[78%]">
        <div className={`rounded-xl px-2.5 py-1.5 shadow-sm text-[11px] ${isOwn ? 'bg-[#DCF8C6] rounded-tr-none' : 'bg-white rounded-tl-none'}`}>
          {bubble.type === 'voice' && <div className="flex items-center gap-2 min-w-[130px] py-0.5"><div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0"><FiMic size={11} className="text-white" /></div><VoiceBars /><span className="text-[9px] text-gray-500">{bubble.duration}</span></div>}
          {bubble.type === 'image' && <div className="rounded-lg overflow-hidden w-28 h-20 relative mb-0.5"><div className="w-full h-full bg-gradient-to-br from-orange-300 via-pink-300 to-purple-400 flex items-center justify-center"><FiImage size={20} className="text-white/70" /></div>{bubble.caption && <div className="absolute bottom-0 inset-x-0 bg-black/40 text-white text-[8px] px-1.5 py-0.5 truncate">{bubble.caption}</div>}</div>}
          {bubble.type === 'link' && <div className="rounded-lg overflow-hidden border border-gray-100 min-w-[170px]"><div className="h-10 bg-gradient-to-br from-blue-400 to-teal-500 flex items-center justify-center"><FiFile size={14} className="text-white/80" /></div><div className="p-1.5 bg-gray-50"><p className="text-[8px] text-[#25D366] font-semibold">{bubble.url}</p><p className="text-[10px] font-semibold text-gray-800 leading-tight">{bubble.title}</p></div></div>}
          {bubble.type === 'location' && <div className="flex items-center gap-2 min-w-[150px] py-0.5"><div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0"><FiMapPin size={11} className="text-white" /></div><div><p className="text-[9px] font-semibold text-gray-700">📍 Location shared</p><p className="text-[8px] text-gray-500 truncate max-w-[110px]">{bubble.place}</p></div></div>}
          {bubble.type === 'text' && <p className="text-gray-800 leading-snug">{bubble.text}</p>}
          <div className="flex items-center justify-end gap-1 mt-0.5"><span className="text-[8px] text-gray-400">{bubble.time}</span>{isOwn && <Ticks status={bubble.status} />}</div>
        </div>
        {bubble.reaction && <div className="absolute -bottom-2 right-2 bg-white rounded-full shadow px-1 text-[10px] border border-gray-100">{bubble.reaction}</div>}
      </div>
    </motion.div>
  );
}

// ── QR Login Panel ──────────────────────────────────────────────────────────
const QR_SESSION_TTL = 120;

function QRLoginPanel() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [sessionId, setSessionId] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | ready | scanning | confirmed | expired | error
  const [secondsLeft, setSecondsLeft] = useState(QR_SESSION_TTL);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const generateSession = useCallback(async () => {
    setStatus('loading');
    setSecondsLeft(QR_SESSION_TTL);
    try {
      const { data } = await api.post('/auth/qr-session/generate');
      setSessionId(data.session_id);
      setStatus('ready');
      startPolling(data.session_id);
      startTimer();
    } catch {
      setStatus('error');
    }
  }, []);

  const startTimer = () => {
    clearInterval(timerRef.current);
    let s = QR_SESSION_TTL;
    timerRef.current = setInterval(() => {
      s -= 1;
      setSecondsLeft(s);
      if (s <= 0) {
        clearInterval(timerRef.current);
        clearInterval(pollRef.current);
        setStatus('expired');
      }
    }, 1000);
  };

  const startPolling = (sid) => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/auth/qr-session/status/${sid}`);
        if (data.status === 'confirmed') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus('confirmed');
          localStorage.setItem('access_token', data.access_token);
          localStorage.setItem('refresh_token', data.refresh_token);
          setUser(data.user);
          toast.success(`Welcome back, ${data.user.full_name}! 👋`);
          navigate('/');
        } else if (data.status === 'expired') {
          clearInterval(pollRef.current);
          clearInterval(timerRef.current);
          setStatus('expired');
        } else if (data.status === 'scanning') {
          setStatus('scanning');
        }
      } catch {}
    }, 2000);
  };

  useEffect(() => {
    generateSession();
    return () => { clearInterval(pollRef.current); clearInterval(timerRef.current); };
  }, []);

  const qrValue = sessionId ? `vipchat://qr-login/${sessionId}` : '';
  const progressPct = (secondsLeft / QR_SESSION_TTL) * 100;

  return (
    <div className="flex flex-col items-center gap-5 py-2">
      {/* QR box */}
      <div className="relative">
        <div className={`w-52 h-52 rounded-2xl border-2 flex items-center justify-center bg-white shadow-lg transition-all ${
          status === 'ready' ? 'border-[#25D366]' :
          status === 'scanning' ? 'border-blue-400' :
          status === 'confirmed' ? 'border-[#25D366]' :
          'border-gray-200'
        }`}>
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 border-3 border-[#25D366] border-t-transparent rounded-full" />
              <span className="text-sm text-gray-400">Generating code…</span>
            </div>
          )}
          {(status === 'ready' || status === 'scanning') && qrValue && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="p-3 relative">
              <QRCodeSVG
                value={qrValue}
                size={172}
                level="H"
                fgColor="#075E54"
                bgColor="#fff"
                includeMargin={false}
                imageSettings={{
                  src: '',
                  x: undefined,
                  y: undefined,
                  height: 0,
                  width: 0,
                  excavate: false,
                }}
              />
              {/* Center logo overlay */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-md border border-gray-100">
                  <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
                  </svg>
                </div>
              </div>
            </motion.div>
          )}
          {status === 'scanning' && (
            <motion.div className="absolute inset-0 rounded-2xl border-4 border-blue-400"
              animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
          )}
          {status === 'confirmed' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', bounce: 0.5 }}
              className="flex flex-col items-center gap-2">
              <div className="w-16 h-16 bg-[#25D366] rounded-full flex items-center justify-center">
                <FiCheck size={32} className="text-white" strokeWidth={3} />
              </div>
              <span className="text-sm font-semibold text-[#25D366]">Logged in!</span>
            </motion.div>
          )}
          {status === 'expired' && (
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                <FiRefreshCw size={22} className="text-gray-400" />
              </div>
              <span className="text-xs text-gray-500">QR code expired</span>
              <button onClick={generateSession}
                className="text-xs font-semibold text-[#25D366] hover:underline">
                Generate new code
              </button>
            </div>
          )}
          {status === 'error' && (
            <div className="flex flex-col items-center gap-3 px-4 text-center">
              <span className="text-xs text-red-400">Failed to generate code</span>
              <button onClick={generateSession} className="text-xs font-semibold text-[#25D366] hover:underline">Retry</button>
            </div>
          )}
        </div>

        {/* Countdown ring */}
        {(status === 'ready' || status === 'scanning') && (
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white border border-gray-200 rounded-full px-3 py-0.5 shadow-sm text-xs text-gray-400">
            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: progressPct > 50 ? '#25D366' : progressPct > 25 ? '#F59E0B' : '#EF4444' }} />
            {secondsLeft}s
          </div>
        )}
      </div>

      {/* Status message */}
      <div className="text-center">
        {status === 'ready' && (
          <>
            <p className="text-sm font-semibold text-gray-700">Scan with VipChat mobile</p>
            <p className="text-xs text-gray-400 mt-0.5">Open VipChat app → QR tab → Web Login</p>
          </>
        )}
        {status === 'scanning' && (
          <motion.p animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}
            className="text-sm font-semibold text-blue-500">
            Confirming login on your phone…
          </motion.p>
        )}
        {status === 'confirmed' && (
          <p className="text-sm font-semibold text-[#25D366]">Redirecting you in…</p>
        )}
      </div>

      {/* Steps */}
      {(status === 'ready' || status === 'scanning') && (
        <div className="w-full space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
          {[
            { icon: FiSmartphone, text: 'Open VipChat on your phone' },
            { icon: FiCamera, text: 'Go to QR tab → Web Login' },
            { icon: FiMonitor, text: 'Scan this QR to log in instantly' },
          ].map((step, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-full bg-[#075E54] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i+1}</div>
              {typeof step.icon === 'string'
                ? <span className="text-sm">{step.icon}</span>
                : <step.icon size={14} className="text-[#075E54] flex-shrink-0" />}
              <span className="text-xs text-gray-600">{step.text}</span>
            </div>
          ))}
        </div>
      )}

      <button onClick={generateSession}
        className="text-xs text-gray-400 hover:text-[#25D366] flex items-center gap-1 transition-colors">
        <FiRefreshCw size={12} />
        Generate new code
      </button>
    </div>
  );
}

// ── Download App Banner ─────────────────────────────────────────────────────
function DownloadAppBanner({ compact }) {
  const DOWNLOAD_URL = window.location.origin + '/download';
  if (compact) {
    return (
      <div className="py-3 flex items-center gap-3">
        <div className="bg-white p-1 rounded-lg border border-gray-100 shadow-sm flex-shrink-0">
          <QRCodeSVG value={DOWNLOAD_URL} size={48} level="M" fgColor="#075E54" bgColor="#fff" includeMargin={false} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-gray-800 mb-1 flex items-center gap-1"><FiSmartphone size={12} /> Get VipChat on your phone</p>
          <div className="flex gap-1.5 flex-wrap">
            <a href="https://apps.apple.com/app/vipchat" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 bg-black text-white rounded-lg px-2 py-1 hover:bg-gray-800 transition text-[10px] font-semibold">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
              App Store
            </a>
            <a href="https://play.google.com/store/apps/details?id=com.vipchat.app" target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 bg-black text-white rounded-lg px-2 py-1 hover:bg-gray-800 transition text-[10px] font-semibold">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current flex-shrink-0"><path d="M3.18 23.76c.3.17.64.24.99.2l12.6-7.17-2.68-2.68-10.91 9.65zM.55 1.12C.2 1.5 0 2.08 0 2.82v18.36c0 .74.2 1.32.55 1.7l.09.09L10.39 12.9v-.22L.64 1.03l-.09.09zM20.5 10.56L17.29 8.7l-3.03 3.03 3.03 3.03L20.5 13.5c.86-.49.86-1.46 0-1.94zM3.18.24l10.91 9.65 2.68-2.68L4.17.04C3.83 0 3.48.07 3.18.24z"/></svg>
              Google Play
            </a>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="mt-6 rounded-2xl border-2 border-dashed border-gray-200 p-5 bg-gradient-to-br from-[#f0fdf4] to-white">
      <div className="flex items-center gap-2 mb-3">
        <FiSmartphone size={16} className="text-[#25D366]" />
        <span className="text-sm font-bold text-gray-800">Get VipChat on your phone</span>
      </div>
      <p className="text-xs text-gray-500 mb-4 leading-relaxed">
        For the best experience with voice notes, calls, and notifications — download the VipChat mobile app.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        {/* App Store */}
        <a href="https://apps.apple.com/app/vipchat" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-black text-white rounded-xl px-3 py-2 hover:bg-gray-900 transition flex-1 justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
          <div>
            <p className="text-[9px] text-gray-300 leading-none">Download on the</p>
            <p className="text-[12px] font-bold leading-none">App Store</p>
          </div>
        </a>
        {/* Play Store */}
        <a href="https://play.google.com/store/apps/details?id=com.vipchat.app" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-black text-white rounded-xl px-3 py-2 hover:bg-gray-900 transition flex-1 justify-center">
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><path d="M3.18 23.76c.3.17.64.24.99.2l12.6-7.17-2.68-2.68-10.91 9.65zM.55 1.12C.2 1.5 0 2.08 0 2.82v18.36c0 .74.2 1.32.55 1.7l.09.09L10.39 12.9v-.22L.64 1.03l-.09.09zM20.5 10.56L17.29 8.7l-3.03 3.03 3.03 3.03L20.5 13.5c.86-.49.86-1.46 0-1.94zM3.18.24l10.91 9.65 2.68-2.68L4.17.04C3.83 0 3.48.07 3.18.24z"/></svg>
          <div>
            <p className="text-[9px] text-gray-300 leading-none">Get it on</p>
            <p className="text-[12px] font-bold leading-none">Google Play</p>
          </div>
        </a>
      </div>

      <div className="flex items-center gap-3">
        <div className="bg-white p-1.5 rounded-xl border border-gray-200 shadow-sm flex-shrink-0">
          <QRCodeSVG
            value={DOWNLOAD_URL}
            size={64}
            level="M"
            fgColor="#075E54"
            bgColor="#fff"
            includeMargin={false}
          />
        </div>
        <div>
          <p className="text-xs font-semibold text-gray-700">Scan QR to download</p>
          <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">
            Point your phone camera at this code to open the download page.
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main Login Page ─────────────────────────────────────────────────────────
export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [activeLoginTab, setActiveLoginTab] = useState('password'); // 'password' | 'qr'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeContact, setActiveContact] = useState(0);
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    const t = setInterval(() => setActiveContact(c => (c+1) % CONTACTS.length), 3500);
    return () => clearInterval(t);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPhoneError(''); setPasswordError('');
    let hasErr = false;
    if (!phone.trim()) { setPhoneError('Phone number is required'); hasErr = true; }
    if (!password) { setPasswordError('Password is required'); hasErr = true; }
    if (hasErr) return;
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        phone_number: phone.replace(/\s/g,''),
        password,
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('refresh_token', data.refresh_token);
      setUser(data.user);
      // Ensure Signal Protocol keys are ready (regenerates if missing)
      try {
        const { ensureKeysReady } = await import('../services/e2ee');
        await ensureKeysReady(api);
      } catch (keyErr) {
        console.warn('[E2EE] ensureKeysReady failed:', keyErr.message);
      }
      toast.success(`Welcome back, ${data.user.full_name}! 👋`);
      registerPushNotifications(data.access_token).catch(() => {});
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      if (msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('phone') || msg.toLowerCase().includes('password')) {
        setPhoneError('Incorrect phone number or password');
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden font-sans">
      {/* LEFT — animated preview */}
      <div className="hidden lg:flex flex-col flex-1 bg-[#075E54] relative overflow-hidden select-none">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage:'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.06) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0%, transparent 50%)'
        }} />
        <div className="relative z-10 flex flex-col h-full max-w-[340px] mx-auto w-full">
          <div className="bg-[#075E54] px-4 pt-7 pb-2 flex-shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h1 className="text-white text-xl font-bold tracking-wide">VipChat</h1>
              <div className="flex gap-0.5">
                {[{label:'Chats',active:true},{label:'Status',active:false},{label:'Calls',active:false}].map(tab => (
                  <span key={tab.label} className={`text-xs px-2 py-1 ${tab.active ? 'text-white font-semibold border-b-2 border-[#25D366]' : 'text-white/40'}`}>{tab.label}</span>
                ))}
              </div>
            </div>
            <div className="bg-[#128C7E] rounded-full px-3 py-1.5 flex items-center gap-2 mb-2">
              <svg className="w-3 h-3 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="text-white/40 text-xs">Search</span>
            </div>
          </div>
          <div className="flex-shrink-0 border-b border-white/10">
            {CONTACTS.map((c,i) => (
              <motion.div key={i} animate={{ backgroundColor: activeContact===i ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0)' }}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5 cursor-pointer transition">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 relative ${c.color}`}>
                  {c.initial}
                  {c.online && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-[#075E54]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-baseline">
                    <span className="text-white text-sm font-semibold truncate">{c.name}</span>
                    <span className={`text-[10px] ml-1.5 flex-shrink-0 ${c.unread>0 ? 'text-[#25D366]' : 'text-white/35'}`}>{c.time}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white/45 text-xs truncate">{c.preview}</span>
                    {c.unread > 0 && <span className="ml-1.5 min-w-[18px] h-[18px] bg-[#25D366] text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 flex-shrink-0">{c.unread}</span>}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="flex-1 flex flex-col bg-[#e5ddd5] overflow-hidden min-h-0">
            <div className="bg-[#075E54] px-3 py-2 flex items-center gap-2.5 flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold text-xs">A</div>
              <div className="flex-1"><p className="text-white text-sm font-semibold leading-none">Amara K.</p><p className="text-[#25D366] text-[9px] mt-0.5">online</p></div>
              <div className="flex gap-1.5 text-white/60"><FiVideo size={14} /><FiPhone size={14} /></div>
            </div>
            <div className="flex-1 overflow-hidden px-2.5 py-2">{BUBBLES.map(b => <ChatBubble key={b.id} bubble={b} />)}</div>
            <div className="bg-[#f0f2f5] px-2 py-1.5 flex items-center gap-1.5 flex-shrink-0">
              <div className="flex-1 bg-white rounded-full px-3 py-1.5 text-[10px] text-gray-400 shadow-sm">Type a message</div>
              <div className="w-7 h-7 bg-[#25D366] rounded-full flex items-center justify-center shadow"><FiMic size={12} className="text-white" /></div>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex-shrink-0 border-t border-white/10 px-6 py-3 flex justify-around">
          {STATS.map((s,i) => (
            <div key={i} className="text-center">
              <p className="text-[#25D366] font-bold text-sm">{s.value}</p>
              <p className="text-white/40 text-[9px]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT — login form */}
      <div className="w-full lg:w-[480px] flex flex-col bg-white relative overflow-hidden">
        <div className="lg:hidden absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#075E54] to-[#25D366]" />
        <div className="px-8 sm:px-10 py-8 max-w-md mx-auto w-full flex-1 overflow-y-auto">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-7">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center shadow-lg shadow-green-200">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">VipChat</h1>
              <p className="text-gray-400 text-xs">Your world, connected</p>
            </div>
          </div>

          {/* Login method tabs */}
          <div className="flex rounded-xl border border-gray-200 overflow-hidden mb-6 bg-gray-50">
            {[
              { key: 'password', label: 'Password Login', icon: FiLock },
              { key: 'qr', label: 'Scan QR Code', icon: null },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveLoginTab(tab.key)}
                className={`flex-1 py-2.5 text-sm font-semibold transition-all ${
                  activeLoginTab === tab.key
                    ? 'bg-white text-[#075E54] shadow-sm border border-gray-200 rounded-xl -m-px'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeLoginTab === 'password' ? (
              <motion.div key="password" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.2 }}>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
                <p className="text-gray-400 mb-5 text-sm">Sign in to continue your conversations</p>

                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                    <PhoneInput value={phone} onChange={setPhone} error={!!phoneError} autoFocus />
                    <AnimatePresence>
                      {phoneError && <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="text-xs text-red-500 mt-1 pl-1">{phoneError}</motion.p>}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                    <div className="relative">
                      <FiLock className="absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]" size={16} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setPasswordError(''); }}
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        className={`w-full pl-11 pr-12 py-3 border-2 rounded-2xl focus:outline-none focus:ring-4 transition text-sm
                          ${passwordError ? 'border-red-300 focus:border-red-400 focus:ring-red-50' : 'border-gray-200 focus:border-[#25D366] focus:ring-green-50'}`}
                      />
                      <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                      </button>
                    </div>
                    <AnimatePresence>
                      {passwordError && <motion.p initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="text-xs text-red-500 mt-1 pl-1">{passwordError}</motion.p>}
                    </AnimatePresence>
                  </div>

                  <motion.button whileHover={{ scale:1.01 }} whileTap={{ scale:0.99 }} type="submit" disabled={loading}
                    className="w-full bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-100 mt-2">
                    {loading
                      ? <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                      : <><span>Sign In</span><FiArrowRight size={17} /></>}
                  </motion.button>
                </form>

                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-gray-300 text-sm">or</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <button onClick={() => navigate('/signup')}
                  className="w-full border-2 border-gray-200 hover:border-[#25D366] hover:bg-green-50 text-gray-700 font-semibold py-3 rounded-2xl transition text-sm flex items-center justify-center gap-2 group">
                  Create a New Account
                  <FiArrowRight size={15} className="text-[#25D366] group-hover:translate-x-0.5 transition-transform" />
                </button>

                <p className="text-center mt-4 text-xs text-gray-400 flex items-center justify-center gap-1.5">
                  <svg className="w-3 h-3 text-[#25D366]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/></svg>
                  End-to-end encrypted · Your messages are private
                </p>
              </motion.div>
            ) : (
              <motion.div key="qr" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.2 }}>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">Scan to Log In</h2>
                <p className="text-gray-400 mb-5 text-sm">Use your phone camera to sign in instantly — no password needed.</p>
                <QRLoginPanel />
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        {/* ── Watch Trends Card ── */}
        <div className="px-8 sm:px-10 pb-3 max-w-md mx-auto w-full">
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => navigate('/trends')}
            className="w-full rounded-2xl overflow-hidden border border-gray-100 shadow-md hover:shadow-lg transition-all group"
          >
            <div className="relative bg-gradient-to-r from-[#0d1117] to-[#1a1f2e] flex items-center gap-4 p-4">
              {/* Animated gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#25D366]/10 via-purple-500/10 to-rose-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              {/* Thumbnail / icon cluster */}
              <div className="relative flex-shrink-0 w-16 h-12">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-rose-500 to-purple-600 flex items-center justify-center shadow-lg">
                  <FiVideo size={22} className="text-white" />
                </div>
                <div className="absolute -bottom-1.5 -right-1.5 w-8 h-6 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow">
                  <FiImage size={12} className="text-white" />
                </div>
                {/* Live pulse dot */}
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[#0d1117]">
                  <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />
                </span>
              </div>
              <div className="flex-1 text-left relative z-10">
                <p className="text-white font-bold text-sm leading-tight flex items-center gap-1.5">
                  Watch VipTrends
                  <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">LIVE</span>
                </p>
                <p className="text-white/50 text-xs mt-0.5">Shorts · Reels · Videos · No login needed</p>
                <div className="flex items-center gap-2 mt-1.5">
                  {['🎵', '🎮', '😂', '🔥'].map((e, i) => (
                    <motion.span key={i} animate={{ y: [0, -2, 0] }} transition={{ repeat: Infinity, delay: i * 0.2, duration: 1.5 }}
                      className="text-sm">{e}</motion.span>
                  ))}
                  <span className="text-white/30 text-[10px] ml-1">& more</span>
                </div>
              </div>
              <div className="flex-shrink-0 relative z-10">
                <div className="w-9 h-9 rounded-full bg-white/10 group-hover:bg-[#25D366]/30 flex items-center justify-center transition-colors">
                  <FiArrowRight size={16} className="text-white group-hover:text-[#25D366] transition-colors" />
                </div>
              </div>
            </div>
          </motion.button>
        </div>

        {/* Download App Banner — always visible, never scrolls away */}
        <div className="border-t border-gray-100 bg-white px-8 sm:px-10 max-w-md mx-auto w-full flex-shrink-0">
          <DownloadAppBanner compact />
        </div>
      </div>
    </div>
  );
}
