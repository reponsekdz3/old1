import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhoneInput from '../components/PhoneInput';
import { useAuthStore } from '../services/store';
import { TokenStorage } from '../services/storage';
import api from '../services/api';
import { COLORS } from '../config';

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [pwError, setPwError] = useState('');

  const handleLogin = async () => {
    setPhoneError(''); setPwError('');
    let hasErr = false;
    if (!phone.trim()) { setPhoneError('Phone number is required'); hasErr = true; }
    if (!password) { setPwError('Password is required'); hasErr = true; }
    if (hasErr) return;

    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', {
        phone_number: phone.replace(/\s/g, ''),
        password,
      });
      await TokenStorage.setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.replace('/(tabs)');
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed. Please try again.';
      if (msg.toLowerCase().includes('credentials') || msg.toLowerCase().includes('password') || msg.toLowerCase().includes('phone')) {
        setPhoneError('Incorrect phone number or password');
      } else {
        Alert.alert('Login Failed', msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#075E54', '#128C7E']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Ionicons name="chatbubbles" size={30} color="#fff" />
            </View>
            <View>
              <Text style={styles.appName}>VipChat</Text>
              <Text style={styles.appTagline}>Your world, connected</Text>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.formContainer}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Welcome back</Text>
          <Text style={styles.subtitle}>Sign in to continue your conversations</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Phone Number</Text>
            <PhoneInput
              value={phone}
              onChange={setPhone}
              error={phoneError}
            />
            {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.pwContainer, pwError && styles.inputError]}>
              <Ionicons name="lock-closed" size={18} color={COLORS.accent} style={styles.pwIcon} />
              <TextInput
                style={styles.pwInput}
                value={password}
                onChangeText={t => { setPassword(t); setPwError(''); }}
                placeholder="Enter your password"
                placeholderTextColor={COLORS.gray}
                secureTextEntry={!showPw}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
                <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
            {pwError ? <Text style={styles.errorText}>{pwError}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginBtnText}>Sign In</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.orText}>or</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={styles.signupBtn}
            onPress={() => router.push('/signup')}
            activeOpacity={0.8}
          >
            <Text style={styles.signupBtnText}>Create a New Account</Text>
            <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
          </TouchableOpacity>

          <View style={styles.encryptedRow}>
            <Ionicons name="lock-closed" size={12} color={COLORS.accent} />
            <Text style={styles.encryptedText}>End-to-end encrypted · Your messages are private</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingBottom: 20 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingTop: 12 },
  logoIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: 24, fontWeight: '800', color: '#fff' },
  appTagline: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 1 },
  formContainer: { padding: 24, paddingTop: 28 },
  title: { fontSize: 26, fontWeight: '800', color: COLORS.dark, marginBottom: 6 },
  subtitle: { fontSize: 14, color: COLORS.textGray, marginBottom: 28 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  pwContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    backgroundColor: '#fff',
  },
  inputError: { borderColor: COLORS.danger },
  pwIcon: { paddingLeft: 14 },
  pwInput: { flex: 1, fontSize: 15, color: COLORS.dark, paddingHorizontal: 12, paddingVertical: 14 },
  eyeBtn: { paddingRight: 14 },
  loginBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 8,
    elevation: 3, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  loginBtnDisabled: { backgroundColor: '#ccc' },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1, backgroundColor: COLORS.border },
  orText: { color: COLORS.gray, fontSize: 13 },
  signupBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 14,
  },
  signupBtnText: { color: COLORS.dark, fontSize: 15, fontWeight: '600' },
  encryptedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 20 },
  encryptedText: { fontSize: 11, color: COLORS.textGray },
});
