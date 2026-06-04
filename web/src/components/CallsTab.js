import React, { useState, useEffect, useMemo } from 'react';
import {
  FiPhone, FiVideo, FiPhoneIncoming, FiPhoneMissed, FiPhoneOutgoing,
  FiSearch, FiMoreVertical, FiTrash2, FiPhoneOff, FiVideoOff
} from 'react-icons/fi';
import { formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useCallHistory } from '../services/callHistory';
import { useAuthStore } from '../services/store';

function CallsTab({ onStartCall }) {
  const { user } = useAuthStore();
  const { history, stats, grouped, deleteCall, clearHistory, searchCalls, sync } = useCallHistory('all');
  const [activeFilter, setActiveFilter] = useState('all'); // all, missed, incoming, outgoing
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  // Filter calls based on search and active filter
  const filteredCalls = useMemo(() => {
    let calls = history;
    
    // Apply type filter
    if (activeFilter === 'missed') {
      calls = calls.filter(c => c.direction === 'missed' || c.status === 'missed');
    } else if (activeFilter === 'incoming') {
      calls = calls.filter(c => c.direction === 'incoming');
    } else if (activeFilter === 'outgoing') {
      calls = calls.filter(c => c.direction === 'outgoing');
    }
    
    // Apply search
    if (searchQuery.trim()) {
      calls = searchCalls(searchQuery);
    }
    
    // Group by date
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    return {
      today: calls.filter(c => now - c.timestamp < oneDayMs),
      yesterday: calls.filter(c => now - c.timestamp >= oneDayMs && now - c.timestamp < oneDayMs * 2),
      thisWeek: calls.filter(c => now - c.timestamp >= oneDayMs * 2 && now - c.timestamp < oneDayMs * 7),
      older: calls.filter(c => now - c.timestamp >= oneDayMs * 7),
    };
  }, [history, activeFilter, searchQuery, searchCalls]);

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Get call icon and color
  const getCallIcon = (call) => {
    const isMissed = call.direction === 'missed' || call.status === 'missed';
    const isIncoming = call.direction === 'incoming';
    const isOutgoing = call.direction === 'outgoing';
    const isVideo = call.call_type === 'video';
    
    if (isMissed) {
      return {
        icon: <FiPhoneMissed size={16} />,
        color: 'text-red-500',
        bg: 'bg-red-50',
      };
    } else if (isOutgoing) {
      return {
        icon: <FiPhoneOutgoing size={16} />,
        color: 'text-green-600',
        bg: 'bg-green-50',
      };
    } else {
      return {
        icon: <FiPhoneIncoming size={16} />,
        color: 'text-blue-500',
        bg: 'bg-blue-50',
      };
    }
  };

  // Render single call item
  const CallItem = ({ call }) => {
    const isCurrentUserCaller = call.caller_id === user?.id;
    const name = isCurrentUserCaller 
      ? (call.receiver_name || 'Unknown') 
      : (call.caller_name || 'Unknown');
    const avatarUrl = isCurrentUserCaller ? call.receiver_avatar : call.caller_avatar;
    const avatarInitial = name?.[0]?.toUpperCase() || '?';
    const targetUserId = isCurrentUserCaller ? call.receiver_id : call.caller_id;
    const { icon, color, bg } = getCallIcon(call);
    const isMissed = call.direction === 'missed' || call.status === 'missed';
    
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100 cursor-pointer group transition-colors"
      >
        {/* Avatar */}
        <div className="relative">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : avatarInitial}
          </div>
          {/* Call type indicator */}
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full ${bg} flex items-center justify-center border-2 border-white`}>
            {call.call_type === 'video' ? (
              <FiVideo size={10} className={color} />
            ) : (
              <FiPhone size={10} className={color} />
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={`font-semibold truncate ${isMissed ? 'text-red-500' : 'text-gray-800'}`}>
              {name}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={color}>{icon}</span>
            <span className="text-xs text-gray-500">
              {call.direction?.charAt(0).toUpperCase() + call.direction?.slice(1)}
              {call.call_type === 'video' ? ' video' : ' voice'}
              {call.duration > 0 && ` · ${formatDuration(call.duration)}`}
            </span>
          </div>
        </div>

        {/* Time */}
        <div className="flex flex-col items-end gap-2">
          <span className="text-xs text-gray-400">
            {formatDistanceToNow(call.timestamp, { addSuffix: true })}
          </span>
          
          {/* Action buttons on hover */}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCall?.({ id: targetUserId, full_name: name }, 'audio');
              }}
              className="p-2 hover:bg-green-100 rounded-full transition-colors"
              title="Voice call"
            >
              <FiPhone size={16} className="text-green-600" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartCall?.({ id: targetUserId, full_name: name }, 'video');
              }}
              className="p-2 hover:bg-blue-100 rounded-full transition-colors"
              title="Video call"
            >
              <FiVideo size={16} className="text-blue-600" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render call group
  const CallGroup = ({ title, calls }) => {
    if (calls.length === 0) return null;
    
    return (
      <div>
        <div className="sticky top-0 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200">
          {title}
        </div>
        <AnimatePresence mode="popLayout">
          {calls.map(call => (
            <CallItem key={call.id} call={call} />
          ))}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header with stats */}
      <div className="p-3 border-b bg-gray-50">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-3">
          {[
            { key: 'all', label: 'All', count: stats.total },
            { key: 'missed', label: 'Missed', count: stats.missed },
            { key: 'incoming', label: 'Incoming', count: stats.incoming },
            { key: 'outgoing', label: 'Outgoing', count: stats.outgoing },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                activeFilter === tab.key
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  activeFilter === tab.key ? 'bg-green-600' : 'bg-gray-300'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search calls..."
            className="w-full pl-9 pr-4 py-2 bg-white rounded-full border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto">
        {filteredCalls.today.length === 0 && 
         filteredCalls.yesterday.length === 0 && 
         filteredCalls.thisWeek.length === 0 && 
         filteredCalls.older.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FiPhone size={32} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">
              {activeFilter === 'missed' ? 'No missed calls' : 
               activeFilter === 'incoming' ? 'No incoming calls' :
               activeFilter === 'outgoing' ? 'No outgoing calls' : 'No calls yet'}
            </p>
            <p className="text-gray-400 text-sm mt-1">Your call history will appear here</p>
          </div>
        ) : (
          <>
            <CallGroup title="Today" calls={filteredCalls.today} />
            <CallGroup title="Yesterday" calls={filteredCalls.yesterday} />
            <CallGroup title="This Week" calls={filteredCalls.thisWeek} />
            <CallGroup title="Older" calls={filteredCalls.older} />
          </>
        )}
      </div>

      {/* Quick stats footer */}
      {stats.total > 0 && (
        <div className="border-t bg-gray-50 px-4 py-2 flex justify-between items-center text-xs text-gray-500">
          <span>
            Total: {stats.total} calls · {formatDuration(stats.totalDuration)} total
          </span>
          <button
            onClick={() => {
              if (confirm('Clear all call history?')) {
                clearHistory();
              }
            }}
            className="text-red-500 hover:text-red-600 font-medium"
          >
            Clear History
          </button>
        </div>
      )}
    </div>
  );
}

export default CallsTab;
