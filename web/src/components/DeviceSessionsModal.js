/**
 * Multi-Device Sessions Manager
 * Shows all active sessions and allows revoking individual devices.
 */
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  FiMonitor, FiSmartphone, FiTablet, FiX, FiAlertTriangle,
  FiRefreshCw, FiArrowLeft, FiShield, FiClock,
} from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function getDeviceIcon(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone') || (ua.includes('android') && ua.includes('mobile'))) return FiSmartphone;
  if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) return FiTablet;
  return FiMonitor;
}

function getDeviceName(userAgent = '') {
  const ua = userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua)) return 'iPad';
  if (/Android/.test(ua)) {
    const match = ua.match(/Android [^;]+; ([^)]+)\)/);
    return match ? match[1].trim() : 'Android';
  }
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}

function getBrowserName(userAgent = '') {
  if (/Edg/.test(userAgent)) return 'Edge';
  if (/Chrome/.test(userAgent)) return 'Chrome';
  if (/Firefox/.test(userAgent)) return 'Firefox';
  if (/Safari/.test(userAgent)) return 'Safari';
  if (/Opera/.test(userAgent)) return 'Opera';
  return 'Browser';
}

function formatTime(isoString) {
  if (!isoString) return 'Unknown';
  const d = new Date(isoString);
  const now = new Date();
  const diff = (now - d) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function DeviceSessionsModal({ onClose }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data.sessions || []);
    } catch {
      // If endpoint doesn't exist yet, show current device as fallback
      setSessions([{
        id: 'current',
        isCurrent: true,
        userAgent: navigator.userAgent,
        lastActive: new Date().toISOString(),
        ip: '—',
        location: 'Current session',
      }]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSessions(); }, []);

  const revoke = async (sessionId) => {
    if (sessionId === 'current') {
      toast.error("Can't revoke current session");
      return;
    }
    setRevoking(sessionId);
    try {
      await api.delete(`/auth/sessions/${sessionId}`);
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session revoked');
    } catch {
      toast.error('Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  };

  const revokeAll = async () => {
    if (!window.confirm('This will log out all other devices. Continue?')) return;
    try {
      await api.delete('/auth/sessions/all-others');
      setSessions(prev => prev.filter(s => s.isCurrent));
      toast.success('All other sessions revoked');
    } catch {
      toast.error('Failed to revoke sessions');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="sm:hidden p-1 rounded-full hover:bg-gray-100"><FiArrowLeft size={18} /></button>
            <FiShield size={20} className="text-[#25D366]" />
            <div>
              <h2 className="font-bold text-gray-900">Active Devices</h2>
              <p className="text-xs text-gray-500">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={loadSessions} className="p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={onClose} className="hidden sm:flex p-2 rounded-full hover:bg-gray-100 text-gray-500">
              <FiX size={18} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[70vh] p-4 space-y-3">
          {loading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-gray-50 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-2 bg-gray-200 rounded w-3/4" />
                </div>
              </div>
            ))
          ) : sessions.length === 0 ? (
            <div className="text-center py-8 text-gray-400">No sessions found</div>
          ) : (
            sessions.map(session => {
              const DevIcon = getDeviceIcon(session.userAgent);
              return (
                <div
                  key={session.id}
                  className={`flex items-center gap-3 p-4 rounded-2xl border ${session.isCurrent ? 'border-[#25D366] bg-green-50' : 'border-gray-100 bg-white'}`}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${session.isCurrent ? 'bg-[#25D366] text-white' : 'bg-gray-100 text-gray-500'}`}>
                    <DevIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm text-gray-900 truncate">
                        {getDeviceName(session.userAgent)}
                      </p>
                      {session.isCurrent && (
                        <span className="text-xs bg-[#25D366] text-white px-1.5 py-0.5 rounded-full flex-shrink-0">This device</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {getBrowserName(session.userAgent)} · {session.location || session.ip || '—'}
                    </p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                      <FiClock size={10} /> {formatTime(session.lastActive)}
                    </p>
                  </div>
                  {!session.isCurrent && (
                    <button
                      onClick={() => revoke(session.id)}
                      disabled={revoking === session.id}
                      className="p-2 rounded-xl text-red-400 hover:bg-red-50 hover:text-red-600 transition disabled:opacity-40"
                      title="Revoke session"
                    >
                      {revoking === session.id
                        ? <FiRefreshCw size={16} className="animate-spin" />
                        : <FiX size={16} />
                      }
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {sessions.filter(s => !s.isCurrent).length > 1 && (
          <div className="p-4 border-t border-gray-100">
            <button
              onClick={revokeAll}
              className="w-full flex items-center justify-center gap-2 py-3 text-red-500 font-semibold text-sm rounded-2xl hover:bg-red-50 transition border border-red-100"
            >
              <FiAlertTriangle size={16} />
              Log out all other devices
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
