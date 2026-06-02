import React, { useState } from 'react';
import { FiX, FiCamera, FiUser, FiInfo, FiKey, FiHelpCircle, FiLogOut, FiGrid, FiStar, FiArchive, FiSettings } from 'react-icons/fi';
import { useAuthStore } from '../services/store';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import QRScannerModal from './QRScannerModal';

function ProfilePanel({ onClose }) {
  const { user, logout } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: user?.full_name || '',
    bio: user?.bio || ''
  });
  const [showQR, setShowQR] = useState(false);
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar_url);
  const navigate = useNavigate();

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image must be less than 5MB');
        return;
      }
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      let avatarUrl = user?.avatar_url;
      
      if (avatarFile) {
        const uploadFormData = new FormData();
        uploadFormData.append('file', avatarFile);
        const uploadResponse = await api.post('/upload/image', uploadFormData);
        avatarUrl = uploadResponse.data.url;
      }

      await api.put('/auth/profile', {
        full_name: formData.full_name,
        bio: formData.bio,
        avatar_url: avatarUrl
      });

      toast.success('Profile updated successfully');
      setEditing(false);
      window.location.reload();
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
    toast.success('Logged out successfully');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-start">
      <div className="w-full max-w-md bg-white h-full overflow-y-auto">
        {/* Header */}
        <div className="bg-green-600 text-white p-4 flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-green-700 rounded-full">
            <FiX size={24} />
          </button>
          <h2 className="text-xl font-medium">Profile</h2>
        </div>

        {/* Profile Picture Section */}
        <div className="bg-white p-8 text-center border-b">
          <div className="relative inline-block">
            <div className="w-48 h-48 rounded-full overflow-hidden bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center text-white text-6xl font-bold">
              {avatarPreview ? (
                <img src={avatarPreview} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                user?.full_name?.[0]?.toUpperCase()
              )}
            </div>
            <label className="absolute bottom-2 right-2 bg-green-500 text-white p-3 rounded-full cursor-pointer hover:bg-green-600 shadow-lg">
              <FiCamera size={24} />
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Profile Info */}
        <div className="bg-white">
          <div className="p-4 border-b">
            <p className="text-sm text-green-600 mb-2">Your name</p>
            {editing ? (
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500"
                placeholder="Enter your name"
              />
            ) : (
              <p className="text-lg">{user?.full_name}</p>
            )}
          </div>

          <div className="p-4 border-b">
            <p className="text-sm text-gray-500 mb-2">This is not your username or PIN. This name will be visible to your Bitese contacts.</p>
          </div>

          <div className="p-4 border-b">
            <p className="text-sm text-green-600 mb-2">About</p>
            {editing ? (
              <textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 resize-none"
                rows={3}
                placeholder="Add a bio..."
                maxLength={139}
              />
            ) : (
              <p className="text-lg">{user?.bio || 'Hey there! I am using Bitese.'}</p>
            )}
          </div>

          <div className="p-4 border-b">
            <p className="text-sm text-green-600 mb-2">Phone</p>
            <p className="text-lg">{user?.phone_number}</p>
          </div>

          {editing && (
            <div className="p-4 flex gap-2">
              <button
                onClick={handleSave}
                className="flex-1 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
              >
                Save Changes
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setFormData({
                    full_name: user?.full_name || '',
                    bio: user?.bio || ''
                  });
                  setAvatarPreview(user?.avatar_url);
                }}
                className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
            </div>
          )}

          {!editing && (
            <div className="p-4">
              <button
                onClick={() => setEditing(true)}
                className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-medium"
              >
                Edit Profile
              </button>
            </div>
          )}
        </div>

        {/* Menu Options */}
        <div className="mt-4 bg-white">
          <button
            onClick={() => setShowQR(true)}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 border-b"
          >
            <FiGrid size={24} className="text-gray-600" />
            <div className="flex-1 text-left">
              <p className="font-medium">QR Code</p>
              <p className="text-sm text-gray-500">Share your QR code</p>
            </div>
          </button>

          <button
            onClick={() => {
              navigate('/starred');
              onClose();
            }}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 border-b"
          >
            <FiStar size={24} className="text-gray-600" />
            <div className="flex-1 text-left">
              <p className="font-medium">Starred Messages</p>
              <p className="text-sm text-gray-500">View your starred messages</p>
            </div>
          </button>

          <button
            onClick={() => {
              navigate('/settings');
              onClose();
            }}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 border-b"
          >
            <FiSettings size={24} className="text-gray-600" />
            <div className="flex-1 text-left">
              <p className="font-medium">Settings</p>
              <p className="text-sm text-gray-500">Privacy, security, notifications</p>
            </div>
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 text-red-600"
          >
            <FiLogOut size={24} />
            <div className="flex-1 text-left">
              <p className="font-medium">Log Out</p>
            </div>
          </button>
        </div>

        {/* Footer */}
        <div className="p-4 text-center text-sm text-gray-500">
          <p>Bitese v1.0.0</p>
          <p className="mt-2">End-to-end encrypted</p>
        </div>
      </div>

      {showQR && (
        <QRScannerModal
          onClose={() => setShowQR(false)}
          onSuccess={() => setShowQR(false)}
        />
      )}
    </div>
  );
}

export default ProfilePanel;
