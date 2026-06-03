import React, { useState, useEffect } from 'react';
import { FiPlus, FiRadio, FiChevronRight, FiSearch, FiCheck } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import CreateChannelModal from './CreateChannelModal';

function ChannelsTab({ socket }) {
  const [channels, setChannels] = useState([]);
  const [discoverChannels, setDiscoverChannels] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const response = await api.get('/channels');
      setChannels(response.data.channels);
    } catch (error) {
      toast.error('Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  const loadDiscoverChannels = async () => {
    try {
      const response = await api.get('/channels/discover');
      setDiscoverChannels(response.data.channels);
      setShowDiscover(true);
    } catch (error) {
      toast.error('Failed to load channels');
    }
  };

  const handleSubscribe = async (channelId) => {
    try {
      await api.post(`/channels/${channelId}/subscribe`);
      toast.success('Subscribed successfully');
      loadChannels();
      loadDiscoverChannels();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to subscribe');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading channels...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Channels</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"
          >
            <FiPlus size={20} />
          </button>
        </div>

        <button
          onClick={loadDiscoverChannels}
          className="w-full flex items-center justify-between p-3 bg-purple-50 rounded-lg hover:bg-purple-100 transition"
        >
          <div className="flex items-center gap-3">
            <FiSearch size={20} className="text-purple-600" />
            <span className="font-medium text-purple-600">Discover Channels</span>
          </div>
          <FiChevronRight className="text-purple-600" />
        </button>
      </div>

      {/* Channels List */}
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <FiRadio size={64} className="mb-4 opacity-20" />
            <p className="text-center mb-2 font-medium">No channels yet</p>
            <p className="text-sm text-center mb-4">
              Create or subscribe to channels to receive broadcasts
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600"
            >
              Create Channel
            </button>
          </div>
        ) : (
          channels.map(channel => (
            <div
              key={channel.id}
              onClick={() => navigate(`/channel/${channel.id}`)}
              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b transition"
            >
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                {channel.icon_url ? (
                  <img src={channel.icon_url} alt={channel.name} className="w-full h-full rounded-full object-cover" />
                ) : (
                  channel.name[0]?.toUpperCase()
                )}
                {channel.is_verified && (
                  <div className="absolute bottom-0 right-0 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white">
                    <FiCheck size={12} className="text-white" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-900 truncate">
                    {channel.name}
                  </h3>
                  {channel.is_verified && (
                    <FiCheck size={16} className="text-blue-500" />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  {channel.subscriber_count.toLocaleString()} subscribers
                </p>
              </div>

              <FiChevronRight className="text-gray-400" />
            </div>
          ))
        )}
      </div>

      {/* Create Channel Modal */}
      {showCreateModal && (
        <CreateChannelModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadChannels();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Discover Channels Modal */}
      {showDiscover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Discover Channels</h3>
              <button
                onClick={() => setShowDiscover(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {discoverChannels.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No channels available
                </div>
              ) : (
                <div className="space-y-3">
                  {discoverChannels.map(channel => {
                    const isSubscribed = channels.some(c => c.id === channel.id);
                    return (
                      <div
                        key={channel.id}
                        className="border rounded-lg p-4 hover:shadow-md transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold">
                            {channel.name[0]?.toUpperCase()}
                          </div>
                          
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-semibold">{channel.name}</h4>
                              {channel.is_verified && (
                                <FiCheck size={16} className="text-blue-500" />
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2">
                              {channel.subscriber_count.toLocaleString()} subscribers
                            </p>
                            {channel.description && (
                              <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                {channel.description}
                              </p>
                            )}
                          </div>

                          <button
                            onClick={() => handleSubscribe(channel.id)}
                            disabled={isSubscribed}
                            className={`px-4 py-2 rounded-lg font-medium ${
                              isSubscribed
                                ? 'bg-gray-200 text-gray-600 cursor-not-allowed'
                                : 'bg-green-500 text-white hover:bg-green-600'
                            }`}
                          >
                            {isSubscribed ? 'Subscribed' : 'Subscribe'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ChannelsTab;
