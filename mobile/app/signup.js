import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Alert, useWindowDimensions,
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

const STEPS = [
  { label: 'Phone', icon: 'call-outline', title: 'Enter your number', sub: "We'll send you a verification code" },
  { label: 'Verify', icon: 'shield-checkmark-outline', title: 'Verify your number', sub: '' },
  { label: 'Profile', icon: 'person-outline', title: 'Create your profile', sub: 'Almost there! Set up your account' },
];

export default function SignupPage() {
  const { width: W, height: H } = useWindowDimensions();
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [pwFocused, setPwFocused] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [cpwFocused, setCpwFocused] = useState(false);
  const scrollRef = useRef(null);

  const isSmall = H < 700;
  const heroH = isSmall ? H * 0.22 : H * 0.28;
  const pad = W * 0.06;
  const fs = (base) => base * (W / 390);

  const clearErrors = () => setErrors({});

  const handleSendCode = async () => {
    clearErrors();
    if (!phone.trim() || phone.length < 7) { setErrors({ phone: 'Enter a valid phone number' }); return; }
    setLoading(true);
    try {
      await api.post('/auth/send-verification-sms', { phone_number: phone.replace(/\s/g, '') });
      setStep(1);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send code';
      if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('exists')) {
        setErrors({ phone: 'This phone number is already registered' });
      } else {
        Alert.alert('Error', msg);
      }
    } finally { setLoading(false); }
  };

  const handleVerifyCode = async () => {
    clearErrors();
    if (!code.trim() || code.length < 4) { setErrors({ code: 'Enter the 6-digit code' }); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify-code', { phone_number: phone.replace(/\s/g, ''), code: code.trim() });
      setStep(2);
    } catch (err) {
      setErrors({ code: err.response?.data?.error || 'Invalid or expired code' });
    } finally { setLoading(false); }
  };

  const handleCreateAccount = async () => {
    clearErrors();
    const errs = {};
    if (!name.trim() || name.trim().length < 2) errs.name = 'Enter your full name (min 2 chars)';
    if (!password || password.length < 6) errs.password = 'Password must be at least 6 characters';
    if (password !== confirmPw) errs.confirmPw = 'Passwords do not match';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', {
        phone_number: phone.replace(/\s/g, ''),
        full_name: name.trim(),
        password,
        verification_code: code.trim(),
      });
      await TokenStorage.setTokens(data.access_token, data.refresh_token);
      setUser(data.user);
      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert('Signup Failed', err.response?.data?.error || 'Signup failed');
    } finally { setLoading(false); }
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
    else router.back();
  };

  const handlePrimary = [handleSendCode, handleVerifyCode, handleCreateAccount][step];
  const primaryLabels = ['Send Verification Code', 'Verify Code', 'Create Account'];
  const primaryIcons = ['arrow-forward', 'checkmark-circle-outline', 'checkmark-circle'];
  const s = makeStyles(W, H, pad, fs);

  const renderStepContent = () => {
    if (step === 0) return (
      <>
        <View style={s.field}>
          <Text style={s.label}>Phone Number</Text>
          <PhoneInput value={phone} onChange={(v) => { setPhone(v); clearErrors(); }} error={!!errors.phone} />
          {errors.phone ? <ErrRow msg={errors.phone} fs={fs} s={s} /> : null}
        </View>
      </>
    );

    if (step === 1) return (
      <>
        <View style={[s.codeHint, { marginBottom: fs(20) }]}>
          <Ionicons name="chatbubble-ellipses-outline" size={fs(16)} color={COLORS.accent} />
          <Text style={s.codeHintText}>Code sent to <Text style={{ fontWeight: '700', color: COLORS.dark }}>{phone}</Text></Text>
        </View>
        <View style={s.field}>
          <Text style={s.label}>Verification Code</Text>
          <TextInput
            style={[s.codeInput, errors.code && s.fieldErr]}
            value={code}
            onChangeText={t => { setCode(t.replace(/\D/g, '')); clearErrors(); }}
            placeholder="• • • • • •"
            placeholderTextColor={COLORS.gray}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            autoFocus
          />
          {errors.code ? <ErrRow msg={errors.code} fs={fs} s={s} /> : null}
        </View>
        <TouchableOpacity style={s.resendBtn} onPress={handleSendCode} disabled={loading}>
          <Text style={s.resendText}>Didn't get a code? <Text style={{ color: COLORS.accent, fontWeight: '700' }}>Resend</Text></Text>
        </TouchableOpacity>
      </>
    );

    return (
      <>
        <View style={s.field}>
          <Text style={s.label}>Full Name</Text>
          <View style={[s.inputBox, nameFocused && s.inputFocused, errors.name && s.fieldErr]}>
            <Ionicons name="person-outline" size={fs(17)} color={nameFocused ? COLORS.accent : COLORS.gray} style={s.inputIcon} />
            <TextInput
              style={s.inputInner}
              value={name}
              onChangeText={t => { setName(t); clearErrors(); }}
              placeholder="Your full name"
              placeholderTextColor={COLORS.gray}
              autoCapitalize="words"
              autoFocus
              onFocus={() => setNameFocused(true)}
              onBlur={() => setNameFocused(false)}
            />
          </View>
          {errors.name ? <ErrRow msg={errors.name} fs={fs} s={s} /> : null}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Password</Text>
          <View style={[s.inputBox, pwFocused && s.inputFocused, errors.password && s.fieldErr]}>
            <Ionicons name="lock-closed-outline" size={fs(17)} color={pwFocused ? COLORS.accent : COLORS.gray} style={s.inputIcon} />
            <TextInput
              style={s.inputInner}
              value={password}
              onChangeText={t => { setPassword(t); clearErrors(); }}
              placeholder="Create a password"
              placeholderTextColor={COLORS.gray}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              onFocus={() => setPwFocused(true)}
              onBlur={() => setPwFocused(false)}
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={s.eyeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name={showPw ? 'eye-off-outline' : 'eye-outline'} size={fs(18)} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
          {errors.password ? <ErrRow msg={errors.password} fs={fs} s={s} /> : null}
        </View>

        <View style={s.field}>
          <Text style={s.label}>Confirm Password</Text>
          <View style={[s.inputBox, cpwFocused && s.inputFocused, errors.confirmPw && s.fieldErr]}>
            <Ionicons name="shield-checkmark-outline" size={fs(17)} color={cpwFocused ? COLORS.accent : COLORS.gray} style={s.inputIcon} />
            <TextInput
              style={s.inputInner}
              value={confirmPw}
              onChangeText={t => { setConfirmPw(t); clearErrors(); }}
              placeholder="Repeat your password"
              placeholderTextColor={COLORS.gray}
              secureTextEntry={!showPw}
              autoCapitalize="none"
              onFocus={() => setCpwFocused(true)}
              onBlur={() => setCpwFocused(false)}
            />
          </View>
          {errors.confirmPw ? <ErrRow msg={errors.confirmPw} fs={fs} s={s} /> : null}
        </View>
      </>
    );
  };

  return (
    <View style={s.screen}>
      <LinearGradient colors={['#064E45', '#075E54', '#0A8C7E']} style={[s.hero, { height: heroH }]}>
        <SafeAreaView edges={['top']} style={{ flex: 1 }}>
          <View style={s.heroNav}>
            <TouchableOpacity onPress={handleBack} style={s.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="arrow-back" size={fs(22)} color="#fff" />
            </TouchableOpacity>
            <View style={s.stepPills}>
              {STEPS.map((st, i) => (
                <View
                  key={st.label}
                  style={[
                    s.pill,
                    i === step && s.pillActive,
                    i < step && s.pillDone,
                  ]}
                >
                  {i < step ? (
                    <Ionicons name="checkmark" size={fs(10)} color="#fff" />
                  ) : (
                    <Text style={[s.pillText, i === step && s.pillTextActive]}>{i + 1}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
          <View style={s.heroBody}>
            <View style={[s.stepIconBg, { opacity: 0.9 }]}>
              <Ionicons name={STEPS[step].icon} size={fs(22)} color="#fff" />
            </View>
            <View>
              <Text style={s.heroTitle}>{STEPS[step].title}</Text>
              <Text style={s.heroSub}>Step {step + 1} of 3 · {STEPS[step].label}</Text>
            </View>
          </View>
        </SafeAreaView>
        <View style={s.heroDecor} />
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[s.formOuter, { paddingBottom: H * 0.06 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={s.formCard}>
            <Text style={s.sectionTitle}>{step === 0 ? 'Phone Number' : step === 1 ? 'Verify Identity' : 'Profile Setup'}</Text>
            <Text style={s.sectionSub}>{STEPS[step].sub || `Sent to ${phone}`}</Text>
            {renderStepContent()}

            <TouchableOpacity
              style={[s.cta, loading && s.ctaDisabled]}
              onPress={handlePrimary}
              disabled={loading}
              activeOpacity={0.84}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={s.ctaText}>{primaryLabels[step]}</Text>
                  <View style={s.ctaArrow}>
                    <Ionicons name={primaryIcons[step]} size={fs(16)} color={COLORS.accent} />
                  </View>
                </>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.loginLink} onPress={() => router.push('/login')} activeOpacity={0.7}>
            <Text style={s.loginLinkText}>
              Already have an account?{' '}
              <Text style={{ color: COLORS.accent, fontWeight: '700' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function ErrRow({ msg, fs, s }) {
  return (
    <View style={s.errRow}>
      <Ionicons name="alert-circle" size={13} color={COLORS.danger} />
      <Text style={s.errText}>{msg}</Text>
    </View>
  );
}

function makeStyles(W, H, pad, fs) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: '#F0F2F5' },
    hero: { overflow: 'hidden' },
    heroDecor: {
      position: 'absolute', bottom: -50, right: -40,
      width: W * 0.6, height: W * 0.6, borderRadius: W * 0.3,
      backgroundColor: 'rgba(255,255,255,0.07)',
    },
    heroNav: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingHorizontal: pad, paddingTop: 6, paddingBottom: 8,
    },
    backBtn: {
      width: fs(38), height: fs(38), borderRadius: fs(19),
      backgroundColor: 'rgba(255,255,255,0.15)',
      alignItems: 'center', justifyContent: 'center',
    },
    stepPills: { flexDirection: 'row', gap: 6 },
    pill: {
      width: fs(26), height: fs(26), borderRadius: fs(13),
      backgroundColor: 'rgba(255,255,255,0.2)',
      alignItems: 'center', justifyContent: 'center',
    },
    pillActive: { backgroundColor: '#fff', width: fs(50) },
    pillDone: { backgroundColor: COLORS.accent },
    pillText: { fontSize: fs(11), fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
    pillTextActive: { color: COLORS.primary },
    heroBody: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: pad, flex: 1 },
    stepIconBg: {
      width: fs(44), height: fs(44), borderRadius: fs(13),
      backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
    },
    heroTitle: { fontSize: fs(19), fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
    heroSub: { fontSize: fs(12), color: 'rgba(255,255,255,0.7)', marginTop: 2, fontWeight: '500' },
    formOuter: { paddingHorizontal: pad, paddingTop: pad * 0.8 },
    formCard: {
      backgroundColor: '#fff', borderRadius: 24, padding: pad, paddingTop: pad,
      shadowColor: '#000', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 },
      elevation: 4,
    },
    sectionTitle: { fontSize: fs(20), fontWeight: '800', color: COLORS.dark, marginBottom: 4 },
    sectionSub: { fontSize: fs(13), color: COLORS.textGray, marginBottom: fs(22) },
    field: { marginBottom: fs(16) },
    label: { fontSize: fs(12.5), fontWeight: '700', color: COLORS.dark, marginBottom: 7, letterSpacing: 0.2 },
    inputBox: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, backgroundColor: '#fff',
    },
    inputFocused: { borderColor: COLORS.accent, backgroundColor: '#F7FFFC' },
    fieldErr: { borderColor: COLORS.danger },
    inputIcon: { marginLeft: pad * 0.75 },
    inputInner: { flex: 1, fontSize: fs(15), color: COLORS.dark, paddingHorizontal: pad * 0.6, paddingVertical: fs(15) },
    eyeBtn: { paddingRight: pad * 0.7, paddingVertical: fs(14) },
    errRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
    errText: { fontSize: fs(12), color: COLORS.danger, flex: 1 },
    codeHint: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: '#F0FFF7', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#C7F0DC',
    },
    codeHintText: { fontSize: fs(13), color: COLORS.textGray, flex: 1 },
    codeInput: {
      borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
      fontSize: fs(28), fontWeight: '700', color: COLORS.dark,
      paddingVertical: fs(16), letterSpacing: 12,
    },
    resendBtn: { alignItems: 'center', paddingVertical: 6 },
    resendText: { fontSize: fs(13.5), color: COLORS.textGray },
    cta: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
      backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: fs(16), marginTop: 8,
      shadowColor: COLORS.accent, shadowOpacity: 0.38, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
      elevation: 5,
    },
    ctaDisabled: { backgroundColor: '#B2DFC8', shadowOpacity: 0 },
    ctaText: { fontSize: fs(15.5), fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
    ctaArrow: {
      width: fs(28), height: fs(28), borderRadius: fs(14),
      backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    },
    loginLink: { alignItems: 'center', marginTop: fs(18) },
    loginLinkText: { fontSize: fs(14), color: COLORS.textGray },
  });
}
