import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiPhoneOff,
  FiVolume2, FiVolumeX, FiRefreshCw,
  FiMinimize2, FiMonitor, FiStopCircle, FiLock,
} from 'react-icons/fi';
import { useCallStore } from '../services/store';
import advancedRinging from '../services/advancedRinging';
import callHistoryManager from '../services/callHistory';
import toast from 'react-hot-toast';

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
  const screenVideoRef = useRef(null);
  const screenTrackRef = useRef(null);
  const [minimized, setMinimized] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimer = useRef(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);

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

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

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

  // Play ringtone
  useEffect(() => {
    if (callState === 'outgoing' || callState === 'ringing') {
      advancedRinging.playOutgoingRingtone();
    } else if (callState === 'active') {
      advancedRinging.playConnectedTone();
    } else if (callState === 'ended') {
      advancedRinging.playEndedTone();
      callHistoryManager.addCall({
        caller_id: caller?.id,
        caller_name: caller?.full_name,
        receiver_id: callee?.id,
        receiver_name: callee?.full_name,
        call_type: callType,
        direction: caller?.id ? 'incoming' : 'outgoing',
        status: 'completed',
        duration: callDuration,
      });
    }
    return () => { advancedRinging.stopAll(); };
  }, [callState, callDuration]);

  // ── Screen Share ────────────────────────────────────────────────────────────
  const startScreenShare = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        toast.error('Screen sharing is not supported in this browser');
        return;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30 },
          cursor: 'always',
        },
        audio: false,
      });

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) { stream.getTracks().forEach(t => t.stop()); return; }

      // Replace camera track with screen track in peer connection
      if (localStream) {
        const senders = window._peerConnection?.getSenders?.();
        const videoSender = senders?.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(videoTrack).catch(() => {});
        }
      }

      screenTrackRef.current = videoTrack;
      setScreenStream(stream);
      setIsScreenSharing(true);
      toast.success('Screen sharing started');

      // Auto-stop when user ends share via browser UI
      videoTrack.onended = () => stopScreenShare(stream);
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        toast.error('Screen share permission denied');
      } else if (err.name === 'NotSupportedError') {
        toast.error('Screen sharing not supported on this device');
      } else {
        console.error('Screen share error:', err);
      }
    }
  }, [localStream]);

  const stopScreenShare = useCallback(async (streamToStop) => {
    const target = streamToStop || screenStream;
    if (target) target.getTracks().forEach(t => t.stop());

    // Restore camera track
    if (localStream) {
      const camTrack = localStream.getVideoTracks()[0];
      if (camTrack) {
        const senders = window._peerConnection?.getSenders?.();
        const videoSender = senders?.find(s => s.track?.kind === 'video' || s.track === null);
        if (videoSender) await videoSender.replaceTrack(camTrack).catch(() => {});
      }
    }

    screenTrackRef.current = null;
    setScreenStream(null);
    setIsScreenSharing(false);
    toast('Screen sharing stopped', { icon: '🖥️' });
  }, [screenStream, localStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (screenStream) screenStream.getTracks().forEach(t => t.stop());
    };
  }, [screenStream]);

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
        {isVideoCall && (isScreenSharing && screenStream ? (
          <video ref={el => { if (el) el.srcObject = screenStream; }} autoPlay playsInline muted className="w-full h-28 object-contain bg-black" />
        ) : remoteStream ? (
          <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-28 object-cover" />
        ) : null) || (
          <div className="w-full h-28 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
              {remote?.avatar_url ? <img src={remote.avatar_url} alt="" className="w-full h-full object-cover" /> : avatarInitial}
            </div>
          </div>
        )}
        <div className="px-3 py-2 flex items-center justify-between">
          <div>
            <p className="text-white text-xs font-semibold truncate">{remote?.full_name}</p>
            <p className="text-green-400 text-xs">{stateLabel}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onEndCall(); }} className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
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
      className="fixed inset-0 z-[90] bg-black flex flex-col overflow-hidden"
      onClick={isVideoCall ? resetControlsTimer : undefined}
    >
      <audio ref={remoteAudioRef} autoPlay />

      {/* ── BACKGROUND BLUR (Premium Look) ── */}
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-black/60 z-10" />
        {remote?.avatar_url ? (
          <img src={remote.avatar_url} alt="" className="w-full h-full object-cover blur-3xl scale-110 opacity-40" />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-green-900/40 to-teal-900/40 blur-3xl opacity-40" />
        )}
      </div>

      {/* ── VIDEO CALL LAYOUT ── */}
      {isVideoCall ? (
        <div className="relative flex-1 z-10">
          {/* Screen share takes full view, remote goes to PiP */}
          {isScreenSharing && screenStream ? (
            <>
              <video
                ref={screenVideoRef}
                autoPlay playsInline muted
                className="absolute inset-0 w-full h-full object-contain bg-black/40"
              />
              {/* Remote video small PiP in top-left */}
              {remoteStream && (
                <motion.div drag dragConstraints={{ top: 60, bottom: -100, left: -60, right: 60 }}
                  className="absolute top-20 left-4 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-10 cursor-grab active:cursor-grabbing backdrop-blur-md">
                  <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                </motion.div>
              )}
              {/* Screen share indicator banner */}
              <div className="absolute top-14 left-1/2 -translate-x-1/2 z-20 bg-red-500/90 backdrop-blur-md text-white text-xs font-bold px-4 py-1.5 rounded-full flex items-center gap-2 shadow-lg border border-white/10">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                Sharing your screen
              </div>
            </>
          ) : (
            <>
              {/* Normal: Remote full screen */}
              {remoteStream ? (
                <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center relative z-10">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="w-32 h-32 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-5xl mx-auto mb-6 overflow-hidden shadow-[0_0_40px_rgba(37,211,102,0.3)] border-2 border-white/20"
                    >
                      {remote?.avatar_url ? <img src={remote.avatar_url} alt="" className="w-full h-full object-cover" /> : avatarInitial}
                    </motion.div>
                    <h2 className="text-white font-bold text-3xl mb-2 drop-shadow-md">{remote?.full_name}</h2>
                    <motion.p animate={{ opacity: [1, 0.4, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-[#25D366] text-lg font-medium tracking-wide drop-shadow-sm">{stateLabel}</motion.p>
                  </div>
                </div>
              )}
              {/* Local PiP */}
              {localStream && !isCameraOff && (
                <motion.div drag dragConstraints={{ top: 60, bottom: -100, left: -60, right: 60 }}
                  className="absolute top-20 right-4 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-10 cursor-grab active:cursor-grabbing backdrop-blur-md">
                  <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />
                </motion.div>
              )}
            </>
          )}

          {/* Gradient overlays for UI visibility */}
          <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" />
          <div className="absolute inset-x-0 bottom-0 h-60 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
        </div>
      ) : (
        /* ── AUDIO CALL LAYOUT ── */
        <div className="relative flex-1 z-10 flex flex-col items-center justify-center">
          <div className="relative mb-10">
            {callState !== 'active' && [0, 1, 2].map(i => (
              <motion.div key={i} className="absolute inset-0 rounded-full border-2 border-[#25D366]/40"
                animate={{ scale: [1, 3], opacity: [0.6, 0] }}
                transition={{ duration: 3, delay: i * 1, repeat: Infinity, ease: 'easeOut' }} />
            ))}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-40 h-40 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white font-bold text-6xl overflow-hidden shadow-[0_0_60px_rgba(37,211,102,0.4)] border-2 border-white/20 relative z-10"
            >
              {remote?.avatar_url ? <img src={remote.avatar_url} alt="" className="w-full h-full object-cover" /> : avatarInitial}
            </motion.div>
          </div>
          <h2 className="text-white font-bold text-3xl mb-2 drop-shadow-md">{remote?.full_name}</h2>
          <motion.p animate={callState !== 'active' ? { opacity: [1, 0.4, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }} className="text-[#25D366] text-xl font-mono mb-4 drop-shadow-sm">
            {stateLabel}
          </motion.p>
          
          <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-4 py-2 mt-4 border border-white/10">
            <FiLock size={14} className="text-[#25D366]" />
            <span className="text-white/80 text-xs font-medium uppercase tracking-widest">End-to-end encrypted</span>
          </div>

          {/* Connection Quality Indicator */}
          {callState === 'active' && (
             <div className="absolute top-14 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/30 backdrop-blur-sm border border-white/5">
                <div className="flex gap-0.5 items-end h-3">
                  <div className="w-1 h-1 bg-green-500 rounded-full" />
                  <div className="w-1 h-2 bg-green-500 rounded-full" />
                  <div className="w-1 h-3 bg-green-500 rounded-full" />
                </div>
                <span className="text-[10px] text-white/60 font-bold uppercase tracking-tighter">HD Secure</span>
             </div>
          )}
        </div>
      )}

      {/* ── CONTROL BAR ── */}
      <AnimatePresence>
        {(showControls || !isVideoCall) && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="relative z-20 pb-10 pt-4 px-8">
            {/* Top controls row */}
            <div className="flex items-center justify-around mb-6">
              <ControlButton icon={isSpeakerOn ? FiVolume2 : FiVolumeX} label={isSpeakerOn ? 'Speaker' : 'Earpiece'}
                onClick={() => setSpeakerOn(!isSpeakerOn)} active={isSpeakerOn} size="sm" />

              {isVideoCall && (
                <ControlButton icon={FiRefreshCw} label="Flip" onClick={onFlipCamera} size="sm" />
              )}

              {/* Screen Share button — available during active calls */}
              {callState === 'active' && (
                <ControlButton
                  icon={isScreenSharing ? FiStopCircle : FiMonitor}
                  label={isScreenSharing ? 'Stop Share' : 'Share Screen'}
                  onClick={() => isScreenSharing ? stopScreenShare() : startScreenShare()}
                  active={isScreenSharing}
                  danger={isScreenSharing}
                  size="sm"
                />
              )}

              {isVideoCall && (
                <ControlButton icon={FiMinimize2} label="Minimize" onClick={() => setMinimized(true)} size="sm" />
              )}
            </div>

            {/* Main controls row */}
            <div className="flex items-center justify-around">
              <ControlButton icon={isMuted ? FiMicOff : FiMic} label={isMuted ? 'Unmute' : 'Mute'}
                onClick={onToggleMute} danger={isMuted} />

              <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }} onClick={onEndCall}
                className="w-20 h-20 rounded-full bg-red-500 flex flex-col items-center justify-center shadow-2xl gap-1">
                <FiPhoneOff size={30} className="text-white" />
              </motion.button>

              {isVideoCall ? (
                <ControlButton icon={isCameraOff ? FiVideoOff : FiVideo}
                  label={isCameraOff ? 'Camera on' : 'Camera off'} onClick={onToggleCamera} danger={isCameraOff} />
              ) : (
                <div className="w-16 h-16" />
              )}
            </div>

            {/* Screen share mobile hint */}
            {!isScreenSharing && callState === 'active' && (
              <p className="text-white/30 text-xs text-center mt-3">
                Tap 🖥️ to share your screen with the other person
              </p>
            )}
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
    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={onClick}
      className="flex flex-col items-center gap-1.5">
      <div className={`${sizeClass} rounded-full flex items-center justify-center ${
        danger ? 'bg-red-500/80' : active ? 'bg-green-500/80' : 'bg-white/20'}`}>
        <Icon size={iconSize} className="text-white" />
      </div>
      {label && <span className="text-white/70 text-xs">{label}</span>}
    </motion.button>
  );
}

export default CallScreen;
