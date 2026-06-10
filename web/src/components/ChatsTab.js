import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FiPlus, FiSearch, FiUserPlus, FiUsers, FiGrid,
  FiMic, FiCamera, FiVideo, FiMapPin, FiUser, FiFile,
  FiCheck, FiX, FiMessageSquare,
} from 'react-icons/fi';
import { useChatStore, useAuthStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { format, isToday, isYesterday } from 'date-fns';
import AddContactModal from './AddContactModal';
import QRScannerModal from './QRScannerModal';
import { motion, AnimatePresence } from 'framer-motion';
import { VerifiedBadgeInline } from './VerifiedBadge';

function ChatsTab({ socket, onChatSelect, onNewChat }) {
  const { contacts, setContacts, setActiveChat, activeChat } = useChatStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('All'); // 'All', 'Unread', 'Groups', 'Archived'
  const [showMenu, setShowMenu] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadCounts, setUnreadCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState({});

  useEffect(() => {
    loadContacts();
  }, []);

  // Listen for new socket messages to update last messages list
  useEffect(() => {
    if (!socket) return;
    const handleNewMsg = (data) => {
      const otherId = data.sender_id === user?.id ? data.receiver_id : data.sender_id;
      setLastMessages(prev => ({
        ...prev,
        [otherId]: data,
      }));
      // Increment unread if not the active chat
      if (data.sender_id !== user?.id && otherId !== activeChat) {
        setUnreadCounts(prev => ({
          ...prev,
          [otherId]: (prev[otherId] || 0) + 1,
        }));
      }
    };
    const handleTyping = (data) => {
      setTyping(prev => ({ ...prev, [data.user_id]: true }));
      setTimeout(() => setTyping(prev => { const n = { ...prev }; delete n[data.user_id]; return n; }), 3000);
    };
    const handleStopTyping = (data) => {
      setTyping(prev => { const n = { ...prev }; delete n[data.user_id]; return n; });
    };
    socket.on('new_message', handleNewMsg);
    socket.on('typing_indicator', handleTyping);
    socket.on('stop_typing_indicator', handleStopTyping);
    return () => {
      socket.off('new_message', handleNewMsg);
      socket.off('typing_indicator', handleTyping);
      socket.off('stop_typing_indicator', handleStopTyping);
    };
  }, [socket, user, activeChat]);

  const loadContacts = async () => {
    try {
      setLoading(true);
      const response = await api.get('/contacts');
      const contactList = response.data.contacts || [];
      setContacts(contactList);
      loadLastMessages(contactList);
    } catch {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const loadLastMessages = async (contactList) => {
    const msgs = {};
    const unread = {};
    for (const contact of contactList) {
      if (!contact.contact_user_id) continue;
      try {
        const { data } = await api.get(`/messages/chat/${contact.contact_user_id}?page=1&per_page=1`);
        if (data.messages?.length > 0) {
          msgs[contact.contact_user_id] = data.messages[data.messages.length - 1];
        }
      } catch {}
    }
    setLastMessages(msgs);
  };

  const filteredContacts = contacts.filter(c => {
    const matchesSearch = c.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         c.phone_number?.includes(searchQuery);
    if (!matchesSearch) return false;

    if (filter === 'Unread') return (unreadCounts[c.contact_user_id] || 0) > 0;
    if (filter === 'Groups') return false; // This is ChatsTab (DM), Groups are in CommunitiesTab
    return true;
  });

  // Sort by last message time
  const sortedContacts = [...filteredContacts].sort((a, b) => {
    const aTime = lastMessages[a.contact_user_id]?.created_at || a.created_at;
    const bTime = lastMessages[b.contact_user_id]?.created_at || b.created_at;
    return new Date(bTime) - new Date(aTime);
  });

  const handleChatClick = (contact) => {
    if (!contact.contact_user_id) {
      toast.error('This contact is not on VipChat yet');
      return;
    }
    setActiveChat(contact.contact_user_id);
    if (onChatSelect) onChatSelect(contact.contact_user_id);
    // Clear unread count
    setUnreadCounts(prev => ({ ...prev, [contact.contact_user_id]: 0 }));
  };

  const fmtTime = (isoStr) => {
    if (!isoStr) return '';
    const d = new Date(isoStr);
    if (isToday(d)) return format(d, 'HH:mm');
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'MMM d');
  };

  const getLastMsgPreview = (uid, lastMsg) => {
    if (!lastMsg) return null;
    const isOwn = lastMsg.sender_id === user?.id;
    const prefix = isOwn ? 'You: ' : '';
    if (lastMsg.is_deleted_everyone) return `${prefix}Message deleted`;
    if (lastMsg.media_type === 'voice') return { icon: FiMic, text: `${prefix}Voice message` };
    if (lastMsg.media_type === 'image') return { icon: FiCamera, text: `${prefix}Photo` };
    if (lastMsg.media_type === 'video') return { icon: FiVideo, text: `${prefix}Video` };
    if (lastMsg.media_type === 'location') return { icon: FiMapPin, text: `${prefix}Location` };
    if (lastMsg.media_type === 'contact') return { icon: FiUser, text: `${prefix}Contact` };
    if (lastMsg.media_type === 'document') return { icon: FiFile, text: `${prefix}Document` };
    if (lastMsg.content) return `${prefix}${lastMsg.content}`;
    return null;
  };

  const getStatusIcon = (msg) => {
    if (!msg || msg.sender_id !== user?.id) return null;
    if (msg.status === 'read') return <span className="inline-flex"><FiCheck size={10} className="text-blue-500 -mr-1.5" strokeWidth={3}/><FiCheck size={10} className="text-blue-500" strokeWidth={3}/></span>;
    if (msg.status === 'delivered') return <span className="inline-flex"><FiCheck size={10} className="text-gray-400 -mr-1.5" strokeWidth={3}/><FiCheck size={10} className="text-gray-400" strokeWidth={3}/></span>;
    return <FiCheck size={10} className="text-gray-400" strokeWidth={3} />;
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Status Circles (Stories) ── */}
      <div className="flex gap-4 px-4 py-3 overflow-x-auto scrollbar-hide border-b border-gray-100 bg-white">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer group">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center group-hover:border-[#25D366] transition-colors">
              <FiPlus size={20} className="text-gray-400 group-hover:text-[#25D366]" />
            </div>
          </div>
          <span className="text-[11px] text-gray-500 font-medium">Your Status</span>
        </div>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex flex-col items-center gap-1 flex-shrink-0 cursor-pointer">
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-[#25D366] to-[#075E54]">
              <div className="w-[52px] h-[52px] rounded-full border-2 border-white overflow-hidden bg-gray-200">
                <img src={`https://i.pravatar.cc/150?u=${i}`} alt="" className="w-full h-full object-cover" />
              </div>
            </div>
            <span className="text-[11px] text-gray-500 font-medium truncate w-14 text-center">User {i}</span>
          </div>
        ))}
      </div>

      {/* ── Search & Filters ── */}
      <div className="px-3 pt-3 pb-2 bg-white">
        <div className="relative mb-3">
          <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#f0f2f5] rounded-xl text-sm focus:outline-none border-none transition-all focus:bg-white focus:ring-1 focus:ring-gray-200"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {['All', 'Unread', 'Groups', 'Archived'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
                filter === f ? 'bg-[#25D366] text-white' : 'bg-[#f0f2f5] text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* ── Contacts List ── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex flex-col gap-3 p-4">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1">
                  <div className="h-3.5 bg-gray-200 rounded-full w-2/3 mb-2" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : sortedContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8 py-16">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <FiMessageSquare size={32} className="text-gray-300" />
            </div>
            <p className="font-medium text-gray-600 mb-1">No chats yet</p>
            <p className="text-sm text-gray-400 mb-4">
              {searchQuery ? 'No contacts match your search' : 'Add contacts to start chatting'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowAddContact(true)}
                className="px-5 py-2.5 bg-[#25D366] text-white rounded-full text-sm font-semibold hover:bg-[#1fbd5a] transition"
              >
                Add Contact
              </button>
            )}
          </div>
        ) : (
          sortedContacts.map(contact => {
            const lastMsg = lastMessages[contact.contact_user_id];
            const preview = getLastMsgPreview(contact.contact_user_id, lastMsg);
            const unread = unreadCounts[contact.contact_user_id] || 0;
            const isActive = activeChat === contact.contact_user_id;
            const isOnVipChat = !!contact.contact_user_id;
            const isOnline = contact.contact_info?.status === 'available';

            const isTyping = typing[contact.contact_user_id];

            return (
              <motion.div
                key={contact.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleChatClick(contact)}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-all ${
                  isActive ? 'bg-[#f0f2f5]' : 'hover:bg-gray-50'
                }`}
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="p-[2px] rounded-full transition-all group-hover:scale-105">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-sm">
                      {contact.contact_info?.avatar_url
                        ? <img src={contact.contact_info.avatar_url} alt="" className="w-full h-full object-cover" />
                        : (contact.contact_name?.[0]?.toUpperCase() || '?')}
                    </div>
                  </div>
                  {isOnline && (
                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25D366] rounded-full border-2 border-white shadow-sm" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className="font-semibold text-[15px] text-gray-900 truncate flex items-center gap-1">
                      {contact.contact_name || contact.phone_number}
                      <VerifiedBadgeInline user={contact.contact_info} size={13} />
                    </h3>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                      <span className={`text-[11px] ${unread > 0 ? 'text-[#25D366] font-bold' : 'text-gray-400'}`}>
                        {fmtTime(lastMsg?.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-[13px] truncate flex-1 flex items-center gap-1">
                      {isTyping ? (
                        <span className="text-[#25D366] font-medium animate-pulse">typing...</span>
                      ) : (
                        <p className="text-gray-500 truncate flex items-center gap-1">
                          {lastMsg && lastMsg.sender_id === user?.id && getStatusIcon(lastMsg)}
                          {preview
                            ? typeof preview === 'string'
                              ? preview
                              : <><preview.icon size={13} className="flex-shrink-0 text-gray-400" />{preview.text}</>
                            : <span className="text-gray-300 italic">{isOnVipChat ? 'Tap to start chatting' : 'Not on VipChat'}</span>
                          }
                        </p>
                      )}
                    </div>
                    {unread > 0 && (
                      <span className="ml-2 px-1.5 h-5 min-w-[20px] bg-[#25D366] text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0 shadow-sm shadow-[#25D366]/30">
                        {unread > 99 ? '99+' : unread}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* ── FAB ── */}
      <div className="relative">
        <AnimatePresence>
          {showMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-20"
                onClick={() => setShowMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 8 }}
                className="absolute bottom-20 right-4 bg-white rounded-2xl shadow-2xl overflow-hidden z-30 min-w-[190px] border border-gray-100"
              >
                {[
                  { icon: FiUserPlus, label: 'New Contact', action: () => { setShowAddContact(true); setShowMenu(false); } },
                  { icon: FiUsers, label: 'New Group', action: () => { setShowMenu(false); toast('Groups available in Groups tab'); } },
                  { icon: FiGrid, label: 'Scan QR', action: () => { setShowQRScanner(true); setShowMenu(false); } },
                ].map(item => (
                  <button key={item.label} onClick={item.action}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-sm text-gray-700 font-medium">
                    <div className="w-8 h-8 bg-[#25D366] rounded-full flex items-center justify-center">
                      <item.icon size={15} className="text-white" />
                    </div>
                    {item.label}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
        <button
          onClick={() => setShowMenu(v => !v)}
          className="absolute bottom-4 right-4 w-14 h-14 bg-[#25D366] hover:bg-[#1fbd5a] text-white rounded-full shadow-lg flex items-center justify-center z-10 transition"
        >
          {showMenu ? <FiX size={22} /> : <FiPlus size={22} />}
        </button>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showAddContact && (
          <AddContactModal
            onClose={() => setShowAddContact(false)}
            onSuccess={() => { loadContacts(); setShowAddContact(false); }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showQRScanner && (
          <QRScannerModal
            onClose={() => setShowQRScanner(false)}
            onSuccess={() => { loadContacts(); setShowQRScanner(false); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default ChatsTab;
