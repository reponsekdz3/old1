/**
 * VipChat Service Worker - Advanced Offline Support
 * Handles caching, background sync, and push notifications
 */

const CACHE_NAME = 'vipchat-v1';
const RUNTIME_CACHE = 'vipchat-runtime';
const IMAGE_CACHE = 'vipchat-images';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/static/css/main.css',
  '/static/js/main.js',
  '/manifest.json',
];

// Install event - cache essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Precaching assets');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - cleanup old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && 
              cacheName !== RUNTIME_CACHE && 
              cacheName !== IMAGE_CACHE) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Images - cache first, network fallback
  if (request.destination === 'image') {
    event.respondWith(cacheFirstStrategy(request, IMAGE_CACHE));
    return;
  }

  // Other requests - cache first for static, network first for dynamic
  if (url.origin === self.location.origin) {
    if (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|ico)$/)) {
      event.respondWith(cacheFirstStrategy(request, CACHE_NAME));
    } else {
      event.respondWith(networkFirstStrategy(request));
    }
  }
});

// Network first strategy - try network, fallback to cache
async function networkFirstStrategy(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Cache first strategy - try cache, fallback to network
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Fetch failed:', error);
    throw error;
  }
}

// Background Sync - sync offline queue when back online
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  console.log('[SW] Syncing offline queue...');
  
  try {
    // Open IndexedDB and get queue
    const db = await openDatabase();
    const queue = await getQueueFromDB(db);
    
    // Process each queued item
    for (const item of queue) {
      try {
        await processQueueItem(item);
        await removeFromQueue(db, item.id);
        console.log('[SW] Synced:', item.action);
      } catch (err) {
        console.error('[SW] Sync failed:', err);
      }
    }
    
    // Notify clients
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'SYNC_COMPLETE' });
      });
    });
  } catch (err) {
    console.error('[SW] Background sync failed:', err);
  }
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('VipChatDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getQueueFromDB(db) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readonly');
    const store = transaction.objectStore('queue');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removeFromQueue(db, id) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['queue'], 'readwrite');
    const store = transaction.objectStore('queue');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function processQueueItem(item) {
  const { action, data } = item;
  const baseURL = self.location.origin;
  
  let endpoint, method = 'POST', body;
  
  switch (action) {
    case 'send_message':
      endpoint = `${baseURL}/api/messages/${data.receiver_id}`;
      body = JSON.stringify(data.message);
      break;
      
    case 'send_group_message':
      endpoint = `${baseURL}/api/groups/${data.group_id}/messages`;
      body = JSON.stringify(data.message);
      break;
      
    case 'mark_read':
      endpoint = `${baseURL}/api/messages/${data.message_id}/read`;
      method = 'PUT';
      break;
      
    default:
      console.warn('[SW] Unknown action:', action);
      return;
  }
  
  const response = await fetch(endpoint, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${await getAuthToken()}`,
    },
    body,
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

async function getAuthToken() {
  // Get token from clients
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data.token);
      };
      clients[0].postMessage(
        { type: 'GET_TOKEN' },
        [messageChannel.port2]
      );
    });
  }
  return null;
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');
  
  let data = {};
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (err) {
      data = { title: 'VipChat', body: event.data.text() };
    }
  }
  
  const options = {
    body: data.body || 'New message',
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'close', title: 'Close' },
    ],
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'VipChat', options)
  );
});

// Notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url || '/')
    );
  }
});

// Message event - communicate with clients
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      })
    );
  }
});

console.log('[SW] Service Worker loaded');