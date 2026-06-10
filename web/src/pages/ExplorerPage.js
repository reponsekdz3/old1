/**
 * My Explorer — file manager in VipChat.
 * Browse all sent/received media, filter by type, sort, multi-select,
 * preview, download individual files or as a ZIP archive.
 * Progressive blur→HD loading with adaptive bandwidth awareness.
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FiArrowLeft, FiGrid, FiList, FiDownload, FiTrash2, FiSearch,
  FiImage, FiVideo, FiMic, FiFileText, FiFile, FiCheckSquare,
  FiSquare, FiFilter, FiPackage, FiX, FiLink,
  FiChevronDown, FiDatabase,
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../services/api';
import ProgressiveImage from '../components/ProgressiveImage';
import { bwManager } from '../utils/bandwidth';

const TABS = [
  { key: 'all',      label: 'All',       icon: <FiFile size={14} /> },
  { key: 'image',    label: 'Photos',    icon: <FiImage size={14} /> },
  { key: 'video',    label: 'Videos',    icon: <FiVideo size={14} /> },
  { key: 'voice',    label: 'Voice',     icon: <FiMic size={14} /> },
  { key: 'document', label: 'Documents', icon: <FiFileText size={14} /> },
];

const SORT_OPTIONS = [
  { value: 'newest',   label: 'Newest first' },
  { value: 'oldest',   label: 'Oldest first' },
  { value: 'largest',  label: 'Largest first' },
  { value: 'smallest', label: 'Smallest first' },
];

function formatBytes(b) {
  if (!b) return '—';
  if (b < 1024)       return b + ' B';
  if (b < 1048576)    return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(2) + ' GB';
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function FileTypeIcon({ type, size = 20 }) {
  if (type === 'image')    return <FiImage    size={size} />;
  if (type === 'video')    return <FiVideo    size={size} />;
  if (type === 'voice' || type === 'audio') return <FiMic size={size} />;
  if (type === 'document') return <FiFileText size={size} />;
  return <FiFile size={size} />;
}

const TYPE_COLOR = {
  image:    '#3b82f6',
  video:    '#8b5cf6',
  voice:    '#f59e0b',
  audio:    '#f59e0b',
  document: '#10b981',
};

export default function ExplorerPage() {
  const navigate = useNavigate();

  const [activeTab,    setActiveTab]    = useState('all');
  const [viewMode,     setViewMode]     = useState('grid');   // grid | list
  const [sortBy,       setSortBy]       = useState('newest');
  const [search,       setSearch]       = useState('');
  const [showSort,     setShowSort]     = useState(false);
  const [files,        setFiles]        = useState([]);
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [page,         setPage]         = useState(1);
  const [hasMore,      setHasMore]      = useState(true);
  const [selected,     setSelected]     = useState(new Set());
  const [selMode,      setSelMode]      = useState(false);
  const [preview,      setPreview]      = useState(null);
  const [zipping,      setZipping]      = useState(false);
  const [bwQuality,    setBwQuality]    = useState(bwManager.quality);
  const loaderRef = useRef(null);

  useEffect(() => {
    const off = bwManager.onChange(q => setBwQuality(q));
    return off;
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/explorer/stats');
      setStats(data);
    } catch {}
  }, []);

  const fetchFiles = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    try {
      const pg = reset ? 1 : page;
      const { data } = await api.get('/explorer/files', {
        params: { type: activeTab, sort: sortBy, page: pg, limit: 40 },
      });
      const next = data.files || [];
      setFiles(prev => reset ? next : [...prev, ...next]);
      setHasMore(data.has_more);
      setPage(reset ? 2 : pg + 1);
    } catch (e) {
      toast.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [loading, page, activeTab, sortBy]);

  // Reset and reload on tab/sort change
  useEffect(() => {
    setFiles([]);
    setPage(1);
    setHasMore(true);
    setSelected(new Set());
    setSelMode(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sortBy]);

  useEffect(() => {
    fetchFiles(true);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, sortBy]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current || !hasMore) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !loading) fetchFiles(false);
    }, { rootMargin: '300px' });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, fetchFiles]);

  // Client-side search filter
  const displayFiles = search.trim()
    ? files.filter(f =>
        (f.chat_partner || '').toLowerCase().includes(search.toLowerCase()) ||
        (f.url || '').split('/').pop().toLowerCase().includes(search.toLowerCase())
      )
    : files;

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === displayFiles.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayFiles.map(f => f.id)));
    }
  };

  const handleDownloadZip = async () => {
    const urls = displayFiles.filter(f => selected.has(f.id)).map(f => f.url);
    if (!urls.length) { toast.error('No files selected'); return; }
    setZipping(true);
    try {
      const response = await api.post('/explorer/download-zip', { urls }, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/zip' });
      const link = document.createElement('a');
      link.href   = URL.createObjectURL(blob);
      link.download = `vipchat_files_${Date.now()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      toast.success(`Downloaded ${urls.length} file${urls.length > 1 ? 's' : ''} as ZIP`);
    } catch {
      toast.error('ZIP download failed');
    } finally {
      setZipping(false);
    }
  };

  const handleDeleteSelected = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} file(s) from your explorer?`)) return;
    try {
      await Promise.all(ids.map(id => api.delete(`/explorer/files/${id}`)));
      setFiles(prev => prev.filter(f => !selected.has(f.id)));
      setSelected(new Set());
      setSelMode(false);
      fetchStats();
      toast.success('Removed from explorer');
    } catch {
      toast.error('Delete failed');
    }
  };

  const handleSingleDownload = (file) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.url.split('/').pop();
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyLink = (file) => {
    navigator.clipboard.writeText(window.location.origin + file.url)
      .then(() => toast.success('Link copied'))
      .catch(() => toast.error('Copy failed'));
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #f3f4f6',
        padding: '0 16px', position: 'sticky', top: 0, zIndex: 100,
        boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 56 }}>
            <button onClick={() => navigate(-1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                padding: 8, borderRadius: 10, color: '#374151' }}>
              <FiArrowLeft size={20} />
            </button>
            <span style={{ fontWeight: 700, fontSize: 17, color: '#111827', flex: 1 }}>
              📁 My Explorer
            </span>

            {/* Bandwidth indicator */}
            {bwQuality !== 'high' && (
              <span style={{
                fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 20,
                background: bwQuality === 'minimal' ? '#fef2f2' : '#fff7ed',
                color: bwQuality === 'minimal' ? '#dc2626' : '#d97706',
              }}>
                {bwQuality === 'minimal' ? '🔴 Minimal BW' : bwQuality === 'low' ? '🟡 Low BW' : '🟠 Med BW'}
              </span>
            )}

            <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
              style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer',
                padding: 8, borderRadius: 10, color: '#374151' }}>
              {viewMode === 'grid' ? <FiList size={18} /> : <FiGrid size={18} />}
            </button>

            {/* Sort */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setShowSort(s => !s)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f3f4f6',
                  border: 'none', cursor: 'pointer', padding: '7px 10px',
                  borderRadius: 10, color: '#374151', fontSize: 13, fontWeight: 500 }}>
                <FiFilter size={14} />
                <FiChevronDown size={13} />
              </button>
              <AnimatePresence>
                {showSort && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                    style={{ position: 'absolute', right: 0, top: 40, background: '#fff',
                      borderRadius: 12, boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
                      border: '1px solid #f3f4f6', zIndex: 200, minWidth: 160, overflow: 'hidden' }}>
                    {SORT_OPTIONS.map(o => (
                      <button key={o.value}
                        onClick={() => { setSortBy(o.value); setShowSort(false); }}
                        style={{ display: 'block', width: '100%', padding: '10px 14px',
                          background: sortBy === o.value ? '#f0fdf4' : 'none', border: 'none',
                          cursor: 'pointer', textAlign: 'left', fontSize: 13,
                          color: sortBy === o.value ? '#25D366' : '#374151', fontWeight: sortBy === o.value ? 600 : 400 }}>
                        {o.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Type tabs */}
          <div style={{ display: 'flex', gap: 4, paddingBottom: 10, overflowX: 'auto' }}>
            {TABS.map(tab => (
              <button key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px',
                  borderRadius: 20, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                  fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                  background: activeTab === tab.key ? '#25D366' : '#f3f4f6',
                  color: activeTab === tab.key ? '#fff' : '#6b7280',
                  transition: 'all 0.15s',
                }}>
                {tab.icon} {tab.label}
                {stats && tab.key !== 'all' && stats[tab.key] && (
                  <span style={{ fontSize: 11 }}>({stats[tab.key]?.count ?? stats[tab.key] ?? 0})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: '0 auto', width: '100%', padding: '16px' }}>
        {/* ── Stats strip ─────────────────────────────────────────────── */}
        {stats && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Images',    v: stats.image,    icon: <FiImage size={14} />,    color: '#3b82f6' },
              { label: 'Videos',    v: stats.video,    icon: <FiVideo size={14} />,    color: '#8b5cf6' },
              { label: 'Voice',     v: stats.voice,    icon: <FiMic size={14} />,      color: '#f59e0b' },
              { label: 'Documents', v: stats.document, icon: <FiFileText size={14} />, color: '#10b981' },
            ].map(s => (
              <div key={s.label} style={{
                flex: '1 0 120px', background: '#fff', borderRadius: 12,
                padding: '10px 14px', border: '1px solid #f3f4f6', boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{ color: s.color, opacity: 0.85 }}>{s.icon}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                    {s.v?.count ?? 0}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {s.label} · {formatBytes(s.v?.bytes ?? 0)}
                  </div>
                </div>
              </div>
            ))}
            <div style={{
              flex: '1 0 120px', background: 'linear-gradient(135deg, #25D366 0%, #1aa355 100%)',
              borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <FiDatabase size={14} style={{ color: '#fff' }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>{stats.total}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>Total files</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Search ──────────────────────────────────────────────────── */}
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <FiSearch size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or contact…"
            style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: 12, border: '1px solid #e5e7eb',
              fontSize: 13, outline: 'none', background: '#fff', boxSizing: 'border-box' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
              <FiX size={14} />
            </button>
          )}
        </div>

        {/* ── Selection bar ───────────────────────────────────────────── */}
        <AnimatePresence>
          {(selMode || selected.size > 0) && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{
                background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb',
                padding: '10px 14px', marginBottom: 12,
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              }}>
              <button onClick={toggleAll}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f3f4f6',
                  border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500 }}>
                {selected.size === displayFiles.length ? <FiCheckSquare size={14} /> : <FiSquare size={14} />}
                {selected.size === displayFiles.length ? 'Deselect all' : 'Select all'}
              </button>
              <span style={{ fontSize: 13, color: '#6b7280', flex: 1 }}>
                {selected.size} selected
              </span>
              <button onClick={handleDownloadZip} disabled={!selected.size || zipping}
                style={{ display: 'flex', alignItems: 'center', gap: 6,
                  background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  opacity: !selected.size ? 0.5 : 1 }}>
                <FiPackage size={13} />
                {zipping ? 'Zipping…' : `Download ZIP (${selected.size})`}
              </button>
              <button onClick={handleDeleteSelected} disabled={!selected.size}
                style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fef2f2',
                  color: '#ef4444', border: 'none', cursor: 'pointer',
                  padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                  opacity: !selected.size ? 0.5 : 1 }}>
                <FiTrash2 size={13} /> Delete
              </button>
              <button onClick={() => { setSelMode(false); setSelected(new Set()); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                <FiX size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── File grid / list ────────────────────────────────────────── */}
        {viewMode === 'grid' ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: 10,
          }}>
            {displayFiles.map(file => (
              <motion.div
                key={file.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  background: '#fff', borderRadius: 12, overflow: 'hidden',
                  border: selected.has(file.id) ? '2px solid #25D366' : '2px solid transparent',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  cursor: 'pointer', position: 'relative', transition: 'border 0.1s',
                }}
                onClick={() => selMode || selected.size > 0 ? toggleSelect(file.id) : setPreview(file)}
                onContextMenu={e => { e.preventDefault(); setSelMode(true); toggleSelect(file.id); }}
              >
                {/* Thumbnail / icon */}
                <div style={{ height: 110, position: 'relative', background: '#f9fafb' }}>
                  {file.type === 'image' || file.thumbnail ? (
                    <ProgressiveImage
                      src={file.type === 'image' ? file.url : file.thumbnail}
                      thumb={file.thumbnail}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center',
                      justifyContent: 'center', color: TYPE_COLOR[file.type] || '#9ca3af' }}>
                      <FileTypeIcon type={file.type} size={36} />
                    </div>
                  )}
                  {/* Select checkbox */}
                  {(selMode || selected.size > 0) && (
                    <div style={{ position: 'absolute', top: 6, right: 6 }}>
                      {selected.has(file.id)
                        ? <FiCheckSquare size={18} color="#25D366" />
                        : <FiSquare size={18} color="#9ca3af" />}
                    </div>
                  )}
                  {/* Video badge */}
                  {file.type === 'video' && (
                    <div style={{ position: 'absolute', bottom: 4, right: 4, background: 'rgba(0,0,0,0.6)',
                      borderRadius: 4, padding: '2px 5px', fontSize: 10, color: '#fff' }}>
                      {file.duration ? `${Math.floor(file.duration/60)}:${String(file.duration%60).padStart(2,'0')}` : '▶'}
                    </div>
                  )}
                </div>
                {/* Meta */}
                <div style={{ padding: '7px 8px' }}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#374151',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.url.split('/').pop().split('?')[0]}
                  </div>
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 1 }}>
                    {file.chat_partner} · {formatDate(file.created_at)}
                  </div>
                  {file.size && <div style={{ fontSize: 10, color: '#d1d5db' }}>{formatBytes(file.size)}</div>}
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* ── List view ── */
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #f3f4f6', overflow: 'hidden' }}>
            {displayFiles.map((file, idx) => (
              <div key={file.id}
                onClick={() => selMode || selected.size > 0 ? toggleSelect(file.id) : setPreview(file)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 14px',
                  borderBottom: idx < displayFiles.length - 1 ? '1px solid #f9fafb' : 'none',
                  background: selected.has(file.id) ? '#f0fdf4' : '#fff',
                  cursor: 'pointer', transition: 'background 0.1s',
                }}>
                {/* Icon/thumb */}
                <div style={{ width: 44, height: 44, borderRadius: 10, overflow: 'hidden',
                  background: '#f3f4f6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: TYPE_COLOR[file.type] || '#9ca3af' }}>
                  {(file.type === 'image' || file.thumbnail) ? (
                    <ProgressiveImage
                      src={file.type === 'image' ? file.url : file.thumbnail}
                      style={{ width: '100%', height: '100%' }}
                    />
                  ) : <FileTypeIcon type={file.type} size={20} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.url.split('/').pop().split('?')[0]}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>
                    {file.is_sent ? '↑ You → ' : '↓ '}{file.chat_partner} · {formatDate(file.created_at)}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#d1d5db', textAlign: 'right', flexShrink: 0 }}>
                  {formatBytes(file.size)}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 6 }} onClick={e => e.stopPropagation()}>
                  <button onClick={() => handleSingleDownload(file)}
                    style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer',
                      padding: 7, borderRadius: 8, color: '#374151' }}>
                    <FiDownload size={14} />
                  </button>
                  <button onClick={() => copyLink(file)}
                    style={{ background: '#f3f4f6', border: 'none', cursor: 'pointer',
                      padding: 7, borderRadius: 8, color: '#374151' }}>
                    <FiLink size={14} />
                  </button>
                  {(selMode || selected.size > 0) && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      {selected.has(file.id)
                        ? <FiCheckSquare size={18} color="#25D366" />
                        : <FiSquare size={18} color="#9ca3af" />}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && displayFiles.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9ca3af' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📂</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No files yet</div>
            <div style={{ fontSize: 13 }}>
              {activeTab === 'all' ? 'Files you send or receive will appear here.' : `No ${activeTab} files found.`}
            </div>
          </div>
        )}

        {/* Infinite scroll loader */}
        <div ref={loaderRef} style={{ height: 1 }} />
        {loading && (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af' }}>
            <div style={{ display: 'inline-block', width: 24, height: 24, borderRadius: '50%',
              border: '3px solid #e5e7eb', borderTopColor: '#25D366',
              animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}
      </div>

      {/* ── Preview modal ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setPreview(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
              zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', padding: 20 }}>
            <motion.div
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              onClick={e => e.stopPropagation()}
              style={{ maxWidth: '90vw', maxHeight: '80vh', borderRadius: 16, overflow: 'hidden',
                background: '#111', boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }}>
              {preview.type === 'image' && (
                <img src={preview.url} alt="" style={{ maxWidth: '90vw', maxHeight: '70vh', display: 'block', objectFit: 'contain' }} />
              )}
              {preview.type === 'video' && (
                <video src={preview.url} controls style={{ maxWidth: '90vw', maxHeight: '70vh' }} autoPlay />
              )}
              {(preview.type === 'voice' || preview.type === 'audio') && (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <FiMic size={48} style={{ color: '#f59e0b', marginBottom: 16 }} />
                  <audio src={preview.url} controls />
                </div>
              )}
              {(preview.type !== 'image' && preview.type !== 'video' && preview.type !== 'voice' && preview.type !== 'audio') && (
                <div style={{ padding: 32, textAlign: 'center', color: '#fff' }}>
                  <FiFileText size={48} style={{ marginBottom: 16 }} />
                  <p style={{ margin: '0 0 16px' }}>{preview.url.split('/').pop()}</p>
                </div>
              )}
            </motion.div>
            {/* Actions */}
            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button onClick={() => handleSingleDownload(preview)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#25D366',
                  color: '#fff', border: 'none', cursor: 'pointer', padding: '10px 20px',
                  borderRadius: 10, fontWeight: 600 }}>
                <FiDownload size={16} /> Download
              </button>
              <button onClick={() => { copyLink(preview); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.15)',
                  color: '#fff', border: 'none', cursor: 'pointer', padding: '10px 20px',
                  borderRadius: 10, fontWeight: 600 }}>
                <FiLink size={16} /> Copy Link
              </button>
              <button onClick={() => setPreview(null)}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none',
                  cursor: 'pointer', padding: '10px 16px', borderRadius: 10 }}>
                <FiX size={18} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB: Select mode toggle */}
      <button
        onClick={() => setSelMode(s => !s)}
        style={{
          position: 'fixed', bottom: 24, right: 24,
          background: '#25D366', color: '#fff', border: 'none', cursor: 'pointer',
          width: 52, height: 52, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(37,211,102,0.4)', zIndex: 200,
          transition: 'transform 0.15s',
        }}
        title={selMode ? 'Cancel selection' : 'Select files'}
      >
        {selMode ? <FiX size={22} /> : <FiCheckSquare size={22} />}
      </button>
    </div>
  );
}
