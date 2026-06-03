/**
 * VipChat Web Push Notification Service
 * Registers the service worker, subscribes to push, and posts subscriptions to the backend.
 */
import api from './api';

let _registration = null;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    _registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return _registration;
  } catch (e) {
    console.warn('SW registration failed:', e);
    return null;
  }
}

export async function requestPushPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

export async function subscribeToPush() {
  try {
    const granted = await requestPushPermission();
    if (!granted) return false;

    const reg = _registration || await registerServiceWorker();
    if (!reg) return false;

    const { data } = await api.get('/push/vapid-public-key');
    const applicationServerKey = urlBase64ToUint8Array(data.public_key);

    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      await sendSubscriptionToServer(existing);
      return true;
    }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });

    await sendSubscriptionToServer(subscription);
    return true;
  } catch (e) {
    console.warn('Push subscribe error:', e);
    return false;
  }
}

async function sendSubscriptionToServer(subscription) {
  const sub = subscription.toJSON();
  await api.post('/push/subscribe', {
    endpoint: sub.endpoint,
    keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function unsubscribeFromPush() {
  try {
    const reg = _registration || await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await api.delete('/push/unsubscribe', { data: { endpoint: sub.endpoint } });
    }
  } catch (e) {
    console.warn('Push unsubscribe error:', e);
  }
}

export async function showLocalNotification(title, body, options = {}) {
  if (Notification.permission !== 'granted') return;
  const reg = _registration || await navigator.serviceWorker.ready;
  if (reg) {
    await reg.showNotification(title, {
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      vibrate: [200, 100, 200],
      tag: 'vipchat-msg',
      renotify: true,
      ...options,
    });
  } else {
    new Notification(title, { body, icon: '/logo192.png', ...options });
  }
}

export function listenForPushMessages(callback) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'PUSH_CLICK') callback(event.data);
    });
  }
}
