import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiPhoneOff, FiVideo } from 'react-icons/fi';

function IncomingCall({ caller, callType, onAccept, onDecline }) {
  const ringtoneRef = useRef(null);

  useEffect(() => {
    // Play ringtone using Web Audio API (no file needed)
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    let playing = true;

    const playBeep = () => {
      if (!playing) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
      setTimeout(() => { if (playing) playBeep(); }, 1500);
    };

    playBeep();
    ringtoneRef.current = { stop: () => { playing = false; ctx.close(); } };

    return () => {
      playing = false;
      try { ctx.close(); } catch {}
    };
  }, []);

  const handleAccept = () => {
    ringtoneRef.current?.stop();
    onAccept();
  };

  const handleDecline = () => {
    ringtoneRef.current?.stop();
    onDecline();
  };

  const avatarInitial = caller?.full_name?.[0]?.toUpperCase() || '?';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -120, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -120, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
      >
        <div className="bg-gray-900 rounded-2xl shadow-2xl overflow-hidden border border-gray-700">
          {/* Top gradient bar */}
          <div className="h-1 bg-gradient-to-r from-green-400 via-teal-400 to-green-400" />

          <div className="p-5">
            {/* Call type label */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {callType === 'video'
                ? <FiVideo size={14} className="text-green-400" />
                : <FiPhone size={14} className="text-green-400" />}
              <span className="text-xs font-semibold text-green-400 uppercase tracking-widest">
                Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
              </span>
            </div>

            {/* Avatar with ripple */}
            <div className="flex justify-center mb-4 relative">
              <div className="relative">
                {/* Ripple rings */}
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-green-400"
                    animate={{ scale: [1, 1.8], opacity: [0.6, 0] }}
                    transition={{
                      duration: 1.5,
                      delay: i * 0.5,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                ))}
                {/* Avatar */}
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white text-3xl font-bold overflow-hidden shadow-lg">
                  {caller?.avatar_url
                    ? <img src={caller.avatar_url} alt="" className="w-full h-full object-cover" />
                    : avatarInitial}
                </div>
              </div>
            </div>

            {/* Name */}
            <p className="text-white font-bold text-xl text-center mb-1">
              {caller?.full_name || 'Unknown'}
            </p>
            <p className="text-gray-400 text-sm text-center mb-6">
              VipChat {callType === 'video' ? 'Video' : 'Voice'} Call
            </p>

            {/* Action Buttons */}
            <div className="flex items-center justify-around">
              {/* Decline */}
              <button
                onClick={handleDecline}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg"
                >
                  <FiPhoneOff size={28} className="text-white" />
                </motion.div>
                <span className="text-gray-400 text-xs font-medium">Decline</span>
              </button>

              {/* Accept Audio (for video calls) */}
              {callType === 'video' && (
                <button
                  onClick={() => { ringtoneRef.current?.stop(); onAccept('audio'); }}
                  className="flex flex-col items-center gap-2"
                >
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    className="w-14 h-14 rounded-full bg-gray-600 flex items-center justify-center shadow-lg"
                  >
                    <FiPhone size={22} className="text-white" />
                  </motion.div>
                  <span className="text-gray-400 text-xs">Audio only</span>
                </button>
              )}

              {/* Accept */}
              <button
                onClick={handleAccept}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg"
                >
                  {callType === 'video'
                    ? <FiVideo size={28} className="text-white" />
                    : <FiPhone size={28} className="text-white" />}
                </motion.div>
                <span className="text-gray-400 text-xs font-medium">Accept</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default IncomingCall;
