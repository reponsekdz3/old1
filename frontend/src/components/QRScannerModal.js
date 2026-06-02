import React, { useState, useEffect, useRef } from 'react';
import { FiX, FiDownload, FiShare2, FiRefreshCw } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../services/store';
import jsQR from 'jsqr';

function QRScannerModal({ onClose, onSuccess }) {
  const { user } = useAuthStore();
  const [mode, setMode] = useState('scan');
  const [myQRCode, setMyQRCode] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    if (mode === 'show') {
      generateMyQRCode();
    }
    return () => {
      stopScanning();
    };
  }, [mode]);

  const generateMyQRCode = async () => {
    try {
      const response = await api.post('/qr/generate');
      setMyQRCode(response.data.qr_code);
    } catch (error) {
      toast.error('Failed to generate QR code');
    }
  };

  const startScanning = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: 640, height: 480 }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setScanning(true);
        
        videoRef.current.onloadedmetadata = () => {
          scanQRCode();
        };
      }
    } catch (error) {
      toast.error('Camera access denied. Please enable camera permissions.');
    }
  };

  const stopScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }
    
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setScanning(false);
  };

  const scanQRCode = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video) return;

    const context = canvas.getContext('2d');
    
    scanIntervalRef.current = setInterval(() => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          handleQRCodeScanned(code.data);
        }
      }
    }, 300);
  };

  const handleQRCodeScanned = async (qrData) => {
    stopScanning();
    
    try {
      const response = await api.post('/qr/scan', { qr_data: qrData });
      const userData = response.data.user;
      
      setScannedUser(userData);
      
      if (response.data.is_contact) {
        toast.success('Already in your contacts!');
      }
    } catch (error) {
      toast.error('Invalid QR code or user not found');
      setTimeout(() => startScanning(), 2000);
    }
  };

  const sendContactRequest = async () => {
    try {
      await api.post('/contact-requests/send', {
        user_id: scannedUser.user_id,
        message: 'Hi! I scanned your QR code and would like to connect.'
      });
      toast.success('Contact request sent!');
      onSuccess && onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to send request');
    }
  };

  const downloadQRCode = async () => {
    if (myQRCode) {
      try {
        const response = await fetch(myQRCode.qr_image_url);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `bitese-qr-${user.full_name}.png`;
        link.click();
        window.URL.revokeObjectURL(url);
        toast.success('QR code downloaded');
      } catch (error) {
        toast.error('Download failed');
      }
    }
  };

  const shareQRCode = async () => {
    if (navigator.share && myQRCode) {
      try {
        const response = await fetch(myQRCode.qr_image_url);
        const blob = await response.blob();
        const file = new File([blob], 'qr-code.png', { type: 'image/png' });
        
        await navigator.share({
          title: 'My Bitese QR Code',
          text: `Scan this to add ${user.full_name} on Bitese!`,
          files: [file]
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          toast.error('Sharing failed');
        }
      }
    } else {
      navigator.clipboard.writeText(myQRCode.qr_image_url);
      toast.success('QR code link copied to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">QR Code</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        <div className="flex border-b">
          <button
            onClick={() => {
              setMode('scan');
              setScannedUser(null);
              stopScanning();
            }}
            className={`flex-1 py-3 ${
              mode === 'scan'
                ? 'border-b-2 border-green-500 text-green-600 font-medium'
                : 'text-gray-600'
            }`}
          >
            Scan QR Code
          </button>
          <button
            onClick={() => {
              setMode('show');
              setScannedUser(null);
              stopScanning();
            }}
            className={`flex-1 py-3 ${
              mode === 'show'
                ? 'border-b-2 border-green-500 text-green-600 font-medium'
                : 'text-gray-600'
            }`}
          >
            My QR Code
          </button>
        </div>

        <div className="p-4">
          {mode === 'scan' ? (
            <div className="space-y-4">
              {scannedUser ? (
                <div className="text-center space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-2xl">
                    {scannedUser.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-xl font-semibold">{scannedUser.full_name}</h4>
                    <p className="text-gray-600">{scannedUser.phone_number}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={sendContactRequest}
                      className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                    >
                      Add Contact
                    </button>
                    <button
                      onClick={() => {
                        setScannedUser(null);
                        startScanning();
                      }}
                      className="px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      <FiRefreshCw size={20} />
                    </button>
                  </div>
                </div>
              ) : !scanning ? (
                <div className="text-center py-8">
                  <div className="w-48 h-48 mx-auto mb-4 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
                    <span className="text-6xl">📷</span>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Point your camera at a QR code to scan
                  </p>
                  <button
                    onClick={startScanning}
                    className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
                  >
                    Start Scanning
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full rounded-lg bg-black"
                  />
                  <canvas ref={canvasRef} className="hidden" />
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-64 h-64 border-4 border-green-500 rounded-lg shadow-lg" />
                  </div>
                  <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                    <button
                      onClick={stopScanning}
                      className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 shadow-lg"
                    >
                      Stop Scanning
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {myQRCode ? (
                <>
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-lg inline-block shadow-lg">
                      <img
                        src={myQRCode.qr_image_url}
                        alt="My QR Code"
                        className="w-64 h-64"
                      />
                    </div>
                    <div className="mt-4">
                      <p className="font-semibold text-lg">{user?.full_name}</p>
                      <p className="text-sm text-gray-600">{user?.phone_number}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Scanned {myQRCode.scan_count} times
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={downloadQRCode}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                    >
                      <FiDownload size={20} />
                      <span>Download</span>
                    </button>
                    <button
                      onClick={shareQRCode}
                      className="flex-1 flex items-center justify-center gap-2 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
                    >
                      <FiShare2 size={20} />
                      <span>Share</span>
                    </button>
                  </div>

                  <button
                    onClick={generateMyQRCode}
                    className="w-full flex items-center justify-center gap-2 py-2 text-gray-600 hover:text-gray-800"
                  >
                    <FiRefreshCw size={16} />
                    <span className="text-sm">Generate New QR Code</span>
                  </button>
                </>
              ) : (
                <div className="text-center py-8">
                  <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600">Generating QR code...</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QRScannerModal;
