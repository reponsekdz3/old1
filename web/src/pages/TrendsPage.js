import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiHeart, FiShare2, FiMessageCircle, FiPlay,
  FiVolume2, FiVolumeX, FiArrowLeft,
  FiSkipForward, FiX, FiSend, FiGrid, FiMusic, FiActivity,
  FiZap, FiRss, FiSmile, FiBook, FiCpu, FiExternalLink,
  FiBookmark, FiChevronUp, FiChevronDown, FiUpload, FiCheck,
  FiCornerDownRight, FiUsers, FiEye, FiStar,
  FiFilter, FiGlobe, FiHome, FiPause,
  FiChevronRight, FiRadio,
} from 'react-icons/fi';
import { MdOutlineLocalFireDepartment, MdOutlineExplore } from 'react-icons/md';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';
import LiveStreamViewer, { GoLiveModal } from '../components/LiveStreamViewer';

// ── Category metadata ──────────────────────────────────────────────────────────
const CATEGORY_META = {
  all:      { label: 'All',       icon: MdOutlineExplore,  color: '#f97316', bg: 'from-orange-500/20 to-orange-600/10' },
  music:    { label: 'Music',     icon: FiMusic,           color: '#ec4899', bg: 'from-pink-500/20 to-pink-600/10' },
  sports:   { label: 'Sports',    icon: FiActivity,        color: '#22c55e', bg: 'from-green-500/20 to-green-600/10' },
  gaming:   { label: 'Gaming',    icon: FiZap,             color: '#a855f7', bg: 'from-purple-500/20 to-purple-600/10' },
  news:     { label: 'News',      icon: FiRss,             color: '#3b82f6', bg: 'from-blue-500/20 to-blue-600/10' },
  comedy:   { label: 'Comedy',    icon: FiSmile,           color: '#eab308', bg: 'from-yellow-500/20 to-yellow-600/10' },
  education:{ label: 'Learning',  icon: FiBook,            color: '#14b8a6', bg: 'from-teal-500/20 to-teal-600/10' },
  tech:     { label: 'Tech',      icon: FiCpu,             color: '#0ea5e9', bg: 'from-sky-500/20 to-sky-600/10' },
  fashion:  { label: 'Fashion',   icon: FiStar,            color: '#f43f5e', bg: 'from-rose-500/20 to-rose-600/10' },
  food:     { label: 'Food',      icon: FiGlobe,           color: '#fb923c', bg: 'from-orange-400/20 to-orange-500/10' },
  travel:   { label: 'Travel',    icon: FiGlobe,           color: '#06b6d4', bg: 'from-cyan-500/20 to-cyan-600/10' },
  fitness:  { label: 'Fitness',   icon: FiActivity,        color: '#84cc16', bg: 'from-lime-500/20 to-lime-600/10' },
};

function fmtNum(n) {
  n = parseInt(n || 0);
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n/1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = Date.now();
  const sec = (now - d.getTime()) / 1000;
  if (sec < 60) return 'just now';
  if (sec < 3600) return `${Math.floor(sec/60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec/3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec/86400)}d ago`;
  return d.toLocaleDateString();
}

// ── Skeleton ───────────────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-white/8 rounded-lg ${className}`} />;
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ name, src, size = 8, className = '' }) {
  const s = `w-${size} h-${size}`;
  if (src) return <img src={src} alt={name} className={`${s} rounded-full object-cover border border-white/10 ${className}`} />;
  const colors = ['from-[#25D366] to-teal-600','from-purple-500 to-pink-500','from-blue-500 to-cyan-500','from-orange-500 to-red-500','from-yellow-400 to-orange-500'];
  const idx = (name?.charCodeAt(0) || 0) % colors.length;
  return (
    <div className={`${s} rounded-full bg-gradient-to-br ${colors[idx]} flex items-center justify-center text-white font-bold border border-white/10 flex-shrink-0 ${className}`}
      style={{ fontSize: size > 10 ? 18 : size > 8 ? 14 : 11 }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ── Upload Modal ───────────────────────────────────────────────────────────────
function UploadModal({ onClose, categories = [] }) {
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

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error('Add a title'); return; }
    setStep('uploading');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const { data: uploadData } = await api.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 80) / (e.total || 1))),
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#25D366]/20 flex items-center justify-center">
              <FiUpload size={16} className="text-[#25D366]" />
            </div>
            <h2 className="text-base font-bold">Upload Video</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/50 hover:text-white transition">
            <FiX size={18} />
          </button>
        </div>

        {step === 'select' && (
          <div className="p-6">
            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-4 cursor-pointer transition-all ${dragOver ? 'border-[#25D366] bg-[#25D366]/8' : 'border-white/15 hover:border-white/30 hover:bg-white/3'}`}>
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                <FiUpload size={26} className="text-white/30" />
              </div>
              <div className="text-center">
                <p className="text-white font-semibold">Drag & drop or click to select</p>
                <p className="text-white/35 text-sm mt-1">MP4, MOV, AVI, WebM · up to 100MB</p>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        )}

        {step === 'details' && (
          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {preview && <video src={preview} className="w-full aspect-video rounded-xl bg-black object-contain" muted controls />}
            <div>
              <label className="text-xs font-bold text-white/40 mb-1.5 block uppercase tracking-wider">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#25D366]/60 rounded-xl px-4 py-3 text-sm outline-none transition placeholder-white/25"
                placeholder="Give your video a catchy title" />
            </div>
            <div>
              <label className="text-xs font-bold text-white/40 mb-1.5 block uppercase tracking-wider">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                className="w-full bg-white/5 border border-white/10 focus:border-[#25D366]/60 rounded-xl px-4 py-3 text-sm outline-none transition resize-none placeholder-white/25"
                placeholder="Tell viewers what your video is about..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-white/40 mb-1.5 block uppercase tracking-wider">Category</label>
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 focus:border-[#25D366]/60 rounded-xl px-4 py-3 text-sm outline-none transition text-white">
                  {(categories.length ? categories : Object.keys(CATEGORY_META)).filter(id => id !== 'all').map(id => (
                    <option key={id} value={id}>{CATEGORY_META[id]?.label || id}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-white/40 mb-1.5 block uppercase tracking-wider">Tags</label>
                <input value={tags} onChange={e => setTags(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-[#25D366]/60 rounded-xl px-4 py-3 text-sm outline-none transition placeholder-white/25"
                  placeholder="music, trending..." />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button onClick={() => setStep('select')} className="flex-1 py-3 bg-white/5 hover:bg-white/10 font-bold rounded-xl transition text-sm">Back</button>
              <button onClick={handleSubmit} disabled={!title.trim()}
                className="flex-1 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl transition disabled:opacity-40 text-sm">
                Upload Video
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div className="p-12 flex flex-col items-center gap-5">
            <div className="w-18 h-18 rounded-full bg-[#25D366]/10 flex items-center justify-center">
              <div className="w-10 h-10 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="w-full space-y-2">
              <div className="w-full bg-white/8 rounded-full h-2 overflow-hidden">
                <motion.div className="bg-[#25D366] h-2 rounded-full" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-white/40 text-xs text-center">{progress < 85 ? `Uploading… ${progress}%` : 'Finalizing…'}</p>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="p-12 flex flex-col items-center gap-4">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}
              className="w-18 h-18 rounded-full bg-[#25D366]/20 flex items-center justify-center">
              <FiCheck size={32} className="text-[#25D366]" />
            </motion.div>
            <h3 className="text-lg font-bold">Video Uploaded!</h3>
            <p className="text-white/40 text-sm text-center">Your video is live and ready to be discovered.</p>
            <button onClick={onClose} className="mt-1 px-8 py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-full transition text-sm">Done</button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Creator Profile Drawer ─────────────────────────────────────────────────────
function CreatorDrawer({ creatorId, onClose, onVideoSelect, currentUserId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!creatorId) return;
    setLoading(true);
    api.get(`/trends/creators/${creatorId}`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load creator'))
      .finally(() => setLoading(false));
  }, [creatorId]);

  const handleFollow = async () => {
    if (!currentUserId) { navigate('/login'); return; }
    if (!data) return;
    setFollowLoading(true);
    try {
      const r = await api.post(`/trends/creators/${creatorId}/follow`);
      setData(prev => ({
        ...prev,
        creator: {
          ...prev.creator,
          is_following: r.data.following,
          followers: r.data.followers,
          followers_fmt: r.data.followers_fmt,
        }
      }));
      toast.success(r.data.following ? 'Following!' : 'Unfollowed');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setFollowLoading(false); }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        className="bg-[#111] border border-white/10 rounded-t-3xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/8 sticky top-0 bg-[#111] z-10">
          <h2 className="font-bold">Creator Profile</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/50 hover:text-white transition">
            <FiX size={18} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[0,1,2].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[0,1,2,3].map(i => <Skeleton key={i} className="aspect-video rounded-xl" />)}
            </div>
          </div>
        ) : data ? (
          <div className="p-6">
            {/* Creator header */}
            <div className="flex items-start gap-4 mb-6">
              <Avatar name={data.creator.name} src={data.creator.avatar_url} size={16} />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg truncate">{data.creator.name}</h3>
                <p className="text-white/40 text-sm">{data.creator.username}</p>
                {data.creator.bio && <p className="text-white/70 text-sm mt-2 leading-relaxed">{data.creator.bio}</p>}
              </div>
              {currentUserId !== creatorId && (
                <button onClick={handleFollow} disabled={followLoading}
                  className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-sm transition ${data.creator.is_following ? 'bg-white/8 hover:bg-red-500/20 hover:text-red-400 text-white/70 border border-white/15' : 'bg-[#25D366] hover:bg-[#1fbd5a] text-white'}`}>
                  {followLoading ? '…' : data.creator.is_following ? 'Following' : 'Follow'}
                </button>
              )}
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Videos', value: fmtNum(data.creator.video_count), icon: FiPlay },
                { label: 'Views', value: data.creator.total_views_fmt, icon: FiEye },
                { label: 'Followers', value: data.creator.followers_fmt, icon: FiUsers },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/4 rounded-xl p-3 text-center border border-white/5">
                  <Icon size={14} className="mx-auto mb-1 text-white/30" />
                  <p className="font-bold text-base">{value}</p>
                  <p className="text-white/40 text-[10px] uppercase tracking-wider">{label}</p>
                </div>
              ))}
            </div>

            {/* Videos grid */}
            {data.videos?.length > 0 && (
              <>
                <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3">Recent Videos</p>
                <div className="grid grid-cols-2 gap-2">
                  {data.videos.map(video => (
                    <button key={video.id} onClick={() => { onVideoSelect(video); onClose(); }}
                      className="relative aspect-[9/16] rounded-xl overflow-hidden bg-gray-900 group border border-white/5 hover:border-[#25D366]/40 transition">
                      {video.thumbnail_url
                        ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        : <div className="w-full h-full bg-gradient-to-br from-gray-800 to-black flex items-center justify-center"><FiPlay size={20} className="text-white/20" /></div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-white text-[10px] font-bold line-clamp-2 mb-1">{video.title}</p>
                        <div className="flex items-center gap-1 text-white/50">
                          <FiEye size={8} /><span className="text-[9px]">{fmtNum(video.views)}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="p-8 text-center text-white/40">Creator not found</div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ── Ad Overlay ─────────────────────────────────────────────────────────────────
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
          <span className="bg-black/70 text-yellow-400 text-[10px] font-black px-3 py-1 rounded-full border border-yellow-500/30">
            AD · {ad.ad_sponsor_name || 'Sponsor'}
          </span>
          {canSkip
            ? <button onClick={onSkip} className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full hover:bg-white/25 transition border border-white/20">Skip <FiSkipForward size={12} /></button>
            : <span className="bg-black/70 text-white/70 text-[10px] px-3 py-1.5 rounded-full">Skip in {countdown}s</span>
          }
        </div>
        {ad.ad_url && (
          <div className="flex justify-end">
            <a href={ad.ad_url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 bg-white text-black text-xs font-bold px-4 py-2 rounded-full hover:bg-white/90 transition">
              Learn more <FiExternalLink size={10} />
            </a>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Video Card ─────────────────────────────────────────────────────────────────
function VideoCard({ video, isActive, isLoggedIn, userId, onCreatorClick }) {
  const navigate = useNavigate();
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [liked, setLiked] = useState(video.liked || false);
  const [saved, setSaved] = useState(video.saved || false);
  const [showAd, setShowAd] = useState(false);
  const [preRollAd, setPreRollAd] = useState(null);
  const [showComments, setShowComments] = useState(false);
  const [comment, setComment] = useState('');
  const [comments, setComments] = useState([]);
  const [replyTo, setReplyTo] = useState(null);
  const [loadingComment, setLoadingComment] = useState(false);
  const [commentsHasMore, setCommentsHasMore] = useState(false);
  const commentsNextRef = useRef(null);
  const [likesCount, setLikesCount] = useState(video.likes || 0);
  const [savesCount, setSavesCount] = useState(video.saves || 0);
  const [commentsCount, setCommentsCount] = useState(video.comments_count || 0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const controlsTimer = useRef(null);

  useEffect(() => {
    if (isActive && videoRef.current) {
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
    flashControls();
  };

  const flashControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 2500);
  };

  const handleDoubleTap = (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      if (!liked) handleLike();
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 800);
    } else {
      togglePlay();
    }
    setLastTap(now);
  };

  const handleLike = async () => {
    if (!isLoggedIn) { toast.error('Log in to like'); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(v => newLiked ? v + 1 : Math.max(0, v - 1));
    try { await api.post(`/trends/video/${video.id}/like`); }
    catch { setLiked(!newLiked); setLikesCount(v => newLiked ? Math.max(0, v - 1) : v + 1); }
  };

  const handleSave = async () => {
    if (!isLoggedIn) { toast.error('Log in to save'); return; }
    const newSaved = !saved;
    setSaved(newSaved);
    setSavesCount(v => newSaved ? v + 1 : Math.max(0, v - 1));
    try {
      await api.post(`/trends/video/${video.id}/save`);
      toast.success(newSaved ? 'Saved!' : 'Removed from saved');
    } catch {
      setSaved(!newSaved);
      setSavesCount(v => newSaved ? Math.max(0, v - 1) : v + 1);
    }
  };

  const handleShare = async () => {
    try {
      const { data } = await api.post(`/trends/video/${video.id}/share`);
      const url = `${window.location.origin}${data.share_url}`;
      if (navigator.share) navigator.share({ title: video.title, url });
      else { navigator.clipboard.writeText(url); toast.success('Link copied!'); }
    } catch {
      navigator.clipboard?.writeText(`${window.location.origin}/trends?v=${video.id}`);
      toast.success('Link copied!');
    }
  };

  const loadComments = async (cursor = null, append = false) => {
    try {
      const p = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
      const { data } = await api.get(`/trends/video/${video.id}/comments${p}`);
      setComments(prev => append ? [...prev, ...(data.comments || [])] : (data.comments || []));
      setCommentsHasMore(data.has_more || false);
      commentsNextRef.current = data.next_cursor || null;
    } catch {}
  };

  const handleLikeComment = async (commentId, currentLiked, idx) => {
    if (!isLoggedIn) { toast.error('Log in to like comments'); return; }
    try {
      const { data } = await api.post(`/trends/video/${video.id}/comment/${commentId}/like`);
      setComments(prev => prev.map((c, i) => i === idx ? { ...c, liked: data.liked, likes: data.likes } : c));
    } catch {}
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    if (!isLoggedIn) { toast.error('Log in to comment'); return; }
    setLoadingComment(true);
    try {
      await api.post(`/trends/video/${video.id}/comment`, { content: comment, parent_id: replyTo?.id || null });
      setComment('');
      setReplyTo(null);
      if (!replyTo) setCommentsCount(v => v + 1);
      loadComments();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setLoadingComment(false); }
  };

  const fmtTime = (s) => `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}`;
  const isAdVideo = video._is_injected_ad || video.is_ad;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center"
      onMouseMove={flashControls} onTouchStart={flashControls}>
      <video ref={videoRef}
        src={video.video_url}
        className="max-h-full w-auto object-contain cursor-pointer select-none"
        loop playsInline muted={muted}
        onTimeUpdate={() => {
          if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
            setProgress((videoRef.current.currentTime / (videoRef.current.duration || 1)) * 100);
          }
        }}
        onLoadedMetadata={() => { if (videoRef.current) setDuration(videoRef.current.duration); }}
        onClick={handleDoubleTap}
        poster={video.thumbnail_url}
      />

      <AnimatePresence>
        {showAd && preRollAd && <AdOverlay ad={preRollAd} onSkip={() => { setShowAd(false); playVideo(); }} />}
      </AnimatePresence>

      <AnimatePresence>
        {showHeartBurst && (
          <motion.div initial={{ scale: 0, opacity: 1 }} animate={{ scale: 1.8, opacity: 0 }}
            transition={{ duration: 0.7 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
            <FiHeart size={90} className="text-red-500 fill-red-500 drop-shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {!playing && !showAd && (
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-18 h-18 bg-black/50 rounded-full flex items-center justify-center backdrop-blur-sm border border-white/20">
              <FiPlay size={32} className="text-white ml-1.5" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad badge */}
      {isAdVideo && !showAd && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-black text-[9px] font-black px-2.5 py-1 rounded-full z-20">
          AD · {video.ad_sponsor_name || 'Sponsored'}
        </div>
      )}

      {/* Bottom gradient info */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/50 to-transparent pt-20 pb-4 px-4 z-10 pointer-events-none">
        <div className="pointer-events-auto max-w-[calc(100%-80px)]">
          <button onClick={() => onCreatorClick?.(video.uploader_id)} className="flex items-center gap-2.5 mb-2.5 group">
            <Avatar name={video.uploader_name} size={9} />
            <div>
              <p className="text-white font-bold text-sm group-hover:underline">{video.uploader_name}</p>
              <p className="text-[#25D366] text-[10px] font-semibold">{CATEGORY_META[video.category]?.label || video.category}</p>
            </div>
          </button>
          <p className="text-white text-sm leading-snug mb-2 line-clamp-2">{video.title}</p>
          {video.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {video.tags.slice(0, 4).map(tag => (
                <span key={tag} className="text-[#25D366] text-[10px] font-bold">#{tag}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right action bar */}
      <div className="absolute right-3 bottom-20 flex flex-col items-center gap-5 z-10">
        {[
          { onClick: handleLike, icon: <FiHeart size={22} className={liked ? 'fill-red-500 text-red-500' : 'text-white'} />, count: fmtNum(likesCount), active: liked, color: liked ? 'bg-red-500/20' : 'bg-black/50' },
          { onClick: () => { setShowComments(v => !v); if (!showComments) loadComments(); }, icon: <FiMessageCircle size={22} className="text-white" />, count: fmtNum(commentsCount), color: showComments ? 'bg-[#25D366]/20' : 'bg-black/50' },
          { onClick: handleSave, icon: <FiBookmark size={22} className={saved ? 'fill-[#25D366] text-[#25D366]' : 'text-white'} />, count: fmtNum(savesCount), color: saved ? 'bg-[#25D366]/20' : 'bg-black/50' },
          { onClick: handleShare, icon: <FiShare2 size={22} className="text-white" />, count: fmtNum(video.shares || 0), color: 'bg-black/50' },
        ].map(({ onClick, icon, count, color }, i) => (
          <button key={i} onClick={onClick} className="flex flex-col items-center gap-1">
            <motion.div whileTap={{ scale: 0.8 }} className={`w-12 h-12 rounded-full ${color} hover:brightness-125 flex items-center justify-center backdrop-blur-sm border border-white/10 transition-all`}>
              {icon}
            </motion.div>
            <span className="text-white text-[10px] font-bold drop-shadow-md">{count}</span>
          </button>
        ))}

        {/* Mute button */}
        <button onClick={() => setMuted(v => !v)}
          className="w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center backdrop-blur-sm hover:brightness-125 transition">
          {muted ? <FiVolumeX size={16} className="text-white/70" /> : <FiVolume2 size={16} className="text-white" />}
        </button>
      </div>

      {/* Progress bar + controls */}
      <AnimatePresence>
        {(showControls || !playing) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-6 pb-2 px-4 z-20">
            <div className="w-full h-1 bg-white/20 rounded-full cursor-pointer relative overflow-hidden hover:h-2 transition-all mb-2"
              onClick={e => {
                if (videoRef.current) {
                  const r = e.currentTarget.getBoundingClientRect();
                  videoRef.current.currentTime = ((e.clientX - r.left) / r.width) * (videoRef.current.duration || 1);
                }
              }}>
              <div className="absolute left-0 top-0 bottom-0 bg-[#25D366] rounded-full" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white/80 hover:text-white transition">
                  {playing ? <FiPause size={16} /> : <FiPlay size={16} />}
                </button>
                <span className="text-white/50 text-[10px] font-mono">{fmtTime(currentTime)} / {fmtTime(duration)}</span>
              </div>
              <div className="relative">
                <button onClick={() => setShowSpeedMenu(v => !v)}
                  className="text-white/50 hover:text-white text-[10px] font-bold px-2 py-1 rounded-lg hover:bg-white/10 transition">
                  {playbackSpeed}×
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-8 right-0 bg-[#1a1a1a] border border-white/10 rounded-xl overflow-hidden shadow-2xl">
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(s => (
                      <button key={s} onClick={() => { if (videoRef.current) videoRef.current.playbackRate = s; setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                        className={`block w-full px-4 py-2 text-xs font-bold text-left hover:bg-white/8 transition ${s === playbackSpeed ? 'text-[#25D366]' : 'text-white/70'}`}>
                        {s}×
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comments overlay */}
      <AnimatePresence>
        {showComments && (
          <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="absolute bottom-0 left-0 right-0 h-[65%] bg-[#111]/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 z-25 flex flex-col">
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
              <p className="font-bold text-sm">{fmtNum(commentsCount)} Comments</p>
              <button onClick={() => setShowComments(false)} className="w-7 h-7 rounded-full hover:bg-white/8 flex items-center justify-center text-white/50 hover:text-white transition">
                <FiX size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {comments.length === 0 && <p className="text-center text-white/30 text-sm py-6">No comments yet</p>}
              {comments.map((c, i) => (
                <div key={c.id}>
                  <div className="flex gap-2.5">
                    <Avatar name={c.user_name} src={c.user_avatar} size={7} />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold">{c.user_name}</span>
                        <span className="text-[10px] text-white/30">{timeAgo(c.created_at)}</span>
                      </div>
                      <p className="text-sm text-white/80 mt-0.5">{c.content}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <button onClick={() => handleLikeComment(c.id, c.liked, i)}
                          className={`flex items-center gap-1 text-[10px] font-bold transition ${c.liked ? 'text-red-400' : 'text-white/30 hover:text-white/60'}`}>
                          <FiHeart size={10} className={c.liked ? 'fill-red-400' : ''} /> {c.likes || 0}
                        </button>
                        <button onClick={() => setReplyTo(c)} className="text-[10px] font-bold text-white/30 hover:text-[#25D366] transition">Reply</button>
                      </div>
                      {c.replies?.length > 0 && (
                        <div className="mt-2 space-y-2 ml-4 border-l border-white/8 pl-3">
                          {c.replies.map(r => (
                            <div key={r.id} className="flex gap-2">
                              <Avatar name={r.user_name} src={r.user_avatar} size={5} />
                              <div>
                                <span className="text-[10px] font-bold">{r.user_name} </span>
                                <span className="text-[10px] text-white/60">{r.content}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {commentsHasMore && (
                <button onClick={() => loadComments(commentsNextRef.current, true)}
                  className="w-full text-xs text-[#25D366] py-2 hover:underline">Load more</button>
              )}
            </div>
            <div className="p-3 border-t border-white/8 space-y-2">
              {replyTo && (
                <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
                  <span className="text-white/50 text-xs flex-1">↩ Replying to {replyTo.user_name}</span>
                  <button onClick={() => setReplyTo(null)}><FiX size={12} className="text-white/40" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submitComment()}
                  placeholder={replyTo ? `Reply to ${replyTo.user_name}…` : 'Add a comment…'}
                  className="flex-1 bg-white/8 text-white placeholder-white/30 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#25D366]/50 transition" />
                <button onClick={submitComment} disabled={loadingComment || !comment.trim()}
                  className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center disabled:opacity-40 hover:bg-[#1fbd5a] transition flex-shrink-0">
                  <FiSend size={14} className="text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
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
  const [viewMode, setViewMode] = useState('scroll');
  const [feedType, setFeedType] = useState('for-you');
  const [uploadOpen, setUploadOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [stats, setStats] = useState(null);
  const [myStats, setMyStats] = useState(null);
  const [sidebarLoading, setSidebarLoading] = useState(true);
  const [creatorDrawerId, setCreatorDrawerId] = useState(null);

  // Live streaming state
  const [activeStreams, setActiveStreams] = useState([]);
  const [showGoLive, setShowGoLive] = useState(false);
  const [viewingStream, setViewingStream] = useState(null);
  const [myLiveStream, setMyLiveStream] = useState(null);
  const livePollingRef = useRef(null);

  const [rightComments, setRightComments] = useState([]);
  const [rightCommentText, setRightCommentText] = useState('');
  const [rightCommentLoading, setRightCommentLoading] = useState(false);
  const [rightReplyTo, setRightReplyTo] = useState(null);
  const [rightCommentsLoading, setRightCommentsLoading] = useState(false);

  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const loadingMore = useRef(false);

  // Sidebar data load
  useEffect(() => {
    setSidebarLoading(true);
    Promise.all([
      api.get('/trends/hashtags/trending?limit=10').catch(() => ({ data: { hashtags: [] } })),
      api.get('/trends/creators/top?limit=6').catch(() => ({ data: { creators: [] } })),
      api.get('/trends/categories').catch(() => ({ data: { categories: Object.keys(CATEGORY_META) } })),
      api.get('/trends/stats').catch(() => ({ data: null })),
    ]).then(([h, c, cat, s]) => {
      setTrendingHashtags(h.data.hashtags || []);
      setTopCreators(c.data.creators || []);
      setCategories(cat.data.categories || Object.keys(CATEGORY_META));
      setStats(s.data);
    }).finally(() => setSidebarLoading(false));
  }, []);

  // My creator stats (if logged in)
  useEffect(() => {
    if (!user) return;
    api.get('/trends/me/creator-stats').then(r => setMyStats(r.data)).catch(() => {});
  }, [user]);

  // Live stream polling
  useEffect(() => {
    const fetchLive = () => {
      api.get('/livestream/active').then(({ data }) => setActiveStreams(data.streams || [])).catch(() => {});
    };
    fetchLive();
    livePollingRef.current = setInterval(fetchLive, 10000);
    return () => clearInterval(livePollingRef.current);
  }, []);

  const handleEndMyStream = async () => {
    if (!myLiveStream) return;
    try {
      await api.post(`/livestream/${myLiveStream.id}/end`);
      setMyLiveStream(null);
      toast.success('Stream ended');
    } catch {}
  };

  // Share token resolution
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

  // Right panel comments
  useEffect(() => {
    if (!videos[activeIdx] || viewMode !== 'scroll') return;
    const vid = videos[activeIdx];
    if (vid._is_injected_ad) return;
    setRightComments([]);
    setRightReplyTo(null);
    setRightCommentsLoading(true);
    api.get(`/trends/video/${vid.id}/comments`)
      .then(({ data }) => setRightComments(data.comments || []))
      .catch(() => {})
      .finally(() => setRightCommentsLoading(false));
  }, [activeIdx, viewMode, videos]);

  const fetchVideos = useCallback(async (cat = category, s = sort, cursor = null, append = false, feed = feedType) => {
    if (loadingMore.current && append) return;
    if (append) loadingMore.current = true;
    else { setLoading(true); nextCursorRef.current = null; }
    try {
      let endpoint;
      if (searchQuery) {
        const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        endpoint = `/trends/search?q=${encodeURIComponent(searchQuery)}${c}`;
      } else if (feed === 'saved') {
        const c = cursor ? `?cursor=${encodeURIComponent(cursor)}` : '';
        endpoint = `/trends/me/saved${c}`;
      } else {
        const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : '';
        endpoint = `/trends/feed?category=${cat}&sort=${s}&feed=${feed}${c}`;
      }
      const { data } = await api.get(endpoint);
      const newVids = data.videos || [];
      setVideos(prev => append ? [...prev, ...newVids] : newVids);
      setHasMore(data.has_more || false);
      nextCursorRef.current = data.next_cursor || null;
    } catch (e) {
      if (!append) {
        if (e.response?.status === 401 && feed === 'saved') {
          toast.error('Log in to see saved videos');
          setFeedType('for-you');
        } else {
          toast.error('Failed to load videos');
        }
      }
    } finally {
      setLoading(false);
      loadingMore.current = false;
    }
  }, [category, sort, searchQuery, feedType]);

  useEffect(() => {
    setActiveIdx(0);
    fetchVideos(category, sort, null, false, feedType);
  }, [category, sort, searchQuery, feedType]); // eslint-disable-line

  // Intersection observer for scroll feed
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
            fetchVideos(category, sort, nextCursorRef.current, true, feedType);
          }
        }
      });
    }, { threshold: 0.6 });
    cards.forEach(card => observerRef.current.observe(card));
    return () => observerRef.current?.disconnect();
  }, [videos, viewMode, hasMore, category, sort, feedType]); // eslint-disable-line

  const submitRightComment = async () => {
    if (!rightCommentText.trim() || !user) return;
    const vid = videos[activeIdx];
    if (!vid || vid._is_injected_ad) return;
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

  const handleLikeRightComment = async (commentId, currentLiked, idx) => {
    if (!user) { toast.error('Log in to like'); return; }
    const vid = videos[activeIdx];
    if (!vid) return;
    try {
      const { data } = await api.post(`/trends/video/${vid.id}/comment/${commentId}/like`);
      setRightComments(prev => prev.map((c, i) => i === idx ? { ...c, liked: data.liked, likes: data.likes } : c));
    } catch {}
  };

  const handleFollowCreator = async (creatorId, isFollowing, idx) => {
    if (!user) { navigate('/login'); return; }
    try {
      const { data } = await api.post(`/trends/creators/${creatorId}/follow`);
      setTopCreators(prev => prev.map((c, i) =>
        i === idx ? { ...c, is_following: data.following, followers: data.followers, followers_fmt: data.followers_fmt } : c
      ));
      toast.success(data.following ? 'Following!' : 'Unfollowed');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const FEED_TABS = [
    { id: 'for-you', label: 'For You', icon: FiHome },
    { id: 'trending', label: 'Trending', icon: MdOutlineLocalFireDepartment },
    { id: 'following', label: 'Following', icon: FiUsers },
    { id: 'saved', label: 'Saved', icon: FiBookmark },
  ];

  const SORT_OPTIONS = [
    { id: 'trending', label: 'Trending' },
    { id: 'latest', label: 'Latest' },
    { id: 'popular', label: 'Most Viewed' },
    { id: 'top', label: 'Most Liked' },
  ];

  const activeVideo = videos[activeIdx];
  const showRightPanel = activeVideo && !activeVideo._is_injected_ad && viewMode === 'scroll';

  return (
    <div className="flex h-screen bg-[#080808] text-white overflow-hidden">

      {/* Upload Modal */}
      <AnimatePresence>
        {uploadOpen && <UploadModal onClose={() => setUploadOpen(false)} categories={categories} />}
      </AnimatePresence>

      {/* Go Live Modal */}
      <AnimatePresence>
        {showGoLive && (
          <GoLiveModal
            onClose={() => setShowGoLive(false)}
            onStarted={stream => { setMyLiveStream(stream); setActiveStreams(prev => [stream, ...prev]); }}
          />
        )}
      </AnimatePresence>

      {/* Live Stream Viewer */}
      <AnimatePresence>
        {viewingStream && (
          <LiveStreamViewer
            stream={viewingStream}
            onClose={() => setViewingStream(null)}
          />
        )}
      </AnimatePresence>

      {/* Creator Drawer */}
      <AnimatePresence>
        {creatorDrawerId && (
          <CreatorDrawer
            creatorId={creatorDrawerId}
            onClose={() => setCreatorDrawerId(null)}
            currentUserId={user?.id}
            onVideoSelect={(vid) => {
              setVideos(prev => {
                const exists = prev.findIndex(v => v.id === vid.id);
                if (exists >= 0) { setActiveIdx(exists); return prev; }
                setActiveIdx(0);
                return [vid, ...prev];
              });
              setViewMode('scroll');
            }}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── LEFT SIDEBAR ── */}
      <motion.aside
        initial={false}
        animate={{ x: sidebarOpen ? 0 : undefined }}
        className={`
          fixed lg:relative inset-y-0 left-0 z-50 lg:z-auto
          w-[280px] flex flex-col bg-[#0d0d0d] border-r border-white/6 shrink-0
          overflow-y-auto no-scrollbar
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          transition-transform duration-300 lg:transition-none
        `}>
        {/* Logo */}
        <div className="px-5 pt-5 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center shadow-lg">
              <MdOutlineLocalFireDepartment size={20} className="text-white" />
            </div>
            <div>
              <p className="font-black text-sm leading-none">VipTrends</p>
              <p className="text-white/30 text-[9px] mt-0.5">Discover & Create</p>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden w-7 h-7 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/50">
            <FiX size={16} />
          </button>
        </div>

        {/* User card or login prompt */}
        {user ? (
          <div className="mx-4 mb-4 p-3 bg-white/4 rounded-2xl border border-white/6">
            <div className="flex items-center gap-3 mb-3">
              <Avatar name={user.full_name || user.name} size={10} />
              <div className="overflow-hidden flex-1">
                <p className="font-bold text-sm truncate">{user.full_name || user.name}</p>
                <p className="text-white/35 text-xs truncate">@{user.username || (user.full_name || '').toLowerCase().replace(/\s/g, '_')}</p>
              </div>
            </div>
            {myStats && (
              <div className="grid grid-cols-3 gap-1.5 text-center">
                {[
                  { v: fmtNum(myStats.total_views), l: 'Views' },
                  { v: fmtNum(myStats.followers), l: 'Followers' },
                  { v: myStats.video_count, l: 'Videos' },
                ].map(({ v, l }) => (
                  <div key={l} className="bg-white/4 rounded-xl py-1.5">
                    <p className="font-bold text-xs text-white">{v}</p>
                    <p className="text-white/30 text-[9px]">{l}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mx-4 mb-4 p-4 bg-gradient-to-br from-[#25D366]/15 to-teal-600/10 rounded-2xl border border-[#25D366]/20">
            <p className="text-sm font-semibold mb-1">Join VipTrends</p>
            <p className="text-white/40 text-xs mb-3">Like, comment, upload & follow creators</p>
            <button onClick={() => navigate('/login')}
              className="w-full py-2 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl text-xs transition">
              Log in / Sign up
            </button>
          </div>
        )}

        {/* Go Live / Live Streams Section */}
        <div className="px-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest px-1">🔴 Live</p>
            {activeStreams.length > 0 && <span className="text-[10px] text-red-400 font-bold">{activeStreams.length} LIVE</span>}
          </div>
          {/* Active streams list */}
          {activeStreams.length > 0 && (
            <div className="space-y-1.5 mb-2">
              {activeStreams.slice(0, 3).map(stream => (
                <button key={stream.id} onClick={() => setViewingStream(stream)}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl hover:bg-white/5 text-left transition group border border-red-500/15 hover:border-red-500/30">
                  <div className="relative flex-shrink-0">
                    {stream.host_avatar ? (
                      <img src={stream.host_avatar} alt="" className="w-8 h-8 rounded-full object-cover border border-red-500" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center text-white text-xs font-bold border border-red-500">
                        {stream.host_name?.[0]?.toUpperCase() || '?'}
                      </div>
                    )}
                    <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 border border-[#0d0d0d]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white/80 truncate">{stream.host_name}</p>
                    <p className="text-[10px] text-white/35 truncate">{stream.title}</p>
                  </div>
                  <div className="flex-shrink-0 flex items-center gap-1 text-white/40">
                    <FiUsers size={9} />
                    <span className="text-[10px]">{stream.viewer_count || 0}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {/* My live stream control */}
          {myLiveStream && (
            <div className="flex items-center gap-2 px-2.5 py-2 bg-red-500/10 border border-red-500/30 rounded-xl mb-2">
              <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              <span className="text-xs font-bold text-red-400 flex-1">You are LIVE</span>
              <button onClick={handleEndMyStream} className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-1 rounded-lg transition">End</button>
            </div>
          )}
          {user && !myLiveStream && (
            <button onClick={() => setShowGoLive(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 rounded-xl text-red-400 text-xs font-bold transition">
              <FiRadio size={13} />
              Go Live
            </button>
          )}
          {!user && (
            <button onClick={() => navigate('/login')}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-white/4 hover:bg-white/8 border border-white/8 rounded-xl text-white/40 text-xs transition">
              <FiRadio size={12} /> Log in to go live
            </button>
          )}
        </div>

        <div className="h-px bg-white/5 mx-4 mb-3" />

        {/* Feed type nav */}
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2 px-1">Feed</p>
          <div className="space-y-0.5">
            {FEED_TABS.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => { setFeedType(id); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition text-sm font-semibold ${feedType === id ? 'bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/20' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}>
                <Icon size={16} />
                {label}
                {id === 'following' && !user && <span className="ml-auto text-[9px] text-white/25 font-normal">Login</span>}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/5 mx-4 my-3" />

        {/* Categories */}
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-2 px-1">Topics</p>
          <div className="grid grid-cols-2 gap-1.5">
            {(categories.length ? categories : Object.keys(CATEGORY_META)).map(id => {
              const meta = CATEGORY_META[id] || { label: id, icon: FiGrid, color: '#fff', bg: 'from-white/10 to-white/5' };
              const Icon = meta.icon;
              return (
                <button key={id} onClick={() => { setCategory(id); setSidebarOpen(false); }}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl transition text-xs font-semibold ${category === id ? `bg-gradient-to-r ${meta.bg} border border-white/10` : 'hover:bg-white/5 text-white/50 hover:text-white'}`}>
                  <Icon size={13} style={{ color: category === id ? meta.color : undefined }} />
                  <span className="truncate" style={{ color: category === id ? meta.color : undefined }}>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="h-px bg-white/5 mx-4 my-3" />

        {/* Trending Hashtags */}
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3 px-1">Trending</p>
          {sidebarLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="w-5 h-3 rounded" />
                  <Skeleton className="h-3 flex-1 rounded" />
                  <Skeleton className="w-8 h-3 rounded" />
                </div>
              ))}
            </div>
          ) : trendingHashtags.length === 0 ? (
            <p className="text-white/25 text-xs text-center py-2">Upload with tags to see trends</p>
          ) : (
            <div className="space-y-1">
              {trendingHashtags.map((h, i) => (
                <button key={h.tag} onClick={() => { setSearch(h.tag); setSearchQuery(h.tag); setSidebarOpen(false); }}
                  className="w-full flex items-center gap-2 px-2.5 py-2 rounded-xl hover:bg-white/5 text-left transition group">
                  <span className="text-[10px] font-black text-white/20 w-4 text-center">{i + 1}</span>
                  <span className="flex-1 text-xs font-semibold text-white/70 group-hover:text-white truncate">{h.tag}</span>
                  <span className="text-[9px] text-white/25 flex-shrink-0">{h.counts}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-px bg-white/5 mx-4 my-3" />

        {/* Top Creators */}
        <div className="px-4 mb-2">
          <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3 px-1">Top Creators</p>
          {sidebarLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="h-2 w-16 rounded" />
                  </div>
                  <Skeleton className="w-14 h-6 rounded-lg" />
                </div>
              ))}
            </div>
          ) : topCreators.length === 0 ? (
            <p className="text-white/25 text-xs text-center py-2">No creators yet</p>
          ) : (
            <div className="space-y-1">
              {topCreators.map((creator, i) => (
                <div key={creator.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/4 transition group">
                  <button onClick={() => setCreatorDrawerId(creator.id)} className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Avatar name={creator.name} src={creator.avatar_url} size={8} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white/80 group-hover:text-white truncate leading-tight">{creator.name}</p>
                      <p className="text-[9px] text-white/30 truncate">{creator.followers_fmt} followers · {fmtNum(creator.total_views)} views</p>
                    </div>
                  </button>
                  {user?.id !== creator.id && (
                    <button onClick={() => handleFollowCreator(creator.id, creator.is_following, i)}
                      className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition border ${creator.is_following ? 'border-white/15 text-white/40 hover:border-red-500/40 hover:text-red-400' : 'border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/15'}`}>
                      {creator.is_following ? 'Following' : '+ Follow'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform stats */}
        {stats && (
          <>
            <div className="h-px bg-white/5 mx-4 my-3" />
            <div className="px-4 mb-4">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest mb-3 px-1">Platform</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { v: stats.total_videos_fmt, l: 'Videos', icon: FiPlay },
                  { v: stats.total_views_fmt, l: 'Total Views', icon: FiEye },
                  { v: stats.total_creators_fmt, l: 'Creators', icon: FiUsers },
                  { v: stats.total_likes_fmt, l: 'Likes', icon: FiHeart },
                ].map(({ v, l, icon: Icon }) => (
                  <div key={l} className="bg-white/3 rounded-xl p-2.5 border border-white/5">
                    <Icon size={11} className="text-white/25 mb-1" />
                    <p className="font-bold text-xs">{v}</p>
                    <p className="text-[9px] text-white/30">{l}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="mt-auto px-5 py-4 border-t border-white/5">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/25 font-medium mb-2">
            <button onClick={() => navigate('/advertise')} className="hover:text-white/50 transition">Advertise</button>
            <button onClick={() => navigate('/subscription')} className="hover:text-white/50 transition">Go Pro</button>
            <button onClick={() => navigate('/')} className="hover:text-white/50 transition">VipChat</button>
          </div>
          <p className="text-[9px] text-white/15">© 2025 VipTrends · VipChat</p>
        </div>
      </motion.aside>

      {/* ── MAIN CONTENT ── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-[60px] border-b border-white/6 bg-[#080808]/90 backdrop-blur-xl flex items-center gap-3 px-4 z-40 shrink-0">
          {/* Mobile menu */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center text-white/60 hover:text-white hover:bg-white/8 transition flex-shrink-0">
            <div className="space-y-1.5">
              <div className="w-4 h-0.5 bg-current" />
              <div className="w-3 h-0.5 bg-current" />
            </div>
          </button>

          {/* Search */}
          <div className="flex-1 max-w-lg relative group">
            <FiSearch size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#25D366] transition-colors" />
            <input value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') setSearchQuery(search.trim()); if (e.key === 'Escape') { setSearch(''); setSearchQuery(''); } }}
              type="text" placeholder="Search videos, creators, tags…"
              className="w-full bg-white/5 border border-white/8 focus:border-[#25D366]/40 focus:bg-white/8 rounded-full py-2 pl-9 pr-9 text-sm outline-none transition-all placeholder-white/25" />
            {search && (
              <button onClick={() => { setSearch(''); setSearchQuery(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white transition">
                <FiX size={13} />
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="hidden sm:flex items-center bg-white/5 rounded-full p-0.5 border border-white/8 flex-shrink-0">
            <button onClick={() => setViewMode('scroll')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${viewMode === 'scroll' ? 'bg-[#25D366] text-white' : 'text-white/40 hover:text-white'}`}>
              Shorts
            </button>
            <button onClick={() => setViewMode('grid')}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition ${viewMode === 'grid' ? 'bg-[#25D366] text-white' : 'text-white/40 hover:text-white'}`}>
              Browse
            </button>
          </div>

          {/* Sort */}
          <div className="relative hidden sm:block">
            <button onClick={() => setShowSortMenu(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/8 border border-white/8 rounded-full text-xs font-bold text-white/60 hover:text-white transition">
              <FiFilter size={12} />
              {SORT_OPTIONS.find(o => o.id === sort)?.label}
            </button>
            <AnimatePresence>
              {showSortMenu && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="absolute top-10 right-0 bg-[#1a1a1a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-50 min-w-[140px]">
                  {SORT_OPTIONS.map(o => (
                    <button key={o.id} onClick={() => { setSort(o.id); setShowSortMenu(false); }}
                      className={`block w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-white/8 transition ${o.id === sort ? 'text-[#25D366]' : 'text-white/60'}`}>
                      {o.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Upload */}
          {user && (
            <button onClick={() => setUploadOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 border border-[#25D366]/30 text-[#25D366] font-bold rounded-full text-xs transition flex-shrink-0">
              <FiUpload size={12} /> Upload
            </button>
          )}

          {/* Auth button */}
          {!user ? (
            <button onClick={() => navigate('/login')}
              className="px-4 py-1.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-full text-xs transition flex-shrink-0">
              Log in
            </button>
          ) : (
            <button onClick={() => navigate('/')}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/8 transition flex-shrink-0">
              <FiArrowLeft size={15} className="text-white/60" />
            </button>
          )}
        </header>

        {/* Search query banner */}
        {searchQuery && (
          <div className="bg-[#25D366]/10 border-b border-[#25D366]/20 px-4 py-2 flex items-center gap-3">
            <FiSearch size={13} className="text-[#25D366]" />
            <span className="text-sm text-white/70">Results for <strong className="text-white">"{searchQuery}"</strong></span>
            <button onClick={() => { setSearch(''); setSearchQuery(''); }} className="ml-auto text-white/40 hover:text-white transition text-xs flex items-center gap-1">
              <FiX size={12} /> Clear
            </button>
          </div>
        )}

        {/* Main feed */}
        <main className="flex-1 overflow-y-auto no-scrollbar relative bg-black" style={{ scrollSnapType: viewMode === 'scroll' ? 'y mandatory' : undefined }}>
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin" />
              <p className="text-white/30 text-sm">Loading feed…</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/4 flex items-center justify-center mb-5 border border-white/8">
                {feedType === 'saved' ? <FiBookmark size={36} className="text-white/20" />
                  : feedType === 'following' ? <FiUsers size={36} className="text-white/20" />
                  : <MdOutlineLocalFireDepartment size={36} className="text-white/20" />}
              </div>
              <h2 className="text-xl font-bold mb-2">
                {feedType === 'saved' ? 'No saved videos' : feedType === 'following' ? 'Follow creators first' : searchQuery ? `No results` : 'No videos yet'}
              </h2>
              <p className="text-white/30 text-sm max-w-xs mb-6">
                {feedType === 'saved' ? 'Save videos to watch later' : feedType === 'following' ? 'Follow your favourite creators to see their content here' : searchQuery ? `Nothing matched "${searchQuery}"` : 'Be the first to upload!'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setFeedType('for-you'); setCategory('all'); setSearchQuery(''); setSearch(''); }}
                  className="px-6 py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-full text-sm transition">
                  Browse Feed
                </button>
                {user && (
                  <button onClick={() => setUploadOpen(true)}
                    className="px-6 py-2.5 bg-white/8 hover:bg-white/12 text-white font-bold rounded-full text-sm transition border border-white/10">
                    Upload
                  </button>
                )}
              </div>
            </div>
          ) : viewMode === 'scroll' ? (
            <div ref={containerRef} className="h-full w-full" style={{ overflowY: 'scroll', scrollSnapType: 'y mandatory' }}>
              {videos.map((video, idx) => (
                <div key={`${video.id}-${idx}`} data-video-card data-idx={idx}
                  className="relative flex items-center justify-center bg-black"
                  style={{ height: '100vh', scrollSnapAlign: 'start' }}>
                  <div className="relative w-full h-full max-w-[420px] bg-black shadow-2xl overflow-hidden">
                    <VideoCard
                      video={video}
                      isActive={activeIdx === idx}
                      isLoggedIn={!!user}
                      userId={user?.id}
                      onCreatorClick={setCreatorDrawerId}
                    />
                  </div>
                  {/* Desktop nav arrows */}
                  <div className="hidden xl:flex absolute right-4 top-1/2 -translate-y-1/2 flex-col gap-3">
                    <button onClick={() => containerRef.current?.scrollBy({ top: -window.innerHeight, behavior: 'smooth' })}
                      className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/12 flex items-center justify-center border border-white/10 transition">
                      <FiChevronUp size={20} />
                    </button>
                    <button onClick={() => containerRef.current?.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
                      className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/12 flex items-center justify-center border border-white/10 transition">
                      <FiChevronDown size={20} />
                    </button>
                  </div>
                </div>
              ))}
              {hasMore && (
                <div className="h-20 flex items-center justify-center" style={{ scrollSnapAlign: 'start' }}>
                  <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-7xl mx-auto p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {videos.filter(v => !v._is_injected_ad).map((video, idx) => (
                  <motion.div key={video.id}
                    initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
                    className="relative group cursor-pointer"
                    onClick={() => {
                      setViewMode('scroll');
                      const realIdx = videos.findIndex(v => v.id === video.id);
                      setActiveIdx(realIdx >= 0 ? realIdx : 0);
                    }}>
                    <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-gray-900 border border-white/6 relative hover:border-[#25D366]/30 transition-all duration-300 hover:shadow-xl hover:shadow-[#25D366]/10">
                      {video.thumbnail_url
                        ? <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-108" />
                        : <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-black">
                            <FiPlay size={28} className="text-white/15" />
                          </div>
                      }
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                        <p className="text-white text-xs font-bold line-clamp-2 mb-2 leading-snug">{video.title}</p>
                        <div className="flex items-center gap-3 text-[10px] text-white/60">
                          <span className="flex items-center gap-1"><FiEye size={9} />{fmtNum(video.views)}</span>
                          <span className="flex items-center gap-1"><FiHeart size={9} />{fmtNum(video.likes)}</span>
                        </div>
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                          <FiPlay size={20} className="text-white ml-0.5" />
                        </div>
                      </div>
                      {video.is_ad && (
                        <span className="absolute top-2 left-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">AD</span>
                      )}
                      {video.is_featured && (
                        <span className="absolute top-2 right-2 bg-[#25D366] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">✦</span>
                      )}
                    </div>
                    <div className="mt-2 px-1 flex items-start gap-2">
                      <Avatar name={video.uploader_name} size={6} className="mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white/80 line-clamp-1 leading-tight">{video.title}</p>
                        <p className="text-[10px] text-white/35 truncate mt-0.5">{video.uploader_name} · {fmtNum(video.views)} views</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
              {hasMore && (
                <div className="flex justify-center mt-10 mb-6">
                  <button onClick={() => fetchVideos(category, sort, nextCursorRef.current, true, feedType)}
                    className="px-10 py-3 bg-white/5 hover:bg-white/10 text-white/70 font-bold rounded-full border border-white/10 transition text-sm">
                    Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── RIGHT PANEL (scroll mode, desktop) ── */}
      <AnimatePresence>
        {showRightPanel && (
          <motion.aside initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 360, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            className="hidden xl:flex w-[340px] flex-col border-l border-white/6 bg-[#0d0d0d] shrink-0 overflow-hidden">
            {/* Video info */}
            <div className="p-5 border-b border-white/6 flex-shrink-0">
              <button onClick={() => setCreatorDrawerId(activeVideo.uploader_id)}
                className="flex items-center gap-3 mb-4 group w-full text-left">
                <Avatar name={activeVideo.uploader_name} size={11} />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm group-hover:underline truncate">{activeVideo.uploader_name}</p>
                  <p className="text-white/35 text-xs truncate">
                    {CATEGORY_META[activeVideo.category]?.label || activeVideo.category} · {timeAgo(activeVideo.created_at)}
                  </p>
                </div>
                <FiChevronRight size={16} className="text-white/25 group-hover:text-white/60 transition flex-shrink-0" />
              </button>

              <p className="text-sm font-semibold leading-relaxed mb-3 text-white/90">{activeVideo.title}</p>

              {activeVideo.description && (
                <p className="text-xs text-white/40 leading-relaxed mb-3 line-clamp-3">{activeVideo.description}</p>
              )}

              {activeVideo.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {activeVideo.tags.map(tag => (
                    <button key={tag} onClick={() => { setSearch(`#${tag}`); setSearchQuery(`#${tag}`); }}
                      className="bg-white/5 hover:bg-[#25D366]/15 text-[#25D366] text-[10px] font-bold px-2.5 py-1 rounded-full border border-white/8 hover:border-[#25D366]/30 transition">
                      #{tag}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4 py-3 border-t border-b border-white/6">
                <div className="flex items-center gap-1.5 text-sm font-bold text-red-400">
                  <FiHeart size={14} className="fill-red-400" /> {fmtNum(activeVideo.likes)}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-white/40">
                  <FiMessageCircle size={14} /> {fmtNum(activeVideo.comments_count)}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-white/40">
                  <FiShare2 size={14} /> {fmtNum(activeVideo.shares)}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-bold text-white/40">
                  <FiEye size={14} /> {fmtNum(activeVideo.views)}
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <p className="text-[10px] font-bold text-white/25 uppercase tracking-widest">Comments</p>
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
                <div className="text-center py-8">
                  <FiMessageCircle size={28} className="mx-auto text-white/15 mb-2" />
                  <p className="text-white/25 text-sm">No comments yet</p>
                  {user && <p className="text-white/15 text-xs mt-1">Be first to comment!</p>}
                </div>
              ) : (
                rightComments.map((c, i) => (
                  <div key={c.id} className="space-y-2">
                    <div className="flex gap-3">
                      <Avatar name={c.user_name} src={c.user_avatar} size={7} className="flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-xs font-bold">{c.user_name}</span>
                          <span className="text-[9px] text-white/25">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="text-xs text-white/75 mt-0.5 leading-relaxed">{c.content}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <button onClick={() => handleLikeRightComment(c.id, c.liked, i)}
                            className={`flex items-center gap-1 text-[10px] font-bold transition ${c.liked ? 'text-red-400' : 'text-white/25 hover:text-white/60'}`}>
                            <FiHeart size={9} className={c.liked ? 'fill-red-400' : ''} /> {c.likes || 0}
                          </button>
                          <button onClick={() => setRightReplyTo(c)} className="text-[10px] font-bold text-white/25 hover:text-[#25D366] transition">
                            Reply
                          </button>
                        </div>
                        {c.replies?.length > 0 && (
                          <div className="mt-2 space-y-2 ml-3 border-l border-white/8 pl-3">
                            {c.replies.map(r => (
                              <div key={r.id} className="flex gap-2">
                                <Avatar name={r.user_name} src={r.user_avatar} size={5} className="mt-0.5 flex-shrink-0" />
                                <div>
                                  <span className="text-[10px] font-bold text-white/60">{r.user_name} </span>
                                  <span className="text-[10px] text-white/50">{r.content}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment input */}
            <div className="p-4 border-t border-white/6 bg-[#0d0d0d] flex-shrink-0 space-y-2">
              {rightReplyTo && (
                <div className="flex items-center gap-2 bg-white/5 rounded-xl px-3 py-1.5 text-xs">
                  <FiCornerDownRight size={10} className="text-white/30" />
                  <span className="text-white/50 flex-1">Replying to {rightReplyTo.user_name}</span>
                  <button onClick={() => setRightReplyTo(null)} className="text-white/30 hover:text-white transition"><FiX size={11} /></button>
                </div>
              )}
              {user ? (
                <div className="flex items-center gap-2">
                  <Avatar name={user.full_name || user.name} size={7} className="flex-shrink-0" />
                  <div className="flex-1 relative">
                    <input value={rightCommentText} onChange={e => setRightCommentText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && submitRightComment()}
                      type="text" placeholder={rightReplyTo ? `Reply to ${rightReplyTo.user_name}…` : 'Add a comment…'}
                      className="w-full bg-white/6 border border-white/8 focus:border-[#25D366]/40 rounded-full py-2.5 pl-4 pr-10 text-xs outline-none transition-all placeholder-white/25" />
                    <button onClick={submitRightComment} disabled={rightCommentLoading || !rightCommentText.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[#25D366] hover:scale-110 transition-transform disabled:opacity-30">
                      <FiSend size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => navigate('/login')}
                  className="w-full py-2.5 text-xs text-white/40 hover:text-white bg-white/4 hover:bg-white/8 rounded-full transition border border-white/8">
                  Log in to comment
                </button>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
