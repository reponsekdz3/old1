import React, { useState, useEffect } from 'react';
import { FiX, FiSearch, FiUsers, FiRadio, FiUserPlus } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function NewChatModal({ onClose, onChatCreated }) {
  const [contacts, setContacts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await api.get('/contacts');
      setContacts(response.data.contacts);
    } catch (error) {
      toast.error('Failed to load contacts');
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    contact.phone_number?.includes(searchQuery)
  );

  const handleSelectContact = (contact) => {
    if (contact.contact_user_id) {
      onChatCreated({
        id: contact.contact_user_id,
        name: contact.contact_name,
        phone_number: contact.phone_number,
        avatar_url: contact.contact_info?.avatar_url
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">New Chat</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Search contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500"
              autoFocus
            />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="border-b">
          <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
              <FiUsers size={24} />
            </div>
            <div className="text-left">
              <p className="font-medium">New Group</p>
              <p className="text-sm text-gray-500">Create a group chat</p>
            </div>
          </button>

          <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white">
              <FiRadio size={24} />
            </div>
            <div className="text-left">
              <p className="font-medium">New Channel</p>
              <p className="text-sm text-gray-500">Broadcast to subscribers</p>
            </div>
          </button>

          <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50">
            <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white">
              <FiUserPlus size={24} />
            </div>
            <div className="text-left">
              <p className="font-medium">New Contact</p>
              <p className="text-sm text-gray-500">Add a new contact</p>
            </div>
          </button>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No contacts found</p>
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <button
                key={contact.id}
                onClick={() => handleSelectContact(contact)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 border-b"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                  {contact.contact_info?.avatar_url ? (
                    <img
                      src={contact.contact_info.avatar_url}
                      alt={contact.contact_name}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    contact.contact_name?.[0]?.toUpperCase() || '?'
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="font-medium">{contact.contact_name || contact.phone_number}</p>
                  <p className="text-sm text-gray-500">{contact.contact_info?.bio || 'Hey there! I am using VipChat.'}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default NewChatModal;
