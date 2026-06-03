import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Modal, SafeAreaView, TextInput,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useCallStore } from '../../services/store';
import { getSocket } from '../../services/socket';
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

function formatDuration(secs) {
  if (!secs) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CallDirectionIcon({ type, direction, isMissed }) {
  const color = isMissed ? COLORS.danger : COLORS.accent;
  let arrowIcon = 'arrow-up-outline';
  if (direction === 'incoming') arrowIcon = 'arrow-down-outline';
  if (isMissed) arrowIcon = 'close-outline';

  return (
    <View style={[cs.callTypeBadge, { backgroundColor: color + '15' }]}>
      <Ionicons name={type === 'video' ? 'videocam' : 'call'} size={15} color={color} />
    </View>
  );
}

function initiateCall(contact, callType, socket) {
  if (!socket) {
    Alert.alert('Not connected', 'Cannot make calls right now');
    return;
  }
  Alert.alert(
    `Start ${callType === 'video' ? 'Video' : 'Voice'} Call`,
    `Call ${contact.name || 'this contact'}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Call',
        onPress: () => {
          socket.emit('call_offer', {
            callee_id: contact.id,
            call_type: callType,
          });
        },
      },
    ]
  );
}

export default function CallsTab() {
  const { callHistory, setCallHistory } = useCallStore();
  const [loading, setLoading] = useState(true);
  const [newCallModal, setNewCallModal] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [loadingContacts, setLoadingContacts] = useState(false);

  const socket = getSocket();

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

  const loadContactsForCall = async () => {
    setLoadingContacts(true);
    try {
      const { data } = await api.get('/contacts');
      setContacts(data.contacts || []);
    } catch {}
    finally { setLoadingContacts(false); }
  };

  const openNewCall = () => {
    setNewCallModal(true);
    loadContactsForCall();
  };

  const filteredContacts = contacts.filter(c => {
    const name = (c.contact_name || c.full_name || '').toLowerCase();
    const phone = (c.phone_number || '').toLowerCase();
    return name.includes(search.toLowerCase()) || phone.includes(search.toLowerCase());
  });

  const renderCall = ({ item }) => {
    const name = item.caller_name || item.callee_name || 'Unknown';
    const avatar = item.caller_avatar || item.callee_avatar;
    const duration = formatDuration(item.duration);
    const isMissed = item.status === 'missed' || item.status === 'rejected';
    const direction = isMissed ? 'missed' : item.direction || 'outgoing';

    return (
      <View style={cs.row}>
        <Avatar uri={avatar} name={name} size={50} />
        <View style={{ flex: 1 }}>
          <Text style={[cs.name, isMissed && { color: COLORS.danger }]}>{name}</Text>
          <View style={cs.detailRow}>
            <Ionicons
              name={direction === 'incoming' ? 'arrow-down-outline' : isMissed ? 'close-outline' : 'arrow-up-outline'}
              size={12}
              color={isMissed ? COLORS.danger : COLORS.textGray}
            />
            <Text style={[cs.detail, isMissed && { color: COLORS.danger }]}>
              {item.call_type === 'video' ? 'Video' : 'Voice'} call
              {duration ? ` · ${duration}` : isMissed ? ' · Missed' : ''}
            </Text>
          </View>
          <Text style={cs.time}>{formatCallTime(item.created_at)}</Text>
        </View>
        <View style={cs.rightActions}>
          <CallDirectionIcon type={item.call_type} direction={direction} isMissed={isMissed} />
          <View style={cs.callBackBtns}>
            <TouchableOpacity
              style={cs.callBackBtn}
              onPress={() => initiateCall({ id: item.caller_id || item.callee_id, name }, 'audio', socket)}
            >
              <Ionicons name="call" size={18} color={COLORS.accent} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[cs.callBackBtn, { marginLeft: 4 }]}
              onPress={() => initiateCall({ id: item.caller_id || item.callee_id, name }, 'video', socket)}
            >
              <Ionicons name="videocam" size={18} color="#007AFF" />
            </TouchableOpacity>
          </View>
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
              subtitle="Start a voice or video call with your contacts"
            />
          }
          contentContainerStyle={callHistory.length === 0 ? { flex: 1 } : { paddingBottom: 80 }}
          ItemSeparatorComponent={() => <View style={cs.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* New Call FAB */}
      <TouchableOpacity style={cs.fab} onPress={openNewCall} activeOpacity={0.85}>
        <Ionicons name="call" size={24} color="#fff" />
      </TouchableOpacity>

      {/* New Call Modal */}
      <Modal visible={newCallModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={cs.modal}>
          <View style={cs.modalHeader}>
            <Text style={cs.modalTitle}>New Call</Text>
            <TouchableOpacity onPress={() => { setNewCallModal(false); setSearch(''); }}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
          </View>

          <View style={cs.searchBar}>
            <Ionicons name="search" size={16} color={COLORS.gray} />
            <TextInput
              style={cs.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search contacts..."
              placeholderTextColor={COLORS.gray}
              autoFocus
            />
          </View>

          {loadingContacts ? (
            <View style={cs.loadingBox}><ActivityIndicator color={COLORS.accent} /></View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={c => c.id || c.contact_user_id}
              renderItem={({ item }) => {
                const name = item.contact_name || item.full_name || 'Unknown';
                const cId = item.contact_user_id || item.id;
                return (
                  <View style={cs.contactRow}>
                    <Avatar uri={item.avatar_url} name={name} size={46} />
                    <View style={{ flex: 1 }}>
                      <Text style={cs.contactName}>{name}</Text>
                      <Text style={cs.contactPhone}>{item.phone_number}</Text>
                    </View>
                    <TouchableOpacity
                      style={[cs.callBtn, { backgroundColor: '#E8F5E9' }]}
                      onPress={() => { setNewCallModal(false); initiateCall({ id: cId, name }, 'audio', socket); }}
                    >
                      <Ionicons name="call" size={20} color={COLORS.accent} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[cs.callBtn, { backgroundColor: '#E3F2FD', marginLeft: 6 }]}
                      onPress={() => { setNewCallModal(false); initiateCall({ id: cId, name }, 'video', socket); }}
                    >
                      <Ionicons name="videocam" size={20} color="#007AFF" />
                    </TouchableOpacity>
                  </View>
                );
              }}
              ListEmptyComponent={
                <Text style={{ textAlign: 'center', color: COLORS.gray, marginTop: 40, fontSize: 14 }}>
                  {search ? 'No contacts found' : 'No contacts yet'}
                </Text>
              }
              contentContainerStyle={{ paddingBottom: 20 }}
            />
          )}
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.dark },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  detail: { fontSize: 13, color: COLORS.textGray },
  time: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  rightActions: { alignItems: 'center', gap: 6 },
  callTypeBadge: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  callBackBtns: { flexDirection: 'row' },
  callBackBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: 78 },

  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },

  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark },

  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, backgroundColor: COLORS.lightGray, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.dark },

  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  contactName: { fontSize: 15, fontWeight: '600', color: COLORS.dark },
  contactPhone: { fontSize: 13, color: COLORS.textGray, marginTop: 1 },
  callBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
