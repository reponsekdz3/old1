/**
 * Mobile Calls Screen - Phone-like Call History
 * Features: Grouped calls, filters, quick actions, responsive design
 * Security: Secure call initiation, validated inputs
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  Image, StyleSheet, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';
import { useFocusEffect } from '@react-navigation/native';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import callHistoryManager from '../services/callHistory';

export default function CallsScreen({ navigation, route }) {
  const { user } = useAuthStore();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, missed: 0, incoming: 0, outgoing: 0 });

  // Load call history
  const loadCalls = useCallback(async () => {
    try {
      const { data } = await api.get('/calls/history');
      const callsList = data.calls || [];
      
      // Process and categorize calls
      const processed = callsList.map(call => ({
        ...call,
        direction: getCallDirection(call),
        timestamp: new Date(call.created_at).getTime(),
      }));
      
      setCalls(processed);
      
      // Calculate stats
      setStats({
        total: processed.length,
        missed: processed.filter(c => c.direction === 'missed').length,
        incoming: processed.filter(c => c.direction === 'incoming').length,
        outgoing: processed.filter(c => c.direction === 'outgoing').length,
      });
    } catch (err) {
      console.error('Failed to load calls:', err);
      setCalls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Get call direction
  const getCallDirection = (call) => {
    if (call.caller_id === user?.id) return 'outgoing';
    if (call.status === 'missed' || call.status === 'rejected') return 'missed';
    return 'incoming';
  };

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      loadCalls();
    }, [loadCalls])
  );

  // Filter and group calls
  const groupedCalls = useMemo(() => {
    let filtered = calls;
    
    // Apply filter
    if (activeFilter === 'missed') {
      filtered = calls.filter(c => c.direction === 'missed');
    } else if (activeFilter === 'incoming') {
      filtered = calls.filter(c => c.direction === 'incoming');
    } else if (activeFilter === 'outgoing') {
      filtered = calls.filter(c => c.direction === 'outgoing');
    }
    
    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.caller_name?.toLowerCase().includes(q) ||
        c.receiver_name?.toLowerCase().includes(q)
      );
    }
    
    // Group by date
    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    
    return [
      {
        title: 'Today',
        data: filtered.filter(c => now - c.timestamp < oneDayMs),
      },
      {
        title: 'Yesterday',
        data: filtered.filter(c => now - c.timestamp >= oneDayMs && now - c.timestamp < oneDayMs * 2),
      },
      {
        title: 'This Week',
        data: filtered.filter(c => now - c.timestamp >= oneDayMs * 2 && now - c.timestamp < oneDayMs * 7),
      },
      {
        title: 'Older',
        data: filtered.filter(c => now - c.timestamp >= oneDayMs * 7),
      },
    ].filter(g => g.data.length > 0);
  }, [calls, activeFilter, searchQuery]);

  // Format duration
  const formatDuration = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  // Handle call action
  const handleCall = (contact, callType) => {
    navigation.navigate('CallScreen', {
      contact,
      callType,
      isInitiator: true,
    });
  };

  // Render call item
  const renderCallItem = ({ item: call }) => {
    const isCurrentUserCaller = call.caller_id === user?.id;
    const name = isCurrentUserCaller 
      ? (call.receiver_name || 'Unknown') 
      : (call.caller_name || 'Unknown');
    const avatarInitial = name?.[0]?.toUpperCase() || '?';
    const targetUserId = isCurrentUserCaller ? call.receiver_id : call.caller_id;
    const isMissed = call.direction === 'missed';
    const isVideo = call.call_type === 'video';
    
    // Icon and color based on direction
    let iconName = 'call';
    let iconColor = '#25D366';
    
    if (isMissed) {
      iconName = 'call-outline';
      iconColor = '#EF4444';
    } else if (call.direction === 'incoming') {
      iconName = 'call-incoming';
      iconColor = '#3B82F6';
    } else if (call.direction === 'outgoing') {
      iconName = 'call-outgoing';
      iconColor = '#25D366';
    }
    
    return (
      <TouchableOpacity
        style={styles.callItem}
        onPress={() => navigation.navigate('Chat', { 
          userId: targetUserId,
          userName: name,
        })}
        onLongPress={() => {
          Alert.alert(
            'Call Options',
            `Call ${name}`,
            [
              { text: 'Voice Call', onPress: () => handleCall({ id: targetUserId, full_name: name }, 'audio') },
              { text: 'Video Call', onPress: () => handleCall({ id: targetUserId, full_name: name }, 'video') },
              { text: 'Cancel', style: 'cancel' },
            ]
          );
        }}
      >
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          <View style={[styles.avatar, isMissed && styles.avatarMissed]}>
            <Text style={styles.avatarText}>{avatarInitial}</Text>
          </View>
          
          {/* Call type badge */}
          <View style={[styles.callTypeBadge, isMissed && styles.callTypeBadgeMissed]}>
            <Ionicons
              name={isVideo ? 'videocam' : 'call'}
              size={10}
              color={isMissed ? '#EF4444' : '#25D366'}
            />
          </View>
        </View>

        {/* Info */}
        <View style={styles.callInfo}>
          <Text style={[styles.callName, isMissed && styles.callNameMissed]} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.callMeta}>
            <Ionicons
              name={
                call.direction === 'missed' ? 'arrow-down' :
                call.direction === 'incoming' ? 'arrow-down' : 'arrow-up'
              }
              size={12}
              color={isMissed ? '#EF4444' : '#6B7280'}
            />
            <Text style={[styles.callType, isMissed && styles.callTypeMissed]}>
              {call.direction?.charAt(0).toUpperCase() + call.direction?.slice(1)}
              {isVideo ? ' video' : ' voice'}
              {call.duration > 0 && ` · ${formatDuration(call.duration)}`}
            </Text>
          </View>
        </View>

        {/* Time & Actions */}
        <View style={styles.callActions}>
          <Text style={styles.callTime}>
            {formatDistanceToNow(call.timestamp, { addSuffix: true })}
          </Text>
        </View>

        {/* Quick call buttons */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickCallBtn}
            onPress={() => handleCall({ id: targetUserId, full_name: name }, 'audio')}
          >
            <Ionicons name="call" size={18} color="#25D366" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickCallBtn}
            onPress={() => handleCall({ id: targetUserId, full_name: name }, 'video')}
          >
            <Ionicons name="videocam" size={18} color="#3B82F6" />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // Render section header
  const renderSectionHeader = ({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{section.title}</Text>
    </View>
  );

  // Render empty state
  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIcon}>
        <Ionicons name="call-outline" size={48} color="#D1D5DB" />
      </View>
      <Text style={styles.emptyTitle}>
        {activeFilter === 'missed' ? 'No missed calls' :
         activeFilter === 'incoming' ? 'No incoming calls' :
         activeFilter === 'outgoing' ? 'No outgoing calls' : 'No calls yet'}
      </Text>
      <Text style={styles.emptySubtitle}>Your call history will appear here</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
        <TouchableOpacity
          style={styles.newCallBtn}
          onPress={() => navigation.navigate('NewCall')}
        >
          <Ionicons name="call" size={22} color="#25D366" />
        </TouchableOpacity>
      </View>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        {[
          { key: 'all', label: 'All', count: stats.total },
          { key: 'missed', label: 'Missed', count: stats.missed },
          { key: 'incoming', label: 'Incoming', count: stats.incoming },
          { key: 'outgoing', label: 'Outgoing', count: stats.outgoing },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, activeFilter === tab.key && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab.key)}
          >
            <Text style={[styles.filterText, activeFilter === tab.key && styles.filterTextActive]}>
              {tab.label}
            </Text>
            {tab.count > 0 && (
              <View style={[styles.filterBadge, activeFilter === tab.key && styles.filterBadgeActive]}>
                <Text style={[styles.filterBadgeText, activeFilter === tab.key && styles.filterBadgeTextActive]}>
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#9CA3AF" style={styles.searchIcon} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search calls..."
          style={styles.searchInput}
          placeholderTextColor="#9CA3AF"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {/* Call list */}
      <FlatList
        data={groupedCalls}
        renderItem={({ item: section }) => (
          <View>
            {renderSectionHeader({ section })}
            {section.data.map(call => renderCallItem({ item: call }))}
          </View>
        )}
        keyExtractor={(item, index) => item.id || index.toString()}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCalls();
            }}
            colors={['#25D366']}
            tintColor="#25D366"
          />
        }
        ListEmptyComponent={renderEmpty}
      />

      {/* Stats footer */}
      {stats.total > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            {stats.total} calls · {formatDuration(calls.reduce((sum, c) => sum + (c.duration || 0), 0))} total
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  newCallBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#25D366',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: '#D1D5DB',
  },
  filterBadgeActive: {
    backgroundColor: '#16A34A',
  },
  filterBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#374151',
  },
  filterBadgeTextActive: {
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
  },
  listContent: {
    flexGrow: 1,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  callItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMissed: {
    backgroundColor: '#FEE2E2',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  callTypeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#F0FDF4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  callTypeBadgeMissed: {
    backgroundColor: '#FEE2E2',
  },
  callInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  callName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  callNameMissed: {
    color: '#EF4444',
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  callType: {
    fontSize: 12,
    color: '#6B7280',
  },
  callTypeMissed: {
    color: '#EF4444',
  },
  callActions: {
    alignItems: 'flex-end',
    marginRight: 8,
  },
  callTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
  },
  quickCallBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#F9FAFB',
  },
  footerText: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
  },
});
