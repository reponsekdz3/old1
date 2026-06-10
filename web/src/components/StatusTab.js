import React, {
  useState, useEffect, useRef, useCallback, useMemo
} from 'react';
import {
  FiPlus, FiCamera, FiX, FiImage, FiType, FiTrash2, FiEye,
  FiVideo, FiSend, FiMessageCircle, FiFlag, FiExternalLink,
  FiChevronRight, FiZap, FiLink, FiEdit3, FiSmile, FiStar,
  FiSliders, FiBellOff, FiBell, FiChevronDown, FiCheck,
  FiAlignCenter, FiAlignLeft, FiAlignRight, FiUsers, FiLock,
  FiGlobe, FiRefreshCw, FiMusic,
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
// StatusViewer — immersive full-screen story viewer
// ─────────────────────────────────────────────────────────────────────────────
function StatusViewer({ statusGroup, onClose, isOwn, allGroups = [], currentGroupIdx = 0, onNextGroup }) {
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
  const pendingNextIdx = useRef(null);
  const adShownRef = useRef(false);
  const swipeStartRef = useRef(null);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const reactionTimeoutRef = useRef(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const musicRef = useRef(null);

  const current = items[idx];
  const isVideo = !!(current?.media_url && (current?.media_type === 'video' || /\.(mp4|webm|mov)/i.test(current?.media_url || '')));
  const DURATION = isVideo ? null : 6000;
  const [liveViewCount, setLiveViewCount] = useState(current?.viewers_count || 0);

  useEffect(() => {
    api.get('/ads/feed').then(({ data }) => { if (data?.ad) setAdData(data.ad); }).catch(() => {});
  }, []);

  useEffect(() => {
    setMyReaction(current?.my_reaction || null);
  }, [current]);

  // Auto-play music
  useEffect(() => {
    if (current?.music_url && musicRef.current) {
      musicRef.current.src = current.music_url;
      musicRef.current.play().then(() => setMusicPlaying(true)).catch(() => {});
    }
    return () => { if (musicRef.current) { musicRef.current.pause(); musicRef.current.src = ''; } };
  }, [idx, current]);

  const afterAd = useCallback(() => {
    setShowAd(false);
    setShowReactions(false);
    setShowReply(false);
    const nextIdx = pendingNextIdx.current;
    pendingNextIdx.current = null;
    if (nextIdx === null) return;
    if (nextIdx < items.length) setIdx(nextIdx);
    else { if (onNextGroup) onNextGroup(); else onClose(); }
  }, [items.length, onNextGroup, onClose]);

  const advance = useCallback(() => {
    setShowReactions(false);
    setShowReply(false);
    const nextIdx = idx + 1;
    if (nextIdx % AD_EVERY_N === 0 && adData && !adShownRef.current) {
      adShownRef.current = true;
      pendingNextIdx.current = nextIdx;
      setShowAd(true);
      return;
    }
    if (nextIdx < items.length) setIdx(nextIdx);
    else { if (onNextGroup) onNextGroup(); else onClose(); }
  }, [idx, items.length, onClose, adData, onNextGroup]);

  useEffect(() => {
    if (paused || isVideo || showAd || showReply) return;
    timerRef.current = setTimeout(advance, DURATION || 6000);
    return () => clearTimeout(timerRef.current);
  }, [idx, paused, isVideo, advance, DURATION, showAd, showReply]);

  useEffect(() => {
    if (current?.id && !isOwn) {
      api.post(`/status/${current.id}/view`)
        .then(({ data }) => { if (data?.viewers_count !== undefined) setLiveViewCount(data.viewers_count); })
        .catch(() => {});
    }
    if (isOwn && current?.id) {
      setLiveViewCount(current.viewers_count || 0);
    }
  }, [current?.id, isOwn]);

  // Live view-count refresh for own statuses (every 10 s while viewer is open)
  useEffect(() => {
    if (!isOwn || !current?.id) return;
    const t = setInterval(() => {
      api.get(`/status/${current.id}/viewers`).then(({ data }) => {
        setLiveViewCount(data.count ?? liveViewCount);
      }).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [isOwn, current?.id]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [idx]);

  const goBack = () => { setShowAd(false); if (idx > 0) setIdx(i => i - 1); else onClose(); };

  const deleteStatus = async () => {
    if (!window.confirm('Delete this status?')) return;
    try {
      await api.delete(`/status/${current.id}`);
      toast.success('Status deleted');
      if (items.length <= 1) onClose(); else advance();
    } catch { toast.error('Failed to delete'); }
  };

  const sendReaction = async (emoji) => {
    if (!current?.id) return;
    clearTimeout(reactionTimeoutRef.current);
    setMyReaction(emoji);
    setShowReactions(false);
    try { await api.post(`/status/${current.id}/react`, { emoji }); } catch { }
    reactionTimeoutRef.current = setTimeout(advance, 800);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !statusGroup?.user_id) return;
    setReplySending(true);
    try {
      await api.post('/messages', {
        receiver_id: statusGroup.user_id,
        content: `↩ Re: status\n"${current?.content?.slice(0, 60) || '📸 Photo'}"\n\n${replyText.trim()}`,
      });
      toast.success('Reply sent!');
      setReplyText('');
      setShowReply(false);
    } catch { toast.error('Failed to send reply'); }
    finally { setReplySending(false); }
  };

  const handleTouchStart = (e) => { swipeStartRef.current = { y: e.touches[0].clientY, t: Date.now() }; };
  const handleTouchEnd = (e) => {
    if (!swipeStartRef.current) return;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    const dt = Date.now() - swipeStartRef.current.t;
    if (dy > 90 && dt < 500) onClose();
    swipeStartRef.current = null;
  };

  const fontStyle = getFontStyle(current?.font_style);
  const reactionSummary = current?.reactions || {};
  const totalReactions = Object.values(reactionSummary).reduce((a, b) => a + b, 0);

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
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col select-none"
      onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}
    >
      <audio ref={musicRef} loop style={{ display: 'none' }} />
      {/* Progress bars — segmented, animated */}
      <div className="flex gap-[3px] px-3 pt-safe pt-11 pb-2 z-10 relative">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-[4px] bg-white/25 rounded-full overflow-hidden shadow-sm">
            <motion.div
              key={`bar-${idx}-${i}`}
              className="h-full rounded-full"
              style={{ background: i < idx ? '#fff' : 'linear-gradient(90deg,#25D366,#fff)' }}
              initial={{ width: i < idx ? '100%' : '0%' }}
              animate={{ width: i <= idx ? '100%' : '0%' }}
              transition={
                i === idx && !paused && !isVideo
                  ? { duration: (DURATION || 6000) / 1000, ease: 'linear' }
                  : { duration: 0.15 }
              }
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3 z-10 relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-teal-500 flex-shrink-0">
          {statusGroup?.owner_avatar
            ? <img src={statusGroup.owner_avatar} alt="" className="w-full h-full object-cover" />
            : <span className="w-full h-full flex items-center justify-center text-white font-bold text-sm">{statusGroup?.owner_name?.[0] || '?'}</span>}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{statusGroup?.owner_name}</p>
          <div className="flex items-center gap-2">
            <p className="text-white/60 text-xs">
              {current?.created_at ? formatDistanceToNow(new Date(current.created_at), { addSuffix: true }) : ''}
            </p>
            {current?.expires_at && (
              <span className="text-white/40 text-[10px]">· {timeLeft(current.expires_at)}</span>
            )}
          </div>
        </div>
        {current?.music_name && (
          <div className="flex items-center gap-1 bg-white/10 rounded-full px-2 py-1">
            <FiMusic size={11} className={`text-white ${musicPlaying ? 'animate-pulse' : ''}`} />
            <span className="text-white/80 text-[10px] max-w-[80px] truncate">{current.music_name}</span>
          </div>
        )}
        {isOwn && (
          <button onClick={deleteStatus} className="p-2 hover:bg-white/10 rounded-full transition">
            <FiTrash2 size={18} className="text-white/80" />
          </button>
        )}
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
          <FiX size={22} className="text-white" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isVideo && current?.media_url ? (
          <video ref={videoRef} src={current.media_url} autoPlay playsInline className="w-full h-full object-contain" onEnded={advance} />
        ) : current?.media_url && current?.media_type !== 'link' ? (
          <img src={current.media_url} alt="status" className="w-full h-full object-contain" />
        ) : current?.media_type === 'link' ? (
          <div className="w-full h-full flex items-center justify-center px-6"
            style={{ background: current.background_color?.includes('linear-gradient') ? current.background_color : `linear-gradient(135deg,#075E54,#128C7E)` }}>
            <div className="bg-white/10 backdrop-blur rounded-2xl overflow-hidden w-full max-w-sm">
              {current.link_image && <img src={current.link_image} alt="" className="w-full h-40 object-cover" />}
              <div className="p-4">
                {current.link_title && <p className="text-white font-bold text-base mb-1">{current.link_title}</p>}
                {current.link_description && <p className="text-white/70 text-sm mb-3 line-clamp-2">{current.link_description}</p>}
                <a href={current.link_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-[#25D366] text-sm font-semibold">
                  <FiExternalLink size={14} />{new URL(current.link_url || 'https://x.com').hostname}
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
              fontSize: 'clamp(20px, 5vw, 36px)',
              textShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {current?.content || ''}
            </p>
          </div>
        )}

        {(current?.media_url && current?.media_type !== 'link') && current?.content && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-20 pt-10">
            <p className="text-white text-base font-medium text-center">{current.content}</p>
          </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 flex" style={{ top: 70 }}>
          <div className="flex-1" onClick={goBack} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)} />
          <div className="flex-1" onClick={() => { if (!showReactions) advance(); }} onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)} />
        </div>

        {/* Reaction picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div initial={{ opacity: 0, y: 20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/80 backdrop-blur-sm rounded-full px-3 py-2.5 z-20 flex-wrap justify-center max-w-[280px]">
              {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)}
                  className={`text-2xl transition-transform hover:scale-125 active:scale-110 ${myReaction === emoji ? 'scale-125' : ''}`}>
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {myReaction && !showReactions && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute bottom-24 right-5 text-3xl z-20 pointer-events-none">{myReaction}</motion.div>
        )}

        {/* Reaction summary overlay */}
        {totalReactions > 0 && !isOwn && (
          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur rounded-full px-2 py-1 flex items-center gap-1 z-10">
            {Object.entries(reactionSummary).slice(0, 3).map(([emoji, count]) => (
              <span key={emoji} className="text-xs">{emoji}{count > 1 && <span className="text-white/70 text-[10px] ml-0.5">{count}</span>}</span>
            ))}
          </div>
        )}
      </div>

      {/* Reply input */}
      <AnimatePresence>
        {showReply && (
          <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-black/90 border-t border-white/10 flex-shrink-0 z-20">
            <input autoFocus type="text" value={replyText} onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendReply(); if (e.key === 'Escape') setShowReply(false); }}
              placeholder={`Reply to ${statusGroup?.owner_name}…`}
              className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2.5 text-sm outline-none border border-white/20 focus:border-white/40 transition" />
            <button onClick={sendReply} disabled={!replyText.trim() || replySending}
              className="w-10 h-10 flex items-center justify-center bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 rounded-full transition">
              <FiSend size={16} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      {!showReply && (
        <div className="flex items-center gap-2 px-4 py-3 flex-shrink-0">
          {isOwn ? (
            <>
              <button onClick={() => { setPaused(true); setShowViewers(true); }}
                className="flex items-center gap-2 text-white/70 hover:text-white transition">
                <FiEye size={18} />
                <span className="text-sm">{liveViewCount} view{liveViewCount !== 1 ? 's' : ''}</span>
              </button>
              {totalReactions > 0 && (
                <button onClick={() => { setPaused(true); setShowViewers(true); }}
                  className="flex items-center gap-1.5 text-white/70 hover:text-white transition ml-2">
                  <span className="text-sm">·</span>
                  {Object.entries(reactionSummary).slice(0, 2).map(([e]) => <span key={e}>{e}</span>)}
                  <span className="text-xs text-white/60">{totalReactions}</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setPaused(true); setShowReactions(v => !v); }}
                className={`flex items-center gap-1.5 text-sm transition px-3 py-2 rounded-full ${showReactions ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}>
                {myReaction || '😊'}
              </button>
              <button onClick={() => { setPaused(true); setShowReply(v => !v); setShowReactions(false); }}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition">
                <FiMessageCircle size={18} /><span>Reply</span>
              </button>
            </>
          )}
          <span className="ml-auto text-white/40 text-xs">{idx + 1} / {items.length}</span>
        </div>
      )}

      <AnimatePresence>
        {showViewers && current?.id && (
          <ViewerListModal
            statusId={current.id}
            viewerCount={current.viewers_count || 0}
            reactionCount={current.total_reactions || 0}
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
      : !!mediaFile;

  const MODES = [
    { id: 'text',  icon: FiType,  label: 'Text' },
    { id: 'image', icon: FiImage, label: 'Photo' },
    { id: 'video', icon: FiVideo, label: 'Video' },
    { id: 'link',  icon: FiLink,  label: 'Link' },
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
              style={{ filter: currentFilter }} />
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
            {/* Sticker button */}
            <div className="flex items-center justify-between mb-3">
              <button onClick={() => setShowStickers(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/15 hover:bg-white/25 rounded-full text-white text-xs font-semibold transition">
                <FiSmile size={13} /> Stickers
              </button>
              {showStickers && (
                <div className="absolute bottom-52 right-4 bg-black/80 rounded-2xl p-3 grid grid-cols-5 gap-2 z-20 backdrop-blur-sm">
                  {STICKERS.map(e => (
                    <button key={e} onClick={() => addSticker(e)} className="text-2xl hover:scale-125 transition">{e}</button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Image filters */}
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
            <div className="flex items-center gap-3 mt-3">
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

        {/* Upload progress */}
        {uploading && (
          <div className="mb-3">
            <UploadProgressBar progress={uploadProgress} label={uploadProgress < 100 ? 'Uploading…' : 'Processing…'} />
          </div>
        )}

        {/* Share button */}
        <button onClick={handleShare} disabled={!canShare || posting || uploading}
          className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-base shadow-lg">
          {posting && !uploading
            ? <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting…</>
            : <><FiSend size={18} /> Share Status</>}
        </button>

        <div className="flex items-center justify-center gap-1 mt-2 text-white/40 text-xs">
          {privacy === 'everyone' && <><FiGlobe size={11} /> Everyone</>}
          {privacy === 'contacts' && <><FiUsers size={11} /> Contacts only</>}
          {privacy === 'close_friends' && <><FiStar size={11} /> Close friends</>}
          <span>·</span>
          <span>{duration}h</span>
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0])} />
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
