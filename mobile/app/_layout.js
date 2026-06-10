import { useEffect, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useAuthStore } from '../services/store';
import { TokenStorage } from '../services/storage';
import api from '../services/api';
import {
  registerExpoPushToken,
  startNotificationListeners,
  startOfflineQueueDrain,
  clearBadge,
} from '../services/notifications';

export default function RootLayout() {
  const { setUser, setLoading, user } = useAuthStore();
  const router = useRouter();
  const cleanupNotifs = useRef(null);
  const cleanupQueue = useRef(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = await TokenStorage.getAccessToken();
        if (!token) { setLoading(false); return; }
        const { data } = await api.get('/auth/user');
        setUser(data.user || data);
      } catch {
        await TokenStorage.clearTokens();
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Wire up push notifications + offline queue once user is authenticated
  useEffect(() => {
    if (!user) return;

    // Register Expo push token with backend (non-blocking)
    registerExpoPushToken().catch(() => {});

    // Clear badge when app opens
    clearBadge().catch(() => {});

    // Listen for notification taps → navigate to chat
    const handleNavigate = (senderId, senderName, url) => {
      if (senderId) {
        router.push(`/chat/${senderId}`);
      } else if (url) {
        // Handle deep links from notifications
      }
    };
    cleanupNotifs.current = startNotificationListeners(handleNavigate);

    // Start draining offline message queue when connectivity returns
    cleanupQueue.current = startOfflineQueueDrain();

    return () => {
      cleanupNotifs.current?.();
      cleanupQueue.current?.();
    };
  }, [user?.id]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack>
          <Stack.Screen name="index"  options={{ headerShown: false }} />
          <Stack.Screen name="login"  options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="chat/[id]" options={{ headerShown: false }} />
          <Stack.Screen
            name="profile"
            options={{
              title: 'Edit Profile',
              headerStyle: { backgroundColor: '#075E54' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="settings"
            options={{
              title: 'Settings',
              headerStyle: { backgroundColor: '#075E54' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="qr"
            options={{
              title: 'QR Code',
              headerStyle: { backgroundColor: '#075E54' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
          <Stack.Screen
            name="explorer"
            options={{
              title: 'My Explorer',
              headerStyle: { backgroundColor: '#075E54' },
              headerTintColor: '#fff',
              headerTitleStyle: { fontWeight: '700' },
            }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
