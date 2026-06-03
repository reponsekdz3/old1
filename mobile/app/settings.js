import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '../services/store';
import { TokenStorage } from '../services/storage';
import { disconnectSocket } from '../services/socket';
import api from '../services/api';
import { COLORS } from '../config';

function SettingRow({ icon, label, sublabel, value, onToggle, onPress, danger, rightText }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && !onToggle}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.iconWrap, danger && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={20} color={danger ? COLORS.danger : COLORS.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {onToggle !== undefined ? (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.border, true: COLORS.accent + '80' }}
          thumbColor={value ? COLORS.accent : '#f4f3f4'}
        />
      ) : rightText ? (
        <Text style={styles.rightText}>{rightText}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
      ) : null}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(data);
    } catch (e) {
      console.warn('Failed to load settings:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadSettings(); }, [loadSettings]));

  const updateSetting = async (key, value) => {
    const prev = settings;
    setSettings(s => ({ ...s, [key]: value }));
    try {
      await api.put('/settings', { [key]: value });
    } catch {
      setSettings(prev);
      Alert.alert('Error', 'Failed to update setting');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          try { await api.post('/auth/logout'); } catch {}
          disconnectSocket();
          await TokenStorage.clearTokens();
          logout();
          router.replace('/login');
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  const s = settings || {};

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/profile')} activeOpacity={0.8}>
        <View style={styles.profileInfo}>
          <View style={styles.avatarIcon}>
            <Ionicons name="person-circle" size={52} color={COLORS.accent} />
          </View>
          <View>
            <Text style={styles.profileName}>{user?.full_name || 'Your Name'}</Text>
            <Text style={styles.profilePhone}>{user?.phone_number}</Text>
            {user?.bio || user?.about ? <Text style={styles.profileBio} numberOfLines={1}>{user?.bio || user?.about}</Text> : null}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
      </TouchableOpacity>

      <Section title="Account">
        <SettingRow icon="qr-code-outline" label="QR Code" sublabel="Share your profile" onPress={() => router.push('/qr')} />
        <SettingRow icon="person-outline" label="Edit Profile" onPress={() => router.push('/profile')} />
      </Section>

      <Section title="Privacy">
        <SettingRow
          icon="checkmark-done-outline"
          label="Read Receipts"
          sublabel="Let contacts know when you've read their messages"
          value={s.read_receipts ?? true}
          onToggle={v => updateSetting('read_receipts', v)}
        />
        <SettingRow
          icon="time-outline"
          label="Last Seen"
          sublabel={s.last_seen_privacy || 'everyone'}
          onPress={() => {}}
        />
        <SettingRow
          icon="image-outline"
          label="Profile Photo"
          sublabel={s.profile_photo_privacy || 'everyone'}
          onPress={() => {}}
        />
      </Section>

      <Section title="Notifications">
        <SettingRow
          icon="notifications-outline"
          label="Show Notifications"
          value={s.show_notifications ?? true}
          onToggle={v => updateSetting('show_notifications', v)}
        />
        <SettingRow
          icon="eye-outline"
          label="Show Preview"
          sublabel="Show message content in notifications"
          value={s.show_preview ?? true}
          onToggle={v => updateSetting('show_preview', v)}
        />
        <SettingRow
          icon="volume-high-outline"
          label="Notification Sound"
          value={s.notification_sound ?? true}
          onToggle={v => updateSetting('notification_sound', v)}
        />
      </Section>

      <Section title="Storage & Data">
        <SettingRow
          icon="image-outline"
          label="Auto-download Photos"
          value={s.auto_download_photos ?? true}
          onToggle={v => updateSetting('auto_download_photos', v)}
        />
        <SettingRow
          icon="videocam-outline"
          label="Auto-download Videos"
          value={s.auto_download_videos ?? false}
          onToggle={v => updateSetting('auto_download_videos', v)}
        />
        <SettingRow
          icon="document-outline"
          label="Auto-download Documents"
          value={s.auto_download_documents ?? false}
          onToggle={v => updateSetting('auto_download_documents', v)}
        />
      </Section>

      <Section title="Account Actions">
        <SettingRow
          icon="log-out-outline"
          label="Log Out"
          danger
          onPress={handleLogout}
        />
      </Section>

      <View style={styles.footer}>
        <Ionicons name="chatbubbles" size={24} color={COLORS.accent} />
        <Text style={styles.footerText}>Bitese v1.0.0</Text>
        <Text style={styles.footerSub}>End-to-end encrypted</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.lightGray },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', padding: 16, margin: 12, borderRadius: 16,
    elevation: 2, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarIcon: {},
  profileName: { fontSize: 17, fontWeight: '700', color: COLORS.dark },
  profilePhone: { fontSize: 13, color: COLORS.textGray, marginTop: 1 },
  profileBio: { fontSize: 12, color: COLORS.gray, marginTop: 2, maxWidth: 200 },
  section: { marginHorizontal: 12, marginBottom: 12 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: COLORS.textGray, paddingHorizontal: 4, paddingVertical: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  sectionBody: { backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  iconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center' },
  iconWrapDanger: { backgroundColor: '#FFEBEE' },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: 15, color: COLORS.dark },
  rowSublabel: { fontSize: 12, color: COLORS.textGray, marginTop: 1 },
  rightText: { fontSize: 13, color: COLORS.gray, textTransform: 'capitalize' },
  footer: { alignItems: 'center', padding: 32, gap: 6 },
  footerText: { fontSize: 14, fontWeight: '600', color: COLORS.textGray },
  footerSub: { fontSize: 12, color: COLORS.gray },
});
