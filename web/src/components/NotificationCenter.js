/**
 * NotificationCenter — Bell icon in header with system notifications panel.
 * Shows unread badge, pulls VipChat system announcements, marks as read.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiBell, FiX, FiCheckCircle, FiGift } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../services/api';

function timeAgo(iso) {
  const diff = (Date.now() - new Date(iso)) / 1000;
  if (diff < 60)   return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NotificationCenter() {
  const [open, setOpen]           = useState(false);
  const [notifs, setNotifs]       = useState([]);
  const [unread, setUnread]       = useState(0);
  const [loading, setLoading]     = useState(false);
  const panelRef                  = useRef(null);

  const fetchUnread = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/system/unread-count');
      setUnread(data.unread || 0);
    } catch {}
  }, []);

  const fetchNotifs = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications/system');
      setNotifs(data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => clearInterval(id);
  }, [fetchUnread]);

  const handleOpen = async () => {
    setOpen(true);
    await fetchNotifs();
  };

  const markRead = async (id) => {
    try {
      await api.post(`/notifications/system/${id}/read`);
      setNotifs(n => n.map(x => x.id === id ? { ...x, read: true } : x));
      setUnread(u => Math.max(0, u - 1));
    } catch {}
  };

  const markAll = async () => {
    try {
      await api.post('/notifications/system/read-all');
      setNotifs(n => n.map(x => ({ ...x, read: true })));
      setUnread(0);
    } catch {}
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = e => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        style={{
          position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
          padding: '6px', borderRadius: '50%', display: 'flex', alignItems: 'center',
          color: '#374151', transition: 'background 0.15s',
        }}
        title="Notifications"
      >
        <FiBell size={20} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              style={{
                position: 'absolute', top: 1, right: 1, minWidth: 16, height: 16,
                background: '#ef4444', borderRadius: '50%', fontSize: 10,
                color: '#fff', display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontWeight: 700, lineHeight: 1,
                padding: '0 3px',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Notification panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{ opacity: 0,  y: -8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', top: 40, right: 0, width: 340, maxHeight: 480,
              background: '#fff', borderRadius: 16, boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
              border: '1px solid #f3f4f6', overflow: 'hidden', zIndex: 9999,
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>
                Notifications {unread > 0 && <span style={{ color: '#25D366' }}>({unread})</span>}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {unread > 0 && (
                  <button onClick={markAll}
                    style={{ fontSize: 11, color: '#25D366', background: 'none', border: 'none',
                      cursor: 'pointer', fontWeight: 600 }}>
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af' }}>
                  <FiX size={16} />
                </button>
              </div>
            </div>

            {/* Body */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loading && (
                <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af' }}>
                  Loading…
                </div>
              )}
              {!loading && notifs.length === 0 && (
                <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>
                  <FiBell size={32} style={{ marginBottom: 8, opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No notifications yet</p>
                </div>
              )}
              {notifs.map(n => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read) markRead(n.id); if (n.action_url) window.location.href = n.action_url; }}
                  style={{
                    padding: '12px 16px', cursor: n.action_url || !n.read ? 'pointer' : 'default',
                    background: n.read ? '#fff' : '#f0fdf4',
                    borderBottom: '1px solid #f3f4f6',
                    transition: 'background 0.15s',
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: '#dcfce7', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontSize: 18, flexShrink: 0,
                  }}>
                    {n.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: n.read ? 500 : 700, fontSize: 13, color: '#111827' }}>
                        {n.title}
                      </span>
                      {!n.read && (
                        <span style={{ width: 8, height: 8, borderRadius: '50%',
                          background: '#25D366', flexShrink: 0, marginLeft: 8 }} />
                      )}
                    </div>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                      {n.body}
                    </p>
                    <span style={{ fontSize: 11, color: '#d1d5db', marginTop: 4, display: 'block' }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
