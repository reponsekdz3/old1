/* Bitese Service Worker - Push Notifications + Offline Cache */
const CACHE_NAME = 'bitese-v1';
const OFFLINE_URLS = ['/', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ── Push event handler ──────────────────────────────────────────────────── */
self.addEventListener('push', (event) => {
  let payload = { title: 'Bitese', body: 'New message', icon: '/logo192.png', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...JSON.parse(event.data.text()) };
  } catch {}

  const options = {
    body: payload.body,
    icon: payload.icon || '/logo192.png',
    badge: '/logo192.png',
    vibrate: [200, 100, 200],
    tag: 'bitese-message',
    renotify: true,
    data: { url: payload.url || '/' },
    actions: [
      { action: 'open', title: 'Open Bitese' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(payload.title, options));
});

/* ── Notification click handler ─────────────────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      const existing = windowClients.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'PUSH_CLICK', url: targetUrl });
      } else {
        clients.openWindow(self.location.origin + targetUrl);
      }
    })
  );
});

/* ── Fetch: network-first, fall back to cache ────────────────────────────── */
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;
  if (event.request.url.includes('/api/')) return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
