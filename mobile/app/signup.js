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

const STEPS = ['Phone', 'Verify', 'Profile'];

export default function SignupPage() {
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

  const clearErrors = () => setErrors({});

  const handleSendCode = async () => {
    clearErrors();
    if (!phone.trim() || phone.length < 7) {
      setErrors({ phone: 'Enter a valid phone number' });
      return;
    }
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
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    clearErrors();
    if (!code.trim() || code.length < 4) {
      setErrors({ code: 'Enter the 6-digit code' });
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/verify-code', {
        phone_number: phone.replace(/\s/g, ''),
        code: code.trim(),
      });
      setStep(2);
    } catch (err) {
      setErrors({ code: err.response?.data?.error || 'Invalid or expired code' });
    } finally {
      setLoading(false);
    }
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
      const msg = err.response?.data?.error || 'Signup failed';
      Alert.alert('Signup Failed', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(s => s - 1);
    else router.back();
  };

  const renderStep = () => {
    if (step === 0) return (
      <>
        <Text style={styles.stepTitle}>Enter your phone number</Text>
        <Text style={styles.stepSubtitle}>We'll send you a verification code</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Phone Number</Text>
          <PhoneInput value={phone} onChange={setPhone} error={errors.phone} />
          {errors.phone ? <Text style={styles.errorText}>{errors.phone}</Text> : null}
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleSendCode} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Text style={styles.primaryBtnText}>Send Code</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></>
          )}
        </TouchableOpacity>
      </>
    );

    if (step === 1) return (
      <>
        <Text style={styles.stepTitle}>Verify your number</Text>
        <Text style={styles.stepSubtitle}>Enter the 6-digit code sent to {phone}</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Verification Code</Text>
          <TextInput
            style={[styles.codeInput, errors.code && styles.inputError]}
            value={code}
            onChangeText={t => { setCode(t.replace(/\D/g, '')); clearErrors(); }}
            placeholder="000000"
            placeholderTextColor={COLORS.gray}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            autoFocus
          />
          {errors.code ? <Text style={styles.errorText}>{errors.code}</Text> : null}
        </View>
        <TouchableOpacity style={styles.primaryBtn} onPress={handleVerifyCode} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Text style={styles.primaryBtnText}>Verify Code</Text><Ionicons name="checkmark" size={18} color="#fff" /></>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.resendBtn} onPress={handleSendCode} disabled={loading}>
          <Text style={styles.resendText}>Resend code</Text>
        </TouchableOpacity>
      </>
    );

    return (
      <>
        <Text style={styles.stepTitle}>Create your profile</Text>
        <Text style={styles.stepSubtitle}>Almost there! Set up your account</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={[styles.input, errors.name && styles.inputError]}
            value={name}
            onChangeText={t => { setName(t); clearErrors(); }}
            placeholder="Your full name"
            placeholderTextColor={COLORS.gray}
            autoCapitalize="words"
            autoFocus
          />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={[styles.pwContainer, errors.password && styles.inputError]}>
            <Ionicons name="lock-closed" size={18} color={COLORS.accent} style={styles.pwIcon} />
            <TextInput
              style={styles.pwInput}
              value={password}
              onChangeText={t => { setPassword(t); clearErrors(); }}
              placeholder="Create a password"
              placeholderTextColor={COLORS.gray}
              secureTextEntry={!showPw}
              autoCapitalize="none"
            />
            <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPw ? 'eye-off' : 'eye'} size={18} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={[styles.input, errors.confirmPw && styles.inputError]}
            value={confirmPw}
            onChangeText={t => { setConfirmPw(t); clearErrors(); }}
            placeholder="Repeat your password"
            placeholderTextColor={COLORS.gray}
            secureTextEntry={!showPw}
            autoCapitalize="none"
          />
          {errors.confirmPw ? <Text style={styles.errorText}>{errors.confirmPw}</Text> : null}
        </View>

        <TouchableOpacity style={styles.primaryBtn} onPress={handleCreateAccount} disabled={loading} activeOpacity={0.85}>
          {loading ? <ActivityIndicator color="#fff" /> : (
            <><Text style={styles.primaryBtnText}>Create Account</Text><Ionicons name="checkmark-circle" size={18} color="#fff" /></>
          )}
        </TouchableOpacity>
      </>
    );
  };

  return (
    <View style={styles.screen}>
      <LinearGradient colors={['#075E54', '#128C7E']} style={styles.header}>
        <SafeAreaView>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Create Account</Text>
            <View style={styles.stepsRow}>
              {STEPS.map((s, i) => (
                <View key={s} style={[styles.stepDot, i === step && styles.stepDotActive, i < step && styles.stepDotDone]} />
              ))}
            </View>
          </View>
          <Text style={styles.stepLabel}>{`Step ${step + 1} of 3 — ${STEPS[step]}`}</Text>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.formContainer} keyboardShouldPersistTaps="handled">
          {renderStep()}

          <TouchableOpacity style={styles.loginLink} onPress={() => router.push('/login')}>
            <Text style={styles.loginLinkText}>Already have an account? <Text style={{ color: COLORS.accent, fontWeight: '600' }}>Sign In</Text></Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  header: { paddingBottom: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12 },
  backBtn: { padding: 4 },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: '#fff' },
  stepsRow: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepDotActive: { backgroundColor: '#fff', width: 20 },
  stepDotDone: { backgroundColor: COLORS.accent },
  stepLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, paddingHorizontal: 20, marginTop: 4 },
  formContainer: { padding: 24 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: COLORS.dark, marginBottom: 6 },
  stepSubtitle: { fontSize: 14, color: COLORS.textGray, marginBottom: 24 },
  field: { marginBottom: 18 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.dark, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    fontSize: 15, color: COLORS.dark, paddingHorizontal: 16, paddingVertical: 14,
  },
  codeInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
    fontSize: 28, fontWeight: '700', color: COLORS.dark, paddingVertical: 16,
    letterSpacing: 8,
  },
  inputError: { borderColor: COLORS.danger },
  pwContainer: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14,
  },
  pwIcon: { paddingLeft: 14 },
  pwInput: { flex: 1, fontSize: 15, color: COLORS.dark, paddingHorizontal: 12, paddingVertical: 14 },
  eyeBtn: { paddingRight: 14 },
  errorText: { color: COLORS.danger, fontSize: 12, marginTop: 4 },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 16, marginTop: 8,
    elevation: 3, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendBtn: { alignItems: 'center', marginTop: 16 },
  resendText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 24 },
  loginLinkText: { fontSize: 14, color: COLORS.textGray },
});
