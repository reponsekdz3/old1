import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../services/store';
import { TokenStorage } from '../services/storage';
import { disconnectSocket } from '../services/socket';
import api from '../services/api';
import { COLORS } from '../config';

const { width: SW, height: SH } = Dimensions.get('window');
const rf = (n) => n * (SW / 390);

function SettingRow({ icon, iconBg, label, sublabel, value, onToggle, onPress, danger, rightText, rightElement }) {
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={!onPress && onToggle === undefined}
      activeOpacity={onPress ? 0.65 : 1}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg || '#E8F5E9' }, danger && styles.iconWrapDanger]}>
        <Ionicons name={icon} size={19} color={danger ? COLORS.danger : '#fff'} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, danger && { color: COLORS.danger }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      {onToggle !== undefined ? (
        <Switch
          value={!!value}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.border, true: COLORS.accent }}
          thumbColor="#fff"
          ios_backgroundColor={COLORS.border}
        />
      ) : rightElement ? rightElement : rightText ? (
        <Text style={styles.rightText}>{rightText}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
      ) : null}
    </TouchableOpacity>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete('/auth/account');
              disconnectSocket();
              await TokenStorage.clearTokens();
              logout();
              router.replace('/login');
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to delete account');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>;
  }

  const s = settings || {};

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Card */}
      <TouchableOpacity style={styles.profileCard} onPress={() => router.push('/profile')} activeOpacity={0.75}>
        <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={styles.profileGrad}>
          <View style={styles.profileInner}>
            <View style={styles.avatarWrap}>
              {user?.avatar_url ? (
                <Image source={{ uri: user.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarInitial}>{(user?.full_name || 'U')[0].toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.onlineDot} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileName}>{user?.full_name || 'Your Name'}</Text>
              <Text style={styles.profilePhone}>{user?.phone_number}</Text>
              <Text style={styles.profileBio} numberOfLines={1}>{user?.bio || user?.about || 'Hey there! I am using VipChat.'}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Quick Links */}
      <View style={styles.quickRow}>
        {[
          { icon: 'qr-code', label: 'My QR', onPress: () => router.push('/qr'), bg: '#5856D6' },
          { icon: 'star', label: 'Starred', onPress: () => {}, bg: '#FF9500' },
          { icon: 'archive', label: 'Archived', onPress: () => {}, bg: '#34C759' },
          { icon: 'person-add', label: 'Invite', onPress: () => {}, bg: '#007AFF' },
        ].map(q => (
          <TouchableOpacity key={q.label} style={styles.quickBtn} onPress={q.onPress} activeOpacity={0.7}>
            <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
              <Ionicons name={q.icon} size={20} color="#fff" />
            </View>
            <Text style={styles.quickLabel}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Account */}
      <Section title="Account">
        <SettingRow icon="person-outline" iconBg={COLORS.primary} label="Edit Profile" sublabel="Name, photo, bio" onPress={() => router.push('/profile')} />
        <SettingRow icon="phone-portrait-outline" iconBg="#007AFF" label="Phone Number" sublabel={user?.phone_number} onPress={() => Alert.alert('Info', 'Contact support to change your phone number')} />
        <SettingRow icon="shield-checkmark-outline" iconBg="#34C759" label="Two-Step Verification" sublabel="Add extra security to your account" onPress={() => Alert.alert('Coming Soon', 'Two-step verification will be available soon')} />
        <SettingRow icon="key-outline" iconBg="#FF9500" label="Change Password" onPress={() => Alert.alert('Coming Soon', 'Password change will be available soon')} />
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <SettingRow
          icon="checkmark-done-outline"
          iconBg="#25D366"
          label="Read Receipts"
          sublabel="Let contacts see when you've read messages"
          value={s.read_receipts ?? true}
          onToggle={v => updateSetting('read_receipts', v)}
        />
        <SettingRow
          icon="time-outline"
          iconBg="#5AC8FA"
          label="Last Seen"
          sublabel={s.last_seen_privacy === 'nobody' ? 'Nobody' : s.last_seen_privacy === 'contacts' ? 'My Contacts' : 'Everyone'}
          onPress={() => Alert.alert('Last Seen', 'Choose who can see your last seen', [
            { text: 'Everyone', onPress: () => updateSetting('last_seen_privacy', 'everyone') },
            { text: 'My Contacts', onPress: () => updateSetting('last_seen_privacy', 'contacts') },
            { text: 'Nobody', onPress: () => updateSetting('last_seen_privacy', 'nobody') },
            { text: 'Cancel', style: 'cancel' },
          ])}
        />
        <SettingRow
          icon="image-outline"
          iconBg="#FF2D55"
          label="Profile Photo"
          sublabel={s.profile_photo_privacy === 'nobody' ? 'Nobody' : s.profile_photo_privacy === 'contacts' ? 'My Contacts' : 'Everyone'}
          onPress={() => Alert.alert('Profile Photo', 'Who can see your profile photo?', [
            { text: 'Everyone', onPress: () => updateSetting('profile_photo_privacy', 'everyone') },
            { text: 'My Contacts', onPress: () => updateSetting('profile_photo_privacy', 'contacts') },
            { text: 'Nobody', onPress: () => updateSetting('profile_photo_privacy', 'nobody') },
            { text: 'Cancel', style: 'cancel' },
          ])}
        />
        <SettingRow
          icon="radio-button-on-outline"
          iconBg="#9B59B6"
          label="Status Privacy"
          sublabel={s.status_privacy === 'nobody' ? 'Nobody' : s.status_privacy === 'contacts' ? 'My Contacts' : 'Everyone'}
          onPress={() => Alert.alert('Status', 'Who can see your status updates?', [
            { text: 'My Contacts', onPress: () => updateSetting('status_privacy', 'contacts') },
            { text: 'Nobody', onPress: () => updateSetting('status_privacy', 'nobody') },
            { text: 'Cancel', style: 'cancel' },
          ])}
        />
        <SettingRow
          icon="call-outline"
          iconBg="#1ABC9C"
          label="Who Can Call Me"
          sublabel={s.calls_privacy === 'contacts' ? 'My Contacts' : 'Everyone'}
          onPress={() => Alert.alert('Calls', 'Who can call you?', [
            { text: 'Everyone', onPress: () => updateSetting('calls_privacy', 'everyone') },
            { text: 'My Contacts', onPress: () => updateSetting('calls_privacy', 'contacts') },
            { text: 'Cancel', style: 'cancel' },
          ])}
        />
        <SettingRow
          icon="people-outline"
          iconBg="#E67E22"
          label="Groups"
          sublabel={s.groups_privacy === 'contacts' ? 'My Contacts' : 'Everyone'}
          onPress={() => Alert.alert('Groups', 'Who can add you to groups?', [
            { text: 'Everyone', onPress: () => updateSetting('groups_privacy', 'everyone') },
            { text: 'My Contacts', onPress: () => updateSetting('groups_privacy', 'contacts') },
            { text: 'Cancel', style: 'cancel' },
          ])}
        />
        <SettingRow icon="eye-off-outline" iconBg="#636E72" label="Blocked Contacts" sublabel="Manage who you've blocked" onPress={() => Alert.alert('Blocked', 'Manage blocked contacts in the web app')} />
      </Section>

      {/* Notifications */}
      <Section title="Notifications">
        <SettingRow
          icon="notifications-outline"
          iconBg="#FF3B30"
          label="Show Notifications"
          sublabel="Allow push notifications"
          value={s.show_notifications ?? true}
          onToggle={v => updateSetting('show_notifications', v)}
        />
        <SettingRow
          icon="eye-outline"
          iconBg="#5AC8FA"
          label="Show Message Preview"
          sublabel="See message content in notifications"
          value={s.show_preview ?? true}
          onToggle={v => updateSetting('show_preview', v)}
        />
        <SettingRow
          icon="volume-high-outline"
          iconBg="#FF9500"
          label="Notification Sound"
          value={s.notification_sound ?? true}
          onToggle={v => updateSetting('notification_sound', v)}
        />
        <SettingRow
          icon="phone-portrait-outline"
          iconBg="#8E8E93"
          label="Vibration"
          value={s.vibration ?? true}
          onToggle={v => updateSetting('vibration', v)}
        />
        <SettingRow
          icon="chatbubble-outline"
          iconBg="#34C759"
          label="In-App Sounds"
          sublabel="Message sent/received sounds"
          value={s.in_app_sounds ?? true}
          onToggle={v => updateSetting('in_app_sounds', v)}
        />
        <SettingRow
          icon="call-outline"
          iconBg="#007AFF"
          label="Call Ringtone"
          sublabel="Default ringtone"
          onPress={() => Alert.alert('Ringtone', 'Ringtone selection coming soon')}
        />
      </Section>

      {/* Chats */}
      <Section title="Chats">
        <SettingRow
          icon="color-palette-outline"
          iconBg="#9B59B6"
          label="Chat Wallpaper"
          sublabel="Customize your chat background"
          onPress={() => Alert.alert('Wallpaper', 'Chat wallpaper customization available in web app')}
        />
        <SettingRow
          icon="text-outline"
          iconBg="#FF9500"
          label="Font Size"
          sublabel={s.font_size ? s.font_size.charAt(0).toUpperCase() + s.font_size.slice(1) : 'Medium'}
          onPress={() => Alert.alert('Font Size', 'Choose chat font size', [
            { text: 'Small', onPress: () => updateSetting('font_size', 'small') },
            { text: 'Medium', onPress: () => updateSetting('font_size', 'medium') },
            { text: 'Large', onPress: () => updateSetting('font_size', 'large') },
            { text: 'Cancel', style: 'cancel' },
          ])}
        />
        <SettingRow
          icon="enter-outline"
          iconBg="#636E72"
          label="Enter to Send"
          sublabel="Press Enter key to send messages"
          value={s.enter_to_send ?? false}
          onToggle={v => updateSetting('enter_to_send', v)}
        />
        <SettingRow
          icon="cloud-upload-outline"
          iconBg="#1ABC9C"
          label="Chat Backup"
          sublabel="Back up your chat history"
          onPress={() => Alert.alert('Backup', 'Chat backup coming soon')}
        />
      </Section>

      {/* Storage & Data */}
      <Section title="Storage & Data">
        <SettingRow
          icon="image-outline"
          iconBg="#007AFF"
          label="Auto-download Photos"
          sublabel="Download photos automatically"
          value={s.auto_download_photos ?? true}
          onToggle={v => updateSetting('auto_download_photos', v)}
        />
        <SettingRow
          icon="videocam-outline"
          iconBg="#FF2D55"
          label="Auto-download Videos"
          sublabel="Download videos automatically"
          value={s.auto_download_videos ?? false}
          onToggle={v => updateSetting('auto_download_videos', v)}
        />
        <SettingRow
          icon="document-outline"
          iconBg="#FF9500"
          label="Auto-download Documents"
          value={s.auto_download_documents ?? false}
          onToggle={v => updateSetting('auto_download_documents', v)}
        />
        <SettingRow
          icon="cellular-outline"
          iconBg="#636E72"
          label="Use Less Data for Calls"
          value={s.low_data_calls ?? false}
          onToggle={v => updateSetting('low_data_calls', v)}
        />
        <SettingRow
          icon="trash-outline"
          iconBg="#FF3B30"
          label="Clear All Chats"
          danger
          onPress={() => Alert.alert('Clear Chats', 'Are you sure? This deletes all chat history.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Clear All', style: 'destructive', onPress: async () => {
              try { await api.delete('/messages/all'); Alert.alert('Done', 'All chats cleared'); } catch {}
            }},
          ])}
        />
      </Section>

      {/* Help & Support */}
      <Section title="Help & Support">
        <SettingRow icon="help-circle-outline" iconBg="#007AFF" label="Help Center" onPress={() => Alert.alert('Help', 'Visit vipchat.app/help for support')} />
        <SettingRow icon="bug-outline" iconBg="#FF9500" label="Report a Problem" onPress={() => Alert.alert('Report', 'Email support@vipchat.app to report issues')} />
        <SettingRow icon="people-circle-outline" iconBg="#34C759" label="Invite Friends" onPress={() => Alert.alert('Invite', 'Share VipChat with friends!')} />
        <SettingRow icon="star-outline" iconBg="#FFD700" label="Rate VipChat" onPress={() => Alert.alert('Rate', 'Thanks for using VipChat!')} />
      </Section>

      {/* About */}
      <Section title="About">
        <SettingRow icon="information-circle-outline" iconBg="#5856D6" label="About VipChat" sublabel="Version 2.0.0" onPress={() => Alert.alert('VipChat v2.0.0', 'A powerful, private messaging app.\n\n© 2026 VipChat')} />
        <SettingRow icon="document-text-outline" iconBg="#636E72" label="Privacy Policy" onPress={() => Alert.alert('Privacy Policy', 'Visit vipchat.app/privacy')} />
        <SettingRow icon="newspaper-outline" iconBg="#8E8E93" label="Terms of Service" onPress={() => Alert.alert('Terms', 'Visit vipchat.app/terms')} />
      </Section>

      {/* Account Actions */}
      <Section title="Account Actions">
        <SettingRow icon="log-out-outline" iconBg="#FF9500" label="Log Out" danger onPress={handleLogout} />
        <SettingRow icon="person-remove-outline" iconBg="#FF3B30" label="Delete Account" sublabel="Permanently delete your account and data" danger onPress={handleDeleteAccount} />
      </Section>

      <View style={styles.footer}>
        <View style={styles.footerLogo}>
          <Ionicons name="chatbubbles" size={28} color={COLORS.accent} />
        </View>
        <Text style={styles.footerText}>VipChat v2.0.0</Text>
        <Text style={styles.footerSub}>Your world, connected</Text>
        <Text style={styles.footerEnc}>🔒 End-to-end encrypted</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  profileCard: { margin: rf(14), borderRadius: 22, overflow: 'hidden', elevation: 5, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  profileGrad: { padding: rf(18) },
  profileInner: { flexDirection: 'row', alignItems: 'center', gap: rf(14) },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: rf(62), height: rf(62), borderRadius: rf(31), borderWidth: 2.5, borderColor: 'rgba(255,255,255,0.45)' },
  avatarFallback: { width: rf(62), height: rf(62), borderRadius: rf(31), backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: rf(26), fontWeight: '800' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: rf(15), height: rf(15), borderRadius: rf(8), backgroundColor: '#34C759', borderWidth: 2.5, borderColor: '#fff' },
  profileName: { fontSize: rf(18), fontWeight: '800', color: '#fff' },
  profilePhone: { fontSize: rf(13), color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  profileBio: { fontSize: rf(12.5), color: 'rgba(255,255,255,0.58)', marginTop: 3, maxWidth: SW * 0.55 },

  quickRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', marginHorizontal: rf(14), marginBottom: rf(12), borderRadius: 18, padding: rf(16), elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  quickBtn: { alignItems: 'center', gap: 7, minWidth: rf(56) },
  quickIcon: { width: rf(46), height: rf(46), borderRadius: rf(15), alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: rf(11.5), fontWeight: '600', color: COLORS.dark },

  section: { marginHorizontal: rf(14), marginBottom: rf(10) },
  sectionTitle: { fontSize: rf(11.5), fontWeight: '700', color: COLORS.textGray, paddingHorizontal: 4, paddingVertical: 7, textTransform: 'uppercase', letterSpacing: 0.6 },
  sectionBody: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },

  row: { flexDirection: 'row', alignItems: 'center', gap: rf(12), paddingHorizontal: rf(14), paddingVertical: rf(13.5), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F2F2F7' },
  iconWrap: { width: rf(36), height: rf(36), borderRadius: rf(10), alignItems: 'center', justifyContent: 'center' },
  iconWrapDanger: { backgroundColor: '#FFEBEE' },
  rowInfo: { flex: 1 },
  rowLabel: { fontSize: rf(15.5), color: COLORS.dark, fontWeight: '500' },
  rowSublabel: { fontSize: rf(12.5), color: COLORS.textGray, marginTop: 2 },
  rightText: { fontSize: rf(13.5), color: COLORS.gray, textTransform: 'capitalize' },

  footer: { alignItems: 'center', paddingVertical: rf(36), paddingHorizontal: 24, gap: 5 },
  footerLogo: { width: rf(52), height: rf(52), borderRadius: rf(16), backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  footerText: { fontSize: rf(14), fontWeight: '700', color: COLORS.textGray },
  footerSub: { fontSize: rf(12.5), color: COLORS.gray },
  footerEnc: { fontSize: rf(11.5), color: COLORS.gray, marginTop: 2 },
});
