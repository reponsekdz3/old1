import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  TextInput, ActivityIndicator, RefreshControl, Image,
  Dimensions, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import api from '../../services/api';
import { useAuthStore } from '../../services/store';
import { COLORS } from '../../config';

const { width: SW } = Dimensions.get('window');
const CARD_W = (SW - 48) / 2;
const ACCENT = '#25D366';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: 'grid-outline' },
  { id: 'music', label: 'Music', icon: 'musical-notes-outline' },
  { id: 'sports', label: 'Sports', icon: 'football-outline' },
  { id: 'gaming', label: 'Gaming', icon: 'game-controller-outline' },
  { id: 'news', label: 'News', icon: 'newspaper-outline' },
  { id: 'comedy', label: 'Comedy', icon: 'happy-outline' },
  { id: 'education', label: 'Learn', icon: 'book-outline' },
  { id: 'tech', label: 'Tech', icon: 'hardware-chip-outline' },
];

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
  }, [category, sort, searchQuery]));

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
        <VideoCard video={item} onPress={() => {}} />
        {next && <VideoCard video={next} onPress={() => {}} />}
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

      {/* Categories */}
      <FlatList
        horizontal
        data={CATEGORIES}
        keyExtractor={i => i.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catList}
        renderItem={({ item }) => {
          const isActive = category === item.id;
          return (
            <TouchableOpacity
              onPress={() => { setCategory(item.id); setSearchQuery(''); setSearch(''); }}
              style={[styles.catBtn, isActive && styles.catBtnActive]}
            >
              <Ionicons name={item.icon} size={14} color={isActive ? '#fff' : '#666'} />
              <Text style={[styles.catLabel, isActive && { color: '#fff' }]}>{item.label}</Text>
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
