import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiUsers, FiHeart, FiSend, FiMic, FiMicOff, FiVideo, FiVideoOff,
  FiRadio, FiMaximize2, FiMinimize2, FiShare2, FiGift,
} from 'react-icons/fi';
import { MdOutlineLocalFireDepartment } from 'react-icons/md';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

function fmtNum(n) {
  n = parseInt(n || 0);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ── Live Chat Message ─────────────────────────────────────────────────────────
function ChatBubble({ msg }) {
  const colors = {
    join: 'text-[#25D366] font-bold',
    gift: 'text-yellow-400 font-bold',
    like: 'text-red-400',
    chat: 'text-white/80',
  };
  const icons = { join: '👋', gift: '🎁', like: '❤️', chat: '' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 px-3 py-1"
    >
      {msg.user_avatar ? (
        <img src={msg.user_avatar} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0 mt-0.5" />
      ) : (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
          {msg.user_name?.[0]?.toUpperCase() || '?'}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold text-white/60 mr-1">{msg.user_name}</span>
        <span className={`text-xs ${colors[msg.msg_type] || 'text-white/80'}`}>
          {icons[msg.msg_type] ? `${icons[msg.msg_type]} ` : ''}{msg.content}
        </span>
      </div>
    </motion.div>
  );
}

// ── Heart burst animation ─────────────────────────────────────────────────────
function HeartBurst({ x, y, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 1500); return () => clearTimeout(t); }, [onDone]);
  return (
    <motion.div
      className="fixed pointer-events-none text-2xl z-[500]"
      style={{ left: x - 12, top: y - 12 }}
      initial={{ scale: 0.5, opacity: 1, y: 0 }}
      animate={{ scale: 1.5, opacity: 0, y: -60 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
    >❤️</motion.div>
  );
}

// ── Go Live Modal ─────────────────────────────────────────────────────────────
export function GoLiveModal({ onClose, onStarted }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [starting, setStarting] = useState(false);

  const CATEGORIES = ['general', 'music', 'gaming', 'sports', 'comedy', 'education', 'tech', 'fashion', 'food', 'travel', 'fitness'];

  const handleStart = async () => {
    setStarting(true);
    try {
      const { data } = await api.post('/livestream/start', { title: title || 'My Live Stream', category });
      toast.success('You are now live! 🔴');
      onStarted?.(data.stream);
      onClose?.();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to start stream');
    }
    setStarting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-red-600 to-red-500 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <FiRadio size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white text-lg">Go Live</h3>
                <p className="text-white/70 text-xs">Start your live stream</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition text-white">
              <FiX size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Stream Title</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What are you streaming today?"
              maxLength={200}
              className="w-full bg-white/6 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-red-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-white/50 mb-2 uppercase tracking-wider">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat} type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition ${category === cat ? 'bg-red-500 text-white' : 'bg-white/8 text-white/60 hover:bg-white/12'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-red-400 text-xs font-medium">⚠️ Make sure your camera/mic are ready before going live</p>
          </div>

          <button
            onClick={handleStart}
            disabled={starting}
            className="w-full bg-gradient-to-r from-red-600 to-red-500 text-white rounded-xl py-3.5 font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition"
          >
            {starting ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <><FiRadio size={16} /> Go Live Now</>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Live Stream Viewer ─────────────────────────────────────────────────────────
export default function LiveStreamViewer({ stream, onClose, socket }) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [chatText, setChatText] = useState('');
  const [viewerCount, setViewerCount] = useState(stream?.viewer_count || 0);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [sending, setSending] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [hearts, setHearts] = useState([]);
  const sessionId = useRef(`sess_${Date.now()}_${Math.random()}`);
  const chatRef = useRef(null);
  const pollingRef = useRef(null);

  // Join stream on mount, leave on unmount
  useEffect(() => {
    if (!stream?.id) return;
    api.post(`/livestream/${stream.id}/join`, { session_id: sessionId.current })
      .then(({ data }) => setViewerCount(data.viewer_count || 0))
      .catch(() => {});

    // Load initial chat
    api.get(`/livestream/${stream.id}/chat`)
      .then(({ data }) => setMessages(data.messages || []))
      .catch(() => {});

    // Poll for new messages + viewer count every 3s
    pollingRef.current = setInterval(async () => {
      try {
        const [chatRes, streamRes] = await Promise.all([
          api.get(`/livestream/${stream.id}/chat`),
          api.get(`/livestream/${stream.id}`),
        ]);
        const newMsgs = chatRes.data.messages || [];
        setMessages(prev => {
          if (newMsgs.length !== prev.length) return newMsgs;
          return prev;
        });
        const s = streamRes.data.stream;
        if (s) {
          setViewerCount(s.viewer_count || 0);
          if (!s.is_live) {
            toast('Stream has ended', { icon: '📺' });
            onClose?.();
          }
        }
      } catch {}
    }, 3000);

    // Socket.IO live events
    if (socket) {
      socket.emit('live_join', { stream_id: stream.id });
      socket.on('live_viewer_count', ({ count }) => setViewerCount(count));
      socket.on('live_chat_message', msg => {
        setMessages(prev => [...prev.slice(-99), msg]);
      });
      socket.on('live_reaction', data => {
        if (data.type === 'heart') addHeart();
      });
    }

    return () => {
      api.post(`/livestream/${stream.id}/leave`, { session_id: sessionId.current }).catch(() => {});
      clearInterval(pollingRef.current);
      if (socket) {
        socket.off('live_viewer_count');
        socket.off('live_chat_message');
        socket.off('live_reaction');
        socket.emit('live_leave', { stream_id: stream.id });
      }
    };
  }, [stream?.id]); // eslint-disable-line

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  const addHeart = useCallback(() => {
    const id = Date.now() + Math.random();
    const x = 250 + Math.random() * 100;
    const y = 400 + Math.random() * 100;
    setHearts(prev => [...prev.slice(-10), { id, x, y }]);
  }, []);

  const handleLike = () => {
    setLiked(true);
    setLikeCount(n => n + 1);
    addHeart();
    if (socket) socket.emit('live_reaction', { stream_id: stream?.id, type: 'heart' });
  };

  const sendChat = async () => {
    if (!chatText.trim() || !user) return;
    setSending(true);
    try {
      const { data } = await api.post(`/livestream/${stream.id}/chat`, { content: chatText.trim() });
      setMessages(prev => [...prev.slice(-99), data.message]);
      if (socket) socket.emit('live_chat_send', { stream_id: stream.id, message: data.message });
      setChatText('');
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to send');
    }
    setSending(false);
  };

  if (!stream) return null;

  return (
    <div className={`fixed inset-0 z-[300] bg-black flex flex-col ${fullscreen ? '' : 'sm:flex-row'}`}>
      {/* Hearts */}
      {hearts.map(h => (
        <HeartBurst key={h.id} x={h.x} y={h.y} onDone={() => setHearts(prev => prev.filter(hh => hh.id !== h.id))} />
      ))}

      {/* Video area */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        {/* Simulated live stream placeholder (would be WebRTC in production) */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-900 flex flex-col items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-red-600 to-red-400 flex items-center justify-center mb-4 shadow-2xl"
          >
            <FiRadio size={40} className="text-white" />
          </motion.div>
          {stream.host_avatar ? (
            <img src={stream.host_avatar} alt="" className="w-20 h-20 rounded-full object-cover border-4 border-red-500 mb-3" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#25D366] to-teal-600 flex items-center justify-center text-white text-3xl font-bold border-4 border-red-500 mb-3">
              {stream.host_name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <p className="text-white font-bold text-xl">{stream.host_name}</p>
          <p className="text-white/50 text-sm mt-1">{stream.title}</p>
          <p className="text-white/30 text-xs mt-1 capitalize">{stream.category}</p>
          <div className="mt-6 flex items-center gap-2 bg-red-500 px-4 py-2 rounded-full">
            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="w-2 h-2 rounded-full bg-white" />
            <span className="text-white font-bold text-sm">LIVE</span>
          </div>
        </div>

        {/* Top bar */}
        <div className="absolute top-0 inset-x-0 p-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-red-500 px-3 py-1.5 rounded-full">
              <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="w-2 h-2 rounded-full bg-white" />
              <span className="text-white font-bold text-xs">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-3 py-1.5 rounded-full border border-white/10">
              <FiUsers size={12} className="text-white/70" />
              <span className="text-white font-bold text-xs">{fmtNum(viewerCount)}</span>
            </div>
            {likeCount > 0 && (
              <div className="flex items-center gap-1 bg-red-500/20 border border-red-500/40 px-2.5 py-1.5 rounded-full">
                <FiHeart size={11} className="text-red-400 fill-red-400" />
                <span className="text-red-300 text-xs font-bold">{fmtNum(likeCount)}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setFullscreen(f => !f)}
              className="p-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/10 text-white/70 hover:text-white transition">
              {fullscreen ? <FiMinimize2 size={16} /> : <FiMaximize2 size={16} />}
            </button>
            <button onClick={onClose}
              className="p-2 bg-black/50 backdrop-blur-sm rounded-full border border-white/10 text-white/70 hover:text-white transition">
              <FiX size={18} />
            </button>
          </div>
        </div>

        {/* Action buttons (right side) */}
        <div className="absolute right-4 bottom-24 flex flex-col gap-3">
          <button onClick={handleLike}
            className={`w-11 h-11 rounded-full flex items-center justify-center shadow-lg transition active:scale-90 ${liked ? 'bg-red-500' : 'bg-black/50 backdrop-blur-sm border border-white/10'}`}>
            <FiHeart size={20} className={liked ? 'text-white fill-white' : 'text-white/70'} />
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(window.location.origin + '/trends'); toast.success('Link copied!'); }}
            className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition">
            <FiShare2 size={18} />
          </button>
          <button onClick={addHeart}
            className="w-11 h-11 rounded-full bg-black/50 backdrop-blur-sm border border-white/10 flex items-center justify-center text-yellow-400 hover:text-yellow-300 transition">
            <FiGift size={18} />
          </button>
        </div>
      </div>

      {/* Chat panel */}
      <div className={`flex flex-col bg-[#0a0a0a] border-l border-white/6 ${fullscreen ? 'hidden' : 'h-64 sm:h-auto sm:w-[320px]'}`}>
        {/* Chat header */}
        <div className="px-4 py-3 border-b border-white/6 flex items-center gap-2">
          <MdOutlineLocalFireDepartment size={16} className="text-[#25D366]" />
          <span className="text-sm font-bold">Live Chat</span>
          <span className="ml-auto text-xs text-white/30">{messages.length} messages</span>
        </div>

        {/* Messages */}
        <div ref={chatRef} className="flex-1 overflow-y-auto py-2 space-y-0.5">
          <AnimatePresence initial={false}>
            {messages.map(msg => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
          </AnimatePresence>
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-8 text-center px-4">
              <FiRadio size={28} className="text-white/15 mb-2" />
              <p className="text-white/25 text-sm">No messages yet</p>
              <p className="text-white/15 text-xs mt-1">Be the first to say hi! 👋</p>
            </div>
          )}
        </div>

        {/* Chat input */}
        <div className="p-3 border-t border-white/6">
          {user ? (
            <div className="flex items-center gap-2">
              <input
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
                placeholder="Say something…"
                maxLength={500}
                className="flex-1 bg-white/6 border border-white/10 focus:border-[#25D366]/40 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none transition"
              />
              <button onClick={sendChat} disabled={sending || !chatText.trim()}
                className="w-9 h-9 bg-[#25D366] disabled:opacity-30 rounded-full flex items-center justify-center hover:bg-[#1fbd5a] transition flex-shrink-0">
                <FiSend size={14} className="text-white" />
              </button>
            </div>
          ) : (
            <p className="text-center text-white/30 text-xs py-2">Log in to chat</p>
          )}
        </div>
      </div>
    </div>
  );
}
