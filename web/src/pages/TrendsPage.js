import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiSearch, FiHeart, FiShare2, FiMessageCircle, FiPlay,
  FiVolume2, FiVolumeX, FiArrowLeft,
  FiTrendingUp, FiStar, FiClock,
  FiSkipForward, FiX, FiSend,
  FiGrid, FiMusic, FiActivity, FiZap, FiRss, FiSmile,
  FiBook, FiCpu, FiExternalLink,
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

  useEffect(() => {
    if (isActive && videoRef.current) {
      // Fetch pre-roll ad for non-logged-in or free users
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

  const isAdVideo = video._is_injected_ad || video.is_ad;

  return (
    <div className="relative w-full h-full bg-black overflow-hidden">
      {/* Video element */}
      <video
        ref={videoRef}
        src={video.video_url}
        className="w-full h-full object-cover"
        loop
        playsInline
        muted={muted}
        onClick={togglePlay}
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

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-16 p-4 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none">
        <p className="font-bold text-white text-sm line-clamp-2">{video.title}</p>
        {video.description && (
          <p className="text-white/70 text-xs mt-1 line-clamp-2">{video.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-[10px]">
            {video.uploader_name?.[0]?.toUpperCase() || '?'}
          </div>
          <span className="text-white/80 text-xs font-medium">{video.uploader_name}</span>
          {video.uploader_type === 'sponsor' && (
            <span className="bg-yellow-500/20 text-yellow-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">SPONSOR</span>
          )}
        </div>
      </div>

      {/* Right sidebar actions */}
      <div className="absolute right-3 bottom-24 flex flex-col items-center gap-5">
        <button onClick={handleLike} className="flex flex-col items-center gap-1 group">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${liked ? 'bg-red-500/20' : 'bg-black/40'}`}>
            <FiHeart size={22} className={`transition-colors ${liked ? 'text-red-500 fill-red-500' : 'text-white'}`} />
          </div>
          <span className="text-white text-xs font-bold">{likesCount.toLocaleString()}</span>
        </button>

        <button onClick={() => { setShowComments(v => !v); if (!showComments) loadComments(); }}
          className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
            <FiMessageCircle size={22} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold">{commentsCount.toLocaleString()}</span>
        </button>

        <button onClick={handleShare} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
            <FiShare2 size={20} className="text-white" />
          </div>
          <span className="text-white text-xs font-bold">{(video.shares || 0).toLocaleString()}</span>
        </button>

        <button onClick={() => setMuted(v => !v)} className="flex flex-col items-center gap-1">
          <div className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center">
            {muted ? <FiVolumeX size={20} className="text-white" /> : <FiVolume2 size={20} className="text-white" />}
          </div>
        </button>
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
        : `/trends/feed?category=${cat}&sort=${s}&page=${pg}`;
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
  }, [category, sort, searchQuery]);

  useEffect(() => {
    api.get('/trends/stats').then(({ data }) => setStats(data)).catch(() => {});
  }, []);

  useEffect(() => {
    setActiveIdx(0);
    fetchVideos(category, sort, 1, false);
  }, [category, sort, searchQuery]);

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
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      {/* ── Fixed Header ──────────────────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-lg border-b border-white/8">
        <div className="px-4 lg:px-6">
          <div className="flex items-center gap-3 py-3">
            {/* Back / Logo */}
            <button onClick={() => navigate(user ? '/' : '/login')}
              className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                <MdOutlineSubscriptions size={19} className="text-white" />
              </div>
              <div className="hidden sm:block">
                <span className="font-black text-[17px] bg-gradient-to-r from-[#25D366] to-teal-400 bg-clip-text text-transparent">
                  VipTrends
                </span>
              </div>
            </button>

            {/* Search bar */}
            <div className="flex-1 max-w-2xl">
              <div className="flex items-center bg-white/8 hover:bg-white/12 border border-white/10 rounded-xl overflow-hidden transition-colors">
                <FiSearch size={16} className="ml-3 text-white/40 flex-shrink-0" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  placeholder="Search trends, creators, topics..."
                  className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder-white/35 focus:outline-none"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setSearchQuery(''); }}
                    className="p-2 text-white/40 hover:text-white transition">
                    <FiX size={14} />
                  </button>
                )}
                <button onClick={handleSearch}
                  className="px-4 py-2.5 bg-[#25D366]/20 hover:bg-[#25D366]/40 text-[#25D366] text-xs font-bold transition border-l border-white/8">
                  Search
                </button>
              </div>
            </div>

            {/* View toggle */}
            <div className="hidden sm:flex items-center gap-1 bg-white/8 border border-white/10 rounded-xl p-1">
              <button onClick={() => setViewMode('scroll')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'scroll' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}>
                <FiPlay size={11} /> Shorts
              </button>
              <button onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${viewMode === 'grid' ? 'bg-white text-black shadow' : 'text-white/50 hover:text-white'}`}>
                <FiGrid size={11} /> Browse
              </button>
            </div>

            {/* Auth buttons */}
            {!user ? (
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => navigate('/login')}
                  className="px-3 py-2 bg-white/10 hover:bg-white/15 text-white text-xs font-bold rounded-xl transition border border-white/10">
                  Log In
                </button>
                <button onClick={() => navigate('/signup')}
                  className="px-3 py-2 bg-[#25D366] hover:bg-[#1fbd5a] text-white text-xs font-bold rounded-xl transition shadow-lg shadow-green-900/30">
                  Sign Up
                </button>
              </div>
            ) : (
              <button onClick={() => navigate('/')}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white/8 hover:bg-white/15 border border-white/10 rounded-xl transition text-xs font-bold text-white/70 hover:text-white">
                <FiArrowLeft size={13} />
                <span className="hidden sm:inline">Messages</span>
              </button>
            )}
          </div>

          {/* Categories + Sort row */}
          <div className="flex gap-2 pb-3 overflow-x-auto scrollbar-hide">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const isActive = category === cat.id && !searchQuery;
              return (
                <button key={cat.id}
                  onClick={() => { setCategory(cat.id); setSearchQuery(''); setSearch(''); }}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex-shrink-0 border ${
                    isActive
                      ? 'bg-white text-black border-white shadow-lg'
                      : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}>
                  <Icon size={13} className={isActive ? 'text-black' : cat.color} />
                  {cat.label}
                </button>
              );
            })}
            <div className="w-px bg-white/10 mx-1 flex-shrink-0" />
            {SORT_OPTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setSort(s.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex-shrink-0 border ${
                    sort === s.id
                      ? 'bg-[#25D366] text-white border-[#25D366] shadow-lg shadow-green-900/30'
                      : 'bg-white/5 text-white/50 border-white/8 hover:text-white/80'
                  }`}>
                  <Icon size={12} />
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats banner */}
      {stats && (
        <div className="fixed top-[110px] left-0 right-0 z-30 pointer-events-none">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-4 text-xs text-white/40">
              <span>{stats.total_videos?.toLocaleString()} videos</span>
              <span>·</span>
              <span>{stats.total_views?.toLocaleString()} views</span>
            </div>
          </div>
        </div>
      )}

      {/* Non-logged-in promo banner */}
      {!user && (
        <motion.div
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-gradient-to-r from-[#075E54] to-[#25D366] px-4 py-3 flex items-center justify-between"
        >
          <div>
            <p className="text-white font-bold text-sm">Join VipChat to like, comment & share!</p>
            <p className="text-white/70 text-xs">Pro users enjoy ad-free trends — no interruptions</p>
          </div>
          <button onClick={() => navigate('/signup')}
            className="bg-white text-[#075E54] font-bold text-sm px-5 py-2 rounded-full hover:opacity-90 transition flex-shrink-0">
            Join Free
          </button>
        </motion.div>
      )}

      {/* Content */}
      <div className="pt-[130px] pb-20">
        {loading ? (
          <div className="flex items-center justify-center h-[70vh]">
            <div className="text-center">
              <div className="w-12 h-12 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-white/50 text-sm">Loading trends...</p>
            </div>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex items-center justify-center h-[70vh]">
            <div className="text-center">
              <MdOutlineSubscriptions size={64} className="mx-auto mb-4 text-white/20" />
              <p className="text-white/50 text-lg font-semibold">No videos yet</p>
              <p className="text-white/30 text-sm mt-1">
                {searchQuery ? `No results for "${searchQuery}"` : 'Be the first to upload a trend!'}
              </p>
              {user && (
                <button onClick={() => navigate('/upload-trend')}
                  className="mt-4 px-6 py-2.5 bg-[#25D366] text-white font-semibold rounded-full hover:bg-[#1fbd5a] transition">
                  Upload Video
                </button>
              )}
            </div>
          </div>
        ) : viewMode === 'scroll' ? (
          /* ── Vertical Scroll (Shorts/Reels) mode ── */
          <div ref={containerRef} className="max-w-sm mx-auto">
            {videos.map((video, idx) => (
              <div
                key={`${video.id}-${idx}`}
                data-video-card
                data-idx={idx}
                style={{ height: 'calc(100dvh - 130px)' }}
                className="relative w-full snap-start"
              >
                <VideoCard
                  video={video}
                  isActive={activeIdx === idx}
                  isLoggedIn={!!user}
                />
              </div>
            ))}
            {hasMore && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        ) : (
          /* ── Grid browse mode ── */
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {videos.filter(v => !v._is_injected_ad).map(video => (
                <motion.div
                  key={video.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative bg-gray-900 rounded-xl overflow-hidden cursor-pointer group hover:ring-2 hover:ring-[#25D366] transition-all"
                  onClick={() => { setViewMode('scroll'); setActiveIdx(videos.findIndex(v => v.id === video.id)); }}
                >
                  <div className="aspect-[9/16] relative">
                    {video.thumbnail_url ? (
                      <img src={video.thumbnail_url} alt={video.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                        <FiPlay size={32} className="text-white/30" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                        <FiPlay size={20} className="text-white ml-1" />
                      </div>
                    </div>
                    {video.is_ad && (
                      <span className="absolute top-2 left-2 bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">AD</span>
                    )}
                    <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                      {Math.floor((video.duration_sec || 30) / 60)}:{String((video.duration_sec || 30) % 60).padStart(2, '0')}
                    </div>
                  </div>
                  <div className="p-2">
                    <p className="text-white text-xs font-semibold line-clamp-2 leading-tight">{video.title}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-white/50 text-[10px]">
                      <span className="flex items-center gap-0.5"><FiPlay size={9} />{(video.views || 0).toLocaleString()}</span>
                      <span className="flex items-center gap-0.5"><FiHeart size={9} />{(video.likes || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-8">
                <button onClick={() => fetchVideos(category, sort, page + 1, true)}
                  className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full transition">
                  Load More
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
