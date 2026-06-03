import React, { useState, useEffect } from 'react';
import {
  FiPhone, FiVideo, FiPhoneIncoming, FiPhoneMissed,
  FiPhoneOutgoing, FiSearch,
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

function CallsTab({ onStartCall }) {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadCallHistory();
  }, []);

  const loadCallHistory = async () => {
    try {
      const { data } = await api.get('/calls/history');
      setCalls(data.calls || []);
    } catch {
      setCalls([]);
    } finally {
      setLoading(false);
    }
  };

  const getCallDirection = (call) => {
    if (call.caller_id === user?.id) return 'outgoing';
    if (call.status === 'missed' || call.status === 'rejected') return 'missed';
    return 'incoming';
  };

  const CallIcon = ({ direction, type }) => {
    const iconProps = { size: 18 };
    if (direction === 'missed') return <FiPhoneMissed {...iconProps} className="text-red-500" />;
    if (direction === 'outgoing') return <FiPhoneOutgoing {...iconProps} className="text-green-500" />;
    return <FiPhoneIncoming {...iconProps} className="text-blue-500" />;
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const filtered = calls.filter(call => {
    const name = call.caller_id === user?.id
      ? call.receiver_name : call.caller_name;
    return name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search */}
      <div className="p-3 border-b bg-gray-50">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search calls..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* Call List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Loading calls...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FiPhone size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">No calls yet</p>
            <p className="text-gray-400 text-sm mt-1">Your call history will appear here</p>
          </div>
        ) : (
          filtered.map((call, i) => {
            const direction = getCallDirection(call);
            const name = call.caller_id === user?.id
              ? (call.receiver_name || 'Unknown')
              : (call.caller_name || 'Unknown');
            const isVideo = call.call_type === 'video';
            const targetUser = {
              id: call.caller_id === user?.id ? call.receiver_id : call.caller_id,
              full_name: name,
            };

            return (
              <motion.div
                key={call.id || i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50 cursor-pointer group"
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden">
                  {call.avatar_url
                    ? <img src={call.avatar_url} alt="" className="w-full h-full object-cover" />
                    : name[0]?.toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`font-semibold truncate ${direction === 'missed' ? 'text-red-500' : 'text-gray-800'}`}>
                      {name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CallIcon direction={direction} />
                    <span className="text-xs text-gray-400">
                      {direction.charAt(0).toUpperCase() + direction.slice(1)}
                      {isVideo ? ' video' : ' voice'}
                      {call.duration ? ` · ${formatDuration(call.duration)}` : ''}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {call.created_at
                      ? formatDistanceToNow(new Date(call.created_at), { addSuffix: true })
                      : ''}
                  </p>
                </div>

                {/* Call back buttons */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onStartCall?.(targetUser, 'audio')}
                    title="Voice call"
                    className="p-2 hover:bg-green-50 rounded-full"
                  >
                    <FiPhone size={18} className="text-green-600" />
                  </button>
                  <button
                    onClick={() => onStartCall?.(targetUser, 'video')}
                    title="Video call"
                    className="p-2 hover:bg-blue-50 rounded-full"
                  >
                    <FiVideo size={18} className="text-blue-600" />
                  </button>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default CallsTab;
