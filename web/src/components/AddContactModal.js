import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiUserPlus, FiSearch, FiPhone, FiChevronDown,
  FiCheck, FiAlertCircle, FiGlobe, FiUsers, FiUpload,
  FiInfo, FiCheckCircle, FiSend, FiUser,
  FiMessageSquare, FiGrid, FiCamera
} from 'react-icons/fi';
import { MdContactPhone } from 'react-icons/md';
import api from '../services/api';
import toast from 'react-hot-toast';
import { COUNTRIES, PRIORITY_COUNTRIES, getCountryByCode } from '../data/countries';

// ─── Country Selector ─────────────────────────────────────────────────────────
function CountrySelector({ selected, onSelect }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const filtered = search.length > 0
    ? COUNTRIES.filter(c => c.searchKey.includes(search.toLowerCase())).slice(0, 60)
    : [
        ...COUNTRIES.filter(c => PRIORITY_COUNTRIES.includes(c.code)),
        { divider: true, key: 'divider' },
        ...COUNTRIES.filter(c => !PRIORITY_COUNTRIES.includes(c.code)),
      ];

  useEffect(() => {
    const handleOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-3 bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-l-xl text-sm font-medium transition-colors min-w-[90px]"
      >
        <span className="text-xl leading-none">{selected?.flag || '🌐'}</span>
        <span className="text-gray-700 font-semibold">{selected?.dialCode || '+1'}</span>
        <FiChevronDown size={14} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 top-full mt-1 w-80 bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            {/* Search */}
            <div className="p-2 border-b border-gray-100 sticky top-0 bg-white">
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
                <FiSearch size={14} className="text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country or dial code..."
                  className="flex-1 bg-transparent text-sm outline-none"
                />
              </div>
            </div>

            {/* Country List */}
            <div className="overflow-y-auto max-h-64">
              {filtered.length === 0 && (
                <div className="py-6 text-center text-sm text-gray-500">No countries found</div>
              )}
              {filtered.map((country, i) => {
                if (country.divider) return (
                  <div key="divider" className="px-3 py-1 text-xs text-gray-400 font-medium bg-gray-50 border-t border-b border-gray-100">
                    All Countries
                  </div>
                );
                return (
                  <button
                    key={country.code + i}
                    type="button"
                    onClick={() => { onSelect(country); setOpen(false); setSearch(''); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-green-50 text-left transition-colors ${
                      selected?.code === country.code ? 'bg-green-50' : ''
                    }`}
                  >
                    <span className="text-xl leading-none">{country.flag}</span>
                    <span className="flex-1 text-sm text-gray-800 font-medium truncate">{country.name}</span>
                    <span className="text-xs text-gray-500 font-mono">{country.dialCode}</span>
                    {selected?.code === country.code && <FiCheck size={14} className="text-green-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Phone Validation Info Card ───────────────────────────────────────────────
function PhoneInfoCard({ info, loading }) {
  if (loading) return (
    <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center gap-3">
      <div className="animate-spin w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full shrink-0" />
      <span className="text-sm text-blue-700">Validating number worldwide...</span>
    </div>
  );

  if (!info) return null;

  const typeColors = {
    MOBILE: 'bg-green-100 text-green-700',
    FIXED_LINE: 'bg-blue-100 text-blue-700',
    VOIP: 'bg-purple-100 text-purple-700',
    FIXED_LINE_OR_MOBILE: 'bg-teal-100 text-teal-700',
    TOLL_FREE: 'bg-orange-100 text-orange-700',
    PREMIUM_RATE: 'bg-red-100 text-red-700',
    UNKNOWN: 'bg-gray-100 text-gray-600',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 space-y-3"
    >
      {/* Country Row */}
      <div className="flex items-center gap-3">
        <div className="text-3xl leading-none">{info.flag}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{info.countryName}</p>
          <p className="text-sm text-gray-600 font-mono">{info.international}</p>
        </div>
        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${typeColors[info.type] || typeColors.UNKNOWN}`}>
          {info.type?.replace(/_/g, ' ')}
        </span>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        {info.carrier && info.carrier !== 'Unknown' && (
          <div className="bg-white rounded-lg p-2">
            <p className="text-xs text-gray-500 mb-0.5">Carrier</p>
            <p className="text-xs font-semibold text-gray-800 truncate">{info.carrier}</p>
          </div>
        )}
        {info.timezone && (
          <div className="bg-white rounded-lg p-2">
            <p className="text-xs text-gray-500 mb-0.5">Timezone</p>
            <p className="text-xs font-semibold text-gray-800 truncate">{info.timezone}</p>
          </div>
        )}
        {info.location && (
          <div className="bg-white rounded-lg p-2">
            <p className="text-xs text-gray-500 mb-0.5">Location</p>
            <p className="text-xs font-semibold text-gray-800 truncate">{info.location}</p>
          </div>
        )}
        {info.national && (
          <div className="bg-white rounded-lg p-2">
            <p className="text-xs text-gray-500 mb-0.5">National Format</p>
            <p className="text-xs font-semibold text-gray-800 font-mono truncate">{info.national}</p>
          </div>
        )}
      </div>

      {/* User Found */}
      {info.userExists && info.userData && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="pt-2 border-t border-blue-200"
        >
          <div className="flex items-center gap-3 bg-white rounded-xl p-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
              {info.userData.avatar_url
                ? <img src={info.userData.avatar_url} alt="" className="w-full h-full object-cover" />
                : info.userData.full_name?.[0]?.toUpperCase() || '?'
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-gray-900 truncate">{info.userData.full_name}</p>
                <FiCheckCircle size={14} className="text-green-500 shrink-0" />
              </div>
              <p className="text-xs text-green-600 font-medium">On VipChat</p>
              {info.userData.bio && (
                <p className="text-xs text-gray-500 truncate">{info.userData.bio}</p>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {info.isValid && !info.userExists && (
        <div className="flex items-center gap-2 text-xs text-gray-500 bg-white rounded-lg p-2">
          <FiInfo size={12} />
          <span>Not on VipChat yet. You can still save them as a contact.</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── User Result Card ─────────────────────────────────────────────────────────
function UserCard({ user, onAdd, added, loading }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-xl hover:border-green-300 hover:bg-green-50 transition-all"
    >
      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0 overflow-hidden">
        {user.avatar_url
          ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
          : user.full_name?.[0]?.toUpperCase() || '?'
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{user.full_name}</p>
        <p className="text-xs text-gray-500 truncate">{user.phone_number || user.email}</p>
      </div>
      <button
        onClick={() => onAdd(user)}
        disabled={added || loading}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
          added
            ? 'bg-gray-100 text-gray-500 cursor-default'
            : 'bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow-md'
        }`}
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : added ? (
          <><FiCheck size={14} /> Sent</>
        ) : (
          <><FiUserPlus size={14} /> Add</>
        )}
      </button>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────
function AddContactModal({ onClose, onSuccess }) {
  const [tab, setTab] = useState('phone');

  // Phone tab state
  const [selectedCountry, setSelectedCountry] = useState(
    getCountryByCode('US') || COUNTRIES.find(c => c.code === 'US')
  );
  const [phoneLocal, setPhoneLocal] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('Hi! I would like to add you to my contacts.');
  const [phoneInfo, setPhoneInfo] = useState(null);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneValid, setPhoneValid] = useState(null); // null | true | false
  const [submitting, setSubmitting] = useState(false);
  const validateTimer = useRef(null);

  // Search tab state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addedUsers, setAddedUsers] = useState({});
  const [addingUser, setAddingUser] = useState(null);
  const searchTimer = useRef(null);

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [bulkResults, setBulkResults] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Full E.164 number
  const fullPhone = selectedCountry
    ? `${selectedCountry.dialCode.replace(/-.*/, '')}${phoneLocal.replace(/\D/g, '')}`
    : phoneLocal;

  // ── Phone Validation ─────────────────────────────────────────────────────
  const validatePhone = useCallback(async (phone) => {
    if (!phone || phone.replace(/\D/g, '').length < 4) {
      setPhoneInfo(null);
      setPhoneValid(null);
      return;
    }
    setPhoneLoading(true);
    try {
      const response = await api.post('/contacts/validate-phone', { phone_number: phone });
      const data = response.data;
      if (data.valid) {
        const countryCode = data.location?.country;
        const countryObj = countryCode ? getCountryByCode(countryCode) : null;
        const ci = data.country_info;

        setPhoneInfo({
          isValid: true,
          flag: countryObj?.flag || (ci ? getEmojiFlag(countryCode) : '🌐'),
          countryName: ci?.name || data.location?.description || countryCode || 'Unknown',
          international: data.phone_number?.international,
          national: data.phone_number?.national,
          type: data.type,
          carrier: data.carrier,
          timezone: data.location?.timezones?.[0] || ci?.timezones?.[0] || '',
          location: data.location?.description,
          userExists: data.exists,
          userData: data.user || null,
        });
        setPhoneValid(true);
      } else {
        setPhoneValid(false);
        setPhoneInfo(null);
      }
    } catch {
      // Fallback: basic client-side check
      const digits = phone.replace(/\D/g, '');
      if (digits.length >= 7) {
        const countryObj = selectedCountry;
        setPhoneInfo({
          isValid: true,
          flag: countryObj?.flag || '🌐',
          countryName: countryObj?.name || 'Unknown',
          international: phone,
          type: 'UNKNOWN',
          carrier: '',
          timezone: '',
          userExists: false,
        });
        setPhoneValid(true);
      } else {
        setPhoneValid(false);
        setPhoneInfo(null);
      }
    } finally {
      setPhoneLoading(false);
    }
  }, [selectedCountry]);

  useEffect(() => {
    clearTimeout(validateTimer.current);
    if (phoneLocal.replace(/\D/g, '').length >= 3) {
      validateTimer.current = setTimeout(() => validatePhone(fullPhone), 700);
    } else {
      setPhoneInfo(null);
      setPhoneValid(null);
    }
    return () => clearTimeout(validateTimer.current);
  }, [phoneLocal, selectedCountry]);

  // ── Search Users ──────────────────────────────────────────────────────────
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (searchQuery.trim().length >= 2) {
      searchTimer.current = setTimeout(async () => {
        setSearchLoading(true);
        try {
          const res = await api.get(`/contacts/search-users?q=${encodeURIComponent(searchQuery.trim())}`);
          setSearchResults(res.data.users || []);
        } catch {
          try {
            const res = await api.get(`/contacts/lookup`, {
              params: { name: searchQuery.trim() },
              method: 'POST',
            });
            setSearchResults(res.data.users || []);
          } catch {
            setSearchResults([]);
          }
        } finally {
          setSearchLoading(false);
        }
      }, 500);
    } else {
      setSearchResults([]);
    }
    return () => clearTimeout(searchTimer.current);
  }, [searchQuery]);

  // ── Submit Phone ──────────────────────────────────────────────────────────
  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    if (!phoneValid) { toast.error('Enter a valid phone number'); return; }
    setSubmitting(true);
    try {
      const phoneE164 = phoneInfo?.international?.replace(/\s/g, '') || fullPhone;
      await api.post('/contact-requests/send', {
        phone_number: phoneE164,
        contact_name: contactName.trim() || phoneInfo?.userData?.full_name || '',
        message: message.trim() || 'Hi! I would like to add you to my contacts.',
      });
      toast.success('Contact request sent!');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send request';
      if (msg.includes('not found')) {
        // Save directly as external contact
        try {
          await api.post('/contacts', {
            phone_number: fullPhone,
            contact_name: contactName.trim(),
          });
          toast.success('Contact saved!');
          onSuccess?.();
          onClose();
        } catch (err2) {
          toast.error(err2.response?.data?.error || 'Failed to save contact');
        }
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Add Search Result ─────────────────────────────────────────────────────
  const handleAddUser = async (user) => {
    setAddingUser(user.id);
    try {
      await api.post('/contact-requests/send', {
        user_id: user.id,
        message: 'Hi! I would like to add you to my contacts.',
      });
      setAddedUsers(prev => ({ ...prev, [user.id]: true }));
      toast.success(`Request sent to ${user.full_name}!`);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to send';
      if (msg.includes('Already') || msg.includes('already')) {
        setAddedUsers(prev => ({ ...prev, [user.id]: true }));
        toast.success('Already a contact or request pending');
      } else {
        toast.error(msg);
      }
    } finally {
      setAddingUser(null);
    }
  };

  // ── Bulk Validate ─────────────────────────────────────────────────────────
  const handleBulkValidate = async () => {
    const lines = bulkText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) { toast.error('Enter at least one phone number'); return; }
    if (lines.length > 50) { toast.error('Max 50 numbers at once'); return; }
    setBulkLoading(true);
    try {
      const res = await api.post('/contacts/bulk-validate', { phone_numbers: lines });
      setBulkResults(res.data.results || []);
      toast.success(`Validated ${res.data.total} numbers`);
    } catch {
      toast.error('Bulk validation failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    const toAdd = bulkResults.filter(r => r.valid && r.exists);
    if (!toAdd.length) { toast.error('No valid users found to add'); return; }
    setBulkLoading(true);
    let added = 0;
    for (const r of toAdd) {
      try {
        await api.post('/contact-requests/send', {
          phone_number: r.e164,
          message: 'Hi! I would like to add you to my contacts.',
        });
        added++;
      } catch { }
    }
    toast.success(`Sent ${added} contact request${added !== 1 ? 's' : ''}!`);
    setBulkLoading(false);
    onSuccess?.();
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const tabs = [
    { id: 'phone', label: 'Phone', icon: FiPhone },
    { id: 'search', label: 'Search', icon: FiSearch },
    { id: 'qr', label: 'QR Code', icon: FiGrid },
    { id: 'import', label: 'Import', icon: FiUpload },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="bg-white rounded-2xl w-full max-w-md max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-green-600 to-teal-600 px-5 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
            <MdContactPhone size={22} className="text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-white font-bold text-lg leading-tight">Add New Contact</h3>
            <p className="text-green-100 text-xs">250+ countries supported worldwide</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-semibold transition-all relative ${
                tab === t.id ? 'text-green-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon size={18} />
              <span>{t.label}</span>
              {tab === t.id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 left-2 right-2 h-0.5 bg-green-500 rounded-full"
                />
              )}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── Phone Tab ── */}
            {tab === 'phone' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
                className="p-5 space-y-4"
              >
                {/* World Coverage Banner */}
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl p-3">
                  <FiGlobe className="text-green-600 shrink-0" size={18} />
                  <p className="text-xs text-green-700 font-medium">
                    Real-time validation for <strong>250+ countries</strong> — carrier, location & timezone detection
                  </p>
                </div>

                <form onSubmit={handlePhoneSubmit} className="space-y-4">
                  {/* Phone Input */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="flex">
                      <CountrySelector
                        selected={selectedCountry}
                        onSelect={c => { setSelectedCountry(c); setPhoneInfo(null); setPhoneValid(null); }}
                      />
                      <div className="relative flex-1">
                        <input
                          type="tel"
                          value={phoneLocal}
                          onChange={e => setPhoneLocal(e.target.value)}
                          placeholder="Enter number..."
                          className="w-full pl-4 pr-10 py-3 border border-l-0 border-gray-300 rounded-r-xl focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none text-sm font-mono transition-all"
                        />
                        {/* Status indicator */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {phoneLoading && (
                            <div className="w-5 h-5 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                          )}
                          {!phoneLoading && phoneValid === true && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <FiCheckCircle size={18} className="text-green-500" />
                            </motion.div>
                          )}
                          {!phoneLoading && phoneValid === false && (
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                              <FiAlertCircle size={18} className="text-red-500" />
                            </motion.div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Validation message */}
                    {!phoneLoading && phoneValid === false && phoneLocal && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1.5 text-xs text-red-500 flex items-center gap-1"
                      >
                        <FiAlertCircle size={12} />
                        Invalid phone number for {selectedCountry?.name}
                      </motion.p>
                    )}
                    {!phoneLoading && phoneValid === true && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-1.5 text-xs text-green-600 flex items-center gap-1"
                      >
                        <FiCheck size={12} />
                        Valid — {phoneInfo?.international}
                      </motion.p>
                    )}
                  </div>

                  {/* Phone Info Card */}
                  <PhoneInfoCard info={phoneInfo} loading={phoneLoading && phoneLocal.length > 2} />

                  {/* Contact Name */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Contact Name <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <FiUser size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={contactName}
                        onChange={e => setContactName(e.target.value)}
                        placeholder={phoneInfo?.userData?.full_name || 'John Doe'}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none text-sm transition-all"
                      />
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Message <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <div className="relative">
                      <FiMessageSquare size={16} className="absolute left-3 top-3 text-gray-400" />
                      <textarea
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                        rows={2}
                        maxLength={200}
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none text-sm resize-none transition-all"
                      />
                      <span className="absolute bottom-2 right-3 text-xs text-gray-400">{message.length}/200</span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || !phoneValid}
                    className="w-full py-3.5 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <FiSend size={18} />
                        {phoneInfo?.userExists ? 'Send Contact Request' : 'Save Contact'}
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Search Tab ── */}
            {tab === 'search' && (
              <motion.div
                key="search"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
                className="p-5 space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Search by Name, Phone, or Email
                  </label>
                  <div className="relative">
                    <FiSearch size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Type to search users..."
                      className="w-full pl-10 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none text-sm transition-all"
                      autoFocus
                    />
                    {searchLoading && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5 ml-1">
                    Search finds users registered on VipChat
                  </p>
                </div>

                <AnimatePresence>
                  {searchQuery.length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-10"
                    >
                      <FiUsers size={36} className="mx-auto text-gray-300 mb-3" />
                      <p className="text-gray-500 text-sm">No users found for "{searchQuery}"</p>
                      <p className="text-gray-400 text-xs mt-1">Try a phone number in the Phone tab</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {searchResults.length > 0 && (
                  <motion.div layout className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      {searchResults.length} Result{searchResults.length !== 1 ? 's' : ''}
                    </p>
                    {searchResults.map(user => (
                      <UserCard
                        key={user.id}
                        user={user}
                        onAdd={handleAddUser}
                        added={!!addedUsers[user.id]}
                        loading={addingUser === user.id}
                      />
                    ))}
                  </motion.div>
                )}

                {!searchQuery && (
                  <div className="text-center py-10">
                    <FiSearch size={40} className="mx-auto text-gray-200 mb-3" />
                    <p className="text-gray-400 text-sm">Start typing to search</p>
                    <p className="text-gray-300 text-xs mt-1">Minimum 2 characters</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* ── QR Code Tab ── */}
            {tab === 'qr' && (
              <motion.div
                key="qr"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
                className="p-5 space-y-4"
              >
                <div className="text-center py-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-green-100 to-teal-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <FiGrid size={48} className="text-green-600" />
                  </div>
                  <h4 className="font-bold text-gray-800 text-lg mb-2">QR Code Scanner</h4>
                  <p className="text-gray-500 text-sm mb-6 max-w-xs mx-auto">
                    Scan someone's VipChat QR code to instantly add them — works without knowing their number
                  </p>

                  <div className="space-y-3">
                    <button
                      onClick={() => { onClose(); }}
                      className="w-full py-3.5 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 font-semibold flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                    >
                      <FiGrid size={20} />
                      Open QR Scanner
                    </button>
                    <button
                      onClick={() => { onClose(); }}
                      className="w-full py-3 border-2 border-green-500 text-green-600 rounded-xl hover:bg-green-50 font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <FiUser size={18} />
                      Show My QR Code
                    </button>
                  </div>

                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-left">
                    <div className="flex items-start gap-2">
                      <FiInfo className="text-blue-500 mt-0.5 shrink-0" size={16} />
                      <div className="text-xs text-blue-700 space-y-1">
                        <p className="font-semibold">How QR contact works:</p>
                        <p>1. Open someone's QR code or let them scan yours</p>
                        <p>2. Instantly connect without exchanging numbers</p>
                        <p>3. Works across all countries worldwide</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Import Tab ── */}
            {tab === 'import' && (
              <motion.div
                key="import"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.18 }}
                className="p-5 space-y-4"
              >
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Bulk Import Phone Numbers
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Paste up to 50 phone numbers (one per line) in international format
                  </p>
                  <textarea
                    value={bulkText}
                    onChange={e => setBulkText(e.target.value)}
                    placeholder={`+1 202 555 0123\n+44 20 7946 0958\n+91 98765 43210\n+234 801 234 5678\n...`}
                    rows={7}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-400 focus:border-green-400 outline-none text-sm font-mono resize-none transition-all"
                  />
                  <p className="text-xs text-gray-400 mt-1 text-right">
                    {bulkText.split('\n').filter(l => l.trim()).length} / 50 numbers
                  </p>
                </div>

                {bulkResults.length === 0 ? (
                  <button
                    onClick={handleBulkValidate}
                    disabled={bulkLoading || !bulkText.trim()}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed font-semibold flex items-center justify-center gap-2 shadow-md transition-all"
                  >
                    {bulkLoading ? (
                      <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Validating...</>
                    ) : (
                      <><FiGlobe size={18} /> Validate All Numbers</>
                    )}
                  </button>
                ) : (
                  <div className="space-y-3">
                    {/* Summary */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-gray-800">{bulkResults.length}</p>
                        <p className="text-xs text-gray-500">Total</p>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-green-600">{bulkResults.filter(r => r.exists).length}</p>
                        <p className="text-xs text-green-600">On App</p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-3 text-center">
                        <p className="text-xl font-bold text-red-500">{bulkResults.filter(r => !r.valid).length}</p>
                        <p className="text-xs text-red-500">Invalid</p>
                      </div>
                    </div>

                    {/* Results */}
                    <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                      {bulkResults.map((r, i) => (
                        <div key={i} className={`flex items-center gap-2 p-2.5 rounded-lg text-sm ${
                          !r.valid ? 'bg-red-50 border border-red-200' :
                          r.exists ? 'bg-green-50 border border-green-200' :
                          'bg-gray-50 border border-gray-200'
                        }`}>
                          {!r.valid ? <FiAlertCircle size={14} className="text-red-500 shrink-0" /> :
                           r.exists ? <FiCheckCircle size={14} className="text-green-500 shrink-0" /> :
                           <FiGlobe size={14} className="text-gray-400 shrink-0" />}
                          <span className="font-mono text-xs flex-1 truncate">{r.e164 || r.phone}</span>
                          {r.user && <span className="text-xs text-green-700 font-medium truncate">{r.user.full_name}</span>}
                          {!r.valid && <span className="text-xs text-red-500">Invalid</span>}
                          {r.valid && !r.exists && <span className="text-xs text-gray-500">Not on app</span>}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setBulkResults([]); setBulkText(''); }}
                        className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm transition-all"
                      >
                        Clear
                      </button>
                      <button
                        onClick={handleBulkAdd}
                        disabled={bulkLoading || !bulkResults.some(r => r.exists)}
                        className="flex-2 flex-1 py-2.5 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-xl hover:from-green-600 hover:to-teal-600 disabled:opacity-50 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
                      >
                        {bulkLoading ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <FiUserPlus size={16} />
                        )}
                        Add {bulkResults.filter(r => r.exists).length} to Contacts
                      </button>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="flex items-start gap-2">
                    <FiInfo className="text-amber-500 mt-0.5 shrink-0" size={14} />
                    <div className="text-xs text-amber-700">
                      <p className="font-semibold mb-0.5">Tips for bulk import:</p>
                      <p>• Include country dial code (e.g., +1, +44, +91)</p>
                      <p>• One number per line, spaces are fine</p>
                      <p>• Supports all 250+ countries worldwide</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

// Helper for emoji flags when country object isn't available
function getEmojiFlag(code) {
  if (!code) return '🌐';
  return code.toUpperCase().replace(/./g, char =>
    String.fromCodePoint(127397 + char.charCodeAt())
  );
}

export default AddContactModal;
