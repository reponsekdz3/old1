import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCode, FiKey, FiBarChart2, FiGlobe, FiCreditCard, FiArrowLeft,
  FiCopy, FiCheck, FiRefreshCw, FiAlertTriangle, FiZap, FiShield,
  FiSend, FiUsers, FiMessageSquare, FiActivity, FiChevronRight,
  FiExternalLink, FiLock, FiX, FiBook, FiDownload, FiTerminal,
  FiPackage, FiFileText, FiChevronDown, FiPlay, FiStar, FiHelpCircle
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import api from '../services/api';

// Language icons and colors
const LANGUAGES = {
  curl: { label: 'cURL', color: '#000', bg: '#fff', icon: 'terminal' },
  python: { label: 'Python', color: '#3776AB', bg: '#FFF7EA', icon: 'code' },
  javascript: { label: 'JavaScript', color: '#F7DF1E', bg: '#FFFEF0', icon: 'code' },
  java: { label: 'Java', color: '#ED8B00', bg: '#FFF0E0', icon: 'code' },
  go: { label: 'Go', color: '#00ADD8', bg: '#E6F7FF', icon: 'code' },
  php: { label: 'PHP', color: '#777BB4', bg: '#F5F5FF', icon: 'code' },
  ruby: { label: 'Ruby', color: '#CC342D', bg: '#FFE6E6', icon: 'code' },
  csharp: { label: 'C#', color: '#512BD4', bg: '#F5EEFF', icon: 'code' },
};

// Pricing plans data
const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 0,
    period: 'forever',
    description: 'Perfect for testing and small projects',
    features: [
      '100 messages/day',
      'Basic API access',
      'Webhook support',
      'Community support',
      'Standard delivery',
      '5 groups',
      '100 broadcast recipients'
    ],
    cta: 'Get Started',
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 29,
    period: 'month',
    description: 'For growing businesses and teams',
    features: [
      '10,000 messages/day',
      'Priority delivery',
      'Advanced analytics',
      'Email support',
      'Webhook retries',
      'Message templates',
      '50 groups',
      '1,000 broadcast recipients',
      'API key rotation'
    ],
    cta: 'Upgrade to Pro',
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 99,
    period: 'month',
    description: 'Unlimited scale for large organizations',
    features: [
      'Unlimited messages',
      'Dedicated support',
      '99.9% SLA guarantee',
      'Custom integrations',
      'Priority routing',
      'HMAC signature verification',
      'White-label options',
      'Dedicated account manager',
      'Unlimited groups & broadcasts',
      'Advanced security'
    ],
    cta: 'Contact Sales',
    popular: false
  }
];

// Copy component
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition">
      {copied ? <><FiCheck size={12} className="text-green-500" /> Copied</> : <><FiCopy size={12} /> Copy</>}
    </button>
  );
}

// Code block with syntax highlighting
function CodeBlock({ code, language = 'curl' }) {
  const lang = LANGUAGES[language] || LANGUAGES.curl;
  return (
    <div className="relative group">
      <div className="absolute top-3 right-3 z-10">
        <CopyButton text={code} />
      </div>
      <pre className="bg-gray-900 text-green-400 text-xs p-4 rounded-xl overflow-x-auto font-mono leading-relaxed" style={{ paddingRight: '5rem' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

// Endpoint card
function EndpointCard({ endpoint, expanded, onToggle }) {
  const methodColors = {
    GET: 'bg-blue-100 text-blue-700 border-blue-200',
    POST: 'bg-green-100 text-green-700 border-green-200',
    PUT: 'bg-orange-100 text-orange-700 border-orange-200',
    DELETE: 'bg-red-100 text-red-700 border-red-200',
    PATCH: 'bg-purple-100 text-purple-700 border-purple-200'
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-3">
      <button 
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${methodColors[endpoint.method]}`}>
            {endpoint.method}
          </span>
          <code className="text-sm font-mono text-gray-900">{endpoint.path}</code>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 hidden sm:block">{endpoint.summary}</span>
          <FiChevronDown size={16} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
        </div>
      </button>
      
      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
              <p className="text-sm text-gray-600">{endpoint.description}</p>
              
              {endpoint.request_body && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Request Body</h4>
                  <CodeBlock 
                    code={JSON.stringify(endpoint.request_body.schema.properties, null, 2)} 
                    language="javascript"
                  />
                </div>
              )}
              
              {endpoint.examples && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Examples</h4>
                  <div className="space-y-3">
                    {Object.entries(endpoint.examples).map(([lang, code]) => (
                      <div key={lang}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-400 uppercase">{lang}</span>
                        </div>
                        <CodeBlock code={code} language={lang} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {endpoint.responses && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Responses</h4>
                  <div className="space-y-2">
                    {Object.entries(endpoint.responses).map(([code, resp]) => (
                      <div key={code} className="flex items-start gap-2">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          code.startsWith('2') ? 'bg-green-100 text-green-700' :
                          code.startsWith('4') ? 'bg-orange-100 text-orange-700' :
                          'bg-red-100 text-red-700'
                        }`}>{code}</span>
                        <span className="text-sm text-gray-600">{resp.description}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main component
export default function ApiDocsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('docs');
  const [selectedLang, setSelectedLang] = useState('curl');
  const [expandedEndpoint, setExpandedEndpoint] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activePlan, setActivePlan] = useState('starter');

  // Load API docs
  useEffect(() => {
    const loadDocs = async () => {
      try {
        const { data } = await api.get('/docs/full');
        setDocs(data);
      } catch (err) {
        console.error('Failed to load docs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadDocs();
  }, []);

  // Filter endpoints
  const filteredEndpoints = docs?.endpoints?.map(group => ({
    ...group,
    endpoints: group.endpoints.filter(ep => 
      ep.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ep.description?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(group => group.endpoints.length > 0) || [];

  // Handle upgrade
  const handleUpgrade = async (planId) => {
    try {
      const { data } = await api.post('/platform/subscribe', { tier: planId });
      if (data.checkout_url) {
        window.open(data.checkout_url, '_blank');
      } else {
        toast.success(data.message || `Upgraded to ${planId}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upgrade failed');
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-gray-500">Loading API Documentation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 bg-[#075E54] flex flex-col shadow-xl flex-shrink-0">
        <div className="px-5 py-5 border-b border-white/10">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition">
            <FiArrowLeft size={14}/> Back to App
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <FiBook size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-white font-bold text-sm">API Docs</h1>
              <p className="text-white/50 text-xs">VipChat v2.0</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {[
            { id: 'docs', label: 'Endpoints', icon: FiCode },
            { id: 'sdks', label: 'SDKs', icon: FiPackage },
            { id: 'pricing', label: 'Pricing', icon: FiCreditCard },
            { id: 'examples', label: 'Code Examples', icon: FiTerminal },
            { id: 'errors', label: 'Error Codes', icon: FiAlertTriangle },
            { id: 'authentication', label: 'Authentication', icon: FiLock },
          ].map(tab => (
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
          <div className="text-white/40 text-xs">
            Version {docs?.meta?.version || '2.0.0'}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{docs?.meta?.title || 'VipChat API'}</h2>
              <p className="text-gray-500 mt-1">{docs?.meta?.description}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-medium">
                {docs?.meta?.version}
              </span>
              <a href="https://github.com/vipchat" target="_blank" rel="noopener noreferrer"
                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                <FiExternalLink size={16} className="text-gray-600"/>
              </a>
            </div>
          </div>

          {/* Base URL */}
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Base URL</p>
                <code className="text-lg font-mono text-[#075E54]">{docs?.meta?.base_url || 'https://api.vipchat.app'}</code>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Protocol</p>
                <span className="text-sm font-medium text-gray-700">HTTPS</span>
              </div>
            </div>
          </div>

          {/* Tabs Content */}
          {activeTab === 'docs' && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <FiCode className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18}/>
                <input
                  type="text"
                  placeholder="Search endpoints..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]"
                />
              </div>

              {/* Endpoints by Group */}
              {filteredEndpoints.map((group, gIdx) => (
                <div key={gIdx}>
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    {group.group === 'Messaging' && <FiMessageSquare size={18} className="text-[#25D366]"/>}
                    {group.group === 'Contacts' && <FiUsers size={18} className="text-[#007AFF]"/>}
                    {group.group === 'Groups' && <FiUsers size={18} className="text-[#9B59B6]"/>}
                    {group.group === 'Webhooks' && <FiGlobe size={18} className="text-[#FF9500]"/>}
                    {group.group === 'Analytics' && <FiBarChart2 size={18} className="text-[#34C759]"/>}
                    {group.group === 'Account' && <FiKey size={18} className="text-[#E74C3C]"/>}
                    {group.group}
                  </h3>
                  {group.endpoints.map((ep, eIdx) => (
                    <EndpointCard
                      key={eIdx}
                      endpoint={ep}
                      expanded={expandedEndpoint === `${gIdx}-${eIdx}`}
                      onToggle={() => setExpandedEndpoint(expandedEndpoint === `${gIdx}-${eIdx}` ? null : `${gIdx}-${eIdx}`)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'sdks' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Official SDKs</h2>
              <p className="text-gray-500">Use our official SDKs for easier integration</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(docs?.sdks || {}).map(([key, sdk]) => (
                  <div key={key} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-900">{sdk.name}</h3>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">v{sdk.version}</span>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-gray-600">
                        <FiDownload size={14} />
                        <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{sdk.install}</code>
                      </div>
                      <a href={sdk.github} target="_blank" rel="noopener noreferrer" 
                        className="flex items-center gap-2 text-[#075E54] hover:underline">
                        <FiExternalLink size={14}/> GitHub
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl p-6 text-white">
                <h3 className="font-bold text-lg mb-2">Need a different language?</h3>
                <p className="text-white/70 text-sm mb-4">Let us know which SDKs you'd like us to build next.</p>
                <button className="px-4 py-2 bg-white text-[#075E54] rounded-xl font-semibold text-sm">
                  Request SDK
                </button>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold text-gray-900">Simple, Transparent Pricing</h2>
                <p className="text-gray-500 mt-1">Choose the plan that fits your needs</p>
              </div>

              {/* Plans */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PLANS.map(plan => (
                  <div key={plan.id} className={`bg-white rounded-2xl p-6 shadow-sm border-2 ${plan.popular ? 'border-[#075E54]' : 'border-gray-100'} relative`}>
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#075E54] text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </div>
                    )}
                    <h3 className="font-bold text-gray-900 text-lg">{plan.name}</h3>
                    <div className="mt-2 mb-4">
                      <span className="text-3xl font-bold text-gray-900">${plan.price}</span>
                      {plan.price > 0 && <span className="text-gray-400 text-sm">/{plan.period}</span>}
                      {plan.price === 0 && <span className="text-gray-400 text-sm">/{plan.period}</span>}
                    </div>
                    <p className="text-sm text-gray-500 mb-4">{plan.description}</p>
                    <ul className="space-y-2 mb-6">
                      {plan.features.map((f, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                          <FiCheck size={14} className="text-[#25D366] flex-shrink-0"/>
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleUpgrade(plan.id)}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                        plan.popular
                          ? 'bg-[#075E54] hover:bg-[#054d46] text-white'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}>
                      {plan.cta}
                    </button>
                  </div>
                ))}
              </div>

              {/* Compare */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">Feature Comparison</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left py-2 text-gray-500 font-medium">Feature</th>
                        <th className="text-center py-2 text-gray-500 font-medium">Starter</th>
                        <th className="text-center py-2 text-gray-500 font-medium">Pro</th>
                        <th className="text-center py-2 text-gray-500 font-medium">Enterprise</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {[
                        ['Daily Messages', '100', '10,000', 'Unlimited'],
                        ['API Rate Limit', '10/sec', '50/sec', '500/sec'],
                        ['Broadcast Recipients', '100', '1,000', '10,000'],
                        ['Webhook Support', '✓', '✓ Advanced', '✓ Premium'],
                        ['Analytics', 'Basic', 'Advanced', 'Custom'],
                        ['Support', 'Community', 'Email', 'Dedicated'],
                        ['SLA', '-', '-', '99.9%'],
                      ].map(([feature, starter, pro, enterprise]) => (
                        <tr key={feature}>
                          <td className="py-2 text-gray-700">{feature}</td>
                          <td className="py-2 text-center">{starter}</td>
                          <td className="py-2 text-center text-[#075E54] font-medium">{pro}</td>
                          <td className="py-2 text-center">{enterprise}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* FAQ */}
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-900 mb-4">Frequently Asked Questions</h3>
                <div className="space-y-4">
                  {[
                    { q: 'Can I upgrade or downgrade anytime?', a: 'Yes! You can change your plan at any time. Changes take effect immediately.' },
                    { q: 'What happens if I exceed my limit?', a: 'Messages will be queued and delivered when your limit resets. Upgrade to get more.' },
                    { q: 'Is there a free trial for Pro?', a: 'Yes! Contact us to request a 14-day Pro trial for your business.' },
                    { q: 'Do you offer annual billing?', a: 'Yes! Annual billing comes with a 20% discount. Contact sales.' },
                  ].map((faq, i) => (
                    <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
                      <p className="font-medium text-gray-900 text-sm">{faq.q}</p>
                      <p className="text-sm text-gray-500 mt-1">{faq.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'examples' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Code Examples</h2>
              <p className="text-gray-500">Copy-paste ready examples in your favorite language</p>

              {/* Language selector */}
              <div className="flex flex-wrap gap-2">
                {Object.entries(LANGUAGES).map(([key, lang]) => (
                  <button
                    key={key}
                    onClick={() => setSelectedLang(key)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition ${
                      selectedLang === key
                        ? 'bg-[#075E54] text-white'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>

              {/* Examples */}
              <div className="space-y-4">
                {docs?.endpoints?.[0]?.endpoints?.[0]?.examples?.[selectedLang] && (
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 mb-2">Send Message</h4>
                    <CodeBlock code={docs.endpoints[0].endpoints[0].examples[selectedLang]} language={selectedLang} />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'errors' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-gray-900">Error Codes</h2>
              <p className="text-gray-500">Understanding API error responses</p>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Code</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Error</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">Message</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {Object.entries(docs?.errors || {}).map(([key, err]) => (
                      <tr key={key}>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-1 rounded ${
                            err.code < 400 ? 'bg-green-100 text-green-700' :
                            err.code < 500 ? 'bg-orange-100 text-orange-700' :
                            'bg-red-100 text-red-700'
                          }`}>{err.code}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600">{key}</td>
                        <td className="px-4 py-3 text-gray-700">{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'authentication' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">Authentication</h2>
              
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FiLock size={16} className="text-[#075E54]"/>
                  Bearer Token Authentication
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  All API requests must include your API key in the Authorization header:
                </p>
                <CodeBlock code="Authorization: Bearer vck_live_your_api_key_here" />
              </div>

              <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-900 mb-3">Getting Your API Key</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
                  <li>Register for an API account in the <button onClick={() => navigate('/api-platform')} className="text-[#075E54] hover:underline">Developer Portal</button></li>
                  <li>Your API key will be displayed once - save it securely</li>
                  <li>Use the key in all API requests</li>
                </ol>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 flex gap-3">
                <FiAlertTriangle size={18} className="text-amber-600 flex-shrink-0 mt-0.5"/>
                <div className="text-sm text-amber-800">
                  <p className="font-semibold mb-1">Keep your API key secure</p>
                  <p>Never commit your API key to version control or expose it in client-side code.</p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}