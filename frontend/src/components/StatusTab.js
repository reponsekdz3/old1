import React, { useState, useEffect } from 'react';
import { FiPlus, FiCamera, FiX, FiChevronRight } from 'react-icons/fi';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

// ── Status Viewer (separate component so hooks are unconditional) ─────────────
function StatusViewer({ statusGroup, onClose }) {
  const items = statusGroup?.statuses || [statusGroup];
  const [idx, setIdx] = useState(0);
  const current = items[idx];

  useEffect(() => {
    const timer = setTimeout(() => {
      if (idx < items.length - 1) setIdx(i => i + 1);
      else onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [idx, items.length, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black z-50 flex flex-col"
    >
      {/* Progress bars */}
      <div className="flex gap-1 px-4 pt-10 pb-2">
        {items.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: '0%' }}
              animate={{ width: i <= idx ? '100%' : '0%' }}
              transition={i === idx ? { duration: 5, ease: 'linear' } : { duration: 0 }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-4">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold">
          {statusGroup?.owner_name?.[0] || '?'}
        </div>
        <div>
          <p className="text-white font-semibold text-sm">{statusGroup?.owner_name}</p>
          <p className="text-white/60 text-xs">
            {current?.created_at
              ? formatDistanceToNow(new Date(current.created_at), { addSuffix: true })
              : ''}
          </p>
        </div>
        <button onClick={onClose} className="ml-auto">
          <FiX size={24} className="text-white" />
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 flex items-center justify-center text-white text-2xl font-bold px-8 text-center"
        style={{ backgroundColor: current?.background_color || '#008069' }}
      >
        {current?.content || ''}
      </div>

      {/* Tap to advance */}
      <div className="flex absolute inset-0 top-20" onClick={() => {
        if (idx < items.length - 1) setIdx(i => i + 1); else onClose();
      }} />
    </motion.div>
  );
}

// ── Main StatusTab ────────────────────────────────────────────────────────────
function StatusTab() {
  const { user } = useAuthStore();
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [selectedBg, setSelectedBg] = useState('#008069');
  const [viewingStatus, setViewingStatus] = useState(null);
  const [posting, setPosting] = useState(false);
  const [myStatuses, setMyStatuses] = useState([]);

  const bgColors = [
    '#008069', '#25D366', '#075E54', '#128C7E',
    '#34B7F1', '#8B5CF6', '#EC4899', '#F59E0B',
    '#EF4444', '#6366F1', '#000000', '#374151',
  ];

  useEffect(() => { loadStatuses(); }, []);

  const loadStatuses = async () => {
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

  const postStatus = async () => {
    if (!statusText.trim()) return;
    setPosting(true);
    try {
      await api.post('/status/create', {
        content: statusText,
        background_color: selectedBg,
        status_type: 'text',
      });
      setStatusText('');
      setShowCompose(false);
      loadStatuses();
    } catch {
    } finally {
      setPosting(false);
    }
  };

  const avatarInitial = user?.full_name?.[0]?.toUpperCase() || '?';

  return (
    <>
      <div className="flex flex-col h-full bg-white overflow-y-auto">
        {/* My Status */}
        <div className="p-4 border-b">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">My Status</p>
          <div
            className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2 transition-colors"
            onClick={() => setShowCompose(true)}
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : avatarInitial}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center border-2 border-white">
                <FiPlus size={12} className="text-white" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-semibold text-gray-800">My status</p>
              <p className="text-sm text-gray-500">
                {myStatuses.length > 0
                  ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}`
                  : 'Tap to add status update'}
              </p>
            </div>
            {myStatuses.length > 0 && <FiChevronRight size={18} className="text-gray-400" />}
          </div>
        </div>

        {/* Recent Updates */}
        {statuses.length > 0 && (
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-3">Recent Updates</p>
            {statuses.map((sg, i) => (
              <motion.div
                key={sg.user_id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 rounded-xl p-2 -mx-2 mb-1 transition-colors"
                onClick={() => setViewingStatus(sg)}
              >
                <div className={`w-14 h-14 rounded-full p-0.5 ${sg.viewed ? 'bg-gray-300' : 'bg-gradient-to-br from-green-400 to-teal-500'}`}>
                  <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-bold text-xl overflow-hidden border-2 border-white">
                    {sg.owner_avatar
                      ? <img src={sg.owner_avatar} alt="" className="w-full h-full object-cover" />
                      : sg.owner_name?.[0]?.toUpperCase() || '?'}
                  </div>
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">{sg.owner_name}</p>
                  <p className="text-sm text-gray-500">
                    {sg.latest_at
                      ? formatDistanceToNow(new Date(sg.latest_at), { addSuffix: true })
                      : ''}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {!loading && statuses.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 py-16 px-8 text-center">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FiCamera size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No recent updates</p>
            <p className="text-gray-400 text-sm mt-1">Contacts' status updates will appear here</p>
          </div>
        )}
      </div>

      {/* ── Status Viewer overlay ── */}
      <AnimatePresence>
        {viewingStatus && (
          <StatusViewer
            statusGroup={viewingStatus}
            onClose={() => setViewingStatus(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Compose Status overlay ── */}
      <AnimatePresence>
        {showCompose && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{ backgroundColor: selectedBg }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 pt-12 pb-4">
              <button onClick={() => setShowCompose(false)}>
                <FiX size={24} className="text-white" />
              </button>
              <span className="text-white font-semibold text-lg flex-1">New Status</span>
              <button
                onClick={postStatus}
                disabled={!statusText.trim() || posting}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full font-semibold disabled:opacity-40 transition"
              >
                {posting ? 'Posting...' : 'Share'}
              </button>
            </div>

            {/* Text input */}
            <div className="flex-1 flex items-center justify-center px-8">
              <textarea
                autoFocus
                value={statusText}
                onChange={e => setStatusText(e.target.value)}
                placeholder="Type a status..."
                maxLength={700}
                className="w-full bg-transparent text-white text-2xl font-bold text-center placeholder-white/50 resize-none outline-none"
                rows={4}
              />
            </div>

            <p className="text-center text-white/60 text-sm pb-2">{700 - statusText.length}</p>

            {/* Color picker */}
            <div className="flex gap-2 px-4 pb-8 overflow-x-auto">
              {bgColors.map(color => (
                <button
                  key={color}
                  onClick={() => setSelectedBg(color)}
                  className={`w-9 h-9 rounded-full flex-shrink-0 transition-transform border-2 ${selectedBg === color ? 'scale-125 border-white' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default StatusTab;
