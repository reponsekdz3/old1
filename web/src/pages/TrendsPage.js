import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiHeart, FiShare2, FiMessageCircle, FiPlay,
  FiVolume2, FiVolumeX, FiArrowLeft,
  FiTrendingUp, FiStar, FiClock,
  FiSkipForward, FiX, FiSend,
  FiGrid, FiMusic, FiActivity, FiZap, FiRss, FiSmile,
  FiBook, FiCpu, FiExternalLink, FiMaximize, FiBookmark, FiChevronUp, FiChevronDown,
  FiUpload, FiCheck, FiCornerDownRight,
} from 'react-icons/fi';
import { MdOutlineSubscriptions } from 'react-icons/md';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

// Icon/colour metadata for each category ID — UI-only, no business logic
const CATEGORY_META = {
  all:       { label: 'All',     icon: FiGrid,     color: 'text-orange-400' },
  music:     { label: 'Music',   icon: FiMusic,    color: 'text-pink-400' },
  sports:    { label: 'Sports',  icon: FiActivity, color: 'text-green-400' },
  gaming:    { label: 'Gaming',  icon: FiZap,      color: 'text-purple-400' },
  news:      { label: 'News',    icon: FiRss,      color: 'text-blue-400' },
  comedy:    { label: 'Comedy',  icon: FiSmile,    color: 'text-yellow-400' },
  education: { label: 'Learn',   icon: FiBook,     color: 'text-teal-400' },
  tech:      { label: 'Tech',    icon: FiCpu,      color: 'text-sky-400' },
};

// ── Skeleton shimmer ──────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-white/10 rounded-lg ${className}`} />;
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose, categories: propCats = [] }) {
  const [step, setStep] = useState('select');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [tags, setTags] = useState('');
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/')) { toast.error('Please select a video file'); return; }
    setFile(f);
    setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
    setPreview(URL.createObjectURL(f));
    setStep('details');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Add a title'); return; }
    setStep('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data: uploadData } = await api.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          setProgress(Math.round((e.loaded * 80) / (e.total || 1)));
        },
      });
      setProgress(90);
      await api.post('/trends/upload', {
        title: title.trim(),
        description: description.trim(),
        video_url: uploadData.url,
        category: category === 'all' ? 'general' : category,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      });
      setProgress(100);
      setStep('done');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed');
      setStep('details');
    }
  };

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-bold">Upload Video</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white transition"><FiX size={20} /></button>
        </div>

        {step === 'select' && (
          <div className="p-6">
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center gap-4 cursor-pointer transition-all ${dragOver ? 'border-[#25D366] bg-[#25D366]/10' : 'border-white/20 hover:border-white/40 hover:bg-white/5'}`}
            >
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <FiUpload size={28} className="text-white/40" />
              </div>
              <div className="text-center">
                <p className="text-white font-bold">Drag & drop or click to select</p>
                <p className="text-white/40 text-sm mt-1">MP4, MOV, AVI, WebM · up to 100MB</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {step === 'details' && (
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {preview && (
              <video src={preview} className="w-full aspect-video rounded-xl bg-black object-contain" muted controls />
            )}
            <div>
              <label className="text-xs font-bold text-white/50 mb-1 block">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#25D366] rounded-xl px-4 py-3 text-sm outline-none transition"
                placeholder="Give your video a title" />
            </div>
            <div>
              <label className="text-xs font-bold text-white/50 mb-1 block">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#25D366] rounded-xl px-4 py-3 text-sm outline-none transition resize-none"
                placeholder="Describe your video..." rows={3} />
            </div>
            <div>
              <label className="text-xs font-bold text-white/50 mb-1 block">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full bg-[#1a1a1a] border border-white/10 focus:border-[#25D366] rounded-xl px-4 py-3 text-sm outline-none transition text-white">
                {propCats.filter(id => id !== 'all').map(id => {
                  const meta = CATEGORY_META[id] || { label: id };
                  return <option key={id} value={id}>{meta.label}</option>;
                })}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-white/50 mb-1 block">Tags (comma-separated)</label>
              <input value={tags} onChange={e => setTags(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#25D366] rounded-xl px-4 py-3 text-sm outline-none transition"
                placeholder="vipchat, trending, music" />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setStep('select')} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition">Back</button>
              <button onClick={handleSubmit} disabled={!title.trim()} className="flex-1 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl transition disabled:opacity-40">Upload</button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div className="p-12 flex flex-col items-center gap-6">
            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <motion.div className="bg-[#25D366] h-2 rounded-full" style={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
            </div>
            <p className="text-white/60 text-sm">{progress < 85 ? `Uploading file… ${progress}%` : 'Creating video record…'}</p>
          </div>
        )}

        {step === 'done' && (
          <div className="p-12 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-[#25D366]/20 flex items-center justify-center">
              <FiCheck size={36} className="text-[#25D366]" />
            </div>
            <h3 className="text-xl font-bold">Uploaded!</h3>
            <p className="text-white/50 text-sm text-center">Your video is pending admin review and will be published soon.</p>
            <button onClick={onClose} className="mt-2 px-8 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-full transition">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Ad Overlay ────────────────────────────────────────────────────────────────
function AdOverlay({ ad, onSkip }) {
  const [countdown, setCountdown] = useState(ad?.ad_skip_after_sec || 10);
  const [canSkip, setCanSkip] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (countdown <= 0) { setCanSkip(true); return; }
    const t = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (videoRef.current && ad?.video_url) videoRef.current.play().catch(() => {});
  }, [ad]);

  if (!ad) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black z-30 flex flex-col">
      <video ref={videoRef} src={ad.video_url} className="w-full h-full object-cover" autoPlay playsInline onEnded={onSkip} />
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <span className="bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full">Ad · {ad.ad_sponsor_name || 'Sponsor'}</span>
          {canSkip ? (
            <button onClick={onSkip} className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-sm font-bold px-3 py-1.5 rounded-full hover:bg-white/30 transition">
              Skip <FiSkipForward size={14} />
            </button>
          ) : (
            <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">Skip in {countdown}s</span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 max-w-xs">
            <p className="text-white font-semibold text-sm">{ad.title}</p>
            {ad.ad_url && (
              <a href={ad.ad_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-400 text-xs mt-1 hover:underline">
                Learn more <FiExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Single Video Player ───────────────────────────────────────────────────────
function VideoCard({ video, isActive, onLike, isLoggedIn, userId }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [preRollAd, setPreRollAd] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [loadingComment, setLoadingComment] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const commentsNextCursorRef = useRef(null);
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [quality, setQuality] = useState('auto');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes || 0);
  const [commentsCount, setCommentsCount] = useState(video.comments_count || 0);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  useEffect(() => {
    if (isActive && videoRef.current) {
      // Persist view count for all users
      api.post(`/trends/video/${video.id}/view`).catch(() => {});
      if (!isLoggedIn) {
        api.get(`/trends/video/${video.id}`).then(({ data }) => {
          if (data.pre_roll_ad) { setPreRollAd(data.pre_roll_ad); setShowAd(true); }
          else playVideo();
        }).catch(() => playVideo());
      } else {
        playVideo();
      }
    } else if (!isActive && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [isActive]); // eslint-disable-line

  const playVideo = () => {
    if (videoRef.current) videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!liked) handleLike();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
    } else togglePlay();
    setLastTap(now);
  };

  const handleLike = async () => {
    if (!isLoggedIn) { toast.error('Log in to like videos'); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(v => newLiked ? v + 1 : Math.max(0, v - 1));
    try { await api.post(`/trends/video/${video.id}/like`); }
    catch { setLiked(!newLiked); setLikesCount(v => newLiked ? Math.max(0, v - 1) : v + 1); }
  };

  const handleShare = async () => {
    try {
      const { data } = await api.post(`/trends/video/${video.id}/share`);
      const shareUrl = `${window.location.origin}${data.share_url}`;
      if (navigator.share) navigator.share({ title: video.title, url: shareUrl });
      else { navigator.clipboard.writeText(shareUrl); toast.success('Link copied!'); }
    } catch {
      const fallback = `${window.location.origin}/trends?v=${video.id}`;
      navigator.clipboard?.writeText(fallback);
      toast.success('Link copied!');
    }
  };

  const loadComments = async (cursor = null, append = false) => {
    try {
      const cursorParam = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const { data } = await api.get(`/trends/video/${video.id}/comments${cursorParam}`);
      setComments(prev => append ? [...prev, ...(data.comments || [])] : (data.comments || []));
      setCommentsHasMore(data.has_more || false);
      commentsNextCursorRef.current = data.next_cursor || null;
    } catch {}
  };

  const deleteComment = async (commentId) => {
    try {
      await api.delete(`/trends/video/${video.id}/comment/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      setCommentsCount(v => Math.max(0, v - 1));
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to delete'); }
  };

  const saveEdit = async (commentId) => {
    if (!editingText.trim()) return;
    try {
      await api.put(`/trends/video/${video.id}/comment/${commentId}`, { content: editingText.trim() });
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, content: editingText.trim() } : c));
      setEditingId(null);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to edit'); }
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    if (!isLoggedIn) { toast.error('Log in to comment'); return; }
    setLoadingComment(true);
    try {
      await api.post(`/trends/video/${video.id}/comment`, {
        content: comment,
        parent_id: replyTo?.id || null,
      });
      setComment('');
      setReplyTo(null);
      if (!replyTo) setCommentsCount(v => v + 1);
      loadComments();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setLoadingComment(false); }
  };

  const isAdVideo = video._is_injected_ad || video.is_ad;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      <video ref={videoRef}
        src={quality === 'sd' && video.video_url_sd ? video.video_url_sd : (quality === 'hd' && video.video_url_hd ? video.video_url_hd : video.video_url)}
        className="max-h-full w-auto object-contain cursor-pointer"
        loop playsInline muted={muted}
        onTimeUpdate={() => {
          if (videoRef.current) setProgress((videoRef.current.currentTime / videoRef.current.duration) * 100);
        }}
        onClick={handleDoubleTap}
        poster={video.thumbnail_url}
      />

      <AnimatePresence>
        {showAd && preRollAd && (
          <AdOverlay ad={preRollAd} onSkip={() => { setShowAd(false); playVideo(); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showHeartBurst && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1.5, opacity: 1 }} exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <FiHeart size={100} className="text-red-500 fill-red-500 shadow-xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!playing && !showAd && (
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center">
              <FiPlay size={36} className="text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isAdVideo && !showAd && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
          AD · {video.ad_sponsor_name || 'Sponsored'}
        </div>
      )}

      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-3 pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-teal-500 flex items-center justify-center text-white font-bold text-sm border-2 border-white/20">
              {video.uploader_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-white font-bold text-sm">{video.uploader_name}</p>
              <p className="text-[#25D366] text-xs font-bold">{video.category}</p>
            </div>
          </div>
          <p className="text-white text-sm font-medium line-clamp-2 mb-2">{video.title}</p>
          {video.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {video.tags.slice(0, 3).map(tag => (
                <span key={tag} className="text-[#25D366] text-[10px] font-bold">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-10">
        <button onClick={handleLike} className="flex flex-col items-center gap-1">
          <motion.div whileTap={{ scale: 0.8 }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${liked ? 'bg-red-500/20' : 'bg-black/40 hover:bg-black/60'}`}>
            <FiHeart size={24} className={liked ? 'text-red-500 fill-red-500' : 'text-white'} />
          </motion.div>
          <span className="text-white text-xs font-bold drop-shadow-md">{likesCount.toLocaleString()}</span>
        </button>

        <button onClick={() => { setShowComments(v => !v); if (!showComments) loadComments(); }}
          className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all">
            <FiMessageCircle size={24} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-md">{commentsCount.toLocaleString()}</span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all">
            <FiBookmark size={24} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-md">Save</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all">
            <FiShare2 size={24} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-md">{(video.shares || 0).toLocaleString()}</span>
        </button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-black/40 backdrop-blur-sm flex flex-col gap-2 z-20 group">
        <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer relative overflow-hidden group-hover:h-2 transition-all"
          onClick={e => {
            if (videoRef.current) {
              const rect = e.currentTarget.getBoundingClientRect();
              videoRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * videoRef.current.duration;
            }
          }}>
          <div className="absolute left-0 top-0 bottom-0 bg-[#25D366]" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-[#25D366] transition">
              {playing ? <FiX size={18} /> : <FiPlay size={18} />}
            </button>
            <button onClick={() => setMuted(v => !v)} className="text-white hover:text-[#25D366] transition">
              {muted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative">
              <button onClick={() => { setShowQualityMenu(v => !v); setShowSpeedMenu(false); }}
                className="text-white text-xs font-bold hover:text-[#25D366] transition flex items-center gap-1">
                <span>{quality === 'auto' ? 'Auto' : quality.toUpperCase()}</span>
                {quality === 'hd' && <span className="text-[9px] bg-[#25D366]/20 text-[#25D366] px-1 rounded">HD</span>}
              </button>
              {showQualityMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/10 rounded-lg overflow-hidden py-1 min-w-[72px] z-50">
                  {[
                    { id: 'auto', label: 'Auto', available: true },
                    { id: 'hd', label: 'HD 1080p', available: !!(video.video_url_hd || video.video_url) },
                    { id: 'sd', label: 'SD 480p', available: !!(video.video_url_sd || video.video_url) },
                  ].map(q => (
                    <button key={q.id} onClick={() => { setQuality(q.id); setShowQualityMenu(false); }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-white/10 flex items-center justify-between
                        ${quality === q.id ? 'text-[#25D366]' : q.available ? 'text-white' : 'text-white/30 cursor-not-allowed'}`}
                      disabled={!q.available}>
                      {q.label}
                      {quality === q.id && <span>✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative">
              <button onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }} className="text-white text-xs font-bold hover:text-[#25D366] transition">
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/10 rounded-lg overflow-hidden py-1 min-w-[60px]">
                  {[0.5, 1, 1.5, 2].map(speed => (
                    <button key={speed} onClick={() => { setPlaybackSpeed(speed); if (videoRef.current) videoRef.current.playbackRate = speed; setShowSpeedMenu(false); }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-white/10 ${playbackSpeed === speed ? 'text-[#25D366]' : 'text-white'}`}>
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => {
              if (!document.fullscreenElement) containerRef.current?.requestFullscreen().catch(() => {});
              else document.exitFullscreen();
            }} className="text-white hover:text-[#25D366] transition">
              <FiMaximize size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Comments drawer */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur-sm rounded-t-3xl max-h-[60%] flex flex-col z-30">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <p className="text-white font-bold text-sm">{commentsCount} Comments</p>
              <button onClick={() => setShowComments(false)}><FiX size={20} className="text-white/70" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 && <p className="text-white/50 text-sm text-center py-4">No comments yet. Be first!</p>}
              {comments.map(c => (
                <div key={c.id}>
                  <div className="flex gap-2">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                      {c.user_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-white/70 text-[11px] font-semibold">{c.user_name}</p>
                      {editingId === c.id ? (
                        <div className="flex gap-1 mt-1">
                          <input value={editingText} onChange={e => setEditingText(e.target.value)} autoFocus
                            className="flex-1 bg-white/10 text-white text-sm rounded px-2 py-1 outline-none focus:ring-1 focus:ring-white/30" />
                          <button onClick={() => saveEdit(c.id)} className="text-[#25D366] text-xs font-bold px-2">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-white/40 text-xs px-1"><FiX size={12} /></button>
                        </div>
                      ) : (
                        <p className="text-white text-sm">{c.content}</p>
                      )}
                      <div className="flex gap-3 mt-1">
                        <button onClick={() => setReplyTo(c)} className="text-[10px] text-[#25D366] font-bold hover:underline">Reply</button>
                        {userId && c.user_id === userId && editingId !== c.id && (
                          <>
                            <button onClick={() => { setEditingId(c.id); setEditingText(c.content); }} className="text-[10px] text-white/40 hover:text-white/70">Edit</button>
                            <button onClick={() => deleteComment(c.id)} className="text-[10px] text-red-400/70 hover:text-red-400">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  {c.replies?.length > 0 && (
                    <div className="ml-9 mt-2 space-y-2">
                      {c.replies.map(r => (
                        <div key={r.id} className="flex gap-2">
                          <FiCornerDownRight size={10} className="text-white/30 mt-1 flex-shrink-0" />
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0">
                            {r.user_name?.[0]?.toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white/60 text-[10px] font-semibold">{r.user_name}</p>
                            <p className="text-white/90 text-xs">{r.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {commentsHasMore && (
                <button onClick={() => loadComments(commentsNextCursorRef.current, true)}
                  className="w-full text-xs text-white/50 hover:text-white py-2 border border-white/10 rounded-lg transition">
                  Load more comments
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2 p-3 border-t border-white/10">
              {replyTo && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <span className="text-white/50 text-xs flex-1">Replying to {replyTo.user_name}</span>
                  <button onClick={() => setReplyTo(null)}><FiX size={12} className="text-white/40" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment()}
                  placeholder={replyTo ? `Reply to ${replyTo.user_name}…` : 'Add a comment…'}
                  className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30" />
                <button onClick={submitComment} disabled={loadingComment || !comment.trim()}
                  className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center disabled:opacity-40">
                  <FiSend size={15} className="text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Trends Page ───────────────────────────────────────────────────────────
export default function TrendsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('trending');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const nextCursorRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('scroll');
  const [feedType, setFeedType] = useState('for-you');
  const [uploadOpen, setUploadOpen] = useState(false);

  // API-backed categories
  const [categories, setCategories] = useState([]);

  // Sidebar real data
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  // Right panel comments
  const [rightComments, setRightComments] = useState([]);
  const [rightCommentText, setRightCommentText] = useState('');
  const [rightCommentLoading, setRightCommentLoading] = useState(false);
  const [rightReplyTo, setRightReplyTo] = useState(null);
  const [rightCommentsLoading, setRightCommentsLoading] = useState(false);

  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const loadingMore = useRef(false);

  // Fetch sidebar data + category list once
  useEffect(() => {
    setSidebarLoading(true);
    Promise.all([
      api.get('/trends/hashtags/trending?limit=8').catch(() => ({ data: { hashtags: [] } })),
      api.get('/trends/creators/top?limit=5').catch(() => ({ data: { creators: [] } })),
      api.get('/trends/categories').catch(() => ({ data: { categories: Object.keys(CATEGORY_META) } })),
    ]).then(([hashRes, creatRes, catRes]) => {
      setTrendingHashtags(hashRes.data.hashtags || []);
      setTopCreators(creatRes.data.creators || []);
      setCategories(catRes.data.categories || Object.keys(CATEGORY_META));
    }).finally(() => setSidebarLoading(false));
  }, []);

  // Resolve ?s=<share_token> — load the shared video and focus it
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('s');
    if (!token) return;
    api.get(`/trends/video/by-token/${token}`).then(({ data }) => {
      if (data.video) {
        setVideos(prev => {
          const exists = prev.findIndex(v => v.id === data.video.id);
          if (exists >= 0) { setActiveIdx(exists); return prev; }
          setActiveIdx(0);
          return [data.video, ...prev];
        });
        navigate('/trends', { replace: true });
        toast.success('Shared video loaded');
      }
    }).catch(() => toast.error('Share link not found'));
  }, [location.search]); // eslint-disable-line

  // Fetch right panel comments when active video changes
  useEffect(() => {
    if (!videos[activeIdx] || viewMode !== 'scroll') return;
    const vid = videos[activeIdx];
    setRightComments([]);
    setRightReplyTo(null);
    setRightCommentsLoading(true);
    api.get(`/trends/video/${vid.id}/comments`)
      .then(({ data }) => setRightComments(data.comments || []))
      .catch(() => {})
      .finally(() => setRightCommentsLoading(false));
  }, [activeIdx, viewMode, videos]);

  const fetchVideos = useCallback(async (cat = category, s = sort, cursor = null, append = false) => {
    if (loadingMore.current && append) return;
    if (append) loadingMore.current = true;
    else { setLoading(true); nextCursorRef.current = null; }
    try {
      const cursorParam = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
      const endpoint = searchQuery
        ? `/trends/search?q=${encodeURIComponent(searchQuery)}${cursorParam}`
        : `/trends/feed?category=${cat}&sort=${s}&feed=${feedType}${cursorParam}`;
      const { data } = await api.get(endpoint);
      const newVideos = data.videos || [];
      setVideos(prev => append ? [...prev, ...newVideos] : newVideos);
      setHasMore(data.has_more || false);
      nextCursorRef.current = data.next_cursor || null;
    } catch {
      if (!append) toast.error('Failed to load videos');
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [category, sort, searchQuery, feedType]);

  useEffect(() => {
    api.get('/trends/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setActiveIdx(0);
    fetchVideos(category, sort, null, false);
  }, [category, sort, searchQuery, feedType]); // eslint-disable-line

  useEffect(() => {
    if (viewMode !== 'scroll') return;
    const cards = containerRef.current?.querySelectorAll('[data-video-card]');
    if (!cards?.length) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const idx = parseInt(entry.target.dataset.idx, 10);
          setActiveIdx(idx);
          if (idx >= videos.length - 3 && hasMore && !loadingMore.current) {
            fetchVideos(category, sort, nextCursorRef.current, true);
          }
        }
      });
    }, { threshold: 0.6 });
    cards.forEach(card => observerRef.current.observe(card));
    return () => observerRef.current?.disconnect();
  }, [videos, viewMode, hasMore, category, sort]); // eslint-disable-line

  const submitRightComment = async () => {
    if (!rightCommentText.trim() || !user) return;
    const vid = videos[activeIdx];
    if (!vid) return;
    setRightCommentLoading(true);
    try {
      await api.post(`/trends/video/${vid.id}/comment`, {
        content: rightCommentText.trim(),
        parent_id: rightReplyTo?.id || null,
      });
      setRightCommentText('');
      setRightReplyTo(null);
      const { data } = await api.get(`/trends/video/${vid.id}/comments`);
      setRightComments(data.comments || []);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setRightCommentLoading(false); }
  };

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">

      {/* ── Upload Modal ── */}
      <AnimatePresence>
        {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} categories={categories} />}
      </AnimatePresence>

      {/* ── Left Sidebar ── */}
      <div className="hidden lg:flex w-[280px] flex-col border-r border-white/10 bg-[#0a0a0a] shrink-0 overflow-y-auto no-scrollbar">
        {user ? (
          <div className="p-6 pb-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center text-white font-bold text-lg border-2 border-white/10">
                {user.name?.[0]?.toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <p className="font-bold text-sm truncate">{user.name}</p>
                <p className="text-white/40 text-xs truncate">@{user.username || 'user'}</p>
              </div>
            </div>
            {stats && (
              <div className="flex gap-4 text-xs">
                <span className="text-white/60"><strong className="text-white">{(stats.total_videos || 0).toLocaleString()}</strong> Videos</span>
                <span className="text-white/60"><strong className="text-white">{(stats.total_views || 0).toLocaleString()}</strong> Views</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6">
            <p className="text-white/60 text-sm mb-4">Log in to like, comment, and upload videos.</p>
            <button onClick={() => navigate('/login')} className="w-full py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-lg transition">Log in</button>
          </div>
        )}

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Navigation */}
        <nav className="px-4 space-y-1">
          {[
            { id: 'for-you', label: 'For You', icon: FiPlay },
            { id: 'trending', label: 'Trending', icon: FiTrendingUp },
          ].map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setFeedType(id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-lg ${feedType === id ? 'text-[#25D366] bg-white/5' : 'text-white/60 hover:bg-white/5'}`}>
              <Icon /> {label}
            </button>
          ))}
        </nav>

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Top Creators */}
        <div className="px-6 py-2">
          <p className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider">Top Creators</p>
          <div className="space-y-4">
            {sidebarLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="w-8 h-8 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-2 w-16 rounded" />
                  </div>
                </div>
              ))
            ) : topCreators.length === 0 ? (
              <p className="text-white/30 text-xs">No creators yet</p>
            ) : (
              topCreators.map(creator => (
                <div key={creator.id} className="flex items-center justify-between group cursor-pointer">
                  <div className="flex items-center gap-3">
                    {creator.avatar_url ? (
                      <img src={creator.avatar_url} alt={creator.name} className="w-8 h-8 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center text-white text-[10px] font-bold border border-white/10">
                        {creator.avatar}
                      </div>
                    )}
                    <div>
                      <p className="text-xs font-bold group-hover:underline">{creator.name}</p>
                      <p className="text-white/40 text-[10px]">{creator.username} · {creator.followers} views</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Categories — IDs from API, icons from local lookup */}
        <div className="px-6 py-2">
          <p className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider">Explore Topics</p>
          <div className="space-y-1">
            {(categories.length ? categories : Object.keys(CATEGORY_META)).map(id => {
              const meta = CATEGORY_META[id] || { label: id, icon: FiGrid, color: 'text-white/40' };
              const Icon = meta.icon;
              return (
                <button key={id} onClick={() => setCategory(id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${category === id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                  <Icon className={category === id ? 'text-[#25D366]' : meta.color} size={14} />
                  {meta.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Trending Hashtags */}
        <div className="px-6 py-2">
          <p className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider">Trending Hashtags</p>
          <div className="space-y-4">
            {sidebarLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-1">
                  <Skeleton className="h-3 w-28 rounded" />
                  <Skeleton className="h-2 w-16 rounded ml-5" />
                </div>
              ))
            ) : trendingHashtags.length === 0 ? (
              <p className="text-white/30 text-xs">No hashtags yet — upload a video with tags!</p>
            ) : (
              trendingHashtags.map(h => (
                <div key={h.tag} className="group cursor-pointer"
                  onClick={() => { setSearch(h.tag); setSearchQuery(h.tag); }}>
                  <p className="text-sm font-medium hover:underline flex items-center gap-2">
                    <FiActivity size={12} className="text-white/40" /> {h.tag}
                  </p>
                  <p className="text-[10px] text-white/40 ml-5">{h.counts} videos</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto p-6 space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/30 font-medium">
            <button className="hover:underline">About</button>
            <button className="hover:underline">Contact</button>
            <button className="hover:underline">Advertise</button>
          </div>
          <p className="text-[10px] text-white/20 pt-2">© 2025 VipTrends</p>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-[72px] border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-6 z-40 shrink-0">
          <div className="flex items-center gap-4 lg:hidden">
            <button onClick={() => navigate(user ? '/' : '/login')} className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center">
              <MdOutlineSubscriptions size={20} className="text-white" />
            </button>
          </div>

          <div className="flex-1 max-w-xl mx-auto px-4">
            <div className="relative group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#25D366] transition-colors" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setSearchQuery(search.trim())}
                type="text" placeholder="Search accounts and videos"
                className="w-full bg-white/5 border border-transparent focus:border-white/20 focus:bg-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm transition-all outline-none" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-1 bg-white/5 rounded-full p-1 border border-white/10">
              <button onClick={() => setViewMode('scroll')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${viewMode === 'scroll' ? 'bg-[#25D366] text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
                Shorts
              </button>
              <button onClick={() => setViewMode('grid')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition ${viewMode === 'grid' ? 'bg-[#25D366] text-white shadow-lg' : 'text-white/50 hover:text-white'}`}>
                Browse
              </button>
            </div>

            {user && (
              <button onClick={() => setUploadOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-full text-sm transition">
                <FiUpload size={15} /> Upload
              </button>
            )}

            {!user ? (
              <button onClick={() => navigate('/login')} className="px-6 py-2 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-lg text-sm transition">Log in</button>
            ) : (
              <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition">
                <FiArrowLeft />
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto no-scrollbar relative snap-y snap-mandatory bg-black">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
              <p className="text-white/40 text-sm animate-pulse">Tailoring your feed…</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
                <MdOutlineSubscriptions size={40} className="text-white/20" />
              </div>
              <h2 className="text-2xl font-bold mb-2">No videos yet</h2>
              <p className="text-white/40 max-w-xs mb-8">
                {searchQuery ? `No results for "${searchQuery}"` : 'Check back later for new content.'}
              </p>
              <button onClick={() => { setFeedType('for-you'); setCategory('all'); setSearchQuery(''); setSearch(''); }}
                className="px-8 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-full transition">
                Refresh Feed
              </button>
            </div>
          ) : viewMode === 'scroll' ? (
            <div ref={containerRef} className="h-full w-full">
              {videos.map((video, idx) => (
                <div key={`${video.id}-${idx}`} data-video-card data-idx={idx}
                  className="h-full w-full snap-start relative flex items-center justify-center">
                  <div className="relative w-full h-full max-w-[500px] bg-black shadow-2xl overflow-hidden">
                    <VideoCard video={video} isActive={activeIdx === idx} isLoggedIn={!!user} userId={user?.id} />
                  </div>
                  <div className="hidden xl:flex absolute left-full ml-8 flex-col gap-4">
                    <button onClick={() => containerRef.current.scrollBy({ top: -window.innerHeight, behavior: 'smooth' })}
                      className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition">
                      <FiChevronUp size={24} />
                    </button>
                    <button onClick={() => containerRef.current.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
                      className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition">
                      <FiChevronDown size={24} />
                    </button>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="h-20 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {videos.filter(v => !v._is_injected_ad).map(video => (
                  <motion.div key={video.id}
                    initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="relative group cursor-pointer"
                    onClick={() => { setViewMode('scroll'); setActiveIdx(videos.findIndex(v => v.id === video.id)); }}>
                    <div className="aspect-[9/16] rounded-xl overflow-hidden bg-gray-900 border border-white/5 relative">
                      {video.thumbnail_url ? (
                        <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                          <FiPlay size={32} className="text-white/20" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                        <p className="text-white text-xs font-bold line-clamp-2 mb-2">{video.title}</p>
                        <div className="flex items-center gap-2">
                          <FiPlay size={10} className="text-white/60" />
                          <span className="text-[10px] text-white/60">{(video.views || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      {video.is_ad && (
                        <span className="absolute top-2 left-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">AD</span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-12 mb-8">
                  <button onClick={() => fetchVideos(category, sort, nextCursorRef.current, true)}
                    className="px-12 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full border border-white/10 transition">
                    Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Right Panel — Comments ── */}
      <AnimatePresence>
        {activeIdx !== null && videos[activeIdx] && viewMode === 'scroll' && (
          <motion.div initial={{ x: 320 }} animate={{ x: 0 }} exit={{ x: 320 }}
            className="hidden xl:flex w-[350px] flex-col border-l border-white/10 bg-[#0a0a0a] shrink-0 overflow-hidden">
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center text-white font-bold border-2 border-white/10">
                  {videos[activeIdx].uploader_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold hover:underline cursor-pointer">{videos[activeIdx].uploader_name}</p>
                  <p className="text-white/40 text-xs">@{videos[activeIdx].uploader_name?.toLowerCase().replace(/\s/g, '')}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed mb-4">{videos[activeIdx].title}</p>
              {videos[activeIdx].tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-4">
                  {videos[activeIdx].tags.map(tag => (
                    <span key={tag} className="bg-white/5 text-[#25D366] text-[10px] font-bold px-2 py-0.5 rounded-full">#{tag}</span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-6 py-4 border-y border-white/5">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <FiHeart className="text-red-500 fill-red-500" /> {videos[activeIdx].likes?.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-white/60">
                  <FiMessageCircle /> {videos[activeIdx].comments_count?.toLocaleString() || 0}
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-white/60">
                  <FiShare2 /> {videos[activeIdx].shares?.toLocaleString() || 0}
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Comments</p>
              {rightCommentsLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-24 rounded" />
                      <Skeleton className="h-3 w-40 rounded" />
                    </div>
                  </div>
                ))
              ) : rightComments.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No comments yet. Be first!</p>
              ) : (
                rightComments.map(c => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#25D366] to-teal-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {c.user_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold mb-1">{c.user_name} <span className="text-white/20 font-medium ml-2">{new Date(c.created_at).toLocaleDateString()}</span></p>
                        <p className="text-sm text-white/80">{c.content}</p>
                        <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-white/40">
                          <button className="hover:text-[#25D366] transition" onClick={() => setRightReplyTo(c)}>Reply</button>
                          <button className="flex items-center gap-1 hover:text-red-500 transition"><FiHeart size={10} /> {c.likes || 0}</button>
                        </div>
                      </div>
                    </div>
                    {c.replies?.length > 0 && (
                      <div className="ml-11 space-y-2">
                        {c.replies.map(r => (
                          <div key={r.id} className="flex gap-2">
                            <FiCornerDownRight size={10} className="text-white/20 mt-1 flex-shrink-0" />
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-[9px] flex-shrink-0">
                              {r.user_name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-white/60">{r.user_name}</p>
                              <p className="text-xs text-white/70">{r.content}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10 space-y-2">
              {rightReplyTo && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <span className="text-white/50 text-xs flex-1">Replying to {rightReplyTo.user_name}</span>
                  <button onClick={() => setRightReplyTo(null)}><FiX size={12} className="text-white/40" /></button>
                </div>
              )}
              {user ? (
                <div className="relative">
                  <input value={rightCommentText} onChange={e => setRightCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && submitRightComment()}
                    type="text" placeholder={rightReplyTo ? `Reply to ${rightReplyTo.user_name}…` : 'Add comment…'}
                    className="w-full bg-black/40 border border-white/10 focus:border-[#25D366] rounded-xl py-3 pl-4 pr-12 text-sm transition-all outline-none" />
                  <button onClick={submitRightComment} disabled={rightCommentLoading || !rightCommentText.trim()}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#25D366] hover:scale-110 transition-transform disabled:opacity-40">
                    <FiSend />
                  </button>
                </div>
              ) : (
                <button onClick={() => navigate('/login')} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl text-sm transition">
                  Log in to comment
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
