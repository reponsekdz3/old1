import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff,
  FiVolume2, FiVolumeX, FiRefreshCw,
  FiMinimize2,
} from 'react-icons/fi';
import { useCallStore } from '../services/store';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function CallScreen({
  onEndCall, onToggleMute, onToggleCamera, onFlipCamera,
}) {
  const {
    callState, callType, caller, callee,
    localStream, remoteStream,
    isMuted, isCameraOff, isSpeakerOn, setSpeakerOn,
    callDuration,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [minimized, setMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);

  const remote = caller || callee;
  const isVideoCall = callType === 'video';

  // Attach streams to video/audio elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteStream) {
      if (remoteVideoRef.current && isVideoCall) {
        remoteVideoRef.current.srcObject = remoteStream;
      }
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
      }
    }
  }, [remoteStream, isVideoCall]);

  // Auto-hide controls
  const resetControlsTimer = () => {
    setShowControls(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => setShowControls(false), 4000);
  };

  useEffect(() => {
    if (isVideoCall && callState === 'active') resetControlsTimer();
    return () => clearTimeout(controlsTimer.current);
  }, [callState, isVideoCall]);

  const avatarInitial = remote?.full_name?.[0]?.toUpperCase() || '?';

  const stateLabel = {
    outgoing: 'Calling...',
    ringing: 'Ringing...',
    active: formatDuration(callDuration),
    ended: 'Call ended',
  }[callState] || '...';

  if (minimized) {
    return (
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="fixed bottom-24 right-4 z-[90] w-44 bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 cursor-pointer"
        onClick={() => setMinimized(false)}
      >
        {isVideoCall && remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-28 object-cover" />
        ) : (
          <div className="w-full h-28 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
              {remote?.avatar_url
                ? <img src={remote.avatar_url} alt="" className="w-full h-full object-cover" />
                : avatarInitial}
            </div>
          </div>
        )}
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-white text-xs font-semibold truncate">{remote?.full_name}</p>
            <p className="text-green-400 text-xs">{stateLabel}</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onEndCall(); }}
            className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center"
          >
            <FiPhoneOff size={14} className="text-white" />
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
      className="fixed inset-0 z-[90] bg-black flex flex-col"
      onClick={isVideoCall ? resetControlsTimer : undefined}
    >
      {/* Hidden audio element for remote audio in audio calls */}
      <audio ref={remoteAudioRef} autoPlay />

      {/* ── VIDEO CALL LAYOUT ── */}
      {isVideoCall ? (
        <>
          {/* Remote Video (full screen) */}
          {remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black flex items-center justify-center">
              <div className="text-center">
                <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-5xl mx-auto mb-4 overflow-hidden shadow-2xl">
                  {remote?.avatar_url
                    ? <img src={remote.avatar_url} alt="" className="w-full h-full object-cover" />
                    : avatarInitial}
                </div>
                <p className="text-white font-bold text-2xl mb-2">{remote?.full_name}</p>
                <motion.p
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-green-400 text-sm"
                >
                  {stateLabel}
                </motion.p>
              </div>
            </div>
          )}

          {/* Local Video PiP */}
          {localStream && !isCameraOff && (
            <motion.div
              drag
              dragConstraints={{ top: 60, bottom: -100, left: -60, right: 60 }}
              className="absolute top-20 right-4 w-28 h-40 rounded-xl overflow-hidden border-2 border-white shadow-lg z-10 cursor-grab"
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }}
              />
            </motion.div>
          )}

          {/* Gradient overlays */}
          <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

          {/* Top bar */}
          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 inset-x-0 flex items-center justify-between px-5 pt-12 pb-4 z-20"
              >
                <div>
                  <p className="text-white font-bold text-lg">{remote?.full_name}</p>
                  <p className="text-green-400 text-sm font-mono">{stateLabel}</p>
                </div>
                <button
                  onClick={() => setMinimized(true)}
                  className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <FiMinimize2 size={16} className="text-white" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        /* ── AUDIO CALL LAYOUT ── */
        <div className="flex-1 bg-gradient-to-b from-gray-900 via-gray-900 to-black flex flex-col items-center justify-center">
          {/* Animated rings */}
          <div className="relative mb-8">
            {callState !== 'active' && [0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="absolute inset-0 rounded-full border border-green-400/30"
                animate={{ scale: [1, 2.5], opacity: [0.5, 0] }}
                transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
              />
            ))}
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-teal-600 flex items-center justify-center text-white font-bold text-5xl overflow-hidden shadow-2xl">
              {remote?.avatar_url
                ? <img src={remote.avatar_url} alt="" className="w-full h-full object-cover" />
                : avatarInitial}
            </div>
          </div>

          <p className="text-white font-bold text-2xl mb-1">{remote?.full_name}</p>
          <motion.p
            animate={callState !== 'active' ? { opacity: [1, 0.4, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-green-400 text-lg font-mono mb-2"
          >
            {stateLabel}
          </motion.p>
          <p className="text-gray-500 text-sm mb-2">
            VipChat {callType === 'video' ? 'Video' : 'Voice'} Call
          </p>

          {/* Encryption badge */}
          <div className="flex items-center gap-1.5 bg-gray-800/60 rounded-full px-3 py-1.5 mt-2">
            <svg className="w-3 h-3 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
            </svg>
            <span className="text-green-400 text-xs font-medium">End-to-end encrypted</span>
          </div>
        </div>
      )}

      {/* ── CONTROL BAR ── */}
      <AnimatePresence>
        {(showControls || !isVideoCall) && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="relative z-20 pb-10 pt-4 px-8"
          >
            {/* Top controls row */}
            <div className="flex items-center justify-around mb-6">
              {/* Speaker */}
              <ControlButton
                icon={isSpeakerOn ? FiVolume2 : FiVolumeX}
                label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
                onClick={() => setSpeakerOn(!isSpeakerOn)}
                active={isSpeakerOn}
                size="sm"
              />

              {/* Flip camera (video only) */}
              {isVideoCall && (
                <ControlButton
                  icon={FiRefreshCw}
                  label="Flip"
                  onClick={onFlipCamera}
                  size="sm"
                />
              )}

              {/* Minimize (video only) */}
              {isVideoCall && (
                <ControlButton
                  icon={FiMinimize2}
                  label="Minimize"
                  onClick={() => setMinimized(true)}
                  size="sm"
                />
              )}
            </div>

            {/* Main controls row */}
            <div className="flex items-center justify-around">
              {/* Mute */}
              <ControlButton
                icon={isMuted ? FiMicOff : FiMic}
                label={isMuted ? 'Unmute' : 'Mute'}
                onClick={onToggleMute}
                danger={isMuted}
              />

              {/* End Call */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
                onClick={onEndCall}
                className="w-20 h-20 rounded-full bg-red-500 flex flex-col items-center justify-center shadow-2xl gap-1"
              >
                <FiPhoneOff size={30} className="text-white" />
              </motion.button>

              {/* Camera toggle (video call) or placeholder */}
              {isVideoCall ? (
                <ControlButton
                  icon={isCameraOff ? FiVideoOff : FiVideo}
                  label={isCameraOff ? 'Camera on' : 'Camera off'}
                  onClick={onToggleCamera}
                  danger={isCameraOff}
                />
              ) : (
                <div className="w-16 h-16" /> /* spacer */
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ControlButton({ icon: Icon, label, onClick, danger = false, active = false, size = 'md' }) {
  const sizeClass = size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';
  const iconSize = size === 'sm' ? 18 : 24;

  return (
    <motion.button
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5"
    >
      <div className={`${sizeClass} rounded-full flex items-center justify-center ${
        danger
          ? 'bg-red-500/80'
          : active
          ? 'bg-green-500/80'
          : 'bg-white/20'
      }`}>
        <Icon size={iconSize} className="text-white" />
      </div>
      {label && <span className="text-white/70 text-xs">{label}</span>}
    </motion.button>
  );
}

export default CallScreen;
