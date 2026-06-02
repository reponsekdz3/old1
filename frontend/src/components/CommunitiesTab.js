import React, { useState, useEffect } from 'react';
import { FiPlus, FiUsers, FiChevronRight, FiSearch } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import CreateCommunityModal from './CreateCommunityModal';

function CommunitiesTab({ socket }) {
  const [communities, setCommunities] = useState([]);
  const [discoverCommunities, setDiscoverCommunities] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDiscover, setShowDiscover] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const response = await api.get('/communities');
      setCommunities(response.data.communities);
    } catch (error) {
      toast.error('Failed to load communities');
    } finally {
      setLoading(false);
    }
  };

  const loadDiscoverCommunities = async () => {
    try {
      const response = await api.get('/communities/discover');
      setDiscoverCommunities(response.data.communities);
      setShowDiscover(true);
    } catch (error) {
      toast.error('Failed to load communities');
    }
  };

  const handleJoinCommunity = async (communityId, inviteCode) => {
    try {
      await api.post(`/communities/${communityId}/join`, { invite_code: inviteCode });
      toast.success('Joined community successfully');
      loadCommunities();
      setShowDiscover(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to join community');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-500">Loading communities...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Communities</h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600"
          >
            <FiPlus size={20} />
          </button>
        </div>

        <button
          onClick={loadDiscoverCommunities}
          className="w-full flex items-center justify-between p-3 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
        >
          <div className="flex items-center gap-3">
            <FiSearch size={20} className="text-blue-600" />
            <span className="font-medium text-blue-600">Discover Communities</span>
          </div>
          <FiChevronRight className="text-blue-600" />
        </button>
      </div>

      {/* Communities List */}
      <div className="flex-1 overflow-y-auto">
        {communities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 p-8">
            <FiUsers size={64} className="mb-4 opacity-20" />
            <p className="text-center mb-2 font-medium">No communities yet</p>
            <p className="text-sm text-center mb-4">
              Create or join communities to connect with groups of people
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2 bg-green-500 text-white rounded-full hover:bg-green-600"
            >
              Create Community
            </button>
          </div>
        ) : (
          communities.map(community => (
            <div
              key={community.id}
              onClick={() => navigate(`/community/${community.id}`)}
              className="flex items-center gap-3 p-4 hover:bg-gray-50 cursor-pointer border-b transition"
            >
              <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                {community.icon_url ? (
                  <img src={community.icon_url} alt={community.name} className="w-full h-full rounded-lg object-cover" />
                ) : (
                  community.name[0]?.toUpperCase()
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">
                  {community.name}
                </h3>
                <p className="text-sm text-gray-600 truncate">
                  {community.member_count} members · {community.groups_count} groups
                </p>
              </div>

              <FiChevronRight className="text-gray-400" />
            </div>
          ))
        )}
      </div>

      {/* Create Community Modal */}
      {showCreateModal && (
        <CreateCommunityModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            loadCommunities();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Discover Communities Modal */}
      {showDiscover && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold">Discover Communities</h3>
              <button
                onClick={() => setShowDiscover(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {discoverCommunities.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  No public communities available
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {discoverCommunities.map(community => (
                    <div
                      key={community.id}
                      className="border rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold">
                          {community.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{community.name}</h4>
                          <p className="text-sm text-gray-600">
                            {community.member_count} members
                          </p>
                        </div>
                      </div>
                      
                      {community.description && (
                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                          {community.description}
                        </p>
                      )}

                      <button
                        onClick={() => handleJoinCommunity(community.id, null)}
                        className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
                      >
                        Join Community
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CommunitiesTab;
