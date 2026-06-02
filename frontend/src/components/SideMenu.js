import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiMoreVertical, FiUserPlus, FiUsers, FiGrid } from 'react-icons/fi';
import { useChatStore } from '../services/store';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import AddContactModal from './AddContactModal';
import QRScannerModal from './QRScannerModal';

function SideMenu({ socket, onChatSelect, onNewChat }) {
  const { contacts, setContacts } = useChatStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showQRScanner, setShowQRScanner] = useState(false);
  const [lastMessages, setLastMessages] = useState({});

  useEffect(() => {
    loadContacts();
    loadLastMessages();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await api.get('/contacts');
      setContacts(response.data.contacts);
    } catch (error) {
      toast.error('Failed to load contacts');
    }
  };

  const loadLastMessages = async () => {
    try {
      const messages = {};
      for (const contact of contacts) {
        if (contact.contact_user_id) {
          const response = await api.get(`/messages/chat/${contact.contact_user_id}?limit=1`);
          if (response.data.messages.length > 0) {
            messages[contact.contact_user_id] = response.data.messages[0];
          }
        }
      }
      setLastMessages(messages);
    } catch (error) {
      console.error('Failed to load last messages');
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone_number?.includes(searchQuery)
  );

  const handleChatClick = (contact) => {
    if (contact.contact_user_id) {
      onChatSelect(contact.contact_user_id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Search Bar */}
      <div className="p-4 border-b">
        <div className="relative">
          <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 p-4 border-b overflow-x-auto">
        <button
          onClick={() => setShowAddContact(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 whitespace-nowrap text-sm"
        >
          <FiUserPlus size={18} />
          <span>Add Contact</span>
        </button>
        
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600 whitespace-nowrap text-sm"
        >
          <FiUsers size={18} />
          <span>New Group</span>
        </button>

        <button
          onClick={() => setShowQRScanner(true)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-full hover:bg-purple-600 whitespace-nowrap text-sm"
        >
          <FiGrid size={18} />
          <span>Scan QR</span>
        </button>
      </div>

      {/* Contacts List */}
      <div className="flex-1 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <FiUserPlus size={64} className="mb-4 opacity-20" />
            <p className="text-center mb-4">No contacts yet</p>
            <button
              onClick={() => setShowAddContact(true)}
              className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600"
            >
              Add Your First Contact
            </button>
          </div>
        ) : (
          filteredContacts.map(contact => {
            const lastMessage = lastMessages[contact.contact_user_id];
            return (
              <div
                key={contact.id}
                onClick={() => handleChatClick(contact)}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b transition"
              >
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold text-lg">
                    {contact.contact_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  {contact.contact_info?.status === 'available' && (
                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {contact.contact_name || contact.phone_number}
                    </h3>
                    {lastMessage && (
                      <span className="text-xs text-gray-500">
                        {formatDistanceToNow(new Date(lastMessage.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  
                  {lastMessage ? (
                    <p className="text-sm text-gray-600 truncate">
                      {lastMessage.media_type === 'voice' && '🎤 Voice message'}
                      {lastMessage.media_type === 'image' && '📷 Photo'}
                      {lastMessage.media_type === 'video' && '🎥 Video'}
                      {lastMessage.media_type === 'location' && '📍 Location'}
                      {lastMessage.media_type === 'contact' && '👤 Contact'}
                      {!lastMessage.media_type && lastMessage.content}
                    </p>
                  ) : (
                    <p className="text-sm text-gray-400">Tap to start chatting</p>
                  )}
                </div>

                {lastMessage?.status === 'sent' && (
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Floating Action Button */}
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-green-500 text-white rounded-full shadow-lg hover:bg-green-600 flex items-center justify-center z-10"
      >
        <FiPlus size={24} />
      </button>

      {/* Quick Menu */}
      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-20"
            onClick={() => setShowMenu(false)}
          />
          <div className="fixed bottom-24 right-6 bg-white rounded-lg shadow-xl p-2 z-30 min-w-[200px]">
            <button
              onClick={() => {
                setShowAddContact(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded flex items-center gap-3"
            >
              <FiUserPlus size={20} />
              <span>Add Contact</span>
            </button>
            <button
              onClick={() => {
                onNewChat();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded flex items-center gap-3"
            >
              <FiUsers size={20} />
              <span>New Group</span>
            </button>
            <button
              onClick={() => {
                setShowQRScanner(true);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-3 hover:bg-gray-100 rounded flex items-center gap-3"
            >
              <FiGrid size={20} />
              <span>Scan QR Code</span>
            </button>
          </div>
        </>
      )}

      {/* Modals */}
      {showAddContact && (
        <AddContactModal
          onClose={() => setShowAddContact(false)}
          onSuccess={() => {
            loadContacts();
            setShowAddContact(false);
          }}
        />
      )}

      {showQRScanner && (
        <QRScannerModal
          onClose={() => setShowQRScanner(false)}
          onSuccess={() => {
            loadContacts();
            setShowQRScanner(false);
          }}
        />
      )}
    </div>
  );
}

export default SideMenu;
