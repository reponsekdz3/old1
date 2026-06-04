/**
 * Web Offline Support & Queue Management
 * IndexedDB-based offline storage with Service Worker integration
 */

class OfflineManager {
  constructor() {
    this.db = null;
    this.isOnline = navigator.onLine;
    this.syncInProgress = false;
    this.listeners = [];
    this.dbName = 'VipChatDB';
    this.version = 1;
  }

  async initialize() {
    // Open IndexedDB
    await this.openDatabase();

    // Monitor network status
    window.addEventListener('online', () => {
      console.log('[Offline] Network: Online');
      this.isOnline = true;
      this.notifyListeners({ isOnline: true });
      this.syncQueue();
    });

    window.addEventListener('offline', () => {
      console.log('[Offline] Network: Offline');
      this.isOnline = false;
      this.notifyListeners({ isOnline: false });
    });

    // Register service worker
    await this.registerServiceWorker();

    console.log('[Offline] Initialized, online:', this.isOnline);
  }

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains('messages')) {
          const messageStore = db.createObjectStore('messages', { keyPath: 'id', autoIncrement: true });
          messageStore.createIndex('chatId', 'chatId', { unique: false });
          messageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('priority', 'priority', { unique: false });
        }

        if (!db.objectStoreNames.contains('drafts')) {
          db.createObjectStore('drafts', { keyPath: 'chatId' });
        }

        if (!db.objectStoreNames.contains('contacts')) {
          db.createObjectStore('contacts', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('media')) {
          const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
          mediaStore.createIndex('messageId', 'messageId', { unique: false });
        }
      };
    });
  }

  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        console.log('[ServiceWorker] Registered:', registration.scope);

        // Listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'SYNC_COMPLETE') {
            console.log('[ServiceWorker] Sync complete');
            this.notifyListeners({ syncComplete: true });
          }
        });
      } catch (err) {
        console.warn('[ServiceWorker] Registration failed:', err);
      }
    }
  }

  onStatusChange(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (err) {
        console.error('[Offline] Listener error:', err);
      }
    });
  }

  // Queue Management
  async addToQueue(action, data, priority = 'normal') {
    const transaction = this.db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');

    const item = {
      action,
      data,
      priority,
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
      queuedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => {
        console.log('[Offline] Added to queue:', action);
        resolve(request.result);

        // Try to sync if online
        if (this.isOnline) {
          this.syncQueue();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getQueue() {
    const transaction = this.db.transaction(['queue'], 'readonly');
    const store = transaction.objectStore('queue');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeFromQueue(id) {
    const transaction = this.db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async updateQueueItem(id, updates) {
    const transaction = this.db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);
      
      getRequest.onsuccess = () => {
        const item = getRequest.result;
        if (item) {
          const updated = { ...item, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async syncQueue() {
    if (this.syncInProgress || !this.isOnline) {
      return;
    }

    this.syncInProgress = true;
    console.log('[Offline] Starting sync...');

    try {
      const queue = await this.getQueue();
      const pending = queue.filter(i => i.status === 'pending' && i.attempts < i.maxAttempts);

      console.log('[Offline] Syncing', pending.length, 'items');

      for (const item of pending) {
        try {
          await this.processQueueItem(item);
          await this.removeFromQueue(item.id);
          console.log('[Offline] Synced:', item.action);
        } catch (err) {
          console.error('[Offline] Sync failed:', item.action, err.message);

          await this.updateQueueItem(item.id, {
            attempts: item.attempts + 1,
            lastError: err.message,
            lastAttempt: Date.now(),
            status: item.attempts + 1 >= item.maxAttempts ? 'failed' : 'pending',
          });
        }
      }

      console.log('[Offline] Sync complete');
      this.notifyListeners({ syncComplete: true });
    } finally {
      this.syncInProgress = false;
    }
  }

  async processQueueItem(item) {
    const { action, data } = item;

    // Import API client dynamically
    const api = (await import('./api')).default;

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
        console.warn('[Offline] Unknown action:', action);
    }
  }

  // Message Storage
  async saveMessage(chatId, message) {
    const transaction = this.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');

    const item = {
      ...message,
      chatId,
      timestamp: message.timestamp || Date.now(),
      cached: true,
    };

    return new Promise((resolve, reject) => {
      const request = store.add(item);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getMessages(chatId, limit = 100) {
    const transaction = this.db.transaction(['messages'], 'readonly');
    const store = transaction.objectStore('messages');
    const index = store.index('chatId');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only(chatId));
      request.onsuccess = () => {
        const messages = request.result.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearMessages(chatId) {
    const transaction = this.db.transaction(['messages'], 'readwrite');
    const store = transaction.objectStore('messages');
    const index = store.index('chatId');

    return new Promise((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.only(chatId));
      
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Draft Management
  async saveDraft(chatId, text) {
    const transaction = this.db.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');

    return new Promise((resolve, reject) => {
      const request = store.put({ chatId, text, savedAt: Date.now() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getDraft(chatId) {
    const transaction = this.db.transaction(['drafts'], 'readonly');
    const store = transaction.objectStore('drafts');

    return new Promise((resolve, reject) => {
      const request = store.get(chatId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearDraft(chatId) {
    const transaction = this.db.transaction(['drafts'], 'readwrite');
    const store = transaction.objectStore('drafts');

    return new Promise((resolve, reject) => {
      const request = store.delete(chatId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Contact Storage
  async saveContact(contact) {
    const transaction = this.db.transaction(['contacts'], 'readwrite');
    const store = transaction.objectStore('contacts');

    return new Promise((resolve, reject) => {
      const request = store.put(contact);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getContacts() {
    const transaction = this.db.transaction(['contacts'], 'readonly');
    const store = transaction.objectStore('contacts');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Media Caching
  async cacheMedia(mediaId, messageId, blob, metadata) {
    const transaction = this.db.transaction(['media'], 'readwrite');
    const store = transaction.objectStore('media');

    return new Promise((resolve, reject) => {
      const request = store.put({
        id: mediaId,
        messageId,
        blob,
        metadata,
        cachedAt: Date.now(),
      });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getMedia(mediaId) {
    const transaction = this.db.transaction(['media'], 'readonly');
    const store = transaction.objectStore('media');

    return new Promise((resolve, reject) => {
      const request = store.get(mediaId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Statistics
  async getQueueStats() {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(i => i.status === 'pending').length,
      failed: queue.filter(i => i.status === 'failed').length,
      oldestItem: queue[0]?.queuedAt || null,
    };
  }

  async getStorageUsage() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentage: (estimate.usage / estimate.quota * 100).toFixed(2),
      };
    }
    return null;
  }

  // Cleanup
  async clearAllData() {
    const stores = ['messages', 'queue', 'drafts', 'contacts', 'media'];
    
    for (const storeName of stores) {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      await new Promise((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
    
    console.log('[Offline] Cleared all data');
  }
}

// Singleton instance
const offlineManager = new OfflineManager();

export default offlineManager;
