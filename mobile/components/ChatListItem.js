import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Avatar from './Avatar';
import { COLORS } from '../config';

const { width: SW } = Dimensions.get('window');
const rf = (n) => n * (SW / 390);

function formatTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.getDate() === yesterday.getDate()) return 'Yesterday';
  if (diff < 7 * 86400000) {
    return d.toLocaleDateString([], { weekday: 'short' });
  }
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function previewContent(msg) {
  if (!msg) return 'Tap to start chatting';
  if (msg.media_type === 'image') return '📷 Photo';
  if (msg.media_type === 'video') return '🎥 Video';
  if (msg.media_type === 'audio' || msg.media_type === 'voice') return '🎤 Voice message';
  if (msg.media_type === 'document') return '📎 Document';
  if (msg.latitude) return '📍 Location';
  if (msg.contact_phone) return '👤 Contact';
  return msg.content || '';
}

export default function ChatListItem({ contact, lastMessage, unread = 0, onPress }) {
  const name = contact.contact_name || contact.full_name || contact.name || 'Unknown';
  const avatar = contact.avatar_url;
  const time = lastMessage?.created_at || contact.lastMessageTime;
  const preview = previewContent(lastMessage);
  const isOnline = contact.is_online;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <Avatar uri={avatar} name={name} size={50} />
        {isOnline && <View style={styles.onlineDot} />}
      </View>
      <View style={styles.info}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={[styles.time, unread > 0 && styles.timeUnread]}>{formatTime(time)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, unread > 0 && styles.previewUnread]} numberOfLines={1}>
            {preview}
          </Text>
          {unread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rf(16),
    paddingVertical: rf(10),
    gap: rf(12),
    backgroundColor: '#fff',
  },
  info: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingBottom: rf(10) },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: rf(3) },
  name: { fontSize: rf(16), fontWeight: '600', color: COLORS.dark, flex: 1, marginRight: rf(8) },
  time: { fontSize: rf(11.5), color: COLORS.textGray, flexShrink: 0 },
  timeUnread: { color: COLORS.accent },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: rf(13.5), color: COLORS.textGray, flex: 1, marginRight: rf(8) },
  previewUnread: { color: COLORS.dark, fontWeight: '500' },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: rf(10),
    minWidth: rf(20),
    height: rf(20),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: rf(5),
  },
  badgeText: { color: '#fff', fontSize: rf(11), fontWeight: '800' },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: rf(13), height: rf(13), borderRadius: rf(7),
    backgroundColor: '#34C759', borderWidth: 2, borderColor: '#fff',
  },
});
