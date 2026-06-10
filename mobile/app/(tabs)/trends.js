import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, RefreshControl, Image,
  Dimensions, Platform, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import api from '../../services/api';
import { useAuthStore } from '../../services/store';
import { COLORS } from '../../config';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 48) / 2;
const ACCENT = '#25D366';

// Icon metadata per category ID — UI-only lookup, not mock data
const CATEGORY_META = {
  all:       { label: 'All',     icon: 'grid-outline' },
  music:     { label: 'Music',   icon: 'musical-notes-outline' },
  sports:    { label: 'Sports',  icon: 'football-outline' },
  gaming:    { label: 'Gaming',  icon: 'game-controller-outline' },
  news:      { label: 'News',    icon: 'newspaper-outline' },
  comedy:    { label: 'Comedy',  icon: 'happy-outline' },
  education: { label: 'Learn',   icon: 'book-outline' },
  tech:      { label: 'Tech',    icon: 'hardware-chip-outline' },
};

function VideoCard({ video, onPress }) {
  const duration = video.duration_sec || 30;
  const mins = Math.floor(duration / 60);
  const secs = String(duration % 60).padStart(2, '0');
  return (
    <TouchableOpacity style={[styles.card, { width: CARD_W }]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.thumbnail}>
        {video.thumbnail_url ? (
          <Image source={{ uri: video.thumbnail_url }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="play-circle" size={36} color="rgba(255,255,255,0.4)" />
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>{mins}:{secs}</Text>
        </View>
        {video.is_ad && (
          <View style={styles.adBadge}>
            <Text style={styles.adText}>AD</Text>
          </View>
        )}
        <View style={styles.playOverlay}>
          <Ionicons name="play" size={28} color="#fff" />
        </View>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{video.title}</Text>
        <View style={styles.cardMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="play-outline" size={11} color="#888" />
            <Text style={styles.metaText}>{(video.views || 0).toLocaleString()}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="heart-outline" size={11} color="#888" />
            <Text style={styles.metaText}>{(video.likes || 0).toLocaleString()}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TrendsScreen() {
  const { user } = useAuthStore();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('trending');
  const [search, setSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [trendingHashtags, setTrendingHashtags] = useState([]);
  const [topCreators, setTopCreators] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [uploadVisible, setUploadVisible] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('general');
  const [uploadTags, setUploadTags] = useState('');
  const [uploading, setUploading] = useState(false);

  const fetchVideos = useCallback(async (cat = category, s = sort, p = 1, append = false) => {
    if (p === 1) setLoading(true);
    try {
      const params = new URLSearchParams({ category: cat, sort: s, page: p, limit: 20 });
      if (searchQuery) params.set('q', searchQuery);
      const res = await api.get(`/trends/feed?${params}`);
      const data = res.data;
      const newVideos = data.videos || [];
      setVideos(prev => append ? [...prev, ...newVideos] : newVideos);
      setHasMore(data.has_more || false);
      setPage(p);
    } catch (e) {
      console.error('Trends fetch error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [category, sort, searchQuery]);

  useFocusEffect(useCallback(() => {
    fetchVideos(category, sort, 1);
    api.get('/trends/stats').then(r => setStats(r.data)).catch(() => {});
    api.get('/trends/hashtags/trending?limit=8').then(r => setTrendingHashtags(r.data.hashtags || [])).catch(() => {});
    api.get('/trends/creators/top?limit=4').then(r => setTopCreators(r.data.creators || [])).catch(() => {});
    api.get('/trends/categories')
      .then(r => setCategories(r.data.categories || []))
      .catch(() => setCategories(Object.keys(CATEGORY_META)));
  }, [category, sort, searchQuery]));

  const handleUpload = async () => {
    if (!uploadTitle.trim()) { Alert.alert('Error', 'Please enter a title'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const asset = result.assets[0];
      const formData = new FormData();
      formData.append('file', { uri: asset.uri, type: 'video/mp4', name: 'upload.mp4' });
      const { data: uploadData } = await api.post('/upload/video', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await api.post('/trends/upload', {
        title: uploadTitle.trim(),
        video_url: uploadData.url,
        category: uploadCategory,
        tags: uploadTags.split(',').map(t => t.trim()).filter(Boolean),
      });
      Alert.alert('Uploaded!', 'Your video is pending admin review.');
      setUploadVisible(false);
      setUploadTitle('');
      setUploadTags('');
    } catch (e) {
      Alert.alert('Error', e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSearch = () => {
    setSearchQuery(search.trim());
  };

  const loadMore = () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    fetchVideos(category, sort, page + 1, true);
  };

  const renderItem = ({ item, index }) => {
    if (index % 2 !== 0) return null;
    const next = videos[index + 1];
    return (
      <View style={styles.row}>
        <VideoCard video={item} onPress={() => setSelectedVideo(item)} />
        {next && <VideoCard video={next} onPress={() => setSelectedVideo(next)} />}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color="#888" style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search trends..."
            placeholderTextColor="#aaa"
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(''); setSearchQuery(''); }}>
              <Ionicons name="close-circle" size={18} color="#aaa" style={{ marginRight: 12 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Categories — IDs from API, icons from CATEGORY_META lookup */}
      <FlatList
        horizontal
        data={categories.length ? categories : Object.keys(CATEGORY_META)}
        keyExtractor={id => id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catList}
        renderItem={({ item: id }) => {
          const meta = CATEGORY_META[id] || { label: id, icon: 'grid-outline' };
          const isActive = category === id;
          return (
            <TouchableOpacity
              onPress={() => { setCategory(id); setSearchQuery(''); setSearch(''); }}
              style={[styles.catBtn, isActive && styles.catBtnActive]}
            >
              <Ionicons name={meta.icon} size={14} color={isActive ? '#fff' : '#666'} />
              <Text style={[styles.catLabel, isActive && { color: '#fff' }]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        }}
        style={styles.catBar}
      />

      {/* Sort tabs */}
      <View style={styles.sortRow}>
        {[
          { id: 'trending', label: 'Trending', icon: 'trending-up-outline' },
          { id: 'latest', label: 'Latest', icon: 'time-outline' },
          { id: 'popular', label: 'Popular', icon: 'star-outline' },
        ].map(s => (
          <TouchableOpacity key={s.id} onPress={() => setSort(s.id)}
            style={[styles.sortBtn, sort === s.id && styles.sortBtnActive]}>
            <Ionicons name={s.icon} size={13} color={sort === s.id ? ACCENT : '#888'} />
            <Text style={[styles.sortLabel, sort === s.id && { color: ACCENT }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
        {stats && (
          <Text style={styles.statsText}>{(stats.total_videos || 0).toLocaleString()} videos</Text>
        )}
      </View>

      {/* Trending Hashtags strip */}
      {trendingHashtags.length > 0 && (
        <FlatList
          horizontal
          data={trendingHashtags}
          keyExtractor={h => h.tag}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.hashtagList}
          style={styles.hashtagBar}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => { setSearch(item.tag); setSearchQuery(item.tag); }}
              style={styles.hashtagChip}
            >
              <Text style={styles.hashtagText}>{item.tag}</Text>
              <Text style={styles.hashtagCount}>{item.counts}</Text>
            </TouchableOpacity>
          )}
        />
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={ACCENT} />
          <Text style={styles.loadingText}>Loading trends...</Text>
        </View>
      ) : videos.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="videocam-outline" size={52} color="#ccc" />
          <Text style={styles.emptyTitle}>No videos yet</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery ? `No results for "${searchQuery}"` : 'Be the first to upload!'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={videos}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchVideos(category, sort, 1); }}
              tintColor={ACCENT}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore
            ? <ActivityIndicator color={ACCENT} style={{ padding: 16 }} />
            : null
          }
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Upload FAB (logged-in only) */}
      {user && (
        <TouchableOpacity style={styles.fab} onPress={() => setUploadVisible(true)}>
          <Ionicons name="cloud-upload-outline" size={24} color="#fff" />
        </TouchableOpacity>
      )}

      {/* Non-user banner */}
      {!user && (
        <View style={styles.guestBanner}>
          <View>
            <Text style={styles.bannerTitle}>Join VipChat Free</Text>
            <Text style={styles.bannerSub}>Like, comment & share trends</Text>
          </View>
          <TouchableOpacity style={styles.bannerBtn}>
            <Text style={styles.bannerBtnText}>Sign Up →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Video Player Modal */}
      <Modal visible={!!selectedVideo} transparent animationType="fade" onRequestClose={() => setSelectedVideo(null)}>
        <View style={styles.playerOverlay}>
          <View style={styles.playerSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={2}>{selectedVideo?.title}</Text>
              <TouchableOpacity onPress={() => setSelectedVideo(null)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            {selectedVideo?.video_url ? (
              <View style={styles.playerBox}>
                <Ionicons name="play-circle" size={64} color="rgba(255,255,255,0.7)" />
                <Text style={styles.playerNote}>Tap to open in browser</Text>
                <TouchableOpacity
                  style={styles.uploadBtn}
                  onPress={() => {
                    const { Linking } = require('react-native');
                    Linking.openURL(selectedVideo.video_url);
                    api.post(`/trends/video/${selectedVideo.id}/view`).catch(() => {});
                  }}>
                  <Ionicons name="open-outline" size={16} color="#fff" />
                  <Text style={styles.uploadBtnText}>Watch Video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.playerBox}>
                <Text style={styles.playerNote}>No video URL available</Text>
              </View>
            )}
            <View style={styles.playerMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="play-outline" size={14} color="#888" />
                <Text style={styles.metaText}>{(selectedVideo?.views || 0).toLocaleString()} views</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="heart-outline" size={14} color="#888" />
                <Text style={styles.metaText}>{(selectedVideo?.likes || 0).toLocaleString()}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="chatbubble-outline" size={14} color="#888" />
                <Text style={styles.metaText}>{(selectedVideo?.comments_count || 0).toLocaleString()}</Text>
              </View>
            </View>
            {selectedVideo?.description ? (
              <Text style={styles.playerDesc} numberOfLines={3}>{selectedVideo.description}</Text>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal visible={uploadVisible} transparent animationType="slide" onRequestClose={() => setUploadVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload Video</Text>
              <TouchableOpacity onPress={() => setUploadVisible(false)}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 14, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
              <View>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.modalInput}
                  value={uploadTitle}
                  onChangeText={setUploadTitle}
                  placeholder="Give your video a title"
                  placeholderTextColor="#555"
                />
              </View>
              <View>
                <Text style={styles.inputLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {(categories.length ? categories : Object.keys(CATEGORY_META))
                    .filter(id => id !== 'all')
                    .map(id => {
                      const meta = CATEGORY_META[id] || { label: id };
                      return (
                        <TouchableOpacity key={id} onPress={() => setUploadCategory(id)}
                          style={[styles.catBtn, uploadCategory === id && styles.catBtnActive, { marginRight: 8 }]}>
                          <Text style={[styles.catLabel, uploadCategory === id && { color: '#fff' }]}>{meta.label}</Text>
                        </TouchableOpacity>
                      );
                    })
                  }
                </ScrollView>
              </View>
              <View>
                <Text style={styles.inputLabel}>Tags (comma-separated)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={uploadTags}
                  onChangeText={setUploadTags}
                  placeholder="music, trending, fun"
                  placeholderTextColor="#555"
                />
              </View>
              <TouchableOpacity style={[styles.uploadBtn, uploading && { opacity: 0.6 }]} onPress={handleUpload} disabled={uploading}>
                {uploading
                  ? <ActivityIndicator color="#fff" />
                  : <>
                      <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                      <Text style={styles.uploadBtnText}>Select & Upload Video</Text>
                    </>
                }
              </TouchableOpacity>
              <Text style={styles.uploadNote}>Your video will be pending admin review before going live.</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  searchContainer: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6, backgroundColor: '#0a0a0a' },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a' },
  searchInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 10, fontSize: 14, color: '#fff', fontWeight: '500' },
  catBar: { flexGrow: 0, backgroundColor: '#0a0a0a' },
  catList: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  catBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a' },
  catBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catLabel: { fontSize: 12, fontWeight: '700', color: '#888' },
  sortRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, backgroundColor: '#0a0a0a', gap: 12 },
  sortBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  sortBtnActive: {},
  sortLabel: { fontSize: 12, fontWeight: '700', color: '#888' },
  statsText: { marginLeft: 'auto', fontSize: 11, color: '#444', fontWeight: '600' },
  grid: { paddingHorizontal: 14, paddingBottom: 20 },
  row: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 12, overflow: 'hidden' },
  thumbnail: { width: '100%', aspectRatio: 9 / 16, position: 'relative' },
  thumbImg: { width: '100%', height: '100%' },
  thumbPlaceholder: { width: '100%', height: '100%', backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center' },
  playOverlay: { position: 'absolute', inset: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.2)' },
  durationBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.7)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  durationText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  adBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: '#f59e0b', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  adText: { color: '#000', fontSize: 9, fontWeight: '900' },
  cardInfo: { padding: 10 },
  cardTitle: { fontSize: 12, fontWeight: '700', color: '#fff', lineHeight: 16 },
  cardMeta: { flexDirection: 'row', gap: 10, marginTop: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 10, color: '#888', fontWeight: '600' },
  loadingText: { color: '#666', fontSize: 14, marginTop: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginTop: 8 },
  emptySubtitle: { fontSize: 13, color: '#666', textAlign: 'center' },
  // Hashtags
  hashtagBar: { flexGrow: 0, backgroundColor: '#0a0a0a' },
  hashtagList: { paddingHorizontal: 14, paddingBottom: 8, gap: 8 },
  hashtagChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2e2e2e', alignItems: 'center' },
  hashtagText: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  hashtagCount: { color: '#555', fontSize: 10, fontWeight: '600', marginTop: 1 },
  // Upload FAB
  fab: {
    position: 'absolute', right: 20, bottom: Platform.OS === 'ios' ? 30 : 20,
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: ACCENT, alignItems: 'center', justifyContent: 'center',
    shadowColor: ACCENT, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 8,
    elevation: 8,
  },
  // Upload Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#111', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  inputLabel: { color: '#888', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  modalInput: { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#2a2a2a', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, color: '#fff', fontSize: 14 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: ACCENT, paddingVertical: 14, borderRadius: 14, marginTop: 4 },
  uploadBtnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  uploadNote: { color: '#555', fontSize: 12, textAlign: 'center', lineHeight: 16 },
  // Video player modal
  playerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  playerSheet: { backgroundColor: '#111', borderRadius: 20, padding: 20, width: '100%', maxHeight: '80%' },
  playerBox: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, gap: 12 },
  playerNote: { color: '#888', fontSize: 13, textAlign: 'center' },
  playerMeta: { flexDirection: 'row', gap: 20, marginTop: 16, justifyContent: 'center' },
  playerDesc: { color: '#888', fontSize: 13, lineHeight: 20, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#2a2a2a' },
  // Guest banner
  guestBanner: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 28 : 14,
  },
  bannerTitle: { color: '#fff', fontWeight: '800', fontSize: 14 },
  bannerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 },
  bannerBtn: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  bannerBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
