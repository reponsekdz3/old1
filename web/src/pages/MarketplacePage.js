import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiPlus, FiSearch, FiUpload, FiDownload, FiStar,
  FiX, FiMessageCircle, FiPackage, FiFilter, FiGrid, FiList,
  FiDollarSign, FiTag, FiChevronLeft, FiChevronRight, FiHeart,
  FiShare2, FiCheck, FiAlertCircle, FiArrowLeft, FiSend, FiEye
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';

const CATEGORIES = ['All', 'Digital Art', 'Templates', 'Music', 'Videos', 'eBooks', 'Software', 'Courses', 'Photos', 'Other'];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
];

const STAR_COLOR = '#f59e0b';

function StarRow({ rating, size = 16 }) {
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
  const icons = {
    pdf: '📄', zip: '🗜️', mp3: '🎵', mp4: '🎬', mov: '🎬',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️',
    avi: '🎬', epub: '📚', docx: '📝',
  };
  return <span className="text-2xl">{icons[type?.toLowerCase()] || '📦'}</span>;
}

function ProductCard({ product, onView, onBuy, onMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm hover:shadow-md transition-all overflow-hidden cursor-pointer group border border-gray-100"
      onClick={() => onView(product)}
    >
      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 relative overflow-hidden">
        {product.preview_url || product.thumbnail_url ? (
          <img
            src={product.preview_url || product.thumbnail_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <FileIcon type={product.file_type} />
          </div>
        )}
        {product.is_free && (
          <span className="absolute top-2 left-2 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">FREE</span>
        )}
        <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full flex items-center gap-1">
          <FiDownload size={10} /> {product.download_count}
        </span>
      </div>
      <div className="p-3">
        <p className="text-xs text-[#25D366] font-medium mb-0.5">{product.category}</p>
        <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 mb-1">{product.title}</h3>
        <div className="flex items-center gap-1 mb-2">
          <StarRow rating={product.rating_avg} size={12} />
          <span className="text-xs text-gray-500">({product.rating_count})</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            {product.is_free
              ? <span className="text-green-600 font-bold text-sm">Free</span>
              : <span className="font-bold text-gray-900 text-sm">${product.price.toFixed(2)}</span>
            }
          </div>
          <div className="flex gap-1">
            <button
              onClick={e => { e.stopPropagation(); onMessage(product); }}
              className="p-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 transition text-gray-600"
              title="Message seller"
            >
              <FiMessageCircle size={14} />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onBuy(product); }}
              className="px-3 py-1.5 bg-[#25D366] text-white text-xs font-semibold rounded-lg hover:bg-[#128C7E] transition"
            >
              {product.is_free ? 'Get' : 'Buy'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProductModal({ product, onClose, user }) {
  const [reviews, setReviews] = useState([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [purchasing, setPurchasing] = useState(false);
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    api.get(`/marketplace/products/${product.id}/reviews`)
      .then(r => setReviews(r.data.reviews || []))
      .catch(() => {});
    api.get('/marketplace/my-purchases')
      .then(r => {
        const hasPurchase = (r.data.purchases || []).some(p => p.product_id === product.id);
        setPurchased(hasPurchase || product.is_free);
      })
      .catch(() => {});
  }, [product.id, product.is_free]);

  const handleBuy = async () => {
    if (purchased) {
      handleDownload();
      return;
    }
    setPurchasing(true);
    try {
      const res = await api.post(`/marketplace/products/${product.id}/purchase`, {
        payment_provider: 'stripe',
      });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      } else if (res.data.download_url) {
        setPurchased(true);
        toast.success('Download ready!');
        window.open(res.data.download_url, '_blank');
      }
    } catch (e) {
      const msg = e.response?.data?.error || 'Purchase failed';
      if (msg.includes('Already purchased')) {
        setPurchased(true);
        handleDownload();
      } else {
        toast.error(msg);
      }
    } finally {
      setPurchasing(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(`/marketplace/products/${product.id}/download`);
      window.open(res.data.download_url, '_blank');
      toast.success('Download started!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Download failed');
    }
  };

  const submitReview = async () => {
    setSubmittingReview(true);
    try {
      const res = await api.post(`/marketplace/products/${product.id}/reviews`, {
        rating: myRating,
        comment: myComment,
      });
      setReviews(prev => [res.data, ...prev]);
      setMyComment('');
      toast.success('Review submitted!');
    } catch (e) {
      toast.error(e.response?.data?.error || 'Review failed');
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {(product.preview_url || product.thumbnail_url) && (
          <div className="aspect-video bg-gray-100 rounded-t-3xl overflow-hidden">
            <img src={product.preview_url || product.thumbnail_url} alt={product.title} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <span className="text-xs text-[#25D366] font-semibold uppercase tracking-wide">{product.category}</span>
              <h2 className="text-xl font-bold text-gray-900 mt-0.5">{product.title}</h2>
              <div className="flex items-center gap-2 mt-1">
                <StarRow rating={product.rating_avg} />
                <span className="text-sm text-gray-500">{product.rating_avg} ({product.rating_count} reviews)</span>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <FiX size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 mb-4 pb-4 border-b">
            {product.seller_avatar && (
              <img src={product.seller_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-900">{product.seller_name}</p>
              {product.seller_verified && <span className="text-xs text-blue-500">✅ Verified</span>}
            </div>
            <div className="ml-auto flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1"><FiEye size={14} /> {product.view_count}</span>
              <span className="flex items-center gap-1"><FiDownload size={14} /> {product.download_count}</span>
            </div>
          </div>

          {product.description && (
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-1">Description</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            </div>
          )}

          {product.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {product.tags.map(t => (
                <span key={t} className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{t}</span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 mb-6">
            <div>
              {product.is_free
                ? <span className="text-2xl font-bold text-green-600">Free</span>
                : <span className="text-2xl font-bold text-gray-900">${product.price.toFixed(2)}</span>
              }
              <p className="text-xs text-gray-500">{product.license_type} license</p>
            </div>
            <div className="flex-1 flex gap-2">
              {user && product.seller_id !== user.id && (
                <button
                  onClick={handleBuy}
                  disabled={purchasing}
                  className="flex-1 py-3 bg-[#25D366] text-white font-bold rounded-2xl hover:bg-[#128C7E] transition disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {purchasing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : purchased ? (
                    <><FiDownload size={18} /> Download</>
                  ) : product.is_free ? (
                    <><FiDownload size={18} /> Download Free</>
                  ) : (
                    <><FiDollarSign size={18} /> Buy Now</>
                  )}
                </button>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-semibold text-gray-900 mb-3">Reviews</h3>
            {user && purchased && product.seller_id !== user.id && (
              <div className="bg-gray-50 rounded-2xl p-4 mb-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Leave a review</p>
                <div className="flex gap-1 mb-2">
                  {[1,2,3,4,5].map(i => (
                    <button key={i} onClick={() => setMyRating(i)}>
                      <FiStar size={20}
                        fill={i <= myRating ? STAR_COLOR : 'none'}
                        stroke={i <= myRating ? STAR_COLOR : '#d1d5db'}
                      />
                    </button>
                  ))}
                </div>
                <textarea
                  value={myComment}
                  onChange={e => setMyComment(e.target.value)}
                  placeholder="Share your experience..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                  rows={2}
                />
                <button
                  onClick={submitReview}
                  disabled={submittingReview}
                  className="mt-2 px-4 py-2 bg-[#25D366] text-white text-sm font-semibold rounded-xl hover:bg-[#128C7E] transition disabled:opacity-60"
                >
                  {submittingReview ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            )}
            <div className="space-y-3">
              {reviews.length === 0 && <p className="text-sm text-gray-400 text-center py-4">No reviews yet</p>}
              {reviews.map(r => (
                <div key={r.id} className="flex gap-3">
                  {r.reviewer_avatar
                    ? <img src={r.reviewer_avatar} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">{r.reviewer_name?.[0]}</div>
                  }
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{r.reviewer_name}</span>
                      <StarRow rating={r.rating} size={12} />
                    </div>
                    {r.comment && <p className="text-sm text-gray-600 mt-0.5">{r.comment}</p>}
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function UploadModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'Digital Art',
    price: '', currency: 'USD', tags: '', license_type: 'standard',
  });
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a file to upload'); return; }
    setUploading(true);
    setProgress(0);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => fd.append(k, v));
      fd.append('file', file);
      if (preview) fd.append('preview', preview);

      const res = await api.post('/marketplace/products', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => setProgress(Math.round((e.loaded * 100) / e.total)),
      });
      toast.success('Product listed successfully!');
      onSuccess(res.data);
    } catch (e) {
      toast.error(e.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">List a Product</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100"><FiX size={20} /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Title *</label>
              <input
                required
                value={form.title}
                onChange={e => setForm(p => ({...p, title: e.target.value}))}
                placeholder="Product title"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({...p, description: e.target.value}))}
                placeholder="Describe your product..."
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({...p, category: e.target.value}))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                >
                  {CATEGORIES.slice(1).map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Price (USD)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={e => setForm(p => ({...p, price: e.target.value}))}
                  placeholder="0.00 = Free"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Tags (comma separated)</label>
              <input
                value={form.tags}
                onChange={e => setForm(p => ({...p, tags: e.target.value}))}
                placeholder="design, template, branding"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Product File *</label>
              <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#25D366] transition">
                <FiUpload size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">{file ? file.name : 'Click to upload'}</p>
                  <p className="text-xs text-gray-400">PDF, ZIP, MP3, MP4, PNG, JPG, etc.</p>
                </div>
                <input type="file" className="hidden" onChange={e => setFile(e.target.files[0])} />
              </label>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Preview Image (optional)</label>
              <label className="flex items-center gap-3 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-[#25D366] transition">
                <FiEye size={20} className="text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700">{preview ? preview.name : 'Upload preview'}</p>
                  <p className="text-xs text-gray-400">PNG, JPG, GIF</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files[0];
                    setPreview(f);
                    if (f) setPreviewUrl(URL.createObjectURL(f));
                  }}
                />
              </label>
              {previewUrl && <img src={previewUrl} alt="preview" className="mt-2 rounded-xl h-24 object-cover w-full" />}
            </div>

            {uploading && (
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-[#25D366] h-2 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <button
              type="submit"
              disabled={uploading}
              className="w-full py-3 bg-[#25D366] text-white font-bold rounded-2xl hover:bg-[#128C7E] transition disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Uploading {progress}%</>
              ) : (
                <><FiUpload size={18} /> List Product</>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

function MessagePanel({ product, onClose, user }) {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);
  const receiverId = product.seller_id;

  useEffect(() => {
    api.get(`/marketplace/messages?with=${receiverId}`)
      .then(r => setMessages(r.data.messages || []))
      .catch(() => {});
  }, [receiverId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const res = await api.post('/marketplace/messages', {
        receiver_id: receiverId,
        content: text.trim(),
        product_id: product.id,
      });
      setMessages(prev => [...prev, res.data]);
      setText('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md h-[70vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 p-4 border-b">
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><FiArrowLeft size={18} /></button>
          {product.seller_avatar
            ? <img src={product.seller_avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
            : <div className="w-8 h-8 rounded-full bg-[#25D366] flex items-center justify-center text-white text-xs font-bold">{product.seller_name?.[0]}</div>
          }
          <div>
            <p className="font-semibold text-sm">{product.seller_name}</p>
            <p className="text-xs text-gray-500 truncate max-w-[160px]">Re: {product.title}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              <FiMessageCircle size={32} className="mx-auto mb-2 opacity-40" />
              Ask the seller about this product
            </div>
          )}
          {messages.map(m => (
            <div key={m.id} className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === user?.id ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-900'}`}>
                {m.content}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        <div className="p-4 border-t flex gap-2">
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
          />
          <button
            onClick={send}
            disabled={sending || !text.trim()}
            className="w-10 h-10 bg-[#25D366] text-white rounded-full flex items-center justify-center hover:bg-[#128C7E] disabled:opacity-40 transition"
          >
            <FiSend size={16} />
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function MarketplacePage({ onBack }) {
  const { user } = useAuthStore();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [viewMode, setViewMode] = useState('grid');
  const [tab, setTab] = useState('browse');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [messageProduct, setMessageProduct] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [myProducts, setMyProducts] = useState([]);
  const [myPurchases, setMyPurchases] = useState([]);
  const searchDebounce = useRef(null);

  const fetchProducts = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = {
        page: pg, per_page: 20, sort,
        ...(category !== 'All' && { category }),
        ...(search && { search }),
      };
      const res = await api.get('/marketplace/products', { params });
      setProducts(res.data.products || []);
      setTotalPages(res.data.pages || 1);
      setTotalProducts(res.data.total || 0);
      setPage(pg);
    } catch (e) {
      toast.error('Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, [sort, category, search]);

  useEffect(() => {
    if (tab === 'browse') fetchProducts(1);
    else if (tab === 'selling') {
      api.get('/marketplace/my-products').then(r => setMyProducts(r.data.products || []));
    } else if (tab === 'purchases') {
      api.get('/marketplace/my-purchases').then(r => setMyPurchases(r.data.purchases || []));
    }
  }, [tab, fetchProducts]);

  useEffect(() => {
    clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => fetchProducts(1), 400);
  }, [search, sort, category]);

  const handleBuy = async (product) => {
    if (!user) { toast.error('Please log in'); return; }
    setSelectedProduct(product);
  };

  const handleUploadSuccess = (product) => {
    setShowUpload(false);
    setMyProducts(prev => [product, ...prev]);
    setTab('selling');
    toast.success('Product listed!');
  };

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 shadow-sm">
        {onBack && (
          <button onClick={onBack} className="p-1 rounded-full hover:bg-white/10">
            <FiArrowLeft size={20} />
          </button>
        )}
        <FiShoppingBag size={22} />
        <div className="flex-1">
          <h1 className="font-bold text-lg leading-tight">Marketplace</h1>
          <p className="text-white/70 text-xs">{totalProducts.toLocaleString()} products</p>
        </div>
        {user && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-[#1da055] transition"
          >
            <FiPlus size={16} /> Sell
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-100">
        {[
          { key: 'browse', label: 'Browse' },
          { key: 'selling', label: 'My Store' },
          { key: 'purchases', label: 'Purchases' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-semibold transition ${tab === t.key ? 'text-[#25D366] border-b-2 border-[#25D366]' : 'text-gray-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <>
          {/* Search & Filters */}
          <div className="bg-white px-4 py-3 space-y-3 border-b border-gray-100">
            <div className="flex gap-2">
              <div className="flex-1 flex items-center gap-2 bg-gray-50 rounded-full px-4 py-2 border border-gray-200">
                <FiSearch size={16} className="text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search products..."
                  className="flex-1 bg-transparent text-sm focus:outline-none"
                />
              </div>
              <div className="flex gap-1">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <FiGrid size={16} />
                </button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-600'}`}>
                  <FiList size={16} />
                </button>
              </div>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {CATEGORIES.map(c => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition ${category === c ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <FiFilter size={14} className="text-gray-400" />
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none"
              >
                {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                    <div className="aspect-video bg-gray-200" />
                    <div className="p-3 space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/2" />
                      <div className="h-4 bg-gray-200 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : products.length === 0 ? (
              <div className="text-center py-16">
                <FiPackage size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">No products found</p>
                <p className="text-gray-400 text-sm mt-1">Try a different search or category</p>
                {user && (
                  <button onClick={() => setShowUpload(true)} className="mt-4 px-6 py-2.5 bg-[#25D366] text-white rounded-full font-semibold text-sm hover:bg-[#128C7E] transition">
                    List the first product
                  </button>
                )}
              </div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 gap-3' : 'space-y-3'}>
                  {products.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onView={setSelectedProduct}
                      onBuy={handleBuy}
                      onMessage={prod => user ? setMessageProduct(prod) : toast.error('Please log in')}
                    />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button onClick={() => fetchProducts(page - 1)} disabled={page === 1} className="p-2 rounded-full bg-white shadow disabled:opacity-40">
                      <FiChevronLeft size={18} />
                    </button>
                    <span className="text-sm text-gray-600">{page} / {totalPages}</span>
                    <button onClick={() => fetchProducts(page + 1)} disabled={page === totalPages} className="p-2 rounded-full bg-white shadow disabled:opacity-40">
                      <FiChevronRight size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {tab === 'selling' && (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-900">My Products ({myProducts.length})</h2>
            <button onClick={() => setShowUpload(true)} className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-[#128C7E] transition">
              <FiPlus size={14} /> Add
            </button>
          </div>
          {myProducts.length === 0 ? (
            <div className="text-center py-16">
              <FiShoppingBag size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No products listed yet</p>
              <button onClick={() => setShowUpload(true)} className="mt-4 px-6 py-2.5 bg-[#25D366] text-white rounded-full font-semibold text-sm hover:bg-[#128C7E] transition">
                List your first product
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myProducts.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <FileIcon type={p.file_type} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{p.title}</p>
                    <p className="text-xs text-gray-500">{p.download_count} downloads · {p.rating_count} reviews</p>
                    <p className="text-sm font-bold text-[#25D366]">{p.is_free ? 'Free' : `$${p.price.toFixed(2)}`}</p>
                  </div>
                  <div className={`px-2 py-0.5 rounded-full text-xs font-semibold ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {p.is_active ? 'Active' : 'Hidden'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'purchases' && (
        <div className="flex-1 overflow-y-auto p-4">
          <h2 className="font-bold text-gray-900 mb-4">My Purchases ({myPurchases.length})</h2>
          {myPurchases.length === 0 ? (
            <div className="text-center py-16">
              <FiDownload size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No purchases yet</p>
              <button onClick={() => setTab('browse')} className="mt-4 px-6 py-2.5 bg-[#25D366] text-white rounded-full font-semibold text-sm hover:bg-[#128C7E] transition">
                Browse Marketplace
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myPurchases.map(p => (
                <div key={p.id} className="bg-white rounded-2xl p-4 flex items-center gap-3 shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.product?.thumbnail_url
                      ? <img src={p.product.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      : <FileIcon type={p.product?.file_type} />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900 truncate">{p.product?.title}</p>
                    <p className="text-xs text-gray-500">{p.product?.seller_name} · {new Date(p.created_at).toLocaleDateString()}</p>
                    <p className="text-sm font-bold text-gray-700">{p.amount_paid === 0 ? 'Free' : `$${p.amount_paid.toFixed(2)}`}</p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const res = await api.get(`/marketplace/products/${p.product_id}/download`);
                        window.open(res.data.download_url, '_blank');
                      } catch { toast.error('Download failed'); }
                    }}
                    className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-full text-sm font-semibold hover:bg-[#128C7E] transition"
                  >
                    <FiDownload size={14} /> Download
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {selectedProduct && (
          <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} user={user} />
        )}
        {messageProduct && user && (
          <MessagePanel product={messageProduct} onClose={() => setMessageProduct(null)} user={user} />
        )}
        {showUpload && (
          <UploadModal onClose={() => setShowUpload(false)} onSuccess={handleUploadSuccess} />
        )}
      </AnimatePresence>
    </div>
  );
}
