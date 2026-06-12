import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
  FiPlus, FiCamera, FiX, FiImage, FiType, FiTrash2, FiEye,
  FiVideo, FiSend, FiMessageCircle, FiFlag, FiExternalLink,
  FiChevronRight, FiZap, FiLink, FiEdit3, FiSmile, FiStar,
  FiSliders, FiBellOff, FiBell, FiChevronDown, FiCheck,
  FiAlignCenter, FiAlignLeft, FiAlignRight, FiUsers, FiLock,
  FiGlobe, FiRefreshCw, FiMusic, FiVolume2, FiVolumeX,
  FiDownload, FiSearch, FiPlay, FiPause, FiLayers,
  FiMapPin, FiCalendar, FiAtSign, FiSun, FiDroplet, FiEyeOff,
  FiCrop, FiFeather, FiBarChart2,
} from 'react-icons/fi';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import toast from 'react-hot-toast';

const REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍', '🔥', '👏', '😍', '🤣'];
const AD_EVERY_N = 5;

const FONTS = [
  { id: 'sans',   label: 'Modern',  style: { fontFamily: '"Inter", sans-serif', fontWeight: 700 } },
  { id: 'serif',  label: 'Classic', style: { fontFamily: '"Georgia", serif', fontWeight: 700 } },
  { id: 'mono',   label: 'Code',    style: { fontFamily: '"Courier New", monospace', fontWeight: 700 } },
  { id: 'cursive',label: 'Cursive', style: { fontFamily: '"Dancing Script", cursive', fontWeight: 700 } },
  { id: 'bold',   label: 'Impact',  style: { fontFamily: '"Impact", sans-serif', fontWeight: 900, letterSpacing: '0.05em' } },
];

const GRADIENTS = [
  { id: 'teal',    label: 'Teal',    value: 'linear-gradient(135deg,#008069,#25D366)' },
  { id: 'ocean',   label: 'Ocean',   value: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)' },
  { id: 'sunset',  label: 'Sunset',  value: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  { id: 'fire',    label: 'Fire',    value: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  { id: 'night',   label: 'Night',   value: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
  { id: 'forest',  label: 'Forest',  value: 'linear-gradient(135deg,#11998e,#38ef7d)' },
  { id: 'rose',    label: 'Rose',    value: 'linear-gradient(135deg,#f953c6,#b91d73)' },
  { id: 'sky',     label: 'Sky',     value: 'linear-gradient(135deg,#2980b9,#6dd5fa,#fff)' },
  { id: 'purple',  label: 'Purple',  value: 'linear-gradient(135deg,#7b2ff7,#f107a3)' },
  { id: 'dark',    label: 'Dark',    value: 'linear-gradient(135deg,#1e1e1e,#2d2d2d)' },
  { id: 'mint',    label: 'Mint',    value: 'linear-gradient(135deg,#00b09b,#96c93d)' },
  { id: 'coral',   label: 'Coral',   value: 'linear-gradient(135deg,#ff6a00,#ee0979)' },
];

const FILTERS = [
  { id: 'none',      label: 'Normal',   css: 'none' },
  { id: 'vivid',     label: 'Vivid',    css: 'saturate(1.8) contrast(1.1)' },
  { id: 'cool',      label: 'Cool',     css: 'hue-rotate(20deg) saturate(1.3)' },
  { id: 'warm',      label: 'Warm',     css: 'sepia(0.3) saturate(1.4) brightness(1.05)' },
  { id: 'bw',        label: 'B&W',      css: 'grayscale(1) contrast(1.1)' },
  { id: 'fade',      label: 'Fade',     css: 'opacity(0.85) brightness(1.1) saturate(0.7)' },
  { id: 'chrome',    label: 'Chrome',   css: 'saturate(2) brightness(0.9) contrast(1.2)' },
  { id: 'dramatic',  label: 'Drama',    css: 'contrast(1.5) brightness(0.85) saturate(1.3)' },
];

const STICKERS = ['🎉','🔥','💯','✨','❤️','🌟','😎','🎊','💪','🌈','🦋','🎵','🍕','⚡','🌸','👑','🎯','💥','🌺','🏆'];
const DURATION_OPTIONS = [
  { label: '6 hours',  hours: 6 },
  { label: '12 hours', hours: 12 },
  { label: '24 hours', hours: 24 },
  { label: '48 hours', hours: 48 },
];

const STORY_TEMPLATES = [
  { id: 'tpl_gm',      label: '☀️ Good Morning', gradient: 'linear-gradient(135deg,#f093fb,#f5576c)',        text: '☀️ Good Morning!',      font: 'bold',    textColor: '#fff' },
  { id: 'tpl_vibe',    label: '✨ Vibin\'',        gradient: 'linear-gradient(135deg,#4facfe,#00f2fe)',        text: '✨ Just Vibin\'',        font: 'sans',    textColor: '#fff' },
  { id: 'tpl_quote',   label: '💬 Quote',          gradient: 'linear-gradient(135deg,#0f2027,#203a43,#2c5364)', text: '"Be yourself."',      font: 'serif',   textColor: '#fff' },
  { id: 'tpl_mood',    label: '🔥 Mood',           gradient: 'linear-gradient(135deg,#f7971e,#ffd200)',        text: '🔥 Mood',               font: 'bold',    textColor: '#333' },
  { id: 'tpl_love',    label: '❤️ Love',           gradient: 'linear-gradient(135deg,#f953c6,#b91d73)',        text: '❤️ Spreading Love',     font: 'cursive', textColor: '#fff' },
  { id: 'tpl_night',   label: '🌙 Night',          gradient: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)', text: '🌙 Night Feels',      font: 'sans',    textColor: '#e0d0ff' },
  { id: 'tpl_nature',  label: '🌿 Nature',         gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',        text: '🌿 In Nature',          font: 'serif',   textColor: '#fff' },
  { id: 'tpl_hype',    label: '🎉 Hype',           gradient: 'linear-gradient(135deg,#ff416c,#ff4b2b)',        text: '🎉 Let\'s Go!',         font: 'bold',    textColor: '#fff' },
  { id: 'tpl_chill',   label: '💙 Chill',          gradient: 'linear-gradient(135deg,#e0c3fc,#8ec5fc)',        text: '💙 Chillin\'',          font: 'cursive', textColor: '#444' },
  { id: 'tpl_hustle',  label: '💼 Hustle',         gradient: 'linear-gradient(135deg,#1e1e1e,#2d2d2d)',        text: '💼 Hustle Mode On',     font: 'mono',    textColor: '#25D366' },
  { id: 'tpl_bday',    label: '🎂 Birthday',       gradient: 'linear-gradient(135deg,#fc5c7d,#6a82fb)',        text: '🎂 Happy Birthday!',    font: 'cursive', textColor: '#fff' },
  { id: 'tpl_workout', label: '💪 Workout',        gradient: 'linear-gradient(135deg,#11998e,#38ef7d)',        text: '💪 Beast Mode',         font: 'bold',    textColor: '#fff' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getFontStyle(fontId) {
  return FONTS.find(f => f.id === fontId)?.style || FONTS[0].style;
}

function getGradientById(id) {
  return GRADIENTS.find(g => g.id === id)?.value || GRADIENTS[0].value;
}

function timeLeft(expiresAt) {
  const h = differenceInHours(new Date(expiresAt), new Date());
  if (h <= 0) return 'Expired';
  if (h < 1) return 'Expiring soon';
  return `${h}h left`;
}

// ─────────────────────────────────────────────────────────────────────────────
// AvatarRing — SVG-segmented ring (like Instagram Stories)
// Each status = one arc segment; unviewed = green/gold, viewed = gray
// ─────────────────────────────────────────────────────────────────────────────
function AvatarRing({ src, name, statuses = [], viewed, isOwn, size = 82, onClick, showPlus, closeFriend }) {
  const initial = name?.[0]?.toUpperCase() || '?';
  const count    = Math.max(isOwn ? 1 : statuses.length, 1);
  const hasNew   = !isOwn && statuses.some(s => !s.viewed);

  const strokeW = hasNew ? 3.5 : 2;
  const pad     = 3;
  const r       = (size / 2) - strokeW / 2 - pad;
  const cx = size / 2;
  const cy = size / 2;
  const circum  = 2 * Math.PI * r;
  const gap     = count > 1 ? Math.min(5, circum * 0.018) : 0;
  const segLen  = (circum - gap * count) / count;
  const gradId  = `rg-${(name || 'u').replace(/[^a-z0-9]/gi, '').slice(0, 6) || 'x'}`;

  const inset = strokeW + pad + 2;

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 focus:outline-none flex-shrink-0 active:scale-95 transition-transform duration-150"
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size} height={size}
          className="absolute inset-0 pointer-events-none"
          style={{
            transform: 'rotate(-90deg)',
            filter: hasNew
              ? `drop-shadow(0 0 6px ${closeFriend ? '#FFD70099' : '#25D36699'})`
              : 'none',
          }}
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%"   stopColor={closeFriend ? '#FFD700' : '#25D366'} />
              <stop offset="100%" stopColor={closeFriend ? '#FFA500' : '#075E54'} />
            </linearGradient>
          </defs>
          {Array.from({ length: count }, (_, i) => {
            const segViewed = isOwn ? false : (statuses[i]?.viewed ?? false);
            return (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={segViewed ? '#d1d5db' : `url(#${gradId})`}
                strokeWidth={strokeW}
                strokeDasharray={`${segLen} ${circum}`}
                strokeDashoffset={-(i * (segLen + gap))}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {/* Avatar photo */}
        <div
          className="absolute rounded-full overflow-hidden bg-gray-200 border-[3px] border-white"
          style={{ inset }}
        >
          {src
            ? <img src={src} alt={name} className="w-full h-full object-cover" />
            : <span
                className="w-full h-full flex items-center justify-center text-white font-bold select-none"
                style={{ fontSize: size * 0.28, background: 'linear-gradient(135deg,#25D366,#075E54)' }}
              >{initial}</span>}
        </div>

        {/* Add (+) badge */}
        {showPlus && (
          <div className="absolute bottom-0.5 right-0.5 w-7 h-7 bg-[#25D366] rounded-full flex items-center justify-center border-[2.5px] border-white shadow-md z-10">
            <FiPlus size={14} className="text-white" />
          </div>
        )}

        {/* Close-friend gold star */}
        {closeFriend && !isOwn && (
          <div className="absolute top-0.5 right-0.5 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border border-white z-10 shadow">
            <FiStar size={9} className="text-white" />
          </div>
        )}
      </div>

      <span className="text-[11px] font-medium text-gray-700 truncate max-w-[80px] text-center leading-tight">
        {isOwn ? 'My Status' : name?.split(' ')[0] || ''}
      </span>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ViewerListModal
// ─────────────────────────────────────────────────────────────────────────────
function ViewerListModal({ statusId, viewerCount, reactionCount, onClose }) {
  const [viewers, setViewers] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [tab, setTab] = useState('views');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [vRes, rRes] = await Promise.all([
          api.get(`/status/${statusId}/viewers`),
          api.get(`/status/${statusId}/reactions`).catch(() => ({ data: { reactions: [] } })),
        ]);
        setViewers(vRes.data.viewers || []);
        setReactions(rRes.data.reactions || []);
      } catch { setViewers([]); }
      finally { setLoading(false); }
    })();
  }, [statusId]);

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-end" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="w-full max-w-lg mx-auto bg-white rounded-t-3xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex gap-4">
            <button onClick={() => setTab('views')}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition ${tab === 'views' ? 'border-[#25D366] text-gray-900' : 'border-transparent text-gray-400'}`}>
              <FiEye size={14} /> {viewerCount} Views
            </button>
            <button onClick={() => setTab('reactions')}
              className={`flex items-center gap-1.5 text-sm font-semibold pb-1 border-b-2 transition ${tab === 'reactions' ? 'border-[#25D366] text-gray-900' : 'border-transparent text-gray-400'}`}>
              ❤️ {reactionCount || 0} Reactions
            </button>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full"><FiX size={18} /></button>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'views' ? (
            viewers.length === 0
              ? <div className="py-10 text-center text-gray-400 text-sm">No viewers yet</div>
              : <div className="divide-y divide-gray-50">
                  {viewers.map(v => (
                    <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                        {v.avatar_url ? <img src={v.avatar_url} alt="" className="w-full h-full object-cover" /> : v.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{v.full_name}</p>
                        {v.viewed_at
          ? <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true })}</p>
          : <p className="text-xs text-gray-300">Viewed</p>}
                      </div>
                    </div>
                  ))}
                </div>
          ) : (
            reactions.length === 0
              ? <div className="py-10 text-center text-gray-400 text-sm">No reactions yet</div>
              : <div className="divide-y divide-gray-50">
                  {reactions.map(r => (
                    <div key={r.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                        {r.user_avatar ? <img src={r.user_avatar} alt="" className="w-full h-full object-cover" /> : r.user_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{r.user_name}</p>
                      </div>
                      <span className="text-2xl">{r.emoji}</span>
                    </div>
                  ))}
                </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ReportAdModal
// ─────────────────────────────────────────────────────────────────────────────
function ReportAdModal({ campaignId, onClose }) {
  const [reason, setReason] = useState('spam');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    setSending(true);
    try {
      await api.post('/ads/report', { campaign_id: campaignId, reason });
      toast.success('Ad reported. Thank you!');
      onClose();
    } catch { toast.error('Failed to report'); }
    finally { setSending(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900">Report Ad</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full"><FiX size={16} /></button>
        </div>
        <div className="space-y-2 mb-4">
          {['spam', 'offensive', 'misleading', 'malware', 'other'].map(r => (
            <label key={r} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#25D366]" />
              <span className="text-sm text-gray-700 capitalize">{r}</span>
            </label>
          ))}
        </div>
        <button onClick={submit} disabled={sending}
          className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition">
          {sending ? 'Sending…' : 'Submit Report'}
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdSlide
// ─────────────────────────────────────────────────────────────────────────────
function AdSlide({ ad, onSkip, onAdvance }) {
  const [showReport, setShowReport] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const autoRef = useRef(null);
  const impressionSentRef = useRef(false);
  const tokenRef = useRef(ad?.ad_token);
  const sendImpression = useCallback((skipped) => {
    if (impressionSentRef.current || !ad?.id) return;
    impressionSentRef.current = true;
    api.post('/ads/impression', { campaign_id: ad.id, ad_token: tokenRef.current, skipped }).catch(() => {});
  }, [ad?.id]);
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  useEffect(() => {
    autoRef.current = setTimeout(() => { sendImpression(false); onAdvance(); }, 8000);
    return () => clearTimeout(autoRef.current);
  }, [onAdvance, sendImpression]);
  if (!ad) return null;
  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="absolute top-20 left-4 z-20 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase">Sponsored</div>
      <button onClick={countdown > 0 ? undefined : () => { clearTimeout(autoRef.current); sendImpression(true); onSkip(); }}
        className={`absolute top-20 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition ${countdown > 0 ? 'bg-black/40 text-white/60 cursor-default' : 'bg-white text-gray-900 hover:bg-white/90'}`}>
        {countdown > 0 ? `Skip in ${countdown}s` : 'Skip ›'}
      </button>
      <div className="flex-1 relative overflow-hidden">
        {ad.creative_url ? <img src={ad.creative_url} alt="ad" className="w-full h-full object-cover" />
          : <div className="w-full h-full bg-gradient-to-br from-[#075E54] to-[#128C7E] flex items-center justify-center px-8">
              <p className="text-white text-2xl font-bold text-center">{ad.ad_copy}</p>
            </div>}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
      <div className="flex-shrink-0 px-5 pt-3 pb-6 bg-black/80">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex-shrink-0">
            {ad.sponsor_avatar ? <img src={ad.sponsor_avatar} alt="" className="w-full h-full object-cover" />
              : <span className="text-white text-xs font-bold flex items-center justify-center h-full">{ad.sponsor_name?.[0]}</span>}
          </div>
          <div>
            <p className="text-white font-semibold text-xs">{ad.sponsor_name}</p>
            <p className="text-white/50 text-[10px]">Sponsored</p>
          </div>
          <button onClick={() => setShowReport(true)} className="ml-auto p-1.5 bg-black/40 rounded-full text-white/60"><FiFlag size={12} /></button>
        </div>
        {ad.cta_url && (
          <button onClick={async () => { try { const { data } = await api.post('/ads/click', { campaign_id: ad.id, ad_token: tokenRef.current }); if (data.redirect_url) window.open(data.redirect_url, '_blank', 'noopener'); } catch {} }}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl text-sm transition">
            <FiExternalLink size={15} />{ad.cta_text || 'Learn More'}
          </button>
        )}
      </div>
      {showReport && <ReportAdModal campaignId={ad.id} onClose={() => setShowReport(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// StatusViewer — immersive full-screen story viewer (advanced)
// ─────────────────────────────────────────────────────────────────────────────
function StatusViewer({ statusGroup, onClose, isOwn, allGroups = [], currentGroupIdx = 0, onNextGroup, onPrevGroup }) {
  const { user } = useAuthStore();
  const items = useMemo(() => statusGroup?.statuses || [statusGroup], [statusGroup]);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [myReaction, setMyReaction] = useState(items[0]?.my_reaction || null);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [adData, setAdData] = useState(null);
  const [showAd, setShowAd] = useState(false);
  const [muted, setMuted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [hearts, setHearts] = useState([]);        // flying ❤️ for double-tap
  const [dragY, setDragY] = useState(0);
  const pendingNextIdx = useRef(null);
  const adShownRef = useRef(false);
  const swipeStartRef = useRef(null);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const reactionTimeoutRef = useRef(null);
  const lastTapRef = useRef(0);
  const holdTimerRef = useRef(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef(null);

  const current = items[idx];
  const isVideo = !!(current?.media_url && (current?.media_type === 'video' || /\.(mp4|webm|mov)/i.test(current?.media_url || '')));
  const DURATION = isVideo ? null : 6000;
  const [liveViewCount, setLiveViewCount] = useState(current?.viewers_count || 0);

  useEffect(() => {
    api.get('/ads/feed').then(({ data }) => { if (data?.ad) setAdData(data.ad); }).catch(() => {});
  }, []);

  useEffect(() => { setMyReaction(current?.my_reaction || null); }, [current]);

  // Video mute sync
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  // Auto-play music
  useEffect(() => {
    if (current?.music_url && musicRef.current) {
      musicRef.current.src = current.music_url;
      musicRef.current.play().then(() => setMusicPlaying(true)).catch(() => {});
    }
    return () => { if (musicRef.current) { musicRef.current.pause(); musicRef.current.src = ''; setMusicPlaying(false); } };
  }, [idx, current]);

  const afterAd = useCallback(() => {
    setShowAd(false); setShowReactions(false); setShowReply(false);
    const nextIdx = pendingNextIdx.current;
    pendingNextIdx.current = null;
    if (nextIdx === null) return;
    if (nextIdx < items.length) setIdx(nextIdx);
    else { if (onNextGroup) onNextGroup(); else onClose(); }
  }, [items.length, onNextGroup, onClose]);

  const advance = useCallback(() => {
    setShowReactions(false); setShowReply(false); setShowMenu(false);
    const nextIdx = idx + 1;
    if (nextIdx % AD_EVERY_N === 0 && adData && !adShownRef.current) {
      adShownRef.current = true; pendingNextIdx.current = nextIdx; setShowAd(true); return;
    }
    if (nextIdx < items.length) setIdx(nextIdx);
    else { if (onNextGroup) onNextGroup(); else onClose(); }
  }, [idx, items.length, onClose, adData, onNextGroup]);

  useEffect(() => {
    if (paused || isVideo || showAd || showReply || showMenu) return;
    timerRef.current = setTimeout(advance, DURATION || 6000);
    return () => clearTimeout(timerRef.current);
  }, [idx, paused, isVideo, advance, DURATION, showAd, showReply, showMenu]);

  useEffect(() => {
    if (current?.id && !isOwn) {
      api.post(`/status/${current.id}/view`)
        .then(({ data }) => { if (data?.viewers_count !== undefined) setLiveViewCount(data.viewers_count); })
        .catch(() => {});
    }
    if (isOwn && current?.id) setLiveViewCount(current.viewers_count || 0);
  }, [current?.id, isOwn]);

  useEffect(() => {
    if (!isOwn || !current?.id) return;
    const t = setInterval(() => {
      api.get(`/status/${current.id}/viewers`).then(({ data }) => {
        if (data.count !== undefined) setLiveViewCount(data.count);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [isOwn, current?.id]);

  useEffect(() => {
    if (videoRef.current) { videoRef.current.currentTime = 0; videoRef.current.play().catch(() => {}); }
  }, [idx]);

  const goBack = () => { setShowAd(false); if (idx > 0) setIdx(i => i - 1); else { if (onPrevGroup) onPrevGroup(); else onClose(); } };

  const deleteStatus = async () => {
    if (!window.confirm('Delete this status?')) return;
    try { await api.delete(`/status/${current.id}`); toast.success('Status deleted'); if (items.length <= 1) onClose(); else advance(); }
    catch { toast.error('Failed to delete'); }
  };

  const sendReaction = async (emoji) => {
    if (!current?.id) return;
    clearTimeout(reactionTimeoutRef.current);
    setMyReaction(emoji); setShowReactions(false);
    try { await api.post(`/status/${current.id}/react`, { emoji }); } catch { }
    reactionTimeoutRef.current = setTimeout(advance, 1200);
  };

  // Double-tap to react with ❤️ burst
  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX || e.touches?.[0]?.clientX || rect.width / 2) - rect.left;
      const y = (e.clientY || e.touches?.[0]?.clientY || rect.height / 2) - rect.top;
      const id = now;
      setHearts(h => [...h, { id, x, y }]);
      setTimeout(() => setHearts(h => h.filter(hh => hh.id !== id)), 1200);
      if (!isOwn) sendReaction('❤️');
      if (navigator.vibrate) navigator.vibrate(40);
    }
    lastTapRef.current = now;
  };

  const sendReply = async () => {
    if (!replyText.trim() || !statusGroup?.user_id) return;
    setReplySending(true);
    try {
      await api.post('/messages', {
        receiver_id: statusGroup.user_id,
        content: `↩ Re: status\n"${current?.content?.slice(0, 60) || '📸 Photo'}"\n\n${replyText.trim()}`,
      });
      toast.success('Reply sent!'); setReplyText(''); setShowReply(false);
    } catch { toast.error('Failed to send reply'); }
    finally { setReplySending(false); }
  };

  const saveMedia = () => {
    if (!current?.media_url) return;
    const a = document.createElement('a');
    a.href = current.media_url;
    a.download = `status_${current.id}.${isVideo ? 'mp4' : 'jpg'}`;
    a.click();
  };

  const copyLink = () => {
    if (current?.link_url) { navigator.clipboard.writeText(current.link_url).then(() => toast.success('Link copied!')); }
    else { toast('No link in this status'); }
  };

  // Touch handling — swipe down to close, left/right for next/prev group
  const handleTouchStart = (e) => {
    swipeStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    holdTimerRef.current = setTimeout(() => setPaused(true), 150);
  };
  const handleTouchMove = (e) => {
    if (!swipeStartRef.current) return;
    const dy = e.touches[0].clientY - swipeStartRef.current.y;
    if (dy > 0) setDragY(Math.min(dy * 0.6, 120));
  };
  const handleTouchEnd = (e) => {
    clearTimeout(holdTimerRef.current);
    setPaused(false);
    setDragY(0);
    if (!swipeStartRef.current) return;
    const dx = e.changedTouches[0].clientX - swipeStartRef.current.x;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    const dt = Date.now() - swipeStartRef.current.t;
    swipeStartRef.current = null;
    if (dy > 100 && dt < 500 && Math.abs(dx) < 60) { onClose(); return; }
    if (Math.abs(dx) > 80 && dt < 400 && Math.abs(dy) < 60) {
      if (dx < 0) { if (onNextGroup) onNextGroup(); else onClose(); }
      else { if (onPrevGroup) onPrevGroup(); }
    }
  };

  const fontStyle = getFontStyle(current?.font_style);
  const reactionSummary = current?.reactions || {};
  const totalReactions = Object.values(reactionSummary).reduce((a, b) => a + b, 0);

  const mediaTypeBadge = isVideo ? '🎬' : current?.media_type === 'link' ? '🔗' : current?.media_url ? '📷' : '💬';

  if (showAd) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-50 flex flex-col select-none">
        <div className="flex gap-1 px-3 pt-10 pb-2 z-10">
          {items.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full w-full" />
            </div>
          ))}
          <div className="flex-1 h-[3px] bg-[#25D366]/40 rounded-full overflow-hidden">
            <motion.div className="h-full bg-[#25D366] rounded-full" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: 8, ease: 'linear' }} />
          </div>
        </div>
        <AdSlide ad={adData} onSkip={afterAd} onAdvance={afterAd} />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1, y: dragY }}
      exit={{ opacity: 0, scale: 0.95, y: 60 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 bg-black z-50 flex flex-col select-none overflow-hidden"
      style={{ borderRadius: dragY > 20 ? `${Math.min(dragY / 3, 24)}px` : 0 }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      <audio ref={musicRef} loop style={{ display: 'none' }} />

      {/* Top gradient overlay for legibility */}
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none z-[5]" />

      {/* Progress bars */}
      <div className="flex gap-[3px] px-3 pt-safe pt-11 pb-1 z-10 relative">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-[3.5px] bg-white/20 rounded-full overflow-hidden">
            <motion.div
              key={`bar-${idx}-${i}`}
              className="h-full rounded-full"
              style={{ background: i < idx ? 'rgba(255,255,255,0.9)' : 'linear-gradient(90deg,#25D366 0%,#fff 100%)' }}
              initial={{ width: i < idx ? '100%' : '0%' }}
              animate={{ width: i <= idx ? '100%' : '0%' }}
              transition={
                i === idx && !paused && !isVideo
                  ? { duration: (DURATION || 6000) / 1000, ease: 'linear' }
                  : { duration: 0.1 }
              }
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pb-3 z-10 relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-teal-600 flex-shrink-0 ring-2 ring-white/20">
          {statusGroup?.owner_avatar
            ? <img src={statusGroup.owner_avatar} alt="" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{statusGroup?.owner_name?.[0] || '?'}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-white font-semibold text-sm leading-tight">{statusGroup?.owner_name || (isOwn ? 'My Status' : 'Unknown')}</p>
            <span className="text-[10px] bg-white/15 rounded px-1 py-0.5 text-white/70">{mediaTypeBadge}</span>
            {statusGroup?.is_close_friend && (
              <span className="text-[10px] bg-yellow-400/30 text-yellow-300 rounded px-1 py-0.5 font-medium">⭐ Close</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-white/55 text-xs">
              {current?.created_at ? formatDistanceToNow(new Date(current.created_at), { addSuffix: true }) : ''}
            </p>
            {current?.expires_at && <span className="text-white/35 text-[10px]">· {timeLeft(current.expires_at)}</span>}
          </div>
        </div>
        {current?.music_name && (
          <div className="flex items-center gap-1 bg-white/12 rounded-full px-2 py-1 border border-white/10">
            <FiMusic size={10} className={`text-white/80 ${musicPlaying ? 'animate-pulse' : ''}`} />
            <span className="text-white/70 text-[10px] max-w-[70px] truncate">{current.music_name}</span>
          </div>
        )}
        {isVideo && (
          <button onClick={() => setMuted(v => !v)} className="p-1.5 hover:bg-white/15 rounded-full transition">
            {muted
              ? <FiVolumeX size={17} className="text-white/70" />
              : <FiVolume2 size={17} className="text-white/70" />}
          </button>
        )}
        {/* 3-dot menu */}
        <div className="relative">
          <button onClick={() => { setPaused(true); setShowMenu(v => !v); }}
            className="p-2 hover:bg-white/15 rounded-full transition">
            <span className="text-white/80 text-lg leading-none">⋮</span>
          </button>
          <AnimatePresence>
            {showMenu && (
              <motion.div initial={{ opacity: 0, scale: 0.9, y: -5 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-30 min-w-[180px] overflow-hidden">
                {isOwn && current?.media_url && (
                  <button onClick={() => { saveMedia(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition text-sm text-white/90">
                    <FiDownload size={15} className="text-[#25D366]" /> Save to Device
                  </button>
                )}
                {current?.link_url && (
                  <button onClick={() => { copyLink(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition text-sm text-white/90">
                    <FiExternalLink size={15} className="text-blue-400" /> Copy Link
                  </button>
                )}
                {isOwn && (
                  <button onClick={() => { deleteStatus(); setShowMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition text-sm text-red-400">
                    <FiTrash2 size={15} /> Delete Status
                  </button>
                )}
                {!isOwn && (
                  <button onClick={() => { toast('Report submitted'); setShowMenu(false); setPaused(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition text-sm text-red-400">
                    <FiFlag size={15} /> Report
                  </button>
                )}
                <button onClick={() => { setShowMenu(false); setPaused(false); }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/8 transition text-sm text-white/40">
                  <FiX size={15} /> Cancel
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/15 rounded-full transition">
          <FiX size={21} className="text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden"
        onClick={handleDoubleTap}>
        {isVideo && current?.media_url ? (
          <video ref={videoRef} src={current.media_url} autoPlay playsInline muted={muted}
            className="w-full h-full object-contain" onEnded={advance} />
        ) : current?.media_url && current?.media_type !== 'link' ? (
          <img src={current.media_url} alt="status" className="w-full h-full object-contain" draggable={false} />
        ) : current?.media_type === 'link' ? (
          <div className="w-full h-full flex items-center justify-center px-6"
            style={{ background: current.background_color?.includes('gradient') ? current.background_color : 'linear-gradient(135deg,#075E54,#128C7E)' }}>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl overflow-hidden w-full max-w-sm shadow-2xl border border-white/10">
              {current.link_image && <img src={current.link_image} alt="" className="w-full h-40 object-cover" />}
              <div className="p-4">
                {current.link_title && <p className="text-white font-bold text-base mb-1.5 leading-tight">{current.link_title}</p>}
                {current.link_description && <p className="text-white/65 text-sm mb-3 line-clamp-2">{current.link_description}</p>}
                <a href={current.link_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#25D366] text-sm font-semibold">
                  <FiExternalLink size={14} />
                  {(() => { try { return new URL(current.link_url || 'https://x').hostname; } catch { return current.link_url; } })()}
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center px-8"
            style={{ background: current?.background_color?.includes('gradient') ? current.background_color : current?.background_color || '#008069' }}>
            <p style={{
              ...fontStyle,
              color: current?.text_color || '#ffffff',
              textAlign: current?.text_align || 'center',
              fontSize: 'clamp(20px, 5vw, 38px)',
              textShadow: '0 2px 12px rgba(0,0,0,0.4)',
              lineHeight: 1.35,
            }}>
              {current?.content || ''}
            </p>
          </div>
        )}

        {/* Caption overlay on media */}
        {(current?.media_url && current?.media_type !== 'link') && current?.content && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-24 pt-12 pointer-events-none">
            <p className="text-white text-base font-medium text-center leading-snug drop-shadow">{current.content}</p>
          </div>
        )}

        {/* Sticker overlays from status data */}
        {current?.stickers?.map((s, i) => (
          <div key={i} className="absolute text-3xl pointer-events-none" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)' }}>
            {s.emoji}
          </div>
        ))}

        {/* Tap zones — left go back, right advance */}
        <div className="absolute inset-0 flex" style={{ top: 80, bottom: 80 }}>
          <div className="w-1/3 h-full" onClick={(e) => { e.stopPropagation(); goBack(); }}
            onPointerDown={() => { holdTimerRef.current = setTimeout(() => setPaused(true), 200); }}
            onPointerUp={() => { clearTimeout(holdTimerRef.current); setPaused(false); }}
            onPointerLeave={() => { clearTimeout(holdTimerRef.current); setPaused(false); }} />
          <div className="flex-1 h-full" />
          <div className="w-1/3 h-full"
            onClick={(e) => { e.stopPropagation(); if (!showReactions && !showMenu) advance(); }}
            onPointerDown={() => { holdTimerRef.current = setTimeout(() => setPaused(true), 200); }}
            onPointerUp={() => { clearTimeout(holdTimerRef.current); setPaused(false); }}
            onPointerLeave={() => { clearTimeout(holdTimerRef.current); setPaused(false); }} />
        </div>

        {/* Pause overlay */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[6]">
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur flex items-center justify-center">
              <span className="text-white text-3xl">⏸</span>
            </div>
          </div>
        )}

        {/* Flying ❤️ hearts from double-tap */}
        {hearts.map(h => (
          <motion.div key={h.id}
            initial={{ opacity: 1, scale: 0.5, x: h.x - 24, y: h.y - 24 }}
            animate={{ opacity: 0, scale: 2, y: h.y - 120 }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
            className="absolute text-5xl pointer-events-none z-20">
            ❤️
          </motion.div>
        ))}

        {/* Reaction picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div initial={{ opacity: 0, y: 24, scale: 0.88 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.88 }}
              className="absolute bottom-24 left-1/2 -translate-x-1/2 flex gap-1 bg-black/85 backdrop-blur-md rounded-full px-4 py-3 z-20 shadow-2xl border border-white/10">
              {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)}
                  className={`text-[26px] transition-all hover:scale-130 active:scale-110 ${myReaction === emoji ? 'scale-125 drop-shadow-lg' : ''}`}>
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* My reaction badge */}
        {myReaction && !showReactions && (
          <motion.div key={myReaction} initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
            className="absolute bottom-28 right-5 text-4xl z-20 pointer-events-none drop-shadow-lg">{myReaction}</motion.div>
        )}

        {/* Reaction summary */}
        {totalReactions > 0 && !isOwn && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="absolute top-5 right-4 bg-black/55 backdrop-blur rounded-full px-2.5 py-1 flex items-center gap-0.5 z-10">
            {Object.entries(reactionSummary).slice(0, 3).map(([emoji, count]) => (
              <span key={emoji} className="text-sm">{emoji}
                {count > 1 && <span className="text-white/60 text-[10px] ml-0.5">{count}</span>}
              </span>
            ))}
          </motion.div>
        )}
      </div>

      {/* Bottom gradient overlay */}
      <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black/70 to-transparent pointer-events-none z-[4]" />

      {/* Reply input */}
      <AnimatePresence>
        {showReply && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-black/90 backdrop-blur-sm border-t border-white/8 flex-shrink-0 z-20">
            <input autoFocus type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendReply(); if (e.key === 'Escape') setShowReply(false); }}
              placeholder={`Reply to ${statusGroup?.owner_name}…`}
              className="flex-1 bg-white/10 text-white placeholder-white/35 rounded-full px-4 py-2.5 text-sm outline-none border border-white/15 focus:border-[#25D366]/60 transition" />
            <button onClick={sendReply} disabled={!replyText.trim() || replySending}
              className="w-10 h-10 flex items-center justify-center bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 rounded-full transition">
              <FiSend size={16} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom action bar */}
      {!showReply && (
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0 z-10 relative">
          {isOwn ? (
            <>
              <button onClick={() => { setPaused(true); setShowViewers(true); }}
                className="flex items-center gap-1.5 text-white/75 hover:text-white transition bg-white/8 hover:bg-white/15 rounded-full px-3 py-2">
                <FiEye size={16} />
                <span className="text-sm font-medium">{liveViewCount} view{liveViewCount !== 1 ? 's' : ''}</span>
              </button>
              {totalReactions > 0 && (
                <button onClick={() => { setPaused(true); setShowViewers(true); }}
                  className="flex items-center gap-1 text-white/70 hover:text-white transition bg-white/8 hover:bg-white/15 rounded-full px-3 py-2">
                  {Object.entries(reactionSummary).slice(0, 3).map(([e]) => <span key={e} className="text-sm">{e}</span>)}
                  <span className="text-xs text-white/60 ml-0.5">{totalReactions}</span>
                </button>
              )}
              {current?.media_url && (
                <button onClick={saveMedia} className="ml-auto p-2 hover:bg-white/15 rounded-full transition">
                  <FiDownload size={18} className="text-white/70" />
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setPaused(true); setShowReactions(v => !v); }}
                className={`flex items-center gap-1.5 text-lg px-3 py-2 rounded-full transition border ${showReactions ? 'bg-white/20 border-white/30 text-white' : 'border-white/10 text-white/70 hover:border-white/25 hover:text-white'}`}>
                {myReaction || '😊'}
                <span className="text-xs text-white/60 font-medium">React</span>
              </button>
              <button onClick={() => { setPaused(true); setShowReply(v => !v); setShowReactions(false); }}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition border border-white/10 hover:border-white/25 rounded-full px-3 py-2">
                <FiMessageCircle size={16} /><span>Reply</span>
              </button>
            </>
          )}
          <span className="ml-auto text-white/35 text-xs font-medium">{idx + 1} / {items.length}</span>
        </div>
      )}

      <AnimatePresence>
        {showViewers && current?.id && (
          <ViewerListModal
            statusId={current.id}
            viewerCount={liveViewCount}
            reactionCount={totalReactions}
            onClose={() => { setShowViewers(false); setPaused(false); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UploadProgressBar
// ─────────────────────────────────────────────────────────────────────────────
function UploadProgressBar({ progress, label }) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <span className="text-white/70 text-xs font-medium">{label}</span>
        <span className="text-white font-bold text-xs">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
        <motion.div className="h-full bg-[#25D366] rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DrawingCanvas
// ─────────────────────────────────────────────────────────────────────────────
function DrawingCanvas({ onSave, onClose }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState('#FFD700');
  const [brushSize, setBrushSize] = useState(4);
  const [tool, setTool] = useState('pen');
  const lastPos = useRef(null);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    setDrawing(true);
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, (tool === 'eraser' ? brushSize * 3 : brushSize) / 2, 0, Math.PI * 2);
    ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    else ctx.globalCompositeOperation = 'source-over';
    ctx.fill();
  };

  const draw = (e) => {
    e.preventDefault();
    if (!drawing || !lastPos.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color;
    ctx.lineWidth = tool === 'eraser' ? brushSize * 3 : brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (tool === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    else ctx.globalCompositeOperation = 'source-over';
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { setDrawing(false); lastPos.current = null; };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const saveDrawing = () => {
    const dataUrl = canvasRef.current.toDataURL('image/png');
    onSave(dataUrl);
  };

  const brushColors = ['#FFD700', '#FF4444', '#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#00BCD4', '#FFFFFF', '#000000'];

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-black/20">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-black/70 backdrop-blur-sm flex-shrink-0">
        <button onClick={() => setTool('pen')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tool === 'pen' ? 'bg-white text-gray-900' : 'text-white/70'}`}>✏️ Pen</button>
        <button onClick={() => setTool('eraser')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${tool === 'eraser' ? 'bg-white text-gray-900' : 'text-white/70'}`}>⬜ Erase</button>
        <input type="range" min={2} max={20} value={brushSize} onChange={e => setBrushSize(Number(e.target.value))}
          className="w-16 accent-[#25D366]" />
        <div className="flex gap-1 overflow-x-auto">
          {brushColors.map(c => (
            <button key={c} onClick={() => { setColor(c); setTool('pen'); }}
              className={`w-6 h-6 rounded-full flex-shrink-0 border-2 transition ${color === c && tool === 'pen' ? 'border-white scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c }} />
          ))}
        </div>
        <button onClick={clearCanvas} className="ml-auto text-white/60 hover:text-white text-xs">Clear</button>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} width={window.innerWidth} height={window.innerHeight - 160}
        className="flex-1 cursor-crosshair touch-none"
        onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
        onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
      />

      {/* Actions */}
      <div className="flex gap-3 px-4 py-3 bg-black/70 flex-shrink-0">
        <button onClick={onClose} className="flex-1 py-2.5 border border-white/30 text-white rounded-xl font-semibold text-sm">Cancel</button>
        <button onClick={saveDrawing} className="flex-1 py-2.5 bg-[#25D366] text-white rounded-xl font-semibold text-sm">Done</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MusicPickerModal — attach background music to a status
// ─────────────────────────────────────────────────────────────────────────────
const PRESET_TRACKS = [
  { title: 'Happy Vibes',    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Chill Waves',    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Upbeat Flow',    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Smooth Jazz',    url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: 'Electric Pop',   url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

// ─────────────────────────────────────────────────────────────────────────────
// TemplatePickerModal — story templates
// ─────────────────────────────────────────────────────────────────────────────
function TemplatePickerModal({ onSelect, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="w-full max-w-lg bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 pb-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <p className="font-bold text-white text-base">Story Templates</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <FiX size={14} className="text-white/60" />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 px-5 max-h-80 overflow-y-auto">
          {STORY_TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => onSelect(tpl)}
              className="aspect-[9/16] rounded-2xl flex items-center justify-center text-center p-2 relative overflow-hidden border-2 border-white/10 hover:border-[#25D366] hover:scale-105 transition-all"
              style={{ background: tpl.gradient }}>
              <span className="text-xs font-black leading-tight relative z-10 drop-shadow-md"
                style={{ color: tpl.textColor, fontFamily: tpl.font === 'serif' ? 'Georgia,serif' : tpl.font === 'mono' ? 'monospace' : tpl.font === 'cursive' ? '"Dancing Script",cursive' : 'inherit' }}>
                {tpl.text}
              </span>
            </button>
          ))}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PollCreatorModal — interactive poll sticker for status
// ─────────────────────────────────────────────────────────────────────────────
function PollCreatorModal({ onAttach, onClose }) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [pollType, setPollType] = useState('poll'); // poll | qa

  const addOption = () => { if (options.length < 4) setOptions(o => [...o, '']); };
  const removeOption = (i) => { if (options.length > 2) setOptions(o => o.filter((_, idx) => idx !== i)); };
  const setOption = (i, v) => setOptions(o => o.map((x, idx) => idx === i ? v : x));

  const submit = () => {
    if (!question.trim()) { toast.error('Enter a question'); return; }
    if (pollType === 'poll' && options.filter(o => o.trim()).length < 2) {
      toast.error('Add at least 2 options'); return;
    }
    onAttach({ question: question.trim(), options: options.filter(o => o.trim()), type: pollType });
    onClose();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 280 }}
        className="w-full max-w-lg bg-[#1a1a1a] rounded-t-3xl border-t border-white/10 pb-8"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4">
          <p className="font-bold text-white text-base">Interactive Sticker</p>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
            <FiX size={14} className="text-white/60" />
          </button>
        </div>
        <div className="px-5 space-y-4">
          <div className="flex gap-2">
            {[{id:'poll',label:'📊 Poll'},{id:'qa',label:'❓ Q&A'}].map(t => (
              <button key={t.id} onClick={() => setPollType(t.id)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition border ${pollType === t.id ? 'bg-[#25D366] text-white border-[#25D366]' : 'border-white/15 text-white/60 hover:text-white'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div>
            <input value={question} onChange={e => setQuestion(e.target.value)}
              placeholder={pollType === 'poll' ? 'Ask a question…' : 'What do you want to know?'}
              className="w-full bg-white/8 border border-white/10 focus:border-[#25D366]/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition placeholder-white/30" />
          </div>
          {pollType === 'poll' && (
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/50 text-xs font-bold flex-shrink-0">{i + 1}</div>
                  <input value={opt} onChange={e => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className="flex-1 bg-white/8 border border-white/10 focus:border-[#25D366]/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition placeholder-white/30" />
                  {options.length > 2 && (
                    <button onClick={() => removeOption(i)} className="w-7 h-7 rounded-full bg-white/8 hover:bg-red-500/20 flex items-center justify-center text-white/40 hover:text-red-400 transition">
                      <FiX size={12} />
                    </button>
                  )}
                </div>
              ))}
              {options.length < 4 && (
                <button onClick={addOption}
                  className="w-full py-2.5 border border-dashed border-white/20 hover:border-[#25D366]/50 rounded-xl text-white/40 hover:text-[#25D366] text-sm transition flex items-center justify-center gap-2">
                  <FiPlus size={14} /> Add option
                </button>
              )}
            </div>
          )}
          {pollType === 'qa' && (
            <div className="bg-white/5 rounded-xl p-3 text-white/40 text-sm text-center">
              Viewers can reply directly to your status
            </div>
          )}
          <button onClick={submit}
            className="w-full py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl transition text-sm">
            Attach {pollType === 'poll' ? 'Poll' : 'Q&A'} Sticker
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function MusicPickerModal({ onAttach, onClose }) {
  const [tab, setTab]               = useState('presets'); // presets | url
  const [customUrl, setCustomUrl]   = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [previewAudio, setPreviewAudio] = useState(null); // track being previewed
  const [playing, setPlaying]       = useState(null);     // track url playing
  const [search, setSearch]         = useState('');
  const audioRef = useRef(null);

  const filtered = PRESET_TRACKS.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  );

  const togglePreview = (track) => {
    if (playing === track.url) {
      audioRef.current?.pause();
      setPlaying(null);
    } else {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = track.url; audioRef.current.play().catch(() => {}); }
      setPlaying(track.url);
    }
  };

  // Cleanup on unmount
  useEffect(() => () => audioRef.current?.pause(), []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        className="w-full max-w-md bg-[#1a1a1a] rounded-t-3xl sm:rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        <audio ref={audioRef} onEnded={() => setPlaying(null)} />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div className="flex items-center gap-2">
            <FiMusic size={18} className="text-[#25D366]" />
            <h3 className="text-white font-bold text-base">Add Music</h3>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full">
            <FiX size={18} className="text-white/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/8 mx-5 mb-3">
          {[['presets','🎵 Presets'],['url','🔗 Custom URL']].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex-1 py-2 text-sm font-semibold transition border-b-2 ${tab === id ? 'border-[#25D366] text-white' : 'border-transparent text-white/40'}`}>
              {label}
            </button>
          ))}
        </div>

        <div className="px-5 pb-6 max-h-[55vh] overflow-y-auto space-y-2">
          {tab === 'presets' && (
            <>
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 mb-3">
                <FiSearch size={14} className="text-white/40" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search tracks…" className="flex-1 bg-transparent text-white text-sm outline-none placeholder-white/30" />
              </div>
              {filtered.map(track => (
                <div key={track.url} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/6 transition border border-white/6">
                  <button onClick={() => togglePreview(track)}
                    className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition ${playing === track.url ? 'bg-[#25D366]' : 'bg-white/10 hover:bg-white/20'}`}>
                    {playing === track.url
                      ? <FiPause size={14} className="text-white" />
                      : <FiPlay size={14} className="text-white ml-0.5" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{track.title}</p>
                    {playing === track.url && (
                      <div className="flex items-center gap-0.5 mt-1">
                        {[1,2,3,4,5].map(i => (
                          <motion.div key={i} className="w-[3px] bg-[#25D366] rounded-full"
                            animate={{ height: [4, 12, 6, 14, 4] }}
                            transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1 }} />
                        ))}
                      </div>
                    )}
                  </div>
                  <button onClick={() => { audioRef.current?.pause(); onAttach(track.url, track.title); }}
                    className="px-3 py-1.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white text-xs font-bold rounded-full transition">
                    Use
                  </button>
                </div>
              ))}
            </>
          )}

          {tab === 'url' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Track Title</label>
                <input value={customTitle} onChange={e => setCustomTitle(e.target.value)}
                  placeholder="e.g. My Favourite Song"
                  className="w-full bg-white/5 border border-white/10 focus:border-[#25D366]/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition placeholder-white/25" />
              </div>
              <div>
                <label className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-1.5 block">Audio URL (.mp3 / .ogg)</label>
                <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-white/5 border border-white/10 focus:border-[#25D366]/50 rounded-xl px-4 py-2.5 text-sm text-white outline-none transition placeholder-white/25" />
              </div>
              {customUrl && (
                <button onClick={() => { if (audioRef.current) { audioRef.current.src = customUrl; audioRef.current.play().catch(() => {}); setPlaying(customUrl); } }}
                  className="flex items-center gap-2 text-[#25D366] text-sm">
                  <FiPlay size={13} /> Test audio
                </button>
              )}
              <button onClick={() => { if (customUrl) { audioRef.current?.pause(); onAttach(customUrl, customTitle || 'Custom track'); } else { toast('Enter a URL'); } }}
                disabled={!customUrl}
                className="w-full py-3 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 text-white font-bold rounded-xl transition text-sm">
                Attach Track
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusComposer — advanced full-featured status creator
// ─────────────────────────────────────────────────────────────────────────────
function StatusComposer({ onClose, onPosted }) {
  const [mode, setMode] = useState('text');
  const [step, setStep] = useState('compose'); // compose | settings
  const [statusText, setStatusText] = useState('');
  const [selectedGradient, setSelectedGradient] = useState('teal');
  const [selectedFont, setSelectedFont] = useState('sans');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textAlign, setTextAlign] = useState('center');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [selectedFilter, setSelectedFilter] = useState('none');
  const [showDrawing, setShowDrawing] = useState(false);
  const [drawingOverlay, setDrawingOverlay] = useState(null);
  const [stickers, setStickers] = useState([]);
  const [showStickers, setShowStickers] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkPreview, setLinkPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [privacy, setPrivacy] = useState('everyone');
  const [duration, setDuration] = useState(24);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [musicUrl, setMusicUrl] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [musicAttached, setMusicAttached] = useState(false);
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [location, setLocation] = useState('');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [imgBrightness, setImgBrightness] = useState(100);
  const [imgContrast, setImgContrast] = useState(100);
  const [imgSaturation, setImgSaturation] = useState(100);
  const [showImgAdj, setShowImgAdj] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [showOverlayInput, setShowOverlayInput] = useState(false);
  const [mentionText, setMentionText] = useState('');

  // ── Batch multi-photo ───────────────────────────────────────────────────────
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchPosting, setBatchPosting] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });
  const batchInputRef = useRef(null);

  // ── Template / Poll ─────────────────────────────────────────────────────────
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollData, setPollData] = useState(null);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const linkInputRef = useRef(null);

  const fontStyle = getFontStyle(selectedFont);
  const gradientValue = getGradientById(selectedGradient);
  const currentFilter = FILTERS.find(f => f.id === selectedFilter)?.css || 'none';

  const handleFileSelect = (file) => {
    if (!file) return;
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
    setDrawingOverlay(null);
    setStickers([]);
  };

  const clearMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    setDrawingOverlay(null);
    setStickers([]);
  };

  const handleBatchSelect = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 10);
    if (!files.length) return;
    setBatchFiles(files.map(f => ({ file: f, url: URL.createObjectURL(f), caption: '' })));
  };

  const removeBatchFile = (i) => setBatchFiles(prev => prev.filter((_, idx) => idx !== i));
  const setBatchCaption = (i, v) => setBatchFiles(prev => prev.map((f, idx) => idx === i ? { ...f, caption: v } : f));

  const handleBatchShare = async () => {
    if (!batchFiles.length) return;
    setBatchPosting(true);
    setBatchProgress({ current: 0, total: batchFiles.length });
    let posted = 0;
    for (const { file, caption: cap } of batchFiles) {
      try {
        const fd = new FormData();
        fd.append('file', file);
        const { data: upData } = await api.post('/upload/image', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        await api.post('/status', {
          content: cap.trim(),
          background_color: '#000000',
          media_url: upData.url,
          media_type: 'image',
          privacy,
          duration_hours: duration,
          music_url: musicAttached ? musicUrl : undefined,
          music_name: musicAttached ? musicTitle : undefined,
        });
        posted++;
        setBatchProgress({ current: posted, total: batchFiles.length });
      } catch { /* continue */ }
    }
    toast.success(`${posted}/${batchFiles.length} stories posted!`);
    setBatchPosting(false);
    onPosted();
    onClose();
  };

  const applyTemplate = (tpl) => {
    setMode('text');
    setStatusText(tpl.text);
    const g = GRADIENTS.find(g => g.value === tpl.gradient);
    if (!g) {
      const custom = GRADIENTS[0];
      setSelectedGradient(custom.id);
    }
    setSelectedFont(tpl.font);
    setTextColor(tpl.textColor);
    setShowTemplatePicker(false);
    const matchedG = GRADIENTS.find(gx => gx.value.replace(/\s/g,'') === tpl.gradient.replace(/\s/g,''));
    if (matchedG) setSelectedGradient(matchedG.id);
  };

  const fetchLinkPreview = async (url) => {
    if (!url || !url.startsWith('http')) return;
    setLoadingPreview(true);
    try {
      const { data } = await api.post('/status/link-preview', { url });
      setLinkPreview(data);
    } catch { setLinkPreview(null); }
    finally { setLoadingPreview(false); }
  };

  const handleLinkBlur = () => { if (linkUrl) fetchLinkPreview(linkUrl); };

  const addSticker = (emoji) => {
    setStickers(prev => [...prev, { id: Date.now(), emoji, x: 40 + Math.random() * 20, y: 40 + Math.random() * 20 }]);
    setShowStickers(false);
  };

  const handleShare = async () => {
    if (mode === 'text' && !statusText.trim()) return;
    if ((mode === 'image' || mode === 'video') && !mediaFile) return;
    if (mode === 'link' && !linkUrl) return;

    setPosting(true);
    try {
      let media_url = null;
      if (mediaFile) {
        setUploading(true);
        setUploadProgress(0);
        const fd = new FormData();
        fd.append('file', mediaFile);
        const endpoint = mode === 'video' ? '/upload/video' : '/upload/image';
        const { data: upData } = await api.post(endpoint, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (e) => {
            if (e.total) setUploadProgress(Math.round((e.loaded / e.total) * 100));
          },
        });
        media_url = upData.url;
        setUploadProgress(100);
        setUploading(false);
      }

      const payload = {
        content: mode === 'text' ? statusText.trim() : caption.trim(),
        background_color: mode === 'text' ? gradientValue : '#000000',
        media_url,
        media_type: mode,
        font_style: selectedFont,
        text_color: textColor,
        text_align: textAlign,
        privacy,
        duration_hours: duration,
        music_url: musicAttached ? musicUrl : undefined,
        music_name: musicAttached ? musicTitle : undefined,
        location: location.trim() || undefined,
        scheduled_at: scheduledAt || undefined,
        overlay_text: overlayText.trim() || undefined,
        mentions: mentionText.trim() ? mentionText.split(/[\s,]+/).filter(Boolean) : undefined,
        image_adjustments: (imgBrightness !== 100 || imgContrast !== 100 || imgSaturation !== 100)
          ? { brightness: imgBrightness, contrast: imgContrast, saturation: imgSaturation }
          : undefined,
      };

      if (mode === 'link') {
        payload.media_type = 'link';
        payload.link_url = linkUrl;
        payload.link_title = linkPreview?.title || '';
        payload.link_description = linkPreview?.description || '';
        payload.link_image = linkPreview?.image || '';
        payload.content = caption.trim();
        payload.background_color = gradientValue;
      }

      await api.post('/status', payload);
      toast.success('Status posted!');
      onPosted();
      onClose();
    } catch {
      toast.error('Failed to post status');
    } finally {
      setPosting(false);
      setUploading(false);
    }
  };

  const canShare = mode === 'text'
    ? statusText.trim().length > 0
    : mode === 'link'
      ? linkUrl.trim().length > 0
      : mode === 'batch'
        ? batchFiles.length > 0
        : !!mediaFile;

  const MODES = [
    { id: 'text',  icon: FiType,  label: 'Text' },
    { id: 'image', icon: FiImage, label: 'Photo' },
    { id: 'video', icon: FiVideo, label: 'Video' },
    { id: 'link',  icon: FiLink,  label: 'Link' },
    { id: 'batch', icon: FiLayers, label: 'Multi' },
  ];

  const PRIVACY_OPTIONS = [
    { id: 'everyone',      icon: FiGlobe,   label: 'Everyone', sub: 'All your contacts' },
    { id: 'contacts',      icon: FiUsers,   label: 'Contacts', sub: 'Only saved contacts' },
    { id: 'close_friends', icon: FiStar,    label: 'Close Friends', sub: 'Your close friends list' },
  ];

  const bgStyle = mode === 'text' || mode === 'link'
    ? { background: gradientValue }
    : { backgroundColor: '#111' };

  if (step === 'settings') {
    return (
      <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-0 z-50 flex flex-col bg-white">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b">
          <button onClick={() => setStep('compose')} className="p-2 hover:bg-gray-100 rounded-full">
            <FiChevronDown size={22} className="rotate-90" />
          </button>
          <h2 className="font-bold text-gray-900 text-lg flex-1">Status Settings</h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Privacy */}
          <div>
            <p className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-widest text-xs">Who can see this</p>
            <div className="space-y-2">
              {PRIVACY_OPTIONS.map(opt => (
                <button key={opt.id} onClick={() => setPrivacy(opt.id)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-2xl border-2 transition ${privacy === opt.id ? 'border-[#25D366] bg-[#25D366]/5' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${privacy === opt.id ? 'bg-[#25D366]' : 'bg-gray-100'}`}>
                    <opt.icon size={16} className={privacy === opt.id ? 'text-white' : 'text-gray-500'} />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-400">{opt.sub}</p>
                  </div>
                  {privacy === opt.id && <FiCheck size={18} className="text-[#25D366]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <p className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-widest text-xs">Status Duration</p>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map(opt => (
                <button key={opt.hours} onClick={() => setDuration(opt.hours)}
                  className={`py-3 px-4 rounded-2xl border-2 text-sm font-semibold transition ${duration === opt.hours ? 'border-[#25D366] bg-[#25D366]/5 text-[#25D366]' : 'border-gray-100 text-gray-600 hover:border-gray-200'}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location */}
          <div>
            <p className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-widest text-xs">Location Tag</p>
            <div className="flex items-center gap-2 p-3.5 rounded-2xl border-2 border-gray-100 focus-within:border-[#25D366] transition">
              <FiMapPin size={17} className={location ? 'text-[#25D366]' : 'text-gray-400'} />
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Add a location (city, place…)"
                className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent"
              />
              {location && (
                <button onClick={() => setLocation('')} className="text-gray-300 hover:text-gray-500">
                  <FiX size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Mention / Tag */}
          <div>
            <p className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-widest text-xs">Mention People</p>
            <div className="flex items-center gap-2 p-3.5 rounded-2xl border-2 border-gray-100 focus-within:border-[#25D366] transition">
              <FiAtSign size={17} className={mentionText ? 'text-[#25D366]' : 'text-gray-400'} />
              <input
                type="text"
                value={mentionText}
                onChange={e => setMentionText(e.target.value)}
                placeholder="@username1 @username2…"
                className="flex-1 outline-none text-sm text-gray-800 placeholder-gray-400 bg-transparent"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1.5 ml-1">Separate multiple mentions with spaces</p>
          </div>

          {/* Schedule */}
          <div>
            <p className="font-bold text-gray-700 text-sm mb-3 uppercase tracking-widest text-xs">Schedule Post</p>
            <div className="flex items-center gap-2 p-3.5 rounded-2xl border-2 border-gray-100 focus-within:border-[#25D366] transition">
              <FiCalendar size={17} className={scheduledAt ? 'text-[#25D366]' : 'text-gray-400'} />
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
                className="flex-1 outline-none text-sm text-gray-800 bg-transparent"
              />
              {scheduledAt && (
                <button onClick={() => setScheduledAt('')} className="text-gray-300 hover:text-gray-500">
                  <FiX size={14} />
                </button>
              )}
            </div>
            {scheduledAt && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-[#25D366] font-semibold ml-1">
                <FiCalendar size={11} />
                Will post at {new Date(scheduledAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 pb-10 pt-3 border-t">
          <button onClick={() => setStep('compose')}
            className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-2xl text-base transition">
            Done
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={bgStyle}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-12 pb-3 flex-shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
          <FiX size={22} className="text-white" />
        </button>
        <span className="text-white font-bold text-lg flex-1">New Status</span>
        <button onClick={() => setStep('settings')} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full transition">
          <FiSliders size={14} className="text-white" />
          <span className="text-white text-xs font-semibold">Settings</span>
        </button>
        <div className="flex gap-0.5 bg-black/20 rounded-full p-1">
          {MODES.map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setMode(id); clearMedia(); setLinkUrl(''); setLinkPreview(null); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all ${mode === id ? 'bg-white text-gray-900 shadow' : 'text-white/70 hover:text-white'}`}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">

        {/* TEXT mode */}
        {mode === 'text' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center px-8 relative">
            <textarea autoFocus value={statusText} onChange={e => setStatusText(e.target.value)}
              placeholder="What's on your mind?" maxLength={700}
              className="w-full bg-transparent placeholder-white/40 resize-none outline-none leading-snug"
              style={{
                ...fontStyle,
                color: textColor,
                textAlign,
                fontSize: statusText.length > 100 ? 'clamp(16px, 3.5vw, 24px)' : 'clamp(22px, 5vw, 38px)',
                textShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}
              rows={5}
            />
            {/* Sticker overlays */}
            {stickers.map(s => (
              <button key={s.id} onClick={() => setStickers(prev => prev.filter(x => x.id !== s.id))}
                className="absolute text-3xl" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)' }}>
                {s.emoji}
              </button>
            ))}
          </div>
        )}

        {/* LINK mode */}
        {mode === 'link' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center px-5 gap-4">
            {!linkPreview ? (
              <div className="w-full max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center mx-auto mb-4">
                  <FiLink size={30} className="text-white/60" />
                </div>
                <p className="text-white/70 text-center text-sm mb-4">Paste a link to share as your status</p>
                <input
                  ref={linkInputRef}
                  type="url" value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  onBlur={handleLinkBlur}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); fetchLinkPreview(linkUrl); } }}
                  placeholder="https://..."
                  className="w-full bg-white/15 text-white placeholder-white/40 rounded-2xl px-4 py-3 outline-none border border-white/20 focus:border-white/50 text-sm transition"
                />
                {loadingPreview && (
                  <div className="flex items-center gap-2 mt-3 text-white/60 text-sm justify-center">
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Fetching preview…
                  </div>
                )}
                {linkUrl && !loadingPreview && (
                  <button onClick={() => fetchLinkPreview(linkUrl)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl text-sm font-semibold transition">
                    <FiRefreshCw size={14} /> Get Preview
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full max-w-sm">
                <button onClick={() => setLinkPreview(null)} className="flex items-center gap-1 text-white/60 text-xs mb-3 hover:text-white transition">
                  <FiX size={12} /> Change URL
                </button>
                <div className="bg-white/10 backdrop-blur rounded-2xl overflow-hidden">
                  {linkPreview.image && <img src={linkPreview.image} alt="" className="w-full h-36 object-cover" />}
                  <div className="p-4">
                    {linkPreview.title && <p className="text-white font-bold text-sm mb-1 line-clamp-2">{linkPreview.title}</p>}
                    {linkPreview.description && <p className="text-white/60 text-xs mb-2 line-clamp-2">{linkPreview.description}</p>}
                    <p className="text-[#25D366] text-xs truncate">{linkUrl}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* IMAGE / VIDEO mode — no file selected */}
        {(mode === 'image' || mode === 'video') && !mediaPreviewUrl && (
          <div className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center">
              {mode === 'image' ? <FiImage size={40} className="text-white/50" /> : <FiVideo size={40} className="text-white/50" />}
            </div>
            <p className="text-white/60 font-medium text-sm">
              {mode === 'image' ? 'Choose a photo to share' : 'Choose a video to share'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {mode === 'image' ? (
                <>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition text-sm">
                    <FiImage size={16} /> Gallery
                  </button>
                  <button onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition text-sm">
                    <FiCamera size={16} /> Camera
                  </button>
                </>
              ) : (
                <button onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition text-sm">
                  <FiVideo size={16} /> Choose Video
                </button>
              )}
            </div>
          </div>
        )}

        {/* IMAGE preview */}
        {mode === 'image' && mediaPreviewUrl && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <img src={mediaPreviewUrl} alt="Preview"
              className="max-w-full max-h-full object-contain select-none"
              style={{ filter: `${currentFilter} brightness(${imgBrightness}%) contrast(${imgContrast}%) saturate(${imgSaturation}%)` }} />
            {overlayText && (
              <div className="absolute inset-x-0 bottom-20 flex items-center justify-center pointer-events-none">
                <span className="bg-black/55 text-white font-bold text-lg px-4 py-2 rounded-xl max-w-[80%] text-center break-words backdrop-blur-sm">
                  {overlayText}
                </span>
              </div>
            )}
            {drawingOverlay && (
              <img src={drawingOverlay} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
            )}
            {stickers.map(s => (
              <button key={s.id} onClick={() => setStickers(prev => prev.filter(x => x.id !== s.id))}
                className="absolute text-3xl z-10" style={{ left: `${s.x}%`, top: `${s.y}%`, transform: 'translate(-50%,-50%)' }}>
                {s.emoji}
              </button>
            ))}
            <button onClick={clearMedia} className="absolute top-4 left-4 p-2 bg-black/60 rounded-full z-10"><FiX size={16} className="text-white" /></button>
            <button onClick={() => setShowDrawing(true)} className="absolute top-4 right-16 p-2 bg-black/60 rounded-full z-10">
              <FiEdit3 size={16} className="text-white" />
            </button>
            <button onClick={() => setShowStickers(v => !v)} className="absolute top-4 right-4 p-2 bg-black/60 rounded-full z-10">
              <FiSmile size={16} className="text-white" />
            </button>
            {showStickers && (
              <div className="absolute top-16 right-2 bg-black/80 rounded-2xl p-3 grid grid-cols-5 gap-2 z-20 backdrop-blur-sm">
                {STICKERS.map(e => (
                  <button key={e} onClick={() => addSticker(e)} className="text-2xl hover:scale-125 transition">{e}</button>
                ))}
              </div>
            )}
            {showDrawing && (
              <DrawingCanvas
                onSave={(dataUrl) => { setDrawingOverlay(dataUrl); setShowDrawing(false); }}
                onClose={() => setShowDrawing(false)}
              />
            )}
          </div>
        )}

        {/* VIDEO preview */}
        {mode === 'video' && mediaPreviewUrl && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video src={mediaPreviewUrl} controls playsInline className="max-w-full max-h-full" style={{ filter: currentFilter }} />
            <button onClick={clearMedia} className="absolute top-4 left-4 p-2 bg-black/60 rounded-full"><FiX size={16} className="text-white" /></button>
          </div>
        )}

        {/* BATCH / MULTI mode */}
        {mode === 'batch' && (
          <div className="w-full flex-1 flex flex-col px-4 py-2 overflow-y-auto">
            {batchFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-5 text-center">
                <div className="w-24 h-24 rounded-3xl bg-white/10 flex items-center justify-center">
                  <FiLayers size={40} className="text-white/50" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Batch Story Upload</p>
                  <p className="text-white/50 text-sm mt-1">Select up to 10 photos — each becomes its own story slide</p>
                </div>
                <button onClick={() => batchInputRef.current?.click()}
                  className="flex items-center gap-2 px-6 py-3.5 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-bold text-sm transition">
                  <FiImage size={18} /> Choose Photos (up to 10)
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-white font-bold text-sm">{batchFiles.length} photo{batchFiles.length > 1 ? 's' : ''} selected</p>
                  <button onClick={() => batchInputRef.current?.click()} className="text-[#25D366] text-xs font-semibold">+ Add more</button>
                </div>
                {batchFiles.map((bf, i) => (
                  <div key={i} className="flex gap-3 items-start bg-white/8 rounded-2xl p-3 border border-white/10">
                    <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-black">
                      <img src={bf.url} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white/50 text-[10px] mb-1">Slide {i + 1}</p>
                      <input value={bf.caption} onChange={e => setBatchCaption(i, e.target.value)}
                        placeholder="Caption (optional)…"
                        className="w-full bg-transparent text-white placeholder-white/30 text-sm outline-none border-b border-white/15 focus:border-[#25D366]/50 pb-1 transition" />
                    </div>
                    <button onClick={() => removeBatchFile(i)} className="p-1.5 bg-white/10 hover:bg-red-500/20 rounded-full transition">
                      <FiX size={12} className="text-white/60 hover:text-red-400" />
                    </button>
                  </div>
                ))}
                {batchPosting && (
                  <div className="bg-white/10 rounded-2xl p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-white/70 text-xs">Posting stories…</span>
                      <span className="text-white text-xs font-bold">{batchProgress.current}/{batchProgress.total}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <motion.div className="h-full bg-[#25D366] rounded-full"
                        animate={{ width: `${batchProgress.total ? (batchProgress.current / batchProgress.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="flex-shrink-0 px-4 pb-10 pt-2">
        {/* Text mode controls */}
        {mode === 'text' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-xs">{700 - statusText.length} left</p>
              <div className="flex gap-1">
                {[FiAlignLeft, FiAlignCenter, FiAlignRight].map((Icon, i) => {
                  const aligns = ['left', 'center', 'right'];
                  return (
                    <button key={i} onClick={() => setTextAlign(aligns[i])}
                      className={`p-1.5 rounded-lg transition ${textAlign === aligns[i] ? 'bg-white/20' : 'text-white/40 hover:text-white'}`}>
                      <Icon size={14} className="text-white" />
                    </button>
                  );
                })}
                <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
                  className="w-7 h-7 rounded-lg border-2 border-white/20 cursor-pointer bg-transparent" title="Text color" />
              </div>
            </div>
            {/* Font selector */}
            <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
              {FONTS.map(f => (
                <button key={f.id} onClick={() => setSelectedFont(f.id)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs transition border ${selectedFont === f.id ? 'bg-white text-gray-900 border-white' : 'border-white/30 text-white/70 hover:text-white'}`}
                  style={f.style}>
                  {f.label}
                </button>
              ))}
            </div>
            {/* Gradient picker */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {GRADIENTS.map(g => (
                <button key={g.id} onClick={() => setSelectedGradient(g.id)}
                  className={`w-9 h-9 rounded-full flex-shrink-0 transition-all border-2 ${selectedGradient === g.id ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'}`}
                  style={{ background: g.value }} title={g.label} />
              ))}
            </div>
            {/* Sticker / Template / Poll row */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button onClick={() => setShowStickers(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white text-xs font-semibold transition">
                <FiSmile size={13} /> Stickers
              </button>
              <button onClick={() => setShowTemplatePicker(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white text-xs font-semibold transition">
                <FiZap size={13} /> Templates
              </button>
              <button onClick={() => setShowPollCreator(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-semibold transition border ${pollData ? 'bg-[#25D366] border-[#25D366]' : 'bg-white/15 hover:bg-white/25 border-transparent'}`}>
                <FiBarChart2 size={13} /> {pollData ? '✓ Poll Added' : 'Add Poll/Q&A'}
              </button>
              {pollData && (
                <button onClick={() => setPollData(null)} className="p-1.5 bg-white/10 hover:bg-red-500/20 rounded-full transition">
                  <FiX size={10} className="text-white/60" />
                </button>
              )}
              {showStickers && (
                <div className="absolute bottom-52 right-4 bg-black/80 rounded-2xl p-3 grid grid-cols-5 gap-2 z-20 backdrop-blur-sm">
                  {STICKERS.map(e => (
                    <button key={e} onClick={() => addSticker(e)} className="text-2xl hover:scale-125 transition">{e}</button>
                  ))}
                </div>
              )}
            </div>
            {pollData && (
              <div className="mb-3 bg-white/10 border border-white/15 rounded-2xl p-3">
                <p className="text-[#25D366] text-xs font-bold mb-1 flex items-center gap-1">
                  <FiBarChart2 size={11} /> {pollData.type === 'qa' ? 'Q&A' : 'Poll'} Attached
                </p>
                <p className="text-white text-sm font-semibold truncate">{pollData.question}</p>
                {pollData.type === 'poll' && (
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {pollData.options.map((o, i) => (
                      <span key={i} className="text-[10px] bg-white/15 text-white px-2 py-0.5 rounded-full">{o}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Image filters + adjustments */}
        {(mode === 'image' || mode === 'video') && mediaPreviewUrl && (
          <div className="mb-3">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {FILTERS.map(f => (
                <button key={f.id} onClick={() => setSelectedFilter(f.id)}
                  className={`flex flex-col items-center gap-1 flex-shrink-0 transition ${selectedFilter === f.id ? 'opacity-100' : 'opacity-60 hover:opacity-80'}`}>
                  <div className="w-12 h-12 rounded-xl overflow-hidden border-2 transition"
                    style={{ borderColor: selectedFilter === f.id ? '#25D366' : 'transparent' }}>
                    {mediaPreviewUrl && mode === 'image'
                      ? <img src={mediaPreviewUrl} alt="" className="w-full h-full object-cover" style={{ filter: f.css }} />
                      : <div className="w-full h-full bg-white/20 flex items-center justify-center text-white text-[10px]">{f.label}</div>}
                  </div>
                  <span className="text-white text-[9px] font-semibold">{f.label}</span>
                </button>
              ))}
            </div>

            {/* Adjust / Overlay toggle bar */}
            <div className="flex items-center gap-2 mt-2 mb-2">
              <button onClick={() => { setShowImgAdj(v => !v); setShowOverlayInput(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${showImgAdj ? 'bg-white text-gray-900 border-white' : 'border-white/25 text-white/70 hover:text-white'}`}>
                <FiSun size={12} />Adjust
              </button>
              <button onClick={() => { setShowOverlayInput(v => !v); setShowImgAdj(false); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${showOverlayInput ? 'bg-white text-gray-900 border-white' : 'border-white/25 text-white/70 hover:text-white'}`}>
                <FiFeather size={12} />Text Overlay
              </button>
              {location && (
                <span className="flex items-center gap-1 text-[10px] text-white/60 bg-white/10 rounded-full px-2 py-1">
                  <FiMapPin size={9} />{location}
                </span>
              )}
            </div>

            {/* Image adjustment sliders */}
            <AnimatePresence>
              {showImgAdj && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-2">
                  <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-3 space-y-2.5">
                    {[
                      { label: 'Brightness', icon: FiSun, value: imgBrightness, set: setImgBrightness, min: 50, max: 150 },
                      { label: 'Contrast', icon: FiDroplet, value: imgContrast, set: setImgContrast, min: 50, max: 200 },
                      { label: 'Saturation', icon: FiEyeOff, value: imgSaturation, set: setImgSaturation, min: 0, max: 200 },
                    ].map(({ label, icon: Icon, value, set, min, max }) => (
                      <div key={label} className="flex items-center gap-3">
                        <Icon size={13} className="text-white/60 flex-shrink-0 w-4" />
                        <span className="text-[10px] text-white/50 w-16 flex-shrink-0">{label}</span>
                        <input type="range" min={min} max={max} value={value}
                          onChange={e => set(Number(e.target.value))}
                          className="flex-1 h-1 accent-[#25D366] cursor-pointer" />
                        <button onClick={() => set(100)} className="text-[10px] text-white/30 hover:text-[#25D366] transition w-6 text-right"
                          title="Reset">↺</button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Text overlay input */}
            <AnimatePresence>
              {showOverlayInput && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mb-2">
                  <div className="bg-black/40 backdrop-blur-sm rounded-2xl p-3">
                    <input
                      autoFocus
                      type="text"
                      value={overlayText}
                      onChange={e => setOverlayText(e.target.value)}
                      placeholder="Add text on your photo…"
                      maxLength={60}
                      className="w-full bg-transparent text-white placeholder-white/40 outline-none text-sm font-bold"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex items-center gap-3 mt-1">
              <input type="text" placeholder="Add a caption..." value={caption} onChange={e => setCaption(e.target.value)}
                className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-2.5 outline-none text-sm border border-white/10 focus:border-white/30 transition" />
            </div>
          </div>
        )}

        {/* Link caption */}
        {mode === 'link' && linkPreview && (
          <div className="mb-3">
            <input type="text" placeholder="Add a caption..." value={caption} onChange={e => setCaption(e.target.value)}
              className="w-full bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-2.5 outline-none text-sm border border-white/10 focus:border-white/30 transition" />
          </div>
        )}

        {/* Music row — always visible */}
        <div className="mb-3">
          {musicAttached ? (
            <div className="flex items-center gap-2 bg-white/10 border border-white/15 rounded-2xl px-3 py-2.5">
              <FiMusic size={14} className="text-[#25D366] animate-pulse flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-semibold truncate">{musicTitle || 'Background music'}</p>
                <p className="text-white/40 text-[10px] truncate">{musicUrl}</p>
              </div>
              <button onClick={() => { setMusicAttached(false); setMusicUrl(''); setMusicTitle(''); }}
                className="p-1 hover:bg-white/15 rounded-full">
                <FiX size={13} className="text-white/60" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowMusicPicker(true)}
              className="flex items-center gap-2 px-3 py-2 bg-white/8 hover:bg-white/15 border border-white/10 rounded-2xl transition text-white/60 hover:text-white text-sm">
              <FiMusic size={14} /> Add Music
            </button>
          )}
        </div>

        {/* Upload progress */}
        {uploading && (
          <div className="mb-3">
            <UploadProgressBar progress={uploadProgress} label={uploadProgress < 100 ? 'Uploading…' : 'Processing…'} />
          </div>
        )}

        {/* Share button */}
        {mode === 'batch' ? (
          <button onClick={handleBatchShare} disabled={!canShare || batchPosting}
            className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-base shadow-lg">
            {batchPosting
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting {batchProgress.current}/{batchProgress.total}…</>
              : <><FiLayers size={18} /> Post {batchFiles.length} Stories</>}
          </button>
        ) : (
          <button onClick={handleShare} disabled={!canShare || posting || uploading}
            className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-base shadow-lg">
            {posting && !uploading
              ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting…</>
              : <><FiSend size={18} /> Share Status</>}
          </button>
        )}

        <div className="flex items-center justify-center gap-1 mt-2 text-white/40 text-xs">
          {privacy === 'everyone' && <><FiGlobe size={11} /> Everyone</>}
          {privacy === 'contacts' && <><FiUsers size={11} /> Contacts only</>}
          {privacy === 'close_friends' && <><FiStar size={11} /> Close friends</>}
          <span>·</span>
          <span>{duration}h</span>
        </div>
      </div>

      {/* Music Picker Modal */}
      <AnimatePresence>
        {showMusicPicker && (
          <MusicPickerModal
            onAttach={(url, title) => {
              setMusicUrl(url);
              setMusicTitle(title);
              setMusicAttached(true);
              setShowMusicPicker(false);
            }}
            onClose={() => setShowMusicPicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Template Picker Modal */}
      <AnimatePresence>
        {showTemplatePicker && (
          <TemplatePickerModal
            onSelect={applyTemplate}
            onClose={() => setShowTemplatePicker(false)}
          />
        )}
      </AnimatePresence>

      {/* Poll Creator Modal */}
      <AnimatePresence>
        {showPollCreator && (
          <PollCreatorModal
            onAttach={(data) => { setPollData(data); setShowPollCreator(false); }}
            onClose={() => setShowPollCreator(false)}
          />
        )}
      </AnimatePresence>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleBatchSelect} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ContactStatusRow (list item below rings)
// ─────────────────────────────────────────────────────────────────────────────
function ContactStatusRow({ group, onClick, onMute }) {
  const [showMenu, setShowMenu] = useState(false);
  const latest = group.statuses?.[0];
  const unviewed = group.statuses?.some(s => !s.viewed);
  const hasImage = latest?.media_url && latest?.media_type !== 'link' && !/video/i.test(latest?.media_type || '');
  const count = group.statuses?.length || 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50/80 px-4 py-3 transition-colors"
        onClick={onClick}>
        {/* SVG-segmented ring in list view — 64 px */}
        <div className="flex-shrink-0">
          <AvatarRing
            src={group.owner_avatar}
            name={group.owner_name}
            statuses={group.statuses || []}
            closeFriend={group.is_close_friend}
            onClick={onClick}
            size={64}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-gray-900 text-sm truncate">{group.owner_name}</p>
            {group.is_close_friend && <span className="text-yellow-500 text-xs">★</span>}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {latest?.media_type === 'image' && <FiImage size={11} className="text-gray-400 flex-shrink-0" />}
            {latest?.media_type === 'video' && <FiVideo size={11} className="text-gray-400 flex-shrink-0" />}
            {latest?.media_type === 'link' && <FiLink size={11} className="text-gray-400 flex-shrink-0" />}
            <p className="text-xs text-gray-400 truncate">
              {latest?.created_at ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true }) : ''}
              {count > 1 ? ` · ${count} updates` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {unviewed && <div className="w-2.5 h-2.5 rounded-full bg-[#25D366]" />}
          <button onClick={e => { e.stopPropagation(); setShowMenu(v => !v); }}
            className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600">
            <FiChevronRight size={16} className={showMenu ? 'rotate-90 transition' : 'transition'} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showMenu && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="absolute right-4 top-14 z-20 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden min-w-[160px]">
            <button onClick={() => { onClick(); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
              <FiEye size={14} /> View status
            </button>
            <button onClick={() => { onMute(group.user_id, !group.is_muted); setShowMenu(false); }}
              className="w-full flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition text-left">
              {group.is_muted ? <><FiBell size={14} /> Unmute</> : <><FiBellOff size={14} /> Mute</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main StatusTab
// ─────────────────────────────────────────────────────────────────────────────
function StatusTab() {
  const { user } = useAuthStore();
  const [statuses, setStatuses] = useState([]);
  const [myStatuses, setMyStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [viewingGroup, setViewingGroup] = useState(null);
  const [viewingGroupIdx, setViewingGroupIdx] = useState(0);
  const [viewingOwn, setViewingOwn] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadStatuses(); }, []);

  const loadStatuses = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data } = await api.get('/status/all');
      setStatuses(data.statuses || []);
      setMyStatuses(data.my_statuses || []);
    } catch { }
    finally { setLoading(false); setRefreshing(false); }
  };

  const openStatusGroup = (group, idx, isOwn = false) => {
    setViewingGroup(group);
    setViewingGroupIdx(idx);
    setViewingOwn(isOwn);
  };

  const openMyStatus = () => {
    if (myStatuses.length > 0) {
      openStatusGroup(
        { owner_name: user?.full_name || 'Me', owner_avatar: user?.avatar_url, user_id: user?.id, statuses: myStatuses },
        -1, true,
      );
    } else {
      setShowCompose(true);
    }
  };

  const handleNextGroup = () => {
    const next = viewingGroupIdx + 1;
    if (next >= 0 && next < statuses.length) openStatusGroup(statuses[next], next, false);
    else setViewingGroup(null);
  };

  const handlePrevGroup = () => {
    const prev = viewingGroupIdx - 1;
    if (prev >= 0 && prev < statuses.length) openStatusGroup(statuses[prev], prev, false);
  };

  const handleMute = async (targetUserId, mute) => {
    try {
      if (mute) {
        await api.post(`/status/mute/${targetUserId}`);
        toast.success('Status muted');
      } else {
        await api.delete(`/status/mute/${targetUserId}`);
        toast.success('Status unmuted');
      }
      loadStatuses(true);
    } catch { toast.error('Failed to update mute'); }
  };

  const latestMine = myStatuses[0];
  const mineHasImage = latestMine?.media_url && (latestMine?.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(latestMine?.media_url || ''));

  // Unviewed statuses first in the ring
  const sortedForRings = useMemo(() => {
    const unviewed = statuses.filter(g => g.statuses?.some(s => !s.viewed));
    const viewed   = statuses.filter(g => !g.statuses?.some(s => !s.viewed));
    return [...unviewed, ...viewed];
  }, [statuses]);

  // Auto-refresh every 60 s — keeps statuses live without manual pull
  useEffect(() => {
    const t = setInterval(() => loadStatuses(true), 60000);
    return () => clearInterval(t);
  }, []);

  return (
    <>
      <div className="flex flex-col h-full bg-white overflow-y-auto">

        {/* ── Top horizontal story rings ── */}
        <div className="border-b border-gray-100 bg-white">
          <div className="flex gap-3 px-3 py-4 overflow-x-auto no-scrollbar">
            {/* My status ring */}
            <AvatarRing
              src={user?.avatar_url}
              name={user?.full_name}
              statuses={myStatuses}
              isOwn
              showPlus
              onClick={openMyStatus}
              size={82}
            />
            {/* Contacts rings */}
            {sortedForRings.map((group, gIdx) => (
              <AvatarRing
                key={group.user_id}
                src={group.owner_avatar}
                name={group.owner_name}
                statuses={group.statuses || []}
                closeFriend={group.is_close_friend}
                onClick={() => openStatusGroup({ ...group, user_id: group.user_id }, gIdx, false)}
                size={82}
              />
            ))}
            {statuses.length === 0 && !loading && (
              <div className="flex items-center text-gray-400 text-xs px-2 italic self-center">
                No contacts' statuses yet
              </div>
            )}
          </div>
        </div>

        {/* ── My Status row ── */}
        <div className="border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-3 pb-1">My Status</p>
          <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50/80 px-4 py-3 transition-colors" onClick={openMyStatus}>
            <div className="flex-shrink-0">
              <AvatarRing
                src={user?.avatar_url}
                name={user?.full_name}
                statuses={myStatuses}
                isOwn
                showPlus
                onClick={openMyStatus}
                size={64}
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">My Status</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {myStatuses.length > 0
                  ? `${myStatuses.length} update${myStatuses.length !== 1 ? 's' : ''} · ${formatDistanceToNow(new Date(latestMine.created_at), { addSuffix: true })}`
                  : 'Tap to add a status update'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={e => { e.stopPropagation(); loadStatuses(true); }}
                className={`p-1.5 hover:bg-gray-100 rounded-full transition text-gray-400 ${refreshing ? 'animate-spin' : ''}`}>
                <FiRefreshCw size={15} />
              </button>
              <FiChevronRight size={16} className="text-gray-300" />
            </div>
          </div>
        </div>

        {/* ── Recent Updates list ── */}
        {loading ? (
          <div className="flex-1 flex flex-col gap-0 py-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="w-14 h-14 rounded-full bg-gray-100 animate-pulse flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-100 rounded-full animate-pulse w-32" />
                  <div className="h-2.5 bg-gray-100 rounded-full animate-pulse w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : statuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#25D366]/20 to-[#075E54]/20 flex items-center justify-center mb-4">
              <FiEye size={32} className="text-[#25D366]" />
            </div>
            <p className="font-bold text-gray-700 mb-1">No recent updates</p>
            <p className="text-sm text-gray-400">Status updates from your contacts will appear here.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 pt-4 pb-1">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Recent Updates</p>
              <span className="text-[10px] text-gray-300">{statuses.length} contacts</span>
            </div>
            <div className="divide-y divide-gray-50">
              {statuses.map((group, gIdx) => (
                <ContactStatusRow
                  key={group.user_id}
                  group={group}
                  onClick={() => openStatusGroup({ ...group, user_id: group.user_id }, gIdx, false)}
                  onMute={handleMute}
                />
              ))}
            </div>
          </>
        )}

        {/* Advertise promo */}
        {(user?.badge_verified || user?.is_admin) && (
          <div className="mx-4 my-4 p-4 bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <FiZap size={20} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">Advertise on VipChat</p>
                <p className="text-white/70 text-xs">Reach millions with Status Ads</p>
              </div>
              <a href="/advertise" className="flex-shrink-0 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-full hover:bg-[#1fbd5a] transition">Start</a>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewingGroup && (
          <StatusViewer
            key={viewingGroup.user_id || 'own'}
            statusGroup={viewingGroup}
            onClose={() => setViewingGroup(null)}
            isOwn={viewingOwn}
            allGroups={statuses}
            currentGroupIdx={viewingGroupIdx}
            onNextGroup={!viewingOwn ? handleNextGroup : null}
            onPrevGroup={!viewingOwn ? handlePrevGroup : null}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCompose && (
          <StatusComposer
            onClose={() => setShowCompose(false)}
            onPosted={() => loadStatuses(true)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default StatusTab;
