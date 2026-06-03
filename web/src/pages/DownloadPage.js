import React from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { FiSmartphone, FiMessageCircle, FiVideo, FiShield, FiZap, FiUsers } from 'react-icons/fi';

const APP_STORE_URL = 'https://apps.apple.com/app/vipchat';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.vipchat.app';

const FEATURES = [
  { icon: FiMessageCircle, title: 'Real-time Messaging', desc: 'Instant delivery with read receipts and typing indicators.' },
  { icon: FiVideo,         title: 'HD Voice & Video',   desc: 'Crystal-clear calls with WebRTC technology.' },
  { icon: FiShield,        title: 'End-to-End Encrypted', desc: 'Your messages stay between you and your contacts.' },
  { icon: FiZap,           title: 'Fast & Lightweight',  desc: 'Optimized for speed on any network.' },
  { icon: FiUsers,         title: 'Groups & Channels',   desc: 'Connect with communities and broadcast channels.' },
  { icon: FiSmartphone,    title: 'Cross-Platform',      desc: 'Available on iOS, Android, and Web.' },
];

export default function DownloadPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#075E54] via-[#128C7E] to-[#25D366] flex flex-col items-center justify-center px-4 py-12 font-sans">

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-16 h-16 rounded-2xl bg-white/20 border-2 border-white/40 flex items-center justify-center shadow-xl">
            <svg className="w-9 h-9 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
            </svg>
          </div>
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-2 tracking-tight">Get VipChat</h1>
        <p className="text-white/80 text-lg max-w-sm mx-auto leading-relaxed">
          Fast, private messaging for everyone. Download the app today.
        </p>
      </motion.div>

      {/* Download card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md mb-8">

        <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">Download VipChat</h2>

        {/* Store buttons */}
        <div className="space-y-3 mb-8">
          <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 bg-black text-white rounded-2xl px-5 py-4 hover:bg-gray-900 transition group w-full">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current flex-shrink-0">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
            </svg>
            <div className="flex-1">
              <p className="text-xs text-gray-300 leading-none mb-0.5">Download on the</p>
              <p className="text-lg font-bold leading-none">App Store</p>
            </div>
            <svg className="w-5 h-5 text-gray-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>

          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-4 bg-black text-white rounded-2xl px-5 py-4 hover:bg-gray-900 transition group w-full">
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-current flex-shrink-0">
              <path d="M3.18 23.76c.3.17.64.24.99.2l12.6-7.17-2.68-2.68-10.91 9.65zM.55 1.12C.2 1.5 0 2.08 0 2.82v18.36c0 .74.2 1.32.55 1.7l.09.09L10.39 12.9v-.22L.64 1.03l-.09.09zM20.5 10.56L17.29 8.7l-3.03 3.03 3.03 3.03L20.5 13.5c.86-.49.86-1.46 0-1.94zM3.18.24l10.91 9.65 2.68-2.68L4.17.04C3.83 0 3.48.07 3.18.24z"/>
            </svg>
            <div className="flex-1">
              <p className="text-xs text-gray-300 leading-none mb-0.5">Get it on</p>
              <p className="text-lg font-bold leading-none">Google Play</p>
            </div>
            <svg className="w-5 h-5 text-gray-500 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-gray-400 text-sm">or scan to download</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* QR Code */}
        <div className="flex flex-col items-center gap-3">
          <div className="bg-white p-4 rounded-2xl border-2 border-[#25D366]/30 shadow-lg inline-flex relative">
            <QRCodeSVG
              value={window.location.origin + '/download'}
              size={160}
              level="H"
              fgColor="#075E54"
              bgColor="#fff"
              includeMargin={false}
            />
            {/* Center logo */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow border border-gray-100">
                <svg className="w-5 h-5 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
                </svg>
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500 text-center">
            Point your phone camera at this code to open the download page
          </p>
        </div>
      </motion.div>

      {/* Features grid */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
        className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-md mb-8">
        {FEATURES.map((f, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}
            className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 border border-white/20">
            <f.icon size={20} className="text-white mb-2" />
            <p className="text-white font-semibold text-xs leading-tight mb-1">{f.title}</p>
            <p className="text-white/70 text-[10px] leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Web link */}
      <p className="text-white/60 text-sm text-center">
        Prefer the browser?{' '}
        <a href="/login" className="text-white font-semibold underline underline-offset-2 hover:text-white/80 transition">
          Open VipChat Web
        </a>
      </p>
    </div>
  );
}
