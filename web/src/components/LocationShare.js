import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMapPin, FiNavigation, FiX, FiClock, FiCheck,
  FiRadio, FiStopCircle, FiMap, FiAlertCircle,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const DURATIONS = [
  { value: 15, label: '15 min', icon: '⚡' },
  { value: 60, label: '1 hour', icon: '⏱' },
  { value: 240, label: '4 hours', icon: '🕐' },
  { value: 480, label: '8 hours', icon: '🌅' },
];

function getOSMEmbedUrl(lat, lng, zoom = 15) {
  const delta = 0.008;
  const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

function getStaticMapUrl(lat, lng) {
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=15&size=400x200&markers=${lat},${lng},red-pushpin`;
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const a = data.address || {};
    const parts = [
      a.road || a.pedestrian || a.path,
      a.suburb || a.neighbourhood || a.quarter,
      a.city || a.town || a.village || a.county,
    ].filter(Boolean);
    return parts.slice(0, 2).join(', ') || data.display_name?.split(',').slice(0, 2).join(', ') || 'Unknown location';
  } catch {
    return 'Current location';
  }
}

export function LocationMapBubble({ message, isMine }) {
  const lat = message.latitude || message.location_lat;
  const lng = message.longitude || message.location_lng;
  const name = message.location_name || 'Location';
  const isLive = message.is_live;
  const [expanded, setExpanded] = useState(false);

  if (!lat || !lng) return null;

  return (
    <div className={`max-w-[260px] rounded-2xl overflow-hidden border ${isMine ? 'border-[#25D366]/30' : 'border-white/10'} shadow-lg`}>
      {expanded ? (
        <div className="relative">
          <iframe
            src={getOSMEmbedUrl(lat, lng)}
            width="260" height="200"
            style={{ border: 0, display: 'block' }}
            title="Map"
            loading="lazy"
          />
          <button onClick={() => setExpanded(false)}
            className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center">
            <FiX size={12} className="text-white" />
          </button>
          {isLive && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
              <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-white" />
              LIVE
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setExpanded(true)} className="relative w-full group">
          <img
            src={getStaticMapUrl(lat, lng)}
            alt={name}
            className="w-full h-[120px] object-cover group-hover:brightness-110 transition"
            onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
          />
          <div className="hidden w-full h-[120px] bg-gray-800 items-center justify-center">
            <FiMap size={28} className="text-white/30" />
          </div>
          {isLive && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
              <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                className="w-1.5 h-1.5 rounded-full bg-white" />
              LIVE
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2.5">
            <div className="flex items-center gap-1.5">
              <FiMapPin size={12} className="text-white flex-shrink-0" />
              <p className="text-white text-xs font-semibold truncate">{name}</p>
            </div>
          </div>
        </button>
      )}
      <div className={`px-3 py-2 flex items-center justify-between ${isMine ? 'bg-[#075e54]' : 'bg-[#1a1a1a]'}`}>
        <span className="text-white/60 text-[11px] truncate flex-1">{isLive ? 'Live location' : 'Pinned location'}</span>
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {/* Native maps deep-link: Apple Maps on iOS, Google Maps elsewhere */}
          <a href={/iPhone|iPad|iPod/i.test(navigator.userAgent)
              ? `maps://maps.apple.com/?q=${lat},${lng}`
              : `https://maps.google.com/?q=${lat},${lng}`}
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-[#25D366] font-bold hover:underline">
            {/iPhone|iPad|iPod/i.test(navigator.userAgent) ? 'Apple Maps' : 'Google Maps'}
          </a>
          <span className="text-white/20 text-[10px]">·</span>
          <a href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}&zoom=15`}
            target="_blank" rel="noopener noreferrer"
            className="text-[11px] text-white/40 hover:text-white/70 font-medium hover:underline">
            OSM
          </a>
        </div>
      </div>
    </div>
  );
}

function LocationShare({ receiverId, onSent, socket }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState('picker'); // 'picker' | 'preview' | 'sharing'
  const [isSharing, setIsSharing] = useState(false);
  const [coords, setCoords] = useState(null);
  const [locationName, setLocationName] = useState('');
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState(null);
  const [selectedDuration, setSelectedDuration] = useState(60);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveIntervalId, setLiveIntervalId] = useState(null);
  const [liveMsgId, setLiveMsgId] = useState(null);
  const [liveElapsed, setLiveElapsed] = useState(0);
  const liveTimerRef = useRef(null);

  const getLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported by your browser');
      return;
    }
    setGeoLoading(true);
    setGeoError(null);
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const { latitude, longitude } = pos.coords;
          setCoords({ lat: latitude, lng: longitude });
          const name = await reverseGeocode(latitude, longitude);
          setLocationName(name);
          setGeoLoading(false);
          setStep('preview');
          resolve({ lat: latitude, lng: longitude, name });
        },
        (err) => {
          const msg = err.code === 1 ? 'Location permission denied. Enable in browser settings.'
            : err.code === 2 ? 'Location unavailable'
            : 'Location request timed out';
          setGeoError(msg);
          setGeoLoading(false);
          reject(new Error(msg));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }, []);

  useEffect(() => {
    if (open && step === 'picker' && !coords) {
      getLocation();
    }
  }, [open]); // eslint-disable-line

  const sendLocation = async () => {
    if (!coords) return;
    setIsSharing(true);
    try {
      const { data } = await api.post('/messages/location', {
        receiver_id: receiverId,
        latitude: coords.lat,
        longitude: coords.lng,
        location_name: locationName || 'Current Location',
        is_live: isLiveMode,
        duration: selectedDuration,
      });

      if (socket) socket.emit('message', data);
      onSent && onSent(data);
      toast.success(isLiveMode ? '📍 Live location started!' : '📍 Location sent!');

      if (isLiveMode) {
        setLiveMsgId(data.id);
        setStep('sharing');
        startLiveUpdates(data.id);
      } else {
        handleClose();
      }
    } catch {
      toast.error('Failed to send location');
    } finally {
      setIsSharing(false);
    }
  };

  const startLiveUpdates = (msgId) => {
    liveTimerRef.current = setInterval(() => setLiveElapsed(e => e + 1), 1000);
    const interval = setInterval(async () => {
      try {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 5000 });
        });
        const { latitude, longitude } = pos.coords;
        await api.put(`/messages/live-location/${msgId}`, { latitude, longitude });
        if (socket) socket.emit('location_update', { receiver_id: receiverId, latitude, longitude, message_id: msgId });
      } catch { }
    }, 15000);

    setLiveIntervalId(interval);
    const maxMs = selectedDuration * 60 * 1000;
    setTimeout(() => { stopLive(interval); toast('Live location sharing ended.'); }, maxMs);
  };

  const stopLive = (intervalId) => {
    clearInterval(intervalId || liveIntervalId);
    clearInterval(liveTimerRef.current);
    if (liveMsgId) api.put(`/messages/live-location/${liveMsgId}/stop`).catch(() => {});
    setLiveIntervalId(null);
    setLiveMsgId(null);
    setLiveElapsed(0);
    setStep('picker');
    setIsLiveMode(false);
    handleClose();
  };

  const handleClose = () => {
    setOpen(false);
    setStep('picker');
    setCoords(null);
    setLocationName('');
    setGeoError(null);
  };

  const formatElapsed = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const fmtDuration = (min) => min < 60 ? `${min} min` : `${min / 60}h`;

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/8 rounded-full transition"
        title="Share location"
      >
        <FiMapPin size={20} />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

            <motion.div
              className="relative w-full max-w-sm bg-[#141414] rounded-3xl border border-white/10 overflow-hidden shadow-2xl"
              initial={{ y: 80, scale: 0.93 }} animate={{ y: 0, scale: 1 }} exit={{ y: 80, scale: 0.93 }}
              transition={{ type: 'spring', damping: 28, stiffness: 260 }}>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/8">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                    <FiMapPin size={17} className="text-[#25D366]" />
                  </div>
                  <div>
                    <p className="font-bold text-sm text-white">Share Location</p>
                    <p className="text-[11px] text-white/35">via OpenStreetMap</p>
                  </div>
                </div>
                <button onClick={handleClose} className="w-8 h-8 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center transition">
                  <FiX size={15} className="text-white/70" />
                </button>
              </div>

              {/* Loading state */}
              {step === 'picker' && geoLoading && (
                <div className="px-5 py-10 flex flex-col items-center gap-4">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-14 h-14 rounded-full border-2 border-[#25D366]/30 border-t-[#25D366]" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/80">Getting your location…</p>
                    <p className="text-xs text-white/35 mt-1">Please allow location access</p>
                  </div>
                </div>
              )}

              {/* Error state */}
              {step === 'picker' && !geoLoading && geoError && (
                <div className="px-5 py-8 flex flex-col items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
                    <FiAlertCircle size={24} className="text-red-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-white/80">Location unavailable</p>
                    <p className="text-xs text-white/40 mt-1 leading-relaxed">{geoError}</p>
                  </div>
                  <button onClick={getLocation}
                    className="px-5 py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-xl text-sm transition">
                    Try again
                  </button>
                </div>
              )}

              {/* Preview + options */}
              {step === 'preview' && coords && (
                <>
                  {/* Map preview */}
                  <div className="relative">
                    <iframe
                      src={getOSMEmbedUrl(coords.lat, coords.lng)}
                      width="100%" height="200"
                      style={{ border: 0, display: 'block' }}
                      title="Location preview"
                      loading="lazy"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#141414]/90 to-transparent h-10 pointer-events-none" />
                  </div>

                  <div className="px-5 py-4 space-y-4">
                    {/* Location name */}
                    <div className="flex items-start gap-2.5">
                      <FiMapPin size={16} className="text-[#25D366] mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-white/40 mb-0.5">Your location</p>
                        <p className="text-sm font-semibold text-white leading-snug">{locationName || 'Loading address…'}</p>
                        <p className="text-[11px] text-white/25 mt-0.5">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                      </div>
                      <button onClick={getLocation} className="flex-shrink-0 text-[11px] text-[#25D366] hover:underline">Refresh</button>
                    </div>

                    {/* Live mode toggle */}
                    <div className="flex items-center justify-between bg-white/4 border border-white/8 rounded-2xl px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-red-500/15 flex items-center justify-center">
                          <FiRadio size={15} className="text-red-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-white">Live Location</p>
                          <p className="text-[11px] text-white/35">Updates automatically</p>
                        </div>
                      </div>
                      <button onClick={() => setIsLiveMode(v => !v)}
                        className={`w-11 h-6 rounded-full border transition-all ${isLiveMode ? 'bg-red-500 border-red-500' : 'bg-white/10 border-white/15'}`}>
                        <motion.div animate={{ x: isLiveMode ? 20 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          className="w-4 h-4 bg-white rounded-full shadow-md mt-0.5" />
                      </button>
                    </div>

                    {/* Duration selector (only for live) */}
                    <AnimatePresence>
                      {isLiveMode && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }} className="overflow-hidden">
                          <p className="text-xs font-bold text-white/40 mb-2 flex items-center gap-1.5">
                            <FiClock size={11} /> Share for
                          </p>
                          <div className="grid grid-cols-4 gap-2">
                            {DURATIONS.map(({ value, label, icon }) => (
                              <button key={value} onClick={() => setSelectedDuration(value)}
                                className={`flex flex-col items-center py-2.5 rounded-xl border text-center transition ${selectedDuration === value ? 'bg-[#25D366]/15 border-[#25D366]/40 text-[#25D366]' : 'bg-white/4 border-white/8 text-white/50 hover:text-white hover:bg-white/8'}`}>
                                <span className="text-base mb-0.5">{icon}</span>
                                <span className="text-[10px] font-bold">{label}</span>
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Action buttons */}
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleClose}
                        className="flex-1 py-3 bg-white/8 hover:bg-white/12 text-white font-bold rounded-xl text-sm transition">
                        Cancel
                      </button>
                      <button onClick={sendLocation} disabled={isSharing}
                        className={`flex-[2] py-3 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-60 ${isLiveMode ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-[#25D366] hover:bg-[#1fbd5a] text-white'}`}>
                        {isSharing
                          ? <><motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full" /> Sending…</>
                          : isLiveMode
                            ? <><FiRadio size={14} /> Start Live ({fmtDuration(selectedDuration)})</>
                            : <><FiMapPin size={14} /> Send Location</>
                        }
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Live sharing active */}
              {step === 'sharing' && (
                <div className="px-5 py-6 flex flex-col items-center gap-5">
                  <div className="relative">
                    <motion.div animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-red-500 rounded-full" />
                    <div className="relative w-16 h-16 rounded-full bg-red-500 flex items-center justify-center">
                      <FiRadio size={28} className="text-white" />
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="font-black text-lg text-white">Sharing Live</p>
                    <p className="text-white/40 text-sm mt-1">Your location updates every 15s</p>
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <FiClock size={12} className="text-white/30" />
                      <span className="text-white/50 text-sm font-mono">{formatElapsed(liveElapsed)}</span>
                      <span className="text-white/25 text-xs">/ {fmtDuration(selectedDuration)}</span>
                    </div>
                  </div>
                  {coords && (
                    <div className="w-full bg-white/5 border border-white/8 rounded-2xl p-3 flex items-center gap-2.5">
                      <FiMapPin size={14} className="text-[#25D366]" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white/80 truncate">{locationName}</p>
                        <p className="text-[10px] text-white/30">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                      </div>
                    </div>
                  )}
                  <button onClick={() => stopLive()}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-400 font-bold rounded-xl text-sm transition flex items-center justify-center gap-2">
                    <FiStopCircle size={15} />
                    Stop Sharing
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default LocationShare;
