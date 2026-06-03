import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

export default function VoiceRecorder({ onSend, onCancel }) {
  const [recording, setRecording] = useState(null);
  const [duration, setDuration] = useState(0);
  const timerRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  };

  const start = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setDuration(0);
      startPulse();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (e) {
      console.warn('Recording failed:', e);
    }
  };

  const stop = async () => {
    if (!recording) return;
    clearInterval(timerRef.current);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);
      onSend({ uri, duration });
    } catch (e) {
      console.warn('Stop failed:', e);
    }
  };

  const cancel = async () => {
    clearInterval(timerRef.current);
    pulseAnim.stopAnimation();
    pulseAnim.setValue(1);
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch {}
    }
    setRecording(null);
    setDuration(0);
    onCancel?.();
  };

  const formatDuration = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (recording) {
    return (
      <View style={styles.recordingBar}>
        <TouchableOpacity onPress={cancel} style={styles.cancelBtn}>
          <Ionicons name="trash" size={22} color={COLORS.danger} />
        </TouchableOpacity>
        <View style={styles.recordingInfo}>
          <Animated.View style={[styles.dot, { transform: [{ scale: pulseAnim }] }]} />
          <Text style={styles.timer}>{formatDuration(duration)}</Text>
          <Text style={styles.slideHint}>Slide to cancel</Text>
        </View>
        <TouchableOpacity onPress={stop} style={styles.stopBtn}>
          <Ionicons name="send" size={22} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity onPress={start} style={styles.micBtn}>
      <Ionicons name="mic" size={22} color={COLORS.textGray} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  micBtn: { padding: 8 },
  recordingBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 8,
  },
  cancelBtn: { padding: 8 },
  stopBtn: { padding: 8 },
  recordingInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.danger },
  timer: { fontSize: 16, fontVariant: ['tabular-nums'], color: COLORS.dark, fontWeight: '500' },
  slideHint: { fontSize: 12, color: COLORS.gray, flex: 1 },
});
