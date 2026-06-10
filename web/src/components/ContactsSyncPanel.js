import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  FiUsers, FiRefreshCw, FiPlus, FiSearch, FiPhone,
  FiCheck, FiX, FiUpload, FiInfo, FiUserPlus, FiFileText,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function ContactsSyncPanel() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [bulkInput, setBulkInput] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [phone, setPhone] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingId, setAddingId] = useState(null);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const { data } = await api.get('/api/contacts/stats');
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const handleAutoSync = async () => {
    setSyncing(true);
    try {
      // Use the proper endpoint that auto-adds contacts
      const { data } = await api.post('/api/contacts/sync-phone', { phone_numbers: [] }); 
      toast.success(data.message || `Sync complete — ${data.registered_count || 0} contacts added`);
      await loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleCsvImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      const phones = text.split(/[\n,;]+/).map(p => p.trim()).filter(p => p.length > 5);
      if (phones.length === 0) {
        toast.error('No valid phone numbers found in CSV');
        return;
      }
      setBulkLoading(true);
      try {
        const { data } = await api.post('/api/contacts/sync-phone', { phone_numbers: phones });
        setBulkResult(data);
        toast.success(`Imported ${data.registered_count} contacts!`);
        await loadStats();
      } catch (err) {
        toast.error('Import failed');
      } finally {
        setBulkLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleBulkAdd = async () => {
    const phones = bulkInput
      .split(/[\n,;]+/)
      .map(p => p.trim())
      .filter(Boolean);
    if (!phones.length) { toast.error('Enter at least one phone number'); return; }
    setBulkLoading(true);
    setBulkResult(null);
    try {
      const { data } = await api.post('/api/contacts/bulk-add', { phones });
      setBulkResult(data);
      toast.success(`${data.added || 0} contacts added, ${data.already_contacts || 0} already in your list`);
      await loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Bulk add failed');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleAddByPhone = async () => {
    if (!phone.trim()) return;
    setPhoneLoading(true);
    try {
      const { data } = await api.post('/api/contacts/add-by-phone', { phone: phone.trim() });
      toast.success(data.message || 'Contact added!');
      setPhone('');
      await loadStats();
    } catch (err) {
      toast.error(err.response?.data?.error || 'User not found');
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSearch = useCallback(async (q) => {
    setSearchQ(q);
    if (q.trim().length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const { data } = await api.get(`/api/contacts/search?q=${encodeURIComponent(q)}`);
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleAddSearchResult = async (userId) => {
    setAddingId(userId);
    try {
      const user = searchResults.find(u => u.id === userId);
      if (user?.phone) {
        const { data } = await api.post('/api/contacts/add-by-phone', { phone: user.phone });
        toast.success(data.message || 'Contact added!');
        setSearchResults(prev => prev.map(u => u.id === userId ? { ...u, is_contact: true } : u));
        await loadStats();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add');
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stats header */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Contacts', value: statsLoading ? '…' : (stats?.total_contacts ?? 0) },
          { label: 'On VipChat', value: statsLoading ? '…' : (stats?.contacts_on_vipchat ?? 0) },
          { label: 'Recently Added', value: statsLoading ? '…' : (stats?.added_this_week ?? 0) },
        ].map(s => (
          <div key={s.label} className="bg-[#f0f2f5] rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-[#075E54]">{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Auto sync */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-[#e9fbe9] rounded-xl flex items-center justify-center flex-shrink-0">
            <FiUsers size={18} className="text-[#25D366]"/>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-sm">Auto-Sync Contacts</h3>
            <p className="text-xs text-gray-500 mt-1">
              Automatically finds all VipChat users from your existing contacts and adds them to your list.
              This runs automatically when you register, and you can re-run it anytime.
            </p>
            <button
              onClick={handleAutoSync}
              disabled={syncing}
              className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-[#075E54] hover:bg-[#054d46] disabled:bg-gray-300 text-white rounded-xl text-sm font-semibold transition">
              <FiRefreshCw size={13} className={syncing ? 'animate-spin' : ''}/>
              {syncing ? 'Syncing…' : 'Sync Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Search & discover */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <FiSearch size={14} className="text-gray-400"/>
          Find People on VipChat
        </h3>
        <div className="relative mb-3">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
          <input
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Search by name or username…"
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366]"
          />
          {searchLoading && (
            <FiRefreshCw size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin"/>
          )}
        </div>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {searchResults.map(u => (
            <motion.div key={u.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {(u.full_name || u.username || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">{u.full_name || u.username}</div>
                <div className="text-xs text-gray-400 truncate">@{u.username}</div>
              </div>
              {u.is_contact ? (
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><FiCheck size={11}/>Added</span>
              ) : (
                <button
                  onClick={() => handleAddSearchResult(u.id)}
                  disabled={addingId === u.id}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#075E54] hover:bg-[#054d46] text-white rounded-lg text-xs font-semibold transition">
                  {addingId === u.id ? <FiRefreshCw size={10} className="animate-spin"/> : <FiUserPlus size={10}/>}
                  Add
                </button>
              )}
            </motion.div>
          ))}
          {searchQ.length >= 2 && !searchLoading && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">No users found for "{searchQ}"</p>
          )}
        </div>
      </div>

      {/* Add by phone */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
          <FiPhone size={14} className="text-gray-400"/>
          Add Contact by Phone Number
        </h3>
        <div className="flex gap-2">
          <input
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddByPhone()}
            placeholder="+1 555 000 0000"
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#25D366]"
          />
          <button
            onClick={handleAddByPhone}
            disabled={!phone.trim() || phoneLoading}
            className="px-4 py-2.5 bg-[#075E54] hover:bg-[#054d46] disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition flex items-center gap-2">
            {phoneLoading ? <FiRefreshCw size={13} className="animate-spin"/> : <FiPlus size={13}/>}
            Add
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
          <FiInfo size={11}/>
          Include country code (e.g. +1 for US, +44 for UK)
        </p>
      </div>

      {/* Bulk import */}
      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
            <FiUpload size={14} className="text-gray-400"/>
            Bulk Import
          </h3>
          <label className="cursor-pointer text-xs font-bold text-[#075E54] hover:underline flex items-center gap-1">
            <FiFileText size={12}/>
            Import CSV
            <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCsvImport} />
          </label>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Paste a list of phone numbers (one per line, or comma-separated) to find and add VipChat users in bulk.
        </p>
        <textarea
          value={bulkInput}
          onChange={e => setBulkInput(e.target.value)}
          rows={4}
          placeholder={"+1 555 000 0001\n+44 7700 900000\n+91 98765 43210"}
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#25D366] font-mono resize-none"
        />
        <button
          onClick={handleBulkAdd}
          disabled={!bulkInput.trim() || bulkLoading}
          className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-[#075E54] hover:bg-[#054d46] disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition">
          {bulkLoading ? <FiRefreshCw size={13} className="animate-spin"/> : <FiUpload size={13}/>}
          {bulkLoading ? 'Importing…' : 'Import Contacts'}
        </button>

        {bulkResult && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 bg-green-50 border border-green-100 rounded-xl p-3 text-sm">
            <div className="font-semibold text-green-800 mb-1">Import complete</div>
            <div className="grid grid-cols-3 gap-2 text-xs text-green-700">
              <span>✓ {bulkResult.added || 0} added</span>
              <span>— {bulkResult.already_contacts || 0} existing</span>
              <span>✗ {bulkResult.not_found || 0} not found</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export default ContactsSyncPanel;
