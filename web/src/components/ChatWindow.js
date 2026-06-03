import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { encryptForUser, decryptFromUser } from '../services/e2ee';
import { useAuthStore, useChatStore } from '../services/store';
import api from '../services/api';
import {
  FiSend, FiSmile, FiPaperclip, FiMoreVertical, FiPhone, FiVideo,
  FiArrowLeft, FiSearch, FiX, FiMic, FiImage, FiFile, FiMapPin,
  FiUser, FiStar, FiShare2, FiEdit2, FiTrash2, FiCopy,
  FiCornerUpLeft, FiCheck, FiChevronDown, FiInfo,
  FiCamera, FiDownload, FiRefreshCw, FiMessageSquare, FiLock, FiLink, FiMusic,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';
import toast from 'react-hot-toast';
import EmojiPicker from './EmojiPicker';
import VoiceRecorder from './VoiceRecorder';
import LocationShare from './LocationShare';
import ForwardModal from './ForwardModal';
import AttachmentPreviewModal from './AttachmentPreviewModal';
import { VerifiedBadgeInline } from './VerifiedBadge';

const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^[\]`]+)/gi;
const LINK_PREVIEW_CACHE = new Map();

// ── Read-receipt tick component ───────────────────────────────────────────────
function Ticks({ status }) {
  if (status === 'read') {
    return (
      <span className="inline-flex ml-1">
        <FiCheck size={11} className="text-blue-400 -mr-1.5" strokeWidth={3} />
        <FiCheck size={11} className="text-blue-400" strokeWidth={3} />
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="inline-flex ml-1">
        <FiCheck size={11} className="text-white/60 -mr-1.5" strokeWidth={3} />
        <FiCheck size={11} className="text-white/60" strokeWidth={3} />
      </span>
    );
  }
  return <FiCheck size={11} className="ml-1 text-white/60" strokeWidth={3} />;
}

// ── Date separator ────────────────────────────────────────────────────────────
function DateSeparator({ date }) {
  const d = new Date(date);
  let label = format(d, 'MMMM d, yyyy');
  if (isToday(d)) label = 'Today';
  else if (isYesterday(d)) label = 'Yesterday';
  return (
    <div className="flex items-center justify-center my-3">
      <span className="bg-[#e1f3fb] text-gray-600 text-[11px] font-medium px-3 py-1 rounded-full shadow-sm">
        {label}
      </span>
    </div>
  );
}

// ── Voice note player ─────────────────────────────────────────────────────────
function VoiceNote({ src, isOwn }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play(); setPlaying(true); }
  };

  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => setProgress((audioRef.current?.currentTime / audioRef.current?.duration) * 100 || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />
      <button onClick={toggle} className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${isOwn ? 'bg-white/20' : 'bg-[#25D366]'}`}>
        {playing
          ? <span className={`w-3 h-3 border-2 ${isOwn ? 'border-white' : 'border-white'} rounded-sm`} />
          : <FiMic size={14} className="text-white ml-0.5" />
        }
      </button>
      <div className="flex-1">
        <div className={`h-1 rounded-full ${isOwn ? 'bg-white/30' : 'bg-gray-200'}`}>
          <div className={`h-full rounded-full ${isOwn ? 'bg-white' : 'bg-[#25D366]'}`} style={{ width: `${progress}%` }} />
        </div>
        <span className={`text-[10px] mt-0.5 block ${isOwn ? 'text-white/70' : 'text-gray-500'}`}>
          {fmtTime(playing ? (audioRef.current?.currentTime || 0) : duration)}
        </span>
      </div>
    </div>
  );
}

// ── Render text with clickable links ──────────────────────────────────────────
function renderTextWithLinks(text) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="underline text-blue-600 break-all" onClick={e => e.stopPropagation()}>
          {part}
        </a>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

// ── Link preview card ─────────────────────────────────────────────────────────
function LinkPreviewCard({ url, isOwn }) {
  const [data, setData] = useState(() => LINK_PREVIEW_CACHE.get(url) || null);
  const [status, setStatus] = useState(LINK_PREVIEW_CACHE.has(url) ? 'done' : 'loading');

  useEffect(() => {
    if (LINK_PREVIEW_CACHE.has(url)) return;
    let cancelled = false;
    api.get(`/messages/link-preview?url=${encodeURIComponent(url)}`)
      .then(res => {
        if (cancelled) return;
        LINK_PREVIEW_CACHE.set(url, res.data);
        setData(res.data);
        setStatus('done');
      })
      .catch(() => {
        if (cancelled) return;
        LINK_PREVIEW_CACHE.set(url, null);
        setStatus('done');
      });
    return () => { cancelled = true; };
  }, [url]);

  if (status === 'loading') {
    return (
      <div className={`mt-1 rounded-xl overflow-hidden border ${isOwn ? 'border-[#b7e8a0]' : 'border-gray-100'} animate-pulse`}>
        <div className={`h-28 ${isOwn ? 'bg-[#b7e8a0]' : 'bg-gray-100'}`}/>
        <div className={`p-2 ${isOwn ? 'bg-[#cdf0b2]' : 'bg-gray-50'}`}>
          <div className={`h-3 rounded w-1/3 mb-1 ${isOwn ? 'bg-[#a5e095]' : 'bg-gray-200'}`}/>
          <div className={`h-3 rounded w-2/3 ${isOwn ? 'bg-[#a5e095]' : 'bg-gray-200'}`}/>
        </div>
      </div>
    );
  }
  if (!data?.title) return null;

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`mt-1 block rounded-xl overflow-hidden border transition-opacity hover:opacity-90 ${isOwn ? 'border-[#b7e8a0]' : 'border-gray-100'}`}
      onClick={e => e.stopPropagation()}>
      {data.image && (
        <div className="h-28 overflow-hidden bg-gray-100">
          <img src={data.image} alt="" className="w-full h-full object-cover"
            onError={e => { e.target.style.display = 'none'; }} />
        </div>
      )}
      <div className={`p-2 ${isOwn ? 'bg-[#cdf0b2]' : 'bg-gray-50'}`}>
        <p className="text-[10px] text-[#25D366] font-semibold uppercase tracking-wide truncate">{data.site_name || data.domain}</p>
        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">{data.title}</p>
        {data.description && (
          <p className="text-[10px] text-gray-500 mt-0.5 line-clamp-2 leading-snug">{data.description}</p>
        )}
      </div>
    </a>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────
const MessageBubble = memo(function MessageBubble({
  message, isOwn, onReply, onEdit, onDelete, onForward, onStar, onReact,
  onImageClick, contactName,
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const menuRef = useRef(null);
  const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    if (showMenu) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const isDeleted = message.is_deleted_everyone;
  const isForwarded = !!message.forwarded_from_id;
  const isEdited = message.is_edited;

  return (
    <div className={`flex mb-1 group ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {/* Hover reaction + menu bar */}
      <div className={`flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity self-end mb-1 ${isOwn ? 'mr-1 flex-row-reverse' : 'ml-1'}`}>
        <button
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          onClick={() => setShowReactions(v => !v)}
          title="React"
        >
          <FiSmile size={14} className="text-gray-500" />
        </button>
        <button
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          onClick={() => onReply(message)}
          title="Reply"
        >
          <FiCornerUpLeft size={14} className="text-gray-500" />
        </button>
        <button
          className="p-1 bg-white rounded-full shadow hover:bg-gray-100"
          onClick={() => setShowMenu(v => !v)}
          title="More"
        >
          <FiChevronDown size={14} className="text-gray-500" />
        </button>
      </div>

      {/* Bubble */}
      <div className="relative max-w-[68%] sm:max-w-[55%]" ref={menuRef}>
        {/* Reaction picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className={`absolute bottom-full mb-1 flex gap-1 bg-white rounded-full shadow-xl px-2 py-1 z-20 ${isOwn ? 'right-0' : 'left-0'}`}
            >
              {REACTIONS.map(r => (
                <button key={r} className="text-xl hover:scale-125 transition-transform"
                  onClick={() => { onReact(message.id, r); setShowReactions(false); }}>
                  {r}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Context menu */}
        <AnimatePresence>
          {showMenu && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`absolute bottom-full mb-1 bg-white rounded-xl shadow-2xl z-30 min-w-[170px] overflow-hidden border border-gray-100 ${isOwn ? 'right-0' : 'left-0'}`}
            >
              {[
                { icon: FiCornerUpLeft, label: 'Reply', action: () => { onReply(message); setShowMenu(false); } },
                { icon: FiShare2, label: 'Forward', action: () => { onForward(message); setShowMenu(false); } },
                { icon: FiStar, label: 'Star', action: () => { onStar(message.id); setShowMenu(false); } },
                { icon: FiCopy, label: 'Copy', action: () => { navigator.clipboard.writeText(message.content || ''); toast.success('Copied'); setShowMenu(false); } },
                ...(isOwn ? [
                  { icon: FiEdit2, label: 'Edit', action: () => { onEdit(message); setShowMenu(false); } },
                  { icon: FiTrash2, label: 'Delete', action: () => { onDelete(message.id, 'everyone'); setShowMenu(false); }, danger: true },
                ] : [
                  { icon: FiTrash2, label: 'Delete for me', action: () => { onDelete(message.id, 'me'); setShowMenu(false); }, danger: true },
                ]),
              ].map(item => (
                <button key={item.label}
                  onClick={item.action}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 ${item.danger ? 'text-red-500' : 'text-gray-700'}`}
                >
                  <item.icon size={15} />
                  {item.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main bubble */}
        <div
          className={`rounded-2xl px-3 pt-2 pb-1.5 shadow-sm cursor-default relative ${
            isOwn
              ? 'bg-[#DCF8C6] text-gray-900 rounded-tr-none'
              : 'bg-white text-gray-900 rounded-tl-none'
          } ${isDeleted ? 'italic opacity-60' : ''}`}
        >
          {/* Sender name (group chats) */}
          {!isOwn && contactName && (
            <p className="text-xs font-semibold text-[#25D366] mb-0.5">{contactName}</p>
          )}

          {/* Forwarded indicator */}
          {isForwarded && !isDeleted && (
            <div className="flex items-center gap-1 text-[11px] text-gray-500 mb-1">
              <FiShare2 size={10} /> <span>Forwarded</span>
            </div>
          )}

          {/* Reply preview */}
          {message.replied_to && !isDeleted && (
            <div className={`border-l-4 ${isOwn ? 'border-[#25D366] bg-[#cdf0b2]' : 'border-[#25D366] bg-gray-100'} rounded-r-lg pl-2 pr-2 py-1 mb-2`}>
              <p className="text-[11px] font-semibold text-[#128C7E] truncate">
                {message.replied_to.sender_id === message.sender_id ? 'You' : (message.replied_to.sender_name || 'User')}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {message.replied_to.media_type ? `[${message.replied_to.media_type}]` : message.replied_to.content}
              </p>
            </div>
          )}

          {/* Media: image */}
          {message.media_type === 'image' && message.media_url && !isDeleted && (
            <div className="rounded-xl overflow-hidden mb-1 -mx-0.5 cursor-zoom-in" onClick={() => onImageClick(message.media_url)}>
              <img src={message.media_url} alt="media" className="max-w-full max-h-64 object-cover" />
            </div>
          )}

          {/* Media: video */}
          {message.media_type === 'video' && message.media_url && !isDeleted && (
            <video controls className="rounded-xl max-w-full max-h-56 mb-1 -mx-0.5">
              <source src={message.media_url} />
            </video>
          )}

          {/* Media: document */}
          {message.media_type === 'document' && message.media_url && !isDeleted && (
            <a href={message.media_url} target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isOwn ? 'bg-[#b7e8a0]' : 'bg-gray-100'}`}>
              <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center flex-shrink-0">
                <FiFile size={18} className="text-orange-500" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 block truncate">
                  {message.media_url.split('/').pop().split('?')[0] || 'Document'}
                </span>
                <span className="text-[10px] text-gray-500">Tap to open</span>
              </div>
              <FiDownload size={14} className="text-gray-500 flex-shrink-0" />
            </a>
          )}

          {/* Media: audio */}
          {message.media_type === 'audio' && message.media_url && !isDeleted && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 min-w-[200px] ${isOwn ? 'bg-[#b7e8a0]' : 'bg-gray-100'}`}>
              <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <FiMusic size={16} className="text-[#25D366]" />
              </div>
              <audio controls className="flex-1 h-8 min-w-0" style={{ maxWidth: '180px' }}>
                <source src={message.media_url} />
              </audio>
            </div>
          )}

          {/* Media: voice */}
          {message.media_type === 'voice' && message.media_url && !isDeleted && (
            <div className="mb-1">
              <VoiceNote src={message.media_url} isOwn={isOwn} />
            </div>
          )}

          {/* Media: location */}
          {message.media_type === 'location' && !isDeleted && (
            <a
              href={`https://maps.google.com/?q=${message.latitude},${message.longitude}`}
              target="_blank" rel="noopener noreferrer"
              className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isOwn ? 'bg-[#b7e8a0]' : 'bg-gray-100'}`}
            >
              <FiMapPin size={18} className="text-red-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-800">{message.location_name || 'Location'}</p>
                <p className="text-xs text-gray-500">Tap to open map</p>
              </div>
            </a>
          )}

          {/* Media: contact card */}
          {message.media_type === 'contact' && message.contact && !isDeleted && (
            <div className={`flex items-center gap-2 rounded-lg px-3 py-2 mb-1 ${isOwn ? 'bg-[#b7e8a0]' : 'bg-gray-100'}`}>
              <div className="w-9 h-9 bg-gray-300 rounded-full flex items-center justify-center">
                <FiUser size={18} className="text-gray-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">{message.contact.name}</p>
                <p className="text-xs text-gray-500">{message.contact.phone}</p>
              </div>
            </div>
          )}

          {/* Text content with link highlighting */}
          {!isDeleted && message.content && (() => {
            URL_REGEX.lastIndex = 0;
            const urls = message.content.match(URL_REGEX);
            const firstUrl = urls?.[0];
            return (
              <>
                {firstUrl && <LinkPreviewCard url={firstUrl} isOwn={isOwn} />}
                <p className="text-sm leading-relaxed break-words whitespace-pre-wrap mt-0.5">
                  {renderTextWithLinks(message.content)}
                </p>
              </>
            );
          })()}
          {isDeleted && (
            <p className="text-sm text-gray-400 italic flex items-center gap-1">
              <FiTrash2 size={12} /> This message was deleted
            </p>
          )}

          {/* Timestamp + status row */}
          <div className="flex items-center justify-end gap-1 mt-0.5">
            {isEdited && !isDeleted && <span className="text-[10px] text-gray-400">edited</span>}
            <span className="text-[10px] text-gray-400">{format(new Date(message.created_at), 'HH:mm')}</span>
            {isOwn && !isDeleted && <Ticks status={message.status} />}
          </div>

          {/* Reactions display */}
          {message.reactions && message.reactions.length > 0 && (
            <div className={`absolute -bottom-3 ${isOwn ? 'right-2' : 'left-2'} flex gap-0.5 bg-white rounded-full shadow px-1.5 py-0.5 border border-gray-100`}>
              {[...new Map(message.reactions.map(r => [r.emoji, r])).values()].map(r => (
                <span key={r.emoji} className="text-sm leading-none">{r.emoji}</span>
              ))}
              <span className="text-[10px] text-gray-500 ml-0.5 self-center">{message.reactions.length}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ── Attachment menu ───────────────────────────────────────────────────────────
function AttachMenu({ onAttach, onLocation, onContactSend, onClose }) {
  const fileRef = useRef(null);
  const imgRef = useRef(null);
  const audioRef = useRef(null);
  const camRef = useRef(null);

  const items = [
    { icon: FiImage, label: 'Photo / Video', color: 'bg-purple-500', action: () => imgRef.current?.click() },
    { icon: FiFile, label: 'Document', color: 'bg-blue-500', action: () => fileRef.current?.click() },
    { icon: FiMusic, label: 'Audio', color: 'bg-yellow-500', action: () => audioRef.current?.click() },
    { icon: FiCamera, label: 'Camera', color: 'bg-orange-500', action: () => camRef.current?.click() },
    { icon: FiMapPin, label: 'Location', color: 'bg-red-500', action: () => { onLocation(); onClose(); } },
    { icon: FiUser, label: 'Contact', color: 'bg-green-600', action: () => { onContactSend(); onClose(); } },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="absolute bottom-full left-0 mb-2 bg-white rounded-2xl shadow-2xl p-3 border border-gray-100 z-20 min-w-[210px]"
    >
      <input ref={imgRef} type="file" accept="image/*,video/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onAttach(f, f.type.startsWith('video/') ? 'video' : 'image'); onClose(); } }} />
      <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.ppt,.pptx,.csv" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onAttach(f, 'document'); onClose(); } }} />
      <input ref={audioRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onAttach(f, 'audio'); onClose(); } }} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) { onAttach(f, 'image'); onClose(); } }} />
      {items.map(item => (
        <button key={item.label} onClick={item.action}
          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 rounded-xl text-sm text-gray-700 font-medium">
          <div className={`w-9 h-9 ${item.color} rounded-xl flex items-center justify-center`}>
            <item.icon size={18} className="text-white" />
          </div>
          {item.label}
        </button>
      ))}
    </motion.div>
  );
}

// ── Wallpaper picker ──────────────────────────────────────────────────────────
const WALLPAPERS = [
  { id: 'default', label: 'Default', value: null, preview: '#e5ddd5' },
  { id: 'white', label: 'White', value: '#ffffff', preview: '#ffffff' },
  { id: 'dark', label: 'Dark', value: '#0d1117', preview: '#0d1117' },
  { id: 'green', label: 'Forest', value: '#1a3a2a', preview: '#1a3a2a' },
  { id: 'ocean', label: 'Ocean', value: 'linear-gradient(135deg,#1a1a2e,#16213e,#0f3460)', preview: '#0f3460' },
  { id: 'sunset', label: 'Sunset', value: 'linear-gradient(135deg,#f093fb,#f5576c)', preview: '#f5576c' },
  { id: 'pattern', label: 'Pattern', value: null, isPattern: true, preview: '#e5ddd5' },
];

// ── Main ChatWindow ───────────────────────────────────────────────────────────
function ChatWindow({ socket, onStartCall, onContactInfoClick, onBack }) {
  const { user } = useAuthStore();
  const { messages, activeChat, setMessages, addMessage, updateMessage, typing } = useChatStore();

  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
  const [contact, setContact] = useState(null);
  const [contactUser, setContactUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [imageViewer, setImageViewer] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem('chat_wallpaper') || null);
  const [showLocationShare, setShowLocationShare] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingAttachment, setPendingAttachment] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevActiveChatRef = useRef(null);

  // ── Load chat on activeChat change ──────────────────────────────────────
  useEffect(() => {
    if (!activeChat || activeChat === prevActiveChatRef.current) return;
    prevActiveChatRef.current = activeChat;
    setPage(1);
    setMessages([]);
    setReplyTo(null);
    setEditingMessage(null);
    loadChatHistory(1, true);
    loadContactInfo();
    // Mark all messages as read
    api.put(`/messages/chat/${activeChat}/read-all`).catch(() => {});
  }, [activeChat]);

  // ── Socket: receive new messages ────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewMsg = (data) => {
      if (data.sender_id === activeChat || data.receiver_id === activeChat) {
        // Fetch the full message from API
        api.get(`/messages/chat/${activeChat}?page=1&per_page=1`).catch(() => {});
        // Optimistic: use data if it has full fields
        if (data.id) {
          addMessage(data);
        } else {
          loadChatHistory(1, true);
        }
        // Mark as read
        if (data.sender_id === activeChat) {
          api.put(`/messages/chat/${activeChat}/read-all`).catch(() => {});
          if (socket) {
            socket.emit('message_read', { message_id: data.message_id, sender_id: activeChat });
          }
        }
        scrollToBottom();
      }
    };

    const handleMsgDeleted = (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id
          ? { ...m, is_deleted_everyone: true, content: 'This message was deleted' }
          : m
      ));
    };

    const handleMsgEdited = (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id
          ? { ...m, content: data.new_content, is_edited: true }
          : m
      ));
    };

    const handleReadConfirmation = (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id ? { ...m, status: 'read' } : m
      ));
    };

    const handleDeliveryConfirmation = (data) => {
      setMessages(prev => prev.map(m =>
        m.id === data.message_id && m.status === 'sent' ? { ...m, status: 'delivered' } : m
      ));
    };

    socket.on('new_message', handleNewMsg);
    socket.on('message_deleted_notification', handleMsgDeleted);
    socket.on('message_edited_notification', handleMsgEdited);
    socket.on('read_confirmation', handleReadConfirmation);
    socket.on('delivery_confirmation', handleDeliveryConfirmation);

    return () => {
      socket.off('new_message', handleNewMsg);
      socket.off('message_deleted_notification', handleMsgDeleted);
      socket.off('message_edited_notification', handleMsgEdited);
      socket.off('read_confirmation', handleReadConfirmation);
      socket.off('delivery_confirmation', handleDeliveryConfirmation);
    };
  }, [socket, activeChat]);

  // ── Scroll to bottom on new messages ────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadChatHistory = async (pg = 1, reset = false) => {
    if (!activeChat) return;
    try {
      if (pg === 1) setLoading(true);
      const { data } = await api.get(`/messages/chat/${activeChat}?page=${pg}&per_page=50`);
      const msgs = data.messages || [];
      if (reset || pg === 1) setMessages(msgs);
      else setMessages(prev => [...msgs, ...prev]);
      setHasMore(data.has_prev);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadContactInfo = async () => {
    if (!activeChat) return;
    try {
      const { data } = await api.get(`/contacts/${activeChat}`);
      setContact(data);
      if (data.contact_info) setContactUser(data.contact_info);
    } catch {
      // Not in contacts — try fetching user directly
      try {
        const { data } = await api.get(`/auth/user/${activeChat}`).catch(() => ({ data: null }));
        if (data) setContactUser(data);
      } catch {}
    }
  };

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (e) => {
    e?.preventDefault();
    const text = messageText.trim();

    if (editingMessage) {
      // Edit flow
      try {
        const { data } = await api.put(`/messages/${editingMessage.id}/edit`, { content: text });
        setMessages(prev => prev.map(m => m.id === editingMessage.id ? data : m));
        if (socket) {
          socket.emit('message_edited', {
            message_id: editingMessage.id,
            receiver_id: activeChat,
            new_content: text,
          });
        }
        setEditingMessage(null);
        setMessageText('');
        inputRef.current?.focus();
      } catch {
        toast.error('Failed to edit message');
      }
      return;
    }

    if (!text) return;

    try {
      const payload = {
        content: text,
        replied_to_id: replyTo?.id || null,
      };

      // Attempt Signal Protocol E2EE — gracefully degrade if keys unavailable
      try {
        const enc = await encryptForUser(activeChat, text, api);
        if (enc) {
          payload.encrypted_payload = enc.encrypted_payload;
          payload.e2ee_header      = enc.e2ee_header;
          payload.e2ee_type        = enc.e2ee_type;
          payload.content          = '[E2EE]'; // sentinel; cleared on decryption
        }
      } catch (encErr) {
        // Keys not yet exchanged — send plaintext as fallback
        console.warn('[E2EE] encrypt skipped:', encErr.message);
      }

      const { data } = await api.post(`/messages/${activeChat}`, payload);
      addMessage(data);
      if (socket) {
        socket.emit('message', {
          sender_id: user.id,
          receiver_id: activeChat,
          content: text,
          message_id: data.id,
          timestamp: data.created_at,
        });
      }
      setMessageText('');
      setReplyTo(null);
      setShowEmoji(false);
      scrollToBottom();
    } catch {
      toast.error('Failed to send message');
    }
  }, [messageText, editingMessage, replyTo, activeChat, socket, user]);

  // ── Typing indicator ─────────────────────────────────────────────────────
  const handleTyping = () => {
    if (!socket) return;
    socket.emit('typing', { user_id: user.id, receiver_id: activeChat });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stop_typing', { user_id: user.id, receiver_id: activeChat });
    }, 1500);
  };

  // ── File upload ──────────────────────────────────────────────────────────
  const handleAttach = (file, type) => {
    if (!file) return;
    setPendingAttachment({ file, type });
  };

  const handleSendAttachment = async (caption) => {
    if (!pendingAttachment) return;
    const { file, type } = pendingAttachment;
    setUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const endpointMap = { image: '/upload/image', video: '/upload/video', audio: '/upload/audio', document: '/upload/document' };
      const endpoint = endpointMap[type] || '/upload/document';
      const { data: uploadData } = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const mediaType = file.type.startsWith('video/') ? 'video' : type;
      const { data: msgData } = await api.post(`/messages/${activeChat}`, {
        media_url: uploadData.url,
        media_type: mediaType,
        content: caption || null,
        replied_to_id: replyTo?.id || null,
      });
      addMessage(msgData);
      setPendingAttachment(null);
      if (socket) {
        socket.emit('message', {
          sender_id: user.id, receiver_id: activeChat,
          content: caption || `[${mediaType}]`, message_id: msgData.id,
          timestamp: msgData.created_at,
        });
      }
      setReplyTo(null);
      scrollToBottom();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploadingFile(false);
    }
  };

  // ── Reactions ────────────────────────────────────────────────────────────
  const handleReact = async (messageId, emoji) => {
    try {
      const { data } = await api.post(`/messages/${messageId}/react`, { emoji });
      setMessages(prev => prev.map(m => m.id === messageId ? data : m));
      if (socket) {
        socket.emit('reaction', { message_id: messageId, user_id: user.id, emoji, receiver_id: activeChat });
      }
    } catch { toast.error('Failed to react'); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (messageId, forWho) => {
    try {
      await api.delete(`/messages/${messageId}/delete?for=${forWho}`);
      if (forWho === 'everyone') {
        setMessages(prev => prev.map(m =>
          m.id === messageId ? { ...m, is_deleted_everyone: true, content: 'This message was deleted' } : m
        ));
        if (socket) socket.emit('message_deleted', { message_id: messageId, receiver_id: activeChat });
      } else {
        setMessages(prev => prev.filter(m => m.id !== messageId));
      }
    } catch { toast.error('Failed to delete'); }
  };

  // ── Star ─────────────────────────────────────────────────────────────────
  const handleStar = async (messageId) => {
    try {
      await api.post(`/messages/${messageId}/star`);
      toast.success('Message starred');
    } catch { toast.error('Failed to star'); }
  };

  // ── Search in chat ───────────────────────────────────────────────────────
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const { data } = await api.get(`/messages/search?q=${encodeURIComponent(q)}&chat_with=${activeChat}`);
      setSearchResults(data.messages || []);
    } catch {}
  };

  // ── Load more (pagination) ───────────────────────────────────────────────
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el || !hasMore || loading) return;
    if (el.scrollTop < 100) {
      const nextPage = page + 1;
      setPage(nextPage);
      loadChatHistory(nextPage, false);
    }
  };

  // ── Wallpaper ────────────────────────────────────────────────────────────
  const applyWallpaper = (w) => {
    const val = w.isPattern ? null : (w.value || null);
    setWallpaper(val);
    localStorage.setItem('chat_wallpaper', val || '');
    setShowWallpaper(false);
  };

  const chatName = contact?.contact_name || contactUser?.full_name || 'Unknown';
  const chatAvatar = contactUser?.avatar_url;
  const isOnline = contactUser?.status === 'available';
  const isTyping = typing[activeChat];

  // ── Group messages by date ───────────────────────────────────────────────
  const groupedMessages = [];
  let lastDate = null;
  for (const msg of messages) {
    const d = new Date(msg.created_at);
    if (!lastDate || !isSameDay(d, new Date(lastDate))) {
      groupedMessages.push({ type: 'date', date: msg.created_at, id: `date-${msg.created_at}` });
      lastDate = msg.created_at;
    }
    groupedMessages.push({ type: 'message', message: msg, id: msg.id });
  }

  const bgStyle = wallpaper
    ? (wallpaper.startsWith('linear-gradient') ? { background: wallpaper } : { backgroundColor: wallpaper })
    : { backgroundColor: '#e5ddd5' };

  if (!activeChat) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiMessageSquare size={40} className="text-gray-400" />
          </div>
          <h2 className="text-xl font-light text-gray-500 mb-2">VipChat Web</h2>
          <p className="text-gray-400 text-sm max-w-xs">Select a chat to start messaging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#f0f2f5] border-b border-gray-200 px-3 py-2 flex items-center gap-3 flex-shrink-0">
        {/* Back button (mobile) */}
        <button onClick={onBack} className="md:hidden p-1.5 hover:bg-gray-200 rounded-full">
          <FiArrowLeft size={20} className="text-gray-600" />
        </button>

        {/* Avatar */}
        <button onClick={onContactInfoClick} className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm">
            {chatAvatar
              ? <img src={chatAvatar} alt="" className="w-full h-full object-cover" />
              : (chatName?.[0]?.toUpperCase() || '?')}
          </div>
        </button>

        {/* Name + status */}
        <button className="flex-1 text-left min-w-0" onClick={onContactInfoClick}>
          <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate flex items-center gap-1">
            {chatName}
            <VerifiedBadgeInline user={contactUser} size={13} />
          </h3>
          <p className="text-xs text-gray-500 leading-tight">
            {isTyping ? <span className="text-[#25D366] font-medium">typing...</span>
              : isOnline ? 'online'
              : contactUser?.last_seen
                ? `last seen ${format(new Date(contactUser.last_seen), 'HH:mm')}`
                : 'offline'}
          </p>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => onStartCall?.({ id: activeChat, full_name: chatName, avatar_url: chatAvatar }, 'video')}
            className="p-2 hover:bg-gray-200 rounded-full transition" title="Video call">
            <FiVideo size={20} className="text-gray-600" />
          </button>
          <button onClick={() => onStartCall?.({ id: activeChat, full_name: chatName, avatar_url: chatAvatar }, 'audio')}
            className="p-2 hover:bg-gray-200 rounded-full transition" title="Voice call">
            <FiPhone size={20} className="text-gray-600" />
          </button>
          <button onClick={() => setShowSearch(v => !v)}
            className="p-2 hover:bg-gray-200 rounded-full transition" title="Search">
            <FiSearch size={20} className="text-gray-600" />
          </button>
          <div className="relative">
            <button onClick={() => setShowWallpaper(v => !v)}
              className="p-2 hover:bg-gray-200 rounded-full transition" title="More options">
              <FiMoreVertical size={20} className="text-gray-600" />
            </button>
            <AnimatePresence>
              {showWallpaper && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="absolute top-10 right-0 bg-white rounded-xl shadow-2xl w-56 z-50 border border-gray-100 overflow-hidden"
                >
                  <div className="px-4 py-2 border-b text-xs font-semibold text-gray-500 uppercase tracking-wide">Chat Background</div>
                  <div className="p-2 grid grid-cols-3 gap-2">
                    {WALLPAPERS.map(w => (
                      <button key={w.id} onClick={() => applyWallpaper(w)}
                        className="flex flex-col items-center gap-1 p-1 rounded-lg hover:bg-gray-50">
                        <div className="w-12 h-12 rounded-lg border border-gray-200" style={{ backgroundColor: w.preview }} />
                        <span className="text-[10px] text-gray-600">{w.label}</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={onContactInfoClick}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 border-t">
                    <FiInfo size={15} /> Contact info
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-b px-4 py-2 overflow-hidden"
          >
            <div className="flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1.5">
              <FiSearch size={16} className="text-gray-400" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={e => handleSearch(e.target.value)}
                placeholder="Search in conversation..."
                className="flex-1 bg-transparent text-sm outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setSearchResults([]); }}>
                  <FiX size={16} className="text-gray-400" />
                </button>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto">
                {searchResults.map(m => (
                  <div key={m.id} className="px-2 py-1.5 hover:bg-gray-50 rounded-lg cursor-pointer text-sm text-gray-700 truncate">
                    <span className="text-[10px] text-gray-400 block">{format(new Date(m.created_at), 'MMM d, HH:mm')}</span>
                    {m.content}
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Messages area ───────────────────────────────────────────────── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-2"
        style={bgStyle}
      >
        {/* Whatsapp-style background pattern overlay */}
        {!wallpaper && (
          <div className="absolute inset-0 pointer-events-none opacity-5"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M30 5C16.2 5 5 16.2 5 30s11.2 25 25 25 25-11.2 25-25S43.8 5 30 5zm0 45C18.4 50 10 41.6 10 30S18.4 10 30 10s20 8.4 20 20-8.4 20-20 20zm0-36c-8.8 0-16 7.2-16 16s7.2 16 16 16 16-7.2 16-16-7.2-16-16-16z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}
          />
        )}

        {loading && page === 1 && (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {hasMore && !loading && (
          <div className="flex justify-center py-2">
            <button onClick={() => { const next = page + 1; setPage(next); loadChatHistory(next, false); }}
              className="text-xs text-gray-500 bg-white/80 px-3 py-1 rounded-full shadow flex items-center gap-1">
              <FiRefreshCw size={10} /> Load older messages
            </button>
          </div>
        )}

        {groupedMessages.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full">
            <div className="bg-white/80 backdrop-blur px-6 py-4 rounded-2xl text-center shadow-sm">
              <FiLock size={20} className="mx-auto mb-2 text-gray-400" style={{}} />
              <p className="text-xs text-gray-500 max-w-[220px]">
                Messages are end-to-end secured. Tap to start a conversation!
              </p>
            </div>
          </div>
        )}

        {groupedMessages.map(item => {
          if (item.type === 'date') return <DateSeparator key={item.id} date={item.date} />;
          const msg = item.message;
          const isOwn = msg.sender_id === user.id;
          return (
            <MessageBubble
              key={item.id}
              message={msg}
              isOwn={isOwn}
              contactName={!isOwn ? chatName : null}
              onReply={setReplyTo}
              onEdit={m => { setEditingMessage(m); setMessageText(m.content || ''); inputRef.current?.focus(); }}
              onDelete={handleDelete}
              onForward={setForwardMessage}
              onStar={handleStar}
              onReact={handleReact}
              onImageClick={setImageViewer}
            />
          );
        })}
        <div ref={messagesEndRef} className="h-2" />
      </div>

      {/* ── Reply / Edit preview bar ─────────────────────────────────────── */}
      <AnimatePresence>
        {(replyTo || editingMessage) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#f0f2f5] border-t border-gray-200 px-4 py-2 flex items-center gap-3"
          >
            <div className={`flex-1 border-l-4 pl-3 py-1 rounded-r ${editingMessage ? 'border-orange-400' : 'border-[#25D366]'}`}>
              <p className="text-xs font-semibold text-[#128C7E]">
                {editingMessage ? 'Editing message' : `Reply to ${replyTo?.sender_id === user.id ? 'Yourself' : chatName}`}
              </p>
              <p className="text-xs text-gray-600 truncate">
                {editingMessage ? editingMessage.content : (replyTo?.media_type ? `[${replyTo.media_type}]` : replyTo?.content)}
              </p>
            </div>
            <button onClick={() => { setReplyTo(null); setEditingMessage(null); setMessageText(''); }}>
              <FiX size={18} className="text-gray-500 hover:text-gray-700" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Input bar ──────────────────────────────────────────────────────── */}
      <div className="bg-[#f0f2f5] px-2 py-2 flex items-end gap-2 flex-shrink-0">
        {/* Emoji */}
        <div className="relative">
          <button onClick={() => setShowEmoji(v => !v)}
            className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-full transition flex-shrink-0">
            <FiSmile size={22} />
          </button>
          <AnimatePresence>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 16 }}
                className="absolute bottom-14 left-0 z-30 shadow-2xl rounded-2xl overflow-hidden"
              >
                <EmojiPicker onEmojiSelect={emoji => { setMessageText(t => t + emoji); inputRef.current?.focus(); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Attachment */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowAttach(v => !v)}
            className="p-2.5 text-gray-500 hover:bg-gray-200 rounded-full transition">
            <FiPaperclip size={22} />
          </button>
          <AnimatePresence>
            {showAttach && (
              <AttachMenu
                onAttach={handleAttach}
                onLocation={() => setShowLocationShare(true)}
                onContactSend={() => toast('Contact sharing coming soon')}
                onClose={() => setShowAttach(false)}
              />
            )}
          </AnimatePresence>
        </div>

        {/* Text input */}
        <div className="flex-1 bg-white rounded-3xl px-4 py-2.5 min-h-[44px] max-h-32 overflow-y-auto shadow-sm">
          <textarea
            ref={inputRef}
            value={messageText}
            onChange={e => { setMessageText(e.target.value); handleTyping(); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder={editingMessage ? 'Edit message...' : 'Type a message'}
            className="w-full bg-transparent text-sm text-gray-800 outline-none resize-none leading-5"
            rows={1}
            style={{ height: 'auto' }}
            onInput={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
          />
        </div>

        {/* Send / Voice */}
        {messageText.trim() ? (
          <button onClick={sendMessage}
            className="w-11 h-11 bg-[#25D366] hover:bg-[#1fbd5a] text-white rounded-full flex items-center justify-center flex-shrink-0 shadow transition">
            <FiSend size={18} />
          </button>
        ) : (
          <VoiceRecorder
            receiverId={activeChat}
            onSent={msg => { addMessage(msg); scrollToBottom(); }}
            socket={socket}
          />
        )}
      </div>

      {/* ── Uploading indicator ──────────────────────────────────────────── */}
      {uploadingFile && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 text-white text-sm px-4 py-2 rounded-full z-40 flex items-center gap-2">
          <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Uploading...
        </div>
      )}

      {/* ── Location share overlay ──────────────────────────────────────── */}
      {showLocationShare && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full bg-white rounded-t-3xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Share Location</h3>
              <button onClick={() => setShowLocationShare(false)}><FiX size={20} /></button>
            </div>
            <LocationShare
              receiverId={activeChat}
              onSent={msg => { addMessage(msg); setShowLocationShare(false); scrollToBottom(); }}
              socket={socket}
            />
          </div>
        </div>
      )}

      {/* ── Forward modal ────────────────────────────────────────────────── */}
      {forwardMessage && (
        <ForwardModal
          message={forwardMessage}
          onClose={() => setForwardMessage(null)}
          socket={socket}
        />
      )}

      {/* ── Attachment preview before send ──────────────────────────────── */}
      {pendingAttachment && (
        <AttachmentPreviewModal
          file={pendingAttachment.file}
          uploading={uploadingFile}
          onSend={handleSendAttachment}
          onCancel={() => setPendingAttachment(null)}
        />
      )}

      {/* ── Image viewer ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {imageViewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex flex-col"
            onClick={() => setImageViewer(null)}
          >
            <div className="flex items-center justify-between p-4">
              <button onClick={() => setImageViewer(null)} className="text-white"><FiX size={24} /></button>
              <a href={imageViewer} download target="_blank" rel="noopener noreferrer"
                className="text-white" onClick={e => e.stopPropagation()}>
                <FiDownload size={22} />
              </a>
            </div>
            <div className="flex-1 flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
              <img src={imageViewer} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChatWindow;
