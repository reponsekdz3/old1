import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiShoppingBag, FiPackage, FiSearch, FiFilter, FiStar,
  FiHeart, FiTruck, FiShield, FiChevronLeft, FiChevronRight,
  FiX, FiCheck, FiBarChart2, FiDollarSign, FiTag, FiGlobe, FiAward,
} from 'react-icons/fi';
import api from '../services/api';
import { useAuthStore } from '../services/store';
import toast from 'react-hot-toast';
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

const CATEGORIES = [
  'All', 'Clothing & Fashion', 'Electronics', 'Home & Living', 'Sports & Outdoors',
  'Beauty & Personal Care', 'Books & Stationery', 'Toys & Games', 'Jewelry & Accessories',
  'Food & Groceries', 'Health & Wellness', 'Art & Crafts', 'Automotive', 'Other',
];
const SORTS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Best Sellers' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'top_rated', label: 'Top Rated' },
  { value: 'featured', label: 'Featured' },
];

const TABS = [
  { id: 'discover', label: 'Shop', icon: FiShoppingBag },
  { id: 'orders', label: 'My Orders', icon: FiPackage },
  { id: 'sell', label: 'Sell', icon: FiTag },
  { id: 'seller_orders', label: 'Sales', icon: FiBarChart2 },
  { id: 'wallet', label: 'Wallet', icon: FiDollarSign },
];

function fmt(n) {
  if (n >= 1e6) return `${(n/1e6).toFixed(1)}M`;
  if (n >= 1000) return `${(n/1000).toFixed(1)}K`;
  return String(n || 0);
}
function money(n, cur = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur }).format(n || 0);
}

function StarRow({ rating, size = 13 }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <FiStar key={i} size={size}
          fill={i <= Math.round(rating) ? '#f59e0b' : 'none'}
          stroke={i <= Math.round(rating) ? '#f59e0b' : '#d1d5db'} />
      ))}
    </div>
  );
}

function Spinner({ size = 18 }) {
  return <div style={{ width: size, height: size }} className="border-2 border-current border-t-transparent rounded-full animate-spin" />;
}

function Badge({ children, color = 'green' }) {
  const cls = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    purple: 'bg-purple-100 text-purple-700',
    gray: 'bg-gray-100 text-gray-500',
  };
  return <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls[color]||cls.gray}`}>{children}</span>;
}

// ── Product Card ───────────────────────────────────────────────────────────────
function ProductCard({ product, onView, onWishlist, wishlisted }) {
  const [wl, setWl] = useState(wishlisted);
  const [wlLoading, setWlLoading] = useState(false);
  const imgs = product.images || [];
  const thumb = product.thumbnail_url || imgs[0];
  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100)
    : 0;

  const toggleWishlist = async (e) => {
    e.stopPropagation();
    setWlLoading(true);
    try {
      await api.post(`/physical/products/${product.id}/wishlist`);
      setWl(!wl);
    } catch {}
    setWlLoading(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden cursor-pointer group border border-gray-100"
      onClick={() => onView(product)}
    >
      <div className="relative aspect-square bg-gray-50 overflow-hidden">
        {thumb ? (
          <img src={thumb} alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl">🛍️</div>
        )}
        {discount > 0 && (
          <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            -{discount}%
          </div>
        )}
        {product.is_featured && (
          <div className="absolute top-2 left-2 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">⚡ Featured</div>
        )}
        <button onClick={toggleWishlist} disabled={wlLoading}
          className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center shadow transition opacity-0 group-hover:opacity-100 ${wl ? 'bg-red-500 text-white' : 'bg-white text-gray-400 hover:text-red-500'}`}>
          {wlLoading ? <Spinner size={14} /> : <FiHeart size={14} fill={wl ? 'white' : 'none'} />}
        </button>
        {!product.in_stock && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="text-white font-bold text-sm bg-black/60 px-3 py-1 rounded-full">Out of Stock</span>
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-xs text-gray-400 mb-0.5 truncate">{product.category}</div>
        <div className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{product.title}</div>
        {product.brand && <div className="text-xs text-gray-400 mt-0.5">{product.brand}</div>}
        <div className="flex items-center gap-1 mt-1">
          <StarRow rating={product.rating_avg} size={11} />
          {product.rating_count > 0 && <span className="text-xs text-gray-400">({product.rating_count})</span>}
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="font-bold text-[#075E54] text-sm">{money(product.price, product.currency)}</span>
          {discount > 0 && (
            <span className="text-xs text-gray-400 line-through">{money(product.original_price, product.currency)}</span>
          )}
        </div>
        {product.shipping_cost === 0 && (
          <div className="text-xs text-green-600 flex items-center gap-1 mt-1">
            <FiTruck size={11} /> Free Shipping
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Product Detail Modal ───────────────────────────────────────────────────────
function ProductDetail({ product, onClose, onOrder }) {
  const [selSize, setSelSize] = useState('');
  const [selColor, setSelColor] = useState('');
  const [selVariant, setSelVariant] = useState(null);
  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const imgs = product.images || [];
  const variants = product.variants || [];
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))];
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];
  const discount = product.original_price && product.original_price > product.price
    ? Math.round((1 - product.price / product.original_price) * 100) : 0;

  useEffect(() => {
    if (variants.length > 0 && !product.has_variants) return;
    const match = variants.find(v =>
      (!selSize || v.size === selSize) && (!selColor || v.color === selColor)
    );
    setSelVariant(match || null);
  }, [selSize, selColor, variants, product.has_variants]);

  const price = product.price + (selVariant?.price_modifier || 0);
  const inStock = selVariant ? selVariant.stock_quantity > 0 : product.in_stock;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ y: 100, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        {/* Images */}
        <div className="relative aspect-square bg-gray-50 rounded-t-3xl sm:rounded-t-2xl overflow-hidden">
          {imgs.length > 0 ? (
            <>
              <img src={imgs[imgIdx]} alt={product.title} className="w-full h-full object-cover" />
              {imgs.length > 1 && (
                <>
                  <button onClick={() => setImgIdx(i => Math.max(0, i - 1))}
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
                    <FiChevronLeft />
                  </button>
                  <button onClick={() => setImgIdx(i => Math.min(imgs.length - 1, i + 1))}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow">
                    <FiChevronRight />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                    {imgs.map((_, i) => (
                      <button key={i} onClick={() => setImgIdx(i)}
                        className={`w-2 h-2 rounded-full transition ${i === imgIdx ? 'bg-white' : 'bg-white/50'}`} />
                    ))}
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-8xl">🛍️</div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow">
            <FiX />
          </button>
          {discount > 0 && (
            <div className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
              -{discount}% OFF
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="text-xs text-gray-400 mb-0.5">{product.category} {product.brand && `· ${product.brand}`}</div>
              <h2 className="text-xl font-bold text-gray-900">{product.title}</h2>
            </div>
            {product.seller_verified && <FiAward className="text-blue-500 flex-shrink-0 mt-1" size={20} title="Verified Seller" />}
          </div>

          <div className="flex items-center gap-3 mt-2">
            <StarRow rating={product.rating_avg} />
            <span className="text-sm text-gray-500">{product.rating_count} reviews</span>
            <span className="text-sm text-gray-400">·</span>
            <span className="text-sm text-gray-500">{fmt(product.sale_count)} sold</span>
          </div>

          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-[#075E54]">{money(price, product.currency)}</span>
            {discount > 0 && (
              <span className="text-lg text-gray-400 line-through">{money(product.original_price, product.currency)}</span>
            )}
          </div>

          {/* Variants */}
          {sizes.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Size</div>
              <div className="flex flex-wrap gap-2">
                {sizes.map(s => (
                  <button key={s} onClick={() => setSelSize(selSize === s ? '' : s)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${selSize === s ? 'border-[#075E54] bg-[#075E54] text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {colors.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-700 mb-2">Color</div>
              <div className="flex flex-wrap gap-2">
                {colors.map(c => (
                  <button key={c} onClick={() => setSelColor(selColor === c ? '' : c)}
                    className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition ${selColor === c ? 'border-[#075E54] bg-[#075E54] text-white' : 'border-gray-200 text-gray-700 hover:border-gray-400'}`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-4 flex items-center gap-4">
            <div className="text-sm font-semibold text-gray-700">Qty:</div>
            <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden">
              <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50">-</button>
              <span className="w-10 text-center font-semibold text-gray-800">{qty}</span>
              <button onClick={() => setQty(q => q + 1)} className="w-9 h-9 flex items-center justify-center text-gray-600 hover:bg-gray-50">+</button>
            </div>
            {selVariant && (
              <span className="text-sm text-gray-400">{selVariant.stock_quantity} available</span>
            )}
          </div>

          {/* Shipping & Returns */}
          <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FiTruck size={15} className="text-green-500" />
              {product.shipping_cost === 0 ? 'Free Shipping' : `Shipping: ${money(product.shipping_cost, product.currency)}`}
              {product.estimated_delivery_days && ` · Est. ${product.estimated_delivery_days} days`}
            </div>
            {product.returns_accepted && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FiShield size={15} className="text-blue-500" />
                {product.return_days}-day return policy · Buyer protection
              </div>
            )}
            {product.ships_internationally && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <FiGlobe size={15} className="text-purple-500" />
                Ships internationally
              </div>
            )}
          </div>

          {/* Description */}
          {product.description && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-700 mb-1">Description</div>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{product.description}</p>
            </div>
          )}

          {/* Escrow info */}
          <div className="mt-4 p-3 bg-blue-50 rounded-xl flex items-center gap-3">
            <FiShield className="text-blue-500 flex-shrink-0" size={20} />
            <div className="text-xs text-blue-700">
              <span className="font-semibold">5-Day Buyer Protection Escrow.</span>{' '}
              Payment is held securely. Funds release to seller only after you confirm delivery.
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={() => inStock && onOrder(product, selVariant?.id, qty)}
            disabled={!inStock}
            className={`w-full mt-5 py-4 rounded-2xl font-bold text-lg transition ${inStock
              ? 'bg-[#075E54] hover:bg-[#064e46] text-white shadow-lg shadow-green-200'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
            {inStock ? `Buy Now · ${money(price * qty, product.currency)}` : 'Out of Stock'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Checkout Modal ─────────────────────────────────────────────────────────────
function CheckoutModal({ product, variantId, qty, onClose, onSuccess }) {
  const [step, setStep] = useState('address'); // address | payment
  const [addr, setAddr] = useState({
    shipping_name: '', shipping_address_line1: '', shipping_address_line2: '',
    shipping_city: '', shipping_state: '', shipping_zip: '', shipping_country: '',
    shipping_phone: '', buyer_note: '',
  });
  const [payment, setPayment] = useState('stripe');
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState('');

  async function createOrder() {
    setLoading(true);
    try {
      const res = await api.post('/physical/orders', {
        product_id: product.id,
        variant_id: variantId || null,
        quantity: qty,
        payment_provider: payment,
        ...addr,
      });
      setOrder(res.data.order);
      return res.data.order;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create order');
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function startStripe(createdOrder) {
    setLoading(true);
    try {
      const res = await api.post(`/physical/orders/${createdOrder.id}/payment/stripe`);
      setClientSecret(res.data.client_secret);
      setStep('payment');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Stripe payment failed');
    } finally {
      setLoading(false);
    }
  }

  async function startFlutterwave(createdOrder) {
    setLoading(true);
    try {
      const res = await api.post(`/physical/orders/${createdOrder.id}/payment/flutterwave`);
      const fw = res.data;

      if (!window.FlutterwaveCheckout) {
        const script = document.createElement('script');
        script.src = 'https://checkout.flutterwave.com/v3.js';
        script.onload = () => initFW(fw, createdOrder);
        document.body.appendChild(script);
      } else {
        initFW(fw, createdOrder);
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Flutterwave payment failed');
    } finally {
      setLoading(false);
    }
  }

  function initFW(fw, createdOrder) {
    window.FlutterwaveCheckout({
      public_key: fw.public_key,
      tx_ref: fw.tx_ref,
      amount: fw.amount,
      currency: fw.currency,
      customer: { email: fw.customer_email, name: fw.customer_name, phone_number: fw.customer_phone },
      meta: fw.meta,
      customizations: { title: 'VipChat Store', description: fw.description, logo: '/logo192.png' },
      callback: async (response) => {
        if (response.status === 'successful') {
          try {
            await api.post(`/physical/orders/${createdOrder.id}/payment/flutterwave/verify`, { tx_ref: fw.tx_ref });
            toast.success('Payment confirmed!');
            onSuccess(createdOrder);
          } catch { toast.error('Payment verification failed'); }
        } else {
          toast.error('Payment was not completed');
        }
      },
      onclose: () => {},
    });
  }

  async function handleProceed() {
    const createdOrder = await createOrder();
    if (!createdOrder) return;
    if (payment === 'stripe') await startStripe(createdOrder);
    else if (payment === 'flutterwave') await startFlutterwave(createdOrder);
    else setStep('payment'); // PayPal handled by PayPal buttons
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="bg-white rounded-t-3xl sm:rounded-2xl w-full sm:max-w-lg max-h-[95vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX /></button>
          </div>

          {/* Order summary */}
          <div className="bg-gray-50 rounded-xl p-3 mb-5 flex items-center gap-3">
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
              {product.thumbnail_url
                ? <img src={product.thumbnail_url} alt={product.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl">🛍️</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-gray-900 truncate">{product.title}</div>
              <div className="text-xs text-gray-400">Qty: {qty}</div>
            </div>
            <div className="font-bold text-[#075E54]">{money(product.price * qty, product.currency)}</div>
          </div>

          {step === 'address' && (
            <>
              <h3 className="font-semibold text-gray-700 mb-3">Shipping Address</h3>
              <div className="space-y-3">
                {[
                  { key: 'shipping_name', placeholder: 'Full Name', required: true },
                  { key: 'shipping_address_line1', placeholder: 'Street Address', required: true },
                  { key: 'shipping_address_line2', placeholder: 'Apartment, suite, etc. (optional)' },
                  { key: 'shipping_city', placeholder: 'City', required: true },
                  { key: 'shipping_state', placeholder: 'State / Province' },
                  { key: 'shipping_zip', placeholder: 'Zip / Postal Code' },
                  { key: 'shipping_country', placeholder: 'Country', required: true },
                  { key: 'shipping_phone', placeholder: 'Phone Number' },
                  { key: 'buyer_note', placeholder: 'Note to seller (optional)' },
                ].map(({ key, placeholder, required }) => (
                  <input key={key} type="text" placeholder={placeholder + (required ? ' *' : '')}
                    value={addr[key]} onChange={e => setAddr(a => ({ ...a, [key]: e.target.value }))}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
                ))}
              </div>

              <h3 className="font-semibold text-gray-700 mt-5 mb-3">Payment Method</h3>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'stripe', label: 'Card', icon: '💳' },
                  { id: 'paypal', label: 'PayPal', icon: '🅿️' },
                  { id: 'flutterwave', label: 'Mobile Money', icon: '📱' },
                ].map(p => (
                  <button key={p.id} onClick={() => setPayment(p.id)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition text-sm font-medium ${payment === p.id ? 'border-[#075E54] bg-green-50 text-[#075E54]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    <span className="text-2xl">{p.icon}</span>
                    {p.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 flex items-center gap-2">
                <FiShield className="flex-shrink-0" />
                Payment held in escrow for 5 days. Released to seller after delivery confirmation.
              </div>

              <button onClick={handleProceed} disabled={loading || !addr.shipping_name || !addr.shipping_address_line1 || !addr.shipping_city || !addr.shipping_country}
                className="w-full mt-4 py-3.5 bg-[#075E54] text-white rounded-2xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                {loading ? <><Spinner size={18} /> Processing...</> : `Continue to Payment`}
              </button>
            </>
          )}

          {step === 'payment' && payment === 'stripe' && (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <FiCheck size={32} className="text-green-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">Order Created!</h3>
              <p className="text-gray-500 text-sm mb-4">Complete payment to confirm your order.</p>
              {clientSecret ? (
                <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-xl">
                  <p className="font-semibold text-gray-700 mb-2">Stripe Payment Ready</p>
                  <p>Order #{order?.order_number}</p>
                  <p className="mt-2 text-xs">Use Stripe.js in production to complete the payment with the client_secret.</p>
                  <button className="mt-3 w-full py-2.5 bg-[#075E54] text-white rounded-xl font-semibold"
                    onClick={async () => {
                      try {
                        await api.post(`/physical/orders/${order.id}/confirm-payment`, { payment_intent_id: order.payment_ref });
                        toast.success('Order confirmed!');
                        onSuccess(order);
                      } catch { toast.error('Confirmation failed'); }
                    }}>
                    Confirm Order (Demo)
                  </button>
                </div>
              ) : <Spinner />}
            </div>
          )}

          {step === 'payment' && payment === 'paypal' && order && (
            <PayPalScriptProvider options={{ 'client-id': process.env.REACT_APP_PAYPAL_CLIENT_ID || 'test' }}>
              <div className="mt-4">
                <PayPalButtons
                  createOrder={async () => {
                    const res = await api.post(`/physical/orders/${order.id}/payment/paypal`);
                    return res.data.paypal_order_id;
                  }}
                  onApprove={async (data) => {
                    try {
                      await api.post(`/physical/orders/${order.id}/confirm-payment`, { payment_ref: data.orderID });
                      toast.success('Payment confirmed!');
                      onSuccess(order);
                    } catch { toast.error('Payment confirmation failed'); }
                  }}
                  onError={() => toast.error('PayPal payment failed')}
                  style={{ layout: 'vertical', shape: 'rect' }}
                />
              </div>
            </PayPalScriptProvider>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Sell Form ─────────────────────────────────────────────────────────────────
function SellForm({ onSuccess }) {
  const [form, setForm] = useState({
    title: '', description: '', category: 'Clothing & Fashion', brand: '',
    price: '', original_price: '', currency: 'USD', stock_quantity: '10',
    condition: 'new', shipping_cost: '0', ships_from_country: '',
    estimated_delivery_days: '7', ships_internationally: false,
    returns_accepted: true, return_days: '14',
    tags: '', images: [],
  });
  const [variants, setVariants] = useState([]);
  const [loading, setLoading] = useState(false);

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        ...form,
        price: parseFloat(form.price),
        original_price: form.original_price ? parseFloat(form.original_price) : null,
        stock_quantity: parseInt(form.stock_quantity),
        shipping_cost: parseFloat(form.shipping_cost),
        estimated_delivery_days: parseInt(form.estimated_delivery_days),
        return_days: parseInt(form.return_days),
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        variants: variants.filter(v => v.size || v.color),
        has_variants: variants.length > 0,
      };
      const res = await api.post('/physical/products', payload);
      toast.success('Product listed successfully!');
      onSuccess(res.data.product);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create listing');
    } finally {
      setLoading(false);
    }
  }

  function addVariant() {
    setVariants(v => [...v, { size: '', color: '', price_modifier: 0, stock_quantity: 0 }]);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 pb-10">
      <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700 flex items-start gap-2">
        <FiShield className="flex-shrink-0 mt-0.5" />
        <div><strong>Seller Protection:</strong> 3% cashback on every sale. Funds auto-release in 5 days. Zero listing fees.</div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-sm font-semibold text-gray-700 mb-1">Product Title *</label>
          <input required value={form.title} onChange={e => f('title', e.target.value)}
            placeholder="e.g. Classic Linen Shirt — Beige" maxLength={255}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Category *</label>
          <select required value={form.category} onChange={e => f('category', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]">
            {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Condition</label>
          <select value={form.condition} onChange={e => f('condition', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]">
            <option value="new">New</option>
            <option value="used">Used</option>
            <option value="refurbished">Refurbished</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Price (USD) *</label>
          <input required type="number" min="0.01" step="0.01" value={form.price} onChange={e => f('price', e.target.value)}
            placeholder="29.99" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Original Price (for discount display)</label>
          <input type="number" min="0" step="0.01" value={form.original_price} onChange={e => f('original_price', e.target.value)}
            placeholder="49.99 (optional)" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Stock Quantity *</label>
          <input required type="number" min="0" value={form.stock_quantity} onChange={e => f('stock_quantity', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Brand</label>
          <input value={form.brand} onChange={e => f('brand', e.target.value)}
            placeholder="Brand name (optional)" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Shipping Cost (USD)</label>
          <input type="number" min="0" step="0.01" value={form.shipping_cost} onChange={e => f('shipping_cost', e.target.value)}
            placeholder="0 = Free" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Ships From (Country)</label>
          <input value={form.ships_from_country} onChange={e => f('ships_from_country', e.target.value)}
            placeholder="e.g. Kenya, USA" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1">Est. Delivery (days)</label>
          <input type="number" min="1" value={form.estimated_delivery_days} onChange={e => f('estimated_delivery_days', e.target.value)}
            className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        </div>

        <div className="flex items-center gap-3 mt-2">
          <input type="checkbox" id="ships_intl" checked={form.ships_internationally} onChange={e => f('ships_internationally', e.target.checked)} className="w-4 h-4" />
          <label htmlFor="ships_intl" className="text-sm text-gray-700">Ships Internationally</label>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <input type="checkbox" id="returns" checked={form.returns_accepted} onChange={e => f('returns_accepted', e.target.checked)} className="w-4 h-4" />
          <label htmlFor="returns" className="text-sm text-gray-700">Returns Accepted ({form.return_days} days)</label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
        <textarea value={form.description} onChange={e => f('description', e.target.value)} rows={4}
          placeholder="Detailed product description, materials, care instructions..." maxLength={2000}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366] resize-none" />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Tags (comma-separated)</label>
        <input value={form.tags} onChange={e => f('tags', e.target.value)}
          placeholder="e.g. shirt, linen, summer, fashion" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">Product Image URLs</label>
        <input value={(form.images || []).join(',')} onChange={e => f('images', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="https://... , https://... (comma-separated)" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
        <p className="text-xs text-gray-400 mt-1">Add image URLs, or upload images after creating the listing.</p>
      </div>

      {/* Variants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-gray-700">Product Variants (Size/Color)</label>
          <button type="button" onClick={addVariant}
            className="text-xs font-semibold text-[#075E54] border border-[#075E54] px-3 py-1 rounded-lg hover:bg-green-50">
            + Add Variant
          </button>
        </div>
        {variants.map((v, i) => (
          <div key={i} className="flex gap-2 mt-2 flex-wrap">
            <input placeholder="Size (e.g. M, L, XL)" value={v.size} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, size: e.target.value } : x))}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input placeholder="Color" value={v.color} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}
              className="flex-1 min-w-0 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="number" placeholder="Qty" value={v.stock_quantity} onChange={e => setVariants(vs => vs.map((x, j) => j === i ? { ...x, stock_quantity: e.target.value } : x))}
              className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button type="button" onClick={() => setVariants(vs => vs.filter((_, j) => j !== i))}
              className="text-red-400 hover:text-red-600"><FiX /></button>
          </div>
        ))}
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-4 bg-[#075E54] text-white rounded-2xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <><Spinner size={18} /> Creating Listing...</> : '🚀 List Product'}
      </button>
    </form>
  );
}

// ── Orders List ────────────────────────────────────────────────────────────────
function OrdersList({ role = 'buyer' }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    api.get(`/physical/orders?role=${role}&per_page=30`)
      .then(r => setOrders(r.data.orders || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role]);

  const statusColor = {
    awaiting_payment: 'gray', paid: 'blue', processing: 'blue', shipped: 'amber',
    delivered: 'green', completed: 'green', disputed: 'red', refunded: 'red', cancelled: 'gray',
  };

  async function confirmDelivery(order) {
    setActionLoading(order.id);
    try {
      const res = await api.post(`/physical/orders/${order.id}/confirm-delivery`);
      setOrders(os => os.map(o => o.id === order.id ? res.data.order : o));
      toast.success('Delivery confirmed! Funds released to seller.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setActionLoading(null);
    }
  }

  async function shipOrder(order) {
    const tracking = prompt('Enter tracking number:');
    if (!tracking) return;
    const carrier = prompt('Enter carrier (e.g. DHL, FedEx, UPS, USPS):') || 'Other';
    setActionLoading(order.id);
    try {
      const res = await api.post(`/physical/orders/${order.id}/ship`, { tracking_number: tracking, tracking_carrier: carrier });
      setOrders(os => os.map(o => o.id === order.id ? res.data.order : o));
      toast.success('Order marked as shipped!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) return <div className="flex justify-center py-12"><Spinner size={32} /></div>;
  if (orders.length === 0) return (
    <div className="text-center py-16 text-gray-400">
      <FiPackage size={48} className="mx-auto mb-3 opacity-30" />
      <p className="font-semibold">{role === 'buyer' ? 'No orders yet' : 'No sales yet'}</p>
      <p className="text-sm mt-1">{role === 'buyer' ? 'Your purchases will appear here' : 'When you make a sale, it appears here'}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {orders.map(order => (
        <div key={order.id} className="bg-white rounded-2xl border border-gray-100 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-sm text-gray-800">#{order.order_number}</span>
                <Badge color={statusColor[order.status] || 'gray'}>{order.status.replace(/_/g, ' ')}</Badge>
                {order.escrow_status === 'held' && <Badge color="blue">🔒 Escrow</Badge>}
                {order.escrow_status === 'released' && <Badge color="green">✅ Released</Badge>}
              </div>
              <div className="text-sm text-gray-600 mt-1">{order.product_title}</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Qty: {order.quantity} · {money(order.total_amount, order.currency)}
                {order.seller_cashback_amount > 0 && (
                  <span className="text-green-600 ml-2">+${order.seller_cashback_amount.toFixed(2)} cashback</span>
                )}
              </div>
              {order.tracking_number && (
                <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                  <FiTruck size={11} /> {order.tracking_carrier}: {order.tracking_number}
                </div>
              )}
            </div>
            <div className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString()}</div>
          </div>

          <div className="flex gap-2 mt-3 flex-wrap">
            {role === 'buyer' && order.status === 'shipped' && (
              <button onClick={() => confirmDelivery(order)} disabled={actionLoading === order.id}
                className="text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
                {actionLoading === order.id ? <Spinner size={12} /> : <FiCheck size={12} />}
                Confirm Delivery
              </button>
            )}
            {role === 'seller' && order.status === 'paid' && (
              <button onClick={() => shipOrder(order)} disabled={actionLoading === order.id}
                className="text-xs bg-blue-500 text-white px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1 disabled:opacity-50">
                {actionLoading === order.id ? <Spinner size={12} /> : <FiTruck size={12} />}
                Mark Shipped
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Wallet Panel ───────────────────────────────────────────────────────────────
function WalletPanel({ role = 'seller' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(role === 'seller' ? '/physical/wallet/seller' : '/physical/wallet/buyer')
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [role]);

  if (loading) return <div className="flex justify-center py-8"><Spinner size={28} /></div>;
  if (!data) return null;

  const w = role === 'seller' ? data.wallet : data.wallet;

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-[#075E54] to-[#128C7E] rounded-2xl p-6 text-white">
        <div className="text-sm opacity-80 mb-1">{role === 'seller' ? 'Seller' : 'Buyer Loyalty'} Wallet</div>
        <div className="text-3xl font-bold">{money(w.available_balance || w.loyalty_balance, w.currency)}</div>
        <div className="text-sm opacity-70 mt-1">
          {role === 'seller' ? `$${(w.pending_balance||0).toFixed(2)} in escrow` : `$${(w.total_spent||0).toFixed(2)} total spent`}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {role === 'seller' ? (
          <>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-xs text-gray-400">Total Earned</div>
              <div className="text-lg font-bold text-gray-900">{money(w.total_earned, w.currency)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-xs text-gray-400">Total Cashback</div>
              <div className="text-lg font-bold text-green-600">{money(w.total_cashback, w.currency)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-xs text-gray-400">Total Sales</div>
              <div className="text-lg font-bold text-gray-900">{w.total_sales || 0}</div>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
              <div className="text-xs text-green-600">3% Cashback Rate</div>
              <div className="text-sm font-semibold text-green-700">Auto-credited per sale</div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-xs text-gray-400">Loyalty Credits</div>
              <div className="text-lg font-bold text-gray-900">{money(w.loyalty_balance, w.currency)}</div>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100">
              <div className="text-xs text-gray-400">Free Credits</div>
              <div className="text-lg font-bold text-amber-600">{w.free_product_credits || 0}</div>
            </div>
            <div className="bg-blue-50 col-span-2 rounded-xl p-4">
              <div className="text-xs text-blue-600 font-semibold">Next Free Credit in</div>
              <div className="text-lg font-bold text-blue-700">{money(data.next_free_credit_in)} spent</div>
              <div className="text-xs text-blue-500 mt-1">Every ${data.loyalty_threshold} spent → $10 free product credit</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PhysicalStorePage() {
  useAuthStore();
  const [tab, setTab] = useState('discover');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [checkoutProduct, setCheckoutProduct] = useState(null);
  const [checkoutVariantId, setCheckoutVariantId] = useState(null);
  const [checkoutQty, setCheckoutQty] = useState(1);
  const [freeShipping, setFreeShipping] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [walletRole, setWalletRole] = useState('seller');

  const loadProducts = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: 24, sort };
      if (category !== 'All') params.category = category;
      if (search) params.search = search;
      if (freeShipping) params.free_shipping = 'true';
      const res = await api.get('/physical/products', { params });
      setProducts(res.data.products || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.pages || 1);
      setPage(p);
    } catch { setProducts([]); }
    setLoading(false);
  }, [category, sort, search, freeShipping]);

  useEffect(() => { if (tab === 'discover') loadProducts(1); }, [tab, loadProducts]);

  return (
    <div className="flex flex-col h-full bg-[#f0f2f5]">
      {/* Header */}
      <div className="bg-[#075E54] text-white px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <FiShoppingBag size={22} />
        <div className="flex-1">
          <div className="font-bold text-lg leading-tight">VipChat Store</div>
          <div className="text-xs opacity-75">Physical Goods · Secure Escrow · 3% Cashback</div>
        </div>
        {total > 0 && tab === 'discover' && (
          <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">{total.toLocaleString()} items</span>
        )}
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
        {/* Discover tab */}
        {tab === 'discover' && (
          <div className="p-4 max-w-5xl mx-auto">
            {/* Search & Filter */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loadProducts(1)}
                  placeholder="Search products..." className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]" />
              </div>
              <button onClick={() => setShowFilters(!showFilters)}
                className={`w-10 h-10 flex items-center justify-center rounded-xl border ${showFilters ? 'bg-[#075E54] text-white border-[#075E54]' : 'bg-white border-gray-200 text-gray-600'}`}>
                <FiFilter size={16} />
              </button>
              <button onClick={() => loadProducts(1)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-[#075E54] text-white">
                <FiSearch size={16} />
              </button>
            </div>

            {showFilters && (
              <div className="bg-white rounded-xl p-4 mb-4 space-y-3 border border-gray-100">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs font-semibold text-gray-500 mb-1">Sort</div>
                    <select value={sort} onChange={e => { setSort(e.target.value); loadProducts(1); }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
                      {SORTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={freeShipping} onChange={e => { setFreeShipping(e.target.checked); loadProducts(1); }} />
                      Free Shipping Only
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
              {CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCategory(c); loadProducts(1); }}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition ${category === c ? 'bg-[#075E54] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-400'}`}>
                  {c}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Spinner size={32} /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <FiShoppingBag size={48} className="mx-auto mb-3 opacity-30" />
                <p className="font-semibold">No products found</p>
                <p className="text-sm mt-1">Try a different search or be the first to sell in this category!</p>
                <button onClick={() => setTab('sell')} className="mt-4 px-5 py-2 bg-[#075E54] text-white rounded-xl font-semibold text-sm">
                  Start Selling
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {products.map(p => (
                    <ProductCard key={p.id} product={p}
                      onView={setSelectedProduct}
                      onWishlist={() => {}}
                      wishlisted={false} />
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 mt-6">
                    <button disabled={page <= 1} onClick={() => loadProducts(page - 1)}
                      className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40">
                      <FiChevronLeft />
                    </button>
                    <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => loadProducts(page + 1)}
                      className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center disabled:opacity-40">
                      <FiChevronRight />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="font-bold text-lg text-gray-900 mb-4">My Purchases</h2>
            <div className="bg-blue-50 rounded-xl p-3 mb-4 text-xs text-blue-700 flex items-center gap-2">
              <FiShield size={14} /> <span>Your payments are protected by <strong>5-Day Buyer Escrow</strong>. Confirm delivery to release funds.</span>
            </div>
            <OrdersList role="buyer" />
          </div>
        )}

        {tab === 'sell' && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="font-bold text-lg text-gray-900 mb-1">Create a Listing</h2>
            <p className="text-sm text-gray-500 mb-4">Sell physical goods. Earn 3% cashback on every sale.</p>
            <SellForm onSuccess={p => { toast.success(`"${p.title}" listed!`); setTab('seller_orders'); }} />
          </div>
        )}

        {tab === 'seller_orders' && (
          <div className="p-4 max-w-2xl mx-auto">
            <h2 className="font-bold text-lg text-gray-900 mb-4">My Sales</h2>
            <OrdersList role="seller" />
          </div>
        )}

        {tab === 'wallet' && (
          <div className="p-4 max-w-lg mx-auto">
            <div className="flex items-center gap-2 mb-4">
              <button onClick={() => setWalletRole('seller')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold ${walletRole === 'seller' ? 'bg-[#075E54] text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                Seller Wallet
              </button>
              <button onClick={() => setWalletRole('buyer')}
                className={`flex-1 py-2 rounded-xl text-sm font-semibold ${walletRole === 'buyer' ? 'bg-[#075E54] text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
                Loyalty Wallet
              </button>
            </div>
            <WalletPanel role={walletRole} />
          </div>
        )}
      </div>

      {/* Product Detail Modal */}
      <AnimatePresence>
        {selectedProduct && (
          <ProductDetail
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            onOrder={(product, variantId, qty) => {
              setSelectedProduct(null);
              setCheckoutProduct(product);
              setCheckoutVariantId(variantId);
              setCheckoutQty(qty);
            }}
          />
        )}
      </AnimatePresence>

      {/* Checkout Modal */}
      <AnimatePresence>
        {checkoutProduct && (
          <CheckoutModal
            product={checkoutProduct}
            variantId={checkoutVariantId}
            qty={checkoutQty}
            onClose={() => setCheckoutProduct(null)}
            onSuccess={(order) => {
              setCheckoutProduct(null);
              toast.success(`Order #${order.order_number} placed!`);
              setTab('orders');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
