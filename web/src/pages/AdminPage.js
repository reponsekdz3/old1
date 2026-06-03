import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiUsers, FiMessageSquare, FiPhone, FiShield, FiArrowLeft,
  FiSearch, FiTrash2, FiSlash, FiCheckCircle, FiBarChart2,
  FiRefreshCw, FiChevronLeft, FiChevronRight, FiRadio,
  FiActivity, FiTrendingUp, FiUserCheck, FiAlertTriangle,
  FiGrid, FiList, FiMoreVertical, FiSend, FiX, FiEye,
  FiToggleLeft, FiToggleRight, FiDownload, FiFilter,
} from 'react-icons/fi';
import toast from 'react-hot-toast';
import { format, formatDistanceToNow } from 'date-fns';

// ── Mini bar-chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ data, color = '#25D366' }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((d, i) => (
        <div key={i} className="flex-1 rounded-sm transition-all" title={`${d.label}: ${d.value}`}
          style={{ height: `${Math.max(4, (d.value / max) * 100)}%`, backgroundColor: color, opacity: 0.7 + (i / data.length) * 0.3 }} />
      ))}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, chart, trend }) {
  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-11 h-11 ${color} rounded-xl flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className="text-white" />
        </div>
        {trend !== undefined && (
          <span className={`text-xs font-semibold px-2 py-1 rounded-full ${trend >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'}`}>
            {trend >= 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900">{value?.toLocaleString() ?? '—'}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {chart && <div className="mt-3"><MiniBarChart data={chart} /></div>}
    </motion.div>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────
function Avatar({ user, size = 'sm' }) {
  const cls = size === 'sm' ? 'w-9 h-9 text-sm' : 'w-12 h-12 text-base';
  return (
    <div className={`${cls} rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white font-bold flex-shrink-0 overflow-hidden`}>
      {user.avatar_url
        ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
        : user.full_name?.[0]?.toUpperCase() || '?'}
    </div>
  );
}

// ── User Detail Modal ──────────────────────────────────────────────────────────
function UserDetailModal({ user, onClose, onBan, onUnban, onMakeAdmin, onRemoveAdmin, onDelete, isMe }) {
  if (!user) return null;
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-[#075E54] to-[#25D366] p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-lg">User Profile</h3>
            <button onClick={onClose} className="p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition"><FiX size={16}/></button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center text-2xl font-bold overflow-hidden">
              {user.avatar_url ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover"/> : user.full_name?.[0]?.toUpperCase()}
            </div>
            <div>
              <h4 className="text-xl font-bold">{user.full_name}</h4>
              <p className="text-white/80 text-sm">{user.phone_number}</p>
              <div className="flex gap-2 mt-1.5">
                {user.is_admin && <span className="bg-blue-400/30 text-white text-xs px-2 py-0.5 rounded-full font-semibold">Admin</span>}
                {user.is_banned && <span className="bg-red-400/30 text-white text-xs px-2 py-0.5 rounded-full font-semibold">Banned</span>}
                {!user.is_banned && !user.is_admin && <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full font-semibold">Active</span>}
              </div>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Messages', value: user.message_count ?? 0 },
              { label: 'Contacts', value: user.contact_count ?? 0 },
              { label: 'Calls', value: user.call_count ?? 0 },
            ].map(s => (
              <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2 text-sm text-gray-600 mb-5">
            <div className="flex justify-between"><span className="text-gray-400">Joined</span><span className="font-medium">{format(new Date(user.created_at), 'MMM d, yyyy')}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Last seen</span><span className="font-medium">{user.last_seen ? formatDistanceToNow(new Date(user.last_seen), { addSuffix: true }) : 'Unknown'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Verified</span><span className={`font-medium ${user.is_verified ? 'text-green-600' : 'text-red-500'}`}>{user.is_verified ? 'Yes' : 'No'}</span></div>
            <div className="flex justify-between"><span className="text-gray-400">Confirmed</span><span className={`font-medium ${user.account_confirmed_at ? 'text-green-600' : 'text-orange-500'}`}>{user.account_confirmed_at ? 'Yes' : 'Pending'}</span></div>
          </div>
          {!isMe && (
            <div className="flex flex-col gap-2">
              {user.is_banned
                ? <button onClick={() => { onUnban(user.id); onClose(); }} className="flex items-center justify-center gap-2 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-semibold text-sm transition"><FiCheckCircle size={15}/>Unban User</button>
                : <button onClick={() => { onBan(user.id); onClose(); }} className="flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-semibold text-sm transition"><FiSlash size={15}/>Ban User</button>
              }
              {user.is_admin
                ? <button onClick={() => { onRemoveAdmin(user.id); onClose(); }} className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm transition"><FiToggleLeft size={15}/>Remove Admin</button>
                : <button onClick={() => { onMakeAdmin(user.id); onClose(); }} className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl font-semibold text-sm transition"><FiToggleRight size={15}/>Make Admin</button>
              }
              <button onClick={() => { onDelete(user.id); onClose(); }} className="flex items-center justify-center gap-2 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl font-semibold text-sm transition"><FiTrash2 size={15}/>Delete Account</button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Broadcast Modal ────────────────────────────────────────────────────────────
function BroadcastModal({ onClose, onSend }) {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSend = async () => {
    if (!message.trim()) return;
    setLoading(true);
    try { await onSend(message); onClose(); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-gray-900">📢 Broadcast Message</h3>
          <button onClick={onClose} className="p-1.5 bg-gray-100 rounded-full hover:bg-gray-200 transition"><FiX size={16}/></button>
        </div>
        <p className="text-sm text-gray-500 mb-4">Send a system message to all users on the platform.</p>
        <textarea value={message} onChange={e => setMessage(e.target.value)}
          placeholder="Type your broadcast message..."
          className="w-full border-2 border-gray-200 rounded-xl p-3.5 text-sm focus:outline-none focus:border-[#25D366] resize-none" rows={4} />
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition">Cancel</button>
          <button onClick={handleSend} disabled={!message.trim() || loading}
            className="flex-1 py-2.5 bg-[#25D366] hover:bg-[#1fbd5a] disabled:bg-gray-200 text-white rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2">
            {loading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"/>
              : <><FiSend size={14}/>Send to All</>}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── MAIN AdminPage ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
  { id: 'users', label: 'Users', icon: FiUsers },
  { id: 'messages', label: 'Messages', icon: FiMessageSquare },
  { id: 'groups', label: 'Groups', icon: FiUsers },
  { id: 'activity', label: 'Activity', icon: FiActivity },
];

function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [groups, setGroups] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usersPage, setUsersPage] = useState(1);
  const [usersTotalPages, setUsersTotalPages] = useState(1);
  const [usersTotal, setUsersTotal] = useState(0);
  const [msgsPage, setMsgsPage] = useState(1);
  const [msgsTotalPages, setMsgsTotalPages] = useState(1);
  const [grpsPage, setGrpsPage] = useState(1);
  const [grpsTotalPages, setGrpsTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data } = await api.get('/admin/me');
      if (!data.is_admin) { toast.error('Admin access required'); navigate('/'); return; }
      setIsAdmin(true);
      loadAll();
    } catch {
      toast.error('Access denied');
      navigate('/');
    } finally {
      setCheckingAdmin(false);
    }
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.allSettled([loadStats(), loadUsers(1), loadMessages(1), loadGroups(1), loadActivity()]);
    setLoading(false);
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/admin/dashboard');
      setStats(data.stats);
    } catch {}
  };

  const loadUsers = useCallback(async (page = 1, q = search, f = filter) => {
    try {
      const params = new URLSearchParams({ page, per_page: 20, search: q, filter: f });
      const { data } = await api.get(`/admin/users?${params}`);
      setUsers(data.users || []);
      setUsersTotalPages(data.pages || 1);
      setUsersTotal(data.total || 0);
      setUsersPage(page);
    } catch {}
  }, [search, filter]);

  const loadMessages = async (page = 1) => {
    try {
      const { data } = await api.get(`/admin/messages?page=${page}&per_page=25`);
      setMessages(data.messages || []);
      setMsgsTotalPages(data.pages || 1);
      setMsgsPage(page);
    } catch {}
  };

  const loadGroups = async (page = 1) => {
    try {
      const { data } = await api.get(`/admin/groups?page=${page}`);
      setGroups(data.groups || []);
      setGrpsTotalPages(data.pages || 1);
      setGrpsPage(page);
    } catch {}
  };

  const loadActivity = async () => {
    try {
      const { data } = await api.get('/admin/stats/activity?days=14');
      setActivity(data.activity || []);
    } catch {}
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
    toast.success('Data refreshed');
  };

  const handleBan = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/ban`);
      toast.success('User banned');
      loadUsers(usersPage);
      loadStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleUnban = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/unban`);
      toast.success('User unbanned');
      loadUsers(usersPage);
      loadStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleMakeAdmin = async (userId) => {
    if (!window.confirm('Make this user an admin?')) return;
    try {
      await api.put(`/admin/users/${userId}/make-admin`);
      toast.success('Admin granted');
      loadUsers(usersPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleRemoveAdmin = async (userId) => {
    if (!window.confirm('Remove admin status from this user?')) return;
    try {
      await api.put(`/admin/users/${userId}/remove-admin`);
      toast.success('Admin removed');
      loadUsers(usersPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleConfirmAccount = async (userId) => {
    try {
      await api.put(`/admin/users/${userId}/confirm-account`);
      toast.success('Account confirmed');
      loadUsers(usersPage);
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to confirm'); }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Delete this account permanently? This cannot be undone.')) return;
    try {
      await api.delete(`/admin/users/${userId}`);
      toast.success('User deleted');
      loadUsers(usersPage);
      loadStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleDeleteMessage = async (msgId) => {
    try {
      await api.delete(`/admin/messages/${msgId}`);
      toast.success('Message removed');
      loadMessages(msgsPage);
      loadStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleDeleteGroup = async (groupId) => {
    if (!window.confirm('Delete this group permanently?')) return;
    try {
      await api.delete(`/admin/groups/${groupId}`);
      toast.success('Group deleted');
      loadGroups(grpsPage);
      loadStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleBroadcast = async (content) => {
    try {
      await api.post('/admin/broadcast', { content });
      toast.success('Broadcast sent to all users!');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); throw e; }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const delayDebounce = setTimeout(() => loadUsers(1, search, filter), 400);
    return () => clearTimeout(delayDebounce);
  }, [search, filter, isAdmin]);

  if (checkingAdmin) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
          <p className="text-gray-500">Checking access...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const activityChartData = activity.slice(-7).map(d => ({
    label: d.date, value: d.messages
  }));

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      {/* ── Sidebar ── */}
      <div className="w-64 bg-[#075E54] flex flex-col shadow-xl flex-shrink-0">
        {/* Header */}
        <div className="px-5 py-5 border-b border-white/10">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/60 hover:text-white text-sm mb-4 transition">
            <FiArrowLeft size={14}/> Back to App
          </button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <FiShield size={18} className="text-white"/>
            </div>
            <div>
              <h1 className="text-white font-bold text-base">Admin Panel</h1>
              <p className="text-white/50 text-xs">VipChat Management</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-white/20 text-white' : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}>
              <tab.icon size={16}/>
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Actions */}
        <div className="px-3 pb-4 space-y-2">
          <button onClick={() => setShowBroadcast(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-[#25D366]/20 hover:bg-[#25D366]/30 text-[#25D366] rounded-xl text-sm font-medium transition">
            <FiRadio size={15}/> Broadcast
          </button>
          <button onClick={refresh} disabled={refreshing}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-white/10 hover:bg-white/20 text-white/70 hover:text-white rounded-xl text-sm font-medium transition">
            <motion.div animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <FiRefreshCw size={14}/>
            </motion.div>
            Refresh Data
          </button>
        </div>

        {/* Admin user */}
        <div className="px-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">
              {user?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user?.full_name}</p>
              <p className="text-white/40 text-xs">Administrator</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {TABS.find(t => t.id === activeTab)?.label}
            </h2>
            <p className="text-gray-400 text-sm">
              {activeTab === 'dashboard' && 'Platform overview and metrics'}
              {activeTab === 'users' && `${usersTotal.toLocaleString()} total users`}
              {activeTab === 'messages' && 'All messages on the platform'}
              {activeTab === 'groups' && 'All groups and communities'}
              {activeTab === 'activity' && 'Usage trends over time'}
            </p>
          </div>
          {activeTab === 'users' && (
            <div className="flex items-center gap-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
                  className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366] w-56"/>
              </div>
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="py-2 px-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366] bg-white">
                <option value="all">All Users</option>
                <option value="active">Active 24h</option>
                <option value="banned">Banned</option>
                <option value="admins">Admins</option>
              </select>
            </div>
          )}
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="w-10 h-10 border-4 border-[#25D366] border-t-transparent rounded-full animate-spin mx-auto mb-3"/>
                <p className="text-gray-400 text-sm">Loading...</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── DASHBOARD ── */}
              {activeTab === 'dashboard' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard icon={FiUsers} label="Total Users" value={stats?.total_users} color="bg-[#075E54]"
                      sub={`+${stats?.new_users_7d ?? 0} this week`} trend={stats?.new_users_7d > 0 ? 12 : 0}
                      chart={activityChartData.map(d => ({ ...d, value: Math.floor(d.value * 0.1) }))} />
                    <StatCard icon={FiMessageSquare} label="Total Messages" value={stats?.total_messages} color="bg-[#25D366]"
                      sub={`${stats?.messages_today ?? 0} today`} trend={stats?.messages_today > 0 ? 8 : 0}
                      chart={activityChartData} />
                    <StatCard icon={FiPhone} label="Total Calls" value={stats?.total_calls} color="bg-blue-500"
                      sub={`${stats?.calls_today ?? 0} today`}
                      chart={activityChartData.map(d => ({ ...d, value: d.value * 0.05 }))} />
                    <StatCard icon={FiActivity} label="Active (24h)" value={stats?.active_24h} color="bg-purple-500"
                      sub="Unique active users" />
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Recent users */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">Recent Users</h3>
                        <button onClick={() => setActiveTab('users')} className="text-xs text-[#25D366] hover:underline font-medium">View all</button>
                      </div>
                      <div className="space-y-3">
                        {users.slice(0, 5).map(u => (
                          <div key={u.id} className="flex items-center gap-3">
                            <Avatar user={u} />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900 truncate">{u.full_name}</p>
                              <p className="text-xs text-gray-400 truncate">{u.phone_number}</p>
                            </div>
                            <div className="flex gap-1">
                              {u.is_admin && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-semibold">Admin</span>}
                              {u.is_banned && <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-semibold">Banned</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Activity chart */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                      <h3 className="font-bold text-gray-900 mb-4">Message Activity (14 days)</h3>
                      {activity.length > 0 ? (
                        <div className="flex items-end gap-1 h-32">
                          {activity.map((d, i) => {
                            const max = Math.max(...activity.map(a => a.messages), 1);
                            const height = Math.max(4, (d.messages / max) * 100);
                            return (
                              <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.messages} msgs`}>
                                <div className="w-full rounded-t-sm bg-[#25D366] transition-all"
                                  style={{ height: `${height}%`, opacity: 0.5 + (i / activity.length) * 0.5 }} />
                                {i % 3 === 0 && <span className="text-[9px] text-gray-400 whitespace-nowrap">{format(new Date(d.date), 'M/d')}</span>}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-gray-400 text-sm">No activity data</div>
                      )}
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{activity.reduce((s, d) => s + d.messages, 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-400">Total messages</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{activity.reduce((s, d) => s + d.active_users, 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-400">User sessions</p>
                        </div>
                        <div className="text-center">
                          <p className="text-lg font-bold text-gray-900">{activity.reduce((s, d) => s + d.calls, 0).toLocaleString()}</p>
                          <p className="text-xs text-gray-400">Total calls</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick stats grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Groups', value: stats?.total_groups, icon: '👥', color: 'bg-orange-50', textColor: 'text-orange-600' },
                      { label: 'Calls Today', value: stats?.calls_today, icon: '📞', color: 'bg-blue-50', textColor: 'text-blue-600' },
                      { label: 'New This Week', value: stats?.new_users_7d, icon: '✨', color: 'bg-purple-50', textColor: 'text-purple-600' },
                      { label: 'Online Now (24h)', value: stats?.active_24h, icon: '🟢', color: 'bg-green-50', textColor: 'text-green-600' },
                    ].map(s => (
                      <div key={s.label} className={`${s.color} rounded-2xl p-4 border border-transparent`}>
                        <div className="text-2xl mb-1">{s.icon}</div>
                        <p className={`text-2xl font-bold ${s.textColor}`}>{s.value?.toLocaleString() ?? '—'}</p>
                        <p className="text-sm text-gray-600 font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── USERS ── */}
              {activeTab === 'users' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Phone</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Joined</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Msgs</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {users.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-12 text-gray-400">No users found</td></tr>
                        ) : users.map(u => (
                          <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <Avatar user={u}/>
                                <div className="min-w-0">
                                  <p className="font-semibold text-sm text-gray-900 truncate max-w-[140px]">{u.full_name}</p>
                                  <p className="text-xs text-gray-400">{u.last_seen ? formatDistanceToNow(new Date(u.last_seen), { addSuffix: true }) : 'Never'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden md:table-cell">{u.phone_number}</td>
                            <td className="px-4 py-3 text-xs text-gray-500 hidden lg:table-cell">{format(new Date(u.created_at), 'MMM d, yyyy')}</td>
                            <td className="px-4 py-3 text-center text-xs font-medium text-gray-700 hidden md:table-cell">{(u.message_count ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap gap-1">
                                {u.is_admin && <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Admin</span>}
                                {u.is_banned && <span className="bg-red-100 text-red-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Banned</span>}
                                {!u.is_admin && !u.is_banned && <span className="bg-green-100 text-green-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Active</span>}
                                {!u.account_confirmed_at && <span className="bg-orange-100 text-orange-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Unconfirmed</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1 justify-end">
                                <button onClick={() => setSelectedUser(u)}
                                  className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 rounded-lg transition" title="View details">
                                  <FiEye size={13}/>
                                </button>
                                {u.id !== user?.id && (
                                  <>
                                    {!u.account_confirmed_at && (
                                      <button onClick={() => handleConfirmAccount(u.id)} className="p-1.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg transition" title="Confirm Account">✓</button>
                                    )}
                                    {u.is_banned
                                      ? <button onClick={() => handleUnban(u.id)} className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition" title="Unban"><FiCheckCircle size={13}/></button>
                                      : <button onClick={() => handleBan(u.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition" title="Ban"><FiSlash size={13}/></button>
                                    }
                                    <button onClick={() => handleDeleteUser(u.id)} className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition" title="Delete"><FiTrash2 size={13}/></button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {/* Pagination */}
                  {usersTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Page {usersPage} of {usersTotalPages} • {usersTotal} users</p>
                      <div className="flex gap-1">
                        <button onClick={() => loadUsers(usersPage - 1)} disabled={usersPage === 1}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronLeft size={16}/></button>
                        <button onClick={() => loadUsers(usersPage + 1)} disabled={usersPage === usersTotalPages}
                          className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronRight size={16}/></button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── MESSAGES ── */}
              {activeTab === 'messages' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Sender</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Content</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Type</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Sent</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {messages.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-12 text-gray-400">No messages</td></tr>
                        ) : messages.map(m => (
                          <tr key={m.id} className={`hover:bg-gray-50 transition-colors ${m.is_deleted_everyone ? 'opacity-40' : ''}`}>
                            <td className="px-4 py-3">
                              <p className="text-sm font-semibold text-gray-800 truncate max-w-[120px]">{m.sender_name}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-600 truncate max-w-[220px]">
                                {m.is_deleted_everyone ? <em className="text-gray-400">Deleted</em> : (m.content || `[${m.media_type || 'media'}]`)}
                              </p>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium capitalize">
                                {m.media_type || 'text'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                              {format(new Date(m.created_at), 'MMM d, HH:mm')}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {!m.is_deleted_everyone && (
                                <button onClick={() => handleDeleteMessage(m.id)}
                                  className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition" title="Remove">
                                  <FiTrash2 size={13}/>
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {msgsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Page {msgsPage} of {msgsTotalPages}</p>
                      <div className="flex gap-1">
                        <button onClick={() => loadMessages(msgsPage - 1)} disabled={msgsPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronLeft size={16}/></button>
                        <button onClick={() => loadMessages(msgsPage + 1)} disabled={msgsPage === msgsTotalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronRight size={16}/></button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── GROUPS ── */}
              {activeTab === 'groups' && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Group</th>
                          <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Members</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Created</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {groups.length === 0 ? (
                          <tr><td colSpan={4} className="text-center py-12 text-gray-400">No groups found</td></tr>
                        ) : groups.map(g => (
                          <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                                  {g.avatar_url ? <img src={g.avatar_url} alt="" className="w-full h-full object-cover"/> : g.name?.[0]?.toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-semibold text-sm text-gray-900">{g.name}</p>
                                  {g.description && <p className="text-xs text-gray-400 truncate max-w-[200px]">{g.description}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">{g.members_count}</td>
                            <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">{format(new Date(g.created_at), 'MMM d, yyyy')}</td>
                            <td className="px-4 py-3 text-right">
                              <button onClick={() => handleDeleteGroup(g.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition" title="Delete">
                                <FiTrash2 size={13}/>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {grpsTotalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Page {grpsPage} of {grpsTotalPages}</p>
                      <div className="flex gap-1">
                        <button onClick={() => loadGroups(grpsPage - 1)} disabled={grpsPage === 1} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronLeft size={16}/></button>
                        <button onClick={() => loadGroups(grpsPage + 1)} disabled={grpsPage === grpsTotalPages} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronRight size={16}/></button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── ACTIVITY ── */}
              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                    <h3 className="font-bold text-gray-900 mb-5">Daily Activity (Last 14 days)</h3>
                    {activity.length > 0 ? (
                      <>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-xs text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-100 pb-2">
                                <th className="pb-3">Date</th>
                                <th className="pb-3 text-right">Messages</th>
                                <th className="pb-3 text-right">Active Users</th>
                                <th className="pb-3 text-right">Calls</th>
                                <th className="pb-3 w-32">Msg Trend</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {[...activity].reverse().map((d, i) => {
                                const max = Math.max(...activity.map(a => a.messages), 1);
                                const pct = Math.round((d.messages / max) * 100);
                                return (
                                  <tr key={d.date} className="hover:bg-gray-50 transition-colors">
                                    <td className="py-3 font-medium text-gray-700">{format(new Date(d.date), 'MMM d, yyyy')}</td>
                                    <td className="py-3 text-right font-bold text-gray-900">{d.messages.toLocaleString()}</td>
                                    <td className="py-3 text-right text-gray-600">{d.active_users.toLocaleString()}</td>
                                    <td className="py-3 text-right text-gray-600">{d.calls.toLocaleString()}</td>
                                    <td className="py-3">
                                      <div className="w-full bg-gray-100 rounded-full h-2">
                                        <div className="bg-[#25D366] h-2 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            <tfoot>
                              <tr className="border-t-2 border-gray-200 font-bold">
                                <td className="pt-3 text-gray-900">Totals</td>
                                <td className="pt-3 text-right text-[#25D366]">{activity.reduce((s, d) => s + d.messages, 0).toLocaleString()}</td>
                                <td className="pt-3 text-right text-gray-600">{activity.reduce((s, d) => s + d.active_users, 0).toLocaleString()}</td>
                                <td className="pt-3 text-right text-gray-600">{activity.reduce((s, d) => s + d.calls, 0).toLocaleString()}</td>
                                <td></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-12 text-gray-400">
                        <FiBarChart2 size={40} className="mx-auto mb-3 opacity-30"/>
                        <p>No activity data yet</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── User Detail Modal ── */}
      <AnimatePresence>
        {selectedUser && (
          <UserDetailModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            onBan={handleBan}
            onUnban={handleUnban}
            onMakeAdmin={handleMakeAdmin}
            onRemoveAdmin={handleRemoveAdmin}
            onDelete={handleDeleteUser}
            isMe={selectedUser.id === user?.id}
          />
        )}
      </AnimatePresence>

      {/* ── Broadcast Modal ── */}
      <AnimatePresence>
        {showBroadcast && (
          <BroadcastModal onClose={() => setShowBroadcast(false)} onSend={handleBroadcast}/>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminPage;
