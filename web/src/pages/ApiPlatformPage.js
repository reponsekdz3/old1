import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCode, FiKey, FiBarChart2, FiGlobe, FiCreditCard, FiArrowLeft,
  FiCopy, FiCheck, FiRefreshCw, FiAlertTriangle, FiZap, FiShield,
  FiSend, FiUsers, FiMessageSquare, FiActivity, FiChevronRight,
  FiExternalLink, FiLock, FiX,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIERS = {
  starter: { label: 'Starter', price: '$0/mo', limit: '100 msg/day', color: 'bg-gray-100 text-gray-700', badge: 'bg-gray-200 text-gray-600' },
  pro: { label: 'Pro', price: '$29/mo', limit: '10,000 msg/day', color: 'bg-blue-100 text-blue-700', badge: 'bg-blue-500 text-white' },
  enterprise: { label: 'Enterprise', price: '$99/mo', limit: 'Unlimited', color: 'bg-purple-100 text-purple-700', badge: 'bg-purple-600 text-white' },
};

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyButton({ text, small }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  return (
    <button onClick={copy} className={`flex items-center gap-1 ${small ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'} bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition`}>
      {copied ? <><FiCheck size={12} className="text-green-500" />Copied</> : <><FiCopy size={12} />Copy</>}
    </button>
  );
}

// ── Mini bar chart ────────────────────────────────────────────────────────────
function BarChart({ data }) {
  if (!data?.length) return <div className="h-32 flex items-center justify-center text-gray-400 text-sm">No data yet</div>;
  const max = Math.max(...data.map(d => d.messages || d.calls || 0), 1);
  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5" title={`${d.date}: ${d.messages || 0} messages`}>
          <div className="w-full rounded-t-sm bg-gradient-to-t from-[#075E54] to-[#25D366] transition-all"
            style={{ height: `${Math.max(4, ((d.messages || 0) / max) * 96)}%`, opacity: 0.6 + (i / data.length) * 0.4 }} />
        </div>
      ))}
    </div>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────
function CodeBlock({ code, language = 'bash' }) {
  return (
    <div className="relative">
      <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <div className="absolute top-2 right-2">
        <CopyButton text={code} small />
      </div>
    </div>
  );
}

// ── Register modal ────────────────────────────────────────────────────────────
function RegisterModal({ onClose, onSuccess }) {
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!businessName.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.post('/platform/register', { business_name: businessName.trim() });
      onSuccess(data);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-xl text-gray-900">Get your API key</h3>
          <button onClick={onClose} className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition"><FiX size={16}/></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Business / App Name</label>
            <input value={businessName} onChange={e => setBusinessName(e.target.value)}
              placeholder="Acme Corp, MyBot, etc."
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366]" autoFocus />
          </div>
          <p className="text-xs text-gray-400">Free Starter tier — 100 messages/day. Upgrade anytime.</p>
          <button type="submit" disabled={!businessName.trim() || loading}
            className="w-full py-3 bg-[#075E54] hover:bg-[#054d46] disabled:bg-gray-200 text-white rounded-xl font-semibold text-sm transition flex items-center justify-center gap-2">
            {loading
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>
              : <><FiKey size={15}/>Create API Client</>}
          </button>
        </form>
      </motion.div>
    </div>
  );
}

// ── API key reveal modal ──────────────────────────────────────────────────────
function ApiKeyModal({ apiKey, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <FiAlertTriangle size={20} className="text-yellow-600"/>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Save your API key</h3>
            <p className="text-xs text-gray-500">This is the only time it will be shown</p>
          </div>
        </div>
        <div className="bg-gray-900 rounded-xl p-4 font-mono text-sm text-green-400 break-all mb-3">{apiKey}</div>
        <div className="flex gap-3 mb-4">
          <CopyButton text={apiKey} />
          <span className="text-xs text-gray-400 flex items-center">Copy and store it securely — we don't store plaintext keys.</span>
        </div>
        <button onClick={onClose} className="w-full py-2.5 bg-[#075E54] hover:bg-[#054d46] text-white rounded-xl font-semibold text-sm transition">
          I've saved my key
        </button>
      </motion.div>
    </div>
  );
}

// ── Endpoint docs ─────────────────────────────────────────────────────────────

// ── MAIN PAGE ─────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview', icon: FiZap },
  { id: 'docs', label: 'API Docs', icon: FiCode },
  { id: 'keys', label: 'API Keys', icon: FiKey },
  { id: 'usage', label: 'Usage', icon: FiBarChart2 },
  { id: 'webhook', label: 'Webhook', icon: FiGlobe },
  { id: 'billing', label: 'Billing', icon: FiCreditCard },
];

function ApiPlatformPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [client, setClient] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [newApiKey, setNewApiKey] = useState(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [rotatingKey, setRotatingKey] = useState(false);
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [apiDocs, setApiDocs] = useState(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [billingInfo, setBillingInfo] = useState(null);

  const loadClient = useCallback(async () => {
    try {
      const { data } = await api.get('/platform/me');
      setClient(data.client);
      setSubscription(data.subscription);
      setWebhookUrl(data.client.webhook_url || '');
    } catch (err) {
      if (err.response?.status !== 404) toast.error('Failed to load client info');
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const { data } = await api.get('/platform/usage?days=14');
      setUsage(data);
    } catch {}
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadClient();
      setLoading(false);
    };
    init();
  }, [loadClient]);

  useEffect(() => {
    if (client && activeTab === 'usage') loadUsage();
  }, [client, activeTab, loadUsage]);

  useEffect(() => {
    if (activeTab === 'docs' && !apiDocs) {
      setDocsLoading(true);
      api.get('/platform/docs').then(({ data }) => setApiDocs(data)).catch(() => {}).finally(() => setDocsLoading(false));
    }
  }, [activeTab, apiDocs]);

  useEffect(() => {
    if (activeTab === 'billing' && client && !billingInfo) {
      api.get('/platform/billing').then(({ data }) => setBillingInfo(data)).catch(() => {});
    }
  }, [activeTab, client, billingInfo]);

  const handleRegisterSuccess = (data) => {
    setClient(data.client);
    setNewApiKey(data.api_key);
    setShowRegister(false);
    setActiveTab('keys');
    toast.success('API client registered!');
  };

  const handleRotateKey = async () => {
    if (!window.confirm('This will invalidate your current API key. Continue?')) return;
    setRotatingKey(true);
    try {
      const { data } = await api.post('/platform/rotate-key');
      setNewApiKey(data.api_key);
      await loadClient();
      toast.success('API key rotated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setRotatingKey(false);
    }
  };

  const handleSaveWebhook = async () => {
    setSavingWebhook(true);
    try {
      await api.put('/platform/webhook', { webhook_url: webhookUrl });
      await loadClient();
      toast.success('Webhook saved');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSavingWebhook(false);
    }
  };

  const handleUpgrade = async (tier) => {
    try {
      const { data } = await api.post('/platform/subscribe', {
        tier,
        success_url: window.location.href + '?success=1',
        cancel_url: window.location.href,
      });
      if (data.checkout_url) {
        window.open(data.checkout_url, '_blank');
      } else {
        await loadClient();
        toast.success(data.message || `Upgraded to ${tier}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    }
  };

  const baseUrl = window.location.origin.replace('5000', '8000');

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-gray-500">Loading Developer Portal...</p>
        </div>
      </div>
    );
  }

  const tier = TIERS[client?.tier || 'starter'];

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      {/* Sidebar */}
      <div className="w-60 bg-[#075E54] flex flex-col shadow-xl flex-shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition">
            <FiArrowLeft size={14}/> Back to App
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <FiCode size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">Developer Portal</h1>
              <p className="text-white/50 text-xs">VipChat Business API</p>
            </div>
          </div>
        </div>

        {client && (
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-white/50 text-xs mb-1">Active Plan</p>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${tier.badge}`}>{tier.label}</span>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}>
              <tab.icon size={15}/>
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
              {user?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
              <p className="text-white/40 text-xs truncate">{client?.business_name || 'Not registered'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">

          {/* ── OVERVIEW ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">VipChat Business API</h2>
                <p className="text-gray-500 mt-1">Send messages, manage contacts, and build chatbots — programmatically.</p>
              </div>

              {!client ? (
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  className="bg-gradient-to-br from-[#075E54] to-[#128C7E] rounded-2xl p-8 text-white text-center">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FiKey size={28}/>
                  </div>
                  <h3 className="text-xl font-bold mb-2">Get started in minutes</h3>
                  <p className="text-white/70 text-sm mb-6">Register your business and get an API key instantly. Free Starter tier available.</p>
                  <button onClick={() => setShowRegister(true)}
                    className="px-8 py-3 bg-white text-[#075E54] rounded-xl font-bold hover:bg-white/90 transition">
                    Create API Client
                  </button>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { icon: FiMessageSquare, label: 'Messages Today', value: usage?.today_messages ?? '—', color: 'bg-blue-500' },
                    { icon: FiActivity, label: 'Total API Calls', value: usage?.total_calls ?? '—', color: 'bg-green-500' },
                    { icon: FiZap, label: 'Daily Limit', value: client?.tier === 'enterprise' ? 'Unlimited' : TIERS[client?.tier]?.limit, color: 'bg-purple-500' },
                  ].map(s => (
                    <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                        <s.icon size={18} className="text-white"/>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                      <p className="text-sm text-gray-500">{s.label}</p>
                    </motion.div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: FiShield, title: 'Secure by default', desc: 'API keys are hashed with SHA-256. Webhook payloads signed with HMAC-SHA256.' },
                  { icon: FiZap, title: 'Instant delivery', desc: 'Messages delivered in real-time to any VipChat user by phone number.' },
                  { icon: FiActivity, title: 'Full analytics', desc: 'Track every API call, message delivery rate, and daily usage at a glance.' },
                ].map(f => (
                  <div key={f.title} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="w-10 h-10 bg-[#075E54]/10 rounded-xl flex items-center justify-center mb-3">
                      <f.icon size={18} className="text-[#075E54]"/>
                    </div>
                    <h4 className="font-semibold text-gray-900 mb-1">{f.title}</h4>
                    <p className="text-sm text-gray-500">{f.desc}</p>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">Quick start</h3>
                <CodeBlock code={`curl -X POST ${baseUrl}/v1/messages/send \\
  -H "Authorization: Bearer vck_live_your_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "+1234567890", "message": "Hello from VipChat API!"}'`} />
              </div>
            </div>
          )}

          {/* ── API DOCS ── */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">API Reference</h2>
                <p className="text-gray-500 text-sm mt-1">
                  Base URL: <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{baseUrl}</code>
                  {apiDocs && <span className="ml-2 text-xs text-gray-400">v{apiDocs.version} · {apiDocs.endpoints?.length || 0} endpoints</span>}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2"><FiLock size={14}/>Authentication</h4>
                <p className="text-sm text-gray-600 mb-3">
                  {apiDocs?.authentication?.description || 'All requests to /v1/ must include your API key in the Authorization header:'}
                </p>
                <CodeBlock code={`Authorization: Bearer vck_live_your_api_key`} />
              </div>

              {docsLoading ? (
                <div className="text-center py-10 text-gray-400 text-sm">Loading endpoints…</div>
              ) : (apiDocs?.endpoints || []).map((ep, idx) => (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <button className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition"
                    onClick={() => setExpandedEndpoint(expandedEndpoint === idx ? null : idx)}>
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0 ${ep.method === 'POST' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {ep.method}
                      </span>
                      <code className="text-sm font-mono text-gray-900 truncate">{ep.path}</code>
                      <span className="text-sm text-gray-500 hidden sm:block">{ep.title}</span>
                    </div>
                    <FiChevronRight size={16} className={`text-gray-400 transition-transform flex-shrink-0 ${expandedEndpoint === idx ? 'rotate-90' : ''}`}/>
                  </button>

                  <AnimatePresence>
                    {expandedEndpoint === idx && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-gray-100">
                        <div className="p-5 space-y-4">
                          <p className="text-sm text-gray-600">{ep.description}</p>

                          {ep.request_body && Object.keys(ep.request_body).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Request Body</p>
                              <CodeBlock code={JSON.stringify(
                                Object.fromEntries(Object.entries(ep.request_body).map(([k, v]) => [k, v.description || v.type || ''])),
                                null, 2
                              )} language="json"/>
                            </div>
                          )}

                          {ep.query_params && Object.keys(ep.query_params).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Query Parameters</p>
                              <div className="space-y-1">
                                {Object.entries(ep.query_params).map(([k, v]) => (
                                  <div key={k} className="flex gap-3 text-sm">
                                    <code className="text-xs bg-gray-100 px-2 py-0.5 rounded w-32 flex-shrink-0">{k}</code>
                                    <span className="text-gray-500">{v.description || `${v.type}${v.default !== undefined ? `, default ${v.default}` : ''}`}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {ep.response_example && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Response</p>
                              <CodeBlock code={JSON.stringify(ep.response_example, null, 2)} language="json"/>
                            </div>
                          )}

                          {ep.errors?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Error Codes</p>
                              <div className="space-y-1">
                                {ep.errors.map((e, i) => (
                                  <div key={i} className="flex gap-3 text-sm">
                                    <code className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded w-12 flex-shrink-0">{e.code}</code>
                                    <span className="text-gray-500">{e.message}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {ep.curl_example && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">cURL Example</p>
                              <CodeBlock code={ep.curl_example} />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {apiDocs?.response_headers && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-3">Rate Limit Response Headers</h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(apiDocs.response_headers).map(([h, d]) => (
                      <div key={h} className="flex gap-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded w-52 flex-shrink-0">{h}</code>
                        <span className="text-gray-500">{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── API KEYS ── */}
          {activeTab === 'keys' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">API Keys</h2>
              {!client ? (
                <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
                  <FiKey size={32} className="text-gray-300 mx-auto mb-3"/>
                  <p className="text-gray-500 mb-4">Register to get your API key</p>
                  <button onClick={() => setShowRegister(true)} className="px-6 py-2.5 bg-[#075E54] text-white rounded-xl font-semibold text-sm hover:bg-[#054d46] transition">
                    Get Started
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold text-gray-900">Your API Key</h3>
                      <button onClick={handleRotateKey} disabled={rotatingKey}
                        className="flex items-center gap-2 text-sm text-orange-600 hover:text-orange-700 font-medium px-3 py-1.5 bg-orange-50 hover:bg-orange-100 rounded-lg transition">
                        <FiRefreshCw size={14} className={rotatingKey ? 'animate-spin' : ''}/>
                        Rotate Key
                      </button>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Key prefix (last full key was shown at creation)</p>
                        <code className="font-mono text-sm text-gray-700">{client.api_key_prefix}</code>
                      </div>
                      <FiLock size={20} className="text-gray-400 flex-shrink-0"/>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Your full API key was shown once at registration. Rotate to get a new one.</p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4">Client Details</h3>
                    <div className="space-y-3 text-sm">
                      {[
                        ['Client ID', client.id],
                        ['Business Name', client.business_name],
                        ['Tier', TIERS[client.tier]?.label || client.tier],
                        ['Status', client.is_active ? 'Active' : 'Suspended'],
                        ['Created', new Date(client.created_at).toLocaleDateString()],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                          <span className="text-gray-400">{k}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 text-xs">{v}</span>
                            {k === 'Client ID' && <CopyButton text={v} small/>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                    <FiAlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold mb-1">Keep your API key secure</p>
                      <p>Never commit it to version control or expose it in client-side code. Use environment variables.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── USAGE ── */}
          {activeTab === 'usage' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Usage & Analytics</h2>
              {!client ? (
                <div className="bg-white rounded-2xl p-10 shadow-sm border border-gray-100 text-center">
                  <FiBarChart2 size={32} className="text-gray-300 mx-auto mb-3"/>
                  <p className="text-gray-500">Register to see usage stats</p>
                </div>
              ) : !usage ? (
                <div className="flex items-center justify-center h-40">
                  <div className="w-8 h-8 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { label: 'Total Messages', value: usage.total_messages },
                      { label: 'API Calls', value: usage.total_calls },
                      { label: 'Success Rate', value: usage.total_calls > 0 ? `${Math.round((usage.success_calls / usage.total_calls) * 100)}%` : '—' },
                      { label: 'Today', value: `${usage.today_messages}${usage.daily_limit ? ` / ${usage.daily_limit}` : ''}` },
                    ].map(s => (
                      <div key={s.label} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                        <p className="text-xl font-bold text-gray-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                        <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {usage.daily_limit && (
                    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="font-medium text-gray-700">Today's usage</span>
                        <span className="text-gray-400">{usage.today_messages} / {usage.daily_limit}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] h-2 rounded-full transition-all"
                          style={{ width: `${Math.min(100, (usage.today_messages / usage.daily_limit) * 100)}%` }}/>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4">Messages (14 days)</h3>
                    <BarChart data={usage.daily} />
                    <div className="flex justify-between text-xs text-gray-400 mt-2">
                      {usage.daily.length > 0 && <span>{usage.daily[0]?.date}</span>}
                      {usage.daily.length > 0 && <span>{usage.daily[usage.daily.length - 1]?.date}</span>}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4">Recent API Calls</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                            <th className="pb-2 font-medium">Endpoint</th>
                            <th className="pb-2 font-medium">Method</th>
                            <th className="pb-2 font-medium">Status</th>
                            <th className="pb-2 font-medium">Time</th>
                            <th className="pb-2 font-medium">Messages</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {(usage.recent_logs || []).slice(0, 20).map(log => (
                            <tr key={log.id} className="hover:bg-gray-50">
                              <td className="py-2 font-mono text-xs">{log.endpoint}</td>
                              <td className="py-2">
                                <span className={`text-xs font-bold ${log.method === 'POST' ? 'text-green-600' : 'text-blue-600'}`}>{log.method}</span>
                              </td>
                              <td className="py-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${log.status_code < 400 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                  {log.status_code}
                                </span>
                              </td>
                              <td className="py-2 text-xs text-gray-400">{log.response_time_ms}ms</td>
                              <td className="py-2 text-xs text-gray-600">{log.message_count || 0}</td>
                            </tr>
                          ))}
                          {!usage.recent_logs?.length && (
                            <tr><td colSpan={5} className="py-8 text-center text-gray-400">No API calls yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── WEBHOOK ── */}
          {activeTab === 'webhook' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Webhook Configuration</h2>
              {!client ? (
                <div className="bg-white rounded-2xl p-10 text-center shadow-sm border border-gray-100">
                  <p className="text-gray-500">Register first to configure webhooks</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-4">Webhook URL</h3>
                    <p className="text-sm text-gray-500 mb-4">
                      When a VipChat user replies to your business messages, we'll POST the event to this URL.
                    </p>
                    <div className="flex gap-3">
                      <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
                        placeholder="https://yourdomain.com/webhook"
                        className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#25D366]"/>
                      <button onClick={handleSaveWebhook} disabled={savingWebhook}
                        className="px-5 py-2.5 bg-[#075E54] hover:bg-[#054d46] text-white rounded-xl font-semibold text-sm transition flex items-center gap-2">
                        {savingWebhook ? <FiRefreshCw size={14} className="animate-spin"/> : null}
                        Save
                      </button>
                    </div>
                  </div>

                  {client.webhook_url && (
                    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                      <h3 className="font-semibold text-gray-900 mb-4">Webhook Secret</h3>
                      <p className="text-sm text-gray-500 mb-3">Use this to verify that webhook requests come from VipChat:</p>
                      <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                        <code className="font-mono text-xs text-gray-700">{client.webhook_secret || '—'}</code>
                        {client.webhook_secret && <CopyButton text={client.webhook_secret} small/>}
                      </div>
                      <div className="mt-4">
                        <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Verify signature (Node.js)</p>
                        <CodeBlock code={`const crypto = require('crypto');
const sig = req.headers['x-vipchat-signature'];
const expected = 'sha256=' + crypto
  .createHmac('sha256', WEBHOOK_SECRET)
  .update(JSON.stringify(req.body))
  .digest('hex');
if (sig !== expected) return res.status(401).send('Invalid');`} language="js"/>
                      </div>
                    </div>
                  )}

                  <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                    <h3 className="font-semibold text-gray-900 mb-3">Event Payload Example</h3>
                    <CodeBlock code={`{
  "event": "message.received",
  "data": {
    "from": "+1234567890",
    "content": "Hello!",
    "message_id": "uuid",
    "timestamp": "2026-06-03T12:00:00Z"
  },
  "timestamp": "2026-06-03T12:00:00.123Z"
}`} language="json"/>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BILLING ── */}
          {activeTab === 'billing' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Plans & Billing</h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { id: 'starter', title: 'Starter', price: '$0', period: '/month', limit: '100 msg/day', features: ['API key access', 'Basic analytics', 'Community support'], cta: 'Current Plan', disabled: true },
                  { id: 'pro', title: 'Pro', price: '$29', period: '/month', limit: '10,000 msg/day', features: ['Everything in Starter', 'Webhook delivery', 'Priority support', 'Usage dashboard'], cta: 'Upgrade to Pro', highlight: true },
                  { id: 'enterprise', title: 'Enterprise', price: '$99', period: '/month', limit: 'Unlimited', features: ['Everything in Pro', 'Unlimited messages', 'Dedicated support', 'SLA guarantee'], cta: 'Upgrade to Enterprise' },
                ].map(plan => (
                  <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${plan.highlight ? 'border-[#075E54]' : 'border-gray-100'} relative`}>
                    {plan.highlight && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#075E54] text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 text-lg">{plan.title}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-bold text-gray-900">{plan.price}</span>
                      <span className="text-gray-400 text-sm">{plan.period}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4 font-medium">{plan.limit}</p>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map(f => (
                        <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                          <FiCheck size={14} className="text-[#25D366] flex-shrink-0"/>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      disabled={plan.disabled || client?.tier === plan.id || !client}
                      onClick={() => client && handleUpgrade(plan.id)}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                        client?.tier === plan.id
                          ? 'bg-gray-100 text-gray-400 cursor-default'
                          : plan.highlight
                            ? 'bg-[#075E54] hover:bg-[#054d46] text-white'
                            : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}>
                      {client?.tier === plan.id ? 'Current Plan' : !client ? 'Register first' : plan.cta}
                    </button>
                  </motion.div>
                ))}
              </div>

              {subscription && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="font-semibold text-gray-900 mb-3">Active Subscription</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-gray-400">Plan</span><span className="font-medium">{TIERS[subscription.tier]?.label}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Status</span><span className={`font-medium ${subscription.status === 'active' ? 'text-green-600' : 'text-red-500'}`}>{subscription.status}</span></div>
                    {subscription.current_period_end && (
                      <div className="flex justify-between"><span className="text-gray-400">Renews</span><span className="font-medium">{new Date(subscription.current_period_end).toLocaleDateString()}</span></div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSuccess={handleRegisterSuccess} />}
      {newApiKey && <ApiKeyModal apiKey={newApiKey} onClose={() => setNewApiKey(null)} />}
    </div>
  );
}

export default ApiPlatformPage;
