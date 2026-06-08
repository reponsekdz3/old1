/* VipChat Service Worker — offline caching + push notifications + background sync */
const CACHE_NAME = 'vipchat-v5';
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

  // Skip WebSocket and non-http
  if (!url.protocol.startsWith('http')) return;

  // API calls: network only, no cache
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;

  // Uploads: network first, cache fallback
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

  // HTML navigation: network first, cache fallback → offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(resp => {
          if (resp && resp.status === 200) {
            const cloned = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, cloned));
          }
          return resp;
        })
        .catch(() => caches.match(event.request)
          .then(r => r || caches.match(OFFLINE_PAGE))
        )
    );
    return;
  }

  // JS/CSS/Images: stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(resp => {
        if (resp && resp.status === 200 && resp.type === 'basic') {
          const cloned = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, cloned));
        }
        return resp;
      }).catch(() => null);
      return cached || networkFetch;
    })
  );
});

// ── Background Sync (offline message queue) ────────────────────────────────────
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncPendingMessages());
  }
});

async function syncPendingMessages() {
  try {
    const db = await openDB();
    const messages = await getAllPending(db);
    for (const msg of messages) {
      try {
        const resp = await fetch('/api/messages/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${msg.token}`,
          },
          body: JSON.stringify(msg.data),
        });
        if (resp.ok) await deletePending(db, msg.id);
      } catch {}
    }
  } catch {}
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('vipchat-offline', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('pending', { keyPath: 'id', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllPending(db) {
  return new Promise((resolve) => {
    const tx = db.transaction('pending', 'readonly');
    const req = tx.objectStore('pending').getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => resolve([]);
  });
}

function deletePending(db, id) {
  return new Promise((resolve) => {
    const tx = db.transaction('pending', 'readwrite');
    tx.objectStore('pending').delete(id);
    tx.oncomplete = resolve;
  });
}

// ── Push Notifications ─────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch {}

  const title = payload.title || 'VipChat';
  const body  = payload.body  || 'You have a new message';
  const icon  = payload.icon  || '/logo192.png';
  const badge = '/logo192.png';
  const tag   = payload.tag   || `vipchat-${payload.sender_id || 'msg'}`;
  const data  = { url: payload.url || '/', ...payload };

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      tag,
      renotify: true,
      vibrate: [200, 100, 200],
      requireInteraction: false,
      silent: false,
      data,
      actions: [
        { action: 'reply', title: 'Reply' },
        { action: 'dismiss', title: 'Dismiss' },
      ],
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const action = event.action;
  if (action === 'dismiss') return;

  const url = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.postMessage({ type: 'navigate', url });
          return;
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

// ── Periodic background updates ────────────────────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-cache') {
    event.waitUntil(updateStaticCache());
  }
});

async function updateStaticCache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.allSettled(STATIC_ASSETS.map(url => cache.add(url).catch(() => {})));
}

// ── Message from main thread ───────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'skip-waiting') {
    self.skipWaiting();
  }
  if (event.data?.type === 'queue-message') {
    openDB().then(db => {
      const tx = db.transaction('pending', 'readwrite');
      tx.objectStore('pending').add(event.data.payload);
    }).catch(() => {});
  }
});
