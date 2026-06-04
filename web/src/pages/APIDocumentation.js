/**
 * API Documentation & Developer Portal
 * Features: Multilingual docs, interactive testing, purchase links, code examples
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FiSearch, FiBook, FiCode, FiCreditCard, FiCheck, FiCopy,
  FiGlobe, FiChevronRight, FiChevronDown, FiPlay, FiLock,
  FiActivity, FiUsers, FiMessageCircle, FiPhone, FiDatabase,
  FiUpload, FiShield, FiAlertCircle, FiWebhook, FiPackage,
  FiMenu, FiX, FiExternalLink, FiRefreshCw
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const CATEGORIES = [
  { id: 'getting-started', icon: FiBook, label: 'Getting Started' },
  { id: 'authentication', icon: FiLock, label: 'Authentication' },
  { id: 'messages', icon: FiMessageCircle, label: 'Messages' },
  { id: 'calls', icon: FiPhone, label: 'Calls' },
  { id: 'contacts', icon: FiUsers, label: 'Contacts' },
  { id: 'groups', icon: FiDatabase, label: 'Groups' },
  { id: 'upload', icon: FiUpload, label: 'File Upload' },
  { id: 'pricing', icon: FiCreditCard, label: 'Pricing' },
  { id: 'sdks', icon: FiPackage, label: 'SDKs' },
  { id: 'errors', icon: FiAlertCircle, label: 'Errors' },
  { id: 'webhooks', icon: FiWebhook, label: 'Webhooks' },
];

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: '/forever',
    features: [
      '100 API requests/hour',
      '20 contacts',
      '3 groups',
      '2MB file uploads',
      'Basic messaging',
      'Community support',
    ],
    limitations: ['No video calls', 'No API access'],
    cta: 'Get Started',
    popular: false,
    link: '/signup',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$9.99',
    period: '/month',
    features: [
      '1,000 API requests/hour',
      '200 contacts',
      '50 groups',
      '25MB file uploads',
      'Video & voice calls',
      'Status updates',
      'Full API access',
      'Priority support',
      'Webhooks',
    ],
    cta: 'Get Pro',
    popular: true,
    link: '/checkout?plan=pro',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: '$49.99',
    period: '/month',
    features: [
      '10,000 API requests/hour',
      'Unlimited contacts',
      'Unlimited groups',
      '100MB file uploads',
      'Priority support',
      'Webhooks',
      'Custom integrations',
      'Dedicated API',
      'SLA guarantee',
    ],
    cta: 'Contact Sales',
    popular: false,
    link: '/contact?plan=enterprise',
  },
];

function APIDocumentation() {
  const [language, setLanguage] = useState('en');
  const [activeCategory, setActiveCategory] = useState('getting-started');
  const [searchQuery, setSearchQuery] = useState('');
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('docs'); // docs, pricing, sdks
  const [copySuccess, setCopySuccess] = useState('');

  // Load documentation
  const loadDocs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/docs/${language}`);
      setDocs(data.content);
    } catch (err) {
      console.error('Failed to load docs:', err);
    } finally {
      setLoading(false);
    }
  }, [language]);

  useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Copy code to clipboard
  const copyCode = (code, id) => {
    navigator.clipboard.writeText(code);
    setCopySuccess(id);
    setTimeout(() => setCopySuccess(''), 2000);
  };

  // Code examples
  const renderCodeExample = (examples) => {
    const [activeLang, setActiveLang] = useState('javascript');

    return (
      <div className="mt-4 bg-gray-900 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
          <div className="flex gap-2">
            {['javascript', 'python', 'bash'].map(lang => (
              <button
                key={lang}
                onClick={() => setActiveLang(lang)}
                className={`px-3 py-1 text-xs rounded ${
                  activeLang === lang ? 'bg-green-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {lang.charAt(0).toUpperCase() + lang.slice(1)}
              </button>
            ))}
          </div>
          <button
            onClick={() => copyCode(examples[activeLang], activeLang)}
            className="text-gray-400 hover:text-white"
          >
            {copySuccess === activeLang ? <FiCheck size={16} /> : <FiCopy size={16} />}
          </button>
        </div>
        <pre className="p-4 text-green-400 text-sm font-mono overflow-auto max-h-64">
          {examples[activeLang]}
        </pre>
      </div>
    );
  };

  // Render getting started section
  const renderGettingStarted = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Getting Started</h2>
        <p className="text-gray-600">Learn how to authenticate and make your first API call</p>
      </div>

      {docs?.getting_started?.steps?.map((step, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="bg-white border rounded-xl p-6"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 font-bold">
              {i + 1}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
              {step.code_example && (
                renderCodeExample(step.code_example)
              )}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );

  // Render authentication section
  const renderAuthentication = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication</h2>
        <p className="text-gray-600">All API requests require authentication via API key</p>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <FiAlertCircle className="text-yellow-600 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-800">Security Notice</p>
            <p className="text-sm text-yellow-700">Never share your API keys publicly. Use environment variables.</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-400">Header Example</span>
          <button
            onClick={() => copyCode('X-API-Key: your_api_key', 'auth-header')}
            className="text-gray-400 hover:text-white"
          >
            {copySuccess === 'auth-header' ? <FiCheck size={14} /> : <FiCopy size={14} />}
          </button>
        </div>
        <code className="text-green-400">curl -H "X-API-Key: vipchat_test_xxxxxxxx" https://api.vipchat.com/api/test/connection</code>
      </div>
    </div>
  );

  // Render pricing section
  const renderPricing = () => (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Pricing & Plans</h2>
        <p className="text-gray-600">Choose the perfect plan for your needs</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {PLANS.map((plan) => (
          <motion.div
            key={plan.id}
            whileHover={{ scale: 1.02 }}
            className={`relative bg-white rounded-2xl border-2 p-6 ${
              plan.popular ? 'border-green-500 shadow-lg' : 'border-gray-200'
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                Most Popular
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-4xl font-bold text-gray-800">{plan.price}</span>
                <span className="text-gray-500">{plan.period}</span>
              </div>
            </div>

            <ul className="space-y-3 mb-6">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-center gap-2">
                  <FiCheck className="text-green-500 flex-shrink-0" size={16} />
                  <span className="text-sm text-gray-600">{feature}</span>
                </li>
              ))}
              {plan.limitations?.map((lim, i) => (
                <li key={i} className="flex items-center gap-2 opacity-50">
                  <FiX className="text-red-400 flex-shrink-0" size={16} />
                  <span className="text-sm text-gray-500">{lim}</span>
                </li>
              ))}
            </ul>

            <a
              href={plan.link}
              className={`block w-full py-3 rounded-lg text-center font-medium transition-colors ${
                plan.popular
                  ? 'bg-green-500 text-white hover:bg-green-600'
                  : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
            >
              {plan.cta}
            </a>
          </motion.div>
        ))}
      </div>

      <div className="bg-gray-50 rounded-xl p-6 text-center">
        <p className="text-gray-600 mb-4">Need a custom solution?</p>
        <a
          href="/contact"
          className="inline-flex items-center gap-2 text-green-600 font-medium hover:underline"
        >
          Contact Sales <FiExternalLink size={14} />
        </a>
      </div>
    </div>
  );

  // Render SDKs section
  const renderSDKs = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">SDKs & Libraries</h2>
        <p className="text-gray-600">Official libraries for popular programming languages</p>
      </div>

      {[
        { name: 'JavaScript/Node.js', install: 'npm install @vipchat/sdk', color: 'bg-yellow-400' },
        { name: 'Python', install: 'pip install vipchat-sdk', color: 'bg-blue-500' },
        { name: 'React Native', install: 'npx expo install vipchat-rn', color: 'bg-blue-400' },
        { name: 'Go', install: 'go get github.com/vipchat/sdk-go', color: 'bg-cyan-500' },
      ].map((sdk) => (
        <div key={sdk.name} className="bg-white border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${sdk.color} flex items-center justify-center`}>
                <FiCode className="text-white" />
              </div>
              <h3 className="font-semibold">{sdk.name}</h3>
            </div>
            <a href={`/docs/sdk/${sdk.name.toLowerCase().split('/')[0]}`} className="text-green-600 text-sm hover:underline">
              View Docs
            </a>
          </div>
          <div className="bg-gray-900 rounded-lg p-3 flex items-center justify-between">
            <code className="text-green-400 text-sm">{sdk.install}</code>
            <button
              onClick={() => copyCode(sdk.install, sdk.name)}
              className="text-gray-400 hover:text-white"
            >
              {copySuccess === sdk.name ? <FiCheck size={14} /> : <FiCopy size={14} />}
            </button>
          </div>
        </div>
      ))}
    </div>
  );

  // Render endpoints section
  const renderEndpoints = () => {
    if (!docs?.endpoints?.categories) return null;

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">API Endpoints</h2>
          <p className="text-gray-600">Complete list of available API endpoints</p>
        </div>

        {docs.endpoints.categories.map((category) => (
          <div key={category.name} className="bg-white border rounded-xl overflow-hidden">
            <div className="px-6 py-4 bg-gray-50 border-b flex items-center gap-3">
              <FiDatabase className="text-gray-500" />
              <h3 className="font-semibold">{category.name}</h3>
            </div>
            <div className="divide-y">
              {category.endpoints.map((endpoint, i) => (
                <div key={i} className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <span className={`px-2 py-1 rounded text-xs font-mono ${
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-700' :
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-700' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="text-sm text-gray-700">{endpoint.path}</code>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{endpoint.description}</p>
                  
                  {endpoint.body && (
                    <div className="bg-gray-900 rounded-lg p-3">
                      <span className="text-gray-400 text-xs">Request Body:</span>
                      <pre className="text-green-400 text-sm mt-1">
                        {JSON.stringify(endpoint.body, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Main content render
  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <FiRefreshCw className="animate-spin text-green-500" size={32} />
        </div>
      );
    }

    switch (activeCategory) {
      case 'getting-started':
        return renderGettingStarted();
      case 'authentication':
        return renderAuthentication();
      case 'pricing':
        return renderPricing();
      case 'sdks':
        return renderSDKs();
      case 'messages':
      case 'calls':
      case 'contacts':
      case 'groups':
      case 'upload':
        return renderEndpoints();
      default:
        return renderGettingStarted();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
              >
                <FiMenu />
              </button>
              <a href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">V</span>
                </div>
                <span className="text-xl font-bold">API Docs</span>
              </a>
            </div>

            {/* Search */}
            <div className="hidden md:flex items-center gap-4">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search docs..."
                  className="pl-10 pr-4 py-2 bg-gray-100 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Language selector */}
              <div className="flex items-center gap-2">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setLanguage(lang.code)}
                    className={`px-2 py-1 rounded text-sm ${
                      language === lang.code ? 'bg-green-100 text-green-700' : 'hover:bg-gray-100'
                    }`}
                    title={lang.name}
                  >
                    {lang.flag}
                  </button>
                ))}
              </div>

              {/* Links */}
              <div className="flex items-center gap-3">
                <a href="/dashboard/api-test" className="text-gray-600 hover:text-gray-800">
                  Dashboard
                </a>
                <a href="/pricing" className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600">
                  Get API Key
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex">
        {/* Sidebar */}
        <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r transform transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}>
          <div className="h-full overflow-y-auto p-4">
            <nav className="space-y-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setActiveCategory(cat.id);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors ${
                    activeCategory === cat.id
                      ? 'bg-green-50 text-green-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <cat.icon size={18} />
                  {cat.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6 lg:p-8">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >
            {renderContent()}
          </motion.div>
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

export default APIDocumentation;