import React, { useState, useEffect } from 'react';
import {
  FiUsers, FiRadio, FiPhone, FiSettings,
  FiLogOut, FiUser, FiCircle, FiShield, FiStar,
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
import { useNavigate } from 'react-router-dom';

function MainNavigation({ socket, onChatSelect, onNewChat, onProfileClick, onLogout }) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
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
    { icon: FiSettings, label: 'Settings', action: () => { setShowUserMenu(false); navigate('/settings'); } },
    ...(isAdmin ? [{ icon: FiShield, label: 'Admin Panel', action: () => { setShowUserMenu(false); navigate('/admin'); } }] : []),
    { icon: FiLogOut, label: 'Log out', action: () => { setShowUserMenu(false); onLogout?.(); }, danger: true },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Header ── */}
      <div className="bg-[#008069] px-4 pt-safe-top pb-0 flex-shrink-0" style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 40px)' }}>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-[20px] font-bold text-white tracking-wide">Bitese</h1>
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
                    className="absolute top-11 right-0 bg-white rounded-2xl shadow-2xl w-52 overflow-hidden z-50 border border-gray-100"
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
                        className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${
                          item.danger
                            ? 'text-red-500 hover:bg-red-50'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <item.icon size={16} className={item.danger ? 'text-red-400' : 'text-gray-400'} />
                        {item.label}
                        {item.label === 'Admin Panel' && (
                          <span className="ml-auto bg-blue-100 text-blue-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">Admin</span>
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
