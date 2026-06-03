/**
 * VipChat Mobile Push Notification & Offline Queue Service
 * Handles Expo push token registration, foreground notifications,
 * and offline message queue draining via NetInfo.
 */
import * as Notifications from 'expo-notifications';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import api from './api';
import { TokenStorage } from './storage';
import { useOfflineStore, useChatStore } from './store';

// Configure how notifications appear when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Push Token Registration ───────────────────────────────────────────────────
export async function registerExpoPushToken() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('vipchat-messages', {
        name: 'Messages',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#25D366',
        sound: 'default',
        enableVibrate: true,
        showBadge: true,
      });
      await Notifications.setNotificationChannelAsync('vipchat-calls', {
        name: 'Calls',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        lightColor: '#25D366',
        sound: 'default',
        enableVibrate: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Notifications] Push permission not granted');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID || undefined,
    });
    const token = tokenData.data;

    // Register with backend
    await api.post('/push/register-expo-token', { expo_token: token, platform: Platform.OS });
    console.log('[Notifications] Expo push token registered:', token.slice(0, 30) + '...');
    return token;
  } catch (err) {
    console.warn('[Notifications] Failed to register push token:', err.message);
    return null;
  }
}

// ── Foreground Notification Handler ──────────────────────────────────────────
let _foregroundSubscription = null;
let _responseSubscription = null;

export function startNotificationListeners(onNavigate) {
  // Handle notifications received while app is open
  _foregroundSubscription = Notifications.addNotificationReceivedListener((notification) => {
    const data = notification.request.content.data || {};
    console.log('[Notifications] Foreground push received:', data.type);
    // The chat store / socket already handles real-time msgs via WebSocket
    // Only show badge/alert for messages from OTHER chats
    if (data.type === 'message' && data.sender_id) {
      const { activeChat } = useChatStore.getState();
      // Don't show if user is already in that chat
      if (String(data.sender_id) === String(activeChat)) {
        Notifications.dismissNotificationAsync(notification.request.identifier);
      }
    }
  });

  // Handle tap on notification
  _responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data || {};
    if (data.type === 'message' && data.sender_id && onNavigate) {
      onNavigate(data.sender_id, data.sender_name);
    } else if (data.url && onNavigate) {
      onNavigate(null, null, data.url);
    }
  });

  return () => {
    _foregroundSubscription?.remove();
    _responseSubscription?.remove();
  };
}

// ── Offline Queue Drain ───────────────────────────────────────────────────────
let _netInfoUnsubscribe = null;
let _draining = false;

export function startOfflineQueueDrain() {
  // Listen for network state changes
  _netInfoUnsubscribe = NetInfo.addEventListener(async (state) => {
    const isOnline = state.isConnected && state.isInternetReachable !== false;
    if (!isOnline || _draining) return;

    const { queue, removeFromQueue } = useOfflineStore.getState();
    if (!queue || queue.length === 0) return;

    const token = await TokenStorage.getAccessToken().catch(() => null);
    if (!token) return;

    _draining = true;
    console.log(`[OfflineQueue] Draining ${queue.length} queued message(s)…`);

    const snapshot = [...queue];
    for (const item of snapshot) {
      try {
        if (item.type === 'message') {
          const { data } = await api.post('/messages/send', {
            receiver_id: item.receiver_id,
            content: item.content,
            media_url: item.media_url,
            media_type: item.media_type,
          });
          // Add to chat store with real ID
          const { addMessage } = useChatStore.getState();
          addMessage(item.receiver_id, data.message || data);
        }
        removeFromQueue(item.queueId);
      } catch (err) {
        console.warn(`[OfflineQueue] Failed to send queued item ${item.queueId}:`, err.message);
        // Keep in queue if server error (5xx), remove if client error (4xx)
        if (err.response?.status < 500 && err.response?.status >= 400) {
          removeFromQueue(item.queueId);
        }
      }
    }

    _draining = false;
    console.log('[OfflineQueue] Drain complete');
  });

  return () => _netInfoUnsubscribe?.();
}

export function stopOfflineQueueDrain() {
  _netInfoUnsubscribe?.();
  _netInfoUnsubscribe = null;
}

// ── Badge count management ────────────────────────────────────────────────────
export async function setBadgeCount(count) {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {}
}

export async function clearBadge() {
  try {
    await Notifications.setBadgeCountAsync(0);
    await Notifications.dismissAllNotificationsAsync();
  } catch {}
}
