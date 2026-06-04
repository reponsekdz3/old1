import React, { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, TextInput, ActivityIndicator, Alert, Image,
  SafeAreaView, Dimensions, Share, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import { useAuthStore, useStatusStore } from '../../services/store';
import api from '../../services/api';
import { COLORS } from '../../config';

const { width: SW } = Dimensions.get('window');
const rf = (n) => n * (SW / 390);

const BG_COLORS = ['#075E54','#128C7E','#25D366','#3B82F6','#8B5CF6','#EC4899','#F59E0B','#EF4444'];

function StatusViewer({ statusData, onClose }) {
  const [current, setCurrent] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  
  if (!statusData) return null;
  const statuses = statusData.statuses || [];
  const s = statuses[current];
  if (!s) return null;

  const handleView = async () => {
    try { await api.post(`/status/${s.id}/view`); } catch {}
  };

  React.useEffect(() => { handleView(); }, [current]);

  const downloadStatus = async () => {
    if (!s.media_url) {
      Alert.alert('No Media', 'This status has no media to download');
      return;
    }

    setDownloading(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Storage permission is needed to save media');
        setDownloading(false);
        return;
      }

      const fileUri = FileSystem.documentDirectory + `status_${s.id}_${Date.now()}.${s.media_type === 'video' ? 'mp4' : 'jpg'}`;
      const downloadResult = await FileSystem.downloadAsync(s.media_url, fileUri);
      
      if (downloadResult.status === 200) {
        const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
        await MediaLibrary.createAlbumAsync('VipChat Status', asset, false);
        Alert.alert('Success', 'Status saved to gallery in VipChat Status album');
      } else {
        throw new Error('Download failed');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to download status: ' + err.message);
    } finally {
      setDownloading(false);
      setShowMenu(false);
    }
  };

  const shareStatus = async () => {
    if (!s.media_url) {
      if (s.content) {
        Share.share({ message: s.content });
      }
      return;
    }

    setDownloading(true);
    try {
      const fileUri = FileSystem.cacheDirectory + `share_status_${s.id}.${s.media_type === 'video' ? 'mp4' : 'jpg'}`;
      const downloadResult = await FileSystem.downloadAsync(s.media_url, fileUri);
      
      if (downloadResult.status === 200) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: s.media_type === 'video' ? 'video/mp4' : 'image/jpeg',
            dialogTitle: 'Share Status',
          });
        } else {
          Alert.alert('Error', 'Sharing is not available on this device');
        }
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to share status: ' + err.message);
    } finally {
      setDownloading(false);
      setShowMenu(false);
    }
  };

  const forwardStatus = async () => {
    Alert.alert('Forward Status', 'This will forward the status to your contacts', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Forward', 
        onPress: async () => {
          try {
            await api.post('/status', {
              content: s.content || '',
              media_url: s.media_url || null,
              media_type: s.media_type || 'text',
              background_color: s.background_color || BG_COLORS[0],
            });
            Alert.alert('Success', 'Status forwarded to your status');
          } catch (err) {
            Alert.alert('Error', 'Failed to forward status');
          }
          setShowMenu(false);
        }
      },
    ]);
  };

  return (
    <Modal visible animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flex: 1, backgroundColor: s.background_color || '#075E54', padding: 20 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={sv.header}>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={sv.headerInfo}>
                <Avatar uri={statusData.owner_avatar} name={statusData.owner_name} size={36} />
                <View>
                  <Text style={sv.ownerName}>{statusData.owner_name}</Text>
                  <Text style={sv.statusTime}>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setShowMenu(true)} style={sv.menuBtn}>
                <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
  return (
    <Modal visible animationType="fade">
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <View style={{ flex: 1, backgroundColor: s.background_color || '#075E54', padding: 20 }}>
          <SafeAreaView style={{ flex: 1 }}>
            <View style={sv.header}>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
              <View style={sv.headerInfo}>
                <Avatar uri={statusData.owner_avatar} name={statusData.owner_name} size={36} />
                <View>
                  <Text style={sv.ownerName}>{statusData.owner_name}</Text>
                  <Text style={sv.statusTime}>{new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setShowMenu(true)} style={sv.menuBtn}>
                <Ionicons name="ellipsis-vertical" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={sv.progress}>
              {statuses.map((_, i) => (
                <View key={i} style={[sv.progressBar, { flex: 1 / statuses.length, opacity: i <= current ? 1 : 0.3 }]} />
              ))}
            </View>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {s.media_url && s.media_type === 'image' ? (
                <Image source={{ uri: s.media_url }} style={{ width: '100%', height: 400, borderRadius: 12 }} resizeMode="contain" />
              ) : (
                <Text style={sv.content}>{s.content}</Text>
              )}
            </View>
            <View style={sv.navRow}>
              <TouchableOpacity style={{ flex: 1 }} onPress={() => current > 0 && setCurrent(c => c - 1)} />
              <TouchableOpacity style={{ flex: 1 }} onPress={() => current < statuses.length - 1 ? setCurrent(c => c + 1) : onClose()} />
            </View>
          </SafeAreaView>
        </View>
        
        {/* Action Menu */}
        <Modal visible={showMenu} transparent animationType="slide">
          <TouchableOpacity style={sv.overlay} onPress={() => setShowMenu(false)}>
            <View style={sv.menuContainer}>
              <TouchableOpacity style={sv.menuItem} onPress={downloadStatus} disabled={downloading}>
                <Ionicons name="download" size={22} color={COLORS.primary} />
                <Text style={sv.menuText}>Save to Gallery</Text>
                {downloading && <ActivityIndicator size="small" color={COLORS.primary} />}
              </TouchableOpacity>
              
              <TouchableOpacity style={sv.menuItem} onPress={shareStatus} disabled={downloading}>
                <Ionicons name="share" size={22} color={COLORS.primary} />
                <Text style={sv.menuText}>Share</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={sv.menuItem} onPress={forwardStatus}>
                <Ionicons name="arrow-forward" size={22} color={COLORS.primary} />
                <Text style={sv.menuText}>Forward to My Status</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={[sv.menuItem, sv.cancelItem]} onPress={() => setShowMenu(false)}>
                <Text style={[sv.menuText, { color: COLORS.danger }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
}

export default function StatusTab() {
  const { user } = useAuthStore();
  const { statuses, myStatuses, setStatuses, setMyStatuses } = useStatusStore();
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [content, setContent] = useState('');
  const [selectedBg, setSelectedBg] = useState(BG_COLORS[0]);
  const [posting, setPosting] = useState(false);
  const [viewingStatus, setViewingStatus] = useState(null);

  const loadStatuses = useCallback(async () => {
    try {
      const { data } = await api.get('/status/all');
      setStatuses(data.statuses || []);
      setMyStatuses(data.my_statuses || []);
    } catch (e) {
      console.warn('Failed to load statuses:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadStatuses(); }, [loadStatuses]));

  const handlePost = async () => {
    if (!content.trim()) { Alert.alert('Error', 'Status text is required'); return; }
    setPosting(true);
    try {
      await api.post('/status', { content: content.trim(), background_color: selectedBg, media_type: 'text' });
      loadStatuses();
      setCreateModal(false);
      setContent('');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to post status');
    } finally {
      setPosting(false);
    }
  };

  const myStatusPreview = myStatuses.length > 0 ? myStatuses[0] : null;

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>
      ) : (
        <FlatList
          data={statuses}
          keyExtractor={item => item.user_id}
          ListHeaderComponent={
            <View>
              <TouchableOpacity style={styles.myStatusRow} onPress={() => setCreateModal(true)}>
                <View style={styles.addAvatarWrap}>
                  {myStatusPreview ? (
                    <View style={[styles.statusRing, { borderColor: COLORS.accent }]}>
                      <Avatar uri={user?.avatar_url} name={user?.full_name} size={48} />
                    </View>
                  ) : (
                    <Avatar uri={user?.avatar_url} name={user?.full_name} size={50} />
                  )}
                  <View style={styles.addDot}>
                    <Ionicons name="add" size={14} color="#fff" />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.myStatusName}>My Status</Text>
                  <Text style={styles.myStatusSub}>
                    {myStatuses.length > 0 ? `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''}` : 'Tap to add status'}
                  </Text>
                </View>
              </TouchableOpacity>
              {statuses.length > 0 && (
                <Text style={styles.sectionLabel}>Recent updates</Text>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.statusRow} onPress={() => setViewingStatus(item)}>
              <View style={[styles.statusRing, { borderColor: item.viewed ? COLORS.gray : COLORS.accent }]}>
                <Avatar uri={item.owner_avatar} name={item.owner_name} size={48} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.statusName}>{item.owner_name}</Text>
                <Text style={styles.statusTime}>{new Date(item.latest_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState icon="🔵" title="No recent updates" subtitle="Status updates from your contacts will appear here" />
          }
          contentContainerStyle={statuses.length === 0 ? { flex: 1 } : undefined}
        />
      )}

      {viewingStatus && (
        <StatusViewer statusData={viewingStatus} onClose={() => setViewingStatus(null)} />
      )}

      <Modal visible={createModal} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={styles.createModal}>
          <View style={styles.createHeader}>
            <TouchableOpacity onPress={() => setCreateModal(false)}>
              <Ionicons name="close" size={24} color={COLORS.dark} />
            </TouchableOpacity>
            <Text style={styles.createTitle}>New Status</Text>
            <TouchableOpacity onPress={handlePost} disabled={posting}>
              {posting ? <ActivityIndicator size="small" color={COLORS.accent} /> : (
                <Text style={{ color: COLORS.accent, fontWeight: '700', fontSize: 16 }}>Post</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={[styles.previewBox, { backgroundColor: selectedBg }]}>
            <TextInput
              style={styles.statusInput}
              value={content}
              onChangeText={setContent}
              placeholder="What's on your mind?"
              placeholderTextColor="rgba(255,255,255,0.6)"
              multiline
              maxLength={700}
              autoFocus
            />
          </View>
          <View style={styles.bgRow}>
            {BG_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.bgDot, { backgroundColor: c }, selectedBg === c && styles.bgDotSelected]}
                onPress={() => setSelectedBg(c)}
              />
            ))}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const sv = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 10 },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ownerName: { color: '#fff', fontWeight: '700', fontSize: 15 },
  statusTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  menuBtn: { padding: 4 },
  progress: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  progressBar: { height: 3, backgroundColor: '#fff', borderRadius: 2 },
  content: { color: '#fff', fontSize: 22, fontWeight: '600', textAlign: 'center', lineHeight: 32 },
  navRow: { position: 'absolute', top: 80, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  menuContainer: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 15, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  menuText: { fontSize: 16, fontWeight: '600', color: COLORS.dark, flex: 1 },
  cancelItem: { borderBottomWidth: 0, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  myStatusRow: { flexDirection: 'row', alignItems: 'center', gap: rf(12), paddingHorizontal: rf(16), paddingVertical: rf(13), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  addAvatarWrap: { position: 'relative' },
  statusRing: { width: rf(56), height: rf(56), borderRadius: rf(28), borderWidth: 2.5, padding: 2, alignItems: 'center', justifyContent: 'center' },
  addDot: {
    position: 'absolute', bottom: -2, right: -2,
    width: rf(20), height: rf(20), borderRadius: rf(10), backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
  },
  myStatusName: { fontSize: rf(15.5), fontWeight: '600', color: COLORS.dark },
  myStatusSub: { fontSize: rf(13), color: COLORS.textGray, marginTop: rf(2) },
  sectionLabel: { fontSize: rf(12), fontWeight: '700', color: COLORS.textGray, paddingHorizontal: rf(16), paddingVertical: rf(9), backgroundColor: COLORS.lightGray, textTransform: 'uppercase', letterSpacing: 0.5 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: rf(12), paddingHorizontal: rf(16), paddingVertical: rf(13), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  statusName: { fontSize: rf(15.5), fontWeight: '600', color: COLORS.dark },
  statusTime: { fontSize: rf(13), color: COLORS.textGray, marginTop: rf(2) },
  createModal: { flex: 1, backgroundColor: '#fff' },
  createHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: rf(18), paddingVertical: rf(16), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.border },
  createTitle: { fontSize: rf(19), fontWeight: '800', color: COLORS.dark },
  previewBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: rf(32) },
  statusInput: { color: '#fff', fontSize: rf(22), fontWeight: '600', textAlign: 'center', lineHeight: rf(32), width: '100%' },
  bgRow: { flexDirection: 'row', justifyContent: 'center', gap: rf(12), padding: rf(20) },
  bgDot: { width: rf(34), height: rf(34), borderRadius: rf(17) },
  bgDotSelected: { borderWidth: 3, borderColor: '#fff', transform: [{ scale: 1.2 }] },
});
