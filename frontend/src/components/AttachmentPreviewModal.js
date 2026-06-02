import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiSend, FiFile, FiMusic, FiVideo, FiImage, FiEdit2 } from 'react-icons/fi';

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function FileTypeIcon({ file }) {
  const type = file.type;
  if (type.startsWith('image/')) return <FiImage size={40} className="text-purple-400" />;
  if (type.startsWith('video/')) return <FiVideo size={40} className="text-blue-400" />;
  if (type.startsWith('audio/')) return <FiMusic size={40} className="text-green-400" />;
  return <FiFile size={40} className="text-orange-400" />;
}

export default function AttachmentPreviewModal({ file, onSend, onCancel, uploading }) {
  const [caption, setCaption] = useState('');
  const inputRef = useRef(null);

  const isImage = file?.type?.startsWith('image/');
  const isVideo = file?.type?.startsWith('video/');
  const isAudio = file?.type?.startsWith('audio/');
  const objectUrl = file ? URL.createObjectURL(file) : null;

  const handleSend = useCallback(() => {
    if (!uploading) onSend(caption.trim());
  }, [caption, onSend, uploading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape') onCancel();
  };

  if (!file) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4"
        onClick={e => e.target === e.currentTarget && onCancel()}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="w-full max-w-lg flex flex-col bg-[#1a1a2e] rounded-2xl overflow-hidden shadow-2xl"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <FileTypeIcon file={file} />
              </div>
              <div className="min-w-0">
                <p className="text-white text-sm font-semibold truncate max-w-[200px]">{file.name}</p>
                <p className="text-white/40 text-xs">{formatBytes(file.size)}</p>
              </div>
            </div>
            <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-white/60 hover:text-white transition">
              <FiX size={18} />
            </button>
          </div>

          {/* Preview area */}
          <div className="flex-1 flex items-center justify-center p-6 min-h-[260px] bg-black/30">
            {isImage && objectUrl && (
              <img src={objectUrl} alt="preview" className="max-w-full max-h-[300px] rounded-xl object-contain shadow-xl" />
            )}
            {isVideo && objectUrl && (
              <video src={objectUrl} controls className="max-w-full max-h-[300px] rounded-xl shadow-xl" />
            )}
            {isAudio && objectUrl && (
              <div className="w-full flex flex-col items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center shadow-xl">
                  <FiMusic size={36} className="text-white" />
                </div>
                <audio src={objectUrl} controls className="w-full" style={{ filter: 'invert(0.8) hue-rotate(170deg)' }} />
              </div>
            )}
            {!isImage && !isVideo && !isAudio && (
              <div className="flex flex-col items-center gap-4 text-center">
                <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center">
                  <FileTypeIcon file={file} />
                </div>
                <div>
                  <p className="text-white font-semibold text-base truncate max-w-[260px]">{file.name}</p>
                  <p className="text-white/50 text-sm mt-1">{formatBytes(file.size)}</p>
                  <p className="text-white/30 text-xs mt-0.5">{file.type || 'Unknown type'}</p>
                </div>
              </div>
            )}
          </div>

          {/* Caption input */}
          <div className="px-4 py-3 border-t border-white/10">
            <div className="flex items-end gap-3">
              <div className="flex-1 bg-white/10 rounded-2xl px-4 py-2.5 flex items-start gap-2">
                <FiEdit2 size={14} className="text-white/40 mt-0.5 flex-shrink-0" />
                <textarea
                  ref={inputRef}
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add a caption..."
                  rows={1}
                  className="flex-1 bg-transparent text-white text-sm outline-none resize-none placeholder-white/30 leading-5"
                  style={{ height: 'auto' }}
                  onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px'; }}
                  autoFocus
                />
              </div>
              <button
                onClick={handleSend}
                disabled={uploading}
                className="w-11 h-11 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-50 text-white rounded-full flex items-center justify-center flex-shrink-0 shadow-lg transition"
              >
                {uploading
                  ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  : <FiSend size={18} />
                }
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
