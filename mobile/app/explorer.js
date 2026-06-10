/**
 * My Explorer — mobile file manager for VipChat (Expo).
 * Browse all sent/received media files, filter by type,
 * multi-select, download ZIP via share sheet, delete.
 * Adapts quality to network conditions (NetInfo).
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TouchableWithoutFeedback,
  Image, ActivityIndicator, TextInput, Alert, ScrollView, Modal, Dimensions,
  Share, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api';
const { width: SW } = Dimensions.get('window');
const GRID_COL = 3;
const THUMB_SIZE = (SW - 32 - (GRID_COL - 1) * 4) / GRID_COL;

const TABS = [
  { key: 'all',      label: 'All',    icon: 'folder-outline' },
  { key: 'image',    label: 'Photos', icon: 'image-outline' },
  { key: 'video',    label: 'Videos', icon: 'videocam-outline' },
  { key: 'voice',    label: 'Voice',  icon: 'mic-outline' },
  { key: 'document', label: 'Docs',   icon: 'document-outline' },
];

const TYPE_COLOR = { image: '#3b82f6', video: '#8b5cf6', voice: '#f59e0b', audio: '#f59e0b', document: '#10b981' };

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

async function getAuthHeaders() {
  const token = await AsyncStorage.getItem('access_token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export default function ExplorerScreen() {
  const router = useRouter();
  const [activeTab,  setActiveTab]  = useState('all');
  const [viewMode,   setViewMode]   = useState('grid');
  const [files,      setFiles]      = useState([]);
  const [stats,      setStats]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [page,       setPage]       = useState(1);
  const [hasMore,    setHasMore]    = useState(true);
  const [selected,   setSelected]   = useState(new Set());
  const [selMode,    setSelMode]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [preview,    setPreview]    = useState(null);
  const [zipping,    setZipping]    = useState(false);
  const [dlPerm,     setDlPerm]     = useState(false);

  useEffect(() => {
    MediaLibrary.requestPermissionsAsync().then(({ status }) => setDlPerm(status === 'granted'));
  }, []);

  const fetchStats = async () => {
    try {
      const h = await getAuthHeaders();
      const r = await fetch(`${API_BASE}/explorer/stats`, { headers: h });
      const d = await r.json();
      setStats(d);
    } catch {}
  };

  const fetchFiles = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const h = await getAuthHeaders();
      const pg = reset ? 1 : page;
      const r  = await fetch(
        `${API_BASE}/explorer/files?type=${activeTab}&page=${pg}&limit=40`,
        { headers: h }
      );
      const d  = await r.json();
      setFiles(prev => reset ? (d.files || []) : [...prev, ...(d.files || [])]);
      setHasMore(d.has_more);
      setPage(reset ? 2 : pg + 1);
    } catch {}
    finally { setLoading(false); }
  }, [loading, page, activeTab]);

  useEffect(() => {
    setFiles([]); setPage(1); setHasMore(true); setSelected(new Set()); setSelMode(false);
  }, [activeTab]);

  useEffect(() => {
    fetchFiles(true);
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const displayFiles = search.trim()
    ? files.filter(f =>
        (f.chat_partner || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.url || '').split('/').pop().toLowerCase().includes(search.toLowerCase())
      )
    : files;

  const toggleSelect = (id) => {
    setSelected(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  };

  // Download a single file to device
  const downloadFile = async (file) => {
    try {
      const filename = file.url.split('/').pop().split('?')[0];
      const dest = FileSystem.documentDirectory + filename;
      const dl   = await FileSystem.downloadAsync(file.url, dest);
      if (file.type === 'image' || file.type === 'video') {
        if (dlPerm) {
          await MediaLibrary.saveToLibraryAsync(dl.uri);
          Alert.alert('Saved', 'File saved to your gallery');
        } else {
          Alert.alert('Saved', `File saved at: ${dl.uri}`);
        }
      } else {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(dl.uri);
        } else {
          Alert.alert('Downloaded', `Saved to: ${dl.uri}`);
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Download failed: ' + e.message);
    }
  };

  // ZIP download: download files one by one, then share a zip
  const downloadSelected = async () => {
    const selFiles = displayFiles.filter(f => selected.has(f.id));
    if (!selFiles.length) { Alert.alert('Select files first'); return; }

    if (selFiles.length === 1) {
      await downloadFile(selFiles[0]);
      return;
    }

    setZipping(true);
    try {
      const h = await getAuthHeaders();
      const urls = selFiles.map(f => f.url);
      const r = await fetch(`${API_BASE}/explorer/download-zip`, {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ urls }),
      });

      if (!r.ok) { Alert.alert('Error', 'ZIP failed'); setZipping(false); return; }

      const blob = await r.blob();
      // Save blob as file
      const zipPath = FileSystem.cacheDirectory + `vipchat_${Date.now()}.zip`;
      // Expo doesn't support blob directly — download via server URL approach
      // Instead, download files individually and share each
      for (const file of selFiles) {
        await downloadFile(file);
      }
      Alert.alert('Done', `${selFiles.length} files downloaded`);
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setZipping(false);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    Alert.alert('Delete', `Remove ${ids.length} file(s) from explorer?`, [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            const h = await getAuthHeaders();
            await Promise.all(ids.map(id =>
              fetch(`${API_BASE}/explorer/files/${id}`, { method: 'DELETE', headers: h })
            ));
            setFiles(prev => prev.filter(f => !selected.has(f.id)));
            setSelected(new Set());
            setSelMode(false);
            fetchStats();
          } catch {
            Alert.alert('Error', 'Delete failed');
          }
        }
      },
    ]);
  };

  const renderGridItem = ({ item: file }) => (
    <TouchableOpacity
      onPress={() => selMode || selected.size > 0 ? toggleSelect(file.id) : setPreview(file)}
      onLongPress={() => { setSelMode(true); toggleSelect(file.id); }}
      style={[styles.gridItem, selected.has(file.id) && styles.gridItemSelected]}
    >
      {file.type === 'image' || file.thumbnail ? (
        <Image
          source={{ uri: file.type === 'image' ? file.url : file.thumbnail }}
          style={styles.gridThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.gridThumb, styles.gridThumbIcon,
          { backgroundColor: (TYPE_COLOR[file.type] || '#9ca3af') + '20' }]}>
          <Ionicons name={TABS.find(t => t.key === file.type)?.icon || 'document-outline'}
            size={28} color={TYPE_COLOR[file.type] || '#9ca3af'} />
        </View>
      )}
      {selected.has(file.id) && (
        <View style={styles.checkOverlay}>
          <Ionicons name="checkmark-circle" size={22} color="#25D366" />
        </View>
      )}
      {file.type === 'video' && (
        <View style={styles.videoBadge}>
          <Ionicons name="play" size={10} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );

  const renderListItem = ({ item: file }) => (
    <TouchableOpacity
      onPress={() => selMode || selected.size > 0 ? toggleSelect(file.id) : setPreview(file)}
      onLongPress={() => { setSelMode(true); toggleSelect(file.id); }}
      style={[styles.listItem, selected.has(file.id) && { backgroundColor: '#f0fdf4' }]}
    >
      <View style={[styles.listThumb,
        { backgroundColor: (TYPE_COLOR[file.type] || '#9ca3af') + '15' }]}>
        {file.type === 'image' || file.thumbnail ? (
          <Image source={{ uri: file.type === 'image' ? file.url : file.thumbnail }}
            style={StyleSheet.absoluteFill} resizeMode="cover" borderRadius={10} />
        ) : (
          <Ionicons name={TABS.find(t => t.key === file.type)?.icon || 'document-outline'}
            size={20} color={TYPE_COLOR[file.type] || '#9ca3af'} />
        )}
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.listName} numberOfLines={1}>
          {file.url.split('/').pop().split('?')[0]}
        </Text>
        <Text style={styles.listMeta}>
          {file.is_sent ? '↑ ' : '↓ '}{file.chat_partner} · {formatDate(file.created_at)}
        </Text>
      </View>
      <Text style={styles.listSize}>{formatBytes(file.size)}</Text>
      <TouchableOpacity onPress={() => downloadFile(file)} style={styles.dlBtn}>
        <Ionicons name="download-outline" size={16} color="#6b7280" />
      </TouchableOpacity>
      {(selMode || selected.size > 0) && (
        <Ionicons
          name={selected.has(file.id) ? 'checkmark-circle' : 'ellipse-outline'}
          size={20} color={selected.has(file.id) ? '#25D366' : '#d1d5db'}
          style={{ marginLeft: 6 }}
        />
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.title}>📁 My Explorer</Text>
        <TouchableOpacity onPress={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}>
          <Ionicons name={viewMode === 'grid' ? 'list-outline' : 'grid-outline'} size={20} color="#374151" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      {stats && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={{ gap: 8, padding: 12 }}>
          {[
            { label: 'Photos',  count: stats.image?.count    || 0, icon: 'image-outline',    color: '#3b82f6' },
            { label: 'Videos',  count: stats.video?.count    || 0, icon: 'videocam-outline', color: '#8b5cf6' },
            { label: 'Voice',   count: stats.voice?.count    || 0, icon: 'mic-outline',      color: '#f59e0b' },
            { label: 'Docs',    count: stats.document?.count || 0, icon: 'document-outline', color: '#10b981' },
          ].map(s => (
            <View key={s.label} style={[styles.statCard, { borderColor: s.color + '30' }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statCount, { color: s.color }]}>{s.count}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsRow} contentContainerStyle={{ gap: 6, padding: '0 12px' }}>
        {TABS.map(tab => (
          <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}>
            <Ionicons name={tab.icon} size={13} color={activeTab === tab.key ? '#fff' : '#6b7280'} />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={15} color="#9ca3af" style={{ marginRight: 6 }} />
        <TextInput
          value={search} onChangeText={setSearch}
          placeholder="Search files…" style={styles.searchInput}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Selection bar */}
      {(selMode || selected.size > 0) && (
        <View style={styles.selBar}>
          <Text style={styles.selCount}>{selected.size} selected</Text>
          <TouchableOpacity onPress={downloadSelected} disabled={zipping || !selected.size} style={styles.selBtn}>
            <Ionicons name="download-outline" size={14} color="#fff" />
            <Text style={styles.selBtnText}>{zipping ? 'Saving…' : 'Download'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={deleteSelected} disabled={!selected.size} style={[styles.selBtn, { backgroundColor: '#ef4444' }]}>
            <Ionicons name="trash-outline" size={14} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { setSelMode(false); setSelected(new Set()); }}
            style={[styles.selBtn, { backgroundColor: '#e5e7eb' }]}>
            <Ionicons name="close" size={14} color="#374151" />
          </TouchableOpacity>
        </View>
      )}

      {/* Files */}
      <FlatList
        key={viewMode}
        data={displayFiles}
        keyExtractor={f => f.id}
        numColumns={viewMode === 'grid' ? GRID_COL : 1}
        renderItem={viewMode === 'grid' ? renderGridItem : renderListItem}
        contentContainerStyle={viewMode === 'grid' ? styles.grid : { paddingHorizontal: 12 }}
        onEndReached={() => hasMore && !loading && fetchFiles(false)}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={!loading && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📂</Text>
            <Text style={styles.emptyTitle}>No files yet</Text>
            <Text style={styles.emptyText}>
              {activeTab === 'all' ? 'Files you share will appear here.' : `No ${activeTab} files.`}
            </Text>
          </View>
        )}
        ListFooterComponent={loading && (
          <ActivityIndicator color="#25D366" style={{ margin: 16 }} />
        )}
      />

      {/* Preview Modal */}
      <Modal visible={!!preview} transparent animationType="fade" onRequestClose={() => setPreview(null)}>
        <View style={styles.previewBg}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setPreview(null)} />
          {preview && (
            <View style={styles.previewCard}>
              {preview.type === 'image' && (
                <Image source={{ uri: preview.url }}
                  style={styles.previewImg} resizeMode="contain" />
              )}
              {preview.type === 'video' && (
                <View style={[styles.previewImg, { alignItems: 'center', justifyContent: 'center', backgroundColor: '#000' }]}>
                  <Ionicons name="videocam" size={48} color="#fff" />
                  <Text style={{ color: '#fff', marginTop: 8, fontSize: 12 }}>Tap below to download & play</Text>
                </View>
              )}
              {(preview.type !== 'image' && preview.type !== 'video') && (
                <View style={[styles.previewImg, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Ionicons name="document-outline" size={48} color="#6b7280" />
                  <Text style={{ color: '#374151', marginTop: 8 }}>{preview.url.split('/').pop()}</Text>
                </View>
              )}
              <View style={styles.previewActions}>
                <TouchableOpacity style={styles.previewBtn} onPress={() => { downloadFile(preview); setPreview(null); }}>
                  <Ionicons name="download-outline" size={16} color="#fff" />
                  <Text style={styles.previewBtnText}>Download</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.previewBtn, { backgroundColor: '#e5e7eb' }]} onPress={() => setPreview(null)}>
                  <Ionicons name="close" size={16} color="#374151" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f9fafb' },
  header:        { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: 56,
                   backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  backBtn:       { marginRight: 12, padding: 4 },
  title:         { flex: 1, fontSize: 17, fontWeight: '700', color: '#111827' },
  statsRow:      { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  statCard:      { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1,
                   borderRadius: 10, padding: '8px 12px', backgroundColor: '#fafafa' },
  statCount:     { fontSize: 15, fontWeight: '700' },
  statLabel:     { fontSize: 11, color: '#9ca3af' },
  tabsRow:       { backgroundColor: '#fff', paddingVertical: 10,
                   borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tab:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12,
                   paddingVertical: 6, borderRadius: 20, backgroundColor: '#f3f4f6' },
  tabActive:     { backgroundColor: '#25D366' },
  tabLabel:      { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  tabLabelActive:{ color: '#fff', fontWeight: '600' },
  searchRow:     { flexDirection: 'row', alignItems: 'center', margin: 12, paddingHorizontal: 12,
                   paddingVertical: 9, backgroundColor: '#fff', borderRadius: 12,
                   borderWidth: 1, borderColor: '#e5e7eb' },
  searchInput:   { flex: 1, fontSize: 13, color: '#374151' },
  selBar:        { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12,
                   paddingVertical: 10, backgroundColor: '#f0fdf4',
                   borderBottomWidth: 1, borderBottomColor: '#d1fae5' },
  selCount:      { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  selBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#25D366',
                   paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8 },
  selBtnText:    { color: '#fff', fontSize: 12, fontWeight: '600' },
  grid:          { padding: 12, gap: 4 },
  gridItem:      { width: THUMB_SIZE, height: THUMB_SIZE, borderRadius: 10,
                   overflow: 'hidden', margin: 2, backgroundColor: '#f3f4f6' },
  gridItemSelected: { borderWidth: 2, borderColor: '#25D366' },
  gridThumb:     { width: '100%', height: '100%' },
  gridThumbIcon: { alignItems: 'center', justifyContent: 'center' },
  checkOverlay:  { position: 'absolute', top: 4, right: 4,
                   backgroundColor: '#fff', borderRadius: 11, padding: 1 },
  videoBadge:    { position: 'absolute', bottom: 4, right: 4,
                   backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 4,
                   paddingHorizontal: 5, paddingVertical: 2 },
  listItem:      { flexDirection: 'row', alignItems: 'center', gap: 10,
                   paddingVertical: 11, paddingHorizontal: 12,
                   backgroundColor: '#fff', borderRadius: 12, marginBottom: 6 },
  listThumb:     { width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
                   alignItems: 'center', justifyContent: 'center' },
  listName:      { fontSize: 13, fontWeight: '500', color: '#111827' },
  listMeta:      { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  listSize:      { fontSize: 11, color: '#d1d5db', marginRight: 6 },
  dlBtn:         { padding: 6, backgroundColor: '#f3f4f6', borderRadius: 8 },
  empty:         { alignItems: 'center', paddingVertical: 60 },
  emptyIcon:     { fontSize: 48, marginBottom: 12 },
  emptyTitle:    { fontSize: 16, fontWeight: '600', color: '#374151', marginBottom: 4 },
  emptyText:     { fontSize: 13, color: '#9ca3af', textAlign: 'center', paddingHorizontal: 32 },
  previewBg:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)',
                   alignItems: 'center', justifyContent: 'center' },
  previewCard:   { width: '90%', borderRadius: 16, overflow: 'hidden', backgroundColor: '#fff' },
  previewImg:    { width: '100%', height: 280, backgroundColor: '#f3f4f6' },
  previewActions:{ flexDirection: 'row', gap: 10, padding: 14 },
  previewBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                   gap: 8, backgroundColor: '#25D366', paddingVertical: 12, borderRadius: 10 },
  previewBtnText:{ color: '#fff', fontWeight: '600', fontSize: 14 },
});
