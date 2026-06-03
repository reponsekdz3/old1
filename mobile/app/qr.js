import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, Share, ScrollView, Modal,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import Avatar from '../components/Avatar';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { COLORS } from '../config';

const TABS = ['My Code', 'Scan'];

export default function QRScreen() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(0);
  const [qrData, setQrData] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedUser, setScannedUser] = useState(null);
  const [addingSent, setAddingSent] = useState(false);
  const [addDone, setAddDone] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (activeTab === 0) generateQR();
  }, [activeTab]);

  const generateQR = async () => {
    setLoadingQR(true);
    try {
      const { data } = await api.post('/qr/generate');
      setQrData(data);
    } catch (e) {
      Alert.alert('Error', 'Failed to generate QR code');
    } finally {
      setLoadingQR(false);
    }
  };

  const handleBarCodeScanned = useCallback(async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setScanning(false);
    try {
      const res = await api.post('/qr/scan', { qr_data: data });
      setScannedUser(res.data.user);
      if (res.data.is_contact) {
        setAddDone(true);
      }
    } catch {
      Alert.alert('Invalid QR', 'This QR code is not a valid VipChat code.', [
        { text: 'Scan Again', onPress: () => { setScanned(false); setScanning(true); } },
      ]);
    }
  }, [scanned]);

  const startScanning = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { Alert.alert('Permission denied', 'Camera access is needed to scan QR codes'); return; }
    }
    setScanned(false);
    setScannedUser(null);
    setAddDone(false);
    setScanning(true);
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
      await Share.share({ message: `Scan to add ${user?.full_name} on VipChat! ${url}`, url });
    } catch {}
  };

  const qrImageUrl = qrData?.qr_code?.qr_image_url || qrData?.qr_image_url;
  const scanCount = qrData?.qr_code?.scan_count ?? qrData?.scan_count ?? 0;

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        {TABS.map((t, i) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, activeTab === i && styles.tabActive]}
            onPress={() => { setActiveTab(i); setScanning(false); setScannedUser(null); setScanned(false); }}
          >
            <Text style={[styles.tabText, activeTab === i && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 0 ? (
          <View style={styles.myCodeSection}>
            {loadingQR ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="large" color={COLORS.accent} />
                <Text style={styles.loadingText}>Generating your QR code...</Text>
              </View>
            ) : qrImageUrl ? (
              <>
                <View style={styles.qrFrame}>
                  <Image source={{ uri: qrImageUrl }} style={styles.qrImage} />
                  <View style={[styles.corner, styles.cornerTL]} />
                  <View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} />
                  <View style={[styles.corner, styles.cornerBR]} />
                  <View style={styles.qrLogo}>
                    <Ionicons name="chatbubbles" size={22} color={COLORS.accent} />
                  </View>
                </View>

                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{user?.full_name}</Text>
                  <Text style={styles.userPhone}>{user?.phone_number}</Text>
                  {user?.country ? <Text style={styles.userLocation}>{user.country}{user.city ? `, ${user.city}` : ''}</Text> : null}
                  <Text style={styles.scanCount}>Scanned {scanCount} time{scanCount !== 1 ? 's' : ''}</Text>
                </View>

                <View style={styles.actionsRow}>
                  <TouchableOpacity style={styles.actionBtn} onPress={shareQR}>
                    <Ionicons name="share-outline" size={20} color={COLORS.accent} />
                    <Text style={styles.actionBtnText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={generateQR}>
                    <Ionicons name="refresh" size={20} color={COLORS.textGray} />
                    <Text style={[styles.actionBtnText, { color: COLORS.textGray }]}>Refresh</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.loadingBox}>
                <Text style={{ color: COLORS.textGray, marginBottom: 16 }}>Could not generate QR code</Text>
                <TouchableOpacity style={styles.retryBtn} onPress={generateQR}>
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.scanSection}>
            {scannedUser ? (
              <View style={styles.scannedResult}>
                <Avatar uri={scannedUser.avatar_url} name={scannedUser.full_name} size={80} />
                <Text style={styles.scannedName}>{scannedUser.full_name}</Text>
                <Text style={styles.scannedPhone}>{scannedUser.phone_number}</Text>
                {addDone ? (
                  <View style={styles.sentRow}>
                    <Ionicons name="checkmark-circle" size={24} color={COLORS.accent} />
                    <Text style={styles.sentText}>Request sent / Already a contact</Text>
                  </View>
                ) : (
                  <View style={styles.scanActions}>
                    <TouchableOpacity style={styles.addBtn} onPress={sendContactRequest} disabled={addingSent}>
                      {addingSent ? <ActivityIndicator color="#fff" /> : (
                        <><Ionicons name="person-add" size={18} color="#fff" /><Text style={styles.addBtnText}>Add Contact</Text></>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.scanAgainBtn} onPress={() => { setScannedUser(null); setScanned(false); startScanning(); }}>
                      <Ionicons name="refresh" size={18} color={COLORS.textGray} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : scanning ? (
              <View style={styles.cameraBox}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  onBarcodeScanned={handleBarCodeScanned}
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                />
                <View style={styles.scanOverlay}>
                  <View style={styles.scanFrame}>
                    <View style={[styles.scanCorner, styles.scanCornerTL]} />
                    <View style={[styles.scanCorner, styles.scanCornerTR]} />
                    <View style={[styles.scanCorner, styles.scanCornerBL]} />
                    <View style={[styles.scanCorner, styles.scanCornerBR]} />
                  </View>
                </View>
                <TouchableOpacity style={styles.stopScanBtn} onPress={() => setScanning(false)}>
                  <Ionicons name="stop-circle" size={18} color="#fff" />
                  <Text style={styles.stopScanText}>Stop Scanning</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.startScan}>
                <View style={styles.scanPlaceholder}>
                  <Ionicons name="camera-outline" size={48} color={COLORS.gray} />
                  <Text style={styles.scanPlaceholderText}>Point at a VipChat QR code</Text>
                </View>
                <Text style={styles.scanHint}>Scan any VipChat QR code to instantly add that person as a contact</Text>
                <TouchableOpacity style={styles.startScanBtn} onPress={startScanning}>
                  <Ionicons name="camera" size={20} color="#fff" />
                  <Text style={styles.startScanBtnText}>Start Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  tabRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.accent },
  tabText: { fontSize: 15, fontWeight: '600', color: COLORS.gray },
  tabTextActive: { color: COLORS.accent },
  content: { padding: 24, alignItems: 'center' },
  myCodeSection: { width: '100%', alignItems: 'center' },
  loadingBox: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadingText: { color: COLORS.textGray, fontSize: 14 },
  qrFrame: {
    width: 220, height: 220, position: 'relative',
    backgroundColor: '#fff', padding: 8, borderRadius: 12,
    elevation: 4, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
    marginBottom: 20,
  },
  qrImage: { width: '100%', height: '100%', borderRadius: 8 },
  corner: { position: 'absolute', width: 20, height: 20, borderColor: COLORS.accent, borderRadius: 2 },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  qrLogo: {
    position: 'absolute', top: '50%', left: '50%',
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    transform: [{ translateX: -18 }, { translateY: -18 }],
    elevation: 2,
  },
  userInfo: { alignItems: 'center', gap: 3, marginBottom: 24 },
  userName: { fontSize: 18, fontWeight: '700', color: COLORS.dark },
  userPhone: { fontSize: 14, color: COLORS.textGray },
  userLocation: { fontSize: 12, color: COLORS.gray },
  scanCount: { fontSize: 12, color: COLORS.accent, fontWeight: '600', marginTop: 4 },
  actionsRow: { flexDirection: 'row', gap: 12 },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, paddingVertical: 12,
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: COLORS.accent },
  retryBtn: { backgroundColor: COLORS.accent, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  retryBtnText: { color: '#fff', fontWeight: '700' },
  scanSection: { width: '100%' },
  scannedResult: { alignItems: 'center', gap: 12, paddingVertical: 20 },
  scannedName: { fontSize: 22, fontWeight: '700', color: COLORS.dark },
  scannedPhone: { fontSize: 15, color: COLORS.textGray },
  sentRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sentText: { fontSize: 15, color: COLORS.accent, fontWeight: '600' },
  scanActions: { flexDirection: 'row', gap: 10, marginTop: 8, width: '100%' },
  addBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingVertical: 14,
  },
  addBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  scanAgainBtn: {
    width: 50, height: 50, borderRadius: 14, borderWidth: 1.5, borderColor: COLORS.border,
    alignItems: 'center', justifyContent: 'center',
  },
  cameraBox: { width: '100%', aspectRatio: 1, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  scanOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 220, height: 220, position: 'relative' },
  scanCorner: { position: 'absolute', width: 28, height: 28, borderColor: COLORS.accent },
  scanCornerTL: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  scanCornerTR: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  scanCornerBL: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  scanCornerBR: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  stopScanBtn: {
    position: 'absolute', bottom: 16, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.danger, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  stopScanText: { color: '#fff', fontWeight: '600' },
  startScan: { alignItems: 'center', paddingVertical: 32, gap: 16 },
  scanPlaceholder: {
    width: 160, height: 160, borderRadius: 16, borderWidth: 2, borderColor: COLORS.border,
    borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: COLORS.lightGray,
  },
  scanPlaceholderText: { fontSize: 12, color: COLORS.gray, textAlign: 'center', paddingHorizontal: 16 },
  scanHint: { fontSize: 14, color: COLORS.textGray, textAlign: 'center', maxWidth: 260, lineHeight: 20 },
  startScanBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: COLORS.accent, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14,
    elevation: 3, shadowColor: COLORS.accent, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
  startScanBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
