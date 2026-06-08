import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiArrowLeft, FiZap, FiPlus, FiBarChart2, FiEye,
  FiMousePointer, FiDollarSign, FiClock, FiCheck,
  FiX, FiAlertCircle, FiTrendingUp, FiImage, FiGlobe,
  FiRefreshCw,
} from 'react-icons/fi';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-gray-100 text-gray-600',
  completed: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-600',
};

const STATUS_ICONS = {
  pending: FiClock,
  active: FiCheck,
  paused: FiClock,
  completed: FiCheck,
  rejected: FiAlertCircle,
};

// ── Campaign Card ────────────────────────────────────────────────────────────
function CampaignCard({ campaign, onAnalytics }) {
  const StatusIcon = STATUS_ICONS[campaign.status] || FiClock;
  const ctr = campaign.impressions > 0
    ? ((campaign.clicks / campaign.impressions) * 100).toFixed(2)
    : '0.00';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 truncate">{campaign.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{campaign.ad_copy}</p>
        </div>
        <span className={`ml-3 flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full flex-shrink-0 ${STATUS_COLORS[campaign.status] || 'bg-gray-100 text-gray-500'}`}>
          <StatusIcon size={11} />
          {campaign.status}
        </span>
      </div>

      {campaign.status === 'rejected' && campaign.rejection_reason && (
        <div className="mb-3 p-3 bg-red-50 rounded-xl text-xs text-red-700">
          <strong>Rejected:</strong> {campaign.rejection_reason}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { icon: FiEye, label: 'Impressions', value: (campaign.impressions || 0).toLocaleString() },
          { icon: FiMousePointer, label: 'Clicks', value: (campaign.clicks || 0).toLocaleString() },
          { icon: FiTrendingUp, label: 'CTR', value: `${ctr}%` },
          { icon: FiDollarSign, label: 'Spent', value: `$${(campaign.budget_spent || 0).toFixed(2)}` },
        ].map(s => (
          <div key={s.label} className="text-center">
            <s.icon size={14} className="mx-auto mb-1 text-gray-400" />
            <p className="font-bold text-gray-900 text-sm">{s.value}</p>
            <p className="text-[10px] text-gray-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Budget progress */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Budget used</span>
          <span>${(campaign.budget_spent || 0).toFixed(2)} / ${campaign.budget_total}</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#25D366] rounded-full transition-all"
            style={{ width: `${Math.min(100, ((campaign.budget_spent || 0) / campaign.budget_total) * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        {campaign.payment_status === 'unpaid' && (
          <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2.5 py-1.5 rounded-lg font-medium">
            <FiDollarSign size={12} /> Payment pending
          </span>
        )}
        <button
          onClick={() => onAnalytics(campaign.id)}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[#075E54] bg-[#075E54]/10 hover:bg-[#075E54]/20 px-3 py-1.5 rounded-lg transition"
        >
          <FiBarChart2 size={13} /> Analytics
        </button>
      </div>
    </motion.div>
  );
}

// ── Analytics Modal ───────────────────────────────────────────────────────────
function AnalyticsModal({ campaignId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data: d } = await api.get(`/ads/analytics/${campaignId}`);
        setData(d);
      } catch { toast.error('Failed to load analytics'); onClose(); }
      finally { setLoading(false); }
    })();
  }, [campaignId]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{data?.campaign?.title || 'Campaign Analytics'}</h3>
            <button onClick={onClose} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition">
              <FiX size={16} />
            </button>
          </div>
          {data && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {[
                { label: 'Total Impressions', value: (data.total_impressions || 0).toLocaleString() },
                { label: 'Total Clicks', value: (data.total_clicks || 0).toLocaleString() },
                { label: 'CTR', value: `${data.ctr || 0}%` },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <p className="text-xl font-bold">{s.value}</p>
                  <p className="text-white/70 text-xs">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: FiDollarSign, label: 'Budget Spent', value: `$${(data.budget_spent || 0).toFixed(2)}`, color: 'text-green-600' },
                { icon: FiDollarSign, label: 'Budget Remaining', value: `$${(data.budget_remaining || 0).toFixed(2)}`, color: 'text-gray-700' },
                { icon: FiTrendingUp, label: 'Skip Rate', value: `${data.skip_rate || 0}%`, color: 'text-amber-600' },
                { icon: FiAlertCircle, label: 'Reports', value: data.reports || 0, color: data.reports > 0 ? 'text-red-600' : 'text-gray-500' },
              ].map(s => (
                <div key={s.label} className="bg-gray-50 rounded-xl p-4">
                  <s.icon size={16} className={`${s.color} mb-1`} />
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Daily chart */}
            {data.daily_impressions?.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-3 text-sm">Daily Impressions</h4>
                <div className="flex items-end gap-1 h-20">
                  {data.daily_impressions.map((d, i) => {
                    const max = Math.max(...data.daily_impressions.map(x => x.count), 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count}`}>
                        <div className="w-full bg-[#25D366]/80 rounded-t-sm"
                          style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

// ── Create Campaign Form ──────────────────────────────────────────────────────
function CreateCampaignForm({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '',
    ad_copy: '',
    cta_text: 'Learn More',
    cta_url: '',
    creative_url: '',
    creative_type: 'image',
    sponsor_name: '',
    budget_total: 10,
    daily_budget: 5,
    duration_days: 7,
    target_audience: 'all',
    target_country: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.ad_copy.trim()) {
      toast.error('Title and ad copy are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/ads/campaigns', form);
      if (data.checkout_url) {
        toast.success('Campaign created! Redirecting to payment…');
        setTimeout(() => { window.location.href = data.checkout_url; }, 1200);
      } else {
        toast.success('Campaign submitted for review!');
      }
      onCreated();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-lg">New Ad Campaign</h3>
              <p className="text-white/70 text-sm">Step {step} of 2</p>
            </div>
            <button onClick={onClose} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition">
              <FiX size={16} />
            </button>
          </div>
          <div className="flex gap-2 mt-4">
            {[1, 2].map(s => (
              <div key={s} className={`flex-1 h-1 rounded-full ${s <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Campaign Title *</label>
                <input
                  value={form.title} onChange={e => update('title', e.target.value)}
                  placeholder="e.g. Summer Sale 2026"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Ad Copy / Message *</label>
                <textarea
                  value={form.ad_copy} onChange={e => update('ad_copy', e.target.value)}
                  placeholder="Write a compelling ad message..."
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition resize-none"
                  rows={3} maxLength={500}
                />
                <p className="text-xs text-gray-400 mt-1">{500 - form.ad_copy.length} chars remaining</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">CTA Button Text</label>
                  <input
                    value={form.cta_text} onChange={e => update('cta_text', e.target.value)}
                    placeholder="Learn More"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Brand Name</label>
                  <input
                    value={form.sponsor_name} onChange={e => update('sponsor_name', e.target.value)}
                    placeholder="Your Brand"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">CTA Link (https://)</label>
                <input
                  type="url" value={form.cta_url} onChange={e => update('cta_url', e.target.value)}
                  placeholder="https://yourwebsite.com"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  <FiImage size={11} className="inline mr-1" />
                  Creative Image URL (optional)
                </label>
                <input
                  type="url" value={form.creative_url} onChange={e => update('creative_url', e.target.value)}
                  placeholder="https://example.com/banner.jpg"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                />
                {form.creative_url && (
                  <img src={form.creative_url} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-xl"
                    onError={e => { e.target.style.display = 'none'; }} />
                )}
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                    <FiDollarSign size={11} className="inline" /> Total Budget ($)
                  </label>
                  <input
                    type="number" min={1} max={100000} value={form.budget_total}
                    onChange={e => update('budget_total', parseFloat(e.target.value) || 10)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Daily Budget ($)</label>
                  <input
                    type="number" min={1} value={form.daily_budget}
                    onChange={e => update('daily_budget', parseFloat(e.target.value) || 5)}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Campaign Duration (days)</label>
                <input
                  type="number" min={1} max={90} value={form.duration_days}
                  onChange={e => update('duration_days', parseInt(e.target.value) || 7)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  <FiGlobe size={11} className="inline mr-1" />Target Audience
                </label>
                <select value={form.target_audience} onChange={e => update('target_audience', e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition bg-white">
                  <option value="all">All Users</option>
                  <option value="contacts">Contacts Only</option>
                  <option value="country">By Country</option>
                </select>
              </div>
              {form.target_audience === 'country' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Target Country</label>
                  <input
                    value={form.target_country} onChange={e => update('target_country', e.target.value)}
                    placeholder="e.g. Nigeria, United States"
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] transition"
                  />
                </div>
              )}

              {/* Summary */}
              <div className="bg-gray-50 rounded-2xl p-4 space-y-2">
                <h4 className="font-semibold text-gray-800 text-sm">Campaign Summary</h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total Budget</span>
                  <span className="font-bold text-gray-900">${form.budget_total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Duration</span>
                  <span className="font-bold text-gray-900">{form.duration_days} days</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Est. daily impressions</span>
                  <span className="font-bold text-gray-900">~{Math.floor((form.daily_budget / 0.002)).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-400 pt-1">
                  After submission, your campaign will be reviewed by our team before going live. Payment is collected at checkout.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="px-6 pb-6 flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">
              Back
            </button>
          )}
          {step < 2 ? (
            <button
              onClick={() => {
                if (!form.title.trim() || !form.ad_copy.trim()) {
                  toast.error('Title and ad copy are required');
                  return;
                }
                setStep(2);
              }}
              className="flex-1 py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white rounded-xl text-sm font-semibold transition"
            >
              Next →
            </button>
          ) : (
            <button onClick={submit} disabled={submitting}
              className="flex-1 py-3 bg-[#25D366] hover:bg-[#1fbd5a] disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
              {submitting
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Submitting…</>
                : <><FiZap size={15} /> Launch Campaign</>}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Main AdvertisePage ────────────────────────────────────────────────────────
function AdvertisePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [analyticsId, setAnalyticsId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const canAdvertise = user?.badge_verified || user?.is_admin;

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try {
      const { data } = await api.get('/ads/campaigns');
      setCampaigns(data.campaigns || []);
    } catch { setCampaigns([]); }
    finally { setLoading(false); }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadCampaigns();
    setRefreshing(false);
  };

  const totalImpressions = campaigns.reduce((s, c) => s + (c.impressions || 0), 0);
  const totalClicks = campaigns.reduce((s, c) => s + (c.clicks || 0), 0);
  const totalSpent = campaigns.reduce((s, c) => s + (c.budget_spent || 0), 0);
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;

  if (!canAdvertise) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
        <div className="bg-white border-b px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition">
            <FiArrowLeft size={20} className="text-gray-700" />
          </button>
          <h1 className="font-bold text-gray-900">Advertise</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div className="w-20 h-20 rounded-2xl bg-[#075E54]/10 flex items-center justify-center mx-auto mb-5">
              <FiZap size={36} className="text-[#075E54]" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Advertise on VipChat</h2>
            <p className="text-gray-500 mb-6">
              Get a verified badge to unlock Status Ads and reach millions of active VipChat users.
            </p>
            <button
              onClick={() => navigate('/subscription')}
              className="w-full py-3 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-2xl transition"
            >
              Get Verified
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full py-3 text-gray-500 font-medium mt-2"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f2f5] flex flex-col">
      {/* Header */}
      <div className="bg-[#075E54] text-white">
        <div className="flex items-center gap-3 px-4 pt-12 pb-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-full transition">
            <FiArrowLeft size={20} className="text-white" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Advertise on VipChat</h1>
            <p className="text-white/70 text-xs">Status Ads · Sponsor Portal</p>
          </div>
          <button onClick={refresh} disabled={refreshing} className="p-2 hover:bg-white/10 rounded-full transition">
            <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <FiRefreshCw size={16} className="text-white" />
            </motion.div>
          </button>
        </div>

        {/* Stats banner */}
        {campaigns.length > 0 && (
          <div className="grid grid-cols-4 gap-px bg-white/10 border-t border-white/10">
            {[
              { label: 'Active', value: activeCampaigns },
              { label: 'Impressions', value: totalImpressions.toLocaleString() },
              { label: 'Clicks', value: totalClicks.toLocaleString() },
              { label: 'Spent', value: `$${totalSpent.toFixed(0)}` },
            ].map(s => (
              <div key={s.label} className="bg-white/5 px-3 py-3 text-center">
                <p className="font-bold text-base">{s.value}</p>
                <p className="text-white/60 text-[10px]">{s.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Create button */}
        <button
          onClick={() => setShowCreate(true)}
          className="w-full py-4 bg-[#25D366] hover:bg-[#1fbd5a] text-white font-bold rounded-2xl transition flex items-center justify-center gap-2 mb-5 shadow-sm"
        >
          <FiPlus size={18} /> Create New Campaign
        </button>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center mx-auto mb-4 shadow-sm">
              <FiBarChart2 size={28} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">No campaigns yet</p>
            <p className="text-sm text-gray-400">Create your first ad campaign to start reaching VipChat users.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-800">{campaigns.length} Campaign{campaigns.length !== 1 ? 's' : ''}</h2>
            </div>
            {campaigns.map(c => (
              <CampaignCard key={c.id} campaign={c} onAnalytics={setAnalyticsId} />
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="mt-8 bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-4">How Status Ads Work</h3>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Create your campaign with ad copy, creative, and budget' },
              { step: '2', text: 'Pay your budget via secure Stripe checkout' },
              { step: '3', text: 'Our team reviews and approves your campaign within 24h' },
              { step: '4', text: 'Your ad appears every 5 statuses in the viewer feed (max 2/user/day)' },
              { step: '5', text: 'Track real-time impressions, clicks, and CTR in analytics' },
            ].map(s => (
              <div key={s.step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-[#25D366] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{s.step}</span>
                </div>
                <p className="text-sm text-gray-600">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateCampaignForm
            onClose={() => setShowCreate(false)}
            onCreated={loadCampaigns}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {analyticsId && (
          <AnalyticsModal
            campaignId={analyticsId}
            onClose={() => setAnalyticsId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdvertisePage;
