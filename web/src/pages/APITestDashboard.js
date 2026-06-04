/**
 * API Testing & Sandbox Dashboard
 * Features: Full API testing, key management, subscription upgrade, real-time analytics
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiKey, FiPlus, FiTrash2, FiRefreshCw, FiPlay, FiCheck,
  FiX, FiActivity, FiClock, FiDatabase, FiShield, FiCreditCard,
  FiChevronDown, FiChevronUp, FiSend, FiCode, FiGlobe,
  FiUsers, FiMessageCircle, FiPhone, FiImage, FiFolder
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';
import { useAuthStore } from '../services/store';

const TABS = {
  KEYS: 'keys',
  TEST: 'test',
  SUBSCRIPTION: 'subscription',
  ANALYTICS: 'analytics',
};

const ENDPOINTS = [
  { id: 'connection', name: 'Connection Test', icon: FiGlobe, method: 'GET', path: '/api/test/test/connection' },
  { id: 'auth', name: 'Authentication', icon: FiShield, method: 'POST', path: '/api/test/test/auth' },
  { id: 'messages', name: 'Messages', icon: FiMessageCircle, method: 'POST', path: '/api/test/test/messages' },
  { id: 'calls', name: 'Calls', icon: FiPhone, method: 'POST', path: '/api/test/test/calls' },
  { id: 'contacts', name: 'Contacts', icon: FiUsers, method: 'GET', path: '/api/test/test/contacts' },
  { id: 'groups', name: 'Groups', icon: FiDatabase, method: 'GET', path: '/api/test/test/groups' },
  { id: 'upload', name: 'Upload', icon: FiImage, method: 'POST', path: '/api/test/test/upload' },
];

const PLANS = [
  { id: 'free', name: 'Free', price: '$0/mo', features: ['Basic messaging', '20 contacts', '3 groups'] },
  { id: 'pro', name: 'Pro', price: '$9.99/mo', features: ['Unlimited messaging', '200 contacts', '50 groups', 'Video calls', 'Status updates'] },
  { id: 'enterprise', name: 'Enterprise', price: '$49.99/mo', features: ['Everything in Pro', 'Unlimited contacts', 'Unlimited groups', 'API access', 'Webhooks', 'Priority support'] },
];

function APITestDashboard() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState(TABS.TEST);
  const [apiKeys, setApiKeys] = useState([]);
  const [currentKey, setCurrentKey] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({});
  const [selectedEndpoint, setSelectedEndpoint] = useState(ENDPOINTS[0]);
  const [requestBody, setRequestBody] = useState('{}');
  const [response, setResponse] = useState(null);
  const [responseTime, setResponseTime] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [plans, setPlans] = useState([]);
  const [usage, setUsage] = useState({});
  const [logs, setLogs] = useState([]);

  // Load API keys
  const loadKeys = useCallback(async () => {
    try {
      const { data } = await api.get('/test/keys/list');
      setApiKeys(data.keys || []);
      if (data.keys?.length > 0 && !currentKey) {
        setCurrentKey(data.keys[0]);
      }
    } catch (err) {
      console.error('Failed to load keys:', err);
    }
  }, []);

  // Load subscription plans
  const loadPlans = useCallback(async () => {
    try {
      const { data } = await api.get('/test/subscription/plans');
      setPlans(data.plans || []);
    } catch (err) {
      console.error('Failed to load plans:', err);
    }
  }, []);

  // Load current subscription
  const loadSubscription = useCallback(async () => {
    try {
      const { data } = await api.get('/test/subscription/current');
      setSubscription(data.subscriptions?.[0] || null);
    } catch (err) {
      console.error('Failed to load subscription:', err);
    }
  }, []);

  // Load usage
  const loadUsage = useCallback(async () => {
    try {
      const { data } = await api.get('/test/usage');
      setUsage(data.usage || {});
    } catch (err) {
      console.error('Failed to load usage:', err);
    }
  }, []);

  // Load logs
  const loadLogs = useCallback(async () => {
    try {
      const { data } = await api.get('/test/logs');
      setLogs(data.logs || []);
    } catch (err) {
      console.error('Failed to load logs:', err);
    }
  }, []);

  useEffect(() => {
    loadKeys();
    loadPlans();
    loadSubscription();
    loadUsage();
    loadLogs();
  }, []);

  // Create new API key
  const handleCreateKey = async (type = 'sandbox') => {
    setLoading(true);
    try {
      const { data } = await api.post('/test/keys/create', { type, name: `API Key ${new Date().toLocaleString()}` });
      if (data.api_key) {
        await loadKeys();
      }
    } catch (err) {
      console.error('Failed to create key:', err);
    } finally {
      setLoading(false);
    }
  };

  // Revoke key
  const handleRevokeKey = async (keyId) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;
    
    try {
      await api.post(`/test/keys/${keyId}/revoke`);
      await loadKeys();
    } catch (err) {
      console.error('Failed to revoke key:', err);
    }
  };

  // Test endpoint
  const handleTest = async () => {
    if (!currentKey) return;
    
    setLoading(true);
    setResponse(null);
    setResponseTime(null);
    
    const startTime = Date.now();
    
    try {
      let body = null;
      if (['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method)) {
        try {
          body = JSON.parse(requestBody);
        } catch {
          body = {};
        }
      }

      const config = {
        headers: {
          'X-API-Key': currentKey.api_key || apiKeys.find(k => k.id === currentKey?.id)?.api_key,
        },
      };

      let result;
      if (selectedEndpoint.method === 'GET') {
        const { data } = await api.get(selectedEndpoint.path, config);
        result = data;
      } else {
        const { data } = await api.post(selectedEndpoint.path, body, config);
        result = data;
      }

      setResponse(result);
      setResponseTime(Date.now() - startTime);
      loadLogs();
    } catch (err) {
      setResponse({ error: err.response?.data?.error || err.message });
      setResponseTime(Date.now() - startTime);
    } finally {
      setLoading(false);
    }
  };

  // Upgrade subscription
  const handleUpgrade = async (planId) => {
    if (!confirm(`Upgrade to ${planId.toUpperCase()} plan?`)) return;
    
    setLoading(true);
    try {
      await api.post('/test/subscription/upgrade', { plan: planId });
      await loadSubscription();
    } catch (err) {
      console.error('Failed to upgrade:', err);
    } finally {
      setLoading(false);
    }
  };

  // Render keys tab
  const renderKeysTab = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-800">API Keys</h3>
        <div className="flex gap-2">
          <button
            onClick={() => handleCreateKey('sandbox')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            <FiPlus size={16} /> Sandbox Key
          </button>
          <button
            onClick={() => handleCreateKey('production')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
          >
            <FiPlus size={16} /> Production Key
          </button>
        </div>
      </div>

      {apiKeys.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <FiKey size={48} className="mx-auto mb-4 opacity-30" />
          <p>No API keys yet</p>
          <p className="text-sm">Create one to get started</p>
        </div>
      ) : (
        <div className="space-y-2">
          {apiKeys.map(key => (
            <motion.div
              key={key.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-lg border ${currentKey?.id === key.id ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{key.name}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      key.type === 'sandbox' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                    }`}>
                      {key.type}
                    </span>
                    {key.is_active ? (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">Revoked</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    Created: {new Date(key.created_at).toLocaleString()}
                    {key.last_used && ` | Last used: ${new Date(key.last_used).toLocaleString()}`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentKey(key)}
                    className="px-3 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200"
                  >
                    Select
                  </button>
                  <button
                    onClick={() => handleRevokeKey(key.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  // Render test tab
  const renderTestTab = () => (
    <div className="space-y-4">
      {/* Endpoint selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {ENDPOINTS.map(endpoint => (
          <button
            key={endpoint.id}
            onClick={() => setSelectedEndpoint(endpoint)}
            className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
              selectedEndpoint.id === endpoint.id
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <endpoint.icon size={16} />
            <span className="text-sm font-medium">{endpoint.name}</span>
          </button>
        ))}
      </div>

      {/* Current key selector */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <span className="text-sm text-gray-600">Using API Key:</span>
        <select
          value={currentKey?.id || ''}
          onChange={e => setCurrentKey(apiKeys.find(k => k.id === e.target.value))}
          className="flex-1 px-3 py-2 border rounded-lg"
        >
          <option value="">Select an API key</option>
          {apiKeys.filter(k => k.is_active).map(key => (
            <option key={key.id} value={key.id}>{key.name} ({key.type})</option>
          ))}
        </select>
      </div>

      {/* Request body */}
      {['POST', 'PUT', 'PATCH'].includes(selectedEndpoint.method) && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Request Body (JSON)</label>
          <textarea
            value={requestBody}
            onChange={e => setRequestBody(e.target.value)}
            className="w-full h-40 p-3 border rounded-lg font-mono text-sm"
            placeholder='{"action": "send", "content": "Hello"}'
          />
        </div>
      )}

      {/* Test button */}
      <button
        onClick={handleTest}
        disabled={loading || !currentKey}
        className="flex items-center justify-center gap-2 w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
      >
        {loading ? <FiRefreshCw className="animate-spin" /> : <FiPlay />}
        Test Endpoint
      </button>

      {/* Response */}
      <AnimatePresence>
        {response && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="border rounded-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-2 bg-gray-100">
              <span className="font-medium">Response</span>
              <span className="text-sm text-gray-500">
                {responseTime && `${responseTime}ms`}
              </span>
            </div>
            <pre className="p-4 bg-gray-900 text-green-400 font-mono text-sm overflow-auto max-h-96">
              {JSON.stringify(response, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // Render subscription tab
  const renderSubscriptionTab = () => (
    <div className="space-y-6">
      {/* Current subscription */}
      {subscription && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h3 className="font-semibold text-green-800">Current Plan: {subscription.plan?.toUpperCase()}</h3>
          <p className="text-sm text-green-600 mt-1">
            Status: {subscription.status} | Expires: {subscription.expires_at ? new Date(subscription.expires_at).toLocaleDateString() : 'Never'}
          </p>
        </div>
      )}

      {/* Plans */}
      <div className="grid md:grid-cols-3 gap-4">
        {PLANS.map(plan => (
          <motion.div
            key={plan.id}
            whileHover={{ scale: 1.02 }}
            className={`p-6 border rounded-xl ${
              subscription?.plan === plan.id
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <h3 className="text-xl font-bold">{plan.name}</h3>
            <p className="text-2xl font-bold text-gray-800 mt-2">{plan.price}</p>
            <ul className="mt-4 space-y-2">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                  <FiCheck size={14} className="text-green-500" />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleUpgrade(plan.id)}
              disabled={loading || subscription?.plan === plan.id}
              className={`w-full mt-6 py-2 rounded-lg font-medium ${
                subscription?.plan === plan.id
                  ? 'bg-gray-200 text-gray-500'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
            >
              {subscription?.plan === plan.id ? 'Current Plan' : 'Upgrade'}
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );

  // Render analytics tab
  const renderAnalyticsTab = () => (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{Object.values(usage).reduce((a, b) => a + b, 0)}</div>
          <div className="text-sm text-blue-600">Total Requests</div>
        </div>
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{logs.length}</div>
          <div className="text-sm text-green-600">API Calls</div>
        </div>
        <div className="p-4 bg-purple-50 rounded-lg">
          <div className="text-2xl font-bold text-purple-600">{apiKeys.length}</div>
          <div className="text-sm text-purple-600">API Keys</div>
        </div>
        <div className="p-4 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">{subscription?.plan || 'None'}</div>
          <div className="text-sm text-orange-600">Current Plan</div>
        </div>
      </div>

      {/* Recent logs */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Recent API Calls</h3>
        {logs.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No API calls yet</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-auto">
            {logs.slice(0, 20).map((log, i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-white border rounded-lg">
                <span className={`px-2 py-1 text-xs rounded ${
                  log.status_code < 300 ? 'bg-green-100 text-green-700' :
                  log.status_code < 400 ? 'bg-blue-100 text-blue-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {log.status_code}
                </span>
                <span className="font-mono text-sm">{log.method}</span>
                <span className="flex-1 truncate text-sm text-gray-600">{log.endpoint}</span>
                <span className="text-xs text-gray-400">{log.duration_ms}ms</span>
                <span className="text-xs text-gray-400">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">API Testing & Sandbox</h1>
            <p className="text-gray-500">Test APIs, manage keys, and upgrade your plan</p>
          </div>
          <a
            href="/api/test/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900"
          >
            <FiCode size={16} /> API Docs
          </a>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          {[
            { id: TABS.TEST, icon: FiPlay, label: 'Test API' },
            { id: TABS.KEYS, icon: FiKey, label: 'API Keys' },
            { id: TABS.SUBSCRIPTION, icon: FiCreditCard, label: 'Subscription' },
            { id: TABS.ANALYTICS, icon: FiActivity, label: 'Analytics' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          {activeTab === TABS.TEST && renderTestTab()}
          {activeTab === TABS.KEYS && renderKeysTab()}
          {activeTab === TABS.SUBSCRIPTION && renderSubscriptionTab()}
          {activeTab === TABS.ANALYTICS && renderAnalyticsTab()}
        </div>
      </div>
    </div>
  );
}

export default APITestDashboard;