import React, { useState, useEffect } from 'react';
import { FiX, FiPhone, FiVideo, FiSearch, FiStar, FiVolume2, FiVolumeX, FiTrash2, FiSlash, FiImage, FiFile } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { VerifiedBadgeInline } from './VerifiedBadge';

function ContactInfo({ contact, onClose }) {
  const [mediaFiles, setMediaFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [groups, setGroups] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [activeTab, setActiveTab] = useState('media');

  useEffect(() => {
    loadContactData();
  }, [contact]);

  const loadContactData = async () => {
    try {
      // Load media
      const mediaResponse = await api.get(`/messages/media-gallery/${contact.id}?type=image`);
      setMediaFiles(mediaResponse.data.media);

      // Load documents
      const docsResponse = await api.get(`/messages/media-gallery/${contact.id}?type=document`);
      setDocuments(docsResponse.data.media);

      // Load common groups
      const groupsResponse = await api.get(`/contacts/${contact.id}/groups`);
      setGroups(groupsResponse.data.groups || []);

      // Check if muted
      const mutedResponse = await api.get('/settings/muted');
      const mutedChats = mutedResponse.data.muted_chats || [];
      setIsMuted(mutedChats.some(m => m.chat_id === contact.id));

      // Check if blocked
      setIsBlocked(contact.is_blocked || false);
    } catch (error) {
      console.error('Failed to load contact data');
    }
  };

  const handleMute = async () => {
    try {
      if (isMuted) {
        await api.delete(`/settings/mute/${contact.id}`);
        toast.success('Chat unmuted');
        setIsMuted(false);
      } else {
        await api.post(`/settings/mute/${contact.id}`, { duration: 'forever' });
        toast.success('Chat muted');
        setIsMuted(true);
      }
    } catch (error) {
      toast.error('Failed to update mute status');
    }
  };

  const handleBlock = async () => {
    try {
      if (isBlocked) {
        await api.put(`/contacts/${contact.id}/unblock`);
        toast.success('Contact unblocked');
        setIsBlocked(false);
      } else {
        await api.put(`/contacts/${contact.id}/block`);
        toast.success('Contact blocked');
        setIsBlocked(true);
      }
    } catch (error) {
      toast.error('Failed to update block status');
    }
  };

  const handleDeleteChat = async () => {
    if (window.confirm('Delete all messages with this contact?')) {
      try {
        await api.delete(`/messages/chat/${contact.id}`);
        toast.success('Chat deleted');
        onClose();
      } catch (error) {
        toast.error('Failed to delete chat');
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white p-4 flex items-center gap-4 border-b">
        <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
          <FiX size={24} />
        </button>
        <h2 className="text-lg font-medium">Contact Info</h2>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Section */}
        <div className="bg-white p-8 text-center border-b">
          <div className="w-48 h-48 mx-auto rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-6xl font-bold mb-4">
            {contact.avatar_url ? (
              <img src={contact.avatar_url} alt={contact.name} className="w-full h-full rounded-full object-cover" />
            ) : (
              contact.name?.[0]?.toUpperCase()
            )}
          </div>
          <h3 className="text-2xl font-medium mb-2 flex items-center justify-center gap-2">
            {contact.name}
            <VerifiedBadgeInline user={contact} size={18} />
          </h3>
          <p className="text-gray-600">{contact.phone_number}</p>
          {contact.bio && (
            <p className="text-gray-500 mt-4 italic">{contact.bio}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="bg-white p-4 flex justify-around border-b">
          <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
              <FiPhone size={24} />
            </div>
            <span className="text-sm">Audio</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
              <FiVideo size={24} />
            </div>
            <span className="text-sm">Video</span>
          </button>
          <button className="flex flex-col items-center gap-2 p-3 hover:bg-gray-50 rounded-lg">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white">
              <FiSearch size={24} />
            </div>
            <span className="text-sm">Search</span>
          </button>
        </div>

        {/* About Section */}
        {contact.bio && (
          <div className="bg-white p-4 border-b">
            <p className="text-sm text-green-600 mb-2">About</p>
            <p className="text-gray-800">{contact.bio}</p>
          </div>
        )}

        {/* Media, Docs, Links Tabs */}
        <div className="bg-white mt-4">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-3 ${activeTab === 'media' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-600'}`}
            >
              Media
            </button>
            <button
              onClick={() => setActiveTab('docs')}
              className={`flex-1 py-3 ${activeTab === 'docs' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-600'}`}
            >
              Docs
            </button>
            <button
              onClick={() => setActiveTab('links')}
              className={`flex-1 py-3 ${activeTab === 'links' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-600'}`}
            >
              Links
            </button>
          </div>

          <div className="p-4">
            {activeTab === 'media' && (
              <div className="grid grid-cols-3 gap-2">
                {mediaFiles.length > 0 ? (
                  mediaFiles.slice(0, 9).map((media, index) => (
                    <div key={index} className="aspect-square bg-gray-200 rounded-lg overflow-hidden">
                      <img src={media.media_url} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center py-8 text-gray-500">
                    <FiImage size={48} className="mx-auto mb-2 opacity-30" />
                    <p>No media shared</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'docs' && (
              <div className="space-y-2">
                {documents.length > 0 ? (
                  documents.map((doc, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FiFile size={24} className="text-blue-500" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{doc.content}</p>
                        <p className="text-sm text-gray-500">
                          {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <FiFile size={48} className="mx-auto mb-2 opacity-30" />
                    <p>No documents shared</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'links' && (
              <div className="text-center py-8 text-gray-500">
                <p>No links shared</p>
              </div>
            )}
          </div>
        </div>

        {/* Common Groups */}
        {groups.length > 0 && (
          <div className="bg-white mt-4 p-4">
            <p className="text-sm text-gray-600 mb-3">{groups.length} group(s) in common</p>
            <div className="space-y-2">
              {groups.map((group) => (
                <div key={group.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold">
                    {group.name[0]}
                  </div>
                  <div>
                    <p className="font-medium">{group.name}</p>
                    <p className="text-sm text-gray-500">{group.members_count} members</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="bg-white mt-4">
          <button
            onClick={handleMute}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 border-b"
          >
            {isMuted ? <FiVolume2 size={20} /> : <FiVolumeX size={20} />}
            <span>{isMuted ? 'Unmute notifications' : 'Mute notifications'}</span>
          </button>

          <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 border-b">
            <FiStar size={20} />
            <span>Starred messages</span>
          </button>

          <button
            onClick={handleBlock}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 border-b text-red-600"
          >
            <FiSlash size={20} />
            <span>{isBlocked ? 'Unblock contact' : 'Block contact'}</span>
          </button>

          <button
            onClick={handleDeleteChat}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-red-600"
          >
            <FiTrash2 size={20} />
            <span>Delete chat</span>
          </button>
        </div>

        {/* Encryption Notice */}
        <div className="p-4 text-center text-sm text-gray-500">
          <p className="mb-2">🔒 End-to-end encrypted</p>
          <p>Messages and calls are secured with end-to-end encryption.</p>
        </div>
      </div>
    </div>
  );
}

export default ContactInfo;
