import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Share, ScrollView,
  useWindowDimensions, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { COLORS } from '../config';

const TABS = ['My Code', 'Scan', 'Web Login'];

export default function QRScreen() {
  const { width: W, height: H } = useWindowDimensions();
  const rf = (n) => n * (W / 390);
  const QR_FRAME = Math.min(W * 0.58, 240);

  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);

  // My Code
  const [qrData, setQrData] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);

  // Contact Scan
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [addingSent, setAddingSent] = useState(false);
  const [addDone, setAddDone] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Web Login
  const [webLoginScanning, setWebLoginScanning] = useState(false);
  const [webLoginScanned, setWebLoginScanned] = useState(false);
  const [webLoginConfirmed, setWebLoginConfirmed] = useState(false);
  const [webLoginError, setWebLoginError] = useState('');
  const [webPermission, requestWebPermission] = useCameraPermissions();

  // Animated scan line
  const scanLine = useRef(new Animated.Value(0)).current;
  const scanLineLoop = useRef(null);

  const startScanLine = () => {
    scanLine.setValue(0);
    scanLineLoop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLine, { toValue: 1, duration: 1600, useNativeDriver: true }),
        Animated.timing(scanLine, { toValue: 0, duration: 1600, useNativeDriver: true }),
      ])
    );
    scanLineLoop.current.start();
  };

  const stopScanLine = () => {
    scanLineLoop.current?.stop();
    scanLine.setValue(0);
  };

  useEffect(() => {
    if (scanning || webLoginScanning) startScanLine();
    else stopScanLine();
    return () => stopScanLine();
  }, [scanning, webLoginScanning]);

  useEffect(() => {
    if (activeTab === 0) generateQR();
    if (activeTab !== 1) { setScanning(false); setScannedUser(null); setScanned(false); }
    if (activeTab !== 2) { setWebLoginScanning(false); setWebLoginScanned(false); setWebLoginError(''); }
  }, [activeTab]);

  const generateQR = async () => {
    setLoadingQR(true);
    try {
      const { data } = await api.post('/qr/generate');
      setQrData(data);
    } catch {
      Alert.alert('Error', 'Failed to generate QR code. Check your connection.');
    } finally {
      setLoadingQR(false);
    }
  };

  const handleContactScan = useCallback(async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    try {
      const res = await api.post('/qr/scan', { qr_data: data });
      setScannedUser(res.data.user);
      if (res.data.is_contact) setAddDone(true);
    } catch {
      Alert.alert('Invalid QR', 'This is not a valid VipChat contact QR code.', [
        { text: 'Scan Again', onPress: () => { setScanned(false); setScanning(true); } },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [scanned]);

  const handleWebLoginScan = useCallback(async ({ data }) => {
    if (webLoginScanned) return;
    setWebLoginScanned(true);
    setWebLoginScanning(false);
    setWebLoginError('');
    try {
      let sessionId = data.startsWith('vipchat://qr-login/')
        ? data.replace('vipchat://qr-login/', '')
        : data;
      await api.post('/auth/qr-session/confirm', { session_id: sessionId });
      setWebLoginConfirmed(true);
    } catch (err) {
      const msg = err.response?.data?.error || 'Could not confirm login. Try again.';
      setWebLoginError(msg);
      setWebLoginScanned(false);
    }
  }, [webLoginScanned]);

  const openCamera = async (forWebLogin = false) => {
    const perm = forWebLogin ? webPermission : permission;
    const req = forWebLogin ? requestWebPermission : requestPermission;
    if (!perm?.granted) {
      const res = await req();
      if (!res.granted) {
        Alert.alert('Camera Required', 'Please allow camera access to scan QR codes.');
        return;
      }
    }
    if (forWebLogin) {
      setWebLoginScanned(false); setWebLoginConfirmed(false); setWebLoginError('');
      setWebLoginScanning(true);
    } else {
      setScanned(false); setScannedUser(null); setAddDone(false);
      setScanning(true);
    }
  };

  const sendContactRequest = async () => {
    if (!scannedUser) return;
    setAddingSent(true);
    try {
      await api.post('/contact-requests/send', {
        user_id: scannedUser.user_id || scannedUser.id,
        message: 'Hi! I scanned your QR code and would like to connect.',
      });
      setAddDone(true);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to send request');
    } finally {
      setAddingSent(false);
    }
  };

  const shareQR = async () => {
    const url = qrData?.qr_code?.qr_image_url || qrData?.qr_image_url;
    if (!url) return;
    try {
      await Share.share({ message: `Scan to add ${user?.full_name} on VipChat!\n${url}`, url });
    } catch {}
  };

  const qrImageUrl = qrData?.qr_code?.qr_image_url || qrData?.qr_image_url;
  const scanCount = qrData?.qr_code?.scan_count ?? qrData?.scan_count ?? 0;

  const scanLineY = scanLine.interpolate({
    inputRange: [0, 1],
    outputRange: [0, QR_FRAME - 3],
  });

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Tab bar */}
      <View style={[s.tabRow, { borderBottomColor: COLORS.border }]}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[s.tab, activeTab === i && { borderBottomColor: COLORS.accent }]}
            onPress={() => setActiveTab(i)}
            activeOpacity={0.7}
          >
            <Text style={[{ fontSize: rf(13.5), fontWeight: '600', color: COLORS.gray },
              activeTab === i && { color: COLORS.accent }]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={[s.scroll, { paddingHorizontal: rf(22), paddingBottom: rf(50) }]} showsVerticalScrollIndicator={false}>

        {/* ── MY CODE ─────────────────────────────────── */}
        {activeTab === 0 && (
          <View style={s.centered}>
            {loadingQR ? (
              <View style={[s.centered, { paddingVertical: rf(60), gap: rf(14) }]}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={{ color: COLORS.textGray, fontSize: rf(14) }}>Generating your QR code…</Text>
              </View>
            ) : qrImageUrl ? (
              <>
                {/* QR Frame */}
                <View style={[s.qrFrame, {
                  width: QR_FRAME, height: QR_FRAME, borderRadius: rf(18),
                  marginBottom: rf(22),
                }]}>
                  <Image source={{ uri: qrImageUrl }} style={{ width: '100%', height: '100%', borderRadius: rf(10) }} resizeMode="contain" />
                  {/* Corners */}
                  {[['TL', 0, 0], ['TR', 0, null], ['BL', null, 0], ['BR', null, null]].map(([key, t, l]) => (
                    <View key={key} style={[{
                      position: 'absolute', width: rf(22), height: rf(22),
                      borderColor: COLORS.accent, borderRadius: rf(3),
                    },
                      t === 0 && l === 0 && { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
                      t === 0 && !l && { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
                      !t && l === 0 && { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
                      !t && !l && { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
                    ]} />
                  ))}
                  {/* Center logo */}
                  <View style={[s.qrLogo, { width: rf(34), height: rf(34), borderRadius: rf(9),
                    transform: [{ translateX: -rf(17) }, { translateY: -rf(17) }] }]}>
                    <Ionicons name="chatbubbles" size={rf(19)} color={COLORS.accent} />
                  </View>
                </View>

                {/* User info */}
                <View style={[s.centered, { gap: rf(4), marginBottom: rf(22) }]}>
                  <Avatar uri={user?.avatar_url} name={user?.full_name} size={rf(50)} />
                  <Text style={{ fontSize: rf(20), fontWeight: '800', color: COLORS.dark, marginTop: rf(8) }}>{user?.full_name}</Text>
                  <Text style={{ fontSize: rf(14), color: COLORS.textGray }}>{user?.phone_number}</Text>
                  {user?.country ? (
                    <Text style={{ fontSize: rf(12.5), color: COLORS.gray }}>
                      {user.country}{user.city ? `, ${user.city}` : ''}
                    </Text>
                  ) : null}
                  <View style={[s.row, { backgroundColor: COLORS.accent + '18', borderRadius: rf(20),
                    paddingHorizontal: rf(12), paddingVertical: rf(4), gap: rf(5), marginTop: rf(4) }]}>
                    <Ionicons name="eye-outline" size={rf(13)} color={COLORS.accent} />
                    <Text style={{ fontSize: rf(12.5), color: COLORS.accent, fontWeight: '700' }}>
                      Scanned {scanCount} time{scanCount !== 1 ? 's' : ''}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={[s.row, { gap: rf(12), width: '100%', marginBottom: rf(18) }]}>
                  <TouchableOpacity style={[s.actionBtn, { borderColor: COLORS.accent, backgroundColor: COLORS.accent + '08' }]}
                    onPress={shareQR} activeOpacity={0.8}>
                    <Ionicons name="share-outline" size={rf(20)} color={COLORS.accent} />
                    <Text style={{ fontSize: rf(15), fontWeight: '700', color: COLORS.accent }}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.actionBtn, { borderColor: COLORS.border, backgroundColor: COLORS.lightGray }]}
                    onPress={generateQR} activeOpacity={0.8}>
                    <Ionicons name="refresh" size={rf(20)} color={COLORS.textGray} />
                    <Text style={{ fontSize: rf(15), fontWeight: '700', color: COLORS.textGray }}>Refresh</Text>
                  </TouchableOpacity>
                </View>

                <Text style={{ fontSize: rf(12.5), color: COLORS.textGray, textAlign: 'center', lineHeight: rf(18) }}>
                  Anyone can scan this code to add you as a contact instantly.
                </Text>
              </>
            ) : (
              <View style={[s.centered, { paddingVertical: rf(60), gap: rf(14) }]}>
                <Ionicons name="qr-code-outline" size={rf(60)} color={COLORS.border} />
                <Text style={{ color: COLORS.textGray, fontSize: rf(14), textAlign: 'center' }}>Could not generate QR code</Text>
                <TouchableOpacity onPress={generateQR} style={s.primaryBtn} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ── SCAN CONTACT ─────────────────────────────── */}
        {activeTab === 1 && (
          <View style={{ width: '100%' }}>
            {scannedUser ? (
              <View style={[s.centered, { paddingTop: rf(12) }]}>
                <View style={[s.card, { width: '100%', gap: rf(8) }]}>
                  <Avatar uri={scannedUser.avatar_url} name={scannedUser.full_name} size={rf(72)} />
                  <Text style={{ fontSize: rf(22), fontWeight: '800', color: COLORS.dark, marginTop: rf(8) }}>{scannedUser.full_name}</Text>
                  <Text style={{ fontSize: rf(15), color: COLORS.textGray }}>{scannedUser.phone_number}</Text>

                  {addDone ? (
                    <View style={[s.row, { backgroundColor: COLORS.accent, borderRadius: rf(20),
                      paddingHorizontal: rf(18), paddingVertical: rf(10), gap: rf(8), marginTop: rf(8) }]}>
                      <Ionicons name="checkmark-circle" size={rf(18)} color="#fff" />
                      <Text style={{ color: '#fff', fontWeight: '700', fontSize: rf(14) }}>Contact request sent!</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={[s.primaryBtn, { marginTop: rf(8), paddingHorizontal: rf(32) }]}
                      onPress={sendContactRequest} disabled={addingSent} activeOpacity={0.85}>
                      {addingSent
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <>
                            <Ionicons name="person-add" size={rf(18)} color="#fff" />
                            <Text style={s.primaryBtnText}>Add Contact</Text>
                          </>}
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity style={[s.row, { gap: rf(6), paddingVertical: rf(6), marginTop: rf(4) }]}
                    onPress={() => { setScannedUser(null); setScanned(false); openCamera(false); }}>
                    <Ionicons name="refresh" size={rf(15)} color={COLORS.textGray} />
                    <Text style={{ color: COLORS.textGray, fontSize: rf(14), fontWeight: '500' }}>Scan another code</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : scanning ? (
              <CameraBlock
                rf={rf} W={W} QR_FRAME={QR_FRAME}
                scanLineY={scanLineY}
                onBarcodeScanned={handleContactScan}
                onCancel={() => setScanning(false)}
                label="Scan a VipChat contact QR code"
              />
            ) : (
              <StartScanBlock
                rf={rf}
                icon="scan-outline"
                title="Scan Contact QR"
                hint="Point your camera at another VipChat user's QR code to add them as a contact instantly."
                btnLabel="Open Camera"
                onStart={() => openCamera(false)}
              />
            )}
          </View>
        )}

        {/* ── WEB LOGIN ────────────────────────────────── */}
        {activeTab === 2 && (
          <View style={{ width: '100%' }}>
            {webLoginConfirmed ? (
              <View style={[s.centered, { paddingTop: rf(24), gap: rf(16) }]}>
                <View style={[s.centered, { width: rf(100), height: rf(100), borderRadius: rf(50),
                  backgroundColor: COLORS.accent + '15' }]}>
                  <Ionicons name="checkmark-circle" size={rf(56)} color={COLORS.accent} />
                </View>
                <Text style={{ fontSize: rf(22), fontWeight: '800', color: COLORS.dark, textAlign: 'center' }}>
                  Web Login Confirmed!
                </Text>
                <Text style={{ fontSize: rf(14.5), color: COLORS.textGray, textAlign: 'center', lineHeight: rf(22) }}>
                  Your computer is now logged into VipChat.{'\n'}Your phone is connected and the session is active.
                </Text>
                <TouchableOpacity style={[s.primaryBtn, { paddingHorizontal: rf(40) }]}
                  onPress={() => { setWebLoginConfirmed(false); setWebLoginScanned(false); }} activeOpacity={0.8}>
                  <Text style={s.primaryBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : webLoginScanning ? (
              <CameraBlock
                rf={rf} W={W} QR_FRAME={QR_FRAME}
                scanLineY={scanLineY}
                onBarcodeScanned={handleWebLoginScan}
                onCancel={() => setWebLoginScanning(false)}
                label="Scan the QR code shown on VipChat Web"
                badge
              />
            ) : (
              <View style={{ width: '100%', gap: rf(20) }}>
                {/* Header */}
                <View style={[s.centered, { gap: rf(10) }]}>
                  <View style={[s.centered, { width: rf(72), height: rf(72), borderRadius: rf(20),
                    backgroundColor: COLORS.accent + '15' }]}>
                    <Ionicons name="laptop-outline" size={rf(36)} color={COLORS.accent} />
                  </View>
                  <Text style={{ fontSize: rf(22), fontWeight: '800', color: COLORS.dark }}>Log into VipChat Web</Text>
                  <Text style={{ fontSize: rf(14), color: COLORS.textGray, textAlign: 'center', lineHeight: rf(21) }}>
                    Use VipChat on your computer without logging out of your phone.
                  </Text>
                </View>

                {webLoginError ? (
                  <View style={[s.row, { gap: rf(8), backgroundColor: COLORS.danger + '15',
                    borderRadius: rf(12), paddingHorizontal: rf(14), paddingVertical: rf(10) }]}>
                    <Ionicons name="alert-circle" size={rf(16)} color={COLORS.danger} />
                    <Text style={{ color: COLORS.danger, fontSize: rf(13.5), flex: 1, fontWeight: '500' }}>{webLoginError}</Text>
                  </View>
                ) : null}

                {/* Steps */}
                <View style={[s.stepsBox, { gap: rf(14) }]}>
                  {[
                    { icon: 'globe-outline', text: 'Open VipChat in your computer browser' },
                    { icon: 'qr-code-outline', text: 'Click "Scan QR" on the login or settings page' },
                    { icon: 'camera-outline', text: 'Tap the button below and scan the QR shown on screen' },
                  ].map((step, i) => (
                    <View key={i} style={[s.row, { gap: rf(10) }]}>
                      <View style={[s.centered, { width: rf(26), height: rf(26), borderRadius: rf(13),
                        backgroundColor: COLORS.primary, flexShrink: 0 }]}>
                        <Text style={{ color: '#fff', fontSize: rf(12), fontWeight: '800' }}>{i + 1}</Text>
                      </View>
                      <Ionicons name={step.icon} size={rf(20)} color={COLORS.primary} style={{ flexShrink: 0 }} />
                      <Text style={{ flex: 1, fontSize: rf(14), color: COLORS.dark, lineHeight: rf(20) }}>{step.text}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={[s.primaryBtn, { gap: rf(10) }]} onPress={() => openCamera(true)} activeOpacity={0.85}>
                  <Ionicons name="camera" size={rf(20)} color="#fff" />
                  <Text style={s.primaryBtnText}>Scan Web QR Code</Text>
                </TouchableOpacity>

                <Text style={{ fontSize: rf(12), color: COLORS.textGray, textAlign: 'center', lineHeight: rf(18) }}>
                  Keep your phone connected to the internet to maintain the web session.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function CameraBlock({ rf, W, QR_FRAME, scanLineY, onBarcodeScanned, onCancel, label, badge }) {
  return (
    <View style={{ width: '100%', alignItems: 'center', gap: rf(16) }}>
      <View style={{ width: '100%', height: W * 0.85, borderRadius: rf(20), overflow: 'hidden', position: 'relative', backgroundColor: '#000' }}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={onBarcodeScanned}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        />
        {/* Overlay */}
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          <View style={{ flexDirection: 'row', height: QR_FRAME }}>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
            <View style={{ width: QR_FRAME, position: 'relative' }}>
              {/* Corners */}
              {[
                { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
                { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
                { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
                { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
              ].map((corner, i) => (
                <View key={i} style={[{ position: 'absolute', width: rf(28), height: rf(28), borderColor: COLORS.accent }, corner]} />
              ))}
              {/* Scan line */}
              <Animated.View style={{
                position: 'absolute', left: 0, right: 0, height: 2,
                backgroundColor: COLORS.accent, opacity: 0.85,
                transform: [{ translateY: scanLineY }],
                shadowColor: COLORS.accent, shadowOpacity: 0.9, shadowRadius: 6,
              }} />
            </View>
            <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} />
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'flex-start', paddingTop: rf(12) }}>
            {badge ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: rf(6),
                backgroundColor: 'rgba(7,94,84,0.85)', borderRadius: rf(20), paddingHorizontal: rf(14), paddingVertical: rf(6) }}>
                <Ionicons name="laptop-outline" size={rf(16)} color="#fff" />
                <Text style={{ color: '#fff', fontSize: rf(13), fontWeight: '600' }}>Scan VipChat Web QR</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      <Text style={{ fontSize: rf(14), color: COLORS.textGray, textAlign: 'center' }}>{label}</Text>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', gap: rf(8), backgroundColor: COLORS.danger,
          borderRadius: rf(22), paddingHorizontal: rf(22), paddingVertical: rf(12),
          elevation: 4, shadowColor: COLORS.danger, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
        onPress={onCancel} activeOpacity={0.85}>
        <Ionicons name="stop-circle" size={rf(18)} color="#fff" />
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: rf(15) }}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

function StartScanBlock({ rf, icon, title, hint, btnLabel, onStart }) {
  return (
    <View style={{ width: '100%', alignItems: 'center', paddingTop: rf(16), gap: rf(18) }}>
      <View style={{ width: rf(130), height: rf(130), borderRadius: rf(24),
        backgroundColor: COLORS.accent + '12', alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: COLORS.accent + '30', gap: rf(8) }}>
        <Ionicons name={icon} size={rf(60)} color={COLORS.accent} />
        <Text style={{ fontSize: rf(12), color: COLORS.accent, fontWeight: '700' }}>{title}</Text>
      </View>
      <Text style={{ fontSize: rf(14.5), color: COLORS.textGray, textAlign: 'center', lineHeight: rf(22), paddingHorizontal: rf(8) }}>
        {hint}
      </Text>
      <TouchableOpacity
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: rf(10),
          backgroundColor: COLORS.accent, borderRadius: rf(14), paddingVertical: rf(15), width: '100%',
          elevation: 5, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } }}
        onPress={onStart} activeOpacity={0.85}>
        <Ionicons name="camera" size={rf(20)} color="#fff" />
        <Text style={{ color: '#fff', fontSize: rf(16), fontWeight: '800' }}>{btnLabel}</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    backgroundColor: '#fff',
  },
  tab: {
    flex: 1,
    paddingVertical: 13,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  scroll: { paddingTop: 24, alignItems: 'center' },
  centered: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },

  qrFrame: {
    position: 'relative',
    backgroundColor: '#fff', padding: 8,
    elevation: 8,
    shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
  },
  qrLogo: {
    position: 'absolute', top: '50%', left: '50%',
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },

  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    borderWidth: 1.5, borderRadius: 14, paddingVertical: 13,
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 24,
    elevation: 5, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
  },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  card: {
    backgroundColor: '#fff', borderRadius: 20, padding: 24,
    borderWidth: 1, borderColor: COLORS.border, alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },

  stepsBox: {
    backgroundColor: '#F8FFF8', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border,
  },
});
