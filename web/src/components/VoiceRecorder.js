import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiSend, FiPause, FiPlay, FiTrash2,
  FiCopy, FiEdit3, FiCheck, FiGlobe, FiDownload,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const LANGUAGES = [
  { code: 'en-US',  flag: '🇺🇸', label: 'English (US)' },
  { code: 'en-GB',  flag: '🇬🇧', label: 'English (UK)' },
  { code: 'ar-SA',  flag: '🇸🇦', label: 'Arabic' },
  { code: 'zh-CN',  flag: '🇨🇳', label: 'Chinese' },
  { code: 'fr-FR',  flag: '🇫🇷', label: 'French' },
  { code: 'de-DE',  flag: '🇩🇪', label: 'German' },
  { code: 'hi-IN',  flag: '🇮🇳', label: 'Hindi' },
  { code: 'id-ID',  flag: '🇮🇩', label: 'Indonesian' },
  { code: 'it-IT',  flag: '🇮🇹', label: 'Italian' },
  { code: 'ja-JP',  flag: '🇯🇵', label: 'Japanese' },
  { code: 'ko-KR',  flag: '🇰🇷', label: 'Korean' },
  { code: 'pt-BR',  flag: '🇧🇷', label: 'Portuguese' },
  { code: 'ru-RU',  flag: '🇷🇺', label: 'Russian' },
  { code: 'es-ES',  flag: '🇪🇸', label: 'Spanish' },
  { code: 'sw-KE',  flag: '🇰🇪', label: 'Swahili' },
  { code: 'tr-TR',  flag: '🇹🇷', label: 'Turkish' },
  { code: 'uk-UA',  flag: '🇺🇦', label: 'Ukrainian' },
  { code: 'yo-NG',  flag: '🇳🇬', label: 'Yoruba' },
];

function getDefaultLang() {
  const saved = localStorage.getItem('vc_voice_lang');
  if (saved && LANGUAGES.find(l => l.code === saved)) return saved;
  const lang = navigator.language || 'en-US';
  const exact = LANGUAGES.find(l => l.code === lang);
  if (exact) return exact.code;
  const prefix = lang.split('-')[0];
  const partial = LANGUAGES.find(l => l.code.startsWith(prefix));
  return partial ? partial.code : 'en-US';
}

function fmtDur(s) {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

async function decodeAudioWaveform(blob, bars = 60) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = await ctx.decodeAudioData(await blob.arrayBuffer());
    await ctx.close();
    const data = buf.getChannelData(0);
    const block = Math.floor(data.length / bars);
    const result = [];
    for (let i = 0; i < bars; i++) {
      let sum = 0;
      for (let j = 0; j < block; j++) sum += Math.abs(data[i * block + j]);
      result.push(sum / block);
    }
    const max = Math.max(...result, 0.001);
    return result.map(v => Math.max(0.05, v / max));
  } catch {
    return Array.from({ length: bars }, () => 0.08 + Math.random() * 0.92);
  }
}

function RecordingBars({ analyser, isPaused }) {
  const BARS = 30;
  const [heights, setHeights] = useState(Array(BARS).fill(3));
  const rafRef = useRef(null);
  const dataRef = useRef(new Uint8Array(128));

  useEffect(() => {
    if (!analyser || isPaused) { setHeights(Array(BARS).fill(3)); return; }
    const tick = () => {
      analyser.getByteFrequencyData(dataRef.current);
      const step = Math.floor(dataRef.current.length / BARS);
      setHeights(Array.from({ length: BARS }, (_, i) =>
        Math.max(3, Math.round((dataRef.current[i * step] / 255) * 38))
      ));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [analyser, isPaused]);

  return (
    <div className="flex items-center gap-[2px] h-9 flex-1">
      {heights.map((h, i) => (
        <motion.div key={i}
          className={`flex-1 rounded-full ${isPaused ? 'bg-gray-300' : 'bg-[#25D366]'}`}
          animate={{ height: h }}
          transition={{ duration: 0.07, ease: 'linear' }}
        />
      ))}
    </div>
  );
}

function StaticWaveform({ data, progress = 0, onSeek, isOwn }) {
  const ref = useRef(null);
  const bars = data?.length || 60;

  const seek = (clientX) => {
    if (!ref.current || !onSeek) return;
    const rect = ref.current.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={ref}
      className="flex items-center gap-[1.5px] flex-1 h-8 cursor-pointer select-none"
      onClick={e => seek(e.clientX)}
      onTouchMove={e => seek(e.touches[0].clientX)}
    >
      {(data || Array(bars).fill(0.5)).map((v, i) => {
        const played = i / bars < progress;
        return (
          <div key={i}
            className={`flex-1 rounded-full transition-colors duration-75 ${
              played
                ? (isOwn ? 'bg-[#075E54]' : 'bg-[#25D366]')
                : (isOwn ? 'bg-gray-400' : 'bg-gray-300')
            }`}
            style={{ height: `${Math.max(3, v * 30)}px` }}
          />
        );
      })}
    </div>
  );
}

export default function VoiceRecorder({ receiverId, groupId, onSent, socket }) {
  const [phase, setPhase] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [blob, setBlob] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [analyser, setAnalyser] = useState(null);
  const [waveform, setWaveform] = useState(null);

  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [editingTx, setEditingTx] = useState(false);
  const [editedTx, setEditedTx] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [lang, setLang] = useState(getDefaultLang);
  const [langOpen, setLangOpen] = useState(false);
  const [speechSupported] = useState(() => !!(window.SpeechRecognition || window.webkitSpeechRecognition));

  const mrRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const streamRef = useRef(null);
  const ctxRef = useRef(null);
  const srRef = useRef(null);
  const phaseRef = useRef('idle');
  const finalRef = useRef('');

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (ctxRef.current) { ctxRef.current.close().catch(() => {}); ctxRef.current = null; }
    try { srRef.current?.abort(); } catch {}
    srRef.current = null;
    setAnalyser(null);
  }, []);

  const startSR = useCallback(() => {
    if (!speechSupported) return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = lang;
    r.maxAlternatives = 1;

    r.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          finalRef.current += res[0].transcript + ' ';
          setTranscript(finalRef.current);
          setConfidence(res[0].confidence || 0);
          setInterim('');
        } else {
          interimText += res[0].transcript;
          setInterim(interimText);
        }
      }
    };

    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      console.warn('[SR]', e.error);
    };

    r.onend = () => {
      if (phaseRef.current === 'recording') {
        try { r.start(); } catch {}
      }
    };

    srRef.current = r;
    try { r.start(); } catch {}
  }, [speechSupported, lang]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000 }
      });
      streamRef.current = stream;

      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const anal = ctx.createAnalyser();
        anal.fftSize = 256;
        src.connect(anal);
        setAnalyser(anal);
      } catch {}

      const preferred = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      const mimeType = preferred.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mrRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        const b = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
        setBlob(b);
        setAudioUrl(URL.createObjectURL(b));
        const wd = await decodeAudioWaveform(b, 60);
        setWaveform(wd);
        setPhase('preview');
        cleanup();
      };

      mr.start(100);
      finalRef.current = '';
      setTranscript('');
      setInterim('');
      setConfidence(0);
      setDuration(0);
      setPhase('recording');
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      startSR();
    } catch (err) {
      toast.error(err.name === 'NotAllowedError' ? 'Microphone access denied' : 'Could not start recording');
    }
  };

  const stopRecording = () => {
    try { srRef.current?.stop(); } catch {}
    if (interim) { finalRef.current += interim + ' '; setTranscript(finalRef.current); setInterim(''); }
    setEditedTx(finalRef.current.trim());
    if (mrRef.current?.state !== 'inactive') { mrRef.current.stop(); clearInterval(timerRef.current); }
  };

  const pauseResume = () => {
    if (phase === 'recording') {
      mrRef.current?.pause();
      try { srRef.current?.stop(); } catch {}
      setPhase('paused');
    } else {
      mrRef.current?.resume();
      startSR();
      setPhase('recording');
    }
  };

  const cancel = useCallback(() => {
    if (mrRef.current?.state !== 'inactive') { try { mrRef.current.stop(); } catch {} }
    cleanup();
    setPhase('idle');
    setDuration(0);
    setBlob(null);
    setWaveform(null);
    setTranscript('');
    setInterim('');
    setEditedTx('');
    setIsPlaying(false);
    setProgress(0);
    finalRef.current = '';
    setAudioUrl(prev => { if (prev) URL.revokeObjectURL(prev); return null; });
  }, [cleanup]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) { audioRef.current.pause(); setIsPlaying(false); }
    else { audioRef.current.playbackRate = speed; audioRef.current.play(); setIsPlaying(true); }
  };

  const handleSeek = (ratio) => {
    if (audioRef.current?.duration) {
      audioRef.current.currentTime = ratio * audioRef.current.duration;
      setProgress(ratio);
    }
  };

  const cycleSpeed = () => {
    const speeds = [1, 1.5, 2, 0.75];
    const next = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const copyTx = () => {
    const t = (editingTx ? editedTx : transcript).trim();
    if (!t) { toast('No transcript to copy', { icon: 'ℹ️' }); return; }
    navigator.clipboard.writeText(t).then(() => toast.success('Transcript copied'));
  };

  const download = () => {
    if (!blob || !audioUrl) return;
    const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
    const a = document.createElement('a');
    a.href = audioUrl; a.download = `voice_${Date.now()}.${ext}`; a.click();
  };

  const sendVoice = async () => {
    if (!blob) return;
    setPhase('sending');
    const finalTx = (editingTx ? editedTx : transcript).trim();
    try {
      const fd = new FormData();
      const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'mp4' : 'webm';
      fd.append('media', blob, `voice_${Date.now()}.${ext}`);
      fd.append('media_type', 'voice');
      fd.append('media_duration', String(duration));
      if (finalTx) fd.append('content', finalTx);
      if (receiverId) fd.append('receiver_id', receiverId);
      if (groupId) fd.append('group_id', groupId);

      const endpoint = groupId ? '/messages/group' : '/messages/send';
      const resp = await api.post(endpoint, fd, { headers: { 'Content-Type': 'multipart/form-data' } });

      if (socket) {
        const event = groupId ? 'group_message' : 'private_message';
        socket.emit(event, resp.data.message || resp.data);
      }

      toast.success('Voice message sent');
      cancel();
      if (onSent) onSent(resp.data);
    } catch {
      toast.error('Failed to send voice message');
      setPhase('preview');
    }
  };

  const selectLang = (code) => {
    setLang(code);
    localStorage.setItem('vc_voice_lang', code);
    setLangOpen(false);
  };

  useEffect(() => () => { cleanup(); if (audioUrl) URL.revokeObjectURL(audioUrl); }, [cleanup]); // eslint-disable-line

  const currentLang = LANGUAGES.find(l => l.code === lang);

  if (phase === 'idle') {
    return (
      <div className="flex items-center gap-1.5 relative">
        <div className="relative">
          <button
            onClick={() => setLangOpen(v => !v)}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-base transition"
            title={`Transcription: ${currentLang?.label}`}
          >
            {currentLang?.flag || '🌐'}
          </button>
          <AnimatePresence>
            {langOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                transition={{ duration: 0.12 }}
                className="absolute bottom-full right-0 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-50 w-52 max-h-64 overflow-y-auto"
              >
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-gray-400">Transcription Language</p>
                {LANGUAGES.map(l => (
                  <button key={l.code} onClick={() => selectLang(l.code)}
                    className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-2
                      ${lang === l.code ? 'bg-[#e8fdf0] text-[#25D366] font-semibold' : 'hover:bg-gray-50 text-gray-700'}`}>
                    <span>{l.flag}</span><span>{l.label}</span>
                    {lang === l.code && <FiCheck size={11} className="ml-auto text-[#25D366]" strokeWidth={3} />}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={startRecording}
          className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center shadow-md hover:bg-emerald-500 transition-colors"
          title="Record voice message"
        >
          <FiMic size={18} className="text-white" />
        </motion.button>
      </div>
    );
  }

  if (phase === 'recording' || phase === 'paused') {
    return (
      <motion.div
        initial={{ opacity: 0, scaleX: 0.85 }}
        animate={{ opacity: 1, scaleX: 1 }}
        className="flex flex-col gap-1.5 bg-white border border-gray-200 rounded-2xl px-3 py-2.5 shadow-sm w-full"
      >
        <div className="flex items-center gap-2">
          <button onClick={cancel} className="text-gray-400 hover:text-red-500 transition flex-shrink-0" title="Cancel">
            <FiTrash2 size={16} />
          </button>

          <RecordingBars analyser={analyser} isPaused={phase === 'paused'} />

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <motion.div
              className={`w-2 h-2 rounded-full ${phase === 'paused' ? 'bg-gray-400' : 'bg-red-500'}`}
              animate={phase === 'recording' ? { opacity: [1, 0.15, 1] } : {}}
              transition={{ repeat: Infinity, duration: 1 }}
            />
            <span className="text-xs font-mono font-bold text-gray-800 tabular-nums">{fmtDur(duration)}</span>
          </div>

          <button onClick={pauseResume}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition"
            title={phase === 'paused' ? 'Resume' : 'Pause'}>
            {phase === 'paused'
              ? <FiPlay size={12} className="text-gray-700 translate-x-0.5" />
              : <FiPause size={12} className="text-gray-700" />}
          </button>

          <button onClick={stopRecording}
            className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 transition shadow-sm"
            title="Stop & preview">
            <FiSend size={14} className="text-white translate-x-0.5" />
          </button>
        </div>

        {(transcript || interim) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="border-t border-gray-100 pt-2">
            <div className="flex items-start gap-1.5">
              <span className="inline-flex items-center gap-1 flex-shrink-0 mt-0.5">
                <motion.span className="w-1.5 h-1.5 rounded-full bg-[#25D366]"
                  animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} />
                <span className="text-[9px] font-bold uppercase tracking-widest text-[#25D366]">Live</span>
              </span>
              <p className="text-xs text-gray-700 leading-relaxed flex-1 min-w-0">
                {transcript}
                <span className="text-gray-400 italic">{interim}</span>
              </p>
            </div>
            {confidence > 0 && (
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-0.5 bg-gray-100 rounded-full overflow-hidden">
                  <motion.div className="h-full bg-[#25D366] rounded-full"
                    animate={{ width: `${confidence * 100}%` }} />
                </div>
                <span className="text-[9px] text-gray-400 tabular-nums">{Math.round(confidence * 100)}%</span>
              </div>
            )}
          </motion.div>
        )}

        {!speechSupported && (
          <p className="text-[10px] text-amber-500 border-t border-gray-100 pt-1.5 flex items-center gap-1">
            <FiGlobe size={10} />
            Use Chrome or Edge for live transcription
          </p>
        )}
      </motion.div>
    );
  }

  if (phase === 'preview') {
    const displayTx = editingTx ? editedTx : transcript;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-2.5 shadow-sm w-full"
      >
        <div className="flex items-center gap-2">
          <button onClick={cancel} className="text-gray-400 hover:text-red-500 transition flex-shrink-0" title="Discard">
            <FiTrash2 size={15} />
          </button>

          <button onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 transition shadow-sm">
            {isPlaying
              ? <span className="flex gap-[3px]"><span className="w-1 h-3.5 bg-white rounded-full" /><span className="w-1 h-3.5 bg-white rounded-full" /></span>
              : <FiPlay size={14} className="text-white translate-x-0.5" />}
          </button>

          <StaticWaveform data={waveform} progress={progress} onSeek={handleSeek} />

          <span className="text-[11px] font-mono text-gray-500 flex-shrink-0 tabular-nums">{fmtDur(duration)}</span>

          <button onClick={cycleSpeed}
            className="text-[11px] font-black text-[#25D366] bg-green-50 hover:bg-green-100 px-2 py-1 rounded-lg flex-shrink-0 min-w-[38px] text-center transition">
            {speed}×
          </button>

          <button onClick={download} title="Download voice note"
            className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center flex-shrink-0 transition">
            <FiDownload size={12} className="text-gray-500" />
          </button>

          <button onClick={sendVoice}
            className="w-9 h-9 rounded-full bg-[#25D366] hover:bg-emerald-500 flex items-center justify-center flex-shrink-0 transition shadow-sm">
            <FiSend size={14} className="text-white translate-x-0.5" />
          </button>
        </div>

        {speechSupported && (
          <div className="border-t border-gray-100 pt-2">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Transcript</span>
                {confidence > 0 && (
                  <span className="text-[9px] bg-green-50 text-[#25D366] px-1.5 py-0.5 rounded-full font-semibold">
                    {Math.round(confidence * 100)}% accurate
                  </span>
                )}
                {currentLang && (
                  <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                    {currentLang.flag} {currentLang.label}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={copyTx} title="Copy transcript"
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 transition">
                  <FiCopy size={11} className="text-gray-400" />
                </button>
                <button
                  onClick={() => {
                    if (editingTx) { setTranscript(editedTx); finalRef.current = editedTx; }
                    else { setEditedTx(transcript); }
                    setEditingTx(v => !v);
                  }}
                  title={editingTx ? 'Save edits' : 'Edit transcript'}
                  className="w-6 h-6 rounded-lg flex items-center justify-center hover:bg-gray-100 transition">
                  {editingTx
                    ? <FiCheck size={11} className="text-[#25D366]" strokeWidth={3} />
                    : <FiEdit3 size={11} className="text-gray-400" />}
                </button>
              </div>
            </div>

            {editingTx ? (
              <textarea
                value={editedTx}
                onChange={e => setEditedTx(e.target.value)}
                className="w-full text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:border-[#25D366] transition leading-relaxed"
                rows={3}
                placeholder="Edit your transcript…"
                autoFocus
              />
            ) : (
              <p className="text-xs leading-relaxed text-gray-700 min-h-[18px]">
                {displayTx.trim() || (
                  <span className="text-gray-300 italic">No speech detected — voice note will still be sent</span>
                )}
              </p>
            )}
          </div>
        )}

        <audio ref={audioRef} src={audioUrl}
          onTimeUpdate={() => {
            const el = audioRef.current;
            if (el?.duration) setProgress(el.currentTime / el.duration);
          }}
          onEnded={() => { setIsPlaying(false); setProgress(0); }}
        />
      </motion.div>
    );
  }

  if (phase === 'sending') {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-2xl shadow-sm">
        <div className="w-5 h-5 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="text-sm text-gray-500">Sending voice message…</span>
      </div>
    );
  }

  return null;
}
