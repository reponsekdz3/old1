import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiCode, FiKey, FiZap, FiBarChart2, FiPlus, FiX, FiCheck, FiCopy,
  FiEye, FiEyeOff, FiRefreshCw, FiActivity, FiLayers, FiGlobe,
  FiShield, FiDollarSign, FiAlertCircle, FiSearch, FiChevronDown,
  FiPackage, FiClock, FiLink, FiArrowRight, FiTrendingUp,
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

const GREEN = '#25D366';
const DARK = '#075E54';

const TIERS_META = {
  free: { color: 'gray', icon: '🆓' },
  starter: { color: 'blue', icon: '🚀' },
  professional: { color: 'purple', icon: '⚡' },
  enterprise: { color: 'amber', icon: '🏢' },
};

const API_CATEGORIES = [
  'All', 'messaging', 'payments', 'analytics', 'ai', 'data',
  'authentication', 'notifications', 'storage', 'maps', 'finance', 'other',
];

function Spinner({ size = 18 }) {
  return <div style={{ width: size, height: size }} className="border-2 border-current border-t-transparent rounded-full animate-spin" />;
}

function Badge({ children, color = 'green' }) {
  const cls = {
    green: 'bg-green-100 text-green-700', blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700', amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700', gray: 'bg-gray-100 text-gray-500',
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls[color] || cls.gray}`}>{children}</span>;
}

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={async () => {
      await navigator.clipboard.writeText(text).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }} className="p-1 hover:bg-gray-100 rounded transition">
      {copied ? <FiCheck size={13} className="text-green-500" /> : <FiCopy size={13} className="text-gray-400" />}
    </button>
  );
}

const TABS = [
  { id: 'marketplace', label: 'API Marketplace', icon: FiPackage },
  { id: 'subscriptions', label: 'My APIs', icon: FiKey },
  { id: 'publish', label: 'Publish API', icon: FiPlus },
  { id: 'earnings', label: 'Earnings', icon: FiDollarSign },
];

// ── API Product Card ───────────────────────────────────────────────────────────
function APICard({ product, onView, mySubscription }) {
  const pricing = product.pricing || {};
  const minPrice = Math.min(...Object.values(pricing).filter(v => typeof v === 'number'));
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group p-5"
      onClick={() => onView(product)}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
          {product.name[0]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-gray-900 truncate">{product.name}</div>
          <div className="text-xs text-gray-400 truncate">{product.category} · v{product.version}</div>
        </div>
        {product.is_featured && <Badge color="amber">⭐ Featured</Badge>}
        {mySubscription && <Badge color="green">Subscribed</Badge>}
      </div>
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.short_description || product.description}</p>
      <div className="flex items-center justify-between text-xs text-gray-400">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><FiZap size={11} />{(product.subscriber_count||0).toLocaleString()} subs</span>
          <span className="flex items-center gap-1"><FiActivity size={11} />{(product.total_requests||0).toLocaleString()} calls</span>
        </div>
        <span className="font-semibold text-[#075E54]">
          {minPrice === 0 ? 'Free tier' : `From $${minPrice}/mo`}
        </span>
      </div>
      {product.owner_verified && (
        <div className="mt-2 text-xs text-blue-500 flex items-center gap-1">
          <FiShield size={10} /> Verified Provider · {product.owner_name}
        </div>
      )}
    </motion.div>
  );
}

// ── API Product Detail ─────────────────────────────────────────────────────────
function APIProductDetail({ product, tiers, onClose, onSubscribe, mySubscription }) {
  const [selTier, setSelTier] = useState(mySubscription?.tier || 'free');
  const [loading, setLoading] = useState(false);
  const pricing = product.pricing || {};
  const spec = product.openapi_spec;

  async function handleSubscribe() {
    setLoading(true);
    try {
      await onSubscribe(product.id, selTier);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white text-2xl font-bold">
                {product.name[0]}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{product.name}</h2>
                <div className="text-sm text-gray-500">{product.category} · v{product.version} · by {product.owner_name}</div>
              </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center"><FiX /></button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{(product.subscriber_count||0).toLocaleString()}</div>
              <div className="text-xs text-gray-400">Subscribers</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{(product.total_requests||0).toLocaleString()}</div>
              <div className="text-xs text-gray-400">API Calls</div>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-700">99.9%</div>
              <div className="text-xs text-gray-400">Uptime</div>
            </div>
          </div>

          {product.description && (
            <div className="mb-5">
              <h3 className="font-semibold text-gray-700 mb-2">About</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {product.base_url && (
            <div className="bg-gray-900 rounded-xl p-3 mb-5">
              <div className="text-xs text-gray-500 mb-1">Base URL</div>
              <div className="text-sm text-green-400 font-mono">{product.base_url}</div>
              {product.sandbox_url && (
                <>
                  <div className="text-xs text-gray-500 mt-2 mb-1">Sandbox URL</div>
                  <div className="text-sm text-yellow-400 font-mono">{product.sandbox_url}</div>
                </>
              )}
            </div>
          )}

          {/* Endpoints */}
          {product.endpoints && product.endpoints.length > 0 && (
            <div className="mb-5">
              <h3 className="font-semibold text-gray-700 mb-2">Endpoints ({product.endpoints.length})</h3>
              <div className="space-y-2">
                {product.endpoints.map(ep => (
                  <div key={ep.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded font-mono ${
                      ep.method === 'GET' ? 'bg-blue-100 text-blue-700' :
                      ep.method === 'POST' ? 'bg-green-100 text-green-700' :
                      ep.method === 'PUT' ? 'bg-amber-100 text-amber-700' :
                      ep.method === 'DELETE' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'
                    }`}>{ep.method}</span>
                    <span className="font-mono text-sm text-gray-700 flex-1">{ep.path}</span>
                    {ep.required_tier !== 'free' && <Badge color="purple">{ep.required_tier}</Badge>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tier selection */}
          <h3 className="font-semibold text-gray-700 mb-3">Choose a Plan</h3>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {Object.entries(tiers || {}).map(([key, tier]) => (
              <button key={key} onClick={() => setSelTier(key)}
                className={`text-left p-4 rounded-xl border-2 transition ${selTier === key ? 'border-[#075E54] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}>
                <div className="font-bold text-gray-900 text-sm">{TIERS_META[key]?.icon} {tier.label}</div>
                <div className="text-lg font-bold text-[#075E54] mt-1">
                  {tier.price_monthly === 0 ? 'Free' : `$${tier.price_monthly}/mo`}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {tier.requests_per_month === -1 ? 'Unlimited' : `${(tier.requests_per_month||0).toLocaleString()}`} req/mo
                </div>
                <div className="text-xs text-gray-400 mt-1">{tier.requests_per_minute} req/min</div>
              </button>
            ))}
          </div>

          {mySubscription ? (
            <div className="bg-green-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-green-700">Currently subscribed: {mySubscription.tier}</div>
                <div className="text-xs text-green-600">{mySubscription.requests_this_month} / {mySubscription.monthly_limit === -1 ? '∞' : mySubscription.monthly_limit} requests used</div>
              </div>
              <button onClick={handleSubscribe} disabled={loading}
                className="px-4 py-2 bg-[#075E54] text-white text-sm font-semibold rounded-xl disabled:opacity-50">
                {loading ? <Spinner size={16} /> : 'Change Plan'}
              </button>
            </div>
          ) : (
            <button onClick={handleSubscribe} disabled={loading}
              className="w-full py-4 bg-[#075E54] text-white rounded-2xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? <><Spinner /> Subscribing...</> : (
                <>
                  <FiKey size={18} />
                  {tiers?.[selTier]?.price_monthly === 0 ? 'Get Free API Keys' : `Subscribe · $${tiers?.[selTier]?.price_monthly}/mo`}
                </>
              )}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Subscription Card ──────────────────────────────────────────────────────────
function SubscriptionCard({ sub, onRotate }) {
  const [showKeys, setShowKeys] = useState(false);
  const [rotating, setRotating] = useState(false);
  const pct = sub.monthly_limit > 0
    ? Math.min(100, Math.round((sub.requests_this_month / sub.monthly_limit) * 100))
    : 0;

  async function rotate() {
    setRotating(true);
    try { await onRotate(sub.id); } finally { setRotating(false); }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="font-bold text-gray-900">{sub.api_name}</div>
          <div className="text-xs text-gray-400">{sub.api_category}</div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={TIERS_META[sub.tier]?.color || 'gray'}>{TIERS_META[sub.tier]?.icon} {sub.tier_label}</Badge>
          <Badge color={sub.status === 'active' ? 'green' : 'red'}>{sub.status}</Badge>
        </div>
      </div>

      {/* Usage bar */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Monthly Usage</span>
          <span>{sub.requests_this_month.toLocaleString()} / {sub.monthly_limit === -1 ? '∞' : sub.monthly_limit.toLocaleString()}</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{
            width: `${sub.monthly_limit === -1 ? 10 : pct}%`,
            background: pct > 80 ? '#ef4444' : pct > 60 ? '#f59e0b' : GREEN,
          }} />
        </div>
        {pct > 80 && sub.monthly_limit !== -1 && (
          <div className="text-xs text-red-500 mt-1 flex items-center gap-1">
            <FiAlertCircle size={11} /> Approaching limit — consider upgrading
          </div>
        )}
      </div>

      {/* API Keys */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-600">API Keys</span>
          <button onClick={() => setShowKeys(!showKeys)} className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
            {showKeys ? <FiEyeOff size={12} /> : <FiEye size={12} />}
            {showKeys ? 'Hide' : 'Show'}
          </button>
        </div>
        <div className="bg-gray-900 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-400 w-16 flex-shrink-0">Production</span>
            <code className="flex-1 text-xs text-gray-300 font-mono truncate">
              {showKeys ? sub.production_key : (sub.key_prefix || '••••••••••••••••')}
            </code>
            {showKeys && <CopyBtn text={sub.production_key} />}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-yellow-400 w-16 flex-shrink-0">Sandbox</span>
            <code className="flex-1 text-xs text-gray-300 font-mono truncate">
              {showKeys ? sub.sandbox_key : '••••••••••••••••'}
            </code>
            {showKeys && <CopyBtn text={sub.sandbox_key} />}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button onClick={rotate} disabled={rotating}
          className="flex items-center gap-1.5 text-xs text-amber-600 border border-amber-200 px-3 py-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50">
          {rotating ? <Spinner size={12} /> : <FiRefreshCw size={12} />} Rotate Keys
        </button>
        <span className="text-xs text-gray-400 self-center">
          Subscribed {new Date(sub.started_at).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// ── Publish API Form ───────────────────────────────────────────────────────────
function PublishAPIForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: '', slug: '', short_description: '', description: '',
    category: 'messaging', base_url: '', sandbox_url: '', docs_url: '',
    version: '1.0.0', tags: '',
  });
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(false);
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        endpoints,
      };
      const res = await api.post('/biz-api/products', payload);
      toast.success(`"${res.data.product.name}" published!`);
      onSuccess(res.data.product);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to publish API');
    } finally {
      setLoading(false);
    }
  }

  function addEndpoint() {
    setEndpoints(e => [...e, { method: 'GET', path: '/', summary: '', required_tier: 'free' }]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 text-sm text-purple-700">
        <strong className="block mb-1">💡 API Marketplace</strong>
        Sell your API to developers worldwide. You earn 70% of every subscription. Subscribers get instant sandbox + production keys.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">API Name *</label>
          <input required value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. VerifyPro SMS API"
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Slug (URL identifier) *</label>
          <input required value={form.slug} onChange={e => f('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            placeholder="verifypro-sms" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
          <select value={form.category} onChange={e => f('category', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]">
            {API_CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Version</label>
          <input value={form.version} onChange={e => f('version', e.target.value)}
            placeholder="1.0.0" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Production Base URL</label>
          <input type="url" value={form.base_url} onChange={e => f('base_url', e.target.value)}
            placeholder="https://api.yourdomain.com/v1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Sandbox Base URL</label>
          <input type="url" value={form.sandbox_url} onChange={e => f('sandbox_url', e.target.value)}
            placeholder="https://sandbox.yourdomain.com/v1" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Docs URL</label>
          <input type="url" value={form.docs_url} onChange={e => f('docs_url', e.target.value)}
            placeholder="https://docs.yourdomain.com" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Tags</label>
          <input value={form.tags} onChange={e => f('tags', e.target.value)}
            placeholder="sms, verification, otp" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Short Description *</label>
        <input required value={form.short_description} onChange={e => f('short_description', e.target.value)} maxLength={500}
          placeholder="One-line pitch for your API" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Full Description</label>
        <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={4}
          placeholder="Detailed description, use cases, features..." className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366] resize-none" />
      </div>

      {/* Endpoints */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">API Endpoints</label>
          <button type="button" onClick={addEndpoint}
            className="text-xs font-semibold text-[#075E54] border border-[#075E54] px-3 py-1 rounded-lg hover:bg-green-50">
            + Add Endpoint
          </button>
        </div>
        {endpoints.map((ep, i) => (
          <div key={i} className="flex flex-wrap gap-2 mt-2 p-3 bg-gray-50 rounded-xl">
            <select value={ep.method} onChange={e => setEndpoints(eps => eps.map((x, j) => j === i ? { ...x, method: e.target.value } : x))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input placeholder="/path" value={ep.path} onChange={e => setEndpoints(eps => eps.map((x, j) => j === i ? { ...x, path: e.target.value } : x))}
              className="flex-1 min-w-24 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-mono" />
            <input placeholder="Summary" value={ep.summary} onChange={e => setEndpoints(eps => eps.map((x, j) => j === i ? { ...x, summary: e.target.value } : x))}
              className="flex-1 min-w-32 px-3 py-1.5 border border-gray-200 rounded-lg text-sm" />
            <select value={ep.required_tier} onChange={e => setEndpoints(eps => eps.map((x, j) => j === i ? { ...x, required_tier: e.target.value } : x))}
              className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              {['free', 'starter', 'professional', 'enterprise'].map(t => <option key={t}>{t}</option>)}
            </select>
            <button type="button" onClick={() => setEndpoints(eps => eps.filter((_, j) => j !== i))} className="text-red-400">
              <FiX />
            </button>
          </div>
        ))}
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-4 bg-[#075E54] text-white rounded-2xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><Spinner size={18} /> Publishing...</> : '🚀 Publish API to Marketplace'}
      </button>
    </form>
  );
}

// ── Earnings Panel ─────────────────────────────────────────────────────────────
function EarningsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/biz-api/earnings')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Spinner size={28} /></div>;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#075E54] to-[#128C7E] rounded-2xl p-6 text-white">
        <div className="text-sm opacity-80 mb-1">Total API Earnings</div>
        <div className="text-3xl font-bold">${(data.total_earned||0).toFixed(2)}</div>
        <div className="text-sm opacity-70 mt-1">${(data.pending||0).toFixed(2)} pending · ${(data.available||0).toFixed(2)} available</div>
      </div>

      <div className="bg-green-50 rounded-xl p-4 text-sm text-green-700">
        <strong>70/30 Revenue Split:</strong> You keep 70% of every subscription payment. Platform takes 30%.
      </div>

      {data.earnings?.length > 0 ? (
        <div className="space-y-2">
          {data.earnings.map(e => (
            <div key={e.id} className="bg-white rounded-xl p-4 border border-gray-100 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-800">${e.gross_amount.toFixed(2)} subscription</div>
                <div className="text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">+${e.net_amount.toFixed(2)}</div>
                <div className="text-xs text-gray-400">-${e.platform_fee.toFixed(2)} fee</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-gray-400">
          <FiDollarSign size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No earnings yet</p>
          <p className="text-sm mt-1">Publish an API to start earning</p>
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function BusinessAPIPage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('marketplace');
  const [products, setProducts] = useState([]);
  const [tiers, setTiers] = useState({});
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const loadProducts = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 20 };
      if (category !== 'All') params.category = category;
      if (search) params.search = search;
      const res = await api.get('/biz-api/products', { params });
      setProducts(res.data.products || []);
      setTiers(res.data.tiers || {});
      setTotal(res.data.total || 0);
      setPage(p);
    } catch { setProducts([]); }
    setLoading(false);
  }, [category, search]);

  const loadSubscriptions = useCallback(async () => {
    try {
      const res = await api.get('/biz-api/subscriptions');
      setSubscriptions(res.data.subscriptions || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (tab === 'marketplace') loadProducts(1);
    if (tab === 'subscriptions') loadSubscriptions();
  }, [tab, loadProducts, loadSubscriptions]);

  async function handleSubscribe(productId, tier) {
    try {
      const res = await api.post(`/biz-api/products/${productId}/subscribe`, { tier });
      toast.success(`Subscribed! Your API keys are ready.`);
      setSelectedProduct(null);
      loadSubscriptions();
      loadProducts(page);
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 402) {
        // Paid tier — redirect to Stripe
        try {
          const res2 = await api.post(`/biz-api/products/${productId}/subscribe/stripe`, { tier });
          if (res2.data.checkout_url) window.open(res2.data.checkout_url, '_blank');
        } catch { toast.error('Payment setup failed'); }
      } else {
        toast.error(errData?.error || 'Subscription failed');
      }
    }
  }

  async function rotateKeys(subId) {
    try {
      const res = await api.post(`/biz-api/subscriptions/${subId}/rotate-keys`);
      setSubscriptions(subs => subs.map(s => s.id === subId
        ? { ...s, production_key: res.data.production_key, sandbox_key: res.data.sandbox_key }
        : s
      ));
      toast.success('Keys rotated! Update your apps.');
    } catch { toast.error('Failed to rotate keys'); }
  }

  const mySubMap = Object.fromEntries(subscriptions.map(s => [s.api_product_id, s]));

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <FiCode size={22} />
          <div className="flex-1">
            <div className="font-bold text-lg leading-tight">Business API Platform</div>
            <div className="text-xs opacity-75">Sell & Subscribe to APIs · 70% Revenue Share · Instant Keys</div>
          </div>
          {total > 0 && tab === 'marketplace' && (
            <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{total} APIs</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 flex overflow-x-auto flex-shrink-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${tab === t.id ? 'border-[#25D366] text-[#075E54]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Marketplace */}
        {tab === 'marketplace' && (
          <div className="p-4 max-w-5xl mx-auto">
            {/* Search */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadProducts(1)}
                  placeholder="Search APIs..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
              </div>
              <button onClick={() => loadProducts(1)} className="w-10 h-10 bg-[#075E54] text-white rounded-xl flex items-center justify-center">
                <FiSearch size={16} />
              </button>
            </div>

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {API_CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCategory(c); loadProducts(1); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition capitalize ${category === c ? 'bg-[#075E54] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}>
                  {c}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size={32} /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FiCode size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No APIs found</p>
                <p className="text-sm mt-1">Be the first to publish an API!</p>
                <button onClick={() => setTab('publish')} className="mt-4 px-5 py-2 bg-[#075E54] text-white rounded-xl font-semibold text-sm">
                  Publish Your API
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map(p => (
                  <APICard key={p.id} product={p} onView={setSelectedProduct} mySubscription={mySubMap[p.id]} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* My subscriptions */}
        {tab === 'subscriptions' && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="font-bold text-lg text-gray-900 mb-4">My API Subscriptions</h2>
            {subscriptions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FiKey size={40} className="mx-auto mb-3 opacity-30" />
                <p>No active subscriptions</p>
                <button onClick={() => setTab('marketplace')} className="mt-4 px-5 py-2 bg-[#075E54] text-white rounded-xl text-sm font-semibold">
                  Browse APIs
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {subscriptions.map(s => (
                  <SubscriptionCard key={s.id} sub={s} onRotate={rotateKeys} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Publish */}
        {tab === 'publish' && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="font-bold text-lg text-gray-900 mb-1">Publish Your API</h2>
            <p className="text-sm text-gray-500 mb-5">List your API on the marketplace. Earn 70% of every subscription.</p>
            <PublishAPIForm onSuccess={p => { setTab('marketplace'); loadProducts(1); }} />
          </div>
        )}

        {/* Earnings */}
        {tab === 'earnings' && (
          <div className="p-4 max-w-lg mx-auto">
            <h2 className="font-bold text-lg text-gray-900 mb-4">API Earnings</h2>
            <EarningsPanel />
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <APIProductDetail
            product={selectedProduct}
            tiers={tiers}
            onClose={() => setSelectedProduct(null)}
            onSubscribe={handleSubscribe}
            mySubscription={mySubMap[selectedProduct.id]}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
