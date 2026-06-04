/**
 * Advanced Offline Support & Queue Management
 * Handles offline operations, sync, conflict resolution, and background sync
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';

const KEYS = {
  CONTACTS: 'vc_contacts',
  PHONE_CONTACTS: 'vc_phone_contacts',
  MESSAGES: 'vc_messages_',
  PROFILE: 'vc_profile',
  SETTINGS: 'vc_settings',
  CALL_HISTORY: 'vc_call_history',
  OFFLINE_QUEUE: 'vc_offline_queue',
  DRAFTS: 'vc_drafts_',
  READ_RECEIPTS: 'vc_read_receipts',
  TYPING_CACHE: 'vc_typing_',
  STATUS_CACHE: 'vc_status',
  MEDIA_CACHE: 'vc_media_',
  SYNC_STATE: 'vc_sync_state',
  LAST_SYNC: 'vc_last_sync',
};

const MAX_MESSAGES_PER_CHAT = 500;
const MAX_OFFLINE_QUEUE_SIZE = 1000;
const SYNC_TASK_NAME = 'background-sync';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

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
  } catch (err) {
    console.warn('[Cache] Set failed:', err);
  }
}

class OfflineQueueManager {
  constructor() {
    this.isOnline = true;
    this.syncInProgress = false;
    this.listeners = [];
  }

  async initialize() {
    // Monitor network status
    NetInfo.addEventListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = state.isConnected && state.isInternetReachable;
      
      console.log('[OfflineQueue] Network status:', this.isOnline ? 'Online' : 'Offline');
      
      // Trigger sync when coming back online
      if (!wasOnline && this.isOnline) {
        this.syncQueue();
      }
      
      this.notifyListeners({ isOnline: this.isOnline });
    });

    // Get initial network state
    const state = await NetInfo.fetch();
    this.isOnline = state.isConnected && state.isInternetReachable;

    // Register background sync task
    await this.registerBackgroundSync();

    console.log('[OfflineQueue] Initialized, online:', this.isOnline);
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => listener(data));
  }

  async addToQueue(action, data, priority = 'normal') {
    const queue = await this.getQueue();
    
    // Check queue size limit
    if (queue.length >= MAX_OFFLINE_QUEUE_SIZE) {
      console.warn('[OfflineQueue] Queue full, removing oldest items');
      queue.splice(0, 100); // Remove oldest 100
    }

    const item = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      action,
      data,
      priority,
      attempts: 0,
      maxAttempts: 5,
      queuedAt: Date.now(),
      status: 'pending',
    };

    // Priority queue: high priority items go first
    if (priority === 'high') {
      queue.unshift(item);
    } else {
      queue.push(item);
    }

    await safeSet(KEYS.OFFLINE_QUEUE, queue);
    console.log('[OfflineQueue] Added:', action, '- Total:', queue.length);

    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncQueue();
    }

    return item.id;
  }

  async getQueue() {
    return (await safeGet(KEYS.OFFLINE_QUEUE)) || [];
  }

  async removeFromQueue(itemId) {
    const queue = await this.getQueue();
    const updated = queue.filter(i => i.id !== itemId);
    await safeSet(KEYS.OFFLINE_QUEUE, updated);
    return updated;
  }

  async updateQueueItem(itemId, updates) {
    const queue = await this.getQueue();
    const index = queue.findIndex(i => i.id === itemId);
    
    if (index !== -1) {
      queue[index] = { ...queue[index], ...updates };
      await safeSet(KEYS.OFFLINE_QUEUE, queue);
    }
  }

  async syncQueue() {
    if (this.syncInProgress || !this.isOnline) {
      console.log('[OfflineQueue] Sync skipped:', { syncInProgress: this.syncInProgress, isOnline: this.isOnline });
      return;
    }

    this.syncInProgress = true;
    console.log('[OfflineQueue] Starting sync...');

    try {
      const queue = await this.getQueue();
      const pending = queue.filter(i => i.status === 'pending' && i.attempts < i.maxAttempts);

      console.log('[OfflineQueue] Syncing', pending.length, 'items');

      for (const item of pending) {
        try {
          await this.processQueueItem(item);
          await this.removeFromQueue(item.id);
          console.log('[OfflineQueue] Synced:', item.action);
        } catch (err) {
          console.error('[OfflineQueue] Sync failed:', item.action, err.message);
          
          // Update attempts
          await this.updateQueueItem(item.id, {
            attempts: item.attempts + 1,
            lastError: err.message,
            lastAttempt: Date.now(),
          });

          // Mark as failed if max attempts reached
          if (item.attempts + 1 >= item.maxAttempts) {
            await this.updateQueueItem(item.id, { status: 'failed' });
          }
        }
      }

      // Update last sync time
      await safeSet(KEYS.LAST_SYNC, Date.now());

      console.log('[OfflineQueue] Sync complete');
    } finally {
      this.syncInProgress = false;
    }
  }

  async processQueueItem(item) {
    const { action, data } = item;

    // Import API client
    const { default: api } = await import('./api');

    switch (action) {
      case 'send_message':
        await api.post(`/messages/${data.receiver_id}`, data.message);
        break;

      case 'send_group_message':
        await api.post(`/groups/${data.group_id}/messages`, data.message);
        break;

      case 'mark_read':
        await api.put(`/messages/${data.message_id}/read`);
        break;

      case 'update_profile':
        await api.put('/auth/user/profile', data);
        break;

      case 'delete_message':
        await api.delete(`/messages/${data.message_id}`);
        break;

      case 'send_reaction':
        await api.post(`/messages/${data.message_id}/react`, data);
        break;

      case 'update_settings':
        await api.put('/settings', data);
        break;

      default:
        console.warn('[OfflineQueue] Unknown action:', action);
    }
  }

  async registerBackgroundSync() {
    try {
      TaskManager.defineTask(SYNC_TASK_NAME, async () => {
        console.log('[BackgroundSync] Running background sync');
        await this.syncQueue();
        return BackgroundFetch.BackgroundFetchResult.NewData;
      });

      await BackgroundFetch.registerTaskAsync(SYNC_TASK_NAME, {
        minimumInterval: 15 * 60, // 15 minutes
        stopOnTerminate: false,
        startOnBoot: true,
      });

      console.log('[BackgroundSync] Registered');
    } catch (err) {
      console.warn('[BackgroundSync] Registration failed:', err);
    }
  }

  async clearQueue() {
    await safeSet(KEYS.OFFLINE_QUEUE, []);
    console.log('[OfflineQueue] Cleared');
  }

  async getQueueStats() {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(i => i.status === 'pending').length,
      failed: queue.filter(i => i.status === 'failed').length,
      oldestItem: queue[0]?.queuedAt || null,
    };
  }
}

// Singleton instance
const offlineQueue = new OfflineQueueManager();

export const Cache = {
  // Network status
  isOnline: () => offlineQueue.isOnline,
  onNetworkChange: (callback) => offlineQueue.onStatusChange(callback),

  // Offline queue
  addToOfflineQueue: (action, data, priority) => offlineQueue.addToQueue(action, data, priority),
  getOfflineQueue: () => offlineQueue.getQueue(),
  syncOfflineQueue: () => offlineQueue.syncQueue(),
  clearOfflineQueue: () => offlineQueue.clearQueue(),
  getQueueStats: () => offlineQueue.getQueueStats(),

  // Initialize
  initialize: () => offlineQueue.initialize(),

  // Contacts
  getContacts: () => safeGet(KEYS.CONTACTS),
  setContacts: (contacts) => safeSet(KEYS.CONTACTS, contacts),

  // Phone contacts (synced from device)
  getPhoneContacts: () => safeGet(KEYS.PHONE_CONTACTS),
  setPhoneContacts: (data) => safeSet(KEYS.PHONE_CONTACTS, data),

  // Messages per chat with timestamp tracking
  getMessages: async (chatId) => {
    const data = await safeGet(KEYS.MESSAGES + chatId);
    if (!data) return null;
    
    // Check if cached data is stale
    if (data.cachedAt && Date.now() - data.cachedAt > CACHE_TTL) {
      return null; // Force refresh
    }
    
    return data.messages || data;
  },
  
  setMessages: async (chatId, messages) => {
    const trimmed = Array.isArray(messages)
      ? messages.slice(-MAX_MESSAGES_PER_CHAT)
      : messages;
    await safeSet(KEYS.MESSAGES + chatId, {
      messages: trimmed,
      cachedAt: Date.now(),
    });
  },
  
  appendMessage: async (chatId, message) => {
    const data = await safeGet(KEYS.MESSAGES + chatId);
    const existing = data?.messages || data || [];
    const updated = [...existing, message].slice(-MAX_MESSAGES_PER_CHAT);
    await safeSet(KEYS.MESSAGES + chatId, {
      messages: updated,
      cachedAt: Date.now(),
    });
  },

  // Message drafts
  getDraft: (chatId) => safeGet(KEYS.DRAFTS + chatId),
  saveDraft: (chatId, text) => safeSet(KEYS.DRAFTS + chatId, { text, savedAt: Date.now() }),
  clearDraft: (chatId) => AsyncStorage.removeItem(KEYS.DRAFTS + chatId),

  // Profile
  getProfile: () => safeGet(KEYS.PROFILE),
  setProfile: (profile) => safeSet(KEYS.PROFILE, { ...profile, cachedAt: Date.now() }),

  // Settings
  getSettings: () => safeGet(KEYS.SETTINGS),
  setSettings: (settings) => safeSet(KEYS.SETTINGS, { ...settings, cachedAt: Date.now() }),

  // Call history
  getCallHistory: () => safeGet(KEYS.CALL_HISTORY),
  setCallHistory: (calls) => safeSet(KEYS.CALL_HISTORY, calls),
  addCallToHistory: async (call) => {
    const history = (await safeGet(KEYS.CALL_HISTORY)) || [];
    history.unshift({ ...call, timestamp: Date.now() });
    await safeSet(KEYS.CALL_HISTORY, history.slice(0, 100)); // Keep last 100
  },

  // Read receipts (for offline tracking)
  getReadReceipts: () => safeGet(KEYS.READ_RECEIPTS),
  markAsRead: async (messageId) => {
    const receipts = (await safeGet(KEYS.READ_RECEIPTS)) || {};
    receipts[messageId] = Date.now();
    await safeSet(KEYS.READ_RECEIPTS, receipts);
  },

  // Status updates cache
  getStatusUpdates: () => safeGet(KEYS.STATUS_CACHE),
  setStatusUpdates: (updates) => safeSet(KEYS.STATUS_CACHE, { updates, cachedAt: Date.now() }),

  // Media cache metadata (not the files themselves)
  getMediaMeta: (mediaId) => safeGet(KEYS.MEDIA_CACHE + mediaId),
  setMediaMeta: (mediaId, meta) => safeSet(KEYS.MEDIA_CACHE + mediaId, { ...meta, cachedAt: Date.now() }),

  // Sync state tracking
  getSyncState: () => safeGet(KEYS.SYNC_STATE),
  updateSyncState: async (updates) => {
    const state = (await safeGet(KEYS.SYNC_STATE)) || {};
    await safeSet(KEYS.SYNC_STATE, { ...state, ...updates, lastUpdate: Date.now() });
  },

  // Get last sync time
  getLastSync: () => safeGet(KEYS.LAST_SYNC),

  // Clear all app cache (not auth tokens)
  clearAll: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const vcKeys = keys.filter(k => k.startsWith('vc_') && !k.includes('token') && !k.includes('e2ee'));
      await AsyncStorage.multiRemove(vcKeys);
      console.log('[Cache] Cleared all cache');
    } catch (err) {
      console.warn('[Cache] Clear failed:', err);
    }
  },

  // Clear old cached data
  clearStaleData: async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const vcKeys = keys.filter(k => k.startsWith('vc_messages_') || k.startsWith('vc_media_'));
      
      for (const key of vcKeys) {
        const data = await safeGet(key);
        if (data?.cachedAt && Date.now() - data.cachedAt > CACHE_TTL) {
          await AsyncStorage.removeItem(key);
        }
      }
      
      console.log('[Cache] Cleared stale data');
    } catch (err) {
      console.warn('[Cache] Stale data clear failed:', err);
    }
  },
};

// Export offline queue manager
export { offlineQueue };
