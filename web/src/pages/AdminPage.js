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
  FiCode, FiZap, FiWifi, FiLock, FiServer, FiClock,
  FiDollarSign, FiMousePointer, FiShoppingBag, FiCreditCard,
  FiPackage, FiAlertCircle, FiSettings, FiPieChart, FiDatabase,
  FiGlobe, FiCpu, FiCheck, FiMinus, FiPlus,
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

// ── Severity badge ──────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const map = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-50 text-blue-600',
  };
  return (
    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[severity] || 'bg-gray-100 text-gray-500'}`}>
      {severity}
    </span>
  );
}

// ── MAIN AdminPage ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
  { id: 'live', label: 'Live', icon: FiRadio, badge: 'LIVE' },
  { id: 'users', label: 'Users', icon: FiUsers },
  { id: 'roles', label: 'Roles', icon: FiShield },
  { id: 'messages', label: 'Messages', icon: FiMessageSquare },
  { id: 'groups', label: 'Groups', icon: FiUsers },
  { id: 'activity', label: 'Activity', icon: FiActivity },
  { id: 'api_clients', label: 'API Clients', icon: FiCode },
  { id: 'ads', label: 'Ads', icon: FiZap },
  { id: 'marketplace', label: 'Marketplace', icon: FiShoppingBag },
  { id: 'paypal', label: 'PayPal', icon: FiCreditCard },
  { id: 'revenue', label: 'Revenue', icon: FiPieChart },
  { id: 'countries', label: 'Countries', icon: FiGlobe },
  { id: 'gifts', label: 'Gifts', icon: FiDollarSign },
  { id: 'system', label: 'System', icon: FiSettings },
];

// ── Admin Roles Tab ──────────────────────────────────────────────────────────
const ALL_PERMISSIONS = [
  { id: 'view_users', label: 'View Users', group: 'Users' },
  { id: 'ban_users', label: 'Ban/Unban Users', group: 'Users' },
  { id: 'delete_users', label: 'Delete Users', group: 'Users' },
  { id: 'make_admin', label: 'Make Admin', group: 'Users' },
  { id: 'view_messages', label: 'View Messages', group: 'Content' },
  { id: 'delete_messages', label: 'Delete Messages', group: 'Content' },
  { id: 'view_groups', label: 'View Groups', group: 'Content' },
  { id: 'delete_groups', label: 'Delete Groups', group: 'Content' },
  { id: 'view_marketplace', label: 'View Marketplace', group: 'Commerce' },
  { id: 'manage_marketplace', label: 'Manage Marketplace', group: 'Commerce' },
  { id: 'view_ads', label: 'View Ads', group: 'Commerce' },
  { id: 'manage_ads', label: 'Manage Ads', group: 'Commerce' },
  { id: 'view_revenue', label: 'View Revenue', group: 'Finance' },
  { id: 'manage_wallet', label: 'Manage Wallet', group: 'Finance' },
  { id: 'send_broadcast', label: 'Send Broadcasts', group: 'Communication' },
  { id: 'manage_settings', label: 'Manage Settings', group: 'System' },
  { id: 'view_api_clients', label: 'View API Clients', group: 'System' },
  { id: 'manage_api_clients', label: 'Manage API Clients', group: 'System' },
];

function AdminRolesTab() {
  const [subAdmins, setSubAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [perms, setPerms] = useState({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/sub-admins');
      setSubAdmins(data.admins || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const selectAdmin = (admin) => {
    setSelected(admin);
    setPerms(admin.permissions || {});
  };

  const togglePerm = (permId) => {
    setPerms(prev => ({ ...prev, [permId]: !prev[permId] }));
  };

  const savePerms = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.put(`/admin/users/${selected.id}/permissions`, { permissions: perms });
      toast.success('Permissions saved!');
      setSubAdmins(prev => prev.map(a => a.id === selected.id ? { ...a, permissions: perms } : a));
      setSelected(s => s ? { ...s, permissions: perms } : s);
    } catch (err) {
      toast.error(err?.response?.data?.error || 'Failed to save');
    }
    setSaving(false);
  };

  const grantAll = () => {
    const all = {};
    ALL_PERMISSIONS.forEach(p => { all[p.id] = true; });
    setPerms(all);
  };

  const revokeAll = () => setPerms({});

  const groups = [...new Set(ALL_PERMISSIONS.map(p => p.group))];

  const filtered = subAdmins.filter(a => a.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Admin list */}
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-lg font-bold text-gray-900 flex-1">Sub-Admins</h3>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">{subAdmins.length} total</span>
        </div>
        <div className="relative mb-3">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search admins…"
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]/30" />
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <FiShield size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No admins found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(admin => (
              <button key={admin.id} onClick={() => selectAdmin(admin)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition border ${selected?.id === admin.id ? 'border-[#25D366] bg-green-50' : 'border-gray-100 hover:border-gray-200 bg-white'}`}>
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                  {admin.avatar_url ? <img src={admin.avatar_url} alt="" className="w-full h-full object-cover" /> : admin.full_name?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm truncate flex items-center gap-1.5">
                    {admin.full_name}
                    {admin.is_me && <span className="text-[10px] bg-[#25D366] text-white px-1.5 py-0.5 rounded-full font-normal">You</span>}
                  </p>
                  <p className="text-xs text-gray-400">{admin.permission_count} permissions</p>
                </div>
                <FiChevronRight size={14} className="text-gray-300 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: Permission editor */}
      <div>
        {selected ? (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selected.full_name}</h3>
                <p className="text-xs text-gray-400">Edit permissions</p>
              </div>
              <div className="ml-auto flex gap-2">
                <button onClick={grantAll} className="text-xs px-3 py-1.5 bg-green-50 text-green-600 border border-green-200 rounded-lg hover:bg-green-100 transition">Grant All</button>
                <button onClick={revokeAll} className="text-xs px-3 py-1.5 bg-red-50 text-red-500 border border-red-200 rounded-lg hover:bg-red-100 transition">Revoke All</button>
              </div>
            </div>
            <div className="space-y-4 mb-5">
              {groups.map(group => (
                <div key={group} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{group}</p>
                  </div>
                  <div className="divide-y divide-gray-50">
                    {ALL_PERMISSIONS.filter(p => p.group === group).map(perm => (
                      <button key={perm.id} onClick={() => !selected.is_me && togglePerm(perm.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50 transition ${selected.is_me ? 'opacity-60 cursor-not-allowed' : ''}`}>
                        <span className="text-gray-700">{perm.label}</span>
                        <div className={`w-10 h-5.5 rounded-full transition-colors relative ${perms[perm.id] ? 'bg-[#25D366]' : 'bg-gray-200'}`}
                          style={{ height: 22, width: 40 }}>
                          <motion.div animate={{ x: perms[perm.id] ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-sm"
                            style={{ width: 18, height: 18 }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            {!selected.is_me && (
              <button onClick={savePerms} disabled={saving}
                className="w-full bg-gradient-to-r from-[#075E54] to-[#25D366] text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><FiCheck size={16} /> Save Permissions</>}
              </button>
            )}
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
              <FiShield size={28} className="text-gray-300" />
            </div>
            <p className="text-gray-500 font-medium">Select an admin</p>
            <p className="text-gray-400 text-sm mt-1">Choose an admin from the left to manage their permissions</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [apiClients, setApiClients] = useState([]);
  const [apiClientsTotal, setApiClientsTotal] = useState(0);
  const [apiClientsPage, setApiClientsPage] = useState(1);
  const [apiClientsTotalPages, setApiClientsTotalPages] = useState(1);
  const [apiClientsSearch, setApiClientsSearch] = useState('');
  const [liveData, setLiveData] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const liveIntervalRef = React.useRef(null);
  const [adStats, setAdStats] = useState(null);
  const [adCampaigns, setAdCampaigns] = useState([]);
  const [adCampaignsPage, setAdCampaignsPage] = useState(1);
  const [adCampaignsTotalPages, setAdCampaignsTotalPages] = useState(1);
  const [adCampaignsTotal, setAdCampaignsTotal] = useState(0);
  const [adCampaignsFilter, setAdCampaignsFilter] = useState('');
  const [adReports, setAdReports] = useState([]);
  const [adTab, setAdTab] = useState('campaigns');

  // Marketplace admin state
  const [adminProducts, setAdminProducts] = useState([]);
  const [adminProductsLoading, setAdminProductsLoading] = useState(false);
  const [adminDisputes, setAdminDisputes] = useState([]);
  const [adminDisputesLoading, setAdminDisputesLoading] = useState(false);
  const [marketplaceSubTab, setMarketplaceSubTab] = useState('products');
  const [disputeResolution, setDisputeResolution] = useState({});
  const [resolvingDispute, setResolvingDispute] = useState(null);

  // PayPal admin state
  const [paypalTxns, setPaypalTxns] = useState([]);
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalPage, setPaypalPage] = useState(1);
  const [paypalTotalPages, setPaypalTotalPages] = useState(1);
  const [paypalTotal, setPaypalTotal] = useState(0);
  const [refundingPaypal, setRefundingPaypal] = useState(null);

  // Revenue analytics state
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState('30');

  // Country analytics state
  const [countryData, setCountryData] = useState([]);
  const [countryLoading, setCountryLoading] = useState(false);

  // Gift stats state
  const [giftStats, setGiftStats] = useState(null);
  const [giftStatsLoading, setGiftStatsLoading] = useState(false);

  // System settings state
  const [systemSettings, setSystemSettings] = useState(null);
  const [systemSettingsLoading, setSystemSettingsLoading] = useState(false);
  const [systemHealth, setSystemHealth] = useState(null);
  const [systemHealthLoading, setSystemHealthLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState({});

  useEffect(() => {
    checkAdminAccess();
  }, []);

  useEffect(() => {
    if (activeTab === 'live' && isAdmin) {
      fetchLive();
      liveIntervalRef.current = setInterval(fetchLive, 5000);
    } else {
      clearInterval(liveIntervalRef.current);
    }
    return () => clearInterval(liveIntervalRef.current);
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'marketplace' && isAdmin) fetchAdminMarketplace();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'paypal' && isAdmin) fetchPaypalTxns(1);
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'revenue' && isAdmin) fetchRevenue(revenuePeriod);
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'system' && isAdmin) {
      fetchSystemSettings();
      fetchSystemHealth();
    }
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'countries' && isAdmin) fetchCountryAnalytics();
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab === 'gifts' && isAdmin) fetchGiftStats();
  }, [activeTab, isAdmin]);

  const fetchLive = async () => {
    setLiveLoading(true);
    try {
      const { data } = await api.get('/admin/live');
      setLiveData(data);
    } catch {}
    finally { setLiveLoading(false); }
  };

  const fetchAdminMarketplace = async () => {
    setAdminProductsLoading(true);
    setAdminDisputesLoading(true);
    try {
      const [prodR, dispR] = await Promise.all([
        api.get('/marketplace/admin/products?per_page=25'),
        api.get('/marketplace/admin/disputes'),
      ]);
      setAdminProducts(prodR.data.products || []);
      setAdminDisputes(dispR.data.disputes || []);
    } catch (e) { toast.error('Failed to load marketplace data'); }
    finally { setAdminProductsLoading(false); setAdminDisputesLoading(false); }
  };

  const fetchPaypalTxns = async (page = 1) => {
    setPaypalLoading(true);
    try {
      const r = await api.get(`/payments/paypal/transactions?page=${page}&per_page=25`);
      setPaypalTxns(r.data.transactions || []);
      setPaypalTotalPages(r.data.pages || 1);
      setPaypalTotal(r.data.total || 0);
      setPaypalPage(page);
    } catch (e) { toast.error('Failed to load PayPal transactions'); }
    finally { setPaypalLoading(false); }
  };

  const handleResolveDispute = async (disputeId) => {
    const resolution = disputeResolution[disputeId];
    if (!resolution?.trim()) { toast.error('Enter a resolution'); return; }
    setResolvingDispute(disputeId);
    try {
      await api.post(`/marketplace/disputes/${disputeId}/resolve`, { resolution });
      toast.success('Dispute resolved');
      setDisputeResolution(d => { const n = {...d}; delete n[disputeId]; return n; });
      fetchAdminMarketplace();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
    finally { setResolvingDispute(null); }
  };

  const handlePaypalRefund = async (payment) => {
    if (!window.confirm(`Issue full refund of $${payment.amount} to ${payment.user_name}?`)) return;
    setRefundingPaypal(payment.id);
    try {
      await api.post('/payments/paypal/refund', { payment_id: payment.id });
      toast.success('Refund issued successfully');
      fetchPaypalTxns(paypalPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Refund failed'); }
    finally { setRefundingPaypal(null); }
  };

  const handleToggleProduct = async (productId, active) => {
    try {
      await api.put(`/marketplace/products/${productId}`, { is_active: !active });
      setAdminProducts(ps => ps.map(p => p.id === productId ? { ...p, is_active: !active } : p));
      toast.success(active ? 'Product hidden' : 'Product visible');
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

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

  const loadApiClients = useCallback(async (page = 1, q = apiClientsSearch) => {
    try {
      const params = new URLSearchParams({ page, per_page: 20, search: q });
      const { data } = await api.get(`/platform/admin/clients?${params}`);
      setApiClients(data.clients || []);
      setApiClientsTotalPages(data.pages || 1);
      setApiClientsTotal(data.total || 0);
      setApiClientsPage(page);
    } catch {}
  }, [apiClientsSearch]);

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

  const loadAdStats = async () => {
    try {
      const { data } = await api.get('/ads/admin/stats');
      setAdStats(data);
    } catch {}
  };

  const loadAdCampaigns = useCallback(async (page = 1, status = adCampaignsFilter) => {
    try {
      const params = new URLSearchParams({ page, per_page: 20, ...(status ? { status } : {}) });
      const { data } = await api.get(`/ads/admin/campaigns?${params}`);
      setAdCampaigns(data.campaigns || []);
      setAdCampaignsTotalPages(data.pages || 1);
      setAdCampaignsTotal(data.total || 0);
      setAdCampaignsPage(page);
    } catch {}
  }, [adCampaignsFilter]);

  const loadAdReports = async () => {
    try {
      const { data } = await api.get('/ads/admin/reports');
      setAdReports(data.reports || []);
    } catch {}
  };

  const handleApproveCampaign = async (id) => {
    try {
      await api.post(`/ads/admin/campaigns/${id}/approve`);
      toast.success('Campaign approved');
      loadAdCampaigns(adCampaignsPage);
      loadAdStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleRejectCampaign = async (id) => {
    const reason = window.prompt('Enter rejection reason:');
    if (reason === null) return;
    try {
      await api.post(`/ads/admin/campaigns/${id}/reject`, { reason: reason || 'Does not meet guidelines' });
      toast.success('Campaign rejected');
      loadAdCampaigns(adCampaignsPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handlePauseCampaign = async (id) => {
    try {
      await api.post(`/ads/admin/campaigns/${id}/pause`);
      toast.success('Campaign paused');
      loadAdCampaigns(adCampaignsPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleResumeCampaign = async (id) => {
    try {
      await api.post(`/ads/admin/campaigns/${id}/resume`);
      toast.success('Campaign resumed');
      loadAdCampaigns(adCampaignsPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const fetchRevenue = async (period = '30') => {
    setRevenueLoading(true);
    try {
      const { data } = await api.get(`/admin/revenue?period=${period}`);
      setRevenueData(data);
      setRevenuePeriod(period);
    } catch (e) { toast.error('Failed to load revenue data'); }
    finally { setRevenueLoading(false); }
  };

  const fetchCountryAnalytics = async () => {
    setCountryLoading(true);
    try {
      const { data } = await api.get('/admin/country-analytics');
      setCountryData(data.countries || []);
    } catch { toast.error('Failed to load country analytics'); }
    finally { setCountryLoading(false); }
  };

  const fetchGiftStats = async () => {
    setGiftStatsLoading(true);
    try {
      const { data } = await api.get('/admin/gift-stats');
      setGiftStats(data);
    } catch { toast.error('Failed to load gift stats'); }
    finally { setGiftStatsLoading(false); }
  };

  const fetchSystemSettings = async () => {
    setSystemSettingsLoading(true);
    try {
      const { data } = await api.get('/admin/system/settings');
      setSystemSettings(data.settings);
      setSettingsDirty({});
    } catch (e) { toast.error('Failed to load system settings'); }
    finally { setSystemSettingsLoading(false); }
  };

  const fetchSystemHealth = async () => {
    setSystemHealthLoading(true);
    try {
      const { data } = await api.get('/admin/system/health');
      setSystemHealth(data);
    } catch (e) {}
    finally { setSystemHealthLoading(false); }
  };

  const saveSetting = async (key, value) => {
    const prev = systemSettings?.[key];
    setSystemSettings(s => ({ ...s, [key]: value }));
    try {
      await api.put('/admin/system/settings', { [key]: value });
      toast.success(`"${key.replace(/_/g, ' ')}" updated`);
    } catch (e) {
      setSystemSettings(s => ({ ...s, [key]: prev }));
      toast.error('Failed to save setting');
    }
  };

  const handleResolveReport = async (id) => {
    try {
      await api.post(`/ads/admin/reports/${id}/resolve`);
      toast.success('Report resolved');
      loadAdReports();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleTerminateCampaign = async (id) => {
    if (!window.confirm('Permanently terminate and delete this campaign? This cannot be undone.')) return;
    try {
      await api.delete(`/ads/admin/campaigns/${id}/terminate`);
      toast.success('Campaign terminated');
      loadAdCampaigns(adCampaignsPage);
      loadAdStats();
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
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

  const handleSuspendClient = async (clientId) => {
    if (!window.confirm('Suspend this API client? They will lose API access.')) return;
    try {
      await api.put(`/platform/admin/clients/${clientId}/suspend`);
      toast.success('Client suspended');
      loadApiClients(apiClientsPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  const handleReinstateClient = async (clientId) => {
    try {
      await api.put(`/platform/admin/clients/${clientId}/reinstate`);
      toast.success('Client reinstated');
      loadApiClients(apiClientsPage);
    } catch (e) { toast.error(e.response?.data?.error || 'Failed'); }
  };

  useEffect(() => {
    if (!isAdmin) return;
    const delayDebounce = setTimeout(() => loadUsers(1, search, filter), 400);
    return () => clearTimeout(delayDebounce);
  }, [search, filter, isAdmin]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'api_clients') return;
    const delay = setTimeout(() => loadApiClients(1, apiClientsSearch), 400);
    return () => clearTimeout(delay);
  }, [apiClientsSearch, isAdmin, activeTab]);

  useEffect(() => {
    if (!isAdmin || activeTab !== 'ads') return;
    loadAdStats();
    loadAdCampaigns(1);
    loadAdReports();
  }, [activeTab, isAdmin]);

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
              <span className="flex-1 text-left">{tab.label}</span>
              {tab.badge && (
                <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                  className="text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                  {tab.badge}
                </motion.span>
              )}
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
              {activeTab === 'live' && 'Real-time sessions, OTP activity and auth events · refreshes every 5s'}
              {activeTab === 'users' && `${usersTotal.toLocaleString()} total users`}
              {activeTab === 'messages' && 'All messages on the platform'}
              {activeTab === 'groups' && 'All groups and communities'}
              {activeTab === 'activity' && 'Usage trends over time'}
              {activeTab === 'api_clients' && `${apiClientsTotal.toLocaleString()} registered API clients`}
              {activeTab === 'ads' && `${adCampaignsTotal.toLocaleString()} ad campaigns · ${adStats?.pending_campaigns || 0} pending review`}
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
          {activeTab === 'api_clients' && (
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={15}/>
              <input value={apiClientsSearch} onChange={e => setApiClientsSearch(e.target.value)} placeholder="Search clients..."
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#25D366] w-56"/>
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
              {/* ── ROLES ── */}
              {activeTab === 'roles' && <AdminRolesTab />}

              {/* ── LIVE ── */}
              {activeTab === 'live' && (
                <div className="space-y-5">
                  {liveLoading && !liveData && (
                    <div className="flex items-center justify-center py-16">
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full"/>
                    </div>
                  )}
                  {liveData && (
                    <>
                      {/* Live stat cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-11 h-11 bg-[#25D366] rounded-xl flex items-center justify-center">
                              <FiWifi size={20} className="text-white"/>
                            </div>
                            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
                              className="w-2.5 h-2.5 bg-[#25D366] rounded-full mt-1"/>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{liveData.active_session_count}</p>
                          <p className="text-sm text-gray-500 mt-0.5">Active WebSocket sessions</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <div className="w-11 h-11 bg-blue-500 rounded-xl flex items-center justify-center mb-3">
                            <FiUsers size={20} className="text-white"/>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{liveData.online_5m}</p>
                          <p className="text-sm text-gray-500 mt-0.5">Online (last 5 min)</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <div className="w-11 h-11 bg-purple-500 rounded-xl flex items-center justify-center mb-3">
                            <FiServer size={20} className="text-white"/>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{liveData.online_1h}</p>
                          <p className="text-sm text-gray-500 mt-0.5">Online (last 1 hour)</p>
                        </motion.div>
                        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <div className="w-11 h-11 bg-amber-500 rounded-xl flex items-center justify-center mb-3">
                            <FiLock size={20} className="text-white"/>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{liveData.pending_otps}</p>
                          <p className="text-sm text-gray-500 mt-0.5">Pending OTP codes</p>
                        </motion.div>
                      </div>

                      {/* Auth events breakdown */}
                      {liveData.auth_events_24h?.length > 0 && (
                        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <h3 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <FiShield size={15} className="text-[#25D366]"/> Auth Events (last 24h)
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {liveData.auth_events_24h.map((e, i) => (
                              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                <span className="text-sm font-bold text-gray-900">{e.count}</span>
                                <span className="text-xs text-gray-500">{e.event.replace(/_/g, ' ').toLowerCase()}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Active WebSocket sessions */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <FiWifi size={15} className="text-[#25D366]"/> Active Sessions
                          </h3>
                          <span className="text-xs text-gray-400 flex items-center gap-1.5">
                            <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                              className="w-1.5 h-1.5 bg-[#25D366] rounded-full"/>
                            Live
                          </span>
                        </div>
                        {liveData.active_sessions.length === 0 ? (
                          <div className="py-10 text-center text-gray-400">
                            <FiWifi size={28} className="mx-auto mb-2 opacity-30"/>
                            <p className="text-sm">No active WebSocket sessions right now</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-50">
                            {liveData.active_sessions.map(s => (
                              <div key={s.user_id} className="flex items-center gap-3 px-5 py-3">
                                <div className="relative flex-shrink-0">
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white font-bold text-sm">
                                    {s.full_name?.[0]?.toUpperCase()}
                                  </div>
                                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-[#25D366] rounded-full border-2 border-white"/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-gray-900 truncate">{s.full_name}</p>
                                  <p className="text-xs text-gray-400 truncate">{s.phone_number}</p>
                                </div>
                                <div className="text-right flex-shrink-0">
                                  <span className="text-xs bg-green-50 text-green-700 font-semibold px-2 py-0.5 rounded-full">
                                    {s.socket_count} socket{s.socket_count !== 1 ? 's' : ''}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Auth / OTP event log */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                          <h3 className="text-sm font-bold text-gray-800 flex items-center gap-2">
                            <FiClock size={15} className="text-[#25D366]"/> Auth &amp; OTP Event Log
                          </h3>
                          <span className="text-xs text-gray-400">Last 100 events</span>
                        </div>
                        {!liveData.auth_logs?.length ? (
                          <div className="py-10 text-center text-gray-400">
                            <FiShield size={28} className="mx-auto mb-2 opacity-30"/>
                            <p className="text-sm">No security events recorded yet</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
                            {liveData.auth_logs.map(log => (
                              <div key={log.id} className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                                <div className="mt-0.5 flex-shrink-0">
                                  <SeverityBadge severity={log.severity}/>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-gray-800 truncate">
                                    {log.event_type.replace(/_/g, ' ')}
                                  </p>
                                  {log.user_name && (
                                    <p className="text-xs text-gray-500 truncate">👤 {log.user_name}</p>
                                  )}
                                  {log.ip_address && (
                                    <p className="text-xs text-gray-400 font-mono">{log.ip_address}</p>
                                  )}
                                </div>
                                <span className="text-xs text-gray-400 flex-shrink-0 mt-0.5">
                                  {log.created_at ? formatDistanceToNow(new Date(log.created_at), { addSuffix: true }) : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Footer timestamp */}
                      <p className="text-xs text-gray-400 text-center flex items-center justify-center gap-1.5">
                        <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                          className="w-1.5 h-1.5 bg-[#25D366] rounded-full"/>
                        Last updated: {liveData.timestamp ? new Date(liveData.timestamp).toLocaleTimeString() : '—'} · auto-refreshes every 5s
                      </p>
                    </>
                  )}
                </div>
              )}

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

              {/* ── API CLIENTS ── */}
              {activeTab === 'api_clients' && (
                <div className="space-y-4">
                  {apiClients.length === 0 ? (
                    <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center">
                      <FiCode size={40} className="text-gray-300 mx-auto mb-3"/>
                      <p className="text-gray-400">No API clients registered yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr className="text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">
                              <th className="px-5 py-3">Business</th>
                              <th className="px-5 py-3">Owner</th>
                              <th className="px-5 py-3">Tier</th>
                              <th className="px-5 py-3">Today</th>
                              <th className="px-5 py-3">Total Calls</th>
                              <th className="px-5 py-3">Status</th>
                              <th className="px-5 py-3">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {apiClients.map(c => (
                              <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-5 py-3">
                                  <div>
                                    <p className="font-semibold text-gray-900">{c.business_name}</p>
                                    <p className="text-xs text-gray-400 font-mono">{c.api_key_prefix}</p>
                                  </div>
                                </td>
                                <td className="px-5 py-3 text-gray-600">{c.user_name || '—'}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                                    c.tier === 'enterprise' ? 'bg-purple-100 text-purple-700' :
                                    c.tier === 'pro' ? 'bg-blue-100 text-blue-700' :
                                    'bg-gray-100 text-gray-600'
                                  }`}>
                                    {c.tier?.charAt(0).toUpperCase() + c.tier?.slice(1)}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <span className="flex items-center gap-1">
                                    <FiZap size={12} className="text-[#25D366]"/>
                                    {c.today_messages ?? 0}
                                  </span>
                                </td>
                                <td className="px-5 py-3 text-gray-600">{(c.total_calls || 0).toLocaleString()}</td>
                                <td className="px-5 py-3">
                                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                                    {c.is_active ? 'Active' : 'Suspended'}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  {c.is_active
                                    ? <button onClick={() => handleSuspendClient(c.id)}
                                        className="text-xs text-red-600 hover:text-red-700 font-medium px-3 py-1.5 bg-red-50 hover:bg-red-100 rounded-lg transition flex items-center gap-1">
                                        <FiSlash size={12}/>Suspend
                                      </button>
                                    : <button onClick={() => handleReinstateClient(c.id)}
                                        className="text-xs text-green-600 hover:text-green-700 font-medium px-3 py-1.5 bg-green-50 hover:bg-green-100 rounded-lg transition flex items-center gap-1">
                                        <FiCheckCircle size={12}/>Reinstate
                                      </button>
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {apiClientsTotalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                          <button onClick={() => loadApiClients(apiClientsPage - 1)} disabled={apiClientsPage <= 1}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <FiChevronLeft size={16}/>
                          </button>
                          <span className="text-sm text-gray-500">Page {apiClientsPage} of {apiClientsTotalPages}</span>
                          <button onClick={() => loadApiClients(apiClientsPage + 1)} disabled={apiClientsPage >= apiClientsTotalPages}
                            className="p-2 rounded-xl border border-gray-200 hover:bg-gray-50 disabled:opacity-40 transition">
                            <FiChevronRight size={16}/>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              {/* ── ADS ── */}
              {activeTab === 'ads' && (
                <div className="space-y-5">
                  {/* Ad stats row */}
                  {adStats && (
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                      {[
                        { icon: FiZap, label: 'Active Campaigns', value: adStats.active_campaigns, color: 'bg-[#25D366]' },
                        { icon: FiClock, label: 'Pending Review', value: adStats.pending_campaigns, color: 'bg-amber-500' },
                        { icon: FiEye, label: 'Impressions Today', value: adStats.impressions_today, color: 'bg-blue-500' },
                        { icon: FiDollarSign, label: 'Total Revenue', value: `$${(adStats.total_revenue || 0).toFixed(2)}`, color: 'bg-purple-500' },
                      ].map(s => (
                        <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                          <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                            <s.icon size={18} className="text-white" />
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{typeof s.value === 'number' ? s.value.toLocaleString() : s.value}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{s.label}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}

                  {/* Sub-tabs */}
                  <div className="flex gap-2">
                    {[
                      { id: 'campaigns', label: 'Campaigns' },
                      { id: 'reports', label: `Reports${adReports.length > 0 ? ` (${adReports.length})` : ''}` },
                      { id: 'leaderboard', label: 'Leaderboard' },
                    ].map(t => (
                      <button key={t.id} onClick={() => setAdTab(t.id)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${adTab === t.id ? 'bg-[#075E54] text-white' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Campaigns sub-tab */}
                  {adTab === 'campaigns' && (
                    <div className="space-y-3">
                      {/* Filter */}
                      <div className="flex gap-2 flex-wrap">
                        {['', 'pending', 'active', 'paused', 'rejected', 'completed'].map(s => (
                          <button key={s} onClick={() => { setAdCampaignsFilter(s); loadAdCampaigns(1, s); }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${adCampaignsFilter === s ? 'bg-[#075E54] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                            {s || 'All'}
                          </button>
                        ))}
                      </div>

                      {adCampaigns.length === 0 ? (
                        <div className="bg-white rounded-2xl p-16 text-center border border-gray-100">
                          <FiZap size={40} className="text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-400">No campaigns found</p>
                        </div>
                      ) : (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                              <tr className="text-left text-xs text-gray-400 font-semibold uppercase tracking-wider">
                                <th className="px-4 py-3">Campaign</th>
                                <th className="px-4 py-3">Sponsor</th>
                                <th className="px-4 py-3">Budget</th>
                                <th className="px-4 py-3">Stats</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {adCampaigns.map(c => {
                                const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(1) : '0.0';
                                return (
                                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3">
                                      <p className="font-semibold text-gray-900 text-sm truncate max-w-[150px]">{c.title}</p>
                                      <p className="text-xs text-gray-400 truncate max-w-[150px]">{c.ad_copy}</p>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-gray-600">{c.sponsor_name}</td>
                                    <td className="px-4 py-3">
                                      <p className="text-xs font-semibold text-gray-900">${(c.budget_spent || 0).toFixed(2)} / ${c.budget_total}</p>
                                      <div className="w-16 h-1 bg-gray-100 rounded-full mt-1">
                                        <div className="h-full bg-[#25D366] rounded-full"
                                          style={{ width: `${Math.min(100, ((c.budget_spent || 0) / c.budget_total) * 100)}%` }} />
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-3 text-xs">
                                        <span className="flex items-center gap-1 text-gray-600"><FiEye size={11} />{(c.impressions || 0).toLocaleString()}</span>
                                        <span className="flex items-center gap-1 text-gray-600"><FiMousePointer size={11} />{c.clicks || 0}</span>
                                        <span className="text-[#25D366] font-semibold">{ctr}%</span>
                                      </div>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                        c.status === 'active' ? 'bg-green-100 text-green-700' :
                                        c.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                        c.status === 'rejected' ? 'bg-red-100 text-red-600' :
                                        'bg-gray-100 text-gray-500'
                                      }`}>{c.status}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-1">
                                        {c.status === 'pending' && (
                                          <>
                                            <button onClick={() => handleApproveCampaign(c.id)}
                                              className="text-xs bg-green-50 hover:bg-green-100 text-green-700 px-2 py-1 rounded-lg font-semibold transition">
                                              Approve
                                            </button>
                                            <button onClick={() => handleRejectCampaign(c.id)}
                                              className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-lg font-semibold transition">
                                              Reject
                                            </button>
                                          </>
                                        )}
                                        {c.status === 'active' && (
                                          <button onClick={() => handlePauseCampaign(c.id)}
                                            className="text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 px-2 py-1 rounded-lg font-semibold transition">
                                            Pause
                                          </button>
                                        )}
                                        {c.status === 'paused' && c.is_approved && (
                                          <button onClick={() => handleResumeCampaign(c.id)}
                                            className="text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 px-2 py-1 rounded-lg font-semibold transition">
                                            Resume
                                          </button>
                                        )}
                                        <button onClick={() => handleTerminateCampaign(c.id)}
                                          className="text-xs bg-red-50 hover:bg-red-100 text-red-600 px-2 py-1 rounded-lg font-semibold transition">
                                          Delete
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {adCampaignsTotalPages > 1 && (
                            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                              <p className="text-xs text-gray-500">Page {adCampaignsPage} of {adCampaignsTotalPages}</p>
                              <div className="flex gap-1">
                                <button onClick={() => loadAdCampaigns(adCampaignsPage - 1)} disabled={adCampaignsPage === 1}
                                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronLeft size={16} /></button>
                                <button onClick={() => loadAdCampaigns(adCampaignsPage + 1)} disabled={adCampaignsPage === adCampaignsTotalPages}
                                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"><FiChevronRight size={16} /></button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Reports sub-tab */}
                  {adTab === 'reports' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {adReports.length === 0 ? (
                        <div className="py-16 text-center text-gray-400">
                          <FiCheckCircle size={36} className="mx-auto mb-2 opacity-30" />
                          <p>No pending ad reports</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {adReports.map(r => (
                            <div key={r.id} className="px-5 py-4 flex items-start gap-4 hover:bg-gray-50">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900">{r.campaign_title || 'Unknown Campaign'}</p>
                                <p className="text-xs text-gray-500 mt-0.5">Reported by {r.reporter_name} · <span className="capitalize font-medium text-red-600">{r.reason}</span></p>
                                {r.notes && <p className="text-xs text-gray-400 mt-1 italic">"{r.notes}"</p>}
                                <p className="text-xs text-gray-400 mt-1">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</p>
                              </div>
                              <button onClick={() => handleResolveReport(r.id)}
                                className="flex-shrink-0 text-xs bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-semibold transition">
                                Resolve
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Leaderboard sub-tab */}
                  {adTab === 'leaderboard' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {!adStats?.spend_leaderboard?.length ? (
                        <div className="py-16 text-center text-gray-400">
                          <FiTrendingUp size={36} className="mx-auto mb-2 opacity-30" />
                          <p>No spend data yet</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {adStats.spend_leaderboard.map((s, i) => (
                            <div key={s.user_id} className="flex items-center gap-4 px-5 py-4">
                              <span className={`text-lg font-black w-7 text-center ${i === 0 ? 'text-yellow-500' : i === 1 ? 'text-gray-400' : i === 2 ? 'text-amber-600' : 'text-gray-300'}`}>
                                #{i + 1}
                              </span>
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#075E54] to-[#25D366] flex items-center justify-center text-white font-bold text-sm flex-shrink-0 overflow-hidden">
                                {s.avatar ? <img src={s.avatar} alt="" className="w-full h-full object-cover" /> : s.name?.[0]}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate">{s.name}</p>
                                <p className="text-xs text-gray-400">{(s.total_impressions || 0).toLocaleString()} impressions</p>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-900">${s.total_spend.toFixed(2)}</p>
                                <p className="text-xs text-gray-400">total spend</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── MARKETPLACE ── */}
              {activeTab === 'marketplace' && (
                <div className="space-y-5">
                  <div className="flex gap-2 bg-gray-100 rounded-2xl p-1">
                    {[
                      { id: 'products', label: 'Products' },
                      { id: 'disputes', label: `Disputes${adminDisputes.filter(d => d.status === 'open' || d.status === 'seller_responded').length > 0 ? ` (${adminDisputes.filter(d => d.status === 'open' || d.status === 'seller_responded').length})` : ''}` },
                    ].map(t => (
                      <button key={t.id} onClick={() => setMarketplaceSubTab(t.id)}
                        className={`flex-1 py-2 rounded-xl text-sm font-semibold transition ${marketplaceSubTab === t.id ? 'bg-white shadow text-[#075E54]' : 'text-gray-500'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {marketplaceSubTab === 'products' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      {adminProductsLoading ? (
                        <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /></div>
                      ) : adminProducts.length === 0 ? (
                        <div className="py-16 text-center text-gray-400"><FiPackage size={36} className="mx-auto mb-2 opacity-30" /><p>No products yet</p></div>
                      ) : (
                        <div className="divide-y divide-gray-50">
                          {adminProducts.map(p => (
                            <div key={p.id} className="flex items-center gap-4 px-5 py-4">
                              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                {p.thumbnail_url ? <img src={p.thumbnail_url} alt="" className="w-full h-full object-cover" /> : <FiPackage size={18} className="text-gray-400" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-sm text-gray-900 truncate">{p.title}</p>
                                <p className="text-xs text-gray-400">{p.category} · {p.is_free ? 'Free' : `$${p.price}`} · {p.download_count || 0} sales</p>
                              </div>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {p.is_active ? 'Active' : 'Hidden'}
                              </span>
                              <button onClick={() => handleToggleProduct(p.id, p.is_active)}
                                className={`text-xs px-3 py-1.5 rounded-xl font-medium transition ${p.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                                {p.is_active ? 'Hide' : 'Show'}
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {marketplaceSubTab === 'disputes' && (
                    <div className="space-y-3">
                      {adminDisputesLoading ? (
                        <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /></div>
                      ) : adminDisputes.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400">
                          <FiAlertCircle size={36} className="mx-auto mb-2 opacity-30" />
                          <p>No disputes</p>
                        </div>
                      ) : adminDisputes.map(d => (
                        <div key={d.id} className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-gray-900">{d.product_title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">Buyer: {d.buyer_name} vs Seller: {d.seller_name}</p>
                              <p className="text-sm text-gray-700 mt-2">{d.reason}</p>
                              {d.buyer_statement && <p className="text-xs text-blue-700 bg-blue-50 rounded-lg px-2 py-1.5 mt-2">Buyer: {d.buyer_statement}</p>}
                              {d.seller_statement && <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1.5 mt-1">Seller: {d.seller_statement}</p>}
                            </div>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${d.status === 'resolved' ? 'bg-green-100 text-green-700' : d.status === 'seller_responded' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                              {d.status.replace('_', ' ')}
                            </span>
                          </div>
                          {d.status !== 'resolved' && (
                            <div className="flex gap-2">
                              <input
                                value={disputeResolution[d.id] || ''}
                                onChange={e => setDisputeResolution(r => ({ ...r, [d.id]: e.target.value }))}
                                placeholder="Resolution details..."
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366]"
                              />
                              <button
                                onClick={() => handleResolveDispute(d.id)}
                                disabled={resolvingDispute === d.id}
                                className="bg-[#075E54] text-white text-sm font-semibold px-4 py-2 rounded-xl hover:bg-[#128C7E] transition flex items-center gap-1 disabled:opacity-50">
                                {resolvingDispute === d.id ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Resolve'}
                              </button>
                            </div>
                          )}
                          {d.resolution && <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">Resolution: {d.resolution}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── REVENUE ── */}
              {activeTab === 'revenue' && (
                <div className="space-y-5">
                  {/* Period selector */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex gap-2">
                      {[
                        { label: '7 days', val: '7' },
                        { label: '30 days', val: '30' },
                        { label: '90 days', val: '90' },
                        { label: '1 year', val: '365' },
                      ].map(p => (
                        <button key={p.val} onClick={() => fetchRevenue(p.val)}
                          className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${revenuePeriod === p.val ? 'bg-[#075E54] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => fetchRevenue(revenuePeriod)} className="ml-auto flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-2 rounded-xl hover:bg-gray-50 transition">
                      <FiRefreshCw size={13} className={revenueLoading ? 'animate-spin' : ''} />Refresh
                    </button>
                  </div>

                  {revenueLoading ? (
                    <div className="flex items-center justify-center py-24">
                      <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : revenueData ? (
                    <>
                      {/* Summary cards */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { icon: FiDollarSign, label: 'Total Gross', value: `$${revenueData.summary.total_gross?.toFixed(2)}`, color: 'bg-[#075E54]', sub: `Last ${revenuePeriod} days` },
                          { icon: FiTrendingUp, label: 'Platform Earnings', value: `$${revenueData.summary.platform_earnings?.toFixed(2)}`, color: 'bg-purple-600', sub: 'After fees' },
                          { icon: FiShoppingBag, label: 'Marketplace', value: `$${revenueData.summary.marketplace_revenue?.toFixed(2)}`, color: 'bg-teal-500', sub: `${revenueData.summary.marketplace_orders} orders` },
                          { icon: FiZap, label: 'Ads Revenue', value: `$${revenueData.summary.ad_revenue?.toFixed(2)}`, color: 'bg-amber-500', sub: 'Spend captured' },
                        ].map(s => (
                          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                            <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                              <s.icon size={18} className="text-white" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                            <p className="text-sm font-medium text-gray-600">{s.label}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{s.sub}</p>
                          </motion.div>
                        ))}
                      </div>

                      {/* Revenue breakdown */}
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 lg:col-span-2">
                          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <FiBarChart2 size={16} className="text-[#25D366]" /> Daily Revenue (last {Math.min(parseInt(revenuePeriod), 30)} days)
                          </h3>
                          {revenueData.daily?.length > 0 ? (
                            <div className="space-y-3">
                              <div className="flex items-end gap-1 h-36">
                                {revenueData.daily.slice(-30).map((d, i) => {
                                  const max = Math.max(...revenueData.daily.map(x => x.revenue), 1);
                                  const height = Math.max(4, (d.revenue / max) * 100);
                                  return (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: $${d.revenue}`}>
                                      <div className="w-full bg-gradient-to-t from-[#075E54] to-[#25D366] rounded-t-sm transition-all"
                                        style={{ height: `${height}%`, opacity: 0.6 + (i / revenueData.daily.length) * 0.4 }} />
                                      {i % 5 === 0 && <span className="text-[8px] text-gray-400 whitespace-nowrap">{d.date?.slice(5)}</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center h-36 text-gray-400 text-sm">
                              <div className="text-center">
                                <FiDollarSign size={32} className="mx-auto mb-2 opacity-30" />
                                <p>No revenue data for this period</p>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                          <h3 className="font-bold text-gray-900 mb-4">Revenue Mix</h3>
                          <div className="space-y-3">
                            {[
                              { label: 'Marketplace', amount: revenueData.summary.marketplace_revenue, color: 'bg-teal-400' },
                              { label: 'Physical Store', amount: revenueData.summary.physical_revenue, color: 'bg-orange-400' },
                              { label: 'API Subscriptions', amount: revenueData.summary.api_revenue, color: 'bg-violet-400' },
                              { label: 'Ad Spend', amount: revenueData.summary.ad_revenue, color: 'bg-amber-400' },
                            ].map(item => {
                              const total = revenueData.summary.total_gross || 1;
                              const pct = Math.round((item.amount / total) * 100);
                              return (
                                <div key={item.label}>
                                  <div className="flex justify-between text-xs mb-1">
                                    <span className="font-medium text-gray-700">{item.label}</span>
                                    <span className="text-gray-500">${item.amount?.toFixed(2)} ({pct}%)</span>
                                  </div>
                                  <div className="w-full bg-gray-100 rounded-full h-2">
                                    <div className={`${item.color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                            <p className="text-xs text-gray-400">Platform takes</p>
                            <p className="text-2xl font-black text-[#25D366]">${revenueData.summary.platform_earnings?.toFixed(2)}</p>
                            <p className="text-xs text-gray-500">of ${revenueData.summary.total_gross?.toFixed(2)} gross</p>
                          </div>
                        </div>
                      </div>

                      {/* Order summary */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <h3 className="font-bold text-gray-900 mb-4">Transaction Summary</h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                          {[
                            { label: 'Digital Orders', value: revenueData.summary.marketplace_orders, icon: '💾' },
                            { label: 'Physical Orders', value: revenueData.summary.physical_orders, icon: '📦' },
                            { label: 'Avg Order Value', value: revenueData.summary.marketplace_orders > 0 ? `$${(revenueData.summary.marketplace_revenue / revenueData.summary.marketplace_orders).toFixed(2)}` : '$0.00', icon: '📊' },
                            { label: 'Revenue / Day', value: `$${(revenueData.summary.total_gross / parseInt(revenuePeriod)).toFixed(2)}`, icon: '📅' },
                          ].map(s => (
                            <div key={s.label} className="bg-gray-50 rounded-xl p-4">
                              <p className="text-2xl mb-1">{s.icon}</p>
                              <p className="text-xl font-bold text-gray-900">{s.value?.toLocaleString?.() ?? s.value}</p>
                              <p className="text-xs text-gray-500">{s.label}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 py-24 text-center text-gray-400">
                      <FiDollarSign size={40} className="mx-auto mb-3 opacity-30" />
                      <p>No revenue data available. Start selling to see analytics here.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ── SYSTEM ── */}
              {activeTab === 'system' && (
                <div className="space-y-5">
                  {/* Health status */}
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 flex items-center gap-2">
                        <FiServer size={16} className="text-[#25D366]" /> System Health
                      </h3>
                      <button onClick={fetchSystemHealth} className="flex items-center gap-1.5 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition">
                        <FiRefreshCw size={12} className={systemHealthLoading ? 'animate-spin' : ''} /> Refresh
                      </button>
                    </div>
                    {systemHealth ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className={`w-3 h-3 rounded-full ${systemHealth.status === 'healthy' ? 'bg-green-500' : 'bg-amber-500'}`} />
                          <span className={`font-bold text-sm ${systemHealth.status === 'healthy' ? 'text-green-700' : 'text-amber-700'}`}>
                            {systemHealth.status === 'healthy' ? 'All Systems Operational' : 'Degraded Performance'}
                          </span>
                          <span className="ml-auto text-xs text-gray-400">{systemHealth.response_time_ms}ms response</span>
                        </div>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                          {[
                            { label: 'Database', status: systemHealth.database?.status, latency: systemHealth.database?.latency_ms, icon: FiDatabase },
                            { label: 'Cache (Redis)', status: systemHealth.redis?.status, latency: systemHealth.redis?.latency_ms, icon: FiCpu },
                            { label: 'Python', value: systemHealth.python_version, icon: FiCode },
                            { label: 'Platform', value: systemHealth.platform, icon: FiGlobe },
                          ].map(s => {
                            const ok = s.status === 'ok' || (!s.status && s.value);
                            return (
                              <div key={s.label} className="bg-gray-50 rounded-xl p-3 flex items-start gap-2">
                                <s.icon size={14} className={`mt-0.5 flex-shrink-0 ${s.status ? (s.status === 'ok' ? 'text-green-500' : 'text-amber-500') : 'text-gray-400'}`} />
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-700">{s.label}</p>
                                  {s.status ? (
                                    <p className={`text-xs font-bold ${s.status === 'ok' ? 'text-green-600' : 'text-amber-600'}`}>
                                      {s.status === 'ok' ? `OK${s.latency != null ? ` · ${s.latency}ms` : ''}` : s.status}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-600 truncate">{s.value || '—'}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { label: 'Total Users', value: systemHealth.metrics?.total_users },
                            { label: 'Total Messages', value: systemHealth.metrics?.total_messages },
                            { label: 'Active (24h)', value: systemHealth.metrics?.active_24h },
                          ].map(m => (
                            <div key={m.label} className="bg-gray-50 rounded-xl p-3 text-center">
                              <p className="text-lg font-bold text-gray-900">{m.value?.toLocaleString() ?? '—'}</p>
                              <p className="text-xs text-gray-500">{m.label}</p>
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-gray-400 text-right">Last checked: {systemHealth.timestamp ? new Date(systemHealth.timestamp).toLocaleTimeString() : '—'}</p>
                      </div>
                    ) : systemHealthLoading ? (
                      <div className="flex items-center justify-center py-8"><div className="w-6 h-6 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" /></div>
                    ) : (
                      <p className="text-sm text-gray-400 text-center py-4">Click Refresh to check system health</p>
                    )}
                  </div>

                  {/* Feature flags */}
                  {systemSettingsLoading ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 flex items-center justify-center">
                      <div className="w-7 h-7 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : systemSettings ? (
                    <>
                      {/* Toggle settings */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <FiToggleRight size={16} className="text-[#25D366]" /> Feature Flags
                        </h3>
                        <div className="space-y-0 divide-y divide-gray-50">
                          {[
                            { key: 'maintenance_mode', label: 'Maintenance Mode', desc: 'Take platform offline for maintenance', danger: true },
                            { key: 'registration_open', label: 'Open Registration', desc: 'Allow new users to sign up' },
                            { key: 'require_phone_verification', label: 'Phone Verification Required', desc: 'Require OTP verification on signup' },
                            { key: 'e2ee_forced', label: 'Force End-to-End Encryption', desc: 'Enforce E2EE on all messages' },
                            { key: 'allow_marketplace', label: 'Digital Marketplace', desc: 'Enable digital goods marketplace' },
                            { key: 'allow_physical_store', label: 'Physical Store', desc: 'Enable physical product orders' },
                            { key: 'allow_business_api', label: 'Business API', desc: 'Enable third-party API access' },
                            { key: 'allow_ads', label: 'Advertising Platform', desc: 'Enable sponsored ads in feeds' },
                            { key: 'ai_moderation_enabled', label: 'AI Content Moderation', desc: 'Auto-flag policy-violating content' },
                          ].map(setting => {
                            const val = systemSettings[setting.key];
                            return (
                              <div key={setting.key} className="flex items-center gap-4 py-4">
                                <div className="flex-1 min-w-0">
                                  <p className={`text-sm font-semibold ${setting.danger && val ? 'text-red-600' : 'text-gray-900'}`}>{setting.label}</p>
                                  <p className="text-xs text-gray-400">{setting.desc}</p>
                                </div>
                                <button
                                  onClick={() => saveSetting(setting.key, !val)}
                                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${val ? (setting.danger ? 'bg-red-500' : 'bg-[#25D366]') : 'bg-gray-200'}`}
                                >
                                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${val ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Numeric settings */}
                      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                        <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                          <FiSettings size={16} className="text-[#25D366]" /> Platform Limits & Rates
                        </h3>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                          {[
                            { key: 'max_message_length', label: 'Max Message Length', unit: 'chars', min: 100, max: 65536, step: 100 },
                            { key: 'max_group_members', label: 'Max Group Members', unit: 'users', min: 10, max: 10000, step: 10 },
                            { key: 'max_file_size_mb', label: 'Max File Upload Size', unit: 'MB', min: 1, max: 500, step: 1 },
                            { key: 'rate_limit_per_minute', label: 'API Rate Limit', unit: 'req/min', min: 10, max: 10000, step: 10 },
                            { key: 'platform_fee_pct', label: 'Platform Fee', unit: '%', min: 0, max: 30, step: 0.5 },
                            { key: 'seller_cashback_pct', label: 'Seller Cashback', unit: '%', min: 0, max: 20, step: 0.5 },
                            { key: 'min_withdrawal_usd', label: 'Min Withdrawal', unit: 'USD', min: 1, max: 100, step: 1 },
                          ].map(setting => (
                            <div key={setting.key} className="flex flex-col gap-1.5">
                              <label className="text-xs font-semibold text-gray-700">{setting.label}</label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  value={systemSettings[setting.key] ?? ''}
                                  min={setting.min}
                                  max={setting.max}
                                  step={setting.step}
                                  onChange={e => setSystemSettings(s => ({ ...s, [setting.key]: parseFloat(e.target.value) || 0 }))}
                                  onBlur={e => saveSetting(setting.key, parseFloat(e.target.value) || 0)}
                                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:border-transparent"
                                />
                                <span className="text-xs text-gray-400 min-w-[40px]">{setting.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Danger zone */}
                      <div className="bg-white rounded-2xl shadow-sm border-2 border-red-100 p-5">
                        <h3 className="font-bold text-red-700 mb-1 flex items-center gap-2">
                          <FiAlertTriangle size={16} /> Danger Zone
                        </h3>
                        <p className="text-xs text-gray-500 mb-4">These actions are irreversible. Use with caution.</p>
                        <div className="flex flex-col gap-2">
                          <button onClick={async () => {
                            if (!window.confirm('Export all users as CSV?')) return;
                            try {
                              const r = await api.get('/admin/users/export', { responseType: 'blob' });
                              const url = URL.createObjectURL(r.data);
                              const a = document.createElement('a'); a.href = url; a.download = 'users_export.csv'; a.click();
                              toast.success('Users exported');
                            } catch { toast.error('Export failed'); }
                          }} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl text-sm font-medium transition w-fit">
                            <FiDownload size={14} /> Export All Users (CSV)
                          </button>
                          <button onClick={async () => {
                            if (!window.confirm('Enable maintenance mode? Users will see a maintenance page.')) return;
                            await saveSetting('maintenance_mode', true);
                          }} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-sm font-medium transition w-fit">
                            <FiAlertTriangle size={14} /> Enable Maintenance Mode
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 py-16 text-center text-gray-400">
                      <FiSettings size={40} className="mx-auto mb-3 opacity-30" />
                      <p>Failed to load system settings</p>
                      <button onClick={fetchSystemSettings} className="mt-3 text-sm text-[#25D366] hover:underline">Retry</button>
                    </div>
                  )}
                </div>
              )}

              {/* ── PAYPAL ── */}
              {activeTab === 'countries' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Country Analytics</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Users, messages & activity by country</p>
                    </div>
                    <button onClick={fetchCountryAnalytics} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition">
                      <FiRefreshCw size={13} />Refresh
                    </button>
                  </div>

                  {countryLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : countryData.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
                      <FiGlobe size={36} className="mx-auto mb-2 opacity-30" />
                      <p>No country data yet</p>
                      <p className="text-xs mt-1">Users with a country field will appear here</p>
                    </div>
                  ) : (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="grid grid-cols-4 gap-0 px-5 py-3 border-b border-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                        <span>Country</span>
                        <span className="text-right">Users</span>
                        <span className="text-right">Messages</span>
                        <span className="text-right">Active 24h</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {countryData.map((row, i) => {
                          const maxUsers = countryData[0]?.user_count || 1;
                          const pct = Math.round((row.user_count / maxUsers) * 100);
                          return (
                            <div key={row.country} className="px-5 py-3.5">
                              <div className="grid grid-cols-4 gap-0 items-center mb-1.5">
                                <span className="font-medium text-sm text-gray-900 flex items-center gap-2">
                                  <span className="text-xs text-gray-400 font-mono w-5">{i + 1}</span>
                                  {row.country}
                                </span>
                                <span className="text-right text-sm font-semibold text-gray-800">{row.user_count.toLocaleString()}</span>
                                <span className="text-right text-sm text-gray-600">{row.message_count.toLocaleString()}</span>
                                <span className="text-right text-sm text-[#25D366] font-semibold">{row.active_24h}</span>
                              </div>
                              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-gradient-to-r from-[#25D366] to-[#075E54] rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'gifts' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-gray-900">Gift System Stats</h2>
                      <p className="text-xs text-gray-400 mt-0.5">Coin economy overview and platform earnings</p>
                    </div>
                    <button onClick={fetchGiftStats} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition">
                      <FiRefreshCw size={13} />Refresh
                    </button>
                  </div>

                  {giftStatsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : !giftStats ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 py-16 text-center text-gray-400">
                      <FiDollarSign size={36} className="mx-auto mb-2 opacity-30" />
                      <p>No gift data yet</p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {[
                          { label: 'Gift Transactions', value: giftStats.total_gift_transactions?.toLocaleString(), color: 'bg-purple-500' },
                          { label: 'Coins Sent', value: giftStats.total_coins_sent?.toLocaleString(), color: 'bg-amber-500' },
                          { label: 'Creator Earnings', value: `$${(giftStats.total_creator_earnings_usd || 0).toFixed(2)}`, color: 'bg-[#25D366]' },
                          { label: 'Platform Fees', value: `$${(giftStats.total_platform_fees_usd || 0).toFixed(2)}`, color: 'bg-[#075E54]' },
                        ].map(s => (
                          <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
                            <div className={`w-8 h-8 ${s.color} rounded-xl flex items-center justify-center mb-3`}>
                              <FiDollarSign size={16} className="text-white" />
                            </div>
                            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Total Deposits</p>
                          <p className="text-3xl font-bold text-gray-900">${(giftStats.total_deposits_usd || 0).toFixed(2)}</p>
                          <p className="text-xs text-gray-400 mt-1">Coins purchased by users</p>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">Pending Withdrawals</p>
                          <p className="text-3xl font-bold text-amber-600">{giftStats.pending_withdrawals}</p>
                          <p className="text-xs text-gray-400 mt-1">${(giftStats.pending_withdrawal_amount_usd || 0).toFixed(2)} awaiting payout</p>
                        </div>
                        <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] rounded-2xl p-5">
                          <p className="text-xs text-white/70 uppercase tracking-wide font-semibold mb-1">Coin Rate</p>
                          <p className="text-3xl font-bold text-white">100</p>
                          <p className="text-xs text-white/70 mt-1">Coins per $1 USD · 30% platform fee</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              {activeTab === 'paypal' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-gray-900">PayPal Transactions</h3>
                      <p className="text-sm text-gray-400">{paypalTotal.toLocaleString()} total</p>
                    </div>
                    <button onClick={() => fetchPaypalTxns(paypalPage)} className="flex items-center gap-1 text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded-xl hover:bg-gray-50 transition">
                      <FiRefreshCw size={13} />Refresh
                    </button>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    {paypalLoading ? (
                      <div className="flex items-center justify-center py-12"><div className="w-7 h-7 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /></div>
                    ) : paypalTxns.length === 0 ? (
                      <div className="py-16 text-center text-gray-400">
                        <FiCreditCard size={36} className="mx-auto mb-2 opacity-30" />
                        <p>No PayPal transactions yet</p>
                        <p className="text-xs mt-1">Transactions appear here once PayPal credentials are configured</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-50">
                        {paypalTxns.map(txn => (
                          <div key={txn.id} className="flex items-center gap-4 px-5 py-4">
                            <div className="w-10 h-10 rounded-xl bg-[#FFC439]/20 flex items-center justify-center flex-shrink-0">
                              <FiCreditCard size={18} className="text-[#003087]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm text-gray-900">{txn.user_name || 'Unknown'}</p>
                              <p className="text-xs text-gray-400">{txn.user_phone} · {new Date(txn.created_at).toLocaleString()}</p>
                              <p className="text-xs text-gray-500 truncate">Capture: {txn.provider_payment_id}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="font-bold text-gray-900">${Number(txn.amount || 0).toFixed(2)}</p>
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${txn.status === 'completed' ? 'bg-green-100 text-green-700' : txn.status === 'refunded' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
                                {txn.status}
                              </span>
                            </div>
                            {txn.status === 'completed' && (
                              <button
                                onClick={() => handlePaypalRefund(txn)}
                                disabled={refundingPaypal === txn.id}
                                className="text-xs text-red-500 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition disabled:opacity-50 flex items-center gap-1">
                                {refundingPaypal === txn.id ? <div className="w-3 h-3 border-2 border-red-400 border-t-transparent rounded-full animate-spin" /> : 'Refund'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {paypalTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => fetchPaypalTxns(paypalPage - 1)} disabled={paypalPage <= 1} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40"><FiChevronLeft size={14} /></button>
                      <span className="text-sm text-gray-600">Page {paypalPage} of {paypalTotalPages}</span>
                      <button onClick={() => fetchPaypalTxns(paypalPage + 1)} disabled={paypalPage >= paypalTotalPages} className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-100 disabled:opacity-40"><FiChevronRight size={14} /></button>
                    </div>
                  )}
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
