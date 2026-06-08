import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiPlus, FiSearch, FiUpload, FiDownload, FiStar,
  FiX, FiMessageCircle, FiPackage, FiFilter, FiGrid, FiList,
  FiDollarSign, FiTag, FiChevronLeft, FiChevronRight, FiHeart,
  FiShare2, FiCheck, FiArrowLeft, FiSend, FiEye, FiTrendingUp,
  FiBarChart2, FiZap, FiBriefcase, FiLayers, FiRefreshCw,
  FiAward, FiAlertCircle, FiRadio, FiTarget, FiClock,
  FiGlobe, FiBox, FiActivity, FiUsers, FiPercent, FiChevronDown,
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

// ── Constants ──────────────────────────────────────────────────────────────────
const CATEGORIES = ['All', 'Digital Art', 'Templates', 'Music', 'Videos', 'eBooks', 'Software', 'Courses', 'Photos', 'Other'];
const B2B_INDUSTRIES = ['Manufacturing', 'Technology', 'Agriculture', 'Healthcare', 'Construction', 'Textiles', 'Food & Beverage', 'Electronics', 'Automotive', 'Other'];
const B2B_CATEGORIES = ['Raw Materials', 'Components & Parts', 'Finished Goods', 'Equipment & Machinery', 'Office Supplies', 'Software & SaaS', 'Professional Services', 'Wholesale Products', 'Other'];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
];
const TABS = [
  { id: 'discover', label: 'Discover', icon: FiGrid },
  { id: 'b2b', label: 'B2B Trade', icon: FiBriefcase },
  { id: 'mystore', label: 'My Store', icon: FiPackage },
  { id: 'analytics', label: 'Analytics', icon: FiBarChart2 },
  { id: 'ads', label: 'Ad Campaigns', icon: FiRadio },
];

const STAR_COLOR = '#f59e0b';
const GREEN = '#25D366';

// ── Helpers ─────────────────────────────────────────────────────────────────
function fmt(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
function fmtMoney(n) { return `$${Number(n || 0).toFixed(2)}`; }

function StarRow({ rating, size = 14 }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <FiStar key={i} size={size}
          fill={i <= Math.round(rating) ? STAR_COLOR : 'none'}
          stroke={i <= Math.round(rating) ? STAR_COLOR : '#d1d5db'}
        />
      ))}
    </div>
  );
}

function FileIcon({ type }) {
  const m = { pdf:'📄', zip:'🗜️', mp3:'🎵', mp4:'🎬', mov:'🎬', png:'🖼️', jpg:'🖼️', jpeg:'🖼️', gif:'🖼️', webp:'🖼️', avi:'🎬', docx:'📝', epub:'📚' };
  return <span className="text-2xl">{m[type?.toLowerCase()] || '📦'}</span>;
}

function Spinner() {
  return <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />;
}

function Badge({ children, color = 'green' }) {
  const colors = { green:'bg-green-100 text-green-700', blue:'bg-blue-100 text-blue-700', purple:'bg-purple-100 text-purple-700', amber:'bg-amber-100 text-amber-700', red:'bg-red-100 text-red-700', gray:'bg-gray-100 text-gray-600' };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colors[color]||colors.gray}`}>{children}</span>;
}

function StatCard({ icon: Icon, label, value, sub, color = '#075E54' }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: color + '15' }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-xl font-bold text-gray-900">{value}</div>
        {sub && <div className="text-xs text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

function MiniBarChart({ data, field = 'revenue', color = GREEN }) {
  if (!data?.length) return <div className="h-24 flex items-center justify-center text-gray-400 text-sm">No data</div>;
  const max = Math.max(...data.map(d => d[field] || 0), 1);
  return (
    <div className="flex items-end gap-0.5 h-24 w-full">
      {data.slice(-30).map((d, i) => (
        <div key={i} className="flex-1 min-w-0 flex flex-col items-center" title={`${d.date}: ${d[field]}`}>
          <div className="w-full rounded-t" style={{ height: `${Math.max(2, ((d[field] || 0) / max) * 96)}%`, background: color, opacity: 0.7 + (i / data.length) * 0.3 }} />
        </div>
      ))}
    </div>
  );
}

// ── Ad Banner ──────────────────────────────────────────────────────────────────
function AdBanner({ ad }) {
  const handleClick = useCallback(async () => {
    try { await api.post(`/marketplace/ads/${ad.id}/click`); } catch {}
    if (ad.cta_url) window.open(ad.cta_url, '_blank', 'noopener,noreferrer');
  }, [ad]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative rounded-2xl overflow-hidden cursor-pointer group shadow-sm"
      style={{ background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)' }}
      onClick={handleClick}
    >
      {ad.image_url && (
        <img src={ad.image_url} alt={ad.title} className="absolute inset-0 w-full h-full object-cover opacity-20" />
      )}
      <div className="relative z-10 flex items-center justify-between p-4 gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge color="amber">Sponsored</Badge>
          </div>
          <div className="font-bold text-white text-sm truncate">{ad.title}</div>
          {ad.description && <div className="text-green-100 text-xs mt-0.5 line-clamp-1">{ad.description}</div>}
        </div>
        <button className="flex-shrink-0 bg-white text-[#075E54] text-xs font-bold px-3 py-1.5 rounded-xl hover:bg-green-50 transition whitespace-nowrap">
          {ad.cta_text || 'View'}
        </button>
      </div>
    </motion.div>
  );
}

// ── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({ product, onView, onWishlist, wishlisted, isPromoted }) {
  const [wishLoading, setWishLoading] = useState(false);
  const toggleWish = async (e) => {
    e.stopPropagation();
    setWishLoading(true);
    await onWishlist(product.id, wishlisted);
    setWishLoading(false);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group border ${isPromoted ? 'border-amber-200 ring-1 ring-amber-200' : 'border-gray-100'}`}
      onClick={() => onView(product)}
    >
      <div className="aspect-video bg-gradient-to-br from-gray-50 to-gray-100 relative overflow-hidden">
        {product.preview_url || product.thumbnail_url ? (
          <img src={product.preview_url || product.thumbnail_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileIcon type={product.file_type} />
          </div>
        )}
        {isPromoted && (
          <div className="absolute top-2 left-2">
            <Badge color="amber">⚡ Featured</Badge>
          </div>
        )}
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
          <button onClick={toggleWish} disabled={wishLoading}
            className={`w-7 h-7 rounded-full flex items-center justify-center shadow ${wishlisted ? 'bg-red-500 text-white' : 'bg-white text-gray-400 hover:text-red-500'}`}>
            {wishLoading ? <Spinner /> : <FiHeart size={13} fill={wishlisted ? 'white' : 'none'} />}
          </button>
        </div>
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-sm truncate">{product.title}</div>
            <div className="text-xs text-gray-400 mt-0.5 truncate">{product.category} · by {product.seller_name}</div>
          </div>
          {product.seller_verified && <FiAward size={14} className="text-blue-500 flex-shrink-0 mt-0.5" title="Verified" />}
        </div>
        <div className="flex items-center gap-2 mt-2">
          {product.rating_count > 0 ? (
            <StarRow rating={product.rating_avg} size={11} />
          ) : <span className="text-xs text-gray-300">No reviews</span>}
          {product.rating_count > 0 && <span className="text-xs text-gray-400">({product.rating_count})</span>}
        </div>
        <div className="flex items-center justify-between mt-2">
          <div className="font-bold text-[#075E54]">
            {product.is_free ? <span className="text-green-600">Free</span> : fmtMoney(product.price)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <FiDownload size={11} />{fmt(product.download_count || 0)}
            <FiEye size={11} className="ml-1" />{fmt(product.view_count || 0)}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── B2B Listing Card ──────────────────────────────────────────────────────────
function B2BCard({ listing, onView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer p-4"
      onClick={() => onView(listing)}
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center flex-shrink-0">
          <FiBriefcase size={22} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-gray-900 text-sm truncate">{listing.title}</div>
          <div className="text-xs text-gray-400 mt-0.5">{listing.industry} · {listing.category}</div>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-sm font-bold text-[#075E54]">${listing.unit_price}/unit</span>
            <Badge color="blue">MOQ: {listing.min_order_qty}</Badge>
            {listing.sample_available && <Badge color="green">Sample ✓</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span className="flex items-center gap-1"><FiClock size={11} />{listing.lead_time_days}d lead</span>
            <span className="flex items-center gap-1"><FiEye size={11} />{listing.view_count} views</span>
            <span className="flex items-center gap-1"><FiMessageCircle size={11} />{listing.inquiry_count} inquiries</span>
          </div>
        </div>
        {listing.is_verified && (
          <Badge color="blue">Verified</Badge>
        )}
      </div>
    </motion.div>
  );
}

// ── Product Detail Modal ───────────────────────────────────────────────────────
function ProductModal({ product, onClose, user }) {
  const [buying, setBuying] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviews, setReviews] = useState(product?.reviews || []);

  const handleBuy = async () => {
    if (!user) { toast.error('Please login'); return; }
    setBuying(true);
    try {
      const r = await api.post(`/marketplace/products/${product.id}/purchase`, { payment_provider: 'stripe' });
      if (r.data.checkout_url) {
        window.location.href = r.data.checkout_url;
      } else if (r.data.download_url) {
        window.open(r.data.download_url, '_blank');
        toast.success('Download ready!');
        onClose();
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Purchase failed');
    } finally { setBuying(false); }
  };

  const submitReview = async () => {
    if (!user) { toast.error('Please login'); return; }
    setSubmittingReview(true);
    try {
      await api.post(`/marketplace/products/${product.id}/review`, { rating, comment: reviewText });
      toast.success('Review posted!');
      setReviewText('');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Review failed');
    } finally { setSubmittingReview(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b flex items-center justify-between px-4 py-3 z-10">
          <div className="font-bold text-gray-900 truncate flex-1 mr-2">{product.title}</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200"><FiX size={16} /></button>
        </div>

        <div className="p-4 space-y-4">
          {/* Preview */}
          {(product.preview_url || product.thumbnail_url) ? (
            <img src={product.preview_url || product.thumbnail_url} alt={product.title}
              className="w-full rounded-xl object-cover max-h-64" />
          ) : (
            <div className="w-full h-32 rounded-xl bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
              <FileIcon type={product.file_type} />
            </div>
          )}

          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge color="gray">{product.category}</Badge>
            <Badge color="gray">{product.license_type}</Badge>
            {product.seller_verified && <Badge color="blue">✓ Verified Seller</Badge>}
            {product.file_type && <Badge color="gray">.{product.file_type}</Badge>}
          </div>

          <p className="text-gray-600 text-sm leading-relaxed">{product.description}</p>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: 'Downloads', value: fmt(product.download_count || 0), icon: FiDownload },
              { label: 'Views', value: fmt(product.view_count || 0), icon: FiEye },
              { label: 'Rating', value: product.rating_avg?.toFixed(1) || '—', icon: FiStar },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-2">
                <s.icon size={16} className="mx-auto mb-1 text-gray-400" />
                <div className="font-bold text-gray-900 text-sm">{s.value}</div>
                <div className="text-xs text-gray-400">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tags */}
          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.tags.map((t, i) => <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t}</span>)}
            </div>
          )}

          {/* Purchase */}
          <div className="flex items-center justify-between bg-gradient-to-r from-[#075E54] to-[#25D366] rounded-2xl p-4">
            <div>
              <div className="text-white font-bold text-xl">
                {product.is_free ? 'Free' : fmtMoney(product.price)}
              </div>
              <div className="text-green-100 text-xs">{product.currency || 'USD'}</div>
            </div>
            <button onClick={handleBuy} disabled={buying}
              className="bg-white text-[#075E54] font-bold px-6 py-2.5 rounded-xl hover:bg-green-50 transition flex items-center gap-2">
              {buying ? <Spinner /> : product.is_free ? <><FiDownload size={16} />Download</> : <><FiDollarSign size={16} />Buy Now</>}
            </button>
          </div>

          {/* Reviews */}
          {product.reviews?.length > 0 && (
            <div>
              <div className="font-semibold text-gray-900 mb-3">Reviews ({product.rating_count})</div>
              <div className="space-y-3">
                {product.reviews.slice(0, 5).map(r => (
                  <div key={r.id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-6 h-6 rounded-full bg-[#075E54] text-white text-xs flex items-center justify-center">
                        {r.reviewer_name?.[0] || '?'}
                      </div>
                      <span className="text-xs font-medium text-gray-700">{r.reviewer_name}</span>
                      <StarRow rating={r.rating} size={11} />
                    </div>
                    <p className="text-xs text-gray-600">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Write review */}
          {user && (
            <div className="border-t pt-4">
              <div className="font-semibold text-gray-900 mb-2">Leave a Review</div>
              <div className="flex gap-1 mb-2">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setRating(i)}>
                    <FiStar size={22} fill={i <= rating ? STAR_COLOR : 'none'} stroke={i <= rating ? STAR_COLOR : '#d1d5db'} />
                  </button>
                ))}
              </div>
              <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                placeholder="Share your experience..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                rows={3} />
              <button onClick={submitReview} disabled={submittingReview || !reviewText}
                className="mt-2 w-full bg-[#075E54] text-white font-semibold py-2 rounded-xl hover:bg-[#128C7E] transition flex items-center justify-center gap-2">
                {submittingReview ? <Spinner /> : 'Post Review'}
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── B2B Detail / RFQ Modal ────────────────────────────────────────────────────
function B2BModal({ listing, onClose, user }) {
  const [qty, setQty] = useState(listing?.min_order_qty || 1);
  const [msg, setMsg] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [budget, setBudget] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const sendRFQ = async () => {
    if (!user) { toast.error('Please login'); return; }
    if (!msg.trim()) { toast.error('Please describe your requirements'); return; }
    setSubmitting(true);
    try {
      await api.post(`/marketplace/b2b/listings/${listing.id}/inquire`, {
        quantity: qty, message: msg, contact_email: email, delivery_country: country, budget_range: budget,
      });
      toast.success('RFQ sent to supplier!');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to send inquiry');
    } finally { setSubmitting(false); }
  };

  const bulkPricing = Array.isArray(listing.bulk_pricing) ? listing.bulk_pricing : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto"
      >
        <div className="sticky top-0 bg-white border-b flex items-center justify-between px-4 py-3 z-10">
          <div className="flex items-center gap-2">
            <FiBriefcase size={18} className="text-indigo-600" />
            <span className="font-bold text-gray-900 truncate">{listing.title}</span>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"><FiX size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          {/* Seller */}
          <div className="flex items-center gap-3 bg-blue-50 rounded-xl p-3">
            <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold">
              {listing.seller_name?.[0] || 'S'}
            </div>
            <div>
              <div className="font-semibold text-gray-900">{listing.seller_name}</div>
              <div className="text-xs text-gray-500">{listing.industry} · {listing.category}</div>
            </div>
            {listing.is_verified && <Badge color="blue" className="ml-auto">Verified ✓</Badge>}
          </div>

          <p className="text-gray-600 text-sm">{listing.description}</p>

          {/* Pricing */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-[#075E54]">${listing.unit_price}</div>
              <div className="text-xs text-gray-500">Unit Price</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{listing.min_order_qty}</div>
              <div className="text-xs text-gray-500">Min Order</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-gray-900">{listing.lead_time_days}d</div>
              <div className="text-xs text-gray-500">Lead Time</div>
            </div>
          </div>

          {/* Bulk pricing */}
          {bulkPricing.length > 0 && (
            <div>
              <div className="font-semibold text-gray-900 mb-2 text-sm">Bulk Pricing</div>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs text-gray-500">Qty</th><th className="px-3 py-2 text-right text-xs text-gray-500">Price/Unit</th></tr></thead>
                  <tbody>
                    {bulkPricing.map((t, i) => (
                      <tr key={i} className="border-t"><td className="px-3 py-2">{t.qty}+</td><td className="px-3 py-2 text-right font-medium text-[#075E54]">${t.price}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* RFQ Form */}
          <div className="border-t pt-4 space-y-3">
            <div className="font-semibold text-gray-900">Send Request for Quote (RFQ)</div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Quantity</label>
              <input type="number" min={listing.min_order_qty} value={qty} onChange={e => setQty(+e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Your Requirements *</label>
              <textarea value={msg} onChange={e => setMsg(e.target.value)}
                placeholder="Describe your specifications, delivery requirements, quality standards..."
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Contact Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Delivery Country</label>
                <input type="text" value={country} onChange={e => setCountry(e.target.value)}
                  placeholder="e.g. Uganda" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Budget Range (optional)</label>
              <input type="text" value={budget} onChange={e => setBudget(e.target.value)}
                placeholder="e.g. $5,000 - $20,000" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
            <button onClick={sendRFQ} disabled={submitting || !msg.trim()}
              className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {submitting ? <Spinner /> : <><FiSend size={16} />Send RFQ to Supplier</>}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ── Upload Product Modal ───────────────────────────────────────────────────────
function UploadModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'Other', price: '', tags: '', license_type: 'standard', currency: 'USD' });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();
  const previewRef = useRef();

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    if (!file) { toast.error('Product file is required'); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      if (preview) fd.append('preview', preview);
      await api.post('/marketplace/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Product listed!');
      onSuccess();
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b flex items-center justify-between px-4 py-3 z-10">
          <div className="font-bold text-gray-900">List New Product</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"><FiX size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="Product name" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Description</label>
            <textarea value={form.description} onChange={set('description')} placeholder="Describe your product..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]" rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Category</label>
              <select value={form.category} onChange={set('category')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]">
                {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Price (USD)</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={set('price')} placeholder="0 = Free"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Tags (comma-separated)</label>
            <input value={form.tags} onChange={set('tags')} placeholder="design, template, ui-kit"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">License</label>
            <select value={form.license_type} onChange={set('license_type')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]">
              {['standard', 'extended', 'commercial', 'personal'].map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Product File *</label>
            <input type="file" ref={fileRef} onChange={e => setFile(e.target.files[0])} className="hidden" />
            <button onClick={() => fileRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex flex-col items-center gap-2 hover:border-[#25D366] transition text-sm text-gray-400">
              <FiUpload size={22} />
              {file ? <span className="text-[#075E54] font-medium">{file.name}</span> : 'Click to upload file'}
            </button>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Preview Image (optional)</label>
            <input type="file" ref={previewRef} accept="image/*" onChange={e => setPreview(e.target.files[0])} className="hidden" />
            <button onClick={() => previewRef.current?.click()} className="w-full border-2 border-dashed border-gray-200 rounded-xl py-3 flex items-center justify-center gap-2 hover:border-[#25D366] transition text-sm text-gray-400">
              <FiGrid size={16} />
              {preview ? preview.name : 'Add preview image'}
            </button>
          </div>
          <button onClick={submit} disabled={uploading}
            className="w-full bg-[#075E54] text-white font-semibold py-3 rounded-xl hover:bg-[#128C7E] transition flex items-center justify-center gap-2">
            {uploading ? <Spinner /> : <><FiUpload size={16} />List Product</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Create Ad Modal ────────────────────────────────────────────────────────────
function CreateAdModal({ myProducts, onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', cta_text: 'View Product', cta_url: '', ad_type: 'featured', placement: 'homepage', budget_total: '10', bid_cpm: '2.0', billing_type: 'cpm', product_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    setSubmitting(true);
    try {
      const r = await api.post('/marketplace/ads', { ...form, budget_total: parseFloat(form.budget_total), bid_cpm: parseFloat(form.bid_cpm) });
      if (r.data.checkout_url) { window.location.href = r.data.checkout_url; }
      else { toast.success('Ad campaign created!'); onSuccess(); onClose(); }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b flex items-center justify-between px-4 py-3 z-10">
          <div className="font-bold text-gray-900 flex items-center gap-2"><FiRadio size={18} className="text-amber-500" />Create Ad Campaign</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"><FiX size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Ad Title *</label><input value={form.title} onChange={set('title')} placeholder="Grab attention with a strong headline" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Description</label><textarea value={form.description} onChange={set('description')} rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
          {myProducts.length > 0 && <div><label className="text-xs text-gray-500 mb-1 block">Link to Product (optional)</label><select value={form.product_id} onChange={set('product_id')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="">No product</option>{myProducts.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select></div>}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Placement</label><select value={form.placement} onChange={set('placement')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="homepage">Homepage</option><option value="category">Category</option><option value="search">Search Results</option><option value="sidebar">Sidebar</option></select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Ad Type</label><select value={form.ad_type} onChange={set('ad_type')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"><option value="featured">Featured</option><option value="banner">Banner</option><option value="sidebar">Sidebar</option><option value="spotlight">Spotlight</option></select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Total Budget ($)</label><input type="number" min="1" step="1" value={form.budget_total} onChange={set('budget_total')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">CPM Bid ($)</label><input type="number" min="0.1" step="0.1" value={form.bid_cpm} onChange={set('bid_cpm')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
          </div>
          <div><label className="text-xs text-gray-500 mb-1 block">CTA Button Text</label><input value={form.cta_text} onChange={set('cta_text')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Destination URL</label><input value={form.cta_url} onChange={set('cta_url')} placeholder="https://..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" /></div>
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700">
            Budget will be charged via Stripe. Ads go live after admin approval (usually within 24h).
          </div>
          <button onClick={submit} disabled={submitting}
            className="w-full bg-amber-500 text-white font-semibold py-3 rounded-xl hover:bg-amber-600 transition flex items-center justify-center gap-2">
            {submitting ? <Spinner /> : <><FiZap size={16} />Launch Campaign</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Create B2B Listing Modal ───────────────────────────────────────────────────
function CreateB2BModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ title: '', description: '', category: 'Raw Materials', industry: 'Manufacturing', unit_price: '', min_order_qty: '1', lead_time_days: '7', sample_available: false, sample_price: '0' });
  const [submitting, setSubmitting] = useState(false);
  const set = k => e => setForm(f => ({ ...f, [k]: typeof e === 'object' ? e.target.value : e }));

  const submit = async () => {
    if (!form.title.trim()) { toast.error('Title required'); return; }
    if (!form.unit_price) { toast.error('Unit price required'); return; }
    setSubmitting(true);
    try {
      await api.post('/marketplace/b2b/listings', { ...form, unit_price: parseFloat(form.unit_price), min_order_qty: parseInt(form.min_order_qty), lead_time_days: parseInt(form.lead_time_days), sample_price: parseFloat(form.sample_price || 0) });
      toast.success('B2B listing created!');
      onSuccess();
      onClose();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b flex items-center justify-between px-4 py-3 z-10">
          <div className="font-bold text-gray-900 flex items-center gap-2"><FiBriefcase size={18} className="text-indigo-600" />Create B2B Listing</div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"><FiX size={16} /></button>
        </div>
        <div className="p-4 space-y-3">
          <div><label className="text-xs text-gray-500 mb-1 block">Product/Service Title *</label><input value={form.title} onChange={set('title')} placeholder="e.g. Organic Coffee Beans — Grade A" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
          <div><label className="text-xs text-gray-500 mb-1 block">Description</label><textarea value={form.description} onChange={set('description')} rows={3} placeholder="Specifications, certifications, origin..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Industry</label><select value={form.industry} onChange={set('industry')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">{B2B_INDUSTRIES.map(i => <option key={i}>{i}</option>)}</select></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Category</label><select value={form.category} onChange={set('category')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">{B2B_CATEGORIES.map(c => <option key={c}>{c}</option>)}</select></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 mb-1 block">Unit Price ($) *</label><input type="number" min="0" step="0.01" value={form.unit_price} onChange={set('unit_price')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Min Order Qty</label><input type="number" min="1" value={form.min_order_qty} onChange={set('min_order_qty')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
            <div><label className="text-xs text-gray-500 mb-1 block">Lead Time (days)</label><input type="number" min="1" value={form.lead_time_days} onChange={set('lead_time_days')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.sample_available} onChange={e => setForm(f => ({ ...f, sample_available: e.target.checked }))} className="w-4 h-4" />
            <span className="text-sm text-gray-700">Sample available</span>
          </label>
          {form.sample_available && (
            <div><label className="text-xs text-gray-500 mb-1 block">Sample Price ($)</label><input type="number" min="0" step="0.01" value={form.sample_price} onChange={set('sample_price')} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" /></div>
          )}
          <button onClick={submit} disabled={submitting}
            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-xl hover:bg-indigo-700 transition flex items-center justify-center gap-2">
            {submitting ? <Spinner /> : <><FiPlus size={16} />Create B2B Listing</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════════════════════
export default function MarketplacePage() {
  const { user } = useAuthStore();
  const [tab, setTab] = useState('discover');

  // Discover state
  const [products, setProducts] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [viewMode, setViewMode] = useState('grid');
  const [wishlist, setWishlist] = useState(new Set());
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [globalStats, setGlobalStats] = useState(null);
  const searchTimer = useRef();

  // B2B state
  const [b2bListings, setB2bListings] = useState([]);
  const [b2bPage, setB2bPage] = useState(1);
  const [b2bTotalPages, setB2bTotalPages] = useState(1);
  const [b2bSearch, setB2bSearch] = useState('');
  const [b2bIndustry, setB2bIndustry] = useState('');
  const [b2bCategory, setB2bCategory] = useState('');
  const [selectedB2b, setSelectedB2b] = useState(null);
  const [showCreateB2b, setShowCreateB2b] = useState(false);
  const [loadingB2b, setLoadingB2b] = useState(false);
  const [myInquiries, setMyInquiries] = useState([]);
  const [receivedInquiries, setReceivedInquiries] = useState([]);
  const [b2bSubTab, setB2bSubTab] = useState('browse'); // browse | my-listings | inquiries-received | inquiries-sent
  const [myB2bListings, setMyB2bListings] = useState([]);

  // My Store state
  const [myProducts, setMyProducts] = useState([]);

  // Analytics state
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Ads state
  const [myAds, setMyAds] = useState([]);
  const [showCreateAd, setShowCreateAd] = useState(false);
  const [loadingAds, setLoadingAds] = useState(false);

  // ── Data fetchers ─────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (p = 1, cat = category, s = search, so = sort) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 20, sort: so };
      if (cat && cat !== 'All') params.category = cat;
      if (s) params.search = s;
      const r = await api.get('/marketplace/products', { params });
      setProducts(r.data.products || []);
      setTotalPages(r.data.pages || 1);
    } catch (e) { toast.error('Failed to load products'); }
    finally { setLoading(false); }
  }, [category, search, sort]);

  const fetchFeatured = async () => {
    try {
      const r = await api.get('/marketplace/featured', { params: { limit: 6 } });
      setFeatured(r.data.featured || []);
    } catch {}
  };

  const fetchAdsDisplay = async () => {
    try {
      const r = await api.get('/marketplace/ads', { params: { placement: 'homepage', limit: 3 } });
      setAds(r.data.ads || []);
    } catch {}
  };

  const fetchGlobalStats = async () => {
    try {
      const r = await api.get('/marketplace/analytics/global');
      setGlobalStats(r.data);
    } catch {}
  };

  const fetchWishlist = async () => {
    if (!user) return;
    try {
      const r = await api.get('/marketplace/wishlist');
      setWishlist(new Set((r.data.wishlist || []).map(p => p.id)));
    } catch {}
  };

  const fetchB2bListings = useCallback(async (p = 1) => {
    setLoadingB2b(true);
    try {
      const params = { page: p, per_page: 20 };
      if (b2bSearch) params.search = b2bSearch;
      if (b2bIndustry) params.industry = b2bIndustry;
      if (b2bCategory) params.category = b2bCategory;
      const r = await api.get('/marketplace/b2b/listings', { params });
      setB2bListings(r.data.listings || []);
      setB2bTotalPages(r.data.pages || 1);
    } catch {}
    finally { setLoadingB2b(false); }
  }, [b2bSearch, b2bIndustry, b2bCategory]);

  const fetchMyProducts = async () => {
    if (!user) return;
    try {
      const r = await api.get('/marketplace/my-products');
      setMyProducts(r.data.products || []);
    } catch {}
  };

  const fetchAnalytics = async () => {
    if (!user) return;
    setLoadingAnalytics(true);
    try {
      const r = await api.get('/marketplace/analytics/seller');
      setAnalytics(r.data);
    } catch {}
    finally { setLoadingAnalytics(false); }
  };

  const fetchMyAds = async () => {
    if (!user) return;
    setLoadingAds(true);
    try {
      const r = await api.get('/marketplace/ads/my');
      setMyAds(r.data.ads || []);
    } catch {}
    finally { setLoadingAds(false); }
  };

  const fetchMyB2bListings = async () => {
    if (!user) return;
    try {
      const r = await api.get('/marketplace/b2b/my-listings');
      setMyB2bListings(r.data.listings || []);
    } catch {}
  };

  const fetchInquiries = async () => {
    if (!user) return;
    try {
      const [sent, recv] = await Promise.all([
        api.get('/marketplace/b2b/inquiries?role=buyer'),
        api.get('/marketplace/b2b/inquiries?role=seller'),
      ]);
      setMyInquiries(sent.data.inquiries || []);
      setReceivedInquiries(recv.data.inquiries || []);
    } catch {}
  };

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProducts(1, category, search, sort);
    fetchFeatured();
    fetchAdsDisplay();
    fetchGlobalStats();
    fetchWishlist();
  }, []);

  useEffect(() => { if (tab === 'b2b') { fetchB2bListings(1); fetchMyB2bListings(); fetchInquiries(); } }, [tab]);
  useEffect(() => { if (tab === 'mystore') fetchMyProducts(); }, [tab]);
  useEffect(() => { if (tab === 'analytics') fetchAnalytics(); }, [tab]);
  useEffect(() => { if (tab === 'ads') fetchMyAds(); }, [tab]);

  const handleSearch = e => {
    const v = e.target.value;
    setSearch(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => { setPage(1); fetchProducts(1, category, v, sort); }, 400);
  };

  const handleCategory = c => { setCategory(c); setPage(1); fetchProducts(1, c, search, sort); };
  const handleSort = s => { setSort(s); setPage(1); fetchProducts(1, category, search, s); };
  const handlePage = p => { setPage(p); fetchProducts(p); };

  const toggleWishlist = async (productId, isWishlisted) => {
    if (!user) { toast.error('Please login'); return; }
    try {
      if (isWishlisted) {
        await api.delete(`/marketplace/wishlist/${productId}`);
        setWishlist(w => { const n = new Set(w); n.delete(productId); return n; });
      } else {
        await api.post(`/marketplace/wishlist/${productId}`);
        setWishlist(w => new Set(w).add(productId));
      }
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const promoteProduct = async (productId) => {
    try {
      const r = await api.post(`/marketplace/promote/${productId}`, { budget: 10, days: 7 });
      if (r.data.checkout_url) window.location.href = r.data.checkout_url;
      else toast.success('Promotion started!');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed to promote'); }
  };

  // ── Render sections ───────────────────────────────────────────────────────
  const renderDiscover = () => (
    <div className="space-y-5">
      {/* Ads */}
      {ads.length > 0 && (
        <div className="space-y-2">
          {ads.slice(0, 2).map(ad => <AdBanner key={ad.id} ad={ad} />)}
        </div>
      )}

      {/* Global stats */}
      {globalStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={FiPackage} label="Products" value={fmt(globalStats.total_products)} color="#075E54" />
          <StatCard icon={FiUsers} label="Sellers" value={fmt(globalStats.total_sellers)} color="#7C3AED" />
          <StatCard icon={FiDownload} label="Sales" value={fmt(globalStats.total_sales)} color="#2563EB" />
          <StatCard icon={FiBriefcase} label="B2B Listings" value={fmt(globalStats.total_b2b_listings)} color="#D97706" />
        </div>
      )}

      {/* Featured */}
      {featured.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><FiZap size={16} className="text-amber-500" />Featured Products</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} isPromoted={i < 2}
                onView={setSelectedProduct} onWishlist={toggleWishlist} wishlisted={wishlist.has(p.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3 shadow-sm">
        <div className="relative">
          <FiSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={handleSearch} placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => handleCategory(c)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${category === c ? 'bg-[#075E54] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{c}</button>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {SORTS.map(s => (
              <button key={s.value} onClick={() => handleSort(s.value)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${sort === s.value ? 'bg-[#075E54] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s.label}</button>
            ))}
          </div>
          <div className="flex gap-1">
            {[['grid', FiGrid], ['list', FiList]].map(([v, Icon]) => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition ${viewMode === v ? 'bg-[#075E54] text-white' : 'bg-gray-100 text-gray-500'}`}>
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Products grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /></div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FiShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
          <div className="font-medium">No products found</div>
          <div className="text-sm mt-1">Try different search terms or categories</div>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'space-y-3'}>
          {products.map(p => (
            <ProductCard key={p.id} product={p}
              onView={setSelectedProduct} onWishlist={toggleWishlist} wishlisted={wishlist.has(p.id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40"><FiChevronLeft size={14} /></button>
          <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
          <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40"><FiChevronRight size={14} /></button>
        </div>
      )}
    </div>
  );

  const renderB2B = () => (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2 bg-gray-100 rounded-2xl p-1 overflow-x-auto">
        {[
          { id: 'browse', label: 'Browse' },
          { id: 'my-listings', label: 'My Listings' },
          { id: 'inquiries-received', label: 'Received' },
          { id: 'inquiries-sent', label: 'Sent' },
        ].map(t => (
          <button key={t.id} onClick={() => setB2bSubTab(t.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition ${b2bSubTab === t.id ? 'bg-white shadow text-[#075E54]' : 'text-gray-500'}`}>{t.label}</button>
        ))}
      </div>

      {b2bSubTab === 'browse' && (
        <>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={b2bSearch} onChange={e => { setB2bSearch(e.target.value); fetchB2bListings(1); }}
                placeholder="Search suppliers..." className="w-full pl-8 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            </div>
            <button onClick={() => setShowCreateB2b(true)} className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition">
              <FiPlus size={14} />List
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button onClick={() => { setB2bIndustry(''); fetchB2bListings(1); }}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${!b2bIndustry ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>All Industries</button>
            {B2B_INDUSTRIES.map(i => (
              <button key={i} onClick={() => { setB2bIndustry(i); fetchB2bListings(1); }}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${b2bIndustry === i ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}>{i}</button>
            ))}
          </div>
          {loadingB2b ? (
            <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" /></div>
          ) : b2bListings.length === 0 ? (
            <div className="text-center py-16 text-gray-400"><FiBriefcase size={40} className="mx-auto mb-3 opacity-30" /><div>No B2B listings yet</div><button onClick={() => setShowCreateB2b(true)} className="mt-3 text-indigo-600 text-sm font-medium">Be the first to list</button></div>
          ) : (
            <div className="space-y-3">{b2bListings.map(l => <B2BCard key={l.id} listing={l} onView={setSelectedB2b} />)}</div>
          )}
        </>
      )}

      {b2bSubTab === 'my-listings' && (
        <div className="space-y-3">
          <button onClick={() => setShowCreateB2b(true)} className="w-full border-2 border-dashed border-indigo-200 rounded-xl py-3 flex items-center justify-center gap-2 text-indigo-600 text-sm font-medium hover:bg-indigo-50 transition">
            <FiPlus size={16} />Create New B2B Listing
          </button>
          {myB2bListings.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><FiBriefcase size={36} className="mx-auto mb-3 opacity-30" /><div>No B2B listings yet</div></div>
          ) : myB2bListings.map(l => <B2BCard key={l.id} listing={l} onView={setSelectedB2b} />)}
        </div>
      )}

      {b2bSubTab === 'inquiries-received' && (
        <div className="space-y-3">
          {receivedInquiries.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><FiMessageCircle size={36} className="mx-auto mb-3 opacity-30" /><div>No inquiries received yet</div></div>
          ) : receivedInquiries.map(inq => (
            <div key={inq.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm text-gray-900">{inq.buyer_name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Qty: {inq.quantity}</div>
                  <div className="text-sm text-gray-700 mt-1">{inq.message}</div>
                  {inq.budget_range && <div className="text-xs text-gray-500 mt-1">Budget: {inq.budget_range}</div>}
                </div>
                <Badge color={inq.status === 'quoted' ? 'green' : inq.status === 'accepted' ? 'blue' : 'gray'}>{inq.status}</Badge>
              </div>
              {inq.quoted_price && (
                <div className="mt-2 bg-green-50 rounded-xl p-2 text-xs text-green-700">
                  Quote sent: ${inq.quoted_price} — {inq.quote_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {b2bSubTab === 'inquiries-sent' && (
        <div className="space-y-3">
          {myInquiries.length === 0 ? (
            <div className="text-center py-12 text-gray-400"><FiSend size={36} className="mx-auto mb-3 opacity-30" /><div>No RFQs sent yet</div></div>
          ) : myInquiries.map(inq => (
            <div key={inq.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm text-gray-700">{inq.message}</div>
                  <div className="text-xs text-gray-400 mt-1">Qty: {inq.quantity}</div>
                </div>
                <Badge color={inq.status === 'quoted' ? 'green' : 'gray'}>{inq.status}</Badge>
              </div>
              {inq.quoted_price && (
                <div className="mt-2 bg-blue-50 rounded-xl p-2 text-xs text-blue-700">
                  Supplier quote: ${inq.quoted_price} — {inq.quote_message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMyStore = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">My Products ({myProducts.length})</h3>
        <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 bg-[#075E54] text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-[#128C7E] transition">
          <FiPlus size={14} />New Product
        </button>
      </div>
      {myProducts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FiPackage size={40} className="mx-auto mb-3 opacity-30" />
          <div>No products listed yet</div>
          <button onClick={() => setShowUpload(true)} className="mt-3 bg-[#075E54] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#128C7E] transition">List your first product</button>
        </div>
      ) : (
        <div className="space-y-3">
          {myProducts.map(p => (
            <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-3">
              <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover rounded-xl" /> : <FileIcon type={p.file_type} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm text-gray-900 truncate">{p.title}</div>
                <div className="text-xs text-gray-400 mt-0.5">{p.category} · {p.is_free ? 'Free' : fmtMoney(p.price)}</div>
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-gray-500 flex items-center gap-1"><FiDownload size={11} />{p.download_count}</span>
                  <span className="text-xs text-gray-500 flex items-center gap-1"><FiEye size={11} />{p.view_count}</span>
                  {p.rating_count > 0 && <span className="text-xs text-gray-500 flex items-center gap-1"><FiStar size={11} />{p.rating_avg?.toFixed(1)}</span>}
                </div>
              </div>
              <div className="flex flex-col gap-1.5 flex-shrink-0">
                <button onClick={() => promoteProduct(p.id)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-medium hover:bg-amber-200 transition flex items-center gap-1">
                  <FiZap size={11} />Promote
                </button>
                <Badge color={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Active' : 'Hidden'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAnalytics = () => {
    if (loadingAnalytics) return <div className="flex items-center justify-center py-16"><div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /></div>;
    if (!analytics) return <div className="text-center py-16 text-gray-400">No analytics data</div>;

    const s = analytics.summary;
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <StatCard icon={FiDollarSign} label="Total Revenue" value={fmtMoney(s.total_revenue)} color="#075E54" />
          <StatCard icon={FiDownload} label="Total Sales" value={fmt(s.total_sales)} color="#2563EB" />
          <StatCard icon={FiPackage} label="Products" value={fmt(s.total_products)} color="#7C3AED" />
          <StatCard icon={FiEye} label="Total Views" value={fmt(s.total_views)} color="#D97706" />
          <StatCard icon={FiDownload} label="Downloads" value={fmt(s.total_downloads)} color="#16A34A" />
          <StatCard icon={FiStar} label="Avg Rating" value={s.avg_rating || '—'} color="#F59E0B" />
        </div>

        {analytics.revenue_by_day?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="font-semibold text-gray-900 mb-3 text-sm">Revenue — Last 30 Days</div>
            <MiniBarChart data={analytics.revenue_by_day} field="revenue" color={GREEN} />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>{analytics.revenue_by_day[0]?.date}</span>
              <span>{analytics.revenue_by_day[analytics.revenue_by_day.length - 1]?.date}</span>
            </div>
          </div>
        )}

        {analytics.top_products?.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <div className="font-semibold text-gray-900 mb-3 text-sm">Top Performing Products</div>
            <div className="space-y-3">
              {analytics.top_products.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{p.title}</div>
                    <div className="text-xs text-gray-400">{p.total_sales} sales · {fmtMoney(p.total_revenue)}</div>
                  </div>
                  {p.avg_rating > 0 && (
                    <div className="flex items-center gap-1 text-xs text-amber-500">
                      <FiStar size={11} fill={STAR_COLOR} stroke={STAR_COLOR} />{p.avg_rating}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={fetchAnalytics} className="w-full border border-gray-200 rounded-xl py-2.5 text-sm text-gray-500 flex items-center justify-center gap-2 hover:bg-gray-50 transition">
          <FiRefreshCw size={14} />Refresh Analytics
        </button>
      </div>
    );
  };

  const renderAds = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Ad Campaigns</h3>
        <button onClick={() => setShowCreateAd(true)} className="flex items-center gap-1.5 bg-amber-500 text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-amber-600 transition">
          <FiPlus size={14} />New Campaign
        </button>
      </div>

      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100">
        <div className="font-semibold text-amber-900 text-sm mb-1 flex items-center gap-2"><FiTarget size={16} />Advertise in Marketplace</div>
        <div className="text-amber-700 text-xs">Reach buyers actively browsing. CPM from $1/1000 impressions. Ads approved within 24 hours.</div>
      </div>

      {loadingAds ? (
        <div className="flex items-center justify-center py-12"><div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : myAds.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FiRadio size={40} className="mx-auto mb-3 opacity-30" />
          <div>No campaigns yet</div>
          <button onClick={() => setShowCreateAd(true)} className="mt-3 bg-amber-500 text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-amber-600 transition">Launch your first ad</button>
        </div>
      ) : (
        <div className="space-y-3">
          {myAds.map(ad => (
            <div key={ad.id} className="bg-white rounded-2xl border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-gray-900 truncate">{ad.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{ad.placement} · {ad.ad_type} · {ad.billing_type?.toUpperCase()}</div>
                </div>
                <Badge color={ad.status === 'active' ? 'green' : ad.status === 'completed' ? 'gray' : ad.is_approved ? 'blue' : 'amber'}>
                  {ad.status}
                </Badge>
              </div>
              <div className="grid grid-cols-4 gap-2 mt-3">
                {[
                  { label: 'Budget', value: fmtMoney(ad.budget_total) },
                  { label: 'Spent', value: fmtMoney(ad.budget_spent) },
                  { label: 'Impressions', value: fmt(ad.impressions || 0) },
                  { label: 'CTR', value: ad.impressions > 0 ? `${((ad.clicks / ad.impressions) * 100).toFixed(1)}%` : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-2 text-center">
                    <div className="font-bold text-gray-900 text-sm">{s.value}</div>
                    <div className="text-xs text-gray-400">{s.label}</div>
                  </div>
                ))}
              </div>
              {!ad.is_approved && (
                <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-2 py-1">Pending admin approval</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-[#075E54] px-4 pt-safe pb-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FiShoppingBag size={22} className="text-white" />
            <h1 className="text-white font-bold text-lg">Marketplace</h1>
          </div>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-sm font-medium transition">
            <FiPlus size={14} />Sell
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex-shrink-0 ${tab === t.id ? 'bg-white text-[#075E54]' : 'text-green-100 hover:bg-white/10'}`}>
              <t.icon size={13} />{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}>
            {tab === 'discover' && renderDiscover()}
            {tab === 'b2b' && renderB2B()}
            {tab === 'mystore' && renderMyStore()}
            {tab === 'analytics' && renderAnalytics()}
            {tab === 'ads' && renderAds()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {selectedProduct && <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} user={user} />}
        {selectedB2b && <B2BModal listing={selectedB2b} onClose={() => setSelectedB2b(null)} user={user} />}
        {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { fetchProducts(1); fetchMyProducts(); }} />}
        {showCreateAd && <CreateAdModal myProducts={myProducts} onClose={() => setShowCreateAd(false)} onSuccess={fetchMyAds} />}
        {showCreateB2b && <CreateB2BModal onClose={() => setShowCreateB2b(false)} onSuccess={() => { fetchB2bListings(1); fetchMyB2bListings(); }} />}
      </AnimatePresence>
    </div>
  );
}
