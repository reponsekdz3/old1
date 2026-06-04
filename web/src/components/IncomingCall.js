import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPhone, FiPhoneOff, FiVideo, FiMic, FiMicOff } from 'react-icons/fi';
import advancedRinging from '../services/advancedRinging';

function IncomingCall({ caller, callType, onAccept, onDecline }) {
  const [ringing, setRinging] = useState(true);
  const [audioOnly, setAudioOnly] = useState(false);
  const ringStartTime = useRef(Date.now());

  useEffect(() => {
    // Play advanced incoming ringtone
    advancedRinging.playIncomingRingtone();

    return () => {
      advancedRinging.stopAll();
    };
  }, []);

  const handleAccept = (type = callType) => {
    advancedRinging.playConnectedTone();
    setRinging(false);
    onAccept(type);
  };

  const handleDecline = () => {
    advancedRinging.playEndedTone();
    setRinging(false);
    onDecline();
  };

  const avatarInitial = caller?.full_name?.[0]?.toUpperCase() || '?';

  return (
    <AnimatePresence>
      {ringing && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        >
          <motion.div
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            className="w-full max-w-sm mx-4 bg-gradient-to-b from-gray-900 to-gray-800 rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Animated top bar */}
            <div className="relative h-1.5 overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-green-400 via-emerald-400 to-green-400"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>

            {/* Call type badge */}
            <div className="flex items-center justify-center pt-6 pb-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-500/20 rounded-full">
                {callType === 'video' ? (
                  <FiVideo size={14} className="text-green-400" />
                ) : (
                  <FiPhone size={14} className="text-green-400" />
                )}
                <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">
                  Incoming {callType === 'video' ? 'Video' : 'Voice'} Call
                </span>
              </div>
            </div>

            {/* Avatar with pulse animation */}
            <div className="flex justify-center py-4 relative">
              <div className="relative">
                {/* Outer pulse rings */}
                {[0, 1, 2, 3].map(i => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-green-400/50"
                    animate={{
                      scale: [1, 2],
                      opacity: [0.6, 0],
                    }}
                    transition={{
                      duration: 2,
                      delay: i * 0.4,
                      repeat: Infinity,
                      ease: 'easeOut',
                    }}
                  />
                ))}
                
                {/* Avatar */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white text-4xl font-bold overflow-hidden shadow-lg shadow-green-500/30"
                >
                  {caller?.avatar_url ? (
                    <img src={caller.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : avatarInitial}
                </motion.div>

                {/* Ring indicator */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                  className="absolute -top-1 -right-1 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <FiPhone size={14} className="text-white" />
                </motion.div>
              </div>
            </div>

            {/* Caller info */}
            <div className="text-center px-6 pb-6">
              <h2 className="text-2xl font-bold text-white mb-1">
                {caller?.full_name || 'Unknown'}
              </h2>
              <p className="text-gray-400 text-sm">
                VipChat {callType === 'video' ? 'Video' : 'Voice'} Call
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-center gap-6 pb-8 px-6">
              {/* Decline button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleDecline}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5, delay: 0.3 }}
                  className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center shadow-lg shadow-red-500/30"
                >
                  <FiPhoneOff size={28} className="text-white" />
                </motion.div>
                <span className="text-gray-400 text-xs font-medium">Decline</span>
              </motion.button>

              {/* Audio only (for video calls) */}
              {callType === 'video' && (
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleAccept('audio')}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center shadow-lg">
                    <FiMic size={22} className="text-gray-300" />
                  </div>
                  <span className="text-gray-500 text-xs">Audio only</span>
                </motion.button>
              )}

              {/* Accept button */}
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAccept(callType)}
                className="flex flex-col items-center gap-2"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                  className="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30"
                >
                  {callType === 'video' ? (
                    <FiVideo size={28} className="text-white" />
                  ) : (
                    <FiPhone size={28} className="text-white" />
                  )}
                </motion.div>
                <span className="text-gray-400 text-xs font-medium">Accept</span>
              </motion.button>
            </div>

            {/* Swipe up hint */}
            <motion.div
              animate={{ y: [0, -5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-center pb-4"
            >
              <span className="text-xs text-gray-500">Swipe up for more options</span>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default IncomingCall;
