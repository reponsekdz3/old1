/* VipChat Service Worker — offline caching + push notifications + background sync + quick reply */
const CACHE_NAME = 'vipchat-v6';
const OFFLINE_PAGE = '/index.html';
const STATIC_ASSETS = [
  '/', '/index.html', '/logo192.png', '/logo512.png', '/manifest.json',
  '/favicon.ico',
];

// ── Install ────────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
});

// ── Activate ───────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── Fetch — Network-first for API, Cache-first for static ─────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.protocol.startsWith('http')) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp && resp.status === 200) {
          const cloned = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, cloned));
        }
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
          }
          return resp;
        })
        .catch(() => caches.match(event.request).then(r => r || caches.match(OFFLINE_PAGE)))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const net = fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      }).catch(() => null);
      return cached || net;
    })
  );
});

// ── Background Sync (offline message queue) ────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') event.waitUntil(syncPendingMessages());
});

async function syncPendingMessages() {
  try {
    const db = await openDB();
    const messages = await getAllPending(db);
    for (const msg of messages) {
      try {
        const token = await getStoredToken();
        const resp = await fetch(`/api/messages/${msg.receiverId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ content: msg.content }),
        });
        if (resp.ok) await removePending(db, msg.id);
      } catch {}
    }
  } catch {}
}

// ── Push notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch {}

  const title = data.title || 'VipChat';
  const body = data.body || data.message || 'New notification';
  const icon = data.icon || '/logo192.png';
  const badge = '/logo192.png';
  const senderId = data.extra?.sender_id || data.sender_id || '';
  const senderName = data.extra?.sender_name || data.sender_name || data.title || '';
  const chatId = data.extra?.chat_id || data.chat_id || senderId;
  const notifType = data.extra?.type || data.type || 'message';
  const url = data.url || (chatId ? `/` : '/');

  const actions = [];

  // Quick Reply action (only for message notifications)
  if (notifType === 'message' && senderId) {
    actions.push({
      action: 'reply',
      title: 'Reply',
      type: 'text',
      placeholder: 'Type a reply…',
    });
  }

  // Mark as Read action
  actions.push({ action: 'mark_read', title: 'Mark Read' });
  // Open action
  actions.push({ action: 'open', title: 'Open' });

  const options = {
    body,
    icon,
    badge,
    tag: chatId || 'general',
    renotify: true,
    requireInteraction: notifType === 'message',
    data: { url, senderId, chatId, senderName, notifType, ...data.extra },
    actions: actions.slice(0, 2), // max 2 on most platforms
    vibrate: [200, 100, 200],
    silent: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click — handles reply, mark_read, open ───────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const { action, reply } = event;
  const notifData = event.notification.data || {};
  const { url, senderId, chatId, notifType } = notifData;

  // Quick Reply
  if (action === 'reply' && reply && senderId) {
    event.waitUntil(
      handleQuickReply(senderId, reply, notifData)
    );
    return;
  }

  // Mark as read — just close, open in background
  if (action === 'mark_read') {
    event.waitUntil(markNotificationRead(notifData));
    return;
  }

  // Default: open chat
  const openUrl = url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(openUrl) || c.url.includes('/'));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'notification_click', url: openUrl, chatId, senderId });
        return;
      }
      return self.clients.openWindow(openUrl).then(win => {
        if (win) {
          win.postMessage({ type: 'notification_click', url: openUrl, chatId, senderId });
        }
      });
    })
  );
});

async function handleQuickReply(receiverId, replyText, notifData) {
  try {
    const token = await getStoredToken();
    if (!token) {
      // Open app so user can log in and reply
      await self.clients.openWindow('/');
      return;
    }
    const resp = await fetch(`/api/messages/${receiverId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ content: replyText }),
    });
    if (resp.ok) {
      // Show confirmation notification
      await self.registration.showNotification('Reply sent ✓', {
        body: replyText,
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'reply_sent',
        silent: true,
      });
      // Notify open clients to refresh
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.postMessage({ type: 'quick_reply_sent', receiverId, content: replyText }));
    } else {
      await self.registration.showNotification('Reply failed', {
        body: 'Tap to open VipChat and reply manually',
        icon: '/logo192.png',
        badge: '/logo192.png',
        tag: 'reply_failed',
        data: { url: '/' },
      });
    }
  } catch (e) {
    console.error('[SW] Quick reply failed:', e);
  }
}

async function markNotificationRead(notifData) {
  try {
    const token = await getStoredToken();
    if (!token || !notifData.senderId) return;
    await fetch(`/api/messages/${notifData.senderId}/read`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
  } catch {}
}

async function getStoredToken() {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction('keyval', 'readonly');
      const req = tx.objectStore('keyval').get('access_token');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// ── IndexedDB helpers ──────────────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vipchat-sw', 2);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pending_messages')) {
        db.createObjectStore('pending_messages', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('keyval')) {
        db.createObjectStore('keyval');
      }
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_messages', 'readonly');
    const req = tx.objectStore('pending_messages').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

function removePending(db, id) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('pending_messages', 'readwrite');
    const req = tx.objectStore('pending_messages').delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
