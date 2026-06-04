/**
 * Mobile API Testing Screen
 * Features: Full API testing, sandbox management, subscription status
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, StyleSheet, Switch, FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

const ENDPOINTS = [
  { id: 'connection', name: 'Connection Test', method: 'GET', path: '/test/test/connection' },
  { id: 'auth', name: 'Authentication', method: 'POST', path: '/test/test/auth', body: { action: 'login' } },
  { id: 'messages', name: 'Messages', method: 'POST', path: '/test/test/messages', body: { action: 'list' } },
  { id: 'calls', name: 'Calls', method: 'POST', path: '/test/test/calls', body: { action: 'history' } },
  { id: 'contacts', name: 'Contacts', method: 'GET', path: '/test/test/contacts' },
  { id: 'groups', name: 'Groups', method: 'GET', path: '/test/test/groups' },
];

export default function APITestScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('test'); // test, keys, subscription
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState('');
  const [response, setResponse] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);

  // Load API keys
  const loadKeys = useCallback(async () => {
    try {
      const { data } = await api.get('/test/keys/list');
      setApiKeys(data.keys || []);
      if (data.keys?.length > 0 && !selectedKey) {
        setSelectedKey(data.keys[0]);
      }
    } catch (err) {
      console.error('Failed to load keys:', err);
    }
  }, []);

  // Load plans
  const loadPlans = useCallback(async () => {
    try {
      const { data } = await api.get('/test/subscription/plans');
      setPlans(data.plans || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }, []);

  // Load subscription
  const loadSubscription = useCallback(async () => {
    try {
      const { data } = await api.get('/test/subscription/current');
      setSubscription(data.subscriptions?.[0] || null);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    loadPlans();
    loadSubscription();
  }, []);

  // Create API key
  const createKey = async (type) => {
    setLoading(true);
    try {
      const { data } = await api.post('/test/keys/create', { type });
      if (data.api_key) {
        Alert.alert('Success', `API Key created!\n\n${data.api_key}\n\nCopy this and save it securely!`);
        loadKeys();
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  // Test endpoint
  const testEndpoint = async () => {
    if (!selectedKey) {
      Alert.alert('Error', 'Please select an API key');
      return;
    }

    setLoading(true);
    setResponse(null);
    setResponseTime(null);

    const startTime = Date.now();

    try {
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method)) {
        try {
          body = requestBody ? JSON.parse(requestBody) : (selectedEndpoint.body || {});
        } catch {
          body = selectedEndpoint.body || {};
        }
      }

      const config = {
        headers: { 'X-API-Key': selectedKey.api_key },
      };

      let result;
      if (selectedEndpoint.method === 'GET') {
        const res = await api.get(selectedEndpoint.path, config);
        result = res.data;
      } else {
        const res = await api.post(selectedEndpoint.path, body, config);
        result = res.data;
      }

      setResponse(result);
      setResponseTime(Date.now() - startTime);
    } catch (err) {
      setResponse({ error: err.message, details: err.response?.data });
      setResponseTime(Date.now() - startTime);
    } finally {
      setLoading(false);
    }
  };

  // Upgrade subscription
  const upgradePlan = async (planId) => {
    Alert.alert(
      'Upgrade Plan',
      `Upgrade to ${planId.toUpperCase()}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              await api.post('/test/subscription/upgrade', { plan: planId });
              loadSubscription();
              Alert.alert('Success', 'Plan upgraded successfully!');
            } catch (err) {
              Alert.alert('Error', 'Failed to upgrade');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  // Render test tab
  const renderTestTab = () => (
    <View style={styles.tabContent}>
      {/* Endpoint selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.endpointScroll}>
        <View style={styles.endpointRow}>
          {ENDPOINTS.map(ep => (
            <TouchableOpacity
              key={ep.id}
              onPress={() => {
                setSelectedEndpoint(ep);
                if (ep.body) setRequestBody(JSON.stringify(ep.body, null, 2));
              }}
              style={[
                styles.endpointBtn,
                selectedEndpoint.id === ep.id && styles.endpointBtnActive,
              ]}
            >
              <Text style={[
                styles.endpointBtnText,
                selectedEndpoint.id === ep.id && styles.endpointBtnTextActive,
              ]}>
                {ep.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Key selector */}
      <View style={styles.keySelector}>
        <Text style={styles.label}>API Key:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.keyRow}>
            {apiKeys.map(key => (
              <TouchableOpacity
                key={key.id}
                onPress={() => setSelectedKey(key)}
                style={[
                  styles.keyBtn,
                  selectedKey?.id === key.id && styles.keyBtnActive,
                ]}
              >
                <Text style={[
                  styles.keyBtnText,
                  selectedKey?.id === key.id && styles.keyBtnTextActive,
                ]}>
                  {key.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Request body */}
      {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Request Body (JSON):</Text>
          <TextInput
            value={requestBody}
            onChangeText={setRequestBody}
            style={styles.textArea}
            multiline
            placeholder='{"action": "send", "content": "Hello"}'
            placeholderTextColor="#9CA3AF"
          />
        </View>
      )}

      {/* Test button */}
      <TouchableOpacity
        onPress={testEndpoint}
        disabled={loading || !selectedKey}
        style={[styles.testBtn, (!selectedKey || loading) && styles.testBtnDisabled]}
      >
        {loading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Ionicons name="play" size={20} color="#FFF" />
        )}
        <Text style={styles.testBtnText}>Test Endpoint</Text>
      </TouchableOpacity>

      {/* Response */}
      {response && (
        <View style={styles.responseContainer}>
          <View style={styles.responseHeader}>
            <Text style={styles.responseTitle}>Response</Text>
            <Text style={styles.responseTime}>{responseTime}ms</Text>
          </View>
          <ScrollView style={styles.responseBody}>
            <Text style={styles.responseText}>
              {JSON.stringify(response, null, 2)}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );

  // Render keys tab
  const renderKeysTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.keyActions}>
        <TouchableOpacity
          onPress={() => createKey('sandbox')}
          style={[styles.createKeyBtn, styles.sandboxBtn]}
          disabled={loading}
        >
          <Ionicons name="key" size={18} color="#3B82F6" />
          <Text style={styles.createKeyBtnText}>Sandbox Key</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => createKey('production')}
          style={[styles.createKeyBtn, styles.prodBtn]}
          disabled={loading}
        >
          <Ionicons name="key" size={18} color="#25D366" />
          <Text style={styles.createKeyBtnText}>Production Key</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your API Keys</Text>
      
      {apiKeys.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="key-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyText}>No API keys yet</Text>
          <Text style={styles.emptySubtext}>Create one to get started</Text>
        </View>
      ) : (
        <FlatList
          data={apiKeys}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <View style={styles.keyItem}>
              <View style={styles.keyInfo}>
                <View style={styles.keyNameRow}>
                  <Text style={styles.keyName}>{item.name}</Text>
                  <View style={[
                    styles.keyBadge,
                    item.type === 'sandbox' ? styles.sandboxBadge : styles.prodBadge,
                  ]}>
                    <Text style={styles.keyBadgeText}>{item.type}</Text>
                  </View>
                  <View style={[
                    styles.keyBadge,
                    item.is_active ? styles.activeBadge : styles.inactiveBadge,
                  ]}>
                    <Text style={styles.keyBadgeText}>{item.is_active ? 'Active' : 'Revoked'}</Text>
                  </View>
                </View>
                <Text style={styles.keyDate}>
                  Created: {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  // Render subscription tab
  const renderSubscriptionTab = () => (
    <View style={styles.tabContent}>
      {subscription && (
        <View style={styles.currentPlanCard}>
          <Text style={styles.currentPlanLabel}>Current Plan</Text>
          <Text style={styles.currentPlanName}>{subscription.plan?.toUpperCase()}</Text>
          <Text style={styles.currentPlanStatus}>
            Status: {subscription.status} | Expires: {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}
          </Text>
        </View>
      )}

      <Text style={styles.sectionTitle}>Available Plans</Text>
      
      {plans.map(plan => (
        <TouchableOpacity
          key={plan.id}
          onPress={() => upgradePlan(plan.id)}
          style={[
            styles.planCard,
            subscription?.plan === plan.id && styles.planCardActive,
          ]}
          disabled={subscription?.plan === plan.id}
        >
          <View style={styles.planHeader}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{plan.price > 0 ? `$${plan.price}/mo` : 'Free'}</Text>
          </View>
          <View style={styles.planFeatures}>
            {plan.features.map((feature, i) => (
              <View key={i} style={styles.planFeature}>
                <Ionicons name="checkmark-circle" size={16} color="#25D366" />
                <Text style={styles.planFeatureText}>{feature}</Text>
              </View>
            ))}
          </View>
          <View style={[
            styles.planUpgradeBtn,
            subscription?.plan === plan.id && styles.planUpgradeBtnDisabled,
          ]}>
            <Text style={[
              styles.planUpgradeText,
              subscription?.plan === plan.id && styles.planUpgradeTextDisabled,
            ]}>
              {subscription?.plan === plan.id ? 'Current' : 'Upgrade'}
            </Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>API Testing</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color="#111827" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {['test', 'keys', 'subscription'].map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'test' && renderTestTab()}
        {activeTab === 'keys' && renderKeysTab()}
        {activeTab === 'subscription' && renderSubscriptionTab()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  backBtn: {
    padding: 4,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
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
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },
  endpointScroll: {
    marginBottom: 16,
  },
  endpointRow: {
    flexDirection: 'row',
    gap: 8,
  },
  endpointBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  endpointBtnActive: {
    backgroundColor: '#25D366',
  },
  endpointBtnText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  endpointBtnTextActive: {
    color: '#FFF',
  },
  keySelector: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  keyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  keyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  keyBtnActive: {
    backgroundColor: '#111827',
  },
  keyBtnText: {
    fontSize: 12,
    color: '#6B7280',
  },
  keyBtnTextActive: {
    color: '#FFF',
  },
  inputGroup: {
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: 'monospace',
    minHeight: 100,
    color: '#111827',
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    paddingVertical: 14,
    borderRadius: 12,
  },
  testBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  testBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  responseContainer: {
    marginTop: 16,
    backgroundColor: '#111827',
    borderRadius: 12,
    overflow: 'hidden',
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1F2937',
  },
  responseTitle: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  responseTime: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  responseBody: {
    padding: 16,
    maxHeight: 300,
  },
  responseText: {
    color: '#25D366',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  keyActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  createKeyBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  sandboxBtn: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  prodBtn: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#25D366',
  },
  createKeyBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  keyItem: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  keyInfo: {},
  keyNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  keyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sandboxBadge: {
    backgroundColor: '#DBEAFE',
  },
  prodBadge: {
    backgroundColor: '#DCFCE7',
  },
  activeBadge: {
    backgroundColor: '#DCFCE7',
  },
  inactiveBadge: {
    backgroundColor: '#FEE2E2',
  },
  keyBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  keyDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  currentPlanCard: {
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#25D366',
  },
  currentPlanLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  currentPlanName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginVertical: 4,
  },
  currentPlanStatus: {
    fontSize: 12,
    color: '#6B7280',
  },
  planCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  planCardActive: {
    borderColor: '#25D366',
    backgroundColor: '#F0FDF4',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  planName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  planPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#25D366',
  },
  planFeatures: {
    marginTop: 12,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  planFeatureText: {
    fontSize: 13,
    color: '#6B7280',
  },
  planUpgradeBtn: {
    marginTop: 12,
    paddingVertical: 10,
    backgroundColor: '#111827',
    borderRadius: 8,
    alignItems: 'center',
  },
  planUpgradeBtnDisabled: {
    backgroundColor: '#E5E7EB',
  },
  planUpgradeText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  planUpgradeTextDisabled: {
    color: '#9CA3AF',
  },
});