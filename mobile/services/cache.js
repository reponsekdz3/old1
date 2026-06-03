import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  CONTACTS: 'vc_contacts',
  PHONE_CONTACTS: 'vc_phone_contacts',
  MESSAGES: 'vc_messages_',
  PROFILE: 'vc_profile',
  SETTINGS: 'vc_settings',
  CALL_HISTORY: 'vc_call_history',
  OFFLINE_QUEUE: 'vc_offline_queue',
};

const MAX_MESSAGES_PER_CHAT = 200;

async function safeGet(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function safeSet(key, value) {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export const Cache = {
  // Contacts
  getContacts: () => safeGet(KEYS.CONTACTS),
  setContacts: (contacts) => safeSet(KEYS.CONTACTS, contacts),

  // Phone contacts (synced from device)
  getPhoneContacts: () => safeGet(KEYS.PHONE_CONTACTS),
  setPhoneContacts: (data) => safeSet(KEYS.PHONE_CONTACTS, data),

  // Messages per chat
  getMessages: (chatId) => safeGet(KEYS.MESSAGES + chatId),
  setMessages: async (chatId, messages) => {
    const trimmed = Array.isArray(messages)
      ? messages.slice(-MAX_MESSAGES_PER_CHAT)
      : messages;
    await safeSet(KEYS.MESSAGES + chatId, trimmed);
  },
  appendMessage: async (chatId, message) => {
    const existing = (await safeGet(KEYS.MESSAGES + chatId)) || [];
    const updated = [...existing, message].slice(-MAX_MESSAGES_PER_CHAT);
    await safeSet(KEYS.MESSAGES + chatId, updated);
  },

  // Profile
  getProfile: () => safeGet(KEYS.PROFILE),
  setProfile: (profile) => safeSet(KEYS.PROFILE, profile),

  // Settings
  getSettings: () => safeGet(KEYS.SETTINGS),
  setSettings: (settings) => safeSet(KEYS.SETTINGS, settings),

  // Call history
  getCallHistory: () => safeGet(KEYS.CALL_HISTORY),
  setCallHistory: (calls) => safeSet(KEYS.CALL_HISTORY, calls),

  // Offline message queue
  getOfflineQueue: async () => (await safeGet(KEYS.OFFLINE_QUEUE)) || [],
  addToOfflineQueue: async (item) => {
    const queue = (await safeGet(KEYS.OFFLINE_QUEUE)) || [];
    const updated = [...queue, { ...item, queuedAt: Date.now(), id: Math.random().toString(36).slice(2) }];
    await safeSet(KEYS.OFFLINE_QUEUE, updated);
    return updated;
  },
  removeFromOfflineQueue: async (itemId) => {
    const queue = (await safeGet(KEYS.OFFLINE_QUEUE)) || [];
    const updated = queue.filter(i => i.id !== itemId);
    await safeSet(KEYS.OFFLINE_QUEUE, updated);
    return updated;
  },
  clearOfflineQueue: () => safeSet(KEYS.OFFLINE_QUEUE, []),

  // Clear all app cache (not auth tokens)
  clearAll: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const vcKeys = keys.filter(k => k.startsWith('vc_'));
      await AsyncStorage.multiRemove(vcKeys);
    } catch {}
  },
};
