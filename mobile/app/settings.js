/**
 * API Documentation & Settings Mobile Screen
 * Features: Docs, settings, advanced controls, purchase links
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  ActivityIndicator, StyleSheet, Switch, Alert, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../services/store';

const PLANS = [
  { id: 'free', name: 'Free', price: '$0', features: ['100 req/hr', '20 contacts', '3 groups'] },
  { id: 'pro', name: 'Pro', price: '$9.99/mo', features: ['1K req/hr', '200 contacts', '50 groups', 'Video calls', 'API access'] },
  { id: 'enterprise', name: 'Enterprise', price: '$49.99/mo', features: ['10K req/hr', 'Unlimited', 'Unlimited', 'Priority support', 'Webhooks'] },
];

const SETTINGS_SECTIONS = [
  {
    title: 'API Access',
    items: [
      { id: 'api_keys', icon: 'key', label: 'API Keys', type: 'navigation' },
      { id: 'test_api', icon: 'play-circle', label: 'Test API', type: 'navigation' },
      { id: 'webhooks', icon: 'webhook', label: 'Webhooks', type: 'navigation' },
    ]
  },
  {
    title: 'Security',
    items: [
      { id: '2fa', icon: 'shield-checkmark', label: 'Two-Factor Auth', type: 'toggle' },
      { id: 'session_timeout', icon: 'time', label: 'Session Timeout', type: 'select', options: ['5 min', '15 min', '30 min', '1 hour', 'Never'] },
      { id: 'login_alerts', icon: 'notifications', label: 'Login Alerts', type: 'toggle' },
      { id: 'stealth_mode', icon: 'eye-off', label: '👻 Stealth Mode', sub: 'Appear offline, hide read receipts & typing', type: 'toggle' },
    ]
  },
  {
    title: 'Notifications',
    items: [
      { id: 'push_notifications', icon: 'phone-portrait', label: 'Push Notifications', type: 'toggle' },
      { id: 'email_notifications', icon: 'mail', label: 'Email Notifications', type: 'toggle' },
      { id: 'call_notifications', icon: 'call', label: 'Call Notifications', type: 'toggle' },
      { id: 'message_preview', icon: 'document-text', label: 'Message Preview', type: 'toggle' },
      { id: 'ghost_notifications', icon: 'notifications-off', label: '👻 Ghost Notifications', sub: 'Hide sender & content on lock screen', type: 'toggle' },
    ]
  },
  {
    title: 'Privacy',
    items: [
      { id: 'online_status', icon: 'eye', label: 'Show Online Status', type: 'toggle' },
      { id: 'read_receipts', icon: 'checkmark-done', label: 'Read Receipts', type: 'toggle' },
      { id: 'typing_indicator', icon: 'chatbox-ellipses', label: 'Typing Indicator', type: 'toggle' },
      { id: 'last_seen', icon: 'time', label: 'Show Last Seen', type: 'toggle' },
    ]
  },
  {
    title: 'Advanced',
    items: [
      { id: 'data_saver', icon: 'cloud-download', label: 'Data Saver Mode', type: 'toggle' },
      { id: 'auto_download', icon: 'download', label: 'Auto Download Media', type: 'toggle' },
      { id: 'call_quality', icon: 'videocam', label: 'Video Call Quality', type: 'select', options: ['Auto', 'High', 'Medium', 'Low'] },
      { id: 'storage_usage', icon: 'folder', label: 'Storage Usage', type: 'navigation', value: '45.2 MB' },
    ]
  },
  {
    title: 'Account',
    items: [
      { id: 'change_number', icon: 'call', label: 'Change Number', type: 'navigation' },
      { id: 'delete_account', icon: 'trash', label: 'Delete Account', type: 'destructive' },
    ]
  },
];

const DOC_SECTIONS = [
  { id: 'auth', title: 'Authentication', icon: 'shield-checkmark' },
  { id: 'messages', title: 'Messages', icon: 'chatbubbles' },
  { id: 'calls', title: 'Calls', icon: 'call' },
  { id: 'contacts', title: 'Contacts', icon: 'people' },
  { id: 'groups', title: 'Groups', icon: 'people-circle' },
  { id: 'upload', title: 'Upload', icon: 'cloud-upload' },
];

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState('settings'); // settings, docs, pricing
  const [settings, setSettings] = useState({
    '2fa': false,
    'session_timeout': '15 min',
    'login_alerts': true,
    'stealth_mode': false,
    'push_notifications': true,
    'email_notifications': false,
    'call_notifications': true,
    'message_preview': true,
    'ghost_notifications': false,
    'online_status': true,
    'read_receipts': true,
    'typing_indicator': true,
    'last_seen': true,
    'data_saver': false,
    'auto_download': true,
    'call_quality': 'Auto',
    'storage_usage': '45.2 MB',
  });

  const handleToggle = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    // In production, save to backend
  };

  const handleSelect = (key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const renderSettingsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* User profile */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.full_name?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName}>{user?.full_name || 'User'}</Text>
          <Text style={styles.profilePhone}>{user?.phone || ''}</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.editBtn}>
          <Ionicons name="pencil" size={18} color="#25D366" />
        </TouchableOpacity>
      </View>

      {/* Settings sections */}
      {SETTINGS_SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionTitle}>{section.title}</Text>
          <View style={styles.sectionContent}>
            {section.items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.settingItem}
                onPress={() => {
                  if (item.type === 'navigation') {
                    if (item.id === 'api_keys' || item.id === 'test_api') {
                      navigation.navigate('APITest');
                    } else if (item.id === 'storage_usage') {
                      Alert.alert('Storage Usage', 'Media: 35.2 MB\nCache: 10 MB\nTotal: 45.2 MB', [
                        { text: 'Clear Cache', style: 'destructive' },
                        { text: 'Cancel' },
                      ]);
                    }
                  }
                }}
              >
                <View style={styles.settingLeft}>
                  <Ionicons name={item.icon} size={20} color="#6B7280" />
                  <Text style={styles.settingLabel}>{item.label}</Text>
                </View>
                <View style={styles.settingRight}>
                  {item.type === 'toggle' && (
                    <Switch
                      value={settings[item.id]}
                      onValueChange={() => handleToggle(item.id)}
                      trackColor={{ false: '#E5E7EB', true: '#25D366' }}
                      thumbColor="#FFFFFF"
                    />
                  )}
                  {item.type === 'select' && (
                    <View style={styles.selectContainer}>
                      <Text style={styles.selectValue}>{settings[item.id]}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  )}
                  {item.type === 'navigation' && item.value && (
                    <Text style={styles.settingValue}>{item.value}</Text>
                  )}
                  {item.type === 'navigation' && !item.value && (
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  )}
                  {item.type === 'destructive' && (
                    <Ionicons name="chevron-forward" size={16} color="#EF4444" />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ))}

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => {
          Alert.alert('Logout', 'Are you sure you want to logout?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Logout', style: 'destructive', onPress: logout },
          ]);
        }}
      >
        <Ionicons name="log-out-outline" size={20} color="#EF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderDocsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={16} color="#9CA3AF" />
        <TextInput
          placeholder="Search documentation..."
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
      </View>

      {/* Quick access */}
      <Text style={styles.sectionTitle}>Quick Access</Text>
      <View style={styles.quickGrid}>
        {DOC_SECTIONS.map((section) => (
          <TouchableOpacity
            key={section.id}
            style={styles.quickItem}
            onPress={() => {
              // Navigate to full docs or show section
              Alert.alert(section.title, `Documentation for ${section.title} will be displayed here.`);
            }}
          >
            <Ionicons name={section.icon} size={24} color="#25D366" />
            <Text style={styles.quickLabel}>{section.title}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Code example */}
      <Text style={styles.sectionTitle}>Quick Example</Text>
      <View style={styles.codeCard}>
        <Text style={styles.codeLabel}>Authentication</Text>
        <Text style={styles.codeText}>
          {`fetch('https://api.vipchat.com/api/auth/login', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_key',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phone: '+1234567890',
    password: 'password'
  })
})`}
        </Text>
        <TouchableOpacity style={styles.copyBtn}>
          <Ionicons name="copy-outline" size={16} color="#25D366" />
          <Text style={styles.copyText}>Copy</Text>
        </TouchableOpacity>
      </View>

      {/* View all docs link */}
      <TouchableOpacity
        style={styles.viewAllBtn}
        onPress={() => Linking.openURL('https://api.vipchat.com/docs')}
      >
        <Text style={styles.viewAllText}>View Full Documentation</Text>
        <Ionicons name="open-outline" size={16} color="#25D366" />
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPricingTab = () => (
    <ScrollView style={styles.tabContent}>
      <Text style={styles.pageTitle}>Pricing Plans</Text>
      <Text style={styles.pageSubtitle}>Choose the plan that fits your needs</Text>

      {PLANS.map((plan) => (
        <View
          key={plan.id}
          style={[
            styles.planCard,
            plan.id === 'pro' && styles.planCardPopular,
          ]}
        >
          {plan.id === 'pro' && (
            <View style={styles.popularBadge}>
              <Text style={styles.popularText}>Most Popular</Text>
            </View>
          )}
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{plan.price}</Text>
          </View>
          <View style={styles.planFeatures}>
            {plan.features.map((feature, i) => (
              <View key={i} style={styles.planFeature}>
                <Ionicons name="checkmark-circle" size={16} color="#25D366" />
                <Text style={styles.planFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity
            style={[
              styles.planBtn,
              plan.id === 'pro' && styles.planBtnPopular,
            ]}
            onPress={() => {
              if (plan.id === 'free') {
                navigation.navigate('APITest');
              } else {
                Alert.alert('Upgrade Plan', `Upgrade to ${plan.name} for ${plan.price}?`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Upgrade', onPress: () => navigation.navigate('APITest') },
                ]);
              }
            }}
          >
            <Text style={[styles.planBtnText, plan.id === 'pro' && styles.planBtnTextPopular]}>
              {plan.id === 'free' ? 'Get Started' : 'Upgrade'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Compare */}
      <TouchableOpacity style={styles.compareBtn}>
        <Text style={styles.compareText}>Compare All Features</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings & API</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { id: 'settings', label: 'Settings', icon: 'settings-outline' },
          { id: 'docs', label: 'Docs', icon: 'book-outline' },
          { id: 'pricing', label: 'Pricing', icon: 'card-outline' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
          >
            <Ionicons
              name={tab.icon}
              size={20}
              color={activeTab === tab.id ? '#25D366' : '#6B7280'}
            />
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'settings' && renderSettingsTab()}
      {activeTab === 'docs' && renderDocsTab()}
      {activeTab === 'pricing' && renderPricingTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#25D366',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#25D366',
  },
  tabContent: {
    flex: 1,
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#FFF',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  profilePhone: {
    fontSize: 14,
    color: '#6B7280',
  },
  editBtn: {
    padding: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingLabel: {
    fontSize: 15,
    color: '#111827',
  },
  settingRight: {},
  settingValue: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  selectValue: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginTop: 8,
  },
  logoutText: {
    fontSize: 15,
    color: '#EF4444',
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  quickItem: {
    width: '31%',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  quickLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  codeCard: {
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  codeText: {
    fontSize: 11,
    color: '#25D366',
    fontFamily: 'monospace',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 12,
  },
  copyText: {
    fontSize: 12,
    color: '#25D366',
  },
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  viewAllText: {
    fontSize: 15,
    color: '#25D366',
    fontWeight: '500',
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  planCard: {
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planCardPopular: {
    borderColor: '#25D366',
    borderWidth: 2,
  },
  popularBadge: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: '#25D366',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  popularText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFF',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  planName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '700',
    color: '#25D366',
  },
  planFeatures: {
    marginBottom: 16,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  planFeatureText: {
    fontSize: 13,
    color: '#6B7280',
  },
  planBtn: {
    paddingVertical: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 10,
    alignItems: 'center',
  },
  planBtnPopular: {
    backgroundColor: '#25D366',
  },
  planBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  planBtnTextPopular: {
    color: '#FFF',
  },
  compareBtn: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  compareText: {
    fontSize: 14,
    color: '#6B7280',
  },
});