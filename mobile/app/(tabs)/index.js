import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, FlatList, TextInput, TouchableOpacity, StyleSheet,
  Text, Modal, SafeAreaView, Alert, ActivityIndicator, Animated, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import ChatListItem from '../../components/ChatListItem';

import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useChatStore, useAuthStore } from '../../services/store';
import { getSocket } from '../../services/socket';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Cache } from '../../services/cache';
import api from '../../services/api';
import { COLORS } from '../../config';

const { width: SW, height: SH } = Dimensions.get('window');
const rf = (n) => n * (SW / 390);

function OfflineBanner({ visible }) {
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [visible]);
  return (
    <Animated.View style={[styles.offlineBanner, { opacity }]} pointerEvents="none">
      <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
      <Text style={styles.offlineText}>You're offline — showing cached chats</Text>
    </Animated.View>
  );
}

export default function ChatsTab() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { contacts, setContacts, unreadCounts, addMessage, updateContactLastMessage } = useChatStore();
  const { isOnline } = useNetworkStatus();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [addPhone, setAddPhone] = useState('');
  const [addName, setAddName] = useState('');
  const [adding, setAdding] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchTimer = useRef(null);

  const loadContacts = useCallback(async () => {
    // Try to load from network first
    if (isOnline !== false) {
      try {
        const { data } = await api.get('/contacts');
        const fetched = data.contacts || [];
        setContacts(fetched);
        await Cache.setContacts(fetched);
        setLoading(false);
        return;
      } catch (e) {
        console.warn('Contacts fetch failed, using cache:', e.message);
      }
    }
    // Fall back to cache
    const cached = await Cache.getContacts();
    if (cached) setContacts(cached);
    setLoading(false);
  }, [isOnline]);

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

  // Live search VipChat users when typing in add modal
  const handleSearchChange = (text) => {
    setAddPhone(text);
    clearTimeout(searchTimer.current);
    if (text.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/contacts/search-users?q=${encodeURIComponent(text)}`);
        setSearchResults(data.users || []);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 400);
  };

  const handleAddContact = async (phone, name) => {
    const phoneVal = phone || addPhone.trim();
    const nameVal = name || addName.trim();
    if (!phoneVal) { Alert.alert('Error', 'Phone number is required'); return; }
    setAdding(true);
    try {
      await api.post('/contacts', {
        phone_number: phoneVal,
        contact_name: nameVal || undefined,
      });
      loadContacts();
      setAddModal(false);
      setAddPhone(''); setAddName(''); setSearchResults([]);
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
    router.push({
      pathname: '/chat/[id]',
      params: { id: contact.contact_user_id || contact.id, name: contact.contact_name || contact.full_name, avatar: contact.avatar_url || '' }
    });
  };

  return (
    <View style={styles.container}>
      <OfflineBanner visible={!isOnline} />

      <View style={styles.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search chats..."
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
              title={search ? 'No chats found' : 'No chats yet'}
              subtitle={search ? 'Try a different search' : 'Go to Contacts tab to start a new chat'}
            />
          }
          contentContainerStyle={filtered.length === 0 ? { flex: 1 } : { paddingBottom: 80 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => setAddModal(true)} activeOpacity={0.85}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>

      {/* Add Contact / New Chat Modal */}
      <Modal visible={addModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Chat</Text>
            <TouchableOpacity onPress={() => { setAddModal(false); setAddPhone(''); setAddName(''); setSearchResults([]); }}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.modalLabel}>Phone Number or Name</Text>
            <View style={styles.searchRow}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                value={addPhone}
                onChangeText={handleSearchChange}
                placeholder="+256701234567 or search name"
                placeholderTextColor={COLORS.gray}
                keyboardType="default"
                autoFocus
                autoCapitalize="none"
              />
              {searchLoading && <ActivityIndicator color={COLORS.accent} style={{ marginLeft: 8 }} />}
            </View>

            {/* Live search results */}
            {searchResults.length > 0 && (
              <View style={styles.searchResultsBox}>
                <Text style={styles.searchResultsLabel}>VipChat users found</Text>
                {searchResults.map(u => (
                  <TouchableOpacity
                    key={u.id}
                    style={styles.searchResultRow}
                    onPress={() => handleAddContact(u.phone_number, u.full_name)}
                  >
                    <Avatar uri={u.avatar_url} name={u.full_name} size={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{u.full_name}</Text>
                      <Text style={styles.searchResultPhone}>{u.phone_number}</Text>
                    </View>
                    <Ionicons name="person-add-outline" size={20} color={COLORS.accent} />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {searchResults.length === 0 && (
              <>
                <Text style={styles.modalLabel}>Name (optional)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={addName}
                  onChangeText={setAddName}
                  placeholder="Contact name"
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="words"
                />
                <TouchableOpacity style={styles.addBtn} onPress={() => handleAddContact()} disabled={adding} activeOpacity={0.85}>
                  {adding ? <ActivityIndicator color="#fff" /> : <Text style={styles.addBtnText}>Add & Start Chat</Text>}
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity style={styles.qrBtn} onPress={() => { setAddModal(false); router.push('/qr'); }}>
              <Ionicons name="qr-code" size={18} color={COLORS.accent} />
              <Text style={styles.qrBtnText}>Scan QR Code</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactsBtn} onPress={() => { setAddModal(false); router.push('/(tabs)/contacts'); }}>
              <Ionicons name="people" size={18} color={COLORS.primary} />
              <Text style={styles.contactsBtnText}>Browse Phone Contacts</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#636E72', paddingVertical: rf(7),
  },
  offlineText: { color: '#fff', fontSize: rf(12.5), fontWeight: '600' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: rf(12), marginVertical: rf(9),
    backgroundColor: COLORS.lightGray, borderRadius: 22,
    paddingHorizontal: rf(14), paddingVertical: rf(10),
  },
  searchInput: { flex: 1, fontSize: rf(15), color: COLORS.dark, paddingVertical: 0 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute', bottom: rf(20), right: rf(20),
    width: rf(58), height: rf(58), borderRadius: rf(29),
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    elevation: 8, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rf(18), paddingVertical: rf(16),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: rf(19), fontWeight: '800', color: COLORS.dark },
  modalBody: { padding: rf(18), gap: 4 },
  modalLabel: { fontSize: rf(13), fontWeight: '700', color: COLORS.dark, marginBottom: 6, marginTop: 10 },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  modalInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    fontSize: rf(15), color: COLORS.dark, paddingHorizontal: rf(16), paddingVertical: rf(14),
    marginBottom: 8,
  },
  searchResultsBox: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    overflow: 'hidden', marginBottom: 8,
  },
  searchResultsLabel: {
    fontSize: rf(11), fontWeight: '700', color: COLORS.textGray,
    paddingHorizontal: rf(14), paddingVertical: 8, backgroundColor: '#F9F9F9',
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  searchResultRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: rf(14), paddingVertical: rf(12),
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border,
  },
  searchResultName: { fontSize: rf(14.5), fontWeight: '600', color: COLORS.dark },
  searchResultPhone: { fontSize: rf(12.5), color: COLORS.textGray },
  addBtn: {
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: rf(16),
    alignItems: 'center', marginTop: 8,
    shadowColor: COLORS.accent, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  addBtnText: { color: '#fff', fontSize: rf(16), fontWeight: '800' },
  qrBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: rf(14), marginTop: 8,
  },
  qrBtnText: { color: COLORS.accent, fontSize: rf(15), fontWeight: '600' },
  contactsBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.primary + '40', borderRadius: 14, paddingVertical: rf(14), marginTop: 8,
    backgroundColor: '#F0FFF4',
  },
  contactsBtnText: { color: COLORS.primary, fontSize: rf(15), fontWeight: '600' },
});
