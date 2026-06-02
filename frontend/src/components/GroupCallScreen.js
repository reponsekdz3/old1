import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff,
  FiUsers, FiMinimize2, FiMaximize2,
} from 'react-icons/fi';

function VideoTile({ stream, label, isLocal, isMuted, isCameraOff }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initial = label?.[0]?.toUpperCase() || '?';

  return (
    <div className="relative bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center aspect-video">
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-2xl">
            {initial}
          </div>
          <p className="text-white/60 text-xs">{isCameraOff ? 'Camera off' : 'No video'}</p>
        </div>
      )}
      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1">
        {isMuted && <FiMicOff size={10} className="text-red-400" />}
        <span className="text-white text-xs font-medium">{isLocal ? `${label} (You)` : label}</span>
      </div>
    </div>
  );
}

export default function GroupCallScreen({
  localStream,
  remoteStreams,
  participants,
  groupName,
  callType,
  isMuted,
  isCameraOff,
  onToggleMute,
  onToggleCamera,
  onLeave,
  callDuration,
}) {
  const [minimized, setMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);

  const resetTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  useEffect(() => {
    if (callType === 'video') resetTimer();
    return () => clearTimeout(controlsTimer.current);
  }, [callType]);

  const formatDuration = (s) => {
    if (!s) return '00:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  const remoteEntries = Object.entries(remoteStreams);
  const totalTiles = 1 + remoteEntries.length;

  const gridClass = totalTiles === 1 ? 'grid-cols-1' :
    totalTiles === 2 ? 'grid-cols-2' :
    totalTiles <= 4 ? 'grid-cols-2' :
    'grid-cols-3';

  if (minimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-24 right-4 z-50 w-52 bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-white/10 cursor-pointer"
        onClick={() => setMinimized(false)}
      >
        <div className="aspect-video bg-gray-800 flex items-center justify-center relative">
          {localStream && callType === 'video' && !isCameraOff ? (
            <video autoPlay playsInline muted className="w-full h-full object-cover" ref={el => { if (el) el.srcObject = localStream; }} />
          ) : (
            <FiUsers size={28} className="text-white/40" />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-end justify-between p-2">
            <span className="text-white text-xs font-medium truncate">{groupName}</span>
            <span className="text-[#25D366] text-xs font-mono">{formatDuration(callDuration)}</span>
          </div>
        </div>
        <div className="flex justify-around py-2 px-2">
          <button onClick={e => { e.stopPropagation(); onToggleMute(); }} className={`p-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
            {isMuted ? <FiMicOff size={14} className="text-white" /> : <FiMic size={14} className="text-white" />}
          </button>
          <button onClick={e => { e.stopPropagation(); onLeave(); }} className="p-2 rounded-full bg-red-500">
            <FiPhoneOff size={14} className="text-white" />
          </button>
          <button onClick={e => { e.stopPropagation(); setMinimized(false); }} className="p-2 rounded-full bg-white/10">
            <FiMaximize2 size={14} className="text-white" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0d1117] flex flex-col"
      onMouseMove={callType === 'video' ? resetTimer : undefined}
      onClick={callType === 'video' ? resetTimer : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-10 pb-4">
        <div>
          <h2 className="text-white font-bold text-lg">{groupName || 'Group Call'}</h2>
          <p className="text-[#25D366] text-sm font-mono">{formatDuration(callDuration)} · {totalTiles} participant{totalTiles !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setMinimized(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
          <FiMinimize2 size={16} />
        </button>
      </div>

      {/* Video grid */}
      <div className={`flex-1 grid ${gridClass} gap-2 px-4 pb-4 overflow-hidden`} style={{ alignContent: 'start' }}>
        <VideoTile
          stream={localStream}
          label="You"
          isLocal
          isMuted={isMuted}
          isCameraOff={isCameraOff || callType === 'audio'}
        />
        {remoteEntries.map(([userId, stream]) => {
          const p = participants.find(x => x.user_id === userId);
          return (
            <VideoTile
              key={userId}
              stream={stream}
              label={p?.user_name || 'Participant'}
              isMuted={false}
              isCameraOff={callType === 'audio'}
            />
          );
        })}
        {/* Waiting placeholder */}
        {remoteEntries.length === 0 && (
          <div className="aspect-video bg-gray-800/50 rounded-2xl flex flex-col items-center justify-center border border-dashed border-white/20">
            <FiUsers size={32} className="text-white/30 mb-2" />
            <p className="text-white/30 text-sm">Waiting for others to join...</p>
          </div>
        )}
      </div>

      {/* Controls */}
      <AnimatePresence>
        {(showControls || callType === 'audio') && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="pb-10 pt-4 px-6 flex items-center justify-center gap-4"
          >
            <button
              onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
            >
              {isMuted ? <FiMicOff size={22} className="text-white" /> : <FiMic size={22} className="text-white" />}
            </button>

            {callType === 'video' && (
              <button
                onClick={onToggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${isCameraOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}
              >
                {isCameraOff ? <FiVideoOff size={22} className="text-white" /> : <FiVideo size={22} className="text-white" />}
              </button>
            )}

            <button
              onClick={onLeave}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition"
            >
              <FiPhoneOff size={24} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
