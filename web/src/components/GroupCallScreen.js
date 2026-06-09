import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff,
  FiUsers, FiMinimize2, FiMaximize2, FiMonitor, FiStopCircle,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

function VideoTile({ stream, label, isLocal, isMuted, isCameraOff, isScreenShare }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initial = label?.[0]?.toUpperCase() || '?';

  return (
    <div className={`relative bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center aspect-video ${isScreenShare ? 'col-span-2 row-span-2' : ''}`}>
      {stream && !isCameraOff ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full ${isScreenShare ? 'object-contain' : 'object-cover'}`}
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          {isScreenShare ? (
            <FiMonitor size={40} className="text-white/30" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-2xl">
              {initial}
            </div>
          )}
          <p className="text-white/60 text-xs">{isCameraOff ? 'Camera off' : 'No video'}</p>
        </div>
      )}
      {/* Name tag */}
      <div className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-black/50 rounded-full px-2 py-1">
        {isMuted && <FiMicOff size={10} className="text-red-400" />}
        {isScreenShare && <FiMonitor size={10} className="text-blue-400" />}
        <span className="text-white text-xs font-medium">
          {isScreenShare ? `${label} (Screen)` : isLocal ? `${label} (You)` : label}
        </span>
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const screenTrackRef = useRef(null);

  const resetTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  useEffect(() => {
    if (callType === 'video') resetTimer();
    return () => clearTimeout(controlsTimer.current);
  }, [callType]);

  // Cleanup screen share on unmount
  useEffect(() => {
    return () => {
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    };
  }, [screenStream]);

  const formatDuration = (s) => {
    if (!s) return '00:00';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Screen Share ─────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error('Screen sharing not supported in this browser');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
          cursor: 'always',
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) { stream.getTracks().forEach(t => t.stop()); return; }

      // Replace camera video track in each peer connection sender
      const peerConnections = window._groupPeerConnections || {};
      for (const pc of Object.values(peerConnections)) {
        const senders = pc.getSenders?.() || [];
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) await videoSender.replaceTrack(videoTrack).catch(() => {});
      }

      screenTrackRef.current = videoTrack;
      setScreenStream(stream);
      setIsScreenSharing(true);
      toast.success('Screen sharing started');

      videoTrack.onended = () => stopScreenShare(stream);
    } catch (err) {
      if (err.name === 'NotAllowedError') toast.error('Screen share permission denied');
      else if (err.name === 'NotSupportedError') toast.error('Screen sharing not supported on this device');
      else console.error('Screen share error:', err);
    }
  }, []);

  const stopScreenShare = useCallback(async (streamToStop) => {
    const target = streamToStop || screenStream;
    if (target) target.getTracks().forEach(t => t.stop());

    // Restore camera to peer connections
    if (localStream) {
      const camTrack = localStream.getVideoTracks()[0];
      if (camTrack) {
        const peerConnections = window._groupPeerConnections || {};
        for (const pc of Object.values(peerConnections)) {
          const senders = pc.getSenders?.() || [];
          const videoSender = senders.find(s => s.track?.kind === 'video' || !s.track);
          if (videoSender) await videoSender.replaceTrack(camTrack).catch(() => {});
        }
      }
    }

    screenTrackRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    toast('Screen sharing stopped', { icon: '🖥️' });
  }, [screenStream, localStream]);

  const remoteEntries = Object.entries(remoteStreams);
  const totalTiles = 1 + remoteEntries.length + (isScreenSharing && screenStream ? 1 : 0);

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
          {isScreenSharing && screenStream ? (
            <video autoPlay playsInline muted className="w-full h-full object-contain bg-black"
              ref={el => { if (el) el.srcObject = screenStream; }} />
          ) : localStream && callType === 'video' && !isCameraOff ? (
            <video autoPlay playsInline muted className="w-full h-full object-cover"
              ref={el => { if (el) el.srcObject = localStream; }} />
          ) : (
            <FiUsers size={28} className="text-white/40" />
          )}
          <div className="absolute inset-0 bg-black/30 flex items-end justify-between p-2">
            <span className="text-white text-xs font-medium truncate">{groupName}</span>
            <span className="text-[#25D366] text-xs font-mono">{formatDuration(callDuration)}</span>
          </div>
          {isScreenSharing && (
            <div className="absolute top-1.5 right-1.5 bg-red-500 rounded-full w-2 h-2 animate-pulse" title="Sharing screen" />
          )}
        </div>
        <div className="flex justify-around py-2 px-2">
          <button onClick={e => { e.stopPropagation(); onToggleMute(); }}
            className={`p-2 rounded-full ${isMuted ? 'bg-red-500' : 'bg-white/10'}`}>
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
          <div className="flex items-center gap-2">
            <p className="text-[#25D366] text-sm font-mono">
              {formatDuration(callDuration)} · {remoteEntries.length + 1} participant{remoteEntries.length !== 0 ? 's' : ''}
            </p>
            {isScreenSharing && (
              <span className="flex items-center gap-1 bg-blue-500/20 text-blue-400 text-xs font-semibold px-2 py-0.5 rounded-full">
                <FiMonitor size={10} /> Sharing screen
              </span>
            )}
          </div>
        </div>
        <button onClick={() => setMinimized(true)} className="w-9 h-9 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition">
          <FiMinimize2 size={16} />
        </button>
      </div>

      {/* Video grid */}
      <div className={`flex-1 grid ${gridClass} gap-2 px-4 pb-4 overflow-hidden`} style={{ alignContent: 'start' }}>
        {/* Screen share tile (large, col-span if grid allows) */}
        {isScreenSharing && screenStream && (
          <div className="relative bg-gray-900 rounded-2xl overflow-hidden flex items-center justify-center aspect-video col-span-2">
            <video autoPlay playsInline muted className="w-full h-full object-contain"
              ref={el => { if (el) el.srcObject = screenStream; }} />
            <div className="absolute bottom-2 left-2 bg-blue-500/80 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
              <FiMonitor size={10} /> Your Screen
            </div>
          </div>
        )}

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
            className="pb-10 pt-4 px-6 flex items-center justify-center gap-4 flex-wrap"
          >
            {/* Mute */}
            <button onClick={onToggleMute}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${isMuted ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
              {isMuted ? <FiMicOff size={22} className="text-white" /> : <FiMic size={22} className="text-white" />}
            </button>

            {/* Camera */}
            {callType === 'video' && (
              <button onClick={onToggleCamera}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${isCameraOff ? 'bg-red-500' : 'bg-white/20 hover:bg-white/30'}`}>
                {isCameraOff ? <FiVideoOff size={22} className="text-white" /> : <FiVideo size={22} className="text-white" />}
              </button>
            )}

            {/* Screen Share */}
            <button
              onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
              className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition ${isScreenSharing ? 'bg-blue-500 ring-2 ring-blue-300' : 'bg-white/20 hover:bg-white/30'}`}
              title={isScreenSharing ? 'Stop sharing screen' : 'Share your screen'}
            >
              {isScreenSharing ? <FiStopCircle size={22} className="text-white" /> : <FiMonitor size={22} className="text-white" />}
            </button>

            {/* End call */}
            <button onClick={onLeave}
              className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-xl transition">
              <FiPhoneOff size={24} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
