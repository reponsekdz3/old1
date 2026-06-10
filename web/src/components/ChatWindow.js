import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import ProgressiveImage from './ProgressiveImage';
import { encryptForUser, decryptFromUser } from '../services/e2ee';
import { useAuthStore, useChatStore } from '../services/store';
import api from '../services/api';
import {
  FiSend, FiSmile, FiPaperclip, FiMoreVertical, FiPhone, FiVideo,
  FiArrowLeft, FiSearch, FiX, FiMic, FiImage, FiFile, FiMapPin,
  FiUser, FiStar, FiShare2, FiEdit2, FiTrash2, FiCopy,
  FiCornerUpLeft, FiCheck, FiChevronDown, FiInfo,
  FiCamera, FiDownload, FiRefreshCw, FiMessageSquare, FiLock, FiLink, FiMusic, FiClock,
  FiPlay, FiAlignLeft,
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
import ScheduleMessageModal from './ScheduleMessageModal';

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
function VoiceNote({ src, isOwn, transcript, duration: initialDuration }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [txExpanded, setTxExpanded] = useState(false);
  const audioRef = useRef(null);
  const waveRef = useRef(null);
  const [waveData] = useState(() =>
    Array.from({ length: 50 }, (_, i) => {
      const x = i / 50;
      return 0.1 + Math.abs(Math.sin(x * 9.7 + 1.2)) * 0.5 + Math.abs(Math.sin(x * 3.1)) * 0.3 + Math.random() * 0.1;
    })
  );

  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.playbackRate = speed; audioRef.current.play(); setPlaying(true); }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2, 0.75];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const handleSeek = (e) => {
    if (!waveRef.current || !audioRef.current?.duration) return;
    const rect = waveRef.current.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * audioRef.current.duration;
    setProgress(ratio * 100);
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = src;
    a.download = `voice_${Date.now()}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyTranscript = () => {
    if (!transcript) return;
    navigator.clipboard.writeText(transcript).then(() => toast.success('Transcript copied'));
  };

  const ownBg = isOwn ? 'bg-white/20' : 'bg-[#25D366]';
  const ownText = isOwn ? 'text-white/70' : 'text-gray-500';
  const playedColor = isOwn ? 'bg-white' : 'bg-[#25D366]';
  const unplayedColor = isOwn ? 'bg-white/30' : 'bg-gray-300';

  return (
    <div className="min-w-[220px] max-w-[280px]">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={() => {
          const el = audioRef.current;
          if (el?.duration) setProgress((el.currentTime / el.duration) * 100);
        }}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
      />

      {/* Main player row */}
      <div className="flex items-center gap-2">
        <button onClick={toggle}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition ${ownBg}`}>
          {playing
            ? <span className="flex gap-[3px]">
                <span className="w-[3px] h-3 bg-white rounded-full" />
                <span className="w-[3px] h-3 bg-white rounded-full" />
              </span>
            : <FiPlay size={13} className="text-white translate-x-[1px]" />}
        </button>

        {/* Seekable waveform */}
        <div ref={waveRef} className="flex items-center gap-[1.5px] flex-1 h-8 cursor-pointer" onClick={handleSeek}>
          {waveData.map((v, i) => {
            const played = (i / waveData.length) * 100 < progress;
            return (
              <div key={i}
                className={`flex-1 rounded-full transition-colors duration-75 ${played ? playedColor : unplayedColor}`}
                style={{ height: `${Math.max(3, v * 28)}px` }}
              />
            );
          })}
        </div>

        <span className={`text-[10px] font-mono flex-shrink-0 tabular-nums ${ownText}`}>
          {fmtTime(playing ? (audioRef.current?.currentTime || 0) : duration)}
        </span>
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between mt-1.5">
        <button onClick={cycleSpeed}
          className={`text-[10px] font-black px-2 py-0.5 rounded-md transition ${isOwn ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          {speed}×
        </button>

        <div className="flex items-center gap-1.5">
          {transcript && (
            <button onClick={() => setTxExpanded(v => !v)}
              className={`text-[10px] font-semibold flex items-center gap-1 px-1.5 py-0.5 rounded-md transition ${isOwn ? 'bg-white/15 text-white/80 hover:bg-white/25' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <FiAlignLeft size={9} />
              {txExpanded ? 'Hide' : 'Text'}
            </button>
          )}
          <button onClick={handleDownload} title="Download"
            className={`w-5 h-5 rounded flex items-center justify-center transition ${isOwn ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
            <FiDownload size={10} className={isOwn ? 'text-white/60' : 'text-gray-400'} />
          </button>
        </div>
      </div>

      {/* Transcript panel */}
      <AnimatePresence>
        {txExpanded && transcript && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className={`mt-2 pt-2 border-t ${isOwn ? 'border-white/20' : 'border-gray-200'}`}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-[9px] uppercase tracking-widest font-bold ${isOwn ? 'text-white/50' : 'text-gray-400'}`}>
                  Transcript
                </span>
                <button onClick={copyTranscript}
                  className={`w-5 h-5 flex items-center justify-center rounded transition ${isOwn ? 'hover:bg-white/20' : 'hover:bg-gray-100'}`}>
                  <FiCopy size={9} className={isOwn ? 'text-white/50' : 'text-gray-400'} />
                </button>
              </div>
              <p className={`text-xs leading-relaxed ${isOwn ? 'text-white/85' : 'text-gray-700'}`}>
                {transcript}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className={`flex mb-1 group ${isOwn ? 'justify-end' : 'justify-start'}`}
    >
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
          onDoubleClick={() => !isDeleted && onReply(message)}
          className={`rounded-2xl px-3 pt-2 pb-1.5 shadow-sm cursor-default relative select-none ${
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
              <ProgressiveImage
                src={message.media_url}
                alt="media"
                style={{ width: '100%', maxHeight: 256 }}
              />
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
              <VoiceNote
                src={message.media_url}
                isOwn={isOwn}
                transcript={message.content}
                duration={message.media_duration}
              />
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
    </motion.div>
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
  const [showSchedule, setShowSchedule] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showWallpaper, setShowWallpaper] = useState(false);
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
  const [destructTimer, setDestructTimer] = useState(null);      // null | 'view_once' | seconds
  const [showTimerPicker, setShowTimerPicker] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const prevActiveChatRef = useRef(null);

  // ── Mark all messages as read ──────────────────────────────────────────
  useEffect(() => {
    if (activeChat) loadContactInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChat]);

  const [contact, setContact] = useState(null);

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

  const chatName = contact?.contact_name || contactUser?.full_name || 'Unknown';
  const chatAvatar = contactUser?.avatar_url;
  const isOnline = contactUser?.status === 'available';

  // ── Load chat on activeChat change ──────────────────────────────────────
  useEffect(() => {
    if (!activeChat || activeChat === prevActiveChatRef.current) return;
    prevActiveChatRef.current = activeChat;
    setPage(1);
    setMessages([]);
    setReplyTo(null);
    setEditingMessage(null);
    loadChatHistory(1, true);
    // Mark all messages as read
    api.put(`/messages/chat/${activeChat}/read-all`).catch(() => {});
  }, [activeChat]);

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
        ...(destructTimer === 'view_once'   ? { view_once: true }                              : {}),
        ...(typeof destructTimer === 'number' ? { auto_delete_seconds: destructTimer }          : {}),
      };

      // Attempt Signal Protocol E2EE — gracefully degrade if keys unavailable
      // Content is always stored as plaintext for display; encrypted_payload carries the ciphertext
      try {
        const enc = await encryptForUser(activeChat, text, api);
        if (enc) {
          payload.encrypted_payload = enc.encrypted_payload;
          payload.e2ee_header      = enc.e2ee_header;
          payload.e2ee_type        = enc.e2ee_type;
          // Keep content as plaintext — never show cipher text in the UI
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
      setDestructTimer(null);
      setShowEmoji(false);
      scrollToBottom();
    } catch {
      toast.error('Failed to send message');
    }
  }, [messageText, editingMessage, replyTo, activeChat, socket, user, destructTimer]);

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
        ...(destructTimer === 'view_once'    ? { view_once: true }                : {}),
        ...(typeof destructTimer === 'number' ? { auto_delete_seconds: destructTimer } : {}),
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
        <div className="text-center px-8">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-gray-100"
          >
            <FiMessageSquare size={40} className="text-[#25D366]" />
          </motion.div>
          <h2 className="text-3xl font-light text-gray-700 mb-3">VipChat Web</h2>
          <p className="text-gray-500 text-sm mb-2 max-w-xs mx-auto">Select a chat to start messaging or start a new conversation with your contacts.</p>
          <p className="text-gray-400 text-xs mb-8">Your personal messages are end-to-end encrypted.</p>
          <div className="flex items-center justify-center gap-2 text-gray-400">
            <FiLock size={12} className="text-green-500" />
            <span className="text-xs">End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-[#e5ddd5] relative overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="bg-[#f0f2f5] border-b border-gray-200 px-3 py-2 flex items-center gap-3 flex-shrink-0 z-20 shadow-sm">
        {/* Back button (mobile) */}
        <button onClick={onBack} className="md:hidden p-1.5 hover:bg-gray-200 rounded-full transition">
          <FiArrowLeft size={20} className="text-gray-600" />
        </button>

        {/* Avatar */}
        <button onClick={onContactInfoClick} className="flex-shrink-0 relative">
          <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            {chatAvatar
              ? <img src={chatAvatar} alt="" className="w-full h-full object-cover" />
              : (chatName?.[0]?.toUpperCase() || '?')}
          </div>
          {isOnline && (
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#25D366] rounded-full border-2 border-[#f0f2f5]" />
          )}
        </button>

        {/* Name + status */}
        <button className="flex-1 text-left min-w-0" onClick={onContactInfoClick}>
          <h3 className="font-semibold text-gray-900 text-[15px] leading-tight truncate flex items-center gap-1">
            {chatName}
            <VerifiedBadgeInline user={contactUser} size={13} />
          </h3>
          <div className="h-4 overflow-hidden">
            <AnimatePresence mode="wait">
              {isTyping ? (
                <motion.span
                  key="typing"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className="text-[11px] text-[#25D366] font-medium block"
                >
                  typing...
                </motion.span>
              ) : (
                <motion.span
                  key="status"
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  className="text-[11px] text-gray-500 block"
                >
                  {isOnline ? 'online'
                    : contactUser?.last_seen
                      ? `last seen ${format(new Date(contactUser.last_seen), 'HH:mm')}`
                      : 'offline'}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </button>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <button onClick={() => setShowSearch(v => !v)} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
            <FiSearch size={20} />
          </button>
          <button onClick={() => onStartCall?.({ id: activeChat, full_name: chatName, avatar_url: chatAvatar }, 'audio')}
            className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500" title="Voice call">
            <FiPhone size={19} />
          </button>
          <button onClick={() => onStartCall?.({ id: activeChat, full_name: chatName, avatar_url: chatAvatar }, 'video')}
            className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500" title="Video call">
            <FiVideo size={20} />
          </button>
          <button onClick={onContactInfoClick} className="p-2 hover:bg-gray-200 rounded-full transition text-gray-500">
            <FiMoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Search Bar Overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="absolute top-0 inset-x-0 bg-[#f0f2f5] z-30 px-4 py-2 flex items-center gap-3 border-b border-gray-200 shadow-md"
          >
            <FiSearch size={18} className="text-gray-400" />
            <input
              autoFocus
              type="text"
              placeholder="Search in chat..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="flex-1 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none"
            />
            <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="text-gray-500 p-1 hover:bg-gray-200 rounded-full transition">
              <FiX size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Messages area */}
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
                <FiLock size={20} className="mx-auto mb-2 text-gray-400" />
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
                key={msg.id}
                message={msg}
                isOwn={isOwn}
                contactName={!isOwn ? chatName : null}
                onReply={setReplyTo}
                onEdit={setEditingMessage}
                onDelete={handleDelete}
                onForward={setForwardMessage}
                onStar={handleStar}
                onReact={handleReact}
                onImageClick={setImageViewer}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div className="bg-[#f0f2f5] p-2 flex-shrink-0 relative z-10 border-t border-gray-200">
          <AnimatePresence>
            {replyTo && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white/60 backdrop-blur-md rounded-t-xl mb-1 p-2 border-l-4 border-[#25D366] flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#25D366]">
                    {replyTo.sender_id === user?.id ? 'Replying to yourself' : `Replying to ${chatName}`}
                  </p>
                  <p className="text-xs text-gray-500 truncate">{replyTo.content || (replyTo.media_type ? `[${replyTo.media_type}]` : '[Media]')}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="p-1 hover:bg-gray-200 rounded-full">
                  <FiX size={14} />
                </button>
              </motion.div>
            )}
            {editingMessage && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-white/60 backdrop-blur-md rounded-t-xl mb-1 p-2 border-l-4 border-orange-500 flex items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-orange-500">Editing message</p>
                  <p className="text-xs text-gray-500 truncate">{editingMessage.content}</p>
                </div>
                <button onClick={() => { setEditingMessage(null); setMessageText(''); }} className="p-1 hover:bg-gray-200 rounded-full">
                  <FiX size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={sendMessage} className="flex items-center gap-1.5">
            <div className="flex items-center">
              <button type="button" onClick={() => setShowEmoji(v => !v)} className={`p-2 rounded-full transition ${showEmoji ? 'bg-gray-200 text-[#25D366]' : 'text-gray-500 hover:bg-gray-200'}`}>
                <FiSmile size={24} />
              </button>
              <div className="relative">
                <button type="button" onClick={() => setShowAttach(v => !v)} className={`p-2 rounded-full transition ${showAttach ? 'bg-gray-200 text-[#25D366] rotate-45' : 'text-gray-500 hover:bg-gray-200'}`}>
                  <FiPaperclip size={24} />
                </button>
                <AnimatePresence>
                  {showAttach && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowAttach(false)} />
                      <AttachMenu
                        onAttach={handleAttach}
                        onLocation={() => setShowLocationShare(true)}
                        onContactSend={() => toast('Select contact feature coming soon')}
                        onClose={() => setShowAttach(false)}
                      />
                    </>
                  )}
                </AnimatePresence>
              </div>
              {/* Schedule message button */}
              <button
                type="button"
                onClick={() => setShowSchedule(true)}
                title="Schedule message"
                className="p-2 rounded-full transition text-gray-500 hover:bg-gray-200 hover:text-[#25D366]"
              >
                <FiClock size={21} />
              </button>

              {/* Self-destruct timer */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowTimerPicker(v => !v)}
                  title="Self-destruct timer"
                  className={`p-2 rounded-full transition ${destructTimer ? 'bg-red-100 text-red-500' : 'text-gray-500 hover:bg-gray-200 hover:text-red-400'}`}
                >
                  🔥
                  {destructTimer && (
                    <span className="absolute -top-0.5 -right-0.5 text-[9px] font-bold bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      {destructTimer === 'view_once' ? '1' : typeof destructTimer === 'number' ? Math.round(destructTimer/60) || 's' : ''}
                    </span>
                  )}
                </button>
                {showTimerPicker && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowTimerPicker(false)} />
                    <div className="absolute bottom-12 left-0 bg-white rounded-2xl shadow-2xl border border-gray-100 py-2 z-20 w-52">
                      <p className="text-xs font-semibold text-gray-400 px-4 py-1.5 uppercase tracking-wider">Self-Destruct Timer</p>
                      {[
                        { label: '🔥 View once', value: 'view_once' },
                        { label: '⏱ 30 seconds', value: 30 },
                        { label: '⏱ 5 minutes',  value: 300 },
                        { label: '⏱ 1 hour',     value: 3600 },
                        { label: '⏱ 24 hours',   value: 86400 },
                        { label: '❌ No timer',   value: null },
                      ].map(opt => (
                        <button key={String(opt.value)}
                          type="button"
                          onClick={() => { setDestructTimer(opt.value); setShowTimerPicker(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition ${destructTimer === opt.value ? 'text-red-500 font-semibold' : 'text-gray-700'}`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 bg-white rounded-xl flex items-center px-3 min-h-[44px] shadow-sm border border-gray-100">
              <input
                ref={inputRef}
                type="text"
                placeholder="Type a message"
                className="w-full py-2 bg-transparent outline-none text-[15px]"
                value={messageText}
                onChange={(e) => {
                  setMessageText(e.target.value);
                  handleTyping();
                }}
              />
            </div>

            {messageText.trim() || editingMessage ? (
              <div className="relative group">
                <button type="submit" className="w-11 h-11 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#1fbd5a] transition active:scale-95">
                  <FiSend size={20} className="ml-0.5" />
                </button>
              </div>
            ) : (
              <VoiceRecorder onFinished={(blob) => handleAttach(blob, 'voice')} />
            )}
          </form>
        </div>
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {showEmoji && (
          <motion.div
            initial={{ y: 200, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 200, opacity: 0 }}
            className="bg-white border-t z-20"
          >
            <EmojiPicker onEmojiSelect={(emoji) => {
              setMessageText(prev => prev + emoji);
              setShowEmoji(false);
              inputRef.current?.focus();
            }} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingAttachment && (
          <AttachmentPreviewModal
            attachment={pendingAttachment}
            onClose={() => setPendingAttachment(null)}
            onSend={handleSendAttachment}
          />
        )}
      </AnimatePresence>

      {/* Schedule Message Modal */}
      <AnimatePresence>
        {showSchedule && (
          <ScheduleMessageModal
            receiverId={activeChat}
            receiverName={contactUser?.full_name || chatName}
            onClose={() => setShowSchedule(false)}
            onScheduled={() => {}}
          />
        )}
      </AnimatePresence>

      {imageViewer && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col">
          <div className="p-4 flex justify-end">
            <button onClick={() => setImageViewer(null)} className="p-2 bg-white/10 hover:bg-white/20 rounded-full text-white">
              <FiX size={24} />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center p-4">
            <img src={imageViewer} alt="" className="max-w-full max-h-full object-contain shadow-2xl" />
          </div>
        </div>
      )}

      {showLocationShare && (
        <LocationShare
          onClose={() => setShowLocationShare(false)}
          onSend={(loc) => {
            api.post(`/messages/${activeChat}`, {
              media_type: 'location',
              latitude: loc.lat,
              longitude: loc.lng,
              location_name: loc.name,
            }).then(({ data }) => {
              addMessage(data);
              setShowLocationShare(false);
              scrollToBottom();
            });
          }}
        />
      )}
    </div>
  );
}

export default ChatWindow;
