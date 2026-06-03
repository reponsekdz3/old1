import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image, Share,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { COLORS } from '../config';

const STATUS_PRESETS = [
  { icon: '👋', text: 'Hey there! I am using VipChat.' },
  { icon: '🟢', text: 'Available' },
  { icon: '🔴', text: 'Busy' },
  { icon: '🏫', text: 'At school' },
  { icon: '😴', text: 'Sleeping' },
  { icon: '🏋️', text: 'At the gym' },
  { icon: '🔋', text: 'Low battery' },
  { icon: '🚫', text: 'Do not disturb' },
  { icon: '🎧', text: 'Listening to music' },
  { icon: '✈️', text: 'Traveling' },
  { icon: '💼', text: 'At work' },
  { icon: '🤒', text: 'Not feeling well' },
];

function Field({ label, children, hint }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {hint ? <Text style={s.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function InfoRow({ icon, label, value, onPress }) {
  return (
    <TouchableOpacity style={s.infoRow} onPress={onPress} disabled={!onPress} activeOpacity={onPress ? 0.65 : 1}>
      <View style={s.infoIconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={s.infoValue} numberOfLines={1}>{value || '—'}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />}
    </TouchableOpacity>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.full_name || '');
  const [bio, setBio] = useState(user?.bio || user?.about || '');
  const [email, setEmail] = useState(user?.email || '');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [country, setCountry] = useState(user?.country || '');
  const [city, setCity] = useState(user?.city || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUri, setAvatarUri] = useState(user?.avatar_url || null);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [activeSection, setActiveSection] = useState('edit'); // 'edit' | 'info' | 'security'

  useFocusEffect(useCallback(() => {
    setName(user?.full_name || '');
    setBio(user?.bio || user?.about || '');
    setEmail(user?.email || '');
    setAge(user?.age ? String(user.age) : '');
    setCountry(user?.country || '');
    setCity(user?.city || '');
    setAvatarUri(user?.avatar_url || null);
  }, [user]));

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', { uri: result.assets[0].uri, name: 'avatar.jpg', type: 'image/jpeg' });
      const { data } = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = data.url || data.image_url;
      setAvatarUri(url);
    } catch {
      Alert.alert('Error', 'Failed to upload photo. Try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        full_name: name.trim(),
        bio: bio.trim() || undefined,
        about: bio.trim() || undefined,
        email: email.trim() || undefined,
        age: age ? parseInt(age) : undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        avatar_url: avatarUri || undefined,
      };
      const { data } = await api.put('/auth/user/profile', payload);
      updateUser(data.user || payload);
      Alert.alert('Saved!', 'Your profile has been updated.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const shareQR = async () => {
    try {
      await Share.share({
        message: `Chat with me on VipChat!\nPhone: ${user?.phone_number}\nDownload: vipchat.app`,
        title: 'VipChat Contact',
      });
    } catch {}
  };

  const selectStatus = (text) => {
    setBio(text);
    setShowStatusPicker(false);
  };

  const tabs = [
    { id: 'edit', label: 'Edit', icon: 'create-outline' },
    { id: 'info', label: 'Info', icon: 'information-circle-outline' },
    { id: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  ];

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      {/* Header gradient */}
      <LinearGradient colors={[COLORS.primary, COLORS.secondary]} style={s.header}>
        <SafeAreaView edges={[]} style={s.headerInner}>
          {/* Avatar */}
          <TouchableOpacity onPress={handlePickAvatar} style={s.avatarWrap} activeOpacity={0.8}>
            {uploading ? (
              <View style={s.avatarPlaceholder}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={s.avatarImg} />
            ) : (
              <Avatar name={name || user?.full_name} size={96} />
            )}
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={17} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={s.headerName}>{name || user?.full_name || 'Your Name'}</Text>
          <Text style={s.headerPhone}>{user?.phone_number}</Text>
          <Text style={s.headerBio} numberOfLines={2}>{bio || 'Tap Edit to set your status'}</Text>

          {/* Quick actions */}
          <View style={s.headerActions}>
            <TouchableOpacity style={s.headerAction} onPress={shareQR}>
              <Ionicons name="qr-code" size={20} color="#fff" />
              <Text style={s.headerActionLabel}>Share</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.headerAction} onPress={() => router.push('/qr')}>
              <Ionicons name="scan" size={20} color="#fff" />
              <Text style={s.headerActionLabel}>My QR</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.headerAction} onPress={() => setActiveSection('security')}>
              <Ionicons name="lock-closed" size={20} color="#fff" />
              <Text style={s.headerActionLabel}>Security</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Tabs */}
      <View style={s.tabs}>
        {tabs.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[s.tab, activeSection === t.id && s.tabActive]}
            onPress={() => setActiveSection(t.id)}
          >
            <Ionicons name={t.icon} size={16} color={activeSection === t.id ? COLORS.accent : COLORS.gray} />
            <Text style={[s.tabLabel, activeSection === t.id && s.tabLabelActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* EDIT SECTION */}
      {activeSection === 'edit' && (
        <View style={s.form}>
          <Field label="Full Name *">
            <TextInput
              style={s.input}
              value={name}
              onChangeText={setName}
              placeholder="Your full name"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="words"
            />
          </Field>

          <Field label="About / Status">
            <View style={s.statusRow}>
              <TextInput
                style={[s.input, { flex: 1 }]}
                value={bio}
                onChangeText={setBio}
                placeholder="Hey there! I am using VipChat."
                placeholderTextColor={COLORS.gray}
                maxLength={139}
              />
              <TouchableOpacity style={s.statusPickerBtn} onPress={() => setShowStatusPicker(v => !v)}>
                <Ionicons name="chevron-down" size={18} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            <Text style={s.fieldHint}>{bio.length}/139 characters</Text>
          </Field>

          {showStatusPicker && (
            <View style={s.statusPresets}>
              <Text style={s.presetsLabel}>Quick Status</Text>
              {STATUS_PRESETS.map(p => (
                <TouchableOpacity key={p.text} style={s.presetRow} onPress={() => selectStatus(p.text)}>
                  <Text style={s.presetIcon}>{p.icon}</Text>
                  <Text style={s.presetText}>{p.text}</Text>
                  {bio === p.text && <Ionicons name="checkmark" size={16} color={COLORS.accent} />}
                </TouchableOpacity>
              ))}
            </View>
          )}

          <Field label="Email">
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              placeholderTextColor={COLORS.gray}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>

          <View style={s.twoCol}>
            <View style={{ flex: 1 }}>
              <Field label="Country">
                <TextInput
                  style={s.input}
                  value={country}
                  onChangeText={setCountry}
                  placeholder="Uganda"
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="words"
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="City">
                <TextInput
                  style={s.input}
                  value={city}
                  onChangeText={setCity}
                  placeholder="Kampala"
                  placeholderTextColor={COLORS.gray}
                  autoCapitalize="words"
                />
              </Field>
            </View>
          </View>

          <Field label="Age">
            <TextInput
              style={s.input}
              value={age}
              onChangeText={t => setAge(t.replace(/\D/g, ''))}
              placeholder="25"
              placeholderTextColor={COLORS.gray}
              keyboardType="number-pad"
              maxLength={3}
            />
          </Field>

          <TouchableOpacity style={s.saveBtn} onPress={handleSave} disabled={loading || uploading} activeOpacity={0.85}>
            {loading ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="checkmark-circle" size={20} color="#fff" />
                <Text style={s.saveBtnText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* INFO SECTION */}
      {activeSection === 'info' && (
        <View style={s.infoSection}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Account Info</Text>
            <InfoRow icon="call-outline" label="Phone Number" value={user?.phone_number} />
            <InfoRow icon="mail-outline" label="Email" value={user?.email} />
            <InfoRow icon="location-outline" label="Location" value={[city, country].filter(Boolean).join(', ')} />
            <InfoRow icon="calendar-outline" label="Age" value={user?.age ? `${user.age} years` : null} />
            <InfoRow icon="time-outline" label="Member Since" value={user?.created_at ? new Date(user.created_at).toLocaleDateString([], { year: 'numeric', month: 'long' }) : null} />
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>VipChat Link</Text>
            <TouchableOpacity style={s.linkBox} onPress={shareQR}>
              <View style={{ flex: 1 }}>
                <Text style={s.linkText}>vipchat.app/u/{user?.phone_number}</Text>
                <Text style={s.linkHint}>Tap to share your VipChat contact link</Text>
              </View>
              <Ionicons name="share-social-outline" size={20} color={COLORS.accent} />
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Linked Devices</Text>
            <View style={s.deviceRow}>
              <Ionicons name="phone-portrait-outline" size={22} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.deviceName}>This device</Text>
                <Text style={s.deviceSub}>Active now</Text>
              </View>
              <View style={s.activeDot} />
            </View>
            <TouchableOpacity
              style={s.addDeviceBtn}
              onPress={() => Alert.alert('Linked Devices', 'Scan the QR code on VipChat Web to link your device.')}
            >
              <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
              <Text style={s.addDeviceBtnText}>Link a Device (Web / Desktop)</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* SECURITY SECTION */}
      {activeSection === 'security' && (
        <View style={s.infoSection}>
          <View style={s.card}>
            <Text style={s.cardTitle}>Account Security</Text>

            <TouchableOpacity style={s.securityRow} onPress={() => Alert.alert('Coming Soon', 'Two-step verification will be available in the next update.')}>
              <View style={[s.secIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="lock-closed" size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.secLabel}>Two-Step Verification</Text>
                <Text style={s.secSub}>Add a PIN for extra security</Text>
              </View>
              <View style={s.comingSoonBadge}><Text style={s.comingSoonText}>Soon</Text></View>
            </TouchableOpacity>

            <TouchableOpacity style={s.securityRow} onPress={() => Alert.alert('Change Password', 'Password change coming soon.')}>
              <View style={[s.secIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="key-outline" size={18} color="#FF9500" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.secLabel}>Change Password</Text>
                <Text style={s.secSub}>Update your account password</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity style={s.securityRow} onPress={() => Alert.alert('Active Sessions', 'Session management coming soon.')}>
              <View style={[s.secIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="desktop-outline" size={18} color="#007AFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.secLabel}>Active Sessions</Text>
                <Text style={s.secSub}>Manage where you're logged in</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </TouchableOpacity>

            <TouchableOpacity style={s.securityRow} onPress={() => Alert.alert('Login Alerts', 'Get notified when your account is accessed from a new device.')}>
              <View style={[s.secIcon, { backgroundColor: '#F3E5F5' }]}>
                <Ionicons name="notifications-outline" size={18} color="#9B59B6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.secLabel}>Login Alerts</Text>
                <Text style={s.secSub}>Notify on new device logins</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Encryption</Text>
            <View style={s.encryptionBox}>
              <Ionicons name="shield-checkmark" size={36} color={COLORS.accent} />
              <View style={{ flex: 1 }}>
                <Text style={s.encTitle}>End-to-End Encrypted</Text>
                <Text style={s.encSub}>Your messages and calls are secured with end-to-end encryption. Only you and the recipient can read them.</Text>
              </View>
            </View>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Fingerprint / Face ID</Text>
            <TouchableOpacity style={s.securityRow} onPress={() => Alert.alert('Biometric Lock', 'Lock VipChat with your fingerprint or face — coming soon.')}>
              <View style={[s.secIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="finger-print-outline" size={18} color={COLORS.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.secLabel}>App Lock</Text>
                <Text style={s.secSub}>Use biometrics to unlock the app</Text>
              </View>
              <View style={s.comingSoonBadge}><Text style={s.comingSoonText}>Soon</Text></View>
            </TouchableOpacity>
          </View>

          <View style={s.card}>
            <Text style={s.cardTitle}>Danger Zone</Text>
            <TouchableOpacity
              style={[s.securityRow, { borderBottomWidth: 0 }]}
              onPress={() => Alert.alert(
                'Delete Account',
                'This permanently deletes your account and all data. This cannot be undone.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => router.push('/settings') },
                ]
              )}
            >
              <View style={[s.secIcon, { backgroundColor: '#FFEBEE' }]}>
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.secLabel, { color: '#FF3B30' }]}>Delete Account</Text>
                <Text style={s.secSub}>Permanently remove your account</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F2F2F7' },

  header: { paddingBottom: 20 },
  headerInner: { alignItems: 'center', paddingTop: 20, paddingHorizontal: 20 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatarImg: { width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarPlaceholder: { width: 96, height: 96, borderRadius: 48, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  cameraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  headerName: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 2 },
  headerPhone: { fontSize: 14, color: 'rgba(255,255,255,0.7)', marginBottom: 4 },
  headerBio: { fontSize: 13, color: 'rgba(255,255,255,0.55)', textAlign: 'center', maxWidth: 260, marginBottom: 16 },
  headerActions: { flexDirection: 'row', gap: 24, marginTop: 4 },
  headerAction: { alignItems: 'center', gap: 4 },
  headerActionLabel: { fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 12 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.accent },
  tabLabel: { fontSize: 13, fontWeight: '600', color: COLORS.gray },
  tabLabelActive: { color: COLORS.accent },

  form: { padding: 16, gap: 4 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: COLORS.textGray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldHint: { fontSize: 11, color: COLORS.gray, marginTop: 3 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    fontSize: 15, color: COLORS.dark, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: '#fff',
  },
  twoCol: { flexDirection: 'row', gap: 12 },
  statusRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  statusPickerBtn: {
    width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff',
  },
  statusPresets: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 14,
    backgroundColor: '#fff', marginBottom: 8, overflow: 'hidden',
  },
  presetsLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textGray,
    paddingHorizontal: 14, paddingVertical: 8, backgroundColor: '#F9F9F9',
    textTransform: 'uppercase', letterSpacing: 0.4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  presetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 14, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  presetIcon: { fontSize: 18 },
  presetText: { flex: 1, fontSize: 14, color: COLORS.dark },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 8,
    elevation: 3, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  infoSection: { padding: 12, gap: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
  },
  cardTitle: {
    fontSize: 12, fontWeight: '700', color: COLORS.textGray,
    paddingHorizontal: 16, paddingVertical: 10, textTransform: 'uppercase', letterSpacing: 0.5,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
    backgroundColor: '#FAFAFA',
  },
  infoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  infoIconWrap: {
    width: 34, height: 34, borderRadius: 9, backgroundColor: '#E8F5E9',
    alignItems: 'center', justifyContent: 'center',
  },
  infoLabel: { fontSize: 12, color: COLORS.textGray, marginBottom: 1 },
  infoValue: { fontSize: 14, fontWeight: '600', color: COLORS.dark },

  linkBox: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    margin: 12, padding: 14, backgroundColor: '#F0FFF4',
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.accent + '30',
  },
  linkText: { fontSize: 13, color: COLORS.accent, fontWeight: '600' },
  linkHint: { fontSize: 11, color: COLORS.textGray, marginTop: 2 },

  deviceRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  deviceName: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  deviceSub: { fontSize: 12, color: COLORS.textGray, marginTop: 1 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#34C759' },
  addDeviceBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  addDeviceBtnText: { fontSize: 14, color: COLORS.accent, fontWeight: '600' },

  securityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border,
  },
  secIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  secLabel: { fontSize: 14, fontWeight: '600', color: COLORS.dark },
  secSub: { fontSize: 12, color: COLORS.textGray, marginTop: 1 },
  comingSoonBadge: { backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  comingSoonText: { fontSize: 10, fontWeight: '700', color: '#FF9500' },

  encryptionBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 14,
    margin: 14, padding: 14, backgroundColor: '#F0FFF4',
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.accent + '30',
  },
  encTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, marginBottom: 4 },
  encSub: { fontSize: 12, color: COLORS.textGray, lineHeight: 17 },
});
