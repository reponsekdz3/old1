import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FiPlus, FiCamera, FiX, FiChevronRight, FiImage,
  FiType, FiTrash2, FiEye, FiVideo, FiSend,
} from 'react-icons/fi';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// StatusViewer — full-screen story viewer with image/video/text support
// ─────────────────────────────────────────────────────────────────────────────
function StatusViewer({ statusGroup, onClose, isOwn }) {
  const items = statusGroup?.statuses || [statusGroup];
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef(null);
  const videoRef = useRef(null);
  const current = items[idx];

  const isVideo = !!(current?.media_url && (current?.media_type === 'video' || /\.(mp4|webm|mov)/i.test(current?.media_url)));
  const isImage = !!(current?.media_url && !isVideo && (current?.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(current?.media_url)));
  const DURATION = isVideo ? null : 6000;

  const advance = useCallback(() => {
    if (idx < items.length - 1) setIdx(i => i + 1);
    else onClose();
  }, [idx, items.length, onClose]);

  useEffect(() => {
    if (paused || isVideo) return;
    timerRef.current = setTimeout(advance, DURATION || 6000);
    return () => clearTimeout(timerRef.current);
  }, [idx, paused, isVideo, advance, DURATION]);

  useEffect(() => {
    if (current?.id && !isOwn) {
      api.post(`/status/${current.id}/view`).catch(() => {});
    }
  }, [current?.id, isOwn]);

  // reset video on idx change
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [idx]);

  const goBack = () => { if (idx > 0) setIdx(i => i - 1); else onClose(); };

  const deleteStatus = async () => {
    if (!window.confirm('Delete this status?')) return;
    try {
      await api.delete(`/status/${current.id}`);
      toast.success('Status deleted');
      if (items.length <= 1) onClose();
      else advance();
    } catch { toast.error('Failed to delete'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col select-none"
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
          <video
            ref={videoRef}
            src={current.media_url}
            autoPlay
            playsInline
            className="w-full h-full object-contain"
            onEnded={advance}
          />
        ) : isImage && current?.media_url ? (
          <img
            src={current.media_url}
            alt="status"
            className="w-full h-full object-contain"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center px-8"
            style={{ backgroundColor: current?.background_color || '#008069' }}
          >
            <p
              className="text-white font-bold text-center leading-snug"
              style={{ fontSize: 'clamp(20px, 5vw, 36px)' }}
            >
              {current?.content || ''}
            </p>
          </div>
        )}

        {/* Caption on media */}
        {(isImage || isVideo) && current?.content && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-6 pb-20 pt-10">
            <p className="text-white text-base font-medium text-center">{current.content}</p>
          </div>
        )}

        {/* Navigation tap zones */}
        <div className="absolute inset-0 flex" style={{ top: 70 }}>
          <div
            className="flex-1"
            onClick={goBack}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
          <div
            className="flex-1"
            onClick={advance}
            onPointerDown={() => setPaused(true)}
            onPointerUp={() => setPaused(false)}
            onPointerLeave={() => setPaused(false)}
          />
        </div>
      </div>

      {/* Viewers row for own statuses */}
      {isOwn && (
        <div className="flex items-center gap-2 px-5 py-4 border-t border-white/10 flex-shrink-0">
          <FiEye size={16} className="text-white/60" />
          <span className="text-white/60 text-sm">{current?.viewers_count || 0} viewer{current?.viewers_count !== 1 ? 's' : ''}</span>
          <span className="ml-auto text-white/40 text-xs">{idx + 1} of {items.length}</span>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StatusComposer — WhatsApp-style status creation: text | photo | video
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-3 flex-shrink-0">
        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition">
          <FiX size={22} className="text-white" />
        </button>
        <span className="text-white font-bold text-lg flex-1">New Status</span>
        {/* Mode switcher */}
        <div className="flex gap-1 bg-black/20 rounded-full p-1">
          {[
            { id: 'text', icon: FiType, label: 'Text' },
            { id: 'image', icon: FiImage, label: 'Photo' },
            { id: 'video', icon: FiVideo, label: 'Video' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => { setMode(id); clearMedia(); }}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${mode === id ? 'bg-white text-gray-900 shadow' : 'text-white/70 hover:text-white'}`}
            >
              <Icon size={11} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">

        {/* TEXT MODE */}
        {mode === 'text' && (
          <div className="w-full flex-1 flex flex-col items-center justify-center px-8">
            <textarea
              autoFocus
              value={statusText}
              onChange={e => setStatusText(e.target.value)}
              placeholder="Type a status..."
              maxLength={700}
              className="w-full bg-transparent text-white font-bold text-center placeholder-white/40 resize-none outline-none leading-snug"
              style={{ fontSize: 'clamp(18px, 4vw, 30px)' }}
              rows={5}
            />
          </div>
        )}

        {/* IMAGE / VIDEO MODE — no file chosen */}
        {(mode === 'image' || mode === 'video') && !mediaPreviewUrl && (
          <div className="flex flex-col items-center gap-5 px-6 text-center">
            <div className="w-28 h-28 rounded-full bg-white/10 flex items-center justify-center">
              {mode === 'image'
                ? <FiImage size={44} className="text-white/50" />
                : <FiVideo size={44} className="text-white/50" />}
            </div>
            <p className="text-white/60 font-medium">
              {mode === 'image' ? 'Choose a photo to share as your status' : 'Choose a video to share as your status'}
            </p>
            <div className="flex gap-3 flex-wrap justify-center">
              {mode === 'image' ? (
                <>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition"
                  >
                    <FiImage size={16} /> Gallery
                  </button>
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition"
                  >
                    <FiCamera size={16} /> Camera
                  </button>
                </>
              ) : (
                <button
                  onClick={() => videoInputRef.current?.click()}
                  className="flex items-center gap-2 px-5 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-semibold transition"
                >
                  <FiVideo size={16} /> Choose Video
                </button>
              )}
            </div>
          </div>
        )}

        {/* IMAGE PREVIEW */}
        {mode === 'image' && mediaPreviewUrl && (
          <div className="relative w-full h-full flex items-center justify-center">
            <img src={mediaPreviewUrl} alt="Preview" className="max-w-full max-h-full object-contain" />
            <button
              onClick={clearMedia}
              className="absolute top-4 left-4 p-2 bg-black/60 rounded-full transition hover:bg-black/80"
            >
              <FiX size={16} className="text-white" />
            </button>
          </div>
        )}

        {/* VIDEO PREVIEW */}
        {mode === 'video' && mediaPreviewUrl && (
          <div className="relative w-full h-full flex items-center justify-center bg-black">
            <video src={mediaPreviewUrl} controls playsInline className="max-w-full max-h-full" />
            <button
              onClick={clearMedia}
              className="absolute top-4 left-4 p-2 bg-black/60 rounded-full transition hover:bg-black/80"
            >
              <FiX size={16} className="text-white" />
            </button>
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className="flex-shrink-0 px-4 pb-10 pt-2">
        {/* Text mode: char counter + colour picker */}
        {mode === 'text' && (
          <>
            <p className="text-center text-white/40 text-xs mb-3">{700 - statusText.length} characters remaining</p>
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {bgColors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedBg(color)}
                  className={`w-9 h-9 rounded-full flex-shrink-0 transition-all border-2 ${selectedBg === color ? 'scale-125 border-white shadow-lg' : 'border-transparent hover:scale-110'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </>
        )}

        {/* Media mode: caption input */}
        {(mode === 'image' || mode === 'video') && mediaPreviewUrl && (
          <div className="flex items-center gap-3 mb-4">
            <input
              type="text"
              placeholder="Add a caption..."
              value={caption}
              onChange={e => setCaption(e.target.value)}
              className="flex-1 bg-white/10 text-white placeholder-white/40 rounded-2xl px-4 py-3 outline-none text-sm border border-white/10 focus:border-white/30 transition"
            />
          </div>
        )}

        <button
          onClick={handleShare}
          disabled={!canShare || posting}
          className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-40 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 text-base"
        >
          {uploading ? (
            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Uploading…</>
          ) : posting ? (
            <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting…</>
          ) : (
            <><FiSend size={18} /> Share Status</>
          )}
        </button>
      </div>

      {/* Hidden file inputs */}
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
  const [viewingStatus, setViewingStatus] = useState(null);
  const [viewingOwn, setViewingOwn] = useState(false);

  useEffect(() => { loadStatuses(); }, []);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/status/all');
      setStatuses(data.statuses || []);
      setMyStatuses(data.my_statuses || []);
    } catch {
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  const openMyStatus = () => {
    if (myStatuses.length > 0) {
      setViewingStatus({ owner_name: user?.full_name || 'Me', owner_avatar: user?.avatar_url, statuses: myStatuses });
      setViewingOwn(true);
    } else {
      setShowCompose(true);
    }
  };

  const avatarInitial = user?.full_name?.[0]?.toUpperCase() || '?';
  const latestMine = myStatuses[0];
  const mineHasImage = latestMine?.media_url && (latestMine?.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(latestMine?.media_url));

  return (
    <>
      <div className="flex flex-col h-full bg-white overflow-y-auto">

        {/* ── My Status ── */}
        <div className="border-b border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-1">My Status</p>
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-4 py-3 transition-colors"
            onClick={openMyStatus}
          >
            {/* Avatar with ring + plus button */}
            <div className="relative flex-shrink-0">
              <div className={`w-14 h-14 rounded-full p-0.5 ${myStatuses.length > 0 ? 'bg-gradient-to-br from-green-400 to-teal-600' : 'bg-gray-200'}`}>
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-100">
                  {user?.avatar_url ? (
                    <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : mineHasImage ? (
                    <img src={latestMine.media_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center font-bold text-xl text-white"
                      style={{ backgroundColor: latestMine?.background_color || '#25D366' }}
                    >
                      {latestMine ? '' : avatarInitial}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); setShowCompose(true); }}
                className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-[#25D366] rounded-full flex items-center justify-center border-2 border-white shadow-sm hover:bg-[#1fbd5a] transition"
              >
                <FiPlus size={13} className="text-white" />
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-[15px]">My status</p>
              <p className="text-[13px] text-gray-500 truncate">
                {myStatuses.length > 0
                  ? `${myStatuses.length} update${myStatuses.length !== 1 ? 's' : ''} · ${formatDistanceToNow(new Date(latestMine.created_at), { addSuffix: true })}`
                  : 'Tap to add a status update'}
              </p>
            </div>
            {myStatuses.length > 0 && <FiChevronRight size={16} className="text-gray-300 flex-shrink-0" />}
          </div>
        </div>

        {/* ── Recent Updates ── */}
        {!loading && statuses.length > 0 && (
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4 pt-4 pb-1">Recent Updates</p>
            {statuses.map((sg, i) => {
              const latest = sg.statuses?.[0];
              const hasImg = latest?.media_url && (latest?.media_type === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(latest?.media_url));
              const hasVid = latest?.media_url && (latest?.media_type === 'video' || /\.(mp4|webm|mov)/i.test(latest?.media_url));
              return (
                <motion.div
                  key={sg.user_id || i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 px-4 py-3 transition-colors border-b border-gray-50 last:border-0"
                  onClick={() => { setViewingStatus(sg); setViewingOwn(false); }}
                >
                  {/* Avatar with gradient ring */}
                  <div className={`relative w-14 h-14 rounded-full p-0.5 flex-shrink-0 ${sg.viewed ? 'bg-gray-300' : 'bg-gradient-to-br from-green-400 to-teal-600'}`}>
                    <div className="w-full h-full rounded-full overflow-hidden border-2 border-white bg-gray-200">
                      {sg.owner_avatar ? (
                        <img src={sg.owner_avatar} alt="" className="w-full h-full object-cover" />
                      ) : hasImg ? (
                        <img src={latest.media_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center font-bold text-xl text-white"
                          style={{ backgroundColor: latest?.background_color || '#008069' }}
                        >
                          {sg.owner_name?.[0]?.toUpperCase() || '?'}
                        </div>
                      )}
                    </div>
                    {hasVid && (
                      <div className="absolute bottom-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                        <FiVideo size={9} className="text-white" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-[15px]">{sg.owner_name}</p>
                    <p className="text-[13px] text-gray-500 truncate">
                      {sg.latest_at ? formatDistanceToNow(new Date(sg.latest_at), { addSuffix: true }) : ''}
                      {sg.statuses?.length > 1 && ` · ${sg.statuses.length} updates`}
                    </p>
                  </div>

                  {!sg.viewed && (
                    <div className="w-2.5 h-2.5 rounded-full bg-[#25D366] flex-shrink-0" />
                  )}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && statuses.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-20 px-8 text-center">
            <div className="w-20 h-20 bg-[#f0f2f5] rounded-full flex items-center justify-center mb-5">
              <FiCamera size={32} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">No recent updates</p>
            <p className="text-sm text-gray-400 mb-6">Status updates from your contacts will appear here</p>
            <button
              onClick={() => setShowCompose(true)}
              className="px-6 py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-semibold rounded-full text-sm transition"
            >
              Add Status Update
            </button>
          </div>
        )}

        {/* ── Loading skeleton ── */}
        {loading && (
          <div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse border-b border-gray-50">
                <div className="w-14 h-14 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-gray-200 rounded-full w-1/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Full-screen status viewer ── */}
      <AnimatePresence>
        {viewingStatus && (
          <StatusViewer
            statusGroup={viewingStatus}
            isOwn={viewingOwn}
            onClose={() => { setViewingStatus(null); if (viewingOwn) loadStatuses(); }}
          />
        )}
      </AnimatePresence>

      {/* ── Status composer ── */}
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
