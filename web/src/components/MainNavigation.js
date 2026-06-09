import React, { useState, useEffect } from 'react';
import {
  FiUsers, FiRadio, FiPhone, FiSettings,
  FiLogOut, FiUser, FiCircle, FiShield, FiStar,
  FiShoppingBag, FiZap, FiShoppingCart, FiCode, FiVolume2,
  FiArrowRight, FiPackage, FiDollarSign, FiTrendingUp,
} from 'react-icons/fi';
import { MdOutlineMessage } from 'react-icons/md';
import ChatsTab from './ChatsTab';
import CommunitiesTab from './CommunitiesTab';
import ChannelsTab from './ChannelsTab';
import CallsTab from './CallsTab';
import StatusTab from './StatusTab';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { useNavigate, useLocation } from 'react-router-dom';

const QUICK_LINKS = [
  {
    id: 'store',
    label: 'Shop',
    sublabel: 'Physical goods',
    icon: FiShoppingCart,
    path: '/store',
    gradient: 'from-orange-400 to-pink-500',
    badge: null,
  },
  {
    id: 'business-api',
    label: 'API Hub',
    sublabel: 'Dev tools',
    icon: FiCode,
    path: '/business-api',
    gradient: 'from-violet-500 to-purple-600',
    badge: 'NEW',
  },
  {
    id: 'marketplace',
    label: 'Market',
    sublabel: 'Digital goods',
    icon: FiShoppingBag,
    path: '/marketplace',
    gradient: 'from-teal-400 to-cyan-500',
    badge: null,
  },
];

function MainNavigation({ socket, onChatSelect, onNewChat, onProfileClick, onLogout }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('chats');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    api.get('/admin/me')
      .then(({ data }) => setIsAdmin(data.is_admin))
      .catch(() => {});
  }, []);

  const tabs = [
    { id: 'chats',       label: 'Chats',     icon: MdOutlineMessage },
    { id: 'status',      label: 'Updates',   icon: FiCircle },
    { id: 'calls',       label: 'Calls',     icon: FiPhone },
    { id: 'communities', label: 'Groups',    icon: FiUsers },
    { id: 'channels',    label: 'Channels',  icon: FiRadio },
  ];

  const menuItems = [
    { icon: FiUser, label: 'Profile', action: () => { setShowUserMenu(false); onProfileClick?.(); } },
    { icon: FiStar, label: 'Starred Messages', action: () => { setShowUserMenu(false); navigate('/starred'); } },
    { icon: FiShoppingBag, label: 'Marketplace', action: () => { setShowUserMenu(false); navigate('/marketplace'); } },
    { icon: FiShoppingCart, label: 'Physical Store', action: () => { setShowUserMenu(false); navigate('/store'); } },
    { icon: FiCode, label: 'Business API', action: () => { setShowUserMenu(false); navigate('/business-api'); } },
    { icon: FiVolume2, label: 'Advertise', action: () => { setShowUserMenu(false); navigate('/advertise'); } },
    { icon: FiDollarSign, label: 'Wallet', action: () => { setShowUserMenu(false); navigate('/wallet'); } },
    { icon: FiTrendingUp, label: 'Trends', action: () => { setShowUserMenu(false); navigate('/trends'); } },
    { icon: FiZap, label: 'Subscription', action: () => { setShowUserMenu(false); navigate('/subscription'); } },
    { icon: FiSettings, label: 'Settings', action: () => { setShowUserMenu(false); navigate('/settings'); } },
    ...(isAdmin ? [{ icon: FiShield, label: 'Admin Panel', action: () => { setShowUserMenu(false); navigate('/admin'); }, badge: 'Admin' }] : []),
    { icon: FiLogOut, label: 'Log out', action: () => { setShowUserMenu(false); onLogout?.(); }, danger: true },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Header ── */}
      <div className="bg-[#008069] px-4 pt-safe-top pb-0 flex-shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 40px)' }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[20px] font-bold text-white tracking-wide">VipChat</h1>
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Menu"
            >
              <FiSettings size={20} className="text-white" />
            </button>

            <AnimatePresence>
              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="absolute top-11 right-0 bg-white rounded-2xl shadow-2xl w-56 overflow-hidden z-50 border border-gray-100"
                  >
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                        {user?.avatar_url
                          ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                          : user?.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-sm text-gray-900 truncate">{user?.full_name}</p>
                        <p className="text-xs text-gray-500 truncate">{user?.phone_number}</p>
                      </div>
                    </div>

                    {/* Menu items */}
                    {menuItems.map(item => (
                      <button
                        key={item.label}
                        onClick={item.action}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                          item.danger
                            ? 'text-red-500 hover:bg-red-50'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon size={15} className={item.danger ? 'text-red-400' : 'text-gray-400'} />
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span className="bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{item.badge}</span>
                        )}
                        {item.label === 'Physical Store' && (
                          <span className="bg-orange-100 text-orange-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Store</span>
                        )}
                        {item.label === 'Business API' && (
                          <span className="bg-purple-100 text-purple-600 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">New</span>
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 border-b-2 transition-all ${
                  isActive
                    ? 'border-white text-white'
                    : 'border-transparent text-white/50 hover:text-white/70'
                }`}
              >
                <Icon size={isActive ? 20 : 19} />
                <span className="text-[9px] font-semibold tracking-wider uppercase">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Quick-access Discover Bar ── */}
      {activeTab === 'chats' && (
        <div className="bg-white border-b border-gray-100 px-3 py-2 flex-shrink-0">
          <div className="flex gap-2">
            {QUICK_LINKS.map(link => {
              const Icon = link.icon;
              const isActive = location.pathname === link.path;
              return (
                <button
                  key={link.id}
                  onClick={() => navigate(link.path)}
                  className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-xl transition-all relative overflow-hidden ${
                    isActive
                      ? 'bg-gray-900 text-white'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${link.gradient} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={13} className="text-white" />
                  </div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[11px] font-bold leading-none">{link.label}</p>
                    <p className={`text-[9px] leading-none mt-0.5 ${isActive ? 'text-white/60' : 'text-gray-400'}`}>{link.sublabel}</p>
                  </div>
                  {link.badge && (
                    <span className="text-[8px] font-black bg-violet-500 text-white px-1 py-0.5 rounded absolute top-1 right-1">{link.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          <ChatsTab socket={socket} onChatSelect={onChatSelect} onNewChat={onNewChat} />
        )}
        {activeTab === 'calls' && (
          <CallsTab onStartCall={(u, type) => { if (onChatSelect) onChatSelect(u.id); }} />
        )}
        {activeTab === 'status' && <StatusTab />}
        {activeTab === 'communities' && <CommunitiesTab socket={socket} />}
        {activeTab === 'channels' && <ChannelsTab socket={socket} />}
      </div>
    </div>
  );
}

export default MainNavigation;
