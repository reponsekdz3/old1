import React, { useState, useEffect } from 'react';
import {
  FiMessageSquare, FiCircle, FiPhone, FiUsers, FiRadio,
  FiTrendingUp, FiDollarSign, FiShoppingBag, FiShoppingCart,
  FiCode, FiVolume2, FiZap, FiSettings, FiLogOut, FiUser,
  FiStar, FiShield, FiPlus, FiGrid,
  FiActivity, FiMusic, FiCpu, FiRss, FiSmile, FiBook,
  FiBell, FiSearch, FiFilter, FiArchive,
} from 'react-icons/fi';
import ChatsTab from './ChatsTab';
import CommunitiesTab from './CommunitiesTab';
import ChannelsTab from './ChannelsTab';
import CallsTab from './CallsTab';
import StatusTab from './StatusTab';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../services/store';
import api from '../services/api';
import { useNavigate } from 'react-router-dom';

function Tooltip({ label }) {
  return (
    <div className="absolute left-[52px] top-1/2 -translate-y-1/2 z-[200] pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 translate-x-1 group-hover:translate-x-0">
      <div className="bg-gray-900 text-white text-xs font-semibold px-2.5 py-1.5 rounded-lg whitespace-nowrap shadow-2xl border border-white/10 flex items-center gap-1">
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
        {label}
      </div>
    </div>
  );
}

function NavBtn({ icon: Icon, label, active, onClick, badge, danger, accent, pulse }) {
  return (
    <div className="relative group w-full flex justify-center">
      <button
        onClick={onClick}
        title={label}
        className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-300 outline-none ${
          active
            ? 'bg-white/15 text-white shadow-lg shadow-black/20'
            : danger
              ? 'text-red-400/70 hover:bg-red-500/15 hover:text-red-400'
              : accent
                ? `${accent} hover:bg-white/10`
                : 'text-white/45 hover:bg-white/10 hover:text-white/90'
        }`}
      >
        <AnimatePresence>
          {active && (
            <motion.span
              layoutId="active-indicator"
              className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-[3px] h-7 bg-[#25D366] rounded-r-full shadow-[0_0_8px_rgba(37,211,102,0.6)]"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 28 }}
              exit={{ opacity: 0, height: 0 }}
            />
          )}
        </AnimatePresence>
        <div className={active ? 'scale-110 transition-transform duration-300' : ''}>
          <Icon size={19} strokeWidth={active ? 2.2 : 1.8} className={accent && !active ? 'opacity-80' : ''} />
        </div>
        {badge > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1 leading-none border border-[#111b21]">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
        {pulse && !badge && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 bg-[#25D366] rounded-full animate-pulse shadow-[0_0_4px_#25D366]" />
        )}
      </button>
      <Tooltip label={label} />
    </div>
  );
}

function Divider() {
  return <div className="w-7 h-px bg-white/8 my-1 flex-shrink-0" />;
}

function MainNavigation({ socket, onChatSelect, onNewChat, onProfileClick, onLogout }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('chats');
  const [isAdmin, setIsAdmin] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  useEffect(() => {
    api.get('/admin/me').then(({ data }) => setIsAdmin(data.is_admin)).catch(() => {});
  }, []);

  const TAB_LABELS = {
    chats: 'Messages',
    status: 'Updates',
    calls: 'Calls',
    communities: 'Groups',
    channels: 'Channels',
  };

  const messagingTabs = [
    { id: 'chats', label: 'Messages', icon: FiMessageSquare, badge: unreadTotal },
    { id: 'status', label: 'Updates', icon: FiBell, pulse: true },
    { id: 'calls', label: 'Calls', icon: FiPhone },
    { id: 'communities', label: 'Groups', icon: FiUsers },
    { id: 'channels', label: 'Channels', icon: FiRadio },
  ];

  const discoverItems = [
    { label: 'Trends', icon: FiTrendingUp, path: '/trends', accent: 'text-purple-400/80' },
    { label: 'Wallet', icon: FiDollarSign, path: '/wallet', accent: 'text-yellow-400/80' },
    { label: 'Marketplace', icon: FiShoppingBag, path: '/marketplace', accent: 'text-sky-400/80' },
    { label: 'Store', icon: FiShoppingCart, path: '/store', accent: 'text-orange-400/80' },
    { label: 'API Hub', icon: FiCode, path: '/business-api', accent: 'text-violet-400/80' },
    { label: 'Upgrade', icon: FiZap, path: '/subscription', accent: 'text-green-400/80' },
  ];

  const profileMenuItems = [
    { icon: FiUser, label: 'Profile', action: () => { setShowProfileMenu(false); onProfileClick?.(); } },
    { icon: FiStar, label: 'Starred', action: () => { setShowProfileMenu(false); navigate('/starred'); } },
    { icon: FiVolume2, label: 'Advertise', action: () => { setShowProfileMenu(false); navigate('/advertise'); } },
    ...(isAdmin ? [{ icon: FiShield, label: 'Admin', action: () => { setShowProfileMenu(false); navigate('/admin'); }, badge: true }] : []),
    { icon: FiLogOut, label: 'Log out', action: () => { setShowProfileMenu(false); onLogout?.(); }, danger: true },
  ];

  const initials = user?.full_name?.[0]?.toUpperCase() || '?';

  return (
    <div className="flex h-full">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* LEFT ICON RAIL — hidden on small mobile   */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <nav className="hidden sm:flex w-[60px] bg-[#111b21] flex-col items-center py-2 gap-0.5 flex-shrink-0 border-r border-white/5 relative z-10">
        {/* Logo */}
        <div className="mb-2 mt-1 flex-shrink-0">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center shadow-lg cursor-pointer"
            onClick={() => setActiveTab('chats')}>
            <FiMessageSquare size={18} className="text-white" strokeWidth={2.2} />
          </div>
        </div>

        {/* Messaging Tabs */}
        {messagingTabs.map(tab => (
          <NavBtn
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.id}
            badge={tab.badge}
            pulse={tab.pulse}
            onClick={() => setActiveTab(tab.id)}
          />
        ))}

        <Divider />

        {/* Discover */}
        {discoverItems.map(item => (
          <NavBtn
            key={item.label}
            icon={item.icon}
            label={item.label}
            active={false}
            accent={item.accent}
            onClick={() => navigate(item.path)}
          />
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        <Divider />

        {/* Settings */}
        <NavBtn icon={FiSettings} label="Settings" onClick={() => navigate('/settings')} />

        {/* Profile avatar */}
        <div className="relative group w-full flex justify-center mb-2 mt-1">
          <button
            onClick={() => setShowProfileMenu(v => !v)}
            className="relative w-10 h-10 rounded-full p-[2px] transition-all duration-300 hover:scale-110"
          >
            {/* Online Status Ring */}
            <div className="absolute inset-0 rounded-full border-2 border-[#25D366] animate-pulse opacity-50" />
            
            <div className="w-full h-full rounded-full overflow-hidden border border-white/20 flex-shrink-0 relative z-10">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white font-bold text-sm">
                    {initials}
                  </div>
              }
            </div>
          </button>
          <Tooltip label={user?.full_name || 'Profile'} />
        </div>

        {/* Profile Dropdown */}
        <AnimatePresence>
          {showProfileMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
              <motion.div
                initial={{ opacity: 0, x: -12, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -12, scale: 0.95 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="fixed bottom-4 left-[68px] z-50 bg-[#1f2c34] rounded-2xl shadow-2xl w-58 overflow-hidden border border-white/10 min-w-[220px]"
              >
                <div className="px-4 py-3 border-b border-white/8 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#25D366] to-[#075E54] flex items-center justify-center text-white font-bold text-sm overflow-hidden flex-shrink-0">
                    {user?.avatar_url
                      ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-white truncate">{user?.full_name}</p>
                    <p className="text-xs text-white/40 truncate">{user?.phone_number}</p>
                  </div>
                </div>
                {profileMenuItems.map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${
                      item.danger
                        ? 'text-red-400 hover:bg-red-500/10'
                        : 'text-white/75 hover:bg-white/6'
                    }`}
                  >
                    <item.icon size={15} className={item.danger ? 'text-red-400' : 'text-white/35'} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span className="bg-purple-500/20 text-purple-300 text-[9px] font-bold px-1.5 py-0.5 rounded-full">Admin</span>
                    )}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {/* CONTENT PANEL                             */}
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="flex-1 flex flex-col bg-[#f0f2f5] overflow-hidden min-w-0">

        {/* Header */}
        <div className="bg-[#008069] px-4 pt-[max(env(safe-area-inset-top,0px),10px)] pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              {/* Mobile logo (hidden on desktop since rail is shown) */}
              <div className="sm:hidden w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                <FiMessageSquare size={14} className="text-white" />
              </div>
              <h2 className="text-[17px] font-bold text-white">
                {TAB_LABELS[activeTab] || activeTab}
              </h2>
            </div>
            <div className="flex items-center gap-1">
              {activeTab === 'chats' && (
                <button onClick={onNewChat}
                  className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-full flex items-center justify-center transition-all">
                  <FiPlus size={16} className="text-white" />
                </button>
              )}
              {/* Mobile-only: profile/menu button */}
              <button onClick={() => setShowProfileMenu(v => !v)}
                className="sm:hidden w-8 h-8 rounded-full overflow-hidden border border-white/30 flex items-center justify-center ml-1">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-white/20 flex items-center justify-center text-white font-bold text-xs">{initials}</div>
                }
              </button>
            </div>
          </div>

          {/* Mobile Tab Bar */}
          <div className="sm:hidden flex overflow-x-auto scrollbar-hide -mx-1 pb-0">
            {messagingTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 border-b-2 transition-all ${
                    isActive ? 'border-white text-white' : 'border-transparent text-white/45 hover:text-white/70'
                  }`}
                >
                  <Icon size={isActive ? 19 : 18} strokeWidth={isActive ? 2.2 : 1.7} />
                  <span className="text-[9px] font-bold tracking-wider uppercase">{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Desktop Tab Bar (shown right of icon rail) */}
          <div className="hidden sm:flex overflow-x-auto scrollbar-hide -mx-1 pb-0">
            {messagingTabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-shrink-0 flex flex-col items-center gap-0.5 px-4 py-2.5 border-b-2 transition-all ${
                    isActive ? 'border-white text-white' : 'border-transparent text-white/45 hover:text-white/70'
                  }`}
                >
                  <Icon size={isActive ? 19 : 18} strokeWidth={isActive ? 2.2 : 1.7} />
                  <span className="text-[9px] font-bold tracking-wider uppercase">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile Quick-Access Discover Row */}
        <div className="sm:hidden flex gap-2 px-3 py-2 overflow-x-auto scrollbar-hide bg-white border-b border-gray-100 flex-shrink-0">
          {discoverItems.map(item => {
            const Icon = item.icon;
            return (
              <button key={item.label} onClick={() => navigate(item.path)}
                className="flex flex-col items-center gap-1 flex-shrink-0 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition">
                <div className="w-8 h-8 rounded-lg bg-[#075E54]/10 flex items-center justify-center">
                  <Icon size={16} className="text-[#075E54]" />
                </div>
                <span className="text-[10px] font-semibold text-gray-600">{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full w-full"
            >
              {activeTab === 'chats' && (
                <ChatsTab socket={socket} onChatSelect={onChatSelect} onNewChat={onNewChat} />
              )}
              {activeTab === 'calls' && (
                <CallsTab onStartCall={(u) => { if (onChatSelect) onChatSelect(u.id); }} />
              )}
              {activeTab === 'status' && <StatusTab />}
              {activeTab === 'communities' && <CommunitiesTab socket={socket} />}
              {activeTab === 'channels' && <ChannelsTab socket={socket} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default MainNavigation;
