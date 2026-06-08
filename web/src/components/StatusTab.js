import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiPlus, FiCamera, FiX, FiImage,
  FiType, FiTrash2, FiEye, FiVideo, FiSend,
  FiMessageCircle, FiFlag, FiExternalLink, FiChevronRight,
  FiZap,
} from 'react-icons/fi';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

const REACTIONS = ['❤️', '😂', '😮', '😢', '😡', '👍'];
const AD_EVERY_N = 5;

// ─────────────────────────────────────────────────────────────────────────────
// ViewerListModal
// ─────────────────────────────────────────────────────────────────────────────
function ViewerListModal({ statusId, viewerCount, onClose }) {
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/status/${statusId}/viewers`);
        setViewers(data.viewers || []);
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
          <div className="flex items-center gap-2">
            <FiEye size={16} className="text-gray-600" />
            <span className="font-bold text-gray-900">{viewerCount} Viewer{viewerCount !== 1 ? 's' : ''}</span>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full"><FiX size={18} /></button>
        </div>
        <div className="max-h-80 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : viewers.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">No viewers yet</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {viewers.map(v => (
                <div key={v.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                    {v.avatar_url
                      ? <img src={v.avatar_url} alt="" className="w-full h-full object-cover" />
                      : v.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{v.full_name}</p>
                    <p className="text-xs text-gray-400">
                      {v.viewed_at ? formatDistanceToNow(new Date(v.viewed_at), { addSuffix: true }) : ''}
                    </p>
                  </div>
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
  const [notes, setNotes] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setSending(true);
    try {
      await api.post('/ads/report', { campaign_id: campaignId, reason, notes });
      toast.success('Ad reported. Thank you!');
      onClose();
    } catch { toast.error('Failed to report'); }
    finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5"
        onClick={e => e.stopPropagation()}
      >
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
        <textarea
          value={notes} onChange={e => setNotes(e.target.value)}
          placeholder="Additional details (optional)"
          className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:border-[#25D366] mb-4"
          rows={2}
        />
        <button onClick={submit} disabled={sending}
          className="w-full py-2.5 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm transition">
          {sending ? 'Sending…' : 'Submit Report'}
        </button>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AdSlide — immersive sponsored card in the status viewer feed
// ─────────────────────────────────────────────────────────────────────────────
function AdSlide({ ad, onSkip, onAdvance }) {
  const [showReport, setShowReport] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const timerRef = useRef(null);
  const tokenRef = useRef(ad?.ad_token);
  const impressionSentRef = useRef(false);

  useEffect(() => {
    if (!impressionSentRef.current && ad?.id) {
      impressionSentRef.current = true;
      api.post('/ads/impression', {
        campaign_id: ad.id,
        ad_token: tokenRef.current,
        skipped: false,
      }).catch(() => {});
    }
  }, [ad?.id]);

  useEffect(() => {
    if (countdown <= 0) return;
    timerRef.current = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timerRef.current);
  }, [countdown]);

  useEffect(() => {
    const t = setTimeout(() => onAdvance(), 8000);
    return () => clearTimeout(t);
  }, [onAdvance]);

  const handleSkip = () => {
    api.post('/ads/impression', {
      campaign_id: ad.id,
      ad_token: tokenRef.current,
      skipped: true,
    }).catch(() => {});
    onSkip();
  };

  const handleCtaClick = async () => {
    try {
      const { data } = await api.post('/ads/click', {
        campaign_id: ad.id,
        ad_token: tokenRef.current,
      });
      if (data.redirect_url) {
        window.open(data.redirect_url, '_blank', 'noopener,noreferrer');
      }
    } catch { }
  };

  if (!ad) return null;

  return (
    <div className="absolute inset-0 flex flex-col bg-black">
      <div className="absolute top-20 left-4 z-20 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full tracking-widest uppercase">
        Sponsored
      </div>
      <button
        onClick={countdown > 0 ? undefined : handleSkip}
        className={`absolute top-20 right-4 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition
          ${countdown > 0 ? 'bg-black/40 text-white/60 cursor-default' : 'bg-white text-gray-900 hover:bg-white/90'}`}
      >
        {countdown > 0 ? `Skip in ${countdown}s` : 'Skip ›'}
      </button>
      <button
        onClick={() => setShowReport(true)}
        className="absolute top-[112px] right-4 z-20 p-1.5 bg-black/40 rounded-full text-white/60 hover:text-white transition"
      >
        <FiFlag size={13} />
      </button>
      <div className="flex-1 relative overflow-hidden">
        {ad.creative_url ? (
          <img src={ad.creative_url} alt="ad" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#075E54] to-[#128C7E] flex items-center justify-center px-8">
            <p className="text-white text-2xl font-bold text-center leading-snug">{ad.ad_copy}</p>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
      </div>
      <div className="flex-shrink-0 px-5 pt-3 pb-6 bg-black/80">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-full overflow-hidden bg-white/20 flex-shrink-0 flex items-center justify-center">
            {ad.sponsor_avatar
              ? <img src={ad.sponsor_avatar} alt="" className="w-full h-full object-cover" />
              : <span className="text-white text-xs font-bold">{ad.sponsor_name?.[0]}</span>}
          </div>
          <div>
            <p className="text-white font-semibold text-xs">{ad.sponsor_name}</p>
            <p className="text-white/50 text-[10px]">Sponsored</p>
          </div>
        </div>
        {ad.creative_url && ad.ad_copy && (
          <p className="text-white/90 text-sm mb-3 line-clamp-2">{ad.ad_copy}</p>
        )}
        {ad.cta_url && (
          <button
            onClick={handleCtaClick}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl text-sm transition"
          >
            <FiExternalLink size={15} />
            {ad.cta_text || 'Learn More'}
          </button>
        )}
      </div>
      {showReport && <ReportAdModal campaignId={ad.id} onClose={() => setShowReport(false)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusViewer — full-screen story viewer with ads, reactions, reply-DM
// ─────────────────────────────────────────────────────────────────────────────
function StatusViewer({ statusGroup, onClose, isOwn, allGroups = [], currentGroupIdx = 0, onNextGroup }) {
  const { user } = useAuthStore();
  const items = statusGroup?.statuses || [statusGroup];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [myReaction, setMyReaction] = useState(null);
  const [showReactions, setShowReactions] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [showReply, setShowReply] = useState(false);
  const [replySending, setReplySending] = useState(false);
  const [adData, setAdData] = useState(null);
  const [showAd, setShowAd] = useState(false);
  const adShownRef = useRef(false);
  const swipeStartRef = useRef(null);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const reactionTimeoutRef = useRef(null);

  const current = items[idx];
  const isVideo = !!(current?.media_url && (current?.media_type === 'video' || /\.(mp4|webm|mov)/i.test(current?.media_url || '')));
  const isImage = !!(current?.media_url && !isVideo);
  const DURATION = isVideo ? null : 6000;

  useEffect(() => {
    api.get('/ads/feed').then(({ data }) => {
      if (data?.ad) setAdData(data.ad);
    }).catch(() => {});
  }, []);

  const showAdSlide = useCallback(() => {
    if (adData && !adShownRef.current) {
      adShownRef.current = true;
      setShowAd(true);
    }
  }, [adData]);

  const advance = useCallback(() => {
    setShowAd(false);
    setShowReactions(false);
    setShowReply(false);
    if (idx < items.length - 1) {
      const nextIdx = idx + 1;
      if (nextIdx % AD_EVERY_N === 0 && adData && !adShownRef.current) {
        showAdSlide();
      }
      setIdx(nextIdx);
    } else {
      if (onNextGroup) onNextGroup();
      else onClose();
    }
  }, [idx, items.length, onClose, adData, showAdSlide, onNextGroup]);

  useEffect(() => {
    if (paused || isVideo || showAd || showReply) return;
    timerRef.current = setTimeout(advance, DURATION || 6000);
    return () => clearTimeout(timerRef.current);
  }, [idx, paused, isVideo, advance, DURATION, showAd, showReply]);

  useEffect(() => {
    if (current?.id && !isOwn) {
      api.post(`/status/${current.id}/view`).catch(() => {});
    }
  }, [current?.id, isOwn]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [idx]);

  const goBack = () => {
    setShowAd(false);
    if (idx > 0) setIdx(i => i - 1);
    else onClose();
  };

  const deleteStatus = async () => {
    if (!window.confirm('Delete this status?')) return;
    try {
      await api.delete(`/status/${current.id}`);
      toast.success('Status deleted');
      if (items.length <= 1) onClose();
      else advance();
    } catch { toast.error('Failed to delete'); }
  };

  const sendReaction = async (emoji) => {
    if (!current?.id) return;
    clearTimeout(reactionTimeoutRef.current);
    setMyReaction(emoji);
    setShowReactions(false);
    try {
      await api.post(`/status/${current.id}/react`, { emoji });
    } catch { }
    reactionTimeoutRef.current = setTimeout(advance, 700);
  };

  const sendReply = async () => {
    if (!replyText.trim() || !statusGroup?.owner_id) return;
    setReplySending(true);
    try {
      await api.post('/messages', {
        receiver_id: statusGroup.owner_id,
        content: `↩ Re: status\n"${current?.content?.slice(0, 60) || '📸 Photo'}"\n\n${replyText.trim()}`,
      });
      toast.success('Reply sent!');
      setReplyText('');
      setShowReply(false);
    } catch { toast.error('Failed to send reply'); }
    finally { setReplySending(false); }
  };

  const handleTouchStart = (e) => {
    swipeStartRef.current = { y: e.touches[0].clientY, t: Date.now() };
  };
  const handleTouchEnd = (e) => {
    if (!swipeStartRef.current) return;
    const dy = e.changedTouches[0].clientY - swipeStartRef.current.y;
    const dt = Date.now() - swipeStartRef.current.t;
    if (dy > 90 && dt < 500) onClose();
    swipeStartRef.current = null;
  };

  if (showAd) {
    return (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black z-50 flex flex-col select-none"
      >
        <div className="flex gap-1 px-3 pt-10 pb-2 z-10 relative">
          {items.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
              <div className="h-full bg-white rounded-full w-full" />
            </div>
          ))}
          <div className="flex-1 h-[3px] bg-[#25D366]/40 rounded-full overflow-hidden">
            <motion.div className="h-full bg-[#25D366] rounded-full"
              initial={{ width: '0%' }} animate={{ width: '100%' }}
              transition={{ duration: 8, ease: 'linear' }} />
          </div>
        </div>
        <AdSlide
          ad={adData}
          onSkip={() => setShowAd(false)}
          onAdvance={() => { setShowAd(false); advance(); }}
        />
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-10 pb-2 z-10 relative">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
            <motion.div
              key={`bar-${idx}-${i}`}
              className="h-full bg-white rounded-full"
              initial={{ width: i < idx ? '100%' : '0%' }}
              animate={{ width: i < idx ? '100%' : i === idx ? '100%' : '0%' }}
              transition={i === idx && !paused && !isVideo ? { duration: (DURATION || 6000) / 1000, ease: 'linear' } : { duration: 0 }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3 z-10 relative">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
          {statusGroup?.owner_avatar
            ? <img src={statusGroup.owner_avatar} alt="" className="w-full h-full object-cover" />
            : statusGroup?.owner_name?.[0] || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{statusGroup?.owner_name}</p>
          <p className="text-white/60 text-xs">
            {current?.created_at ? formatDistanceToNow(new Date(current.created_at), { addSuffix: true }) : ''}
          </p>
        </div>
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
          <video ref={videoRef} src={current.media_url} autoPlay playsInline
            className="w-full h-full object-contain" onEnded={advance} />
        ) : isImage && current?.media_url ? (
          <img src={current.media_url} alt="status" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center px-8"
            style={{ backgroundColor: current?.background_color || '#008069' }}>
            <p className="text-white font-bold text-center leading-snug"
              style={{ fontSize: 'clamp(20px, 5vw, 36px)' }}>
              {current?.content || ''}
            </p>
          </div>
        )}

        {(isImage || isVideo) && current?.content && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-20 pt-10">
            <p className="text-white text-base font-medium text-center">{current.content}</p>
          </div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 flex" style={{ top: 70 }}>
          <div className="flex-1"
            onClick={goBack}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
          <div className="flex-1"
            onClick={() => { if (!showReactions) advance(); }}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
        </div>

        {/* Reaction picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2 bg-black/80 backdrop-blur-sm rounded-full px-4 py-2.5 z-20"
            >
              {REACTIONS.map(emoji => (
                <button key={emoji} onClick={() => sendReaction(emoji)}
                  className={`text-2xl transition-transform hover:scale-125 ${myReaction === emoji ? 'scale-125' : ''}`}>
                  {emoji}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {myReaction && !showReactions && (
          <div className="absolute bottom-24 right-5 text-3xl z-20 pointer-events-none">{myReaction}</div>
        )}
      </div>

      {/* Reply input */}
      <AnimatePresence>
        {showReply && (
          <motion.div
            initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-black/90 border-t border-white/10 flex-shrink-0 z-20"
          >
            <input
              autoFocus
              type="text"
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') sendReply(); if (e.key === 'Escape') setShowReply(false); }}
              placeholder={`Reply to ${statusGroup?.owner_name}…`}
              className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2.5 text-sm outline-none border border-white/20 focus:border-white/40 transition"
            />
            <button onClick={sendReply} disabled={!replyText.trim() || replySending}
              className="w-10 h-10 flex items-center justify-center bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 rounded-full transition flex-shrink-0">
              <FiSend size={16} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      {!showReply && (
        <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0">
          {isOwn ? (
            <button
              onClick={() => { setPaused(true); setShowViewers(true); }}
              className="flex items-center gap-2 text-white/70 hover:text-white transition"
            >
              <FiEye size={18} />
              <span className="text-sm">{current?.viewers_count || 0} viewer{current?.viewers_count !== 1 ? 's' : ''}</span>
            </button>
          ) : (
            <>
              <button
                onClick={() => { setPaused(true); setShowReactions(v => !v); }}
                className={`flex items-center gap-1.5 text-sm transition px-3 py-2 rounded-full
                  ${showReactions ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white'}`}
              >
                {myReaction || '😊'}
              </button>
              <button
                onClick={() => { setPaused(true); setShowReply(v => !v); setShowReactions(false); }}
                className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition"
              >
                <FiMessageCircle size={18} />
                <span>Reply</span>
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
            onClose={() => { setShowViewers(false); setPaused(false); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusComposer
// ─────────────────────────────────────────────────────────────────────────────
function StatusComposer({ onClose, onPosted }) {
  const [mode, setMode] = useState('text');
  const [statusText, setStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState('#008069');
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const videoInputRef = useRef(null);

  const bgColors = [
    '#008069', '#25D366', '#075E54', '#128C7E',
    '#34B7F1', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#6366F1', '#1e293b', '#0f172a',
  ];

  const handleFileSelect = (file) => {
    if (!file) return;
    setMediaFile(file);
    setMediaPreviewUrl(URL.createObjectURL(file));
  };

  const clearMedia = () => { setMediaFile(null); setMediaPreviewUrl(null); };

  const handleShare = async () => {
    if (mode === 'text' && !statusText.trim()) return;
    if ((mode === 'image' || mode === 'video') && !mediaFile) return;
    setPosting(true);
    try {
      let media_url = null;
      if (mediaFile) {
        setUploading(true);
        const fd = new FormData();
        fd.append('file', mediaFile);
        const endpoint = mode === 'video' ? '/upload/video' : '/upload/image';
        const { data: upData } = await api.post(endpoint, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        media_url = upData.url;
        setUploading(false);
      }
      await api.post('/status', {
        content: mode === 'text' ? statusText.trim() : caption.trim(),
        background_color: mode === 'text' ? selectedBg : '#000000',
        media_url,
        media_type: mode,
      });
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

  const canShare = mode === 'text' ? statusText.trim().length > 0 : !!mediaFile;
  const bgStyle = mode === 'text' ? { backgroundColor: selectedBg } : { backgroundColor: '#111' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={bgStyle}
    >
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 flex-shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
          <FiX size={22} className="text-white" />
        </button>
        <span className="text-white font-bold text-lg flex-1">New Status</span>
        <div className="flex gap-1 bg-black/20 rounded-full p-1">
          {[
            { id: 'text', icon: FiType, label: 'Text' },
            { id: 'image', icon: FiImage, label: 'Photo' },
            { id: 'video', icon: FiVideo, label: 'Video' },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => { setMode(id); clearMedia(); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === id ? 'bg-white text-gray-900 shadow' : 'text-white/70 hover:text-white'}`}>
              <Icon size={11} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {mode === 'text' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center px-8">
            <textarea autoFocus value={statusText} onChange={e => setStatusText(e.target.value)}
              placeholder="Type a status..." maxLength={700}
              className="w-full bg-transparent text-white font-bold text-center placeholder-white/40 resize-none outline-none leading-snug"
              style={{ fontSize: 'clamp(18px, 4vw, 30px)' }} rows={5} />
          </div>
        )}
        {(mode === 'image' || mode === 'video') && !mediaPreviewUrl && (
          <div className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center">
              {mode === 'image' ? <FiImage size={44} className="text-white/50" /> : <FiVideo size={44} className="text-white/50" />}
            </div>
            <p className="text-white/60 font-medium">
              {mode === 'image' ? 'Choose a photo to share as your status' : 'Choose a video to share as your status'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {mode === 'image' ? (
                <>
                  <button onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition">
                    <FiImage size={16} /> Gallery
                  </button>
                  <button onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition">
                    <FiCamera size={16} /> Camera
                  </button>
                </>
              ) : (
                <button onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition">
                  <FiVideo size={16} /> Choose Video
                </button>
              )}
            </div>
          </div>
        )}
        {mode === 'image' && mediaPreviewUrl && (
          <div className="relative w-full h-full flex items-center justify-center">
            <img src={mediaPreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
            <button onClick={clearMedia} className="absolute top-4 left-4 p-2 bg-black/60 rounded-full hover:bg-black/80 transition">
              <FiX size={16} className="text-white" />
            </button>
          </div>
        )}
        {mode === 'video' && mediaPreviewUrl && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video src={mediaPreviewUrl} controls playsInline className="max-w-full max-h-full" />
            <button onClick={clearMedia} className="absolute top-4 left-4 p-2 bg-black/60 rounded-full hover:bg-black/80 transition">
              <FiX size={16} className="text-white" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-4 pb-10 pt-2">
        {mode === 'text' && (
          <>
            <p className="text-center text-white/40 text-xs mb-3">{700 - statusText.length} characters remaining</p>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {bgColors.map(color => (
                <button key={color} onClick={() => setSelectedBg(color)}
                  className={`w-9 h-9 rounded-full flex-shrink-0 transition-all border-2 ${selectedBg === color ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: color }} />
              ))}
            </div>
          </>
        )}
        {(mode === 'image' || mode === 'video') && mediaPreviewUrl && (
          <div className="flex items-center gap-3 mb-4">
            <input type="text" placeholder="Add a caption..." value={caption} onChange={e => setCaption(e.target.value)}
              className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3 outline-none text-sm border border-white/10 focus:border-white/30 transition" />
          </div>
        )}
        <button onClick={handleShare} disabled={!canShare || posting}
          className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-base">
          {uploading
            ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
            : posting
              ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting…</>
              : <><FiSend size={18} /> Share Status</>}
        </button>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => handleFileSelect(e.target.files?.[0])} />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden"
        onChange={e => handleFileSelect(e.target.files?.[0])} />
    </motion.div>
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

  useEffect(() => { loadStatuses(); }, []);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/status/all');
      setStatuses(data.statuses || []);
      setMyStatuses(data.my_statuses || []);
    } catch { setStatuses([]); }
    finally { setLoading(false); }
  };

  const openStatusGroup = (group, idx, isOwn = false) => {
    setViewingGroup(group);
    setViewingGroupIdx(idx);
    setViewingOwn(isOwn);
  };

  const openMyStatus = () => {
    if (myStatuses.length > 0) {
      openStatusGroup(
        { owner_name: user?.full_name || 'Me', owner_avatar: user?.avatar_url, owner_id: user?.id, statuses: myStatuses },
        -1,
        true,
      );
    } else {
      setShowCompose(true);
    }
  };

  const handleNextGroup = () => {
    const nextIdx = viewingGroupIdx + 1;
    if (nextIdx >= 0 && nextIdx < statuses.length) {
      openStatusGroup(statuses[nextIdx], nextIdx, false);
    } else {
      setViewingGroup(null);
    }
  };

  const avatarInitial = user?.full_name?.[0]?.toUpperCase() || '?';
  const latestMine = myStatuses[0];
  const mineHasImage = latestMine?.media_url && (latestMine?.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(latestMine?.media_url || ''));

  return (
    <>
      <div className="flex flex-col h-full bg-white overflow-y-auto">
        {/* My Status */}
        <div className="border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-1">My Status</p>
          <div className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-4 py-3 transition-colors" onClick={openMyStatus}>
            <div className="relative flex-shrink-0">
              <div className={`w-14 h-14 rounded-full p-0.5 ${myStatuses.length > 0 ? 'bg-gradient-to-br from-green-400 to-teal-600' : 'bg-gray-200'}`}>
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-100">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : mineHasImage ? (
                    <img src={latestMine.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center font-bold text-xl text-white"
                      style={{ backgroundColor: latestMine?.background_color || '#25D366' }}>
                      {latestMine ? '' : avatarInitial}
                    </div>
                  )}
                </div>
              </div>
              <button onClick={e => { e.stopPropagation(); setShowCompose(true); }}
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#25D366] rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-[#1fbd5a] transition">
                <FiPlus size={13} className="text-white" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm">My Status</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {myStatuses.length > 0
                  ? `${myStatuses.length} update${myStatuses.length !== 1 ? 's' : ''} · ${formatDistanceToNow(new Date(latestMine.created_at), { addSuffix: true })}`
                  : 'Tap to add a status update'}
              </p>
            </div>
            <FiChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </div>
        </div>

        {/* Recent Updates */}
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : statuses.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <FiEye size={32} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-600 mb-1">No recent updates</p>
            <p className="text-sm text-gray-400">Status updates from your contacts will appear here.</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-1">Recent Updates</p>
            <div className="divide-y divide-gray-50">
              {statuses.map((group, gIdx) => {
                const latest = group.statuses?.[0];
                const hasImage = latest?.media_url && (latest?.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(latest?.media_url || ''));
                const unviewed = group.statuses?.some(s => !s.viewed_by_me);
                return (
                  <div key={group.owner_id}
                    className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-4 py-3 transition-colors"
                    onClick={() => openStatusGroup(group, gIdx, false)}
                  >
                    <div className={`w-14 h-14 rounded-full p-0.5 flex-shrink-0 ${unviewed ? 'bg-gradient-to-br from-green-400 to-teal-600' : 'bg-gray-200'}`}>
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-100">
                        {group.owner_avatar ? (
                          <img src={group.owner_avatar} alt="" className="w-full h-full object-cover" />
                        ) : hasImage ? (
                          <img src={latest.media_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-xl text-white"
                            style={{ backgroundColor: latest?.background_color || '#25D366' }}>
                            {group.owner_name?.[0]?.toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{group.owner_name}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {latest?.created_at ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true }) : ''}
                        {group.statuses?.length > 1 ? ` · ${group.statuses.length} updates` : ''}
                      </p>
                    </div>
                    {unviewed && <div className="w-2.5 h-2.5 rounded-full bg-[#25D366] flex-shrink-0" />}
                    <FiChevronRight size={16} className="text-gray-300 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Advertise promo for verified/admin users */}
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
              <a href="/advertise"
                className="flex-shrink-0 px-3 py-1.5 bg-[#25D366] text-white text-xs font-bold rounded-full hover:bg-[#1fbd5a] transition">
                Start
              </a>
            </div>
          </div>
        )}
      </div>

      <AnimatePresence>
        {viewingGroup && (
          <StatusViewer
            key={viewingGroup.owner_id || 'own'}
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
            onPosted={loadStatuses}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default StatusTab;
