/**
 * QR Login Modal — scan with the mobile app to log in on web.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  FiX, FiRefreshCw, FiSmartphone, FiCheck, FiAlertCircle, FiWifi,
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';

const POLL_INTERVAL_MS = 2500;
const QR_TTL = 120;

export default function QRLoginModal({ onClose, onSuccess }) {
  const { setUser } = useAuthStore();
  const [session, setSession] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | pending | confirmed | expired | error
  const [timeLeft, setTimeLeft] = useState(QR_TTL);
  const [generating, setGenerating] = useState(false);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const generate = useCallback(async () => {
    setGenerating(true);
    setStatus('loading');
    clearInterval(pollRef.current);
    clearInterval(timerRef.current);
    try {
      const res = await api.post('/auth/qr-session/generate');
      setSession(res.data);
      setTimeLeft(res.data.expires_in || QR_TTL);
      setStatus('pending');

      // Countdown timer
      timerRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(timerRef.current);
            setStatus('expired');
            return 0;
          }
          return t - 1;
        });
      }, 1000);

      // Poll for confirmation
      pollRef.current = setInterval(async () => {
        try {
          const pollRes = await api.get(`/auth/qr-session/status/${res.data.session_id}`);
          if (pollRes.data.status === 'confirmed') {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setStatus('confirmed');
            const { access_token, refresh_token, user } = pollRes.data;
            localStorage.setItem('access_token', access_token);
            localStorage.setItem('refresh_token', refresh_token);
            setUser(user);
            setTimeout(() => {
              onSuccess?.();
              onClose?.();
            }, 1200);
          } else if (pollRes.data.status === 'expired') {
            clearInterval(pollRef.current);
            clearInterval(timerRef.current);
            setStatus('expired');
          }
        } catch {
          // ignore poll errors
        }
      }, POLL_INTERVAL_MS);

    } catch {
      setStatus('error');
    } finally {
      setGenerating(false);
    }
  }, [setUser, onSuccess, onClose]);

  useEffect(() => {
    generate();
    return () => {
      clearInterval(pollRef.current);
      clearInterval(timerRef.current);
    };
  }, []);

  const progress = session ? (timeLeft / (session.expires_in || QR_TTL)) * 100 : 0;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-bold text-gray-900 text-lg">QR Login</h2>
              <p className="text-xs text-gray-500">Scan with VipChat mobile app</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <FiX size={20} />
            </button>
          </div>

          {/* QR Code Area */}
          <div className="flex flex-col items-center">
            {status === 'loading' && (
              <div className="w-48 h-48 flex items-center justify-center">
                <div className="w-10 h-10 border-3 border-[#25D366] border-t-transparent rounded-full animate-spin" />
              </div>
            )}

            {status === 'pending' && session && (
              <>
                <div className="relative">
                  <div className="p-3 bg-white rounded-2xl border-2 border-gray-100 shadow-sm">
                    <QRCodeSVG
                      value={session.qr_data}
                      size={192}
                      fgColor="#075E54"
                      bgColor="#ffffff"
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  {/* Corner decorations */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-3 border-l-3 border-[#25D366] rounded-tl-lg" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-3 border-r-3 border-[#25D366] rounded-tr-lg" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-3 border-l-3 border-[#25D366] rounded-bl-lg" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-3 border-r-3 border-[#25D366] rounded-br-lg" />
                </div>

                {/* Progress bar */}
                <div className="w-full mt-4 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-[#25D366] rounded-full"
                    style={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
                <div className="flex items-center gap-1 mt-2">
                  <FiWifi size={12} className="text-[#25D366] animate-pulse" />
                  <span className="text-xs text-gray-400">
                    Waiting for scan · expires in {timeLeft}s
                  </span>
                </div>
              </>
            )}

            {status === 'confirmed' && (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-48 h-48 flex flex-col items-center justify-center gap-3"
              >
                <div className="w-20 h-20 bg-[#25D366] rounded-full flex items-center justify-center">
                  <FiCheck size={40} className="text-white" strokeWidth={3} />
                </div>
                <p className="text-[#25D366] font-bold text-lg">Logged in!</p>
              </motion.div>
            )}

            {status === 'expired' && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3 bg-gray-50 rounded-2xl">
                <FiAlertCircle size={36} className="text-gray-400" />
                <p className="text-gray-500 text-sm font-medium">QR code expired</p>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="flex items-center gap-1.5 text-[#25D366] text-sm font-semibold hover:underline"
                >
                  <FiRefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                  Generate new code
                </button>
              </div>
            )}

            {status === 'error' && (
              <div className="w-48 h-48 flex flex-col items-center justify-center gap-3 bg-red-50 rounded-2xl">
                <FiAlertCircle size={36} className="text-red-400" />
                <p className="text-red-500 text-sm font-medium">Failed to generate QR</p>
                <button onClick={generate} className="text-red-500 text-sm font-semibold hover:underline flex items-center gap-1">
                  <FiRefreshCw size={14} /> Retry
                </button>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-5 bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
              <FiSmartphone size={14} /> How to scan
            </p>
            <ol className="text-xs text-gray-500 space-y-1 list-none">
              <li className="flex gap-2"><span className="w-4 h-4 bg-[#25D366] text-white rounded-full flex items-center justify-center text-[10px] flex-shrink-0">1</span>Open VipChat on your phone</li>
              <li className="flex gap-2"><span className="w-4 h-4 bg-[#25D366] text-white rounded-full flex items-center justify-center text-[10px] flex-shrink-0">2</span>Go to Settings → QR Login</li>
              <li className="flex gap-2"><span className="w-4 h-4 bg-[#25D366] text-white rounded-full flex items-center justify-center text-[10px] flex-shrink-0">3</span>Point your camera at this QR code</li>
            </ol>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
