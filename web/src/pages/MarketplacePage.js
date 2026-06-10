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
  FiShield, FiLink,
} from 'react-icons/fi';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';
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
  { id: 'purchases', label: 'Purchases', icon: FiDownload },
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

// ── Flash Deals Section ────────────────────────────────────────────────────────
function FlashDealsSection({ products, onView, onWishlist, wishlist }) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 0);
    return Math.max(0, Math.floor((end - now) / 1000));
  });

  useEffect(() => {
    const t = setInterval(() => setTimeLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const hh = String(Math.floor(timeLeft / 3600)).padStart(2, '0');
  const mm = String(Math.floor((timeLeft % 3600) / 60)).padStart(2, '0');
  const ss = String(timeLeft % 60).padStart(2, '0');

  const deals = products.slice(0, 4).map((p, i) => ({
    ...p,
    discount: [25, 40, 15, 35][i % 4],
    originalPrice: (p.price * (1 + [0.33, 0.67, 0.18, 0.54][i % 4])).toFixed(2),
    stock: [8, 3, 12, 5][i % 4],
  }));

  if (deals.length === 0) return null;

  return (
    <div className="rounded-[2.5rem] bg-gradient-to-br from-red-600 via-rose-600 to-orange-500 p-1 shadow-2xl shadow-red-500/20">
      <div className="bg-white rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-100 flex items-center justify-center">
              <FiZap size={20} className="text-red-500" fill="currentColor" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                Flash Deals
                <motion.span animate={{ scale: [1, 1.1, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}
                  className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full font-black">LIVE</motion.span>
              </h2>
              <p className="text-xs text-gray-400 font-medium">Deep discounts for a limited time</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {[['h', hh], ['m', mm], ['s', ss]].map(([unit, val]) => (
              <React.Fragment key={unit}>
                <div className="bg-gray-900 text-white px-2.5 py-1.5 rounded-xl text-center">
                  <div className="text-lg font-black leading-none tabular-nums">{val}</div>
                  <div className="text-[8px] text-gray-400 uppercase font-bold mt-0.5">{unit}</div>
                </div>
                {unit !== 's' && <span className="text-gray-400 font-black text-lg mx-0.5">:</span>}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {deals.map(p => (
            <motion.div key={p.id} whileHover={{ y: -3 }}
              onClick={() => onView(p)}
              className="cursor-pointer group rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl transition-all">
              <div className="aspect-square bg-gray-50 relative overflow-hidden">
                {p.preview_url || p.thumbnail_url
                  ? <img src={p.preview_url || p.thumbnail_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  : <div className="w-full h-full flex items-center justify-center text-3xl"><FileIcon type={p.file_type} /></div>
                }
                <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow">
                  -{p.discount}%
                </div>
                <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                  {p.stock} left
                </div>
              </div>
              <div className="p-2.5">
                <p className="text-xs font-bold text-gray-800 truncate">{p.title}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-sm font-black text-red-500">{fmtMoney(p.price)}</span>
                  <span className="text-[10px] text-gray-400 line-through">${p.originalPrice}</span>
                </div>
                <div className="mt-1.5 bg-red-50 rounded-full h-1 overflow-hidden">
                  <div className="h-full bg-red-400 rounded-full" style={{ width: `${100 - (p.stock / 15) * 100}%` }} />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Trending Strip ─────────────────────────────────────────────────────────────
function TrendingStrip({ products, onView, onWishlist, wishlist }) {
  const trending = products.slice(0, 8);
  if (trending.length === 0) return null;

  const TRUST_BADGES = [
    { icon: '🔒', label: 'Secure' },
    { icon: '✅', label: 'Verified' },
    { icon: '↩️', label: 'Refund' },
    { icon: '⚡', label: 'Instant' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 px-1">
        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <span className="w-9 h-9 bg-orange-100 rounded-xl flex items-center justify-center text-lg">🔥</span>
          Trending Now
        </h2>
        <div className="flex gap-2">
          {TRUST_BADGES.map(b => (
            <span key={b.label} className="hidden sm:flex items-center gap-1 text-[10px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
              {b.icon} {b.label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-3 no-scrollbar">
        {trending.map((p, i) => (
          <motion.div key={p.id} whileHover={{ y: -4 }}
            onClick={() => onView(p)}
            className="flex-shrink-0 w-40 cursor-pointer group rounded-2xl bg-white border border-gray-100 overflow-hidden hover:shadow-xl transition-all hover:border-gray-200">
            <div className="aspect-square relative overflow-hidden bg-gray-50">
              {p.preview_url || p.thumbnail_url
                ? <img src={p.preview_url || p.thumbnail_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                : <div className="w-full h-full flex items-center justify-center text-2xl"><FileIcon type={p.file_type} /></div>
              }
              <div className="absolute top-2 left-2 bg-orange-100 text-orange-600 text-[9px] font-black px-1.5 py-0.5 rounded-lg">
                #{i + 1} HOT
              </div>
              {p.seller_verified && (
                <div className="absolute top-2 right-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center shadow">
                  <FiCheck size={10} className="text-white" strokeWidth={3} />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="text-[11px] font-bold text-gray-700 truncate">{p.title}</p>
              <div className="flex items-center justify-between mt-1">
                <span className="text-sm font-black text-[#075E54]">
                  {p.is_free ? <span className="text-green-500">FREE</span> : fmtMoney(p.price)}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold flex items-center gap-0.5">
                  <FiDownload size={8} />{fmt(p.download_count || 0)}
                </span>
              </div>
              <div className="flex items-center gap-0.5 mt-1">
                {[1,2,3,4,5].map(s => (
                  <FiStar key={s} size={9} fill={s <= Math.round(p.rating_avg||5) ? '#f59e0b' : 'none'} stroke={s <= Math.round(p.rating_avg||5) ? '#f59e0b' : '#d1d5db'} />
                ))}
                <span className="text-[9px] text-gray-400 ml-0.5">({p.rating_count||0})</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Seller Spotlight ───────────────────────────────────────────────────────────
function SellerSpotlight({ stats }) {
  const sellers = [
    { name: 'Alex Design', avatar: '👨‍🎨', sales: 1240, rating: 4.9, badge: '🥇', category: 'Digital Art' },
    { name: 'CodeCraft',   avatar: '👩‍💻', sales: 890,  rating: 4.8, badge: '🥈', category: 'Software' },
    { name: 'MusicPro',   avatar: '🎵',   sales: 670,  rating: 4.9, badge: '🥉', category: 'Music' },
    { name: 'EduWorld',   avatar: '📚',   sales: 520,  rating: 5.0, badge: '⭐', category: 'Courses' },
  ];
  return (
    <div>
      <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
        <span className="w-9 h-9 bg-purple-100 rounded-xl flex items-center justify-center text-lg">🏆</span>
        Top Sellers
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {sellers.map(s => (
          <div key={s.name} className="bg-white rounded-2xl border border-gray-100 p-4 text-center hover:shadow-lg transition-all cursor-pointer group hover:border-purple-100">
            <div className="text-4xl mb-2">{s.avatar}</div>
            <div className="font-bold text-gray-900 text-sm group-hover:text-purple-600 transition">{s.name}</div>
            <div className="text-[10px] text-gray-400 font-medium mb-2">{s.category}</div>
            <div className="flex items-center justify-center gap-1 mb-2">
              <FiStar size={10} fill="#f59e0b" stroke="#f59e0b" />
              <span className="text-xs font-black text-gray-700">{s.rating}</span>
            </div>
            <div className="bg-gray-50 rounded-xl py-1.5 px-3 text-[10px] font-black text-gray-600 flex items-center justify-center gap-1">
              <FiDownload size={9} />{fmt(s.sales)} sales
            </div>
            <div className="text-lg mt-2">{s.badge}</div>
          </div>
        ))}
      </div>
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
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.01 }}
      className="relative rounded-3xl overflow-hidden cursor-pointer group shadow-xl mb-6 aspect-[21/9] sm:aspect-[3/1]"
      style={{ background: 'linear-gradient(135deg, #075E54 0%, #128C7E 50%, #25D366 100%)' }}
      onClick={handleClick}
    >
      {ad.image_url && (
        <img src={ad.image_url} alt={ad.title} className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-60 group-hover:scale-105 transition-transform duration-700" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <div className="relative z-10 flex flex-col justify-end h-full p-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="bg-white/20 backdrop-blur-md text-white text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-white/20">Sponsored</span>
          {ad.badge && <Badge color="amber">{ad.badge}</Badge>}
        </div>
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-white text-xl sm:text-2xl md:text-3xl leading-tight truncate drop-shadow-lg">{ad.title}</h2>
            {ad.description && <p className="text-green-50 text-xs sm:text-sm mt-1 line-clamp-2 max-w-xl opacity-90">{ad.description}</p>}
          </div>
          <button className="flex-shrink-0 bg-white text-[#075E54] text-sm font-bold px-6 py-2.5 rounded-2xl hover:shadow-lg hover:scale-105 transition active:scale-95 whitespace-nowrap">
            {ad.cta_text || 'Explore Now'}
          </button>
        </div>
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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -5 }}
      className={`bg-white rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden cursor-pointer group border ${isPromoted ? 'border-amber-200 ring-2 ring-amber-100' : 'border-gray-100'}`}
      onClick={() => onView(product)}
    >
      <div className="aspect-[4/3] bg-gray-50 relative overflow-hidden">
        {product.preview_url || product.thumbnail_url ? (
          <img src={product.preview_url || product.thumbnail_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-200">
            <FileIcon type={product.file_type} />
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {isPromoted && (
          <div className="absolute top-4 left-4">
            <div className="bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider flex items-center gap-1 shadow-lg">
              <FiZap size={10} fill="currentColor" /> Featured
            </div>
          </div>
        )}
        
        <div className="absolute top-4 right-4 translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
          <button onClick={toggleWish} disabled={wishLoading}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-xl backdrop-blur-md transition ${wishlisted ? 'bg-red-500 text-white' : 'bg-white/80 text-gray-900 hover:bg-white hover:text-red-500'}`}>
            {wishLoading ? <Spinner /> : <FiHeart size={18} fill={wishlisted ? 'currentColor' : 'none'} />}
          </button>
        </div>

        <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
           <button className="w-full bg-[#075E54] text-white py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center justify-center gap-2">
             <FiShoppingBag size={14} /> Quick View
           </button>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{product.category}</div>
            <div className="font-bold text-gray-900 text-base truncate group-hover:text-[#075E54] transition-colors">{product.title}</div>
          </div>
          {product.seller_verified && (
            <div className="w-6 h-6 bg-blue-50 rounded-full flex items-center justify-center flex-shrink-0" title="Verified Seller">
              <FiCheck size={12} className="text-blue-600 font-bold" />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <StarRow rating={product.rating_avg || 5} size={12} />
          <span className="text-[11px] font-semibold text-gray-400">({product.rating_count || 0})</span>
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-gray-50">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Price</span>
            <div className="font-black text-xl text-[#075E54]">
              {product.is_free ? <span className="text-green-500">FREE</span> : fmtMoney(product.price)}
            </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex flex-col items-end">
               <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Sales</span>
               <div className="text-xs font-bold text-gray-700 flex items-center gap-1"><FiDownload size={10} />{fmt(product.download_count || 0)}</div>
             </div>
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      className="bg-white rounded-[2rem] border border-gray-100 shadow-sm hover:shadow-xl transition-all cursor-pointer p-6 group"
      onClick={() => onView(listing)}
    >
      <div className="flex flex-col sm:flex-row items-start gap-5">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center flex-shrink-0 group-hover:rotate-3 transition-transform">
          <FiBriefcase size={28} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{listing.industry}</span>
            {listing.is_verified && (
              <div className="flex items-center gap-1 bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase">
                <FiCheck size={10} /> Verified Supplier
              </div>
            )}
          </div>
          <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-indigo-600 transition-colors">{listing.title}</h3>
          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{listing.description || 'Professional supplier listing on VipChat B2B.'}</p>
          
          <div className="flex flex-wrap items-center gap-4 mt-4">
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase">Unit Price</span>
              <span className="text-base font-black text-[#075E54]">${listing.unit_price}</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase">Min. Order</span>
              <span className="text-sm font-bold text-gray-700">{listing.min_order_qty} units</span>
            </div>
            <div className="w-px h-8 bg-gray-100" />
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-gray-400 uppercase">Lead Time</span>
              <span className="text-sm font-bold text-gray-700">{listing.lead_time_days} days</span>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-auto flex flex-col items-center justify-center gap-2 sm:pl-6 sm:border-l border-gray-100">
           <div className="text-center">
             <div className="text-[9px] font-bold text-gray-400 uppercase mb-1">Inquiries</div>
             <div className="text-lg font-black text-gray-900">{listing.inquiry_count || 0}</div>
           </div>
           <button className="w-full sm:w-auto bg-indigo-50 text-indigo-600 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-colors">
             Contact
           </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Seller respond to dispute ─────────────────────────────────────────────────
function SellerRespondToDispute({ dispute, onResponded }) {
  const [statement, setStatement] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [show, setShow] = useState(false);

  const submit = async () => {
    if (!statement.trim()) { toast.error('Statement required'); return; }
    setSubmitting(true);
    try {
      await api.post(`/marketplace/disputes/${dispute.id}/respond`, { statement });
      toast.success('Response submitted!');
      setShow(false);
      onResponded();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed');
    } finally { setSubmitting(false); }
  };

  if (!show) return (
    <button onClick={() => setShow(true)} className="mt-2 w-full text-xs text-blue-600 border border-blue-200 py-1.5 rounded-xl hover:bg-blue-50 transition">
      Respond to Dispute
    </button>
  );

  return (
    <div className="mt-2 space-y-2">
      <textarea value={statement} onChange={e => setStatement(e.target.value)} rows={3}
        placeholder="Explain your side to the buyer and admin..."
        className="w-full border border-gray-200 rounded-xl p-2 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
      <div className="flex gap-2">
        <button onClick={submit} disabled={submitting}
          className="flex-1 bg-blue-600 text-white text-xs font-semibold py-1.5 rounded-xl hover:bg-blue-700 transition flex items-center justify-center gap-1">
          {submitting ? <Spinner /> : 'Submit Response'}
        </button>
        <button onClick={() => setShow(false)} className="text-xs text-gray-400 px-3 py-1.5 rounded-xl hover:bg-gray-100 transition">Cancel</button>
      </div>
    </div>
  );
}

// ── PayPal Checkout wrapper ───────────────────────────────────────────────────
function PayPalCheckout({ product, user, onSuccess }) {
  const [paypalClientId, setPaypalClientId] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchaseId, setPurchaseId] = useState(null);
  const [paypalPaymentId, setPaypalPaymentId] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const r = await api.post('/marketplace/products/' + product.id + '/purchase', { payment_provider: 'paypal' });
        setPaypalClientId(r.data.paypal_client_id);
        setPurchaseId(r.data.purchase_id);
      } catch (e) {
        setError(e.response?.data?.error || 'PayPal unavailable');
      } finally {
        setLoading(false);
      }
    })();
  }, [product.id]);

  const createOrder = async () => {
    const r = await api.post('/payments/paypal/create-order', {
      purpose: 'marketplace',
      product_id: product.id,
    });
    setPaypalPaymentId(r.data.payment_id);
    return r.data.order_id;
  };

  const onApprove = async (data) => {
    try {
      await api.post('/payments/paypal/capture-order', {
        order_id: data.orderID,
        payment_id: paypalPaymentId,
        purpose: 'marketplace',
        product_id: product.id,
        purchase_id: purchaseId,
      });
      toast.success('Payment complete! Check Purchases tab for your download.');
      onSuccess();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Capture failed');
    }
  };

  if (loading) return <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>;
  if (error) return <div className="text-xs text-red-500 text-center py-2">{error}</div>;
  if (!paypalClientId) return null;

  return (
    <PayPalScriptProvider options={{ 'client-id': paypalClientId, currency: 'USD', intent: 'capture' }}>
      <PayPalButtons
        style={{ layout: 'horizontal', height: 40, label: 'pay', tagline: false }}
        createOrder={createOrder}
        onApprove={onApprove}
        onError={(err) => toast.error('PayPal error: ' + (err.message || 'Unknown'))}
      />
    </PayPalScriptProvider>
  );
}

// ── Product Detail Modal ───────────────────────────────────────────────────────
function ProductModal({ product, onClose, user }) {
  const [buying, setBuying] = useState(false);
  const [showPayPal, setShowPayPal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviews, setReviews] = useState(product?.reviews || []);
  const [activeImg, setActiveImg] = useState(0);
  const images = [product.preview_url || product.thumbnail_url, product.preview_url, product.thumbnail_url].filter(Boolean);

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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 40 }}
        className="bg-white rounded-t-[2.5rem] sm:rounded-[3rem] w-full sm:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl"
      >
        <div className="absolute top-4 right-4 z-50">
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md text-white hover:bg-white hover:text-gray-900 transition-all border border-white/30 shadow-xl"><FiX size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col md:flex-row">
            {/* Left: Image Gallery */}
            <div className="md:w-1/2 p-4 sm:p-8 bg-gray-50">
              <div className="aspect-square rounded-3xl overflow-hidden shadow-inner bg-white relative group">
                {images.length > 0 ? (
                  <img src={images[activeImg]} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <FileIcon type={product.file_type} />
                  </div>
                )}
                {product.seller_verified && (
                  <div className="absolute top-4 left-4 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white shadow-sm flex items-center gap-1.5">
                    <FiCheck size={12} className="text-blue-600" />
                    <span className="text-[10px] font-black text-gray-900 uppercase tracking-widest">Verified Seller</span>
                  </div>
                )}
              </div>
              {images.length > 1 && (
                <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                  {images.map((img, idx) => (
                    <button key={idx} onClick={() => setActiveImg(idx)} className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition ${activeImg === idx ? 'border-[#075E54] scale-105' : 'border-transparent opacity-60'}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <div className="mt-8 space-y-4 hidden md:block">
                 <div className="font-black text-gray-900 text-lg uppercase tracking-widest border-b border-gray-200 pb-2">Technical Details</div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-[9px] font-black text-gray-400 uppercase mb-1">File Type</div>
                       <div className="text-sm font-bold text-gray-900">{product.file_type?.toUpperCase() || 'N/A'}</div>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-gray-100 shadow-sm">
                       <div className="text-[9px] font-black text-gray-400 uppercase mb-1">License</div>
                       <div className="text-sm font-bold text-gray-900">{product.license_type || 'Standard'}</div>
                    </div>
                 </div>
              </div>
            </div>

            {/* Right: Content */}
            <div className="md:w-1/2 p-6 sm:p-10 flex flex-col">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Badge color="blue">{product.category}</Badge>
                  <div className="flex items-center gap-1">
                    <StarRow rating={product.rating_avg || 5} size={14} />
                    <span className="text-xs font-bold text-gray-400">({product.rating_count || 0})</span>
                  </div>
                </div>
                <h1 className="text-3xl font-black text-gray-900 mb-4 leading-tight">{product.title}</h1>
                <p className="text-gray-500 text-sm leading-relaxed mb-6 font-medium">{product.description}</p>

                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { label: 'Downloads', value: fmt(product.download_count || 0), icon: FiDownload, color: 'text-blue-600' },
                    { label: 'Views', value: fmt(product.view_count || 0), icon: FiEye, color: 'text-purple-600' },
                    { label: 'Rating', value: product.rating_avg?.toFixed(1) || '5.0', icon: FiStar, color: 'text-amber-500' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-3 border border-gray-100 shadow-sm text-center group hover:shadow-md transition">
                      <s.icon size={18} className={`mx-auto mb-2 ${s.color}`} />
                      <div className="font-black text-gray-900 text-sm">{s.value}</div>
                      <div className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 mb-8">
                  {product.tags?.map((t, i) => (
                    <span key={i} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-[10px] font-black uppercase tracking-widest">{t}</span>
                  ))}
                </div>
              </div>

              {/* Purchase Card */}
              <div className="bg-gray-900 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                   <FiZap size={80} className="text-white" />
                </div>
                <div className="relative z-10 flex items-center justify-between gap-6">
                  <div>
                    <div className="text-white/60 text-[10px] font-black uppercase tracking-[0.2em] mb-1">Instant Access</div>
                    <div className="text-3xl font-black text-white">
                      {product.is_free ? 'FREE' : fmtMoney(product.price)}
                    </div>
                  </div>
                  <div className="flex-1 max-w-[180px] space-y-2">
                    <button onClick={handleBuy} disabled={buying}
                      className="w-full bg-[#25D366] text-black font-black py-3 rounded-2xl hover:bg-[#1fb355] transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-green-500/20">
                      {buying ? <Spinner /> : product.is_free ? <><FiDownload size={18} /> DOWNLOAD</> : <><FiDollarSign size={18} /> BUY NOW</>}
                    </button>
                    {!product.is_free && (
                      <button onClick={() => setShowPayPal(true)} className="w-full bg-[#FFC439] text-[#003087] font-bold py-2.5 rounded-2xl text-xs flex items-center justify-center gap-2 hover:bg-yellow-400 transition transform active:scale-95 shadow-lg shadow-yellow-500/10">
                         <span className="font-bold">Pay</span><span className="font-light">Pal</span>
                      </button>
                    )}
                  </div>
                </div>
                {showPayPal && !product.is_free && (
                   <div className="mt-4 bg-white rounded-2xl p-4 overflow-hidden">
                      <PayPalCheckout product={product} user={user} onSuccess={onClose} />
                      <button onClick={() => setShowPayPal(false)} className="w-full text-[10px] font-black text-gray-400 uppercase tracking-widest mt-2 hover:text-gray-900">Cancel PayPal</button>
                   </div>
                )}
              </div>
            </div>
          </div>

          {/* Reviews Section */}
          <div className="p-6 sm:p-10 bg-white border-t border-gray-100">
             <div className="flex items-center justify-between mb-8">
                <div>
                   <h2 className="text-2xl font-black text-gray-900">Customer Reviews</h2>
                   <div className="text-sm font-medium text-gray-500 mt-1">Based on {product.rating_count || 0} reviews</div>
                </div>
                <div className="hidden sm:flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                   <div className="text-center border-r border-gray-200 pr-4">
                      <div className="text-2xl font-black text-gray-900">{product.rating_avg?.toFixed(1) || '5.0'}</div>
                      <StarRow rating={product.rating_avg || 5} size={12} />
                   </div>
                   <div className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">Overall<br/>Rating</div>
                </div>
             </div>

             <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  {product.reviews?.length > 0 ? (
                    product.reviews.slice(0, 5).map(r => (
                      <div key={r.id} className="bg-gray-50 rounded-[2rem] p-6 border border-gray-100 hover:border-gray-200 transition">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#075E54] to-[#25D366] text-white font-black flex items-center justify-center shadow-lg">
                            {r.reviewer_name?.[0] || '?'}
                          </div>
                          <div>
                            <div className="text-sm font-black text-gray-900">{r.reviewer_name}</div>
                            <StarRow rating={r.rating} size={10} />
                          </div>
                        </div>
                        <p className="text-sm text-gray-600 leading-relaxed italic">"{r.comment}"</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-10 bg-gray-50 rounded-[2rem] border border-dashed border-gray-200">
                       <FiMessageCircle size={32} className="mx-auto text-gray-300 mb-2" />
                       <div className="text-sm font-bold text-gray-400">No reviews yet. Be the first!</div>
                    </div>
                  )}
                </div>

                {user && (
                   <div className="bg-[#075E54]/5 rounded-[2.5rem] p-8 border border-[#075E54]/10 h-fit sticky top-4">
                      <h3 className="text-lg font-black text-[#075E54] uppercase tracking-widest mb-4">Post a Review</h3>
                      <div className="flex gap-2 mb-4">
                        {[1,2,3,4,5].map(i => (
                          <button key={i} onClick={() => setRating(i)} className="transform hover:scale-110 transition active:scale-95">
                            <FiStar size={28} fill={i <= rating ? STAR_COLOR : 'none'} stroke={i <= rating ? STAR_COLOR : '#d1d5db'} />
                          </button>
                        ))}
                      </div>
                      <textarea value={reviewText} onChange={e => setReviewText(e.target.value)}
                        placeholder="Your feedback matters..."
                        className="w-full bg-white border border-gray-100 rounded-[1.5rem] p-4 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-[#25D366]/20 transition-all shadow-sm mb-4" rows={4} />
                      <button onClick={submitReview} disabled={submittingReview || !reviewText.trim()}
                        className="w-full bg-[#075E54] text-white font-black py-3 rounded-2xl hover:bg-[#128C7E] transition-all transform active:scale-95 flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                        {submittingReview ? <Spinner /> : 'SUBMIT REVIEW'}
                      </button>
                   </div>
                )}
             </div>
          </div>
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

  // Purchases + Disputes state
  const [myPurchases, setMyPurchases] = useState([]);
  const [loadingPurchases, setLoadingPurchases] = useState(false);
  const [myDisputes, setMyDisputes] = useState([]);
  const [sellerDisputes, setSellerDisputes] = useState([]);
  const [showDisputeModal, setShowDisputeModal] = useState(null); // purchase object
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeStatement, setDisputeStatement] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [downloadingId, setDownloadingId] = useState(null);

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

  const fetchMyPurchases = async () => {
    if (!user) return;
    setLoadingPurchases(true);
    try {
      const r = await api.get('/marketplace/my-purchases');
      setMyPurchases(r.data.purchases || []);
    } catch {}
    finally { setLoadingPurchases(false); }
  };

  const fetchMyDisputes = async () => {
    if (!user) return;
    try {
      const [buyerR, sellerR] = await Promise.all([
        api.get('/marketplace/disputes?role=buyer'),
        api.get('/marketplace/disputes?role=seller'),
      ]);
      setMyDisputes(buyerR.data.disputes || []);
      setSellerDisputes(sellerR.data.disputes || []);
    } catch {}
  };

  const handleGetDownload = async (purchaseId) => {
    setDownloadingId(purchaseId);
    try {
      const r = await api.post(`/marketplace/my-purchases/${purchaseId}/download-token`);
      const token = r.data.token?.token;
      if (token) {
        window.open(`/api/marketplace/download/${token}`, '_blank');
      } else {
        toast.error('Download token unavailable');
      }
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to get download link');
    } finally { setDownloadingId(null); }
  };

  const submitDispute = async () => {
    if (!disputeReason.trim()) { toast.error('Please describe the issue'); return; }
    setSubmittingDispute(true);
    try {
      await api.post(`/marketplace/purchases/${showDisputeModal.id}/dispute`, {
        reason: disputeReason,
        statement: disputeStatement,
      });
      toast.success('Dispute opened! The seller has 48 hours to respond.');
      setShowDisputeModal(null);
      setDisputeReason('');
      setDisputeStatement('');
      fetchMyDisputes();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to open dispute');
    } finally { setSubmittingDispute(false); }
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
  useEffect(() => { if (tab === 'mystore') { fetchMyProducts(); fetchMyDisputes(); } }, [tab]);
  useEffect(() => { if (tab === 'analytics') fetchAnalytics(); }, [tab]);
  useEffect(() => { if (tab === 'ads') fetchMyAds(); }, [tab]);
  useEffect(() => { if (tab === 'purchases') { fetchMyPurchases(); fetchMyDisputes(); } }, [tab]);

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
    <div className="space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-[3rem] overflow-hidden bg-gray-900 h-[400px] flex items-center px-8 sm:px-16 shadow-2xl group">
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent z-10" />
        <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?q=80&w=2000&auto=format&fit=crop" className="absolute inset-0 w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-1000" alt="" />
        <div className="relative z-20 max-w-2xl">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <span className="bg-[#25D366] text-black text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-[0.2em] mb-4 inline-block">Premium Marketplace</span>
            <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-6">Discover Digital <span className="text-[#25D366]">Excellence</span></h1>
            
            {/* Main Search */}
            <div className="relative max-w-xl group/search">
              <FiSearch size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/search:text-[#25D366] transition-colors" />
              <input value={search} onChange={handleSearch} placeholder="Search high-quality assets, templates, code..."
                className="w-full pl-14 pr-6 py-5 bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl text-white placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-[#25D366]/30 focus:bg-white/20 transition-all text-lg shadow-2xl" />
            </div>

            <div className="flex flex-wrap gap-3 mt-8">
               {['Trending', 'New Arrivals', 'Best Sellers', 'Freebies'].map(chip => (
                 <button key={chip} className="px-4 py-2 bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest transition-all">
                    {chip}
                 </button>
               ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-4 bg-white p-3 rounded-[2rem] shadow-sm border border-gray-100 overflow-x-auto no-scrollbar">
        <div className="flex-shrink-0 px-4 border-r border-gray-100 mr-2">
           <div className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Categories</div>
        </div>
        <div className="flex gap-2">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => handleCategory(c)}
              className={`flex-shrink-0 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${category === c ? 'bg-gray-900 text-white shadow-lg shadow-gray-900/20 scale-105' : 'bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-900'}`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Featured Section */}
      {featured.length > 0 && (
        <div className="pt-4">
          <div className="flex items-center justify-between mb-6 px-2">
            <div>
              <h2 className="text-2xl font-black text-gray-900 flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center">
                  <FiZap size={20} className="text-amber-500" fill="currentColor" />
                </div>
                Featured Assets
              </h2>
              <p className="text-sm font-medium text-gray-400 mt-1 ml-13">Handpicked premium content for you</p>
            </div>
            <button className="text-xs font-black text-[#075E54] uppercase tracking-widest hover:underline transition">View All</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} isPromoted={true}
                onView={setSelectedProduct} onWishlist={toggleWishlist} wishlisted={wishlist.has(p.id)} />
            ))}
          </div>
        </div>
      )}

      {/* Flash Deals */}
      <FlashDealsSection
        products={products}
        onView={setSelectedProduct}
        onWishlist={toggleWishlist}
        wishlist={wishlist}
      />

      {/* Trending Strip */}
      <TrendingStrip
        products={products}
        onView={setSelectedProduct}
        onWishlist={toggleWishlist}
        wishlist={wishlist}
      />

      {/* Seller Spotlight */}
      <SellerSpotlight stats={globalStats} />

      {/* Global stats - Modernized */}
      {globalStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 py-6">
          <StatCard icon={FiPackage} label="Curated Assets" value={fmt(globalStats.total_products)} color="#075E54" />
          <StatCard icon={FiUsers} label="Verified Sellers" value={fmt(globalStats.total_sellers)} color="#7C3AED" />
          <StatCard icon={FiDownload} label="Asset Sales" value={fmt(globalStats.total_sales)} color="#2563EB" />
          <StatCard icon={FiBriefcase} label="B2B Connections" value={fmt(globalStats.total_b2b_listings)} color="#D97706" />
        </div>
      )}

      {/* All Products Section */}
      <div className="pt-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 px-2">
          <div>
            <h2 className="text-2xl font-black text-gray-900">Explore Collection</h2>
            <div className="flex items-center gap-2 text-sm font-medium text-gray-400 mt-1">
              <span>{products.length} products found</span>
              <span className="w-1 h-1 rounded-full bg-gray-300" />
              <button className="hover:text-gray-900 transition underline underline-offset-4">Reset filters</button>
            </div>
          </div>
          
          <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-1 bg-gray-50 p-1 rounded-xl border border-gray-100">
              {SORTS.map(s => (
                <button key={s.value} onClick={() => handleSort(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${sort === s.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>{s.label}</button>
              ))}
            </div>
            <div className="w-px h-6 bg-gray-100 mx-1" />
            <div className="flex gap-1">
              {[ ['grid', FiGrid], ['list', FiList] ].map(([v, Icon]) => (
                <button key={v} onClick={() => setViewMode(v)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${viewMode === v ? 'bg-gray-900 text-white shadow-lg' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                  <Icon size={16} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Products grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
             <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin" />
             <div className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading Assets...</div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-gray-200">
            <FiShoppingBag size={64} className="mx-auto mb-6 text-gray-200" />
            <div className="text-xl font-black text-gray-900 mb-2">No matching assets</div>
            <p className="text-sm font-medium text-gray-400 max-w-xs mx-auto">Try adjusting your search or category filters to find what you're looking for.</p>
          </div>
        ) : (
          <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8' : 'space-y-6'}>
            {products.map(p => (
              <ProductCard key={p.id} product={p}
                onView={setSelectedProduct} onWishlist={toggleWishlist} wishlisted={wishlist.has(p.id)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-16">
            <button onClick={() => handlePage(page - 1)} disabled={page <= 1} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm disabled:opacity-30 hover:bg-gray-50 transition active:scale-90"><FiChevronLeft size={20} /></button>
            <div className="bg-white px-6 py-3 rounded-2xl border border-gray-100 shadow-sm text-sm font-black text-gray-900 uppercase tracking-widest">
              Page {page} <span className="text-gray-300 mx-2">/</span> {totalPages}
            </div>
            <button onClick={() => handlePage(page + 1)} disabled={page >= totalPages} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white border border-gray-100 shadow-sm disabled:opacity-30 hover:bg-gray-50 transition active:scale-90"><FiChevronRight size={20} /></button>
          </div>
        )}
      </div>

      {/* Secondary Ad */}
      {ads.length > 1 && (
        <div className="mt-16">
           <AdBanner ad={ads[1]} />
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

  const renderPurchases = () => {
    if (loadingPurchases) return <div className="flex items-center justify-center py-16"><div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /></div>;
    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900">My Purchases ({myPurchases.length})</h3>
          <button onClick={fetchMyPurchases} className="text-xs text-gray-400 flex items-center gap-1 hover:text-gray-600"><FiRefreshCw size={12} />Refresh</button>
        </div>

        {/* Buyer Disputes */}
        {myDisputes.length > 0 && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-2">
            <div className="font-semibold text-red-800 text-sm flex items-center gap-2"><FiAlertCircle size={14} />Open Disputes ({myDisputes.length})</div>
            {myDisputes.map(d => (
              <div key={d.id} className="bg-white rounded-xl p-3 border border-red-100">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-sm text-gray-900 truncate">{d.product_title}</div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.status === 'resolved' ? 'bg-green-100 text-green-700' : d.status === 'seller_responded' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>{d.status.replace('_', ' ')}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{d.reason}</div>
                {d.resolution && <div className="text-xs text-green-700 bg-green-50 rounded-lg p-2 mt-2">Resolution: {d.resolution}</div>}
              </div>
            ))}
          </div>
        )}

        {myPurchases.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <FiShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <div className="font-medium">No purchases yet</div>
            <div className="text-sm mt-1">Browse the marketplace to find digital products</div>
            <button onClick={() => setTab('discover')} className="mt-3 bg-[#075E54] text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-[#128C7E] transition">Explore Marketplace</button>
          </div>
        ) : (
          <div className="space-y-3">
            {myPurchases.map(p => {
              const hasDispute = myDisputes.some(d => d.purchase_id === p.id);
              const prod = p.product;
              return (
                <div key={p.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
                  <div className="flex gap-3">
                    <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {prod?.thumbnail_url ? <img src={prod.thumbnail_url} alt="" className="w-full h-full object-cover rounded-xl" /> : <FiPackage size={22} className="text-gray-300" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-gray-900 truncate">{prod?.title || 'Product'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{prod?.category} · {fmtMoney(p.amount_paid)}</div>
                      <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
                        <FiClock size={10} />{new Date(p.created_at).toLocaleDateString()}
                        {p.payment_provider && <span className="ml-1 capitalize">via {p.payment_provider}</span>}
                      </div>
                    </div>
                    <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 h-fit">Purchased</span>
                  </div>
                  <div className="flex gap-2">
                    {prod?.file_url && (
                      <button
                        onClick={() => handleGetDownload(p.id)}
                        disabled={downloadingId === p.id}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-[#075E54] text-white text-xs font-semibold py-2 rounded-xl hover:bg-[#128C7E] transition">
                        {downloadingId === p.id ? <Spinner /> : <><FiDownload size={13} />Download File</>}
                      </button>
                    )}
                    {!hasDispute && (
                      <button
                        onClick={() => setShowDisputeModal(p)}
                        className="flex items-center gap-1 text-xs text-red-500 border border-red-200 px-3 py-2 rounded-xl hover:bg-red-50 transition">
                        <FiShield size={12} />Dispute
                      </button>
                    )}
                    {hasDispute && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-xl"><FiAlertCircle size={12} />Dispute open</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Seller disputes panel */}
        {sellerDisputes.length > 0 && (
          <div className="border-t pt-4">
            <div className="font-semibold text-gray-900 mb-3 text-sm flex items-center gap-2"><FiShield size={14} className="text-amber-500" />Disputes on My Products ({sellerDisputes.length})</div>
            <div className="space-y-3">
              {sellerDisputes.map(d => (
                <div key={d.id} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-900">{d.product_title}</div>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${d.status === 'open' ? 'bg-red-100 text-red-700' : d.status === 'seller_responded' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>{d.status.replace('_', ' ')}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">From: {d.buyer_name}</div>
                  <div className="text-xs text-gray-700">{d.reason}</div>
                  {d.seller_respond_by && d.status === 'open' && (
                    <div className="text-xs text-red-600 mt-1 flex items-center gap-1"><FiClock size={10} />Respond by: {new Date(d.seller_respond_by).toLocaleString()}</div>
                  )}
                  {d.status === 'open' && (
                    <SellerRespondToDispute dispute={d} onResponded={fetchMyDisputes} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
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
            {tab === 'purchases' && renderPurchases()}
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

        {/* Dispute open modal */}
        {showDisputeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b flex items-center justify-between px-4 py-3 z-10">
                <div className="font-bold text-gray-900 flex items-center gap-2"><FiShield size={16} className="text-red-500" />Open Buyer Dispute</div>
                <button onClick={() => setShowDisputeModal(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"><FiX size={16} /></button>
              </div>
              <div className="p-4 space-y-4">
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-700">
                  <strong>Buyer Protection</strong> — disputes are reviewed by our team within 72 hours. Seller has 48 hours to respond.
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Issue Type *</label>
                  <select value={disputeReason} onChange={e => setDisputeReason(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="">Select a reason</option>
                    <option value="Item not received">Item not received</option>
                    <option value="File not working or corrupted">File not working or corrupted</option>
                    <option value="Not as described">Not as described</option>
                    <option value="Unauthorized purchase">Unauthorized purchase</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Describe the issue</label>
                  <textarea value={disputeStatement} onChange={e => setDisputeStatement(e.target.value)}
                    rows={4} placeholder="Provide details about your issue..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-400" />
                </div>
                <button onClick={submitDispute} disabled={submittingDispute || !disputeReason}
                  className="w-full bg-red-500 text-white font-semibold py-3 rounded-xl hover:bg-red-600 transition flex items-center justify-center gap-2 disabled:opacity-50">
                  {submittingDispute ? <Spinner /> : <><FiShield size={16} />Open Dispute</>}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
