import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, Alert, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { COLORS } from '../config';

export default function ProfileScreen() {
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

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
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
      Alert.alert('Error', 'Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) {
      Alert.alert('Error', 'Name must be at least 2 characters'); return;
    }
    setLoading(true);
    try {
      const payload = {
        full_name: name.trim(),
        bio: bio.trim() || undefined,
        email: email.trim() || undefined,
        age: age ? parseInt(age) : undefined,
        country: country.trim() || undefined,
        city: city.trim() || undefined,
        avatar_url: avatarUri || undefined,
      };
      const { data } = await api.put('/auth/user/profile', payload);
      updateUser(data.user || payload);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={['#075E54', '#128C7E']} style={styles.headerGrad}>
        <SafeAreaView edges={[]} style={styles.avatarSection}>
          <TouchableOpacity onPress={handlePickAvatar} style={styles.avatarWrap}>
            {uploading ? (
              <View style={styles.avatarPlaceholder}>
                <ActivityIndicator color="#fff" />
              </View>
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Avatar name={name || user?.full_name} size={90} />
            )}
            <View style={styles.editBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.phoneLbl}>{user?.phone_number}</Text>
        </SafeAreaView>
      </LinearGradient>

      <View style={styles.form}>
        <Field label="Full Name" required>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your full name"
            placeholderTextColor={COLORS.gray}
            autoCapitalize="words"
          />
        </Field>

        <Field label="About">
          <TextInput
            style={[styles.input, styles.textArea]}
            value={bio}
            onChangeText={setBio}
            placeholder="Hey there! I am using Bitese."
            placeholderTextColor={COLORS.gray}
            multiline
            maxLength={139}
          />
          <Text style={styles.charCount}>{bio.length}/139</Text>
        </Field>

        <Field label="Email">
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            placeholderTextColor={COLORS.gray}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </Field>

        <View style={styles.row2}>
          <View style={{ flex: 1 }}>
            <Field label="Country">
              <TextInput
                style={styles.input}
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
                style={styles.input}
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
            style={styles.input}
            value={age}
            onChangeText={t => setAge(t.replace(/\D/g, ''))}
            placeholder="25"
            placeholderTextColor={COLORS.gray}
            keyboardType="number-pad"
            maxLength={3}
          />
        </Field>

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={loading || uploading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Field({ label, required, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  headerGrad: { paddingBottom: 24 },
  avatarSection: { alignItems: 'center', paddingTop: 20 },
  avatarWrap: { position: 'relative', marginBottom: 10 },
  avatarImg: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)' },
  avatarPlaceholder: { width: 90, height: 90, borderRadius: 45, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  phoneLbl: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  form: { padding: 20, gap: 4 },
  field: { marginBottom: 16 },
  label: { fontSize: 12, fontWeight: '700', color: COLORS.textGray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    fontSize: 15, color: COLORS.dark, paddingHorizontal: 14, paddingVertical: 12,
  },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 12 },
  charCount: { fontSize: 11, color: COLORS.gray, textAlign: 'right', marginTop: 3 },
  row2: { flexDirection: 'row', gap: 12 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 16,
    elevation: 3, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
