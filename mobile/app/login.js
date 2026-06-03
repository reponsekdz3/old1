import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, useWindowDimensions, Animated, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import PhoneInput from '../components/PhoneInput';
import { useAuthStore } from '../services/store';
import { TokenStorage } from '../services/storage';
import api from '../services/api';
import e2eeManager from '../services/e2ee';
import { autoSyncOnLogin } from '../services/phoneContacts';
import { COLORS } from '../config';

export default function LoginPage() {
  const { width: W, height: H } = useWindowDimensions();
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwFocused, setPwFocused] = useState(false);
  const scrollRef = useRef(null);

  const isSmall = H < 700;
  const heroH = isSmall ? H * 0.28 : H * 0.34;
  const pad = W * 0.06;
  const fs = (base) => base * (W / 390);

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
      
      // Initialize E2EE in background
      e2eeManager.initialize(data.user.id).catch(err => 
        console.warn('[Login] E2EE init failed:', err)
      );
      
      // Sync contacts in background
      autoSyncOnLogin().catch(err => 
        console.warn('[Login] Contact sync failed:', err)
      );
      
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

  const s = makeStyles(W, H, pad, fs);

  return (
    <View style={s.screen}>
      {/* Fixed download banner at bottom — always visible */}
      <DownloadBanner rf={fs} />

      <LinearGradient colors={['#064E45', '#075E54', '#0A8C7E']} style={[s.hero, { height: heroH }]}>
        <SafeAreaView edges={['top']} style={s.heroInner}>
          <View style={s.logoWrap}>
            <View style={s.logoCircle}>
              <Ionicons name="chatbubbles" size={fs(34)} color="#fff" />
            </View>
            <Text style={s.appName}>VipChat</Text>
            <Text style={s.tagline}>Your world, connected</Text>
          </View>
        </SafeAreaView>
        <View style={s.heroDecor1} />
        <View style={s.heroDecor2} />
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[s.formOuter, { paddingBottom: H * 0.06 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.formCard}>
            <Text style={s.formTitle}>Welcome back</Text>
            <Text style={s.formSub}>Sign in to continue your conversations</Text>

            <View style={s.field}>
              <Text style={s.label}>Phone Number</Text>
              <PhoneInput value={phone} onChange={(v) => { setPhone(v); setPhoneError(''); }} error={!!phoneError} />
              {phoneError ? <View style={s.errRow}><Ionicons name="alert-circle" size={13} color={COLORS.danger} /><Text style={s.errText}>{phoneError}</Text></View> : null}
            </View>

            <View style={s.field}>
              <Text style={s.label}>Password</Text>
              <View style={[s.pwBox, pwFocused && s.pwBoxFocused, pwError && s.pwBoxErr]}>
                <Ionicons name="lock-closed-outline" size={fs(18)} color={pwFocused ? COLORS.accent : COLORS.gray} style={{ marginLeft: pad * 0.8 }} />
                <TextInput
                  style={s.pwInput}
                  value={password}
                  onChangeText={t => { setPassword(t); setPwError(''); }}
                  placeholder="Enter your password"
                  placeholderTextColor={COLORS.gray}
                  secureTextEntry={!showPw}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                />
                <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={fs(19)} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
              {pwError ? <View style={s.errRow}><Ionicons name="alert-circle" size={13} color={COLORS.danger} /><Text style={s.errText}>{pwError}</Text></View> : null}
            </View>

            <TouchableOpacity
              style={[s.cta, loading && s.ctaDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.84}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={s.ctaText}>Sign In</Text>
                  <View style={s.ctaArrow}>
                    <Ionicons name="arrow-forward" size={fs(17)} color={COLORS.accent} />
                  </View>
                </>
              )}
            </TouchableOpacity>

            <View style={s.divRow}>
              <View style={s.div} />
              <Text style={s.orText}>or</Text>
              <View style={s.div} />
            </View>

            <TouchableOpacity
              style={s.ghostBtn}
              onPress={() => router.push('/signup')}
              activeOpacity={0.8}
            >
              <Ionicons name="person-add-outline" size={fs(17)} color={COLORS.accent} />
              <Text style={s.ghostText}>Create a New Account</Text>
            </TouchableOpacity>
          </View>

          <View style={s.footer}>
            <Ionicons name="lock-closed" size={11} color={COLORS.accent} />
            <Text style={s.footerText}>End-to-end encrypted · Your messages are private</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function DownloadBanner({ rf }) {
  const open = (url) => Linking.openURL(url).catch(() => {});
  return (
    <View style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 99,
      backgroundColor: '#075E54', paddingVertical: 8, paddingHorizontal: 16,
      flexDirection: 'row', alignItems: 'center', gap: 10,
    }}>
      <Ionicons name="phone-portrait-outline" size={rf(15)} color="#fff" />
      <Text style={{ color: '#fff', fontSize: rf(11.5), fontWeight: '700', flex: 1 }}>
        VipChat — Download on your phone
      </Text>
      <TouchableOpacity
        onPress={() => open('https://apps.apple.com/app/vipchat')}
        style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons name="logo-apple" size={rf(12)} color="#fff" />
        <Text style={{ color: '#fff', fontSize: rf(10.5), fontWeight: '700' }}>iOS</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => open('https://play.google.com/store/apps/details?id=com.vipchat.app')}
        style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', gap: 4 }}
        activeOpacity={0.75}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      >
        <Ionicons name="logo-google-playstore" size={rf(12)} color="#fff" />
        <Text style={{ color: '#fff', fontSize: rf(10.5), fontWeight: '700' }}>Android</Text>
      </TouchableOpacity>
    </View>
  );
}

function makeStyles(W, H, pad, fs) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F0F2F5' },
    hero: {
      overflow: 'hidden',
    },
    heroInner: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    heroDecor1: {
      position: 'absolute', bottom: -40, right: -40,
      width: W * 0.55, height: W * 0.55, borderRadius: W * 0.275,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    heroDecor2: {
      position: 'absolute', top: -20, left: -30,
      width: W * 0.4, height: W * 0.4, borderRadius: W * 0.2,
      backgroundColor: 'rgba(255,255,255,0.06)',
    },
    logoWrap: { alignItems: 'center', gap: 10 },
    logoCircle: {
      width: fs(72), height: fs(72), borderRadius: fs(22),
      backgroundColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)',
    },
    appName: { fontSize: fs(28), fontWeight: '800', color: '#fff', letterSpacing: 0.5, marginTop: 4 },
    tagline: { fontSize: fs(12.5), color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
    formOuter: { paddingHorizontal: pad, paddingTop: pad * 0.8 },
    formCard: {
      backgroundColor: '#fff', borderRadius: 24,
      padding: pad, paddingTop: pad * 1.1,
      shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    formTitle: { fontSize: fs(23), fontWeight: '800', color: COLORS.dark, marginBottom: 4 },
    formSub: { fontSize: fs(13.5), color: COLORS.textGray, marginBottom: fs(26) },
    field: { marginBottom: fs(18) },
    label: { fontSize: fs(12.5), fontWeight: '700', color: COLORS.dark, marginBottom: 7, letterSpacing: 0.2 },
    errRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
    errText: { fontSize: fs(12), color: COLORS.danger, flex: 1 },
    pwBox: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
      backgroundColor: '#fff',
    },
    pwBoxFocused: { borderColor: COLORS.accent, backgroundColor: '#F7FFFC' },
    pwBoxErr: { borderColor: COLORS.danger },
    pwInput: {
      flex: 1, fontSize: fs(15), color: COLORS.dark,
      paddingHorizontal: pad * 0.6, paddingVertical: fs(15),
    },
    eyeBtn: { paddingRight: pad * 0.7, paddingVertical: fs(14) },
    cta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: fs(16),
      marginTop: 6,
      shadowColor: COLORS.accent, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    ctaDisabled: { backgroundColor: '#B2DFC8', shadowOpacity: 0 },
    ctaText: { fontSize: fs(16.5), fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    ctaArrow: {
      width: fs(28), height: fs(28), borderRadius: fs(14),
      backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    },
    divRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: fs(20) },
    div: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.border },
    orText: { fontSize: fs(13), color: COLORS.gray },
    ghostBtn: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
      borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: fs(14),
      backgroundColor: '#FAFAFA',
    },
    ghostText: { fontSize: fs(15), fontWeight: '700', color: COLORS.dark },
    footer: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: 5, marginTop: fs(18),
    },
    footerText: { fontSize: fs(11.5), color: COLORS.textGray },
  });
}
