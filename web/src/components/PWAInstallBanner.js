import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiSmartphone, FiX, FiDownload } from 'react-icons/fi';

export default function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const alreadyDismissed = localStorage.getItem('pwa_banner_dismissed');
    if (alreadyDismissed) return;

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone
      || document.referrer.includes('android-app://');
    if (isStandalone) return;

    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    // iOS Safari — no beforeinstallprompt, show manual instructions
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;
    if (isIOS) {
      const lastShown = localStorage.getItem('pwa_ios_shown_at');
      if (!lastShown || Date.now() - parseInt(lastShown) > 7 * 24 * 60 * 60 * 1000) {
        setTimeout(() => setShow(true), 3000);
      }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_banner_dismissed', '1');
      }
      setDeferredPrompt(null);
      setShow(false);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    localStorage.setItem('pwa_banner_dismissed', '1');
    localStorage.setItem('pwa_ios_shown_at', Date.now().toString());
  };

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.MSStream;

  return (
    <AnimatePresence>
      {show && !dismissed && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 bg-[#075E54] text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-sm mx-auto"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <FiSmartphone size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm">Install VipChat App</p>
            {isIOS
              ? <p className="text-white/70 text-xs mt-0.5">Tap Share → "Add to Home Screen"</p>
              : <p className="text-white/70 text-xs mt-0.5">Works offline · Faster · No browser bar</p>
            }
          </div>
          <div className="flex items-center gap-1.5">
            {!isIOS && (
              <button
                onClick={handleInstall}
                className="flex items-center gap-1 bg-[#25D366] text-white text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-[#1da055] transition"
              >
                <FiDownload size={12} /> Install
              </button>
            )}
            <button onClick={handleDismiss} className="p-1.5 rounded-lg hover:bg-white/10">
              <FiX size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
