import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiHeart, FiShare2, FiMessageCircle, FiPlay,
  FiVolume2, FiVolumeX, FiArrowLeft,
  FiTrendingUp, FiStar, FiClock,
  FiSkipForward, FiX, FiSend,
  FiGrid, FiMusic, FiActivity, FiZap, FiRss, FiSmile,
  FiBook, FiCpu, FiExternalLink, FiMaximize, FiBookmark, FiChevronUp, FiChevronDown
} from 'react-icons/fi';
import { MdOutlineSubscriptions } from 'react-icons/md';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: FiGrid, color: 'text-orange-400' },
  { id: 'music', label: 'Music', icon: FiMusic, color: 'text-pink-400' },
  { id: 'sports', label: 'Sports', icon: FiActivity, color: 'text-green-400' },
  { id: 'gaming', label: 'Gaming', icon: FiZap, color: 'text-purple-400' },
  { id: 'news', label: 'News', icon: FiRss, color: 'text-blue-400' },
  { id: 'comedy', label: 'Comedy', icon: FiSmile, color: 'text-yellow-400' },
  { id: 'education', label: 'Learn', icon: FiBook, color: 'text-teal-400' },
  { id: 'tech', label: 'Tech', icon: FiCpu, color: 'text-sky-400' },
];

const SUGGESTED_CREATORS = [
  { id: 1, name: 'Alex Rivera', username: '@arivera', followers: '1.2M', avatar: 'AR' },
  { id: 2, name: 'Sarah Chen', username: '@schen', followers: '850K', avatar: 'SC' },
  { id: 3, name: 'Mike Ross', username: '@mross', followers: '2.1M', avatar: 'MR' },
];

const TRENDING_HASHTAGS = [
  { tag: '#VipChat', counts: '2.5M' },
  { tag: '#TechTrends', counts: '840K' },
  { tag: '#Cooking', counts: '1.2M' },
  { tag: '#Travel', counts: '3.1M' },
];

// ── Ad Overlay (shown for free users, skippable after 10s) ────────────────────
function AdOverlay({ ad, onSkip, onClose }) {
  const [countdown, setCountdown] = useState(ad?.ad_skip_after_sec || 10);
  const [canSkip, setCanSkip] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (countdown <= 0) { setCanSkip(true); return; }
    const t = setTimeout(() => setCountdown(v => v - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  useEffect(() => {
    if (videoRef.current && ad?.video_url) {
      videoRef.current.play().catch(() => {});
    }
  }, [ad]);

  if (!ad) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black z-30 flex flex-col"
    >
      <video
        ref={videoRef}
        src={ad.video_url}
        className="w-full h-full object-cover"
        autoPlay
        playsInline
        onEnded={onSkip}
      />
      <div className="absolute inset-0 flex flex-col justify-between p-4">
        <div className="flex items-start justify-between">
          <span className="bg-black/70 text-white text-xs font-bold px-2 py-1 rounded-full">
            Ad · {ad.ad_sponsor_name || 'Sponsor'}
          </span>
          {canSkip ? (
            <button
              onClick={onSkip}
              className="flex items-center gap-1 bg-white/20 backdrop-blur-sm text-white text-sm font-bold px-3 py-1.5 rounded-full hover:bg-white/30 transition"
            >
              Skip <FiSkipForward size={14} />
            </button>
          ) : (
            <span className="bg-black/70 text-white text-xs px-3 py-1.5 rounded-full">
              Skip in {countdown}s
            </span>
          )}
        </div>
        <div className="flex items-end justify-between">
          <div className="bg-black/60 backdrop-blur-sm rounded-xl p-3 max-w-xs">
            <p className="text-white font-semibold text-sm">{ad.title}</p>
            {ad.ad_url && (
              <a href={ad.ad_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-blue-400 text-xs mt-1 hover:underline">
                Learn more <FiExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── Single Video Player (TikTok/YouTube Shorts style) ─────────────────────────
function VideoCard({ video, isActive, onLike, onComment, onShare, isLoggedIn }) {
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
  const [loadingComment, setLoadingComment] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes || 0);
  const [commentsCount, setCommentsCount] = useState(video.comments_count || 0);
  const [progress, setProgress] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const [lastTap, setLastTap] = useState(0);

  useEffect(() => {
    if (isActive && videoRef.current) {
      if (!isLoggedIn) {
        api.get(`/trends/video/${video.id}`).then(({ data }) => {
          if (data.pre_roll_ad) {
            setPreRollAd(data.pre_roll_ad);
            setShowAd(true);
          } else {
            playVideo();
          }
        }).catch(() => playVideo());
      } else {
        playVideo();
      }
    } else if (!isActive && videoRef.current) {
      videoRef.current.pause();
      setPlaying(false);
    }
  }, [isActive]);

  const playVideo = () => {
    if (videoRef.current) {
      videoRef.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const handleDoubleTap = () => {
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleSeek = (e) => {
    if (videoRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = x / rect.width;
      videoRef.current.currentTime = pct * videoRef.current.duration;
    }
  };

  const handleLike = async () => {
    if (!isLoggedIn) { toast.error('Log in to like videos'); return; }
    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount(v => newLiked ? v + 1 : Math.max(0, v - 1));
    try {
      await api.post(`/trends/video/${video.id}/like`);
    } catch { setLiked(!newLiked); setLikesCount(v => newLiked ? Math.max(0, v - 1) : v + 1); }
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/trends?v=${video.id}`;
    if (navigator.share) {
      navigator.share({ title: video.title, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
    try { await api.post(`/trends/video/${video.id}/track`, { event: 'share' }); } catch {}
  };

  const loadComments = async () => {
    try {
      const { data } = await api.get(`/trends/video/${video.id}`);
      setComments(data.comments || []);
    } catch {}
  };

  const submitComment = async () => {
    if (!comment.trim()) return;
    if (!isLoggedIn) { toast.error('Log in to comment'); return; }
    setLoadingComment(true);
    try {
      await api.post(`/trends/video/${video.id}/comment`, { content: comment });
      setComment('');
      setCommentsCount(v => v + 1);
      loadComments();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setLoadingComment(false); }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        toast.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isAdVideo = video._is_injected_ad || video.is_ad;

  return (
    <div ref={containerRef} className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center">
      {/* Video element */}
      <video
        ref={videoRef}
        src={video.video_url}
        className="max-h-full w-auto object-contain cursor-pointer"
        loop
        playsInline
        muted={muted}
        onTimeUpdate={handleTimeUpdate}
        onClick={handleDoubleTap}
        poster={video.thumbnail_url}
      />

      {/* Pre-roll ad overlay */}
      <AnimatePresence>
        {showAd && preRollAd && (
          <AdOverlay
            ad={preRollAd}
            onSkip={() => { setShowAd(false); playVideo(); }}
            onClose={() => { setShowAd(false); playVideo(); }}
          />
        )}
      </AnimatePresence>

      {/* Heart Burst Animation */}
      <AnimatePresence>
        {showHeartBurst && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 2, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
          >
            <FiHeart size={100} className="text-red-500 fill-red-500 shadow-xl" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Play/pause indicator */}
      <AnimatePresence>
        {!playing && !showAd && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none"
          >
            <div className="w-20 h-20 bg-black/40 rounded-full flex items-center justify-center">
              <FiPlay size={36} className="text-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ad badge */}
      {isAdVideo && !showAd && (
        <div className="absolute top-4 left-4 bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
          AD · {video.ad_sponsor_name || 'Sponsored'}
        </div>
      )}

      {/* Bottom info overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none z-10">
        <div className="max-w-xl">
          <div className="flex items-center gap-3 mb-3 pointer-events-auto">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-teal-500 flex items-center justify-center text-white font-bold text-sm border-2 border-white/20">
              {video.uploader_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <p className="text-white font-bold text-sm flex items-center gap-1">
                {video.uploader_name}
                {video.uploader_type === 'sponsor' && (
                  <span className="bg-yellow-500/20 text-yellow-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">SPONSOR</span>
                )}
              </p>
              <button className="text-[#25D366] text-xs font-bold hover:underline">Follow</button>
            </div>
          </div>
          <p className="text-white text-sm font-medium line-clamp-2 mb-2">{video.title}</p>
          {video.description && (
            <p className="text-white/70 text-xs line-clamp-2 mb-2">{video.description}</p>
          )}
          <div className="flex items-center gap-2 text-white/50 text-[10px]">
            <FiMusic size={10} />
            <span className="truncate">Original Audio - {video.uploader_name}</span>
          </div>
        </div>
      </div>

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-6 z-10">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
          <motion.div 
            whileTap={{ scale: 0.8 }}
            className={`w-12 h-12 rounded-full flex items-center justify-center transition-all ${liked ? 'bg-red-500/20' : 'bg-black/40 hover:bg-black/60'}`}
          >
            <FiHeart size={24} className={`transition-colors ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          </motion.div>
          <span className="text-white text-xs font-bold drop-shadow-md">{likesCount.toLocaleString()}</span>
        </button>

        <button onClick={() => { setShowComments(v => !v); if (!showComments) loadComments(); }}
          className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all">
            <FiMessageCircle size={24} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-md">{commentsCount.toLocaleString()}</span>
        </button>

        <button className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all">
            <FiBookmark size={24} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-md">Save</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1 group">
          <div className="w-12 h-12 rounded-full bg-black/40 hover:bg-black/60 flex items-center justify-center transition-all">
            <FiShare2 size={24} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold drop-shadow-md">{(video.shares || 0).toLocaleString()}</span>
        </button>

        <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center overflow-hidden animate-spin-slow border-2 border-white/20">
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-gray-700 to-gray-900" />
        </div>
      </div>

      {/* Modern Video Controls (Bottom) */}
      <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-black/40 backdrop-blur-sm flex flex-col gap-2 z-20 group">
        {/* Progress Bar */}
        <div 
          className="w-full h-1 bg-white/20 rounded-full cursor-pointer relative overflow-hidden group-hover:h-2 transition-all"
          onClick={handleSeek}
        >
          <div 
            className="absolute left-0 top-0 bottom-0 bg-[#25D366]"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-[#25D366] transition">
              {playing ? <FiX size={18} /> : <FiPlay size={18} />}
            </button>
            <div className="flex items-center gap-2 group/vol">
              <button onClick={() => setMuted(v => !v)} className="text-white">
                {muted ? <FiVolumeX size={18} /> : <FiVolume2 size={18} />}
              </button>
              <input 
                type="range" min="0" max="1" step="0.1" 
                className="w-0 group-hover/vol:w-20 transition-all origin-left accent-[#25D366]" 
                onChange={(e) => {
                  if (videoRef.current) videoRef.current.volume = e.target.value;
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Playback Speed */}
            <div className="relative">
              <button 
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="text-white text-xs font-bold hover:text-[#25D366] transition"
              >
                {playbackSpeed}x
              </button>
              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/10 rounded-lg overflow-hidden py-1 min-w-[60px]">
                  {[0.5, 1, 1.5, 2].map(speed => (
                    <button
                      key={speed}
                      onClick={() => {
                        setPlaybackSpeed(speed);
                        if (videoRef.current) videoRef.current.playbackRate = speed;
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-white/10 ${playbackSpeed === speed ? 'text-[#25D366]' : 'text-white'}`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button onClick={toggleFullscreen} className="text-white hover:text-[#25D366] transition">
              <FiMaximize size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Comments panel */}
      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="absolute inset-x-0 bottom-0 bg-gray-900/95 backdrop-blur-sm rounded-t-3xl max-h-[60%] flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <p className="text-white font-bold text-sm">{commentsCount} Comments</p>
              <button onClick={() => setShowComments(false)}>
                <FiX size={20} className="text-white/70" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {comments.length === 0 && (
                <p className="text-white/50 text-sm text-center py-4">No comments yet. Be first!</p>
              )}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0">
                    {c.user_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white/70 text-[11px] font-semibold">{c.user_name}</p>
                    <p className="text-white text-sm">{c.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 p-3 border-t border-white/10">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitComment()}
                placeholder="Add a comment..."
                className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-white/30"
              />
              <button onClick={submitComment} disabled={loadingComment || !comment.trim()}
                className="w-9 h-9 bg-[#25D366] rounded-full flex items-center justify-center disabled:opacity-40">
                <FiSend size={15} className="text-white" />
              </button>
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
  const { user } = useAuthStore();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('trending');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [stats, setStats] = useState(null);
  const [viewMode, setViewMode] = useState('scroll'); // scroll | grid
  const [feedType, setFeedType] = useState('for-you'); // for-you | following | trending
  const containerRef = useRef(null);
  const observerRef = useRef(null);
  const loadingMore = useRef(false);

  const fetchVideos = useCallback(async (cat = category, s = sort, pg = 1, append = false) => {
    if (loadingMore.current && append) return;
    if (append) loadingMore.current = true;
    else setLoading(true);
    try {
      const endpoint = searchQuery
        ? `/trends/search?q=${encodeURIComponent(searchQuery)}&page=${pg}`
        : `/trends/feed?category=${cat}&sort=${s}&page=${pg}&feed=${feedType}`;
      const { data } = await api.get(endpoint);
      const newVideos = data.videos || [];
      setVideos(prev => append ? [...prev, ...newVideos] : newVideos);
      setHasMore(pg < (data.pages || 1));
      setPage(pg);
    } catch (e) {
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
    fetchVideos(category, sort, 1, false);
  }, [category, sort, searchQuery, feedType]);

  // Intersection observer for scroll-based active video detection
  useEffect(() => {
    if (viewMode !== 'scroll') return;
    const cards = containerRef.current?.querySelectorAll('[data-video-card]');
    if (!cards?.length) return;
    observerRef.current?.disconnect();
    observerRef.current = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt(entry.target.dataset.idx, 10);
            setActiveIdx(idx);
            // Load more when near end
            if (idx >= videos.length - 3 && hasMore && !loadingMore.current) {
              fetchVideos(category, sort, page + 1, true);
            }
          }
        });
      },
      { threshold: 0.6 }
    );
    cards.forEach(card => observerRef.current.observe(card));
    return () => observerRef.current?.disconnect();
  }, [videos, viewMode, hasMore, page, category, sort]);

  const handleSearch = () => {
    setSearchQuery(search.trim());
  };

  const SORT_OPTIONS = [
    { id: 'trending', label: 'Trending', icon: FiTrendingUp },
    { id: 'latest', label: 'Latest', icon: FiClock },
    { id: 'popular', label: 'Popular', icon: FiStar },
  ];

  return (
    <div className="flex h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* ── Left Sidebar (280px) ─────────────────────────────────────────── */}
      <div className="hidden lg:flex w-[280px] flex-col border-r border-white/10 bg-[#0a0a0a] shrink-0 overflow-y-auto no-scrollbar">
        {/* User Mini-Card */}
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
            <div className="flex gap-4 text-xs">
              <span className="text-white/60"><strong className="text-white">1.2K</strong> Following</span>
              <span className="text-white/60"><strong className="text-white">45.8K</strong> Followers</span>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <p className="text-white/60 text-sm mb-4">Log in to follow creators, like videos, and view comments.</p>
            <button onClick={() => navigate('/login')} className="w-full py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-lg transition">Log in</button>
          </div>
        )}

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Navigation */}
        <nav className="px-4 space-y-1">
          <button 
            onClick={() => setFeedType('for-you')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-lg ${feedType === 'for-you' ? 'text-[#25D366] bg-white/5' : 'text-white/60 hover:bg-white/5'}`}
          >
            <FiPlay /> For You
          </button>
          <button 
            onClick={() => setFeedType('following')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-lg ${feedType === 'following' ? 'text-[#25D366] bg-white/5' : 'text-white/60 hover:bg-white/5'}`}
          >
            <FiRss /> Following
          </button>
          <button 
            onClick={() => setFeedType('trending')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition font-bold text-lg ${feedType === 'trending' ? 'text-[#25D366] bg-white/5' : 'text-white/60 hover:bg-white/5'}`}
          >
            <FiTrendingUp /> Trending
          </button>
        </nav>

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Suggested Accounts */}
        <div className="px-6 py-2">
          <p className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider">Suggested accounts</p>
          <div className="space-y-4">
            {SUGGESTED_CREATORS.map(creator => (
              <div key={creator.id} className="flex items-center justify-between group cursor-pointer">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center text-white text-[10px] font-bold border border-white/10 group-hover:border-[#25D366] transition">
                    {creator.avatar}
                  </div>
                  <div>
                    <p className="text-xs font-bold group-hover:underline">{creator.name}</p>
                    <p className="text-white/40 text-[10px]">{creator.username}</p>
                  </div>
                </div>
                <button className="text-[#25D366] text-[10px] font-bold hover:underline">Follow</button>
              </div>
            ))}
          </div>
          <button className="mt-4 text-[#25D366] text-xs font-bold hover:underline">See all</button>
        </div>

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Categories (Vertical) */}
        <div className="px-6 py-2">
          <p className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider">Explore Topics</p>
          <div className="space-y-1">
            {CATEGORIES.map(cat => (
              <button 
                key={cat.id} 
                onClick={() => setCategory(cat.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${category === cat.id ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'}`}
              >
                <cat.icon className={category === cat.id ? 'text-[#25D366]' : cat.color} size={14} />
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-px bg-white/5 mx-6 my-4" />

        {/* Trending Hashtags */}
        <div className="px-6 py-2">
          <p className="text-white/40 text-xs font-bold uppercase mb-4 tracking-wider">Trending</p>
          <div className="space-y-4">
            {TRENDING_HASHTAGS.map(h => (
              <div key={h.tag} className="group cursor-pointer">
                <p className="text-sm font-medium hover:underline flex items-center gap-2">
                  <FiActivity size={12} className="text-white/40" /> {h.tag}
                </p>
                <p className="text-[10px] text-white/40 ml-5">{h.counts} videos</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto p-6 space-y-2">
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/30 font-medium">
            <button className="hover:underline">About</button>
            <button className="hover:underline">Newsroom</button>
            <button className="hover:underline">Contact</button>
            <button className="hover:underline">Careers</button>
            <button className="hover:underline">VipChat for Good</button>
            <button className="hover:underline">Advertise</button>
            <button className="hover:underline">Developers</button>
          </div>
          <p className="text-[10px] text-white/20 pt-2">© 2024 VipTrends</p>
        </div>
      </div>

      {/* ── Main Content Area ─────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Header */}
        <header className="h-[72px] border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md flex items-center justify-between px-6 z-40 shrink-0">
          <div className="flex items-center gap-4 lg:hidden">
            <button onClick={() => navigate(user ? '/' : '/login')} className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center">
              <MdOutlineSubscriptions size={20} className="text-white" />
            </button>
          </div>

          <div className="flex-1 max-w-xl mx-auto px-4">
            <div className="relative group">
              <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#25D366] transition-colors" />
              <input 
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                type="text" 
                placeholder="Search accounts and videos" 
                className="w-full bg-white/5 border border-transparent focus:border-white/20 focus:bg-white/10 rounded-full py-2.5 pl-11 pr-4 text-sm transition-all outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
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
            {!user ? (
              <button onClick={() => navigate('/login')} className="px-6 py-2 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-lg text-sm transition">Log in</button>
            ) : (
              <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition">
                <FiArrowLeft />
              </button>
            )}
          </div>
        </header>

        {/* Scrollable Feed Container */}
        <main className="flex-1 overflow-y-auto no-scrollbar relative snap-y snap-mandatory bg-black">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
              <p className="text-white/40 text-sm animate-pulse">Tailoring your feed...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mb-6">
                <MdOutlineSubscriptions size={40} className="text-white/20" />
              </div>
              <h2 className="text-2xl font-bold mb-2">No videos yet</h2>
              <p className="text-white/40 max-w-xs mb-8">Follow more accounts or check back later for new content.</p>
              <button onClick={() => { setFeedType('for-you'); setCategory('all'); }} className="px-8 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-full transition">Refresh Feed</button>
            </div>
          ) : viewMode === 'scroll' ? (
            /* ── Vertical Fullscreen Shorts ── */
            <div ref={containerRef} className="h-full w-full">
              {videos.map((video, idx) => (
                <div 
                  key={`${video.id}-${idx}`} 
                  data-video-card 
                  data-idx={idx}
                  className="h-full w-full snap-start relative flex items-center justify-center"
                >
                  <div className="relative w-full h-full max-w-[500px] bg-black shadow-2xl overflow-hidden">
                    <VideoCard video={video} isActive={activeIdx === idx} isLoggedIn={!!user} />
                  </div>
                  {/* Up/Down Arrows (Visible on large screens) */}
                  <div className="hidden xl:flex absolute left-full ml-8 flex-col gap-4">
                    <button 
                      onClick={() => containerRef.current.scrollBy({ top: -window.innerHeight, behavior: 'smooth' })}
                      className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition"
                    >
                      <FiChevronUp size={24} />
                    </button>
                    <button 
                      onClick={() => containerRef.current.scrollBy({ top: window.innerHeight, behavior: 'smooth' })}
                      className="w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center border border-white/10 transition"
                    >
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
            /* ── Grid browse mode ── */
            <div className="max-w-7xl mx-auto p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {videos.filter(v => !v._is_injected_ad).map(video => (
                  <motion.div
                    key={video.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    className="relative group cursor-pointer"
                    onClick={() => { setViewMode('scroll'); setActiveIdx(videos.findIndex(v => v.id === video.id)); }}
                  >
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
                  <button onClick={() => fetchVideos(category, sort, page + 1, true)}
                    className="px-12 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-full border border-white/10 transition">
                    Load More Content
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Right Panel (320px, Optional - for Comments/Shares on large screens) ── */}
      <AnimatePresence>
        {activeIdx !== null && videos[activeIdx] && viewMode === 'scroll' && (
          <motion.div 
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            className="hidden xl:flex w-[350px] flex-col border-l border-white/10 bg-[#0a0a0a] shrink-0 overflow-hidden"
          >
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center text-white font-bold border-2 border-white/10">
                  {videos[activeIdx].uploader_name?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-bold hover:underline cursor-pointer">{videos[activeIdx].uploader_name}</p>
                  <p className="text-white/40 text-xs">@{videos[activeIdx].uploader_name?.toLowerCase().replace(/\s/g, '')}</p>
                </div>
                <button className="ml-auto px-4 py-1.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white text-xs font-bold rounded-lg transition">Follow</button>
              </div>
              <p className="text-sm leading-relaxed mb-4">{videos[activeIdx].title}</p>
              <div className="flex items-center gap-2 text-[#25D366] text-sm font-medium mb-4">
                <FiMusic size={14} />
                <span>Original Sound - {videos[activeIdx].uploader_name}</span>
              </div>
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
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <p className="text-xs font-bold text-white/40 uppercase tracking-widest">Comments</p>
              {/* Dummy Comments for UI */}
              <div className="space-y-6">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 shrink-0 border border-white/10" />
                    <div>
                      <p className="text-xs font-bold mb-1">User_{i} <span className="text-white/20 font-medium ml-2">2h</span></p>
                      <p className="text-sm text-white/80">This content is absolutely amazing! 🔥 Keep up the great work.</p>
                      <div className="flex items-center gap-4 mt-2 text-[10px] font-bold text-white/40">
                        <button className="hover:text-white transition">Reply</button>
                        <button className="flex items-center gap-1 hover:text-red-500 transition"><FiHeart size={10} /> 12</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-white/5 border-t border-white/10">
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Add comment..." 
                  className="w-full bg-black/40 border border-white/10 focus:border-[#25D366] rounded-xl py-3 pl-4 pr-12 text-sm transition-all outline-none"
                />
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-[#25D366] hover:scale-110 transition-transform">
                  <FiSend />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
