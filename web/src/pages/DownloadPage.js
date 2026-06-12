import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import {
  FiSmartphone, FiMessageCircle, FiVideo, FiShield, FiZap,
  FiUsers, FiDownload, FiCheck, FiChevronRight, FiPackage,
  FiStar, FiGlobe, FiMonitor, FiAlertCircle, FiArrowRight,
  FiCopy, FiCheckCircle,
} from 'react-icons/fi';

const FEATURES = [
  { icon: FiMessageCircle, title: 'Real-time Messaging',   desc: 'Instant delivery, read receipts, typing indicators.',  color: '#25D366', bg: '#dcfce7' },
  { icon: FiVideo,         title: 'HD Voice & Video',      desc: 'Crystal-clear calls via WebRTC — no third-party.',     color: '#3b82f6', bg: '#dbeafe' },
  { icon: FiShield,        title: 'End-to-End Encrypted',  desc: 'Zero-knowledge — even we can\'t read your messages.',  color: '#8b5cf6', bg: '#ede9fe' },
  { icon: FiZap,           title: 'Instant & Lightweight', desc: 'Optimized for any network, works even on 2G.',         color: '#f59e0b', bg: '#fef3c7' },
  { icon: FiUsers,         title: 'Groups & Channels',     desc: 'Create communities, broadcast to thousands.',          color: '#ec4899', bg: '#fce7f3' },
  { icon: FiPackage,       title: 'Built-in Marketplace',  desc: 'Buy & sell digital goods without leaving the app.',    color: '#06b6d4', bg: '#cffafe' },
];

const STATS = [
  { label: 'Active Users',    value: '2M+'  },
  { label: 'Messages / Day',  value: '50M+' },
  { label: 'App Rating',      value: '4.9★' },
  { label: 'Countries',       value: '120+' },
];

const ANDROID_STEPS = [
  { num: 1, title: 'Download the APK',      desc: 'Tap the green "Download APK" button above.' },
  { num: 2, title: 'Allow Unknown Sources', desc: 'In Settings → Security → enable "Install unknown apps".' },
  { num: 3, title: 'Open the APK file',     desc: 'Tap the file in your notifications or Files app.' },
  { num: 4, title: 'Install & Launch',      desc: 'Tap Install, open VipChat, and sign in.' },
];

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="flex items-center gap-1 text-xs font-semibold text-[#25D366] hover:text-[#075E54] transition">
      {copied ? <FiCheckCircle size={12} /> : <FiCopy size={12} />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

export default function DownloadPage() {
  const [apkInfo, setApkInfo]           = useState(null);
  const [loadingApk, setLoadingApk]     = useState(true);
  const [deferredPrompt, setDeferred]   = useState(null);
  const [pwaInstalled, setPwaInstalled] = useState(false);
  const [pwaInstalling, setPwaInstalling] = useState(false);
  const [downloading, setDownloading]   = useState(false);
  const [openFeature, setOpenFeature]   = useState(null);
  const pageUrl = typeof window !== 'undefined' ? window.location.origin + '/download' : '';

  useEffect(() => {
    fetch('/api/app/info')
      .then(r => r.json())
      .then(d => setApkInfo(d))
      .catch(() => setApkInfo({ apk_available: false, version: '2.0.0', package: 'com.vipchat.app' }))
      .finally(() => setLoadingApk(false));
  }, []);

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); setDeferred(e); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', () => setPwaInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setPwaInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const installPWA = async () => {
    if (!deferredPrompt) return;
    setPwaInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') { setPwaInstalled(true); setDeferred(null); }
    } finally { setPwaInstalling(false); }
  };

  const downloadApk = () => {
    if (!apkInfo?.apk_available) return;
    setDownloading(true);
    const a = document.createElement('a');
    a.href = '/api/app/download';
    a.download = `VipChat-v${apkInfo?.version || '2.0.0'}.apk`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setDownloading(false), 3000);
  };

  const APP_STORE_URL  = 'https://apps.apple.com/app/vipchat';
  const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.vipchat.app';

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-white font-sans overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#061a14] via-[#0a2820] to-[#0a0f1a]">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full bg-[#25D366]/8 blur-3xl pointer-events-none" />
        <div className="absolute top-40 -left-10 w-64 h-64 rounded-full bg-[#075E54]/15 blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-5 pt-16 pb-20 text-center">
          {/* App icon */}
          <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <div className="inline-flex w-20 h-20 rounded-[22px] bg-gradient-to-br from-[#075E54] to-[#25D366] items-center justify-center shadow-2xl shadow-[#25D366]/25 mb-6 ring-4 ring-[#25D366]/15">
              <svg className="w-11 h-11 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
              </svg>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4">
              Get{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#25D366] to-[#128C7E]">VipChat</span>
            </h1>
            <p className="text-white/55 text-lg sm:text-xl max-w-xl mx-auto leading-relaxed mb-8">
              Encrypted messaging, HD calls, marketplace & more — all in one powerful app. Free forever.
            </p>

            {/* APK availability badge */}
            {loadingApk ? (
              <span className="inline-flex items-center gap-2 text-xs text-white/50 bg-white/8 px-3 py-1.5 rounded-full mb-8">
                <span className="w-3 h-3 border border-white/30 border-t-transparent rounded-full animate-spin" />
                Checking build…
              </span>
            ) : apkInfo?.apk_available ? (
              <span className="inline-flex items-center gap-2 text-xs text-green-300 bg-green-900/35 border border-green-700/30 px-3 py-1.5 rounded-full mb-8 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                v{apkInfo.version} · {apkInfo.apk_size_mb} MB · Ready to download
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-xs text-amber-300 bg-amber-900/25 border border-amber-600/20 px-3 py-1.5 rounded-full mb-8 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                APK build coming soon — PWA &amp; stores available now
              </span>
            )}
          </motion.div>

          {/* ── CTA buttons ── */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3 flex-wrap">

            {/* APK download — primary */}
            <button onClick={downloadApk} disabled={!apkInfo?.apk_available || downloading}
              className={`group relative flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-base transition-all shadow-xl min-w-[220px] justify-center ${
                apkInfo?.apk_available
                  ? 'bg-gradient-to-r from-[#075E54] to-[#25D366] text-white hover:shadow-[#25D366]/30 hover:scale-[1.02] active:scale-[0.99] cursor-pointer'
                  : 'bg-white/10 text-white/35 cursor-not-allowed'
              }`}>
              {downloading
                ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : <FiDownload size={19} />}
              {downloading
                ? 'Starting download…'
                : apkInfo?.apk_available
                  ? `Download APK  (${apkInfo.apk_size_mb} MB)`
                  : 'APK — Coming Soon'}
              {apkInfo?.apk_available && !downloading && (
                <span className="absolute -top-2.5 -right-2.5 bg-[#25D366] text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow">
                  FREE
                </span>
              )}
            </button>

            {/* PWA install (if available) */}
            {!pwaInstalled && deferredPrompt && (
              <button onClick={installPWA} disabled={pwaInstalling}
                className="flex items-center gap-3 px-7 py-4 rounded-2xl font-bold text-base bg-white/10 hover:bg-white/15 border border-white/20 transition hover:scale-[1.02] active:scale-[0.99] min-w-[200px] justify-center">
                {pwaInstalling ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <FiSmartphone size={19} />}
                {pwaInstalling ? 'Installing…' : 'Install as App (PWA)'}
              </button>
            )}
            {pwaInstalled && (
              <span className="flex items-center gap-2 px-7 py-4 rounded-2xl font-bold text-base bg-green-900/35 border border-green-700/30 text-green-300 min-w-[200px] justify-center">
                <FiCheckCircle size={19} /> App Installed!
              </span>
            )}

            {/* Google Play */}
            <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm bg-white/8 hover:bg-white/14 border border-white/15 transition hover:scale-[1.02]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#3ddc84] flex-shrink-0">
                <path d="M3.18 23.76c.3.17.64.24.99.2l12.6-7.17-2.68-2.68-10.91 9.65zM.55 1.12C.2 1.5 0 2.08 0 2.82v18.36c0 .74.2 1.32.55 1.7l.09.09L10.39 12.9v-.22L.64 1.03l-.09.09zM20.5 10.56L17.29 8.7l-3.03 3.03 3.03 3.03L20.5 13.5c.86-.49.86-1.46 0-1.94zM3.18.24l10.91 9.65 2.68-2.68L4.17.04C3.83 0 3.48.07 3.18.24z"/>
              </svg>
              Google Play
            </a>

            {/* App Store */}
            <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-sm bg-white/8 hover:bg-white/14 border border-white/15 transition hover:scale-[1.02]">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white/80 flex-shrink-0">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              App Store
            </a>
          </motion.div>

          {/* Share link strip */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}
            className="mt-7 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm">
            <FiGlobe size={13} className="text-white/35 flex-shrink-0" />
            <span className="text-white/45 truncate max-w-[260px]">{pageUrl}</span>
            <CopyButton text={pageUrl} />
          </motion.div>
        </div>
      </div>

      {/* ── Stats strip ─────────────────────────────── */}
      <div className="bg-white/4 border-y border-white/8">
        <div className="max-w-5xl mx-auto px-5 py-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i + 0.3 }}
              className="text-center py-2">
              <p className="text-2xl sm:text-3xl font-black text-white">{s.value}</p>
              <p className="text-[11px] text-white/35 font-semibold uppercase tracking-widest mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-5 py-14 grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">

        {/* Left column: QR + install guide */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
          className="space-y-6">

          {/* QR code */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8 text-center">
            <p className="text-[11px] font-bold text-white/35 uppercase tracking-widest mb-6">Scan to Open on Mobile</p>
            <div className="inline-block bg-white p-4 rounded-2xl shadow-2xl shadow-black/50 mb-4 relative">
              <QRCodeSVG value={pageUrl} size={176} level="H" fgColor="#075E54" bgColor="#fff" includeMargin={false} />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-md border border-gray-100">
                  <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
                  </svg>
                </div>
              </div>
            </div>
            <p className="text-white/35 text-xs">Point your phone camera at this QR code</p>
          </div>

          {/* Android sideload steps */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-7">
            <div className="flex items-center gap-2.5 mb-6">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-[#3ddc84] flex-shrink-0">
                <path d="M17.523 15.341l1.5-2.598c.089-.154.037-.35-.117-.438-.154-.09-.35-.037-.437.117l-1.521 2.633c-1.153-.529-2.453-.825-3.838-.825s-2.685.295-3.838.824L7.75 12.386c-.087-.155-.283-.207-.437-.117s-.206.284-.117.438l1.5 2.597C6.21 16.57 5 18.343 5 20.4h14c0-2.057-1.21-3.83-3.477-5.059zm-6.077 2.659H9.6v-1.2h1.846v1.2zm4.154 0h-1.846v-1.2H15.6v1.2zm-7.8-9a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6zm8.4 0a1.8 1.8 0 100-3.6 1.8 1.8 0 000 3.6z"/>
              </svg>
              <p className="font-bold text-white">Install APK on Android</p>
            </div>
            <div className="space-y-4">
              {ANDROID_STEPS.map(step => (
                <div key={step.num} className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-[#075E54]/25 border border-[#25D366]/25 text-[#25D366] font-black text-sm flex items-center justify-center flex-shrink-0 mt-0.5">
                    {step.num}
                  </div>
                  <div>
                    <p className="font-semibold text-white text-sm">{step.title}</p>
                    <p className="text-white/45 text-xs mt-0.5 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 bg-amber-950/40 border border-amber-600/20 rounded-xl px-4 py-3 flex gap-2.5">
              <FiAlertCircle size={14} className="text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/70 leading-relaxed">
                Sideloaded APKs require "Install from unknown sources". Our APK is signed, notarized, and malware-scanned.
              </p>
            </div>
          </div>

          {/* iOS PWA steps */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-7">
            <div className="flex items-center gap-2.5 mb-5">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white/65 flex-shrink-0">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
              </svg>
              <p className="font-bold text-white">Add to Home Screen (iPhone)</p>
            </div>
            <div className="space-y-3">
              {['Open VipChat in Safari', 'Tap the Share button (box with ↑ arrow)', 'Scroll down → tap "Add to Home Screen"', 'Tap "Add" — VipChat icon appears on your home'].map((step, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <FiCheck size={14} className="text-[#25D366] mt-0.5 flex-shrink-0" />
                  <p className="text-white/60 text-sm leading-snug">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right column: Features + build info */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 }}
          className="space-y-4">
          <p className="text-[11px] font-bold text-white/30 uppercase tracking-widest mb-5">Everything Included — Free</p>

          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i + 0.3 }}
              onClick={() => setOpenFeature(openFeature === i ? null : i)}
              className="bg-white/5 border border-white/10 rounded-2xl p-5 cursor-pointer hover:bg-white/8 transition-all group">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: f.color + '18', border: `1.5px solid ${f.color}30` }}>
                  <f.icon size={19} style={{ color: f.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">{f.title}</p>
                  <AnimatePresence>
                    {openFeature === i && (
                      <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="text-white/45 text-xs mt-1 leading-relaxed overflow-hidden">
                        {f.desc}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
                <FiChevronRight size={14} className={`text-white/25 transition-transform group-hover:text-white/50 flex-shrink-0 ${openFeature === i ? 'rotate-90' : ''}`} />
              </div>
            </motion.div>
          ))}

          {/* Build info table */}
          {!loadingApk && (
            <div className="bg-white/3 border border-white/8 rounded-2xl px-6 py-5 mt-2">
              <p className="text-[11px] font-bold text-white/25 uppercase tracking-widest mb-4">Build Details</p>
              <div className="grid grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                {[
                  ['Version',    apkInfo?.version || '2.0.0'],
                  ['Package',    apkInfo?.package  || 'com.vipchat.app'],
                  ['Platforms',  'Android · iOS · Web'],
                  ['APK type',   'Universal (ARM64 + x86_64)'],
                  ['Min OS',     'Android 7.0+ / iOS 14+'],
                  ['APK size',   apkInfo?.apk_available ? `${apkInfo.apk_size_mb} MB` : 'Build pending'],
                ].map(([label, val]) => (
                  <React.Fragment key={label}>
                    <span className="text-white/25 font-medium">{label}</span>
                    <span className="text-white/65 font-mono font-semibold truncate">{val}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}

          {/* Desktop CTA */}
          <div className="bg-gradient-to-br from-[#075E54]/25 to-[#25D366]/8 border border-[#25D366]/15 rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-2.5">
              <FiMonitor size={17} className="text-[#25D366]" />
              <p className="font-bold text-white text-sm">Use on Desktop</p>
            </div>
            <p className="text-white/45 text-xs leading-relaxed mb-5">
              Full features in your browser — no download required. Marketplace, calls, file sharing and more.
            </p>
            <a href="/" className="inline-flex items-center gap-2 bg-[#075E54] hover:bg-[#128C7E] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition">
              <FiArrowRight size={13} />Open Web App
            </a>
          </div>
        </motion.div>
      </div>

      {/* ── Footer ─────────────────────────────────── */}
      <div className="border-t border-white/8 py-8 text-center">
        <p className="text-white/25 text-sm">
          © {new Date().getFullYear()} VipChat ·{' '}
          <a href="/login" className="hover:text-white/50 transition">Sign In</a>{' · '}
          <a href="/signup" className="hover:text-white/50 transition">Create Account</a>
        </p>
      </div>
    </div>
  );
}
