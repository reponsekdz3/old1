import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiRefreshCw, FiZap, FiGrid, FiClock, FiVideo, FiCamera,
  FiSettings, FiSun, FiMoon, FiCheck, FiDownload, FiImage, FiChevronLeft,
  FiZoomIn, FiAlertCircle,
} from 'react-icons/fi';
import { MdFlipCameraAndroid, MdQrCode2, MdPortrait, MdSlowMotionVideo } from 'react-icons/md';

const FILTERS = [
  { id: 'normal',  label: 'Normal',  css: 'none' },
  { id: 'vivid',   label: 'Vivid',   css: 'saturate(1.9) contrast(1.1)' },
  { id: 'mono',    label: 'Mono',    css: 'grayscale(1) contrast(1.15)' },
  { id: 'warm',    label: 'Warm',    css: 'sepia(0.45) saturate(1.4) brightness(1.05)' },
  { id: 'cool',    label: 'Cool',    css: 'hue-rotate(20deg) saturate(1.15) brightness(1.02)' },
  { id: 'fade',    label: 'Fade',    css: 'contrast(0.82) brightness(1.15) saturate(0.85)' },
  { id: 'cinema',  label: 'Cinema',  css: 'contrast(1.25) saturate(0.75) brightness(0.92)' },
  { id: 'neon',    label: 'Neon',    css: 'saturate(2.2) hue-rotate(30deg) contrast(1.1) brightness(1.05)' },
  { id: 'golden',  label: 'Golden',  css: 'sepia(0.6) saturate(1.6) hue-rotate(-10deg)' },
  { id: 'drama',   label: 'Drama',   css: 'contrast(1.4) saturate(0.6) brightness(0.85) grayscale(0.3)' },
];

const MODES = [
  { id: 'PHOTO',    label: 'Photo',    icon: FiCamera },
  { id: 'VIDEO',    label: 'Video',    icon: FiVideo },
  { id: 'PORTRAIT', label: 'Portrait', icon: MdPortrait },
  { id: 'QR',       label: 'Scan QR',  icon: MdQrCode2 },
  { id: 'SLOW',     label: 'Slow-Mo',  icon: MdSlowMotionVideo },
];

const TIMERS = [0, 3, 5, 10];

function fmtDuration(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

function FilterSwatch({ f, active, onClick }) {
  return (
    <button onClick={onClick} className="flex-shrink-0 flex flex-col items-center gap-1 focus:outline-none">
      <div className={`w-14 h-14 rounded-2xl overflow-hidden border-3 transition-all ${active ? 'border-yellow-400 scale-110 shadow-lg shadow-yellow-400/30' : 'border-transparent opacity-70'}`}
        style={{ borderWidth: active ? 3 : 2, borderColor: active ? '#facc15' : 'transparent' }}>
        <div className="w-full h-full"
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 40%, #f093fb 70%, #f5576c 100%)',
            filter: f.css !== 'none' ? f.css : undefined,
          }}
        />
      </div>
      <span className={`text-[10px] font-bold ${active ? 'text-yellow-400' : 'text-white/60'}`}>{f.label}</span>
    </button>
  );
}

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const streamRef  = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef  = useRef([]);
  const timerIntRef = useRef(null);
  const recIntRef   = useRef(null);
  const qrIntRef    = useRef(null);
  const pinchRef    = useRef({ distance: 0, baseZoom: 1 });

  const [facingMode, setFacingMode]     = useState('environment');
  const [mode, setMode]                 = useState('PHOTO');
  const [recording, setRecording]       = useState(false);
  const [recDuration, setRecDuration]   = useState(0);
  const [preview, setPreview]           = useState(null);
  const [previewBlob, setPreviewBlob]   = useState(null);
  const [previewType, setPreviewType]   = useState('image');
  const [filter, setFilter]             = useState('normal');
  const [flash, setFlash]               = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [grid, setGrid]                 = useState(false);
  const [timerVal, setTimerVal]         = useState(0);
  const [timerCount, setTimerCount]     = useState(null);
  const [zoom, setZoom]                 = useState(1);
  const [maxZoom, setMaxZoom]           = useState(8);
  const [exposure, setExposure]         = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [aspectRatio, setAspectRatio]   = useState('9:16');
  const [cameraReady, setCameraReady]   = useState(false);
  const [permDenied, setPermDenied]     = useState(false);
  const [noCamera, setNoCamera]         = useState(false);
  const [flipping, setFlipping]         = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);
  const [qrResult, setQrResult]         = useState(null);
  const [focusSpot, setFocusSpot]       = useState(null);
  const [zoomChanging, setZoomChanging] = useState(false);

  const startCamera = useCallback(async (facing, withAudio = false) => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());

    // Camera requires HTTPS (except localhost)
    if (!navigator.mediaDevices?.getUserMedia) {
      setNoCamera(true);
      return;
    }

    const tryGetCamera = async (constraints) => {
      return navigator.mediaDevices.getUserMedia(constraints);
    };

    try {
      let stream;
      try {
        stream = await tryGetCamera({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: withAudio,
        });
      } catch (firstErr) {
        if (firstErr.name === 'OverconstrainedError' || firstErr.name === 'ConstraintNotSatisfiedError') {
          // Retry without resolution constraints (older iOS devices)
          stream = await tryGetCamera({ video: { facingMode: facing }, audio: withAudio });
        } else {
          throw firstErr;
        }
      }

      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const vt = stream.getVideoTracks()[0];
      const caps = vt?.getCapabilities?.();
      if (caps?.zoom) setMaxZoom(Math.min(caps.zoom.max, 10));
      // Detect torch support (Android Chrome; not available on iOS Safari)
      setTorchSupported(!!(caps?.torch));
      setCameraReady(true);
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') setPermDenied(true);
    }
  }, []);

  useEffect(() => {
    startCamera(facingMode, mode === 'VIDEO' || mode === 'SLOW');
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
      clearInterval(timerIntRef.current);
      clearInterval(recIntRef.current);
      clearInterval(qrIntRef.current);
    };
  }, []);

  useEffect(() => {
    if (!streamRef.current || !torchSupported) return;
    const vt = streamRef.current.getVideoTracks()[0];
    try { vt?.applyConstraints({ advanced: [{ torch: flash }] }); } catch {}
  }, [flash, torchSupported]);

  useEffect(() => {
    if (!streamRef.current) return;
    const vt = streamRef.current.getVideoTracks()[0];
    const caps = vt?.getCapabilities?.();
    if (caps?.zoom) { try { vt.applyConstraints({ advanced: [{ zoom }] }); } catch {} }
  }, [zoom]);

  useEffect(() => {
    if (mode === 'QR') startQrScan();
    else { clearInterval(qrIntRef.current); setQrResult(null); }
  }, [mode]);

  const startQrScan = () => {
    clearInterval(qrIntRef.current);
    qrIntRef.current = setInterval(async () => {
      if (!videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      if ('BarcodeDetector' in window) {
        try {
          const detector = new window.BarcodeDetector({ formats: ['qr_code', 'ean_13', 'code_128', 'data_matrix'] });
          const codes = await detector.detect(canvas);
          if (codes.length > 0) {
            setQrResult(codes[0].rawValue);
            clearInterval(qrIntRef.current);
          }
        } catch {}
      }
    }, 500);
  };

  const flipCamera = async () => {
    if (flipping) return;
    setFlipping(true);
    const next = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(next);
    setFlash(false);
    await startCamera(next, mode === 'VIDEO' || mode === 'SLOW');
    setTimeout(() => setFlipping(false), 350);
  };

  const handleTap = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setFocusSpot({ x, y });
    setTimeout(() => setFocusSpot(null), 1200);
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchRef.current = { distance: Math.hypot(dx, dy), baseZoom: zoom };
    }
  };
  const handleTouchMove = (e) => {
    if (e.touches.length !== 2) return;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    const scale = Math.hypot(dx, dy) / pinchRef.current.distance;
    const nz = Math.max(1, Math.min(maxZoom, pinchRef.current.baseZoom * scale));
    setZoom(Math.round(nz * 10) / 10);
    setZoomChanging(true);
    setTimeout(() => setZoomChanging(false), 1500);
  };

  const capturePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1920;
    canvas.height = video.videoHeight || 1080;
    const ctx = canvas.getContext('2d');
    const f = FILTERS.find(f => f.id === filter);
    const expBright = 1 + exposure * 0.25;
    const cssFilter = [f?.css !== 'none' ? f?.css : '', `brightness(${expBright})`].filter(Boolean).join(' ');
    ctx.filter = cssFilter || 'none';
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.filter = 'none';
    canvas.toBlob(blob => {
      setPreview(URL.createObjectURL(blob));
      setPreviewBlob(blob);
      setPreviewType('image');
    }, 'image/jpeg', 0.93);
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 160);
  }, [filter, exposure, facingMode]);

  const triggerCapture = () => {
    if (timerCount !== null) return;
    if (timerVal === 0) {
      return mode === 'VIDEO' || mode === 'SLOW' ? toggleRecord() : capturePhoto();
    }
    let c = timerVal;
    setTimerCount(c);
    timerIntRef.current = setInterval(() => {
      c--;
      if (c <= 0) {
        clearInterval(timerIntRef.current);
        setTimerCount(null);
        mode === 'VIDEO' || mode === 'SLOW' ? toggleRecord() : capturePhoto();
      } else { setTimerCount(c); }
    }, 1000);
  };

  const toggleRecord = useCallback(() => {
    if (!streamRef.current) return;
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      clearInterval(recIntRef.current);
    } else {
      chunksRef.current = [];
      // iOS Safari supports video/mp4; Android Chrome supports webm/vp9
      const preferredTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
      ];
      const mimeType = preferredTypes.find(t => MediaRecorder.isTypeSupported(t)) || '';
      const rec = new MediaRecorder(streamRef.current, { mimeType });
      rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' });
        setPreview(URL.createObjectURL(blob));
        setPreviewBlob(blob);
        setPreviewType('video');
        setRecDuration(0);
      };
      rec.start(100);
      recorderRef.current = rec;
      setRecording(true);
      setRecDuration(0);
      recIntRef.current = setInterval(() => setRecDuration(d => d + 1), 1000);
    }
  }, [recording]);

  const sendCapture = () => {
    if (!previewBlob) return;
    const ext = previewType === 'video' ? 'webm' : 'jpg';
    const file = new File([previewBlob], `capture_${Date.now()}.${ext}`, {
      type: previewType === 'video' ? 'video/webm' : 'image/jpeg',
    });
    onCapture(file, previewType);
    onClose();
  };
  const retake = () => { setPreview(null); setPreviewBlob(null); };

  const filterObj = FILTERS.find(f => f.id === filter) || FILTERS[0];
  const expBright = exposure !== 0 ? ` brightness(${1 + exposure * 0.25})` : '';
  const videoFilter = filterObj.css !== 'none' ? `${filterObj.css}${expBright}` : expBright || 'none';

  if (noCamera) return (
    <div className="fixed inset-0 bg-black z-[999] flex flex-col items-center justify-center text-white text-center p-10">
      <FiAlertCircle size={56} className="mb-4 text-yellow-400" />
      <h2 className="text-2xl font-black mb-2">Camera Unavailable</h2>
      <p className="text-gray-400 mb-4 text-sm leading-relaxed">
        Camera access requires a secure (HTTPS) connection.<br />
        Try opening the app from its published URL.
      </p>
      <button onClick={onClose} className="px-8 py-3 bg-white text-black font-bold rounded-2xl text-sm">Close</button>
    </div>
  );

  if (permDenied) return (
    <div className="fixed inset-0 bg-black z-[999] flex flex-col items-center justify-center text-white text-center p-10">
      <FiAlertCircle size={56} className="mb-4 text-red-400" />
      <h2 className="text-2xl font-black mb-2">Camera Access Denied</h2>
      <p className="text-gray-400 mb-3 text-sm leading-relaxed">
        Please allow camera permission in your browser settings, then reload.
      </p>
      <p className="text-gray-500 mb-6 text-xs">
        iOS: Settings → Safari → Camera → Allow<br />
        Android: Settings → Apps → Browser → Permissions → Camera
      </p>
      <button onClick={onClose} className="px-8 py-3 bg-white text-black font-bold rounded-2xl text-sm">Close</button>
    </div>
  );

  if (preview) return (
    <div className="fixed inset-0 bg-black z-[999] flex flex-col">
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <button onClick={retake} className="flex items-center gap-2 text-white font-semibold text-sm">
          <FiChevronLeft size={22} /> Retake
        </button>
        <span className="text-white font-bold text-base">Preview</span>
        <button onClick={sendCapture} className="bg-green-500 text-white font-bold px-5 py-2 rounded-2xl text-sm flex items-center gap-2">
          <FiCheck size={16} /> Send
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center overflow-hidden bg-black">
        {previewType === 'image'
          ? <img src={preview} alt="" className="max-w-full max-h-full object-contain" />
          : <video src={preview} controls autoPlay loop playsInline className="max-w-full max-h-full" />
        }
      </div>
      <div className="px-5 pb-10 pt-4 flex gap-3">
        <button onClick={() => {
          const ext = previewBlob?.type?.includes('mp4') ? 'mp4' : previewType === 'video' ? 'webm' : 'jpg';
          const a = document.createElement('a');
          a.href = preview;
          a.download = `vipchat_${Date.now()}.${ext}`;
          a.click();
        }} className="flex-1 border border-white/30 text-white py-3.5 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-white/10 transition">
          <FiDownload size={16} /> Save to Device
        </button>
        <button onClick={sendCapture} className="flex-1 bg-green-500 text-white py-3.5 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-green-600 transition">
          <FiCheck size={16} /> Send to Chat
        </button>
      </div>
    </div>
  );

  const isVideo = mode === 'VIDEO' || mode === 'SLOW';

  return (
    <div className="fixed inset-0 bg-black z-[999] flex flex-col select-none overflow-hidden"
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>

      <canvas ref={canvasRef} className="hidden" />

      {/* ── Top bar ───────────────────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-12 pb-4 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={onClose} className="w-10 h-10 flex items-center justify-center">
          <FiX size={26} className="text-white drop-shadow-lg" />
        </button>

        <div className="flex items-center gap-2">
          <button onClick={() => setTimerVal(v => TIMERS[(TIMERS.indexOf(v) + 1) % TIMERS.length])}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${timerVal > 0 ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : 'bg-white/15 backdrop-blur-sm'}`}>
            {timerVal > 0
              ? <span className="text-black font-black text-xs">{timerVal}s</span>
              : <FiClock size={17} className="text-white" />}
          </button>

          {torchSupported && facingMode === 'environment' && (
            <button onClick={() => setFlash(f => !f)}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${flash ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50' : 'bg-white/15 backdrop-blur-sm'}`}>
              <FiZap size={17} className={flash ? 'text-black' : 'text-white'} fill={flash ? 'currentColor' : 'none'} />
            </button>
          )}

          <button onClick={() => setGrid(g => !g)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${grid ? 'bg-white/40 backdrop-blur-sm' : 'bg-white/15 backdrop-blur-sm'}`}>
            <FiGrid size={17} className="text-white" />
          </button>

          <button onClick={() => setShowSettings(s => !s)}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${showSettings ? 'bg-white/40' : 'bg-white/15 backdrop-blur-sm'}`}>
            <FiSettings size={17} className="text-white" />
          </button>
        </div>
      </div>

      {/* ── Settings drawer ────────────────────────────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ opacity: 0, x: 80 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 80 }}
            className="absolute top-24 right-4 z-30 bg-black/85 backdrop-blur-xl rounded-3xl p-5 w-56 border border-white/10 shadow-2xl">
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Camera Settings</p>

            <div className="mb-4">
              <p className="text-[10px] text-gray-400 mb-2 font-semibold">Aspect Ratio</p>
              <div className="grid grid-cols-4 gap-1">
                {['9:16','4:3','1:1','16:9'].map(r => (
                  <button key={r} onClick={() => setAspectRatio(r)}
                    className={`py-1.5 rounded-xl text-[10px] font-bold transition ${aspectRatio === r ? 'bg-white text-black shadow' : 'bg-white/10 text-white/70'}`}>{r}</button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-400 font-semibold">Exposure</p>
                <span className="text-[10px] text-white/80 font-bold">{exposure > 0 ? `+${exposure}` : exposure}</span>
              </div>
              <div className="flex items-center gap-2">
                <FiMoon size={12} className="text-blue-300 flex-shrink-0" />
                <input type="range" min={-2} max={2} step={0.5} value={exposure}
                  onChange={e => setExposure(parseFloat(e.target.value))}
                  className="flex-1 accent-yellow-400 h-1" />
                <FiSun size={12} className="text-yellow-300 flex-shrink-0" />
              </div>
            </div>

            <div className="mb-2">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-[10px] text-gray-400 font-semibold flex items-center gap-1"><FiZoomIn size={10} /> Zoom</p>
                <span className="text-[10px] text-white font-black">{zoom.toFixed(1)}×</span>
              </div>
              <input type="range" min={1} max={maxZoom} step={0.1} value={zoom}
                onChange={e => { setZoom(parseFloat(e.target.value)); setZoomChanging(true); setTimeout(() => setZoomChanging(false), 1000); }}
                className="w-full accent-white h-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Viewfinder ────────────────────────────────────────────────── */}
      <motion.div className="flex-1 relative overflow-hidden bg-black cursor-crosshair"
        animate={{ rotateY: flipping ? 90 : 0 }} transition={{ duration: 0.18 }}
        onClick={handleTap}>

        <video ref={videoRef} playsInline muted autoPlay
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            filter: videoFilter !== 'none' ? videoFilter : undefined,
            transform: `scaleX(${facingMode === 'user' ? -1 : 1})`,
            transition: 'filter 0.2s ease',
          }}
        />

        {/* Portrait depth-of-field simulation */}
        {mode === 'PORTRAIT' && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0" style={{ backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }} />
            <div className="absolute left-[20%] right-[20%] top-[10%] bottom-[30%] rounded-[50%]"
              style={{ backdropFilter: 'blur(0)', WebkitBackdropFilter: 'blur(0)', background: 'transparent',
                boxShadow: '0 0 0 2000px rgba(0,0,0,0.001)' }} />
            <div className="absolute left-[20%] right-[20%] top-[10%] h-[58%] rounded-[50%] border-2 border-white/25" />
          </div>
        )}

        {/* Slow-mo indicator */}
        {mode === 'SLOW' && !recording && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/20">
            <span className="text-white text-xs font-bold">🐢 SLOW MOTION</span>
          </div>
        )}

        {/* Capture flash */}
        {captureFlash && <div className="absolute inset-0 bg-white z-20 pointer-events-none" />}

        {/* Grid overlay */}
        {grid && (
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.25) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.25) 1px,transparent 1px)',
            backgroundSize: '33.333% 33.333%',
          }} />
        )}

        {/* Focus ring */}
        <AnimatePresence>
          {focusSpot && (
            <motion.div className="absolute pointer-events-none"
              style={{ left: `${focusSpot.x}%`, top: `${focusSpot.y}%`, transform: 'translate(-50%,-50%)' }}
              initial={{ opacity: 1, scale: 1.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.4 }}>
              <div className="w-16 h-16 border-2 border-yellow-400 rounded-sm">
                <div className="absolute -top-0.5 -left-0.5 w-3 h-3 border-t-2 border-l-2 border-yellow-400" />
                <div className="absolute -top-0.5 -right-0.5 w-3 h-3 border-t-2 border-r-2 border-yellow-400" />
                <div className="absolute -bottom-0.5 -left-0.5 w-3 h-3 border-b-2 border-l-2 border-yellow-400" />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-b-2 border-r-2 border-yellow-400" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Timer countdown */}
        <AnimatePresence>
          {timerCount !== null && (
            <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
              <motion.span key={timerCount}
                initial={{ scale: 1.8, opacity: 1 }} animate={{ scale: 0.4, opacity: 0 }}
                transition={{ duration: 0.85 }}
                className="font-black text-white select-none"
                style={{ fontSize: 140, textShadow: '0 0 30px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.5)' }}>
                {timerCount}
              </motion.span>
            </div>
          )}
        </AnimatePresence>

        {/* Recording indicator */}
        {recording && (
          <div className="absolute top-24 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 z-10">
            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}
              className="w-2.5 h-2.5 bg-red-500 rounded-full" />
            <span className="text-white text-xs font-bold tracking-wide">{fmtDuration(recDuration)}</span>
          </div>
        )}

        {/* Zoom badge */}
        <AnimatePresence>
          {(zoom > 1 || zoomChanging) && (
            <motion.div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm px-4 py-1.5 rounded-full z-10"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}>
              <span className="text-white text-sm font-black">{zoom.toFixed(1)}×</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick zoom presets */}
        <div className="absolute bottom-4 left-4 flex flex-col gap-1 z-10">
          {[1, 2, 5].filter(z => z <= maxZoom).map(z => (
            <button key={z} onClick={e => { e.stopPropagation(); setZoom(z); setZoomChanging(true); setTimeout(() => setZoomChanging(false), 1000); }}
              className="w-8 h-8 bg-black/50 backdrop-blur-sm border border-white/20 rounded-full text-white text-[11px] font-bold hover:bg-white/20 transition">
              {z}×
            </button>
          ))}
        </div>

        {/* QR result */}
        <AnimatePresence>
          {qrResult && (
            <motion.div className="absolute inset-x-4 bottom-4 bg-white rounded-3xl p-4 z-20 shadow-2xl"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}>
              <div className="flex items-start gap-3">
                <MdQrCode2 size={28} className="text-[#075E54] flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">QR Code Detected</p>
                  <p className="text-sm font-semibold text-gray-800 break-all">{qrResult}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                {qrResult.startsWith('http') && (
                  <button onClick={() => window.open(qrResult, '_blank')}
                    className="flex-1 bg-[#075E54] text-white py-2 rounded-xl text-xs font-bold">Open URL</button>
                )}
                <button onClick={() => { navigator.clipboard?.writeText(qrResult); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold">Copy</button>
                <button onClick={() => { setQrResult(null); startQrScan(); }}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-bold">Scan Again</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR scan frame */}
        {mode === 'QR' && !qrResult && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 relative">
              {[['top-0 left-0', 'border-t-2 border-l-2'], ['top-0 right-0', 'border-t-2 border-r-2'],
                ['bottom-0 left-0', 'border-b-2 border-l-2'], ['bottom-0 right-0', 'border-b-2 border-r-2']].map(([pos, bord]) => (
                <div key={pos} className={`absolute ${pos} w-8 h-8 ${bord} border-white/90`} />
              ))}
              <motion.div className="absolute left-0 right-0 h-0.5 bg-red-400/80"
                animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }} />
            </div>
            <p className="absolute bottom-28 text-white/70 text-xs font-medium">Point at a QR code or barcode</p>
          </div>
        )}
      </motion.div>

      {/* ── Mode selector ────────────────────────────────────────────── */}
      <div className="bg-black pt-3 pb-1">
        <div className="flex items-center justify-center gap-1 overflow-x-auto no-scrollbar px-4">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-[11px] font-black uppercase tracking-wider transition-all flex-shrink-0 ${mode === m.id ? 'text-yellow-400' : 'text-white/40 hover:text-white/70'}`}>
              <m.icon size={13} />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filters strip ────────────────────────────────────────────── */}
      <div className="bg-black py-3">
        <div className="flex gap-3 px-4 overflow-x-auto no-scrollbar">
          {FILTERS.map(f => (
            <FilterSwatch key={f.id} f={f} active={filter === f.id} onClick={() => setFilter(f.id)} />
          ))}
        </div>
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────── */}
      <div className="bg-black pt-4 px-8 flex items-center justify-between"
        style={{ paddingBottom: 'max(3rem, env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        {/* Gallery placeholder */}
        <button className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-white/10 flex items-center justify-center overflow-hidden hover:bg-white/20 transition">
          <FiImage size={22} className="text-white/50" />
        </button>

        {/* Shutter */}
        <button onClick={triggerCapture} disabled={timerCount !== null || (mode === 'QR')}
          className="relative focus:outline-none active:scale-95 transition-transform">
          {isVideo ? (
            <div className={`w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all duration-300 ${recording ? 'border-red-500' : 'border-white'}`}>
              <motion.div animate={recording ? { scale: [1, 0.9, 1] } : {}} transition={{ repeat: Infinity, duration: 0.6 }}
                className={`transition-all duration-300 ${recording ? 'w-7 h-7 rounded-lg bg-red-500' : 'w-14 h-14 rounded-full bg-red-500'}`} />
            </div>
          ) : mode === 'QR' ? (
            <div className="w-20 h-20 rounded-full border-4 border-white/30 flex items-center justify-center">
              <MdQrCode2 size={32} className="text-white/50" />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full border-4 border-white bg-white/95 shadow-2xl shadow-white/20 flex items-center justify-center hover:bg-white transition">
              <div className="w-16 h-16 rounded-full bg-white" />
            </div>
          )}
        </button>

        {/* Flip */}
        <button onClick={flipCamera} disabled={flipping}
          className="w-14 h-14 rounded-full bg-white/10 border-2 border-white/10 flex items-center justify-center hover:bg-white/20 transition">
          <motion.div animate={{ rotate: flipping ? 180 : 0 }} transition={{ duration: 0.35 }}>
            <MdFlipCameraAndroid size={24} className="text-white" />
          </motion.div>
        </button>
      </div>
    </div>
  );
}
