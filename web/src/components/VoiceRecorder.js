import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMic, FiX, FiSend, FiPause, FiPlay, FiTrash2 } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function fmtDur(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// Simple waveform bars that animate while recording
function WaveformBars({ isRecording, analyser }) {
  const bars = 24;
  const [heights, setHeights] = useState(Array(bars).fill(3));
  const rafRef = useRef(null);
  const dataRef = useRef(new Uint8Array(128));

  useEffect(() => {
    if (!isRecording || !analyser) {
      setHeights(Array(bars).fill(3));
      return;
    }
    const tick = () => {
      analyser.getByteFrequencyData(dataRef.current);
      const step = Math.floor(dataRef.current.length / bars);
      const newHeights = Array.from({ length: bars }, (_, i) => {
        const val = dataRef.current[i * step] || 0;
        return Math.max(3, Math.round((val / 255) * 36));
      });
      setHeights(newHeights);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isRecording, analyser]);

  return (
    <div className="flex items-center gap-0.5 h-10">
      {heights.map((h, i) => (
        <motion.div
          key={i}
          className="flex-1 rounded-full bg-[#25D366]"
          animate={{ height: h }}
          transition={{ duration: 0.08 }}
        />
      ))}
    </div>
  );
}

// Playback waveform for recorded audio
function PlaybackWaveform({ blob, progress = 0 }) {
  const bars = 40;
  const [barHeights] = useState(() =>
    Array.from({ length: bars }, () => 4 + Math.random() * 28)
  );

  return (
    <div className="flex items-center gap-0.5 h-10 cursor-pointer">
      {barHeights.map((h, i) => {
        const passed = i / bars < progress;
        return (
          <div
            key={i}
            className={`flex-1 rounded-full transition-colors ${passed ? 'bg-[#25D366]' : 'bg-gray-300'}`}
            style={{ height: h }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceRecorder({ receiverId, groupId, onSent, socket }) {
  const [phase, setPhase] = useState('idle'); // idle | recording | preview | sending
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [analyser, setAnalyser] = useState(null);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setAnalyser(null);
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up analyser for waveform
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const anal = ctx.createAnalyser();
        anal.fftSize = 256;
        src.connect(anal);
        setAnalyser(anal);
      } catch {}

      const options = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? { mimeType: 'audio/webm;codecs=opus' }
        : {};

      const mr = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setBlob(audioBlob);
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);
        setPhase('preview');
        cleanup();
      };

      mr.start(100);
      setPhase('recording');
      setDuration(0);

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setPhase('idle');
    setDuration(0);
    setBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackSpeed;
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2, 0.75];
    const next = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const sendVoice = async () => {
    if (!blob) return;
    setPhase('sending');
    try {
      const formData = new FormData();
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
      formData.append('media', blob, `voice_${Date.now()}.${ext}`);
      formData.append('media_type', 'voice');
      formData.append('media_duration', String(duration));
      if (receiverId) formData.append('receiver_id', receiverId);
      if (groupId) formData.append('group_id', groupId);

      const endpoint = groupId ? '/messages/group' : '/messages/send';
      const resp = await api.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (socket) {
        const event = groupId ? 'group_message' : 'private_message';
        socket.emit(event, resp.data.message || resp.data);
      }

      toast.success('Voice message sent');
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      setPhase('idle');
      setBlob(null);
      setAudioUrl(null);
      setDuration(0);
      if (onSent) onSent(resp.data);
    } catch {
      toast.error('Failed to send voice message');
      setPhase('preview');
    }
  };

  // Cleanup on unmount
  useEffect(() => () => {
    cleanup();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [cleanup, audioUrl]);

  if (phase === 'idle') {
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onMouseDown={startRecording}
        onTouchStart={e => { e.preventDefault(); startRecording(); }}
        className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-md hover:bg-emerald-500 transition-colors"
        title="Hold to record"
      >
        <FiMic size={18} className="text-white" />
      </motion.button>
    );
  }

  if (phase === 'recording') {
    return (
      <motion.div
        initial={{ width: 44, opacity: 0 }}
        animate={{ width: '100%', opacity: 1 }}
        className="flex items-center gap-3 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm"
      >
        <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
          <FiTrash2 size={16} />
        </button>

        <div className="flex-1 min-w-0">
          <WaveformBars isRecording analyser={analyser} />
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs font-mono font-bold text-red-500 min-w-[36px]">
            {fmtDur(duration)}
          </span>
          <motion.div className="w-2.5 h-2.5 rounded-full bg-red-500"
            animate={{ opacity: [1, 0.2, 1] }} transition={{ repeat: Infinity, duration: 1 }} />
        </div>

        <button onClick={stopRecording}
          className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 hover:bg-emerald-500 transition-colors">
          <FiSend size={14} className="text-white translate-x-0.5" />
        </button>
      </motion.div>
    );
  }

  if (phase === 'preview') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 bg-white border border-gray-200 rounded-full px-3 py-2 shadow-sm w-full"
      >
        <button onClick={cancelRecording} className="text-gray-400 hover:text-red-500 transition flex-shrink-0">
          <FiTrash2 size={15} />
        </button>

        <button onClick={togglePlay}
          className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0">
          {isPlaying ? <FiPause size={13} className="text-white" /> : <FiPlay size={13} className="text-white translate-x-0.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <PlaybackWaveform blob={blob} progress={playbackProgress} />
        </div>

        <span className="text-xs font-mono text-gray-500 flex-shrink-0">{fmtDur(duration)}</span>

        <button onClick={cycleSpeed}
          className="text-xs font-black text-[#25D366] bg-green-50 px-2 py-1 rounded-lg flex-shrink-0 w-10 text-center">
          {playbackSpeed}×
        </button>

        <button onClick={sendVoice}
          className="w-9 h-9 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 hover:bg-emerald-500 transition-colors">
          <FiSend size={14} className="text-white translate-x-0.5" />
        </button>

        {audioUrl && (
          <audio ref={audioRef} src={audioUrl}
            onTimeUpdate={() => {
              const el = audioRef.current;
              if (el && el.duration) setPlaybackProgress(el.currentTime / el.duration);
            }}
            onEnded={() => { setIsPlaying(false); setPlaybackProgress(0); }}
          />
        )}
      </motion.div>
    );
  }

  if (phase === 'sending') {
    return (
      <div className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 animate-pulse">
        <div className="w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
        Sending voice message…
      </div>
    );
  }

  return null;
}
