import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Linking,
  PanResponder, Animated, Modal, Pressable, ActivityIndicator,
  Clipboard,
} from 'react-native';
import { Audio } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function fmtSec(s) {
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function DeliveryTicks({ status }) {
  if (status === 'failed') return <Ionicons name="alert-circle" size={13} color="#FF3B30" />;
  if (status === 'queued') return <Ionicons name="cloud-upload-outline" size={12} color="rgba(0,0,0,0.35)" />;
  if (status === 'read') {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Ionicons name="checkmark" size={12} color="#4FC3F7" style={{ marginRight: -5 }} />
        <Ionicons name="checkmark" size={12} color="#4FC3F7" />
      </View>
    );
  }
  if (status === 'delivered') {
    return (
      <View style={{ flexDirection: 'row' }}>
        <Ionicons name="checkmark" size={12} color="rgba(0,0,0,0.45)" style={{ marginRight: -5 }} />
        <Ionicons name="checkmark" size={12} color="rgba(0,0,0,0.45)" />
      </View>
    );
  }
  if (status === 'sent') return <Ionicons name="checkmark" size={12} color="rgba(0,0,0,0.45)" />;
  return <Ionicons name="time-outline" size={10} color="rgba(0,0,0,0.3)" />;
}

// ── Voice Note Player ─────────────────────────────────────────────────────────
function VoiceNotePlayer({ mediaUrl, initialDuration, transcript, isOwn }) {
  const [sound, setSound] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [total, setTotal] = useState(initialDuration || 0);
  const [speed, setSpeed] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [txExpanded, setTxExpanded] = useState(false);
  const soundRef = useRef(null);

  const SPEEDS = [1.0, 1.5, 2.0, 0.75];

  const onPlaybackStatus = useCallback((status) => {
    if (!status.isLoaded) return;
    setPosition(status.positionMillis / 1000);
    if (status.durationMillis) setTotal(status.durationMillis / 1000);
    if (status.didJustFinish) {
      setPlaying(false);
      setPosition(0);
    }
  }, []);

  const togglePlay = async () => {
    try {
      if (soundRef.current) {
        const st = await soundRef.current.getStatusAsync();
        if (st.isLoaded) {
          if (playing) {
            await soundRef.current.pauseAsync();
            setPlaying(false);
          } else {
            await soundRef.current.setRateAsync(speed, true);
            await soundRef.current.playAsync();
            setPlaying(true);
          }
          return;
        }
      }
      setLoading(true);
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        allowsRecordingIOS: false,
        interruptionModeIOS: 1,
        interruptionModeAndroid: 1,
        shouldDuckAndroid: false,
        staysActiveInBackground: false,
      });
      const { sound: s } = await Audio.Sound.createAsync(
        { uri: mediaUrl },
        { shouldPlay: true, rate: speed, progressUpdateIntervalMillis: 200 },
        onPlaybackStatus
      );
      soundRef.current = s;
      setSound(s);
      setPlaying(true);
    } catch (e) {
      console.warn('Voice playback error:', e);
    } finally {
      setLoading(false);
    }
  };

  const cycleSpeed = async () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (soundRef.current) {
      try { await soundRef.current.setRateAsync(next, true); } catch {}
    }
  };

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync().catch(() => {});
    };
  }, []);

  const progressRatio = total > 0 ? Math.min(1, position / total) : 0;
  const accent = isOwn ? '#fff' : COLORS.accent;
  const accentFade = isOwn ? 'rgba(255,255,255,0.3)' : '#d1fae5';
  const textColor = isOwn ? '#fff' : '#111';
  const subColor = isOwn ? 'rgba(255,255,255,0.65)' : COLORS.textGray;

  return (
    <View>
      {/* Player row */}
      <View style={s.playerRow}>
        <TouchableOpacity onPress={togglePlay} style={[s.playBtn, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : COLORS.accent }]}>
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : playing
              ? <Ionicons name="pause" size={15} color="#fff" />
              : <Ionicons name="play" size={15} color="#fff" style={{ marginLeft: 1 }} />}
        </TouchableOpacity>

        {/* Waveform bars (visual) */}
        <View style={s.waveContainer}>
          {Array.from({ length: 24 }, (_, i) => {
            const h = 4 + [4, 8, 12, 7, 14, 10, 6, 11, 8, 5, 13, 9, 7, 12, 6, 10, 5, 8, 11, 4, 9, 7, 13, 5][i % 24] * 1.5;
            const played = i / 24 < progressRatio;
            return (
              <View key={i} style={[s.waveBar, { height: h, backgroundColor: played ? accent : accentFade }]} />
            );
          })}
        </View>

        <Text style={[s.timeText, { color: subColor }]}>
          {fmtSec(playing ? position : total)}
        </Text>
      </View>

      {/* Speed + transcript toggle */}
      <View style={s.controlsRow}>
        <TouchableOpacity onPress={cycleSpeed} style={[s.speedBtn, { borderColor: isOwn ? 'rgba(255,255,255,0.3)' : '#e5e7eb' }]}>
          <Text style={[s.speedText, { color: subColor }]}>{speed}×</Text>
        </TouchableOpacity>

        {transcript ? (
          <TouchableOpacity onPress={() => setTxExpanded(v => !v)} style={s.txToggle}>
            <Ionicons name="text" size={11} color={subColor} />
            <Text style={[s.txToggleText, { color: subColor }]}>{txExpanded ? 'Hide' : 'Transcript'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Transcript */}
      {txExpanded && transcript && (
        <View style={[s.txBox, { borderTopColor: isOwn ? 'rgba(255,255,255,0.2)' : '#f0f0f0' }]}>
          <View style={s.txHeader}>
            <Text style={[s.txLabel, { color: subColor }]}>Transcript</Text>
            <TouchableOpacity onPress={() => {
              Clipboard.setString(transcript);
            }}>
              <Ionicons name="copy-outline" size={12} color={subColor} />
            </TouchableOpacity>
          </View>
          <Text style={[s.txBody, { color: textColor }]}>{transcript}</Text>
        </View>
      )}
    </View>
  );
}

const REACTIONS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const SWIPE_THRESHOLD = 48;

export default function MessageBubble({ message, isOwn, onMoreOptions, onImagePress, onReply, onReact }) {
  const {
    content, media_url, media_type, status, created_at,
    latitude, longitude, location_name,
    contact_name, contact_phone,
    reactions, is_deleted, replied_to, media_duration,
  } = message;

  const translateX = useRef(new Animated.Value(0)).current;
  const replyTriggered = useRef(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dx > 8 && Math.abs(g.dy) < Math.abs(g.dx) * 0.7,
      onPanResponderGrant: () => { replyTriggered.current = false; },
      onPanResponderMove: (_, g) => {
        const clamped = Math.min(Math.max(0, g.dx), SWIPE_THRESHOLD * 1.4);
        translateX.setValue(clamped);
        if (!replyTriggered.current && clamped >= SWIPE_THRESHOLD) {
          replyTriggered.current = true;
          onReply?.(message);
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true, tension: 200, friction: 20 }).start();
      },
    })
  ).current;

  const isFailed = status === 'failed';
  const isQueued = status === 'queued';
  const bg = isOwn ? (isFailed ? '#FFEBEE' : isQueued ? '#F5F5F5' : COLORS.lightGreen) : '#fff';

  const renderReplyPreview = () => {
    if (!replied_to) return null;
    return (
      <View style={s.replyContainer}>
        <View style={s.replyLine} />
        <View style={s.replyContent}>
          <Text style={s.replySender}>{replied_to.sender_name || 'Unknown'}</Text>
          <Text style={s.replyText} numberOfLines={1}>
            {replied_to.content || (replied_to.media_type ? `📎 ${replied_to.media_type}` : 'Message')}
          </Text>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (is_deleted) return <Text style={s.deletedText}>🚫 This message was deleted</Text>;

    if (media_type === 'image' && media_url) {
      return (
        <TouchableOpacity onPress={() => onImagePress?.(media_url)} activeOpacity={0.9}>
          <Image source={{ uri: media_url }} style={s.mediaImage} resizeMode="cover" />
          {content ? <Text style={[s.text, { marginTop: 4 }]}>{content}</Text> : null}
        </TouchableOpacity>
      );
    }

    if (media_type === 'video' && media_url) {
      return (
        <View style={s.videoPlaceholder}>
          <Ionicons name="play-circle" size={40} color="#fff" />
          <Text style={s.videoLabel}>Video</Text>
        </View>
      );
    }

    if (media_type === 'voice' && media_url) {
      return (
        <VoiceNotePlayer
          mediaUrl={media_url}
          initialDuration={media_duration || 0}
          transcript={content || ''}
          isOwn={isOwn}
        />
      );
    }

    if (media_type === 'audio' && media_url) {
      return (
        <VoiceNotePlayer
          mediaUrl={media_url}
          initialDuration={media_duration || 0}
          transcript={content || ''}
          isOwn={isOwn}
        />
      );
    }

    if (latitude && longitude) {
      return (
        <TouchableOpacity
          style={s.locationCard}
          onPress={() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)}>
          <View style={s.locationIcon}>
            <Ionicons name="location" size={20} color="#fff" />
          </View>
          <View>
            <Text style={[s.text, { fontWeight: '600' }]}>📍 Location</Text>
            {location_name ? <Text style={[s.text, { color: COLORS.textGray, fontSize: 12 }]}>{location_name}</Text> : null}
          </View>
        </TouchableOpacity>
      );
    }

    if (contact_phone) {
      return (
        <View style={s.contactCard}>
          <View style={s.contactIcon}>
            <Ionicons name="person" size={20} color={COLORS.accent} />
          </View>
          <View>
            <Text style={[s.text, { fontWeight: '600' }]}>{contact_name || 'Contact'}</Text>
            <Text style={[s.text, { color: COLORS.textGray, fontSize: 12 }]}>{contact_phone}</Text>
          </View>
        </View>
      );
    }

    if (content) return <Text style={s.text}>{content}</Text>;
    return null;
  };

  return (
    <>
      {showReactionPicker && (
        <Modal transparent animationType="fade" onRequestClose={() => setShowReactionPicker(false)}>
          <Pressable style={s.reactionOverlay} onPress={() => setShowReactionPicker(false)}>
            <View style={[s.reactionStrip, isOwn ? s.reactionStripOwn : s.reactionStripOther]}>
              {REACTIONS.map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => { setShowReactionPicker(false); onReact?.(message.id, emoji); }} style={s.reactionBtn}>
                  <Text style={s.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => { setShowReactionPicker(false); onMoreOptions?.(); }} style={[s.reactionBtn, s.moreBtn]}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#555" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>
      )}

      <Animated.View
        {...panResponder.panHandlers}
        style={[s.wrapper, isOwn ? s.wrapperOwn : s.wrapperOther, { transform: [{ translateX }] }]}
      >
        <View style={[s.replyArrow, isOwn ? s.replyArrowOwn : s.replyArrowOther]}>
          <Ionicons name="return-up-back-outline" size={15} color={COLORS.accent} />
        </View>

        <TouchableOpacity
          onLongPress={() => setShowReactionPicker(true)}
          activeOpacity={0.85}
          delayLongPress={350}
        >
          <View style={[s.bubble, { backgroundColor: bg }, isOwn ? s.bubbleOwn : s.bubbleOther]}>
            {renderReplyPreview()}
            {renderContent()}
            <View style={s.footer}>
              <Text style={[s.time, isOwn ? s.timeOwn : s.timeOther]}>{formatTime(created_at)}</Text>
              {isOwn && <DeliveryTicks status={status} />}
            </View>
          </View>
        </TouchableOpacity>

        {reactions && reactions.length > 0 && (
          <View style={[s.reactions, isOwn ? s.reactionsOwn : s.reactionsOther]}>
            {reactions.slice(0, 3).map((r, i) => (
              <Text key={i} style={s.reaction}>{r.emoji}</Text>
            ))}
          </View>
        )}
      </Animated.View>
    </>
  );
}

const s = StyleSheet.create({
  wrapper: { marginVertical: 2, marginHorizontal: 8, maxWidth: '82%', flexDirection: 'row', alignItems: 'center' },
  wrapperOwn: { alignSelf: 'flex-end', flexDirection: 'row-reverse' },
  wrapperOther: { alignSelf: 'flex-start' },
  replyArrow: { width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.07)', alignItems: 'center', justifyContent: 'center', marginRight: 4, opacity: 0.8 },
  replyArrowOwn: { marginRight: 0, marginLeft: 4 },
  replyArrowOther: { marginRight: 4 },
  bubble: { borderRadius: 18, paddingHorizontal: 11, paddingTop: 8, paddingBottom: 6, elevation: 1, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, flexShrink: 1 },
  bubbleOwn: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 21, color: '#111' },
  deletedText: { fontSize: 14, fontStyle: 'italic', color: COLORS.gray },
  mediaImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 2 },
  videoPlaceholder: { width: 220, height: 130, borderRadius: 12, backgroundColor: '#1a1a2e', alignItems: 'center', justifyContent: 'center' },
  videoLabel: { color: '#fff', marginTop: 4, fontSize: 13 },

  // Voice player
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 200 },
  playBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  waveBar: { width: 2.5, borderRadius: 2 },
  timeText: { fontSize: 11, fontVariant: ['tabular-nums'], flexShrink: 0 },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  speedBtn: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  speedText: { fontSize: 10, fontWeight: '800' },
  txToggle: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  txToggleText: { fontSize: 10, fontWeight: '600' },
  txBox: { borderTopWidth: 1, marginTop: 6, paddingTop: 6 },
  txHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  txLabel: { fontSize: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  txBody: { fontSize: 12, lineHeight: 18 },

  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.danger, alignItems: 'center', justifyContent: 'center' },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.lightGreen, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  time: { fontSize: 11 },
  timeOwn: { color: '#7a8c7a' },
  timeOther: { color: COLORS.textGray },
  reactions: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: COLORS.border, marginTop: -6, elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2 },
  reactionsOwn: { alignSelf: 'flex-end', marginRight: 8 },
  reactionsOther: { alignSelf: 'flex-start', marginLeft: 8 },
  reaction: { fontSize: 13 },
  replyContainer: { flexDirection: 'row', marginBottom: 6, paddingBottom: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)' },
  replyLine: { width: 3, backgroundColor: COLORS.accent, borderRadius: 1.5, marginRight: 8 },
  replyContent: { flex: 1 },
  replySender: { fontSize: 12, fontWeight: '700', color: COLORS.accent, marginBottom: 2 },
  replyText: { fontSize: 13, color: COLORS.textGray },
  reactionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.25)', justifyContent: 'center', alignItems: 'center' },
  reactionStrip: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, gap: 6, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  reactionStripOwn: { alignSelf: 'flex-end' },
  reactionStripOther: { alignSelf: 'flex-start' },
  reactionBtn: { padding: 4 },
  reactionEmoji: { fontSize: 28 },
  moreBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center' },
});
