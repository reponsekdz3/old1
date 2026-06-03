import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useChatStore } from '../../services/store';
import { initializeSocket } from '../../services/socket';
import { COLORS } from '../../config';

function TabBarIcon({ name, focused, color, badgeCount }) {
  return (
    <View style={{ position: 'relative' }}>
      <Ionicons name={name} size={24} color={color} />
      {badgeCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { user } = useAuthStore();
  const { unreadCounts } = useChatStore();
  const router = useRouter();

  const totalUnread = Object.values(unreadCounts || {}).reduce((s, n) => s + (n || 0), 0);

  useEffect(() => {
    if (user?.id) {
      initializeSocket(user.id);
    }
  }, [user?.id]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.55)',
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 62,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
          paddingTop: 6,
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: -2 },
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
        headerStyle: { backgroundColor: COLORS.primary, elevation: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '800', fontSize: 22, letterSpacing: 0.3 },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'VipChat',
          tabBarLabel: 'Chats',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'chatbubbles' : 'chatbubbles-outline'}
              focused={focused}
              color={color}
              badgeCount={totalUnread}
            />
          ),
          headerRight: () => (
            <View style={{ flexDirection: 'row', marginRight: 4 }}>
              <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/qr')}>
                <Ionicons name="qr-code-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/settings')}>
                <Ionicons name="ellipsis-vertical" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="status"
        options={{
          title: 'Updates',
          tabBarLabel: 'Updates',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'radio-button-on' : 'radio-button-off'} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
          tabBarLabel: 'Calls',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'call' : 'call-outline'} size={24} color={color} />
          ),
          headerRight: () => (
            <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/(tabs)/calls')}>
              <Ionicons name="add" size={26} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBtn: { padding: 8 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
