import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, SectionList, Share, TextInput, Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { usePhoneContactsStore, useChatStore } from '../../services/store';
import { syncPhoneContacts } from '../../services/phoneContacts';
import api from '../../services/api';
import { COLORS } from '../../config';

const { width: SW } = Dimensions.get('window');
const rf = (n) => n * (SW / 390);

function formatLastSynced(ts) {
  if (!ts) return null;
  const diff = Date.now() - ts;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

export default function ContactsTab() {
  const router = useRouter();
  const store = usePhoneContactsStore();
  const { addContact } = useChatStore();
  const [search, setSearch] = useState('');
  const [addingId, setAddingId] = useState(null);

  const doSync = useCallback(async (force = false) => {
    store.setSyncing(true);
    try {
      const result = await syncPhoneContacts({ force });
      store.setPhoneContacts({
        vipchatContacts: result.vipchatContacts || [],
        phoneOnlyContacts: result.phoneOnlyContacts || [],
        lastSynced: result.lastSynced,
        granted: result.granted,
      });
      if (result.granted === false) {
        Alert.alert(
          'Contacts Permission',
          'VipChat needs access to your contacts to show which friends are on VipChat. Enable it in Settings.',
          [{ text: 'OK' }]
        );
      }
    } catch (e) {
      console.warn('Sync error:', e.message);
    } finally {
      store.setSyncing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { doSync(false); }, [doSync]));

  const addToVipChat = async (contact) => {
    setAddingId(contact.id);
    try {
      const { data } = await api.post('/contacts', {
        phone_number: contact.phone_number || contact.normalized_phone,
        contact_name: contact.contact_name || contact.full_name,
      });
      addContact(data);
      Alert.alert('Added!', `${contact.contact_name || contact.full_name} added to your VipChat contacts.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to add contact');
    } finally {
      setAddingId(null);
    }
  };

  const openChat = (contact) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: contact.contact_user_id || contact.id,
        name: contact.contact_name || contact.full_name,
        avatar: contact.avatar_url || '',
      },
    });
  };

  const inviteContact = async (contact) => {
    try {
      await Share.share({
        message: `Hey ${contact.name}! I'm using VipChat to message. It's fast, secure, and free! Get it at vipchat.app`,
        title: 'Invite to VipChat',
      });
    } catch {}
  };

  const q = search.toLowerCase();
  const filteredVipchat = store.vipchatContacts.filter(c =>
    (c.contact_name || c.full_name || '').toLowerCase().includes(q) ||
    (c.phone_number || '').includes(q)
  );
  const filteredPhone = store.phoneOnlyContacts.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.phoneNumber || '').includes(q)
  );

  const sections = [];
  if (filteredVipchat.length > 0) {
    sections.push({ title: `ON VIPCHAT (${filteredVipchat.length})`, data: filteredVipchat, type: 'vipchat' });
  }
  if (filteredPhone.length > 0) {
    sections.push({ title: `INVITE TO VIPCHAT (${filteredPhone.length})`, data: filteredPhone, type: 'phone' });
  }

  const renderVipchatContact = (item) => (
    <TouchableOpacity style={cs.row} onPress={() => openChat(item)} activeOpacity={0.7}>
      <View style={{ position: 'relative' }}>
        <Avatar uri={item.avatar_url} name={item.contact_name || item.full_name} size={48} />
        {item.is_online && <View style={cs.onlineDot} />}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cs.name}>{item.contact_name || item.full_name}</Text>
        <Text style={cs.sub} numberOfLines={1}>{item.about || 'Hey there! I am using VipChat.'}</Text>
      </View>
      <View style={cs.actions}>
        <TouchableOpacity
          style={cs.actionBtn}
          onPress={() => openChat(item)}
        >
          <Ionicons name="chatbubble-ellipses" size={18} color={COLORS.accent} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[cs.actionBtn, { marginLeft: 4 }]}
          onPress={() => addToVipChat(item)}
          disabled={addingId === item.id}
        >
          {addingId === item.id
            ? <ActivityIndicator size="small" color={COLORS.primary} />
            : <Ionicons name="person-add" size={18} color={COLORS.primary} />}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderPhoneContact = (item) => (
    <View style={cs.row}>
      <View style={cs.phoneAvatar}>
        <Text style={cs.phoneInitial}>{(item.name || '?')[0].toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={cs.name}>{item.name}</Text>
        <Text style={cs.sub}>{item.phoneNumber}</Text>
      </View>
      <TouchableOpacity
        style={[cs.inviteBtn]}
        onPress={() => inviteContact(item)}
      >
        <Text style={cs.inviteBtnText}>Invite</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={cs.container}>
      {/* Search */}
      <View style={cs.searchBar}>
        <Ionicons name="search" size={16} color={COLORS.gray} />
        <TextInput
          style={cs.searchInput}
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

      {/* Sync status bar */}
      <View style={cs.syncBar}>
        <Text style={cs.syncText}>
          {store.syncing
            ? 'Syncing contacts...'
            : store.lastSynced
              ? `Synced ${formatLastSynced(store.lastSynced)}`
              : 'Tap ↻ to sync contacts'}
        </Text>
        <TouchableOpacity
          style={cs.syncBtn}
          onPress={() => doSync(true)}
          disabled={store.syncing}
        >
          {store.syncing
            ? <ActivityIndicator size="small" color={COLORS.accent} />
            : <Ionicons name="refresh" size={18} color={COLORS.accent} />}
        </TouchableOpacity>
      </View>

      {store.syncing && sections.length === 0 ? (
        <View style={cs.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>
      ) : sections.length === 0 ? (
        <EmptyState
          icon="👥"
          title={store.permissionGranted === false ? 'Contacts permission denied' : 'No contacts found'}
          subtitle={
            store.permissionGranted === false
              ? 'Go to Settings and allow Contacts access to see which friends are on VipChat'
              : 'Tap the refresh button to sync your phone contacts'
          }
        />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, i) => item.id || item.phoneNumber || String(i)}
          renderSectionHeader={({ section }) => (
            <View style={cs.sectionHeader}>
              <Text style={cs.sectionTitle}>{section.title}</Text>
            </View>
          )}
          renderItem={({ item, section }) =>
            section.type === 'vipchat'
              ? renderVipchatContact(item)
              : renderPhoneContact(item)
          }
          ItemSeparatorComponent={() => <View style={cs.sep} />}
          contentContainerStyle={{ paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
        />
      )}
    </View>
  );
}

const cs = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: rf(12), marginVertical: rf(9),
    backgroundColor: COLORS.lightGray, borderRadius: 22,
    paddingHorizontal: rf(14), paddingVertical: rf(10),
  },
  searchInput: { flex: 1, fontSize: rf(15), color: COLORS.dark, paddingVertical: 0 },

  syncBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: rf(16), paddingVertical: rf(7), backgroundColor: '#F9FFF9',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  syncText: { fontSize: rf(12.5), color: COLORS.textGray },
  syncBtn: { padding: rf(5) },

  sectionHeader: {
    backgroundColor: '#F2F2F7', paddingHorizontal: rf(16), paddingVertical: rf(8),
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  sectionTitle: { fontSize: rf(11.5), fontWeight: '700', color: COLORS.textGray, letterSpacing: 0.5, textTransform: 'uppercase' },

  row: { flexDirection: 'row', alignItems: 'center', gap: rf(12), paddingHorizontal: rf(16), paddingVertical: rf(12) },
  name: { fontSize: rf(15.5), fontWeight: '600', color: COLORS.dark },
  sub: { fontSize: rf(13), color: COLORS.textGray, marginTop: rf(2) },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border, marginLeft: rf(76) },

  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: rf(13), height: rf(13), borderRadius: rf(7),
    backgroundColor: '#34C759', borderWidth: 2, borderColor: '#fff',
  },

  actions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: {
    width: rf(38), height: rf(38), borderRadius: rf(19),
    backgroundColor: '#F0FFF4', alignItems: 'center', justifyContent: 'center',
  },

  phoneAvatar: {
    width: rf(50), height: rf(50), borderRadius: rf(25), backgroundColor: COLORS.lightGray,
    alignItems: 'center', justifyContent: 'center',
  },
  phoneInitial: { fontSize: rf(20), fontWeight: '700', color: COLORS.textGray },

  inviteBtn: {
    paddingHorizontal: rf(16), paddingVertical: rf(8), borderRadius: rf(20),
    backgroundColor: '#E8F5E9', borderWidth: 1, borderColor: COLORS.accent,
  },
  inviteBtnText: { fontSize: rf(13.5), fontWeight: '700', color: COLORS.accent },
});
