import React, { useState, useEffect } from 'react';
import { FiX, FiSend } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function ForwardModal({ message, onClose, socket }) {
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await api.get('/contacts');
      setContacts(response.data.contacts);
    } catch (error) {
      toast.error('Failed to load contacts');
    }
  };

  const toggleSelect = (contactId) => {
    setSelected(prev =>
      prev.includes(contactId)
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const handleForward = async () => {
    if (selected.length === 0) {
      toast.error('Select at least one contact');
      return;
    }

    try {
      setLoading(true);
      await api.post(`/messages/${message.id}/forward`, {
        recipient_ids: selected
      });

      if (socket) {
        selected.forEach(recipientId => {
          socket.emit('message', {
            ...message,
            receiver_id: recipientId,
            forwarded: true
          });
        });
      }

      toast.success(`Forwarded to ${selected.length} contact(s)`);
      onClose();
    } catch (error) {
      toast.error('Failed to forward message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold">Forward Message</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <FiX size={24} />
          </button>
        </div>

        <div className="p-4 max-h-96 overflow-y-auto">
          {contacts.map(contact => (
            <div
              key={contact.id}
              onClick={() => toggleSelect(contact.contact_user_id)}
              className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer mb-2 ${
                selected.includes(contact.contact_user_id)
                  ? 'bg-green-50 border-2 border-green-500'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white font-bold">
                {contact.contact_name?.[0] || '?'}
              </div>
              <div className="flex-1">
                <p className="font-medium">{contact.contact_name}</p>
                <p className="text-sm text-gray-500">{contact.phone_number}</p>
              </div>
              {selected.includes(contact.contact_user_id) && (
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white">
                  ✓
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-4 border-t flex justify-between items-center">
          <span className="text-sm text-gray-600">
            {selected.length} selected
          </span>
          <button
            onClick={handleForward}
            disabled={loading || selected.length === 0}
            className="bg-green-500 text-white px-6 py-2 rounded-full hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
          >
            <FiSend size={18} />
            <span>Forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default ForwardModal;
