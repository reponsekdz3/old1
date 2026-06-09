import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Platform, TouchableOpacity, View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore, useChatStore } from '../../services/store';
import { initializeSocket } from '../../services/socket';
import { COLORS } from '../../config';

function TabBarIcon({ name, focused, color, badgeCount }) {
  const { width: W } = useWindowDimensions();
  const iconSize = W < 360 ? 22 : 24;
  return (
    <View style={{ position: 'relative', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={name} size={iconSize} color={color} />
      {badgeCount > 0 && (
        <View style={[styles.badge, { minWidth: badgeCount > 9 ? 20 : 16 }]}>
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
  const { width: W, height: H } = useWindowDimensions();

  const isSmall = W < 360;
  const isShortDevice = H < 700;
  const tabBarH = Platform.OS === 'ios'
    ? (isShortDevice ? 72 : 84)
    : (isSmall ? 58 : 62);
  const tabBarPbIos = isShortDevice ? 10 : 24;
  const iconSize = isSmall ? 22 : 24;
  const labelSize = isSmall ? 9 : 10;

  const totalUnread = Object.values(unreadCounts || {}).reduce((s, n) => s + (n || 0), 0);

  useEffect(() => {
    if (user?.id) initializeSocket(user.id);
  }, [user?.id]);

  const headerIconSize = isSmall ? 20 : 22;
  const headerBtnPad = isSmall ? 6 : 8;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#fff',
        tabBarInactiveTintColor: 'rgba(255,255,255,0.45)',
        tabBarStyle: {
          backgroundColor: COLORS.primary,
          borderTopWidth: 0,
          height: tabBarH,
          paddingBottom: Platform.OS === 'ios' ? tabBarPbIos : 8,
          paddingTop: 6,
          elevation: 12,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -3 },
        },
        tabBarLabelStyle: {
          fontSize: labelSize,
          fontWeight: '700',
          letterSpacing: 0.2,
          marginTop: -2,
        },
        tabBarItemStyle: { paddingTop: 2 },
        headerStyle: {
          backgroundColor: COLORS.primary,
          elevation: 0,
          shadowOpacity: 0,
          height: Platform.OS === 'ios' ? (isShortDevice ? 90 : 100) : 60,
        },
        headerTintColor: '#fff',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: isSmall ? 20 : 22,
          letterSpacing: 0.3,
          color: '#fff',
        },
        headerShadowVisible: false,
        headerTitleAlign: 'left',
      }}
    >
      {/* ── Chats ── */}
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
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 4 }}>
              <TouchableOpacity
                style={[styles.headerBtn, { padding: headerBtnPad }]}
                onPress={() => router.push('/qr')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="qr-code-outline" size={headerIconSize} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.headerBtn, { padding: headerBtnPad }]}
                onPress={() => router.push('/settings')}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Ionicons name="ellipsis-vertical" size={headerIconSize} color="#fff" />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {/* ── Updates ── */}
      <Tabs.Screen
        name="status"
        options={{
          title: 'Updates',
          tabBarLabel: 'Updates',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'radio-button-on' : 'radio-button-off-outline'}
              focused={focused}
              color={color}
              badgeCount={0}
            />
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerBtn, { padding: headerBtnPad, marginRight: 4 }]}
              onPress={() => {}}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="camera-outline" size={headerIconSize} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Trends ── */}
      <Tabs.Screen
        name="trends"
        options={{
          title: 'Trends',
          tabBarLabel: 'Trends',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'trending-up' : 'trending-up-outline'}
              focused={focused}
              color={color}
              badgeCount={0}
            />
          ),
          headerShown: false,
        }}
      />

      {/* ── Wallet ── */}
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarLabel: 'Wallet',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'wallet' : 'wallet-outline'}
              focused={focused}
              color={color}
              badgeCount={0}
            />
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerBtn, { padding: headerBtnPad, marginRight: 4 }]}
              onPress={() => {}}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="add-circle-outline" size={headerIconSize + 2} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Calls ── */}
      <Tabs.Screen
        name="calls"
        options={{
          title: 'Calls',
          tabBarLabel: 'Calls',
          tabBarIcon: ({ color, focused }) => (
            <TabBarIcon
              name={focused ? 'call' : 'call-outline'}
              focused={focused}
              color={color}
              badgeCount={0}
            />
          ),
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerBtn, { padding: headerBtnPad, marginRight: 4 }]}
              onPress={() => {}}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="add" size={headerIconSize + 4} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />

      {/* ── Contacts (hidden from tab bar but accessible) ── */}
      <Tabs.Screen
        name="contacts"
        options={{
          title: 'Contacts',
          tabBarButton: () => null,
          headerRight: () => (
            <TouchableOpacity
              style={[styles.headerBtn, { padding: headerBtnPad, marginRight: 4 }]}
              onPress={() => router.push('/qr')}
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Ionicons name="qr-code-outline" size={headerIconSize} color="#fff" />
            </TouchableOpacity>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerBtn: { borderRadius: 20 },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
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
