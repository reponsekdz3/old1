import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Animated, StyleSheet,
  TextInput, ScrollView, Modal, Pressable, ActivityIndicator,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

let Voice = null;
try { Voice = require('@react-native-voice/voice').default; } catch {}

const LANGUAGES = [
  { code: 'en-US', flag: '🇺🇸', label: 'English (US)' },
  { code: 'en-GB', flag: '🇬🇧', label: 'English (UK)' },
  { code: 'ar-SA', flag: '🇸🇦', label: 'Arabic' },
  { code: 'zh-CN', flag: '🇨🇳', label: 'Chinese' },
  { code: 'fr-FR', flag: '🇫🇷', label: 'French' },
  { code: 'de-DE', flag: '🇩🇪', label: 'German' },
  { code: 'hi-IN', flag: '🇮🇳', label: 'Hindi' },
  { code: 'id-ID', flag: '🇮🇩', label: 'Indonesian' },
  { code: 'it-IT', flag: '🇮🇹', label: 'Italian' },
  { code: 'ja-JP', flag: '🇯🇵', label: 'Japanese' },
  { code: 'ko-KR', flag: '🇰🇷', label: 'Korean' },
  { code: 'pt-BR', flag: '🇧🇷', label: 'Portuguese' },
  { code: 'ru-RU', flag: '🇷🇺', label: 'Russian' },
  { code: 'es-ES', flag: '🇪🇸', label: 'Spanish' },
  { code: 'sw-KE', flag: '🇰🇪', label: 'Swahili' },
  { code: 'tr-TR', flag: '🇹🇷', label: 'Turkish' },
];

function fmtDur(s) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function WaveformBars({ active, paused }) {
  const anims = useRef(Array.from({ length: 14 }, () => new Animated.Value(3))).current;
  const loopRef = useRef(null);

  useEffect(() => {
    if (!active || paused) {
      anims.forEach(a => Animated.spring(a, { toValue: 3, useNativeDriver: false }).start());
      return;
    }
    const animate = () => {
      const animations = anims.map((a, i) => {
        const h = 4 + Math.random() * 28;
        return Animated.timing(a, { toValue: h, duration: 120 + i * 8, useNativeDriver: false });
      });
      loopRef.current = Animated.sequence([
        Animated.parallel(animations),
        Animated.delay(60),
      ]);
      loopRef.current.start((res) => { if (res.finished) animate(); });
    };
    animate();
    return () => loopRef.current?.stop();
  }, [active, paused, anims]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1, height: 36 }}>
      {anims.map((anim, i) => (
        <Animated.View key={i} style={{
          flex: 1, height: anim, borderRadius: 2,
          backgroundColor: paused ? '#ccc' : COLORS.accent,
        }} />
      ))}
    </View>
  );
}

export default function VoiceRecorder({ onSend, onCancel }) {
  const [phase, setPhase] = useState('idle');
  const [duration, setDuration] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [interim, setInterim] = useState('');
  const [editingTx, setEditingTx] = useState(false);
  const [editedTx, setEditedTx] = useState('');
  const [lang, setLang] = useState('en-US');
  const [langOpen, setLangOpen] = useState(false);
  const [speechAvailable] = useState(!!Voice);

  const recRef = useRef(null);
  const timerRef = useRef(null);
  const finalRef = useRef('');
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.25, duration: 550, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 550, useNativeDriver: true }),
      ])
    ).start();
  };

  const stopPulse = () => { pulseAnim.stopAnimation(); pulseAnim.setValue(1); };

  const startVoice = useCallback(async () => {
    if (!Voice) return;
    try {
      Voice.onSpeechResults = (e) => {
        const best = e.value?.[0] || '';
        finalRef.current = best;
        setTranscript(best);
        setInterim('');
      };
      Voice.onSpeechPartialResults = (e) => {
        setInterim(e.value?.[0] || '');
      };
      Voice.onSpeechError = (e) => {
        if (e.error?.code === '5') return;
        console.warn('[Voice]', e.error);
      };
      await Voice.start(lang);
    } catch {}
  }, [lang]);

  const stopVoice = useCallback(async () => {
    if (!Voice) return;
    try { await Voice.stop(); } catch {}
    Voice.onSpeechResults = null;
    Voice.onSpeechPartialResults = null;
    Voice.onSpeechError = null;
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) { console.warn('Mic denied'); return; }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync({
        android: {
          extension: '.webm',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_WEBM,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_VORBIS,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_HIGH,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {},
      });
      await rec.startAsync();
      recRef.current = rec;
      finalRef.current = '';
      setTranscript('');
      setInterim('');
      setEditedTx('');
      setDuration(0);
      setPhase('recording');
      startPulse();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      await startVoice();
    } catch (e) {
      console.warn('Recording start failed:', e);
    }
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    stopPulse();
    await stopVoice();
    if (interim) { finalRef.current = (finalRef.current + ' ' + interim).trim(); setInterim(''); }
    setTranscript(finalRef.current);
    setEditedTx(finalRef.current);
    try {
      await recRef.current?.stopAndUnloadAsync();
    } catch {}
    setPhase('preview');
  };

  const cancelRecording = async () => {
    clearInterval(timerRef.current);
    stopPulse();
    await stopVoice();
    try { await recRef.current?.stopAndUnloadAsync(); } catch {}
    recRef.current = null;
    setPhase('idle');
    setDuration(0);
    setTranscript('');
    setInterim('');
    finalRef.current = '';
    onCancel?.();
  };

  const sendVoice = async () => {
    if (!recRef.current) return;
    setPhase('sending');
    try {
      const uri = recRef.current.getURI();
      const finalTx = (editingTx ? editedTx : transcript).trim();
      onSend({ uri, duration, transcript: finalTx });
      recRef.current = null;
      setPhase('idle');
      setDuration(0);
      setTranscript('');
      setInterim('');
      finalRef.current = '';
    } catch (e) {
      console.warn('Send failed:', e);
      setPhase('preview');
    }
  };

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current);
      Voice?.destroy?.().catch?.(() => {});
      recRef.current?.stopAndUnloadAsync?.().catch?.(() => {});
    };
  }, []);

  const currentLang = LANGUAGES.find(l => l.code === lang);

  if (phase === 'idle') {
    return (
      <View style={styles.idleRow}>
        <TouchableOpacity onPress={() => setLangOpen(true)} style={styles.langBtn}>
          <Text style={{ fontSize: 18 }}>{currentLang?.flag || '🌐'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={startRecording} style={styles.micBtn}>
          <Ionicons name="mic" size={22} color={COLORS.textGray} />
        </TouchableOpacity>

        <Modal visible={langOpen} transparent animationType="slide" onRequestClose={() => setLangOpen(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setLangOpen(false)}>
            <View style={styles.langSheet}>
              <Text style={styles.langSheetTitle}>Transcription Language</Text>
              <ScrollView>
                {LANGUAGES.map(l => (
                  <TouchableOpacity key={l.code} onPress={() => { setLang(l.code); setLangOpen(false); }}
                    style={[styles.langRow, lang === l.code && styles.langRowActive]}>
                    <Text style={styles.langFlag}>{l.flag}</Text>
                    <Text style={[styles.langLabel, lang === l.code && styles.langLabelActive]}>{l.label}</Text>
                    {lang === l.code && <Ionicons name="checkmark" size={16} color={COLORS.accent} />}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </View>
    );
  }

  if (phase === 'recording') {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <TouchableOpacity onPress={cancelRecording} style={styles.iconBtn}>
            <Ionicons name="trash" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <WaveformBars active paused={false} />
          <Animated.View style={[styles.recDot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.timer}>{fmtDur(duration)}</Text>
          <TouchableOpacity onPress={stopRecording} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        {(transcript || interim) ? (
          <View style={styles.txRow}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveLabel}>LIVE</Text>
            </View>
            <Text style={styles.txText} numberOfLines={3}>
              {transcript}
              <Text style={styles.interimText}>{interim}</Text>
            </Text>
          </View>
        ) : speechAvailable ? (
          <Text style={styles.listeningHint}>Listening… speak clearly</Text>
        ) : (
          <Text style={styles.listeningHint}>Install dev build for live transcription</Text>
        )}
      </View>
    );
  }

  if (phase === 'preview') {
    const displayTx = editingTx ? editedTx : transcript;
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <TouchableOpacity onPress={cancelRecording} style={styles.iconBtn}>
            <Ionicons name="trash" size={20} color={COLORS.danger} />
          </TouchableOpacity>
          <View style={styles.staticWave}>
            {Array.from({ length: 18 }, (_, i) => (
              <View key={i} style={[styles.staticBar, { height: 4 + Math.random() * 24 }]} />
            ))}
          </View>
          <Text style={styles.timer}>{fmtDur(duration)}</Text>
          <TouchableOpacity onPress={sendVoice} style={styles.sendBtn}>
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.txPreview}>
          <View style={styles.txHeader}>
            <Text style={styles.txLabel}>Transcript</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <TouchableOpacity onPress={() => {
                if (editingTx) { setTranscript(editedTx); finalRef.current = editedTx; }
                else { setEditedTx(transcript); }
                setEditingTx(v => !v);
              }}>
                <Ionicons name={editingTx ? 'checkmark' : 'pencil'} size={14} color={COLORS.accent} />
              </TouchableOpacity>
            </View>
          </View>

          {editingTx ? (
            <TextInput
              value={editedTx}
              onChangeText={setEditedTx}
              multiline
              autoFocus
              style={styles.txInput}
              placeholder="Edit transcript…"
            />
          ) : (
            <Text style={displayTx ? styles.txText : styles.txPlaceholder}>
              {displayTx || 'No speech detected — voice note will still be sent'}
            </Text>
          )}
        </View>
      </View>
    );
  }

  if (phase === 'sending') {
    return (
      <View style={styles.sendingRow}>
        <ActivityIndicator size="small" color={COLORS.accent} />
        <Text style={styles.sendingText}>Sending…</Text>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  idleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  micBtn: { padding: 8 },
  langBtn: { padding: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  langSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, maxHeight: '65%',
  },
  langSheetTitle: { fontSize: 13, fontWeight: '700', color: '#555', textAlign: 'center', marginBottom: 12 },
  langRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 10, gap: 10,
  },
  langRowActive: { backgroundColor: '#f0fdf4' },
  langFlag: { fontSize: 20 },
  langLabel: { flex: 1, fontSize: 14, color: '#333' },
  langLabelActive: { color: COLORS.accent, fontWeight: '600' },
  card: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16,
    paddingHorizontal: 10, paddingVertical: 8, gap: 6,
    borderWidth: 1, borderColor: '#e8e8e8',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iconBtn: { padding: 4 },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444' },
  timer: { fontSize: 14, fontVariant: ['tabular-nums'], color: '#333', fontWeight: '600', minWidth: 36 },
  txRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, paddingTop: 4 },
  liveIndicator: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.accent },
  liveLabel: { fontSize: 8, fontWeight: '800', color: COLORS.accent, letterSpacing: 1 },
  txText: { flex: 1, fontSize: 12, color: '#333', lineHeight: 18 },
  interimText: { color: '#999', fontStyle: 'italic' },
  listeningHint: { fontSize: 10, color: '#aaa', marginTop: 2 },
  staticWave: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  staticBar: { width: 2.5, backgroundColor: '#d1d5db', borderRadius: 2 },
  txPreview: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 6 },
  txHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  txLabel: { fontSize: 9, fontWeight: '700', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.8 },
  txInput: {
    fontSize: 12, color: '#333', borderWidth: 1, borderColor: '#e0e0e0',
    borderRadius: 8, padding: 8, minHeight: 48, textAlignVertical: 'top',
  },
  txPlaceholder: { fontSize: 12, color: '#bbb', fontStyle: 'italic' },
  sendingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10 },
  sendingText: { fontSize: 13, color: '#999' },
});
