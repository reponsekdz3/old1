import React, { useEffect, useState, useCallback } from 'react';
import {
  View, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Text, Modal, SafeAreaView, Alert, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ChatListItem from '../../components/ChatListItem';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useChatStore, useAuthStore } from '../../services/store';
import { getSocket } from '../../services/socket';
import api from '../../services/api';
import { COLORS } from '../../config';

export default function ChatsTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { contacts, setContacts, unreadCounts, addMessage, updateContactLastMessage } = useChatStore();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [addPhone, setAddPhone] = useState('');
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      const { data } = await api.get('/contacts');
      setContacts(data.contacts || []);
    } catch (e) {
      console.warn('Failed to load contacts:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadContacts(); }, [loadContacts]));

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (msg) => {
      const chatId = msg.sender_id === user?.id ? msg.receiver_id : msg.sender_id;
      addMessage(chatId, msg);
      updateContactLastMessage(chatId, msg.content || '[attachment]', msg.created_at);
    };

    socket.on('new_message', onNewMessage);
    return () => socket.off('new_message', onNewMessage);
  }, [user?.id]);

  const handleAddContact = async () => {
    if (!addPhone.trim()) { Alert.alert('Error', 'Phone number is required'); return; }
    setAdding(true);
    try {
      const { data } = await api.post('/contacts', {
        phone_number: addPhone.trim(),
        contact_name: addName.trim() || undefined,
      });
      loadContacts();
      setAddModal(false);
      setAddPhone(''); setAddName('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add contact');
    } finally {
      setAdding(false);
    }
  };

  const filtered = contacts.filter(c => {
    const name = (c.contact_name || c.full_name || '').toLowerCase();
    const phone = (c.phone_number || '').toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || phone.includes(q);
  });

  const openChat = (contact) => {
    router.push({ pathname: '/chat/[id]', params: { id: contact.contact_user_id || contact.id, name: contact.contact_name || contact.full_name, avatar: contact.avatar_url || '' } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search contacts..."
          placeholderTextColor={COLORS.gray}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={16} color={COLORS.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id || item.contact_user_id}
          renderItem={({ item }) => (
            <ChatListItem
              contact={item}
              lastMessage={item.lastMessage}
              unread={unreadCounts[item.contact_user_id] || 0}
              onPress={() => openChat(item)}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon="💬"
              title={search ? 'No contacts found' : 'No chats yet'}
              subtitle={search ? 'Try a different search' : 'Add a contact to start chatting'}
            />
          }
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setAddModal(true)} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Chat</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); setAddPhone(''); setAddName(''); }}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>Phone Number</Text>
            <TextInput
              style={styles.modalInput}
              value={addPhone}
              onChangeText={setAddPhone}
              placeholder="+256701234567"
              placeholderTextColor={COLORS.gray}
              keyboardType="phone-pad"
              autoFocus
            />
            <Text style={styles.modalLabel}>Name (optional)</Text>
            <TextInput
              style={styles.modalInput}
              value={addName}
              onChangeText={setAddName}
              placeholder="Contact name"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="words"
            />
            <TouchableOpacity style={styles.addBtn} onPress={handleAddContact} disabled={adding} activeOpacity={0.85}>
              {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Add Contact</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.qrBtn} onPress={() => { setAddModal(false); router.push('/qr'); }}>
              <Ionicons name="qr-code" size={18} color={COLORS.accent} />
              <Text style={styles.qrBtnText}>Scan QR Code</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    margin: 10, backgroundColor: COLORS.lightGray, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.dark },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute', bottom: 20, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 6, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  modalBody: { padding: 20, gap: 12 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 4 },
  modalInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    fontSize: 15, color: COLORS.dark, paddingHorizontal: 16, paddingVertical: 13,
    marginBottom: 8,
  },
  addBtn: {
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 15,
    alignItems: 'center', marginTop: 8,
  },
  addBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 13, marginTop: 8,
  },
  qrBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
});
