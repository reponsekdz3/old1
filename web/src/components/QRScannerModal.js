import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiX, FiDownload, FiShare2, FiRefreshCw, FiCamera, FiStopCircle, FiUserPlus, FiCheck } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../services/store';
import jsQR from 'jsqr';

export default function QRScannerModal({ onClose, onSuccess }) {
  const { user } = useAuthStore();
  const [mode, setMode] = useState('mycode');
  const [myQRCode, setMyQRCode] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [addingSent, setAddingSent] = useState(false);
  const [addDone, setAddDone] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (mode === 'mycode') generateMyQRCode();
    return stopScanning;
  }, [mode]);

  useEffect(() => () => stopScanning(), []);

  const generateMyQRCode = async () => {
    setLoadingQR(true);
    try {
      const { data } = await api.post('/qr/generate');
      setMyQRCode(data);
    } catch {
      toast.error('Failed to generate QR code');
    } finally {
      setLoadingQR(false);
    }
  };

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setScanning(true);
        scanIntervalRef.current = setInterval(scanFrame, 250);
      }
    } catch {
      toast.error('Camera access denied — please enable camera permissions.');
    }
  };

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
    setScanning(false);
  }, []);

  const scanFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) return;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' });
    if (code?.data) handleQRScanned(code.data);
  };

  const handleQRScanned = async (qrData) => {
    stopScanning();
    try {
      const { data } = await api.post('/qr/scan', { qr_data: qrData });
      setScannedUser(data.user);
      if (data.is_contact) {
        toast('Already in your contacts!', { icon: '👥' });
        setAddDone(true);
      }
    } catch {
      toast.error('Invalid QR code');
      setTimeout(startScanning, 1500);
    }
  };

  const sendContactRequest = async () => {
    if (!scannedUser) return;
    setAddingSent(true);
    try {
      await api.post('/contact-requests/send', {
        user_id: scannedUser.user_id || scannedUser.id,
        message: 'Hi! I scanned your QR code and would like to connect.',
      });
      setAddDone(true);
      toast.success('Contact request sent!');
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send request');
    } finally {
      setAddingSent(false);
    }
  };

  const downloadQR = () => {
    if (!myQRCode) return;
    const url = myQRCode.qr_code?.qr_image_url || myQRCode.qr_image_url;
    if (!url) return;
    const link = document.createElement('a');
    link.href = url;
    link.download = `vipchat-qr-${user?.full_name?.replace(/\s/g,'-') || 'code'}.png`;
    link.click();
    toast.success('QR code downloaded');
  };

  const shareQR = async () => {
    const url = myQRCode?.qr_code?.qr_image_url || myQRCode?.qr_image_url;
    if (!url) return;
    if (navigator.share) {
      try {
        const res = await fetch(url);
        const blob = await res.blob();
        const file = new File([blob], 'vipchat-qr.png', { type: 'image/png' });
        await navigator.share({ title: 'My VipChat QR Code', text: `Scan to add ${user?.full_name} on VipChat!`, files: [file] });
      } catch (e) { if (e.name !== 'AbortError') toast.error('Share failed'); }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  const qrImageUrl = myQRCode?.qr_code?.qr_image_url || myQRCode?.qr_image_url;
  const scanCount  = myQRCode?.qr_code?.scan_count ?? myQRCode?.scan_count ?? 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] px-5 py-4 flex items-center justify-between">
          <h3 className="text-white font-bold text-lg">QR Code</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-full transition text-white">
            <FiX size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {[
            { id: 'mycode', label: 'My Code' },
            { id: 'scan',   label: 'Scan' },
          ].map(tab => (
            <button key={tab.id} onClick={() => { setMode(tab.id); setScannedUser(null); setAddDone(false); if (tab.id !== 'scan') stopScanning(); }}
              className={`flex-1 py-3 text-sm font-semibold transition relative ${mode===tab.id ? 'text-[#25D366]' : 'text-gray-400 hover:text-gray-600'}`}>
              {tab.label}
              {mode === tab.id && (
                <motion.div layoutId="qr-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366]" />
              )}
            </button>
          ))}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {mode === 'mycode' ? (
              <motion.div key="mycode" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="space-y-4">
                {loadingQR ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-3">
                    <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
                      className="w-10 h-10 border-3 border-[#25D366] border-t-transparent rounded-full border-[3px]" />
                    <p className="text-gray-400 text-sm">Generating your QR code...</p>
                  </div>
                ) : qrImageUrl ? (
                  <>
                    <div className="flex flex-col items-center">
                      {/* QR frame */}
                      <div className="relative p-1 bg-white rounded-2xl shadow-lg border border-gray-100">
                        <div className="relative">
                          <img src={qrImageUrl} alt="My QR Code" className="w-56 h-56 rounded-xl" />
                          {/* Corner brackets */}
                          {[['top-0 left-0','border-t-2 border-l-2'],['top-0 right-0','border-t-2 border-r-2'],
                            ['bottom-0 left-0','border-b-2 border-l-2'],['bottom-0 right-0','border-b-2 border-r-2']].map(([pos,cls],i) => (
                            <div key={i} className={`absolute ${pos} w-5 h-5 border-[#25D366] ${cls} rounded-sm m-1`} />
                          ))}
                        </div>
                        {/* Center logo */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="w-9 h-9 bg-white rounded-lg shadow flex items-center justify-center">
                            <svg className="w-6 h-6 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2z"/>
                            </svg>
                          </div>
                        </div>
                      </div>

                      <div className="text-center mt-3">
                        <p className="font-bold text-gray-900">{user?.full_name}</p>
                        <p className="text-sm text-gray-400">{user?.phone_number}</p>
                        {user?.country && <p className="text-xs text-gray-400">{user.country}{user.city && `, ${user.city}`}</p>}
                        <p className="text-xs text-[#25D366] font-semibold mt-1">Scanned {scanCount} time{scanCount !== 1 ? 's' : ''}</p>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={downloadQR}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition font-semibold text-sm">
                        <FiDownload size={15} /> Download
                      </button>
                      <button onClick={shareQR}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-50 text-[#25D366] rounded-xl hover:bg-green-100 transition font-semibold text-sm">
                        <FiShare2 size={15} /> Share
                      </button>
                      <button onClick={generateMyQRCode}
                        className="w-10 h-10 flex items-center justify-center bg-gray-100 text-gray-500 rounded-xl hover:bg-gray-200 transition flex-shrink-0">
                        <FiRefreshCw size={15} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400 mb-3">Could not generate QR code</p>
                    <button onClick={generateMyQRCode} className="px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-semibold">
                      Retry
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div key="scan" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} className="space-y-4">
                {scannedUser ? (
                  /* Scanned result */
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white font-bold text-3xl shadow-lg">
                      {scannedUser.avatar_url
                        ? <img src={scannedUser.avatar_url} alt="" className="w-full h-full object-cover rounded-full" />
                        : scannedUser.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-900">{scannedUser.full_name}</h4>
                      <p className="text-gray-400 text-sm">{scannedUser.phone_number}</p>
                    </div>
                    {addDone ? (
                      <div className="flex items-center justify-center gap-2 text-[#25D366] font-semibold py-2">
                        <FiCheck size={18} /> Request sent / Already a contact
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={sendContactRequest} disabled={addingSent}
                          className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white rounded-xl font-bold text-sm transition">
                          {addingSent
                            ? <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
                                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                            : <><FiUserPlus size={15} /> Add Contact</>}
                        </button>
                        <button onClick={() => { setScannedUser(null); setAddDone(false); startScanning(); }}
                          className="w-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition">
                          <FiRefreshCw size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ) : !scanning ? (
                  /* Start screen */
                  <div className="text-center py-6 space-y-4">
                    <div className="w-40 h-40 mx-auto rounded-2xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center bg-gray-50">
                      <FiCamera size={36} className="text-gray-300 mb-2" />
                      <p className="text-xs text-gray-400">Point at a VipChat QR</p>
                    </div>
                    <p className="text-sm text-gray-500 max-w-[200px] mx-auto">
                      Scan any VipChat QR code to instantly add that person as a contact
                    </p>
                    <button onClick={startScanning}
                      className="px-8 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white rounded-xl font-bold text-sm transition shadow-lg shadow-green-100 flex items-center gap-2 mx-auto">
                      <FiCamera size={16} /> Start Camera
                    </button>
                  </div>
                ) : (
                  /* Camera view */
                  <div className="relative rounded-2xl overflow-hidden bg-black">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-2xl" style={{ maxHeight: 320 }} />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Scanner overlay */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="relative w-52 h-52">
                        {/* Animated laser */}
                        <motion.div
                          className="absolute left-0 right-0 h-0.5 bg-[#25D366]/80 shadow-lg"
                          style={{ boxShadow:'0 0 8px #25D366' }}
                          animate={{ top: ['10%','90%','10%'] }}
                          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        />
                        {/* Corners */}
                        <div className="absolute top-0 left-0 w-6 h-6 border-t-3 border-l-3 border-[#25D366] rounded-tl-sm border-[3px] border-r-0 border-b-0" />
                        <div className="absolute top-0 right-0 w-6 h-6 border-t-3 border-r-3 border-[#25D366] rounded-tr-sm border-[3px] border-l-0 border-b-0" />
                        <div className="absolute bottom-0 left-0 w-6 h-6 border-b-3 border-l-3 border-[#25D366] rounded-bl-sm border-[3px] border-r-0 border-t-0" />
                        <div className="absolute bottom-0 right-0 w-6 h-6 border-b-3 border-r-3 border-[#25D366] rounded-br-sm border-[3px] border-l-0 border-t-0" />
                        {/* Dim overlay */}
                        <div className="absolute inset-0 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" />
                      </div>
                    </div>

                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <button onClick={stopScanning}
                        className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-semibold shadow-lg transition">
                        <FiStopCircle size={15} /> Stop Scanning
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
