import React, { useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet, Linking,
  PanResponder, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../config';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function DeliveryTicks({ status }) {
  if (status === 'failed') {
    return <Ionicons name="alert-circle" size={13} color="#FF3B30" />;
  }
  if (status === 'queued') {
    return <Ionicons name="cloud-upload-outline" size={12} color="rgba(0,0,0,0.35)" />;
  }
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
  if (status === 'sent') {
    return <Ionicons name="checkmark" size={12} color="rgba(0,0,0,0.45)" />;
  }
  return <Ionicons name="time-outline" size={10} color="rgba(0,0,0,0.3)" />;
}

const SWIPE_THRESHOLD = 48;

export default function MessageBubble({ message, isOwn, onLongPress, onImagePress, onReply }) {
  const {
    content, media_url, media_type, status, created_at,
    latitude, longitude, location_name,
    contact_name, contact_phone,
    reactions, is_deleted, replied_to,
  } = message;

  const translateX = useRef(new Animated.Value(0)).current;
  const replyTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        replyTriggered.current = false;
      },
      onPanResponderMove: (_, g) => {
        const dx = isOwn ? Math.min(0, g.dx) : Math.max(0, g.dx);
        const clamped = isOwn ? Math.max(dx, -SWIPE_THRESHOLD * 1.4) : Math.min(dx, SWIPE_THRESHOLD * 1.4);
        translateX.setValue(clamped);
        if (!replyTriggered.current && Math.abs(clamped) >= SWIPE_THRESHOLD) {
          replyTriggered.current = true;
          onReply?.(message);
        }
      },
      onPanResponderRelease: () => {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 20,
        }).start();
      },
    })
  ).current;

  const isFailed = status === 'failed';
  const isQueued = status === 'queued';
  const bg = isOwn
    ? isFailed ? '#FFEBEE' : isQueued ? '#F5F5F5' : COLORS.lightGreen
    : '#fff';

  const renderReplyPreview = () => {
    if (!replied_to) return null;
    return (
      <View style={styles.replyContainer}>
        <View style={styles.replyLine} />
        <View style={styles.replyContent}>
          <Text style={styles.replySender}>{replied_to.sender_name || 'Unknown'}</Text>
          <Text style={styles.replyText} numberOfLines={1}>
            {replied_to.content || (replied_to.media_type ? `📎 ${replied_to.media_type}` : 'Message')}
          </Text>
        </View>
      </View>
    );
  };

  const renderContent = () => {
    if (is_deleted) {
      return <Text style={styles.deletedText}>🚫 This message was deleted</Text>;
    }

    if (media_type === 'image' && media_url) {
      return (
        <TouchableOpacity onPress={() => onImagePress?.(media_url)} activeOpacity={0.9}>
          <Image source={{ uri: media_url }} style={styles.mediaImage} resizeMode="cover" />
          {content ? <Text style={[styles.text, { marginTop: 4 }]}>{content}</Text> : null}
        </TouchableOpacity>
      );
    }

    if (media_type === 'video' && media_url) {
      return (
        <View style={styles.videoPlaceholder}>
          <Ionicons name="play-circle" size={40} color="#fff" />
          <Text style={styles.videoLabel}>Video</Text>
        </View>
      );
    }

    if (media_type === 'audio' || media_type === 'voice') {
      return (
        <View style={styles.voiceRow}>
          <View style={styles.voiceIcon}>
            <Ionicons name="mic" size={16} color="#fff" />
          </View>
          <View style={styles.waveform}>
            {[3, 5, 4, 7, 5, 3, 6, 4, 5, 3, 6, 5, 4, 7, 5].map((h, i) => (
              <View key={i} style={[styles.bar, { height: h * 2.2 }]} />
            ))}
          </View>
          <Text style={styles.voiceDuration}>
            {message.duration ? `${Math.floor(message.duration / 60)}:${String(message.duration % 60).padStart(2, '0')}` : '0:00'}
          </Text>
        </View>
      );
    }

    if (latitude && longitude) {
      return (
        <TouchableOpacity
          style={styles.locationCard}
          onPress={() => Linking.openURL(`https://maps.google.com/?q=${latitude},${longitude}`)}
        >
          <View style={styles.locationIcon}>
            <Ionicons name="location" size={20} color="#fff" />
          </View>
          <View>
            <Text style={[styles.text, { fontWeight: '600' }]}>📍 Location</Text>
            {location_name ? <Text style={[styles.text, { color: COLORS.textGray, fontSize: 12 }]}>{location_name}</Text> : null}
          </View>
        </TouchableOpacity>
      );
    }

    if (contact_phone) {
      return (
        <View style={styles.contactCard}>
          <View style={styles.contactIcon}>
            <Ionicons name="person" size={20} color={COLORS.accent} />
          </View>
          <View>
            <Text style={[styles.text, { fontWeight: '600' }]}>{contact_name || 'Contact'}</Text>
            <Text style={[styles.text, { color: COLORS.textGray, fontSize: 12 }]}>{contact_phone}</Text>
          </View>
        </View>
      );
    }

    if (content) {
      return <Text style={styles.text}>{content}</Text>;
    }

    return null;
  };

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.wrapper,
        isOwn ? styles.wrapperOwn : styles.wrapperOther,
        { transform: [{ translateX }] },
      ]}
    >
      <TouchableOpacity
        onLongPress={onLongPress}
        activeOpacity={0.85}
        style={{ flexDirection: isOwn ? 'row-reverse' : 'row', alignItems: 'flex-end' }}
      >
        {/* Reply arrow indicator — shows during swipe */}
        <View style={[styles.replyArrow, isOwn ? styles.replyArrowOwn : styles.replyArrowOther]}>
          <Ionicons name="return-up-back-outline" size={16} color={COLORS.accent} />
        </View>

        <View style={[styles.bubble, { backgroundColor: bg }, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
          {renderReplyPreview()}
          {renderContent()}
          <View style={styles.footer}>
            <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>{formatTime(created_at)}</Text>
            {isOwn && <DeliveryTicks status={status} />}
          </View>
        </View>
      </TouchableOpacity>

      {reactions && reactions.length > 0 && (
        <View style={[styles.reactions, isOwn ? styles.reactionsOwn : styles.reactionsOther]}>
          {reactions.slice(0, 3).map((r, i) => (
            <Text key={i} style={styles.reaction}>{r.emoji}</Text>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginVertical: 2, marginHorizontal: 8, maxWidth: '82%' },
  wrapperOwn: { alignSelf: 'flex-end' },
  wrapperOther: { alignSelf: 'flex-start' },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 11,
    paddingTop: 8,
    paddingBottom: 6,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  bubbleOwn: { borderBottomRightRadius: 4 },
  bubbleOther: { borderBottomLeftRadius: 4 },
  text: { fontSize: 15, lineHeight: 21, color: '#111' },
  deletedText: { fontSize: 14, fontStyle: 'italic', color: COLORS.gray },
  mediaImage: { width: 220, height: 160, borderRadius: 12, marginBottom: 2 },
  videoPlaceholder: {
    width: 220, height: 130, borderRadius: 12, backgroundColor: '#1a1a2e',
    alignItems: 'center', justifyContent: 'center',
  },
  videoLabel: { color: '#fff', marginTop: 4, fontSize: 13 },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 160 },
  voiceIcon: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  waveform: { flexDirection: 'row', alignItems: 'center', gap: 2, flex: 1 },
  bar: { width: 2.5, backgroundColor: COLORS.accent, borderRadius: 2 },
  voiceDuration: { fontSize: 11, color: COLORS.textGray },
  locationCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.danger,
    alignItems: 'center', justifyContent: 'center',
  },
  contactCard: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  contactIcon: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.lightGreen,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 },
  time: { fontSize: 11 },
  timeOwn: { color: '#7a8c7a' },
  timeOther: { color: COLORS.textGray },
  reactions: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderRadius: 10, paddingHorizontal: 5, paddingVertical: 2,
    borderWidth: 1, borderColor: COLORS.border, marginTop: -6,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 2,
  },
  reactionsOwn: { alignSelf: 'flex-end', marginRight: 8 },
  reactionsOther: { alignSelf: 'flex-start', marginLeft: 8 },
  reaction: { fontSize: 13 },
  replyContainer: {
    flexDirection: 'row', marginBottom: 6, paddingBottom: 6,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  replyLine: { width: 3, backgroundColor: COLORS.accent, borderRadius: 1.5, marginRight: 8 },
  replyContent: { flex: 1 },
  replySender: { fontSize: 12, fontWeight: '700', color: COLORS.accent, marginBottom: 2 },
  replyText: { fontSize: 13, color: COLORS.textGray },
  replyArrow: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.06)',
    alignItems: 'center', justifyContent: 'center', alignSelf: 'center',
    opacity: 0.7, marginHorizontal: 2,
  },
  replyArrowOwn: { marginLeft: 4 },
  replyArrowOther: { marginRight: 4 },
});
