import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from './Avatar';
import { COLORS } from '../config';

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

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <Avatar uri={avatar} name={name} size={50} />
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
    backgroundColor: '#fff',
  },
  info: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border, paddingBottom: 10 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.dark, flex: 1, marginRight: 8 },
  time: { fontSize: 11.5, color: COLORS.textGray, flexShrink: 0 },
  timeUnread: { color: COLORS.accent },
  bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  preview: { fontSize: 13.5, color: COLORS.textGray, flex: 1, marginRight: 8 },
  previewUnread: { color: COLORS.dark, fontWeight: '500' },
  badge: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
});
