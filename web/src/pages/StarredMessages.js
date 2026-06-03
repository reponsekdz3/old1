import React, { useState, useEffect } from 'react';
import { FiStar, FiArrowLeft } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

function StarredMessages() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadStarredMessages();
  }, []);

  const loadStarredMessages = async () => {
    try {
      const response = await api.get('/messages/starred');
      setMessages(response.data.starred_messages);
    } catch (error) {
      toast.error('Failed to load starred messages');
    } finally {
      setLoading(false);
    }
  };

  const handleUnstar = async (messageId) => {
    try {
      await api.delete(`/messages/${messageId}/star`);
      setMessages(prev => prev.filter(m => m.id !== messageId));
      toast.success('Message unstarred');
    } catch (error) {
      toast.error('Failed to unstar message');
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-600">
          <FiArrowLeft size={24} />
        </button>
        <div className="flex items-center gap-2">
          <FiStar size={24} className="text-yellow-500" />
          <h1 className="text-xl font-semibold">Starred Messages</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Loading...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <FiStar size={64} className="mb-4 opacity-20" />
            <p>No starred messages</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(message => (
              <div key={message.id} className="bg-white rounded-lg p-4 shadow-sm">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-sm font-bold">
                      {message.sender_name?.[0]}
                    </div>
                    <span className="font-medium">{message.sender_name}</span>
                  </div>
                  <button
                    onClick={() => handleUnstar(message.id)}
                    className="text-yellow-500 hover:text-yellow-600"
                  >
                    <FiStar size={20} fill="currentColor" />
                  </button>
                </div>

                <p className="text-gray-800 mb-2">{message.content}</p>

                {message.media_url && (
                  <div className="mb-2">
                    {message.media_type === 'image' && (
                      <img
                        src={message.media_url}
                        alt="Media"
                        className="rounded-lg max-w-xs"
                      />
                    )}
                    {message.media_type === 'video' && (
                      <video
                        src={message.media_url}
                        controls
                        className="rounded-lg max-w-xs"
                      />
                    )}
                  </div>
                )}

                <p className="text-xs text-gray-500">
                  {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default StarredMessages;
