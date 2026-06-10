import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiPlus, FiLock, FiShield, FiTrash2,
  FiEdit3, FiArchive, FiEye, FiEyeOff, FiX, FiCheck,
  FiAlertTriangle, FiUpload, FiKey, FiDownload,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

const DOC_META = {
  passport:          { label: 'Passport',              icon: '🛂', color: 'from-blue-500 to-blue-600' },
  national_id:       { label: 'National ID',           icon: '🪪', color: 'from-emerald-500 to-teal-600' },
  driver_license:    { label: "Driver's License",      icon: '🚗', color: 'from-amber-500 to-orange-500' },
  credit_card:       { label: 'Credit / Debit Card',   icon: '💳', color: 'from-purple-500 to-violet-600' },
  health_card:       { label: 'Health Card',           icon: '🏥', color: 'from-red-500 to-rose-600' },
  social_security:   { label: 'Social Security',       icon: '🔐', color: 'from-indigo-500 to-blue-600' },
  tax_id:            { label: 'Tax ID / TIN',          icon: '📋', color: 'from-teal-500 to-cyan-600' },
  birth_certificate: { label: 'Birth Certificate',     icon: '👶', color: 'from-orange-400 to-amber-500' },
  visa:              { label: 'Visa',                  icon: '✈️', color: 'from-sky-500 to-blue-500' },
  insurance:         { label: 'Insurance Policy',      icon: '🛡️', color: 'from-lime-500 to-green-600' },
  certificate:       { label: 'Certificate / Diploma', icon: '🎓', color: 'from-pink-500 to-rose-500' },
  other:             { label: 'Other Document',        icon: '📄', color: 'from-gray-400 to-gray-500' },
};

// ── AES-256-GCM helpers ────────────────────────────────────────────────────────
async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data)));
  const combined = new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)]);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(b64, password) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const data = bytes.slice(28);
  const key = await deriveKey(password, salt);
  const dec = new TextDecoder();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(dec.decode(decrypted));
}

function DocCard({ doc, onView, onEdit, onDelete, onArchive }) {
  const meta = DOC_META[doc.doc_type] || DOC_META.other;
  const isExpiring = doc.expires_at && new Date(doc.expires_at) - Date.now() < 30 * 24 * 3600000;
  const isExpired = doc.expires_at && new Date(doc.expires_at) < Date.now();

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-2xl shadow-sm border ${isExpired ? 'border-red-200' : isExpiring ? 'border-amber-200' : 'border-gray-100'} overflow-hidden`}>
      <div className={`h-2 bg-gradient-to-r ${meta.color}`} />
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-xl`}>
              {meta.icon}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{doc.label}</p>
              <p className="text-xs text-gray-400">{meta.label}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {(isExpired || isExpiring) && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isExpired ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                {isExpired ? 'Expired' : 'Expiring'}
              </span>
            )}
            <FiLock size={12} className="text-gray-300" />
          </div>
        </div>

        {doc.expires_at && (
          <p className={`text-xs mb-3 ${isExpired ? 'text-red-500' : isExpiring ? 'text-amber-600' : 'text-gray-400'}`}>
            {isExpired ? '⚠ Expired' : '⏰ Expires'}: {new Date(doc.expires_at).toLocaleDateString()}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button onClick={() => onView(doc)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 text-gray-700 text-xs font-bold py-2 rounded-xl hover:bg-gray-100 transition">
            <FiEye size={12} /> View
          </button>
          <button onClick={() => onEdit(doc)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 text-gray-700 text-xs font-bold py-2 rounded-xl hover:bg-gray-100 transition">
            <FiEdit3 size={12} /> Edit
          </button>
          <button onClick={() => onArchive(doc)}
            className="w-8 h-8 flex items-center justify-center bg-gray-50 text-gray-400 rounded-xl hover:bg-gray-100 transition">
            <FiArchive size={12} />
          </button>
          <button onClick={() => onDelete(doc)}
            className="w-8 h-8 flex items-center justify-center bg-red-50 text-red-400 rounded-xl hover:bg-red-100 transition">
            <FiTrash2 size={12} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const tryUnlock = () => {
    const stored = localStorage.getItem('vault_pin');
    if (!stored) {
      localStorage.setItem('vault_pin', pin);
      onUnlock(pin);
    } else if (stored === pin) {
      onUnlock(pin);
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 px-8">
      <div className="w-16 h-16 bg-gradient-to-br from-[#25D366] to-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
        <FiShield size={30} className="text-white" />
      </div>
      <h1 className="text-xl font-black text-gray-900 mb-2">Document Vault</h1>
      <p className="text-sm text-gray-400 text-center mb-8">
        {localStorage.getItem('vault_pin') ? 'Enter your vault PIN to unlock' : 'Create a vault PIN to secure your documents'}
      </p>

      <div className="flex gap-3 mb-6">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black border-2 transition-all ${
            pin.length > i ? 'border-[#25D366] bg-green-50 text-[#25D366]' : 'border-gray-200 text-gray-200'
          }`}>
            {pin.length > i ? '●' : '○'}
          </div>
        ))}
      </div>

      {error && <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>}

      <div className="grid grid-cols-3 gap-3 w-full max-w-[240px]">
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
          <button key={i}
            onClick={() => {
              if (k === '⌫') setPin(p => p.slice(0, -1));
              else if (k !== '' && pin.length < 4) setPin(p => p + String(k));
            }}
            disabled={k === ''}
            className={`h-12 rounded-xl text-lg font-bold transition-all ${
              k === '' ? 'invisible' :
              k === '⌫' ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' :
              'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 shadow-sm'
            }`}>
            {k}
          </button>
        ))}
      </div>

      {pin.length === 4 && (
        <motion.button initial={{ scale: 0.9 }} animate={{ scale: 1 }} onClick={tryUnlock}
          className="mt-6 bg-[#25D366] text-white px-8 py-3 rounded-xl font-bold shadow-md hover:shadow-lg transition-shadow">
          {localStorage.getItem('vault_pin') ? 'Unlock Vault' : 'Create Vault'}
        </motion.button>
      )}
    </div>
  );
}

function DocForm({ doc, vaultPin, onSave, onClose }) {
  const [docType, setDocType] = useState(doc?.doc_type || 'passport');
  const [label, setLabel] = useState(doc?.label || '');
  const [fields, setFields] = useState({ number: '', issuer: '', notes: '' });
  const [expiresAt, setExpiresAt] = useState(doc?.expires_at ? doc.expires_at.split('T')[0] : '');
  const [saving, setSaving] = useState(false);
  const [decrypting, setDecrypting] = useState(!!doc);

  useEffect(() => {
    if (doc) {
      api.get(`/vault/${doc.id}`)
        .then(async r => {
          try {
            const decrypted = await decryptData(r.data.document.encrypted_data, vaultPin);
            setFields(decrypted);
          } catch {
            toast.error('Failed to decrypt document');
          }
        })
        .finally(() => setDecrypting(false));
    }
  }, [doc, vaultPin]);

  const save = async () => {
    if (!label.trim()) return toast.error('Label is required');
    setSaving(true);
    try {
      const encrypted = await encryptData(fields, vaultPin);
      const payload = {
        doc_type: docType, label,
        encrypted_data: encrypted,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      };
      if (doc) {
        await api.put(`/vault/${doc.id}`, payload);
        toast.success('Document updated');
      } else {
        await api.post('/vault', payload);
        toast.success('Document saved securely');
      }
      onSave();
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (decrypting) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl p-8 text-center">
        <div className="w-10 h-10 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm font-medium text-gray-600">Decrypting…</p>
      </div>
    </div>
  );

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white w-full max-w-md rounded-t-3xl overflow-y-auto max-h-[92vh]"
        initial={{ y: 400 }} animate={{ y: 0 }} exit={{ y: 400 }}>
        <div className="px-5 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="font-black text-gray-900">{doc ? 'Edit Document' : 'Add Document'}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX size={15} /></button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-500 mb-2 block">Document Type</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(DOC_META).map(([key, m]) => (
                <button key={key} onClick={() => setDocType(key)}
                  className={`p-2 rounded-xl text-center text-xs font-bold border-2 transition-all ${docType === key ? 'border-[#25D366] bg-green-50' : 'border-gray-100'}`}>
                  <div className="text-lg">{m.icon}</div>
                  <div className={docType === key ? 'text-[#25D366]' : 'text-gray-500'}>{m.label.split(' ')[0]}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Label (e.g. "My US Passport")</label>
            <input value={label} onChange={e => setLabel(e.target.value)} maxLength={100}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#25D366]"
              placeholder="Document label" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Document Number</label>
            <input value={fields.number} onChange={e => setFields(f => ({ ...f, number: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-[#25D366]"
              placeholder="e.g. A1234567" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Issuing Authority / Bank</label>
            <input value={fields.issuer} onChange={e => setFields(f => ({ ...f, issuer: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#25D366]"
              placeholder="e.g. United States Department of State" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Expiry Date (optional)</label>
            <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#25D366]" />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500 mb-1.5 block">Additional Notes</label>
            <textarea value={fields.notes} onChange={e => setFields(f => ({ ...f, notes: e.target.value }))}
              rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:border-[#25D366]"
              placeholder="Any extra info…" />
          </div>

          <div className="bg-blue-50 rounded-xl p-3 flex items-start gap-2 text-xs text-blue-600">
            <FiShield size={14} className="mt-0.5 flex-shrink-0" />
            <span>Your data is encrypted with AES-256 before being stored. Only you can read it with your vault PIN.</span>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full bg-gradient-to-r from-[#25D366] to-emerald-500 text-white py-3.5 rounded-xl font-bold text-sm disabled:opacity-60 shadow-md">
            {saving ? 'Encrypting & Saving…' : doc ? 'Update Document' : 'Save Securely'}
          </button>
          <div className="pb-4" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ViewModal({ doc, vaultPin, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const meta = DOC_META[doc.doc_type] || DOC_META.other;

  useEffect(() => {
    api.get(`/vault/${doc.id}`)
      .then(async r => {
        try {
          const decrypted = await decryptData(r.data.document.encrypted_data, vaultPin);
          setData(decrypted);
        } catch {
          toast.error('Decryption failed. Wrong PIN?');
        }
      })
      .finally(() => setLoading(false));
  }, [doc, vaultPin]);

  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div className="bg-white w-full max-w-md rounded-t-3xl p-6 pb-10"
        initial={{ y: 300 }} animate={{ y: 0 }} exit={{ y: 300 }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${meta.color} flex items-center justify-center text-lg`}>{meta.icon}</div>
            <div>
              <p className="font-black text-gray-900">{doc.label}</p>
              <p className="text-xs text-gray-400">{meta.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><FiX size={15} /></button>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-400">DOCUMENT DETAILS</p>
              <button onClick={() => setRevealed(r => !r)}
                className="flex items-center gap-1 text-xs text-[#25D366] font-bold">
                {revealed ? <FiEyeOff size={12} /> : <FiEye size={12} />}
                {revealed ? 'Hide' : 'Reveal'}
              </button>
            </div>

            {[['Number', data.number], ['Issuer', data.issuer], ['Expires', doc.expires_at ? new Date(doc.expires_at).toLocaleDateString() : 'N/A'], ['Notes', data.notes]].map(([k, v]) => v ? (
              <div key={k} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 font-medium mb-0.5">{k}</p>
                <p className={`text-sm font-bold text-gray-900 ${!revealed && k !== 'Expires' ? 'blur-[4px] select-none' : ''}`}>{v}</p>
              </div>
            ) : null)}
          </div>
        ) : (
          <p className="text-center text-red-500 text-sm py-4">Could not decrypt document</p>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function DocumentVaultPage() {
  const navigate = useNavigate();
  const [unlocked, setUnlocked] = useState(false);
  const [vaultPin, setVaultPin] = useState('');
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editDoc, setEditDoc] = useState(null);
  const [viewDoc, setViewDoc] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

  const loadDocs = useCallback((archived = false) => {
    api.get(`/vault?archived=${archived}`)
      .then(r => setDocs(r.data.documents))
      .catch(() => toast.error('Failed to load vault'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (unlocked) loadDocs(showArchived);
  }, [unlocked, showArchived, loadDocs]);

  const handleUnlock = (pin) => {
    setVaultPin(pin);
    setUnlocked(true);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Permanently delete "${doc.label}"?`)) return;
    try {
      await api.delete(`/vault/${doc.id}`);
      toast.success('Document deleted');
      loadDocs(showArchived);
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleArchive = async (doc) => {
    await api.post(`/vault/${doc.id}/archive`);
    toast.success(doc.is_archived ? 'Unarchived' : 'Archived');
    loadDocs(showArchived);
  };

  if (!unlocked) return <PinGate onUnlock={handleUnlock} />;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 pt-12 pb-6 px-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <FiArrowLeft size={16} className="text-white" />
            </button>
            <div>
              <h1 className="text-white font-black text-lg">Document Vault</h1>
              <p className="text-white/50 text-xs">AES-256 encrypted · PIN protected</p>
            </div>
          </div>
          <button onClick={() => { setEditDoc(null); setShowForm(true); }}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition">
            <FiPlus size={18} />
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-white/60 text-xs">{docs.length} document{docs.length !== 1 ? 's' : ''} stored</p>
          <button onClick={() => setShowArchived(a => !a)}
            className={`text-xs font-bold px-3 py-1 rounded-full transition ${showArchived ? 'bg-white text-gray-800' : 'bg-white/20 text-white'}`}>
            {showArchived ? 'Active' : 'Archived'}
          </button>
        </div>
      </div>

      <div className="flex-1 p-5">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-28 bg-white rounded-2xl animate-pulse" />)}
          </div>
        ) : docs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <div className="w-20 h-20 bg-gray-100 rounded-3xl flex items-center justify-center mb-4 text-4xl">🔐</div>
            <p className="font-bold text-gray-600 mb-1">Vault is empty</p>
            <p className="text-sm text-center max-w-[220px]">Add your important documents — they'll be encrypted on your device</p>
            <button onClick={() => setShowForm(true)}
              className="mt-5 bg-[#25D366] text-white px-6 py-2.5 rounded-xl font-bold text-sm shadow-md">
              + Add First Document
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {docs.map(doc => (
              <DocCard key={doc.id} doc={doc}
                onView={() => setViewDoc(doc)}
                onEdit={() => { setEditDoc(doc); setShowForm(true); }}
                onDelete={() => handleDelete(doc)}
                onArchive={() => handleArchive(doc)}
              />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showForm && (
          <DocForm doc={editDoc} vaultPin={vaultPin}
            onSave={() => { setShowForm(false); loadDocs(showArchived); }}
            onClose={() => setShowForm(false)} />
        )}
        {viewDoc && (
          <ViewModal doc={viewDoc} vaultPin={vaultPin} onClose={() => setViewDoc(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
