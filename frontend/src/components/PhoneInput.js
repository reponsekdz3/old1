import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PHONE_COUNTRIES, getFlag, DEFAULT_COUNTRY } from '../data/phoneCountries';

export default function PhoneInput({
  value,
  onChange,
  placeholder = '701 234 567',
  error,
  className = '',
  autoFocus = false,
}) {
  const [country, setCountry] = useState(() => {
    if (value && value.startsWith('+')) {
      const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
      return sorted.find(c => value.startsWith(c.dialCode)) || DEFAULT_COUNTRY;
    }
    return DEFAULT_COUNTRY;
  });
  const [local, setLocal] = useState(() => {
    if (value && value.startsWith(country.dialCode)) {
      return value.slice(country.dialCode.length).trim();
    }
    return value || '';
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocalChange = (e) => {
    const digits = e.target.value.replace(/[^\d\s\-\(\)]/g, '');
    setLocal(digits);
    const full = digits.trim() ? `${country.dialCode}${digits.replace(/\s/g, '')}` : '';
    onChange(full);
  };

  const handleCountrySelect = (c) => {
    setCountry(c);
    setOpen(false);
    setSearch('');
    const full = local.trim() ? `${c.dialCode}${local.replace(/\s/g, '')}` : '';
    onChange(full);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const filtered = PHONE_COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dialCode.includes(search) ||
    c.iso2.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className={`flex items-center border-2 rounded-2xl bg-white overflow-visible transition focus-within:ring-4
        ${error ? 'border-red-300 focus-within:border-red-400 focus-within:ring-red-50' : 'border-gray-200 focus-within:border-[#25D366] focus-within:ring-green-50'}`}>
        {/* Country button */}
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 pl-3 pr-2 py-3 hover:bg-gray-50 rounded-l-2xl border-r border-gray-200 flex-shrink-0 transition select-none"
        >
          <span className="text-xl leading-none">{getFlag(country.iso2)}</span>
          <span className="text-sm font-semibold text-gray-700 min-w-[36px]">{country.dialCode}</span>
          <svg className={`w-3 h-3 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Phone number input */}
        <input
          ref={inputRef}
          type="tel"
          value={local}
          onChange={handleLocalChange}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="tel-national"
          className="flex-1 px-3 py-3 text-sm outline-none bg-transparent rounded-r-2xl placeholder-gray-400"
        />
      </div>

      {/* Country dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-[200]"
          >
            {/* Search */}
            <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                <svg className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchRef}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search country or code..."
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            {/* List */}
            <div className="max-h-52 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-400">No countries found</div>
              ) : filtered.map(c => (
                <button
                  key={`${c.iso2}-${c.dialCode}`}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-green-50 transition text-left
                    ${country.iso2 === c.iso2 && country.dialCode === c.dialCode ? 'bg-green-50' : ''}`}
                >
                  <span className="text-lg flex-shrink-0">{getFlag(c.iso2)}</span>
                  <span className="flex-1 text-sm text-gray-800 truncate">{c.name}</span>
                  <span className="text-sm font-semibold text-[#25D366] flex-shrink-0">{c.dialCode}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
