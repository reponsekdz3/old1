import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useCallStore } from '../../services/store';
import api from '../../services/api';
import { COLORS } from '../../config';

function formatCallTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000 && d.getDate() === now.getDate()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff < 7 * 86400000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function CallIcon({ type, direction }) {
  const color = direction === 'missed' ? COLORS.danger : COLORS.accent;
  const icon = direction === 'incoming' ? 'call-received' : direction === 'outgoing' ? 'call-made' : 'call-missed';
  return (
    <View style={[cs.callBadge, { backgroundColor: color + '20' }]}>
      <Ionicons name={type === 'video' ? 'videocam' : 'call'} size={16} color={color} />
    </View>
  );
}

export default function CallsTab() {
  const { callHistory, setCallHistory } = useCallStore();
  const [loading, setLoading] = useState(true);

  const loadCalls = useCallback(async () => {
    try {
      const { data } = await api.get('/calls/history');
      setCallHistory(data.calls || []);
    } catch (e) {
      console.warn('Failed to load calls:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadCalls(); }, [loadCalls]));

  const renderCall = ({ item }) => {
    const name = item.caller_name || item.callee_name || 'Unknown';
    const avatar = item.caller_avatar || item.callee_avatar;
    const duration = item.duration ? `${Math.floor(item.duration / 60)}:${String(item.duration % 60).padStart(2, '0')}` : null;
    const isMissed = item.status === 'missed' || item.status === 'rejected';
    const direction = isMissed ? 'missed' : item.direction || 'outgoing';

    return (
      <View style={cs.row}>
        <Avatar uri={avatar} name={name} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={[cs.name, isMissed && { color: COLORS.danger }]}>{name}</Text>
          <View style={cs.detailRow}>
            <Ionicons
              name={direction === 'incoming' ? 'arrow-down-outline' : direction === 'outgoing' ? 'arrow-up-outline' : 'close-outline'}
              size={12}
              color={isMissed ? COLORS.danger : COLORS.textGray}
            />
            <Text style={[cs.detail, isMissed && { color: COLORS.danger }]}>
              {item.call_type === 'video' ? 'Video call' : 'Voice call'}
              {duration ? ` · ${duration}` : ''}
            </Text>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={cs.time}>{formatCallTime(item.created_at)}</Text>
          <CallIcon type={item.call_type} direction={direction} />
        </View>
      </View>
    );
  };

  return (
    <View style={cs.container}>
      {loading ? (
        <View style={cs.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={callHistory}
          keyExtractor={(item, i) => item.id || String(i)}
          renderItem={renderCall}
          ListEmptyComponent={
            <EmptyState
              icon="📞"
              title="No calls yet"
              subtitle="Your call history will appear here when you make or receive calls"
            />
          }
          contentContainerStyle={callHistory.length === 0 ? { flex: 1 } : undefined}
          ItemSeparatorComponent={() => <View style={cs.separator} />}
        />
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.dark },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  detail: { fontSize: 13, color: COLORS.textGray },
  time: { fontSize: 12, color: COLORS.textGray },
  callBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 76 },
});
