import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiWifiOff, FiWifi, FiX } from 'react-icons/fi';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);
  const [justCameBack, setJustCameBack] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustCameBack(true);
      setShowBanner(true);
      setDismissed(false);
      setTimeout(() => {
        setShowBanner(false);
        setJustCameBack(false);
      }, 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
      setDismissed(false);
      setJustCameBack(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (!navigator.onLine) {
      setShowBanner(true);
    }
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (dismissed || (!showBanner && isOnline)) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ y: -60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-between px-4 py-2.5 text-white text-sm font-semibold shadow-lg ${
            justCameBack ? 'bg-[#25D366]' : 'bg-amber-500'
          }`}
        >
          <div className="flex items-center gap-2">
            {justCameBack
              ? <FiWifi size={16} className="animate-pulse" />
              : <FiWifiOff size={16} />
            }
            {justCameBack
              ? 'Back online — syncing messages...'
              : 'No internet — messages will be sent when reconnected'
            }
          </div>
          {!justCameBack && (
            <button onClick={() => { setDismissed(true); setShowBanner(false); }} className="p-1">
              <FiX size={16} />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
