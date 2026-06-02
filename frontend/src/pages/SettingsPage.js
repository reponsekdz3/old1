import React, { useState, useEffect } from 'react';
import { FiArrowLeft, FiLock, FiBell, FiImage, FiDownload } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';

function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState({
    read_receipts: true,
    last_seen_privacy: 'everyone',
    profile_photo_privacy: 'everyone',
    about_privacy: 'everyone',
    status_privacy: 'contacts',
    auto_download_photos: true,
    auto_download_videos: false,
    auto_download_documents: false,
    show_notifications: true,
    show_preview: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await api.get('/settings');
      setSettings(response.data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      await api.put('/settings', { [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Setting updated');
    } catch (error) {
      toast.error('Failed to update setting');
    }
  };

  const PrivacyOption = ({ label, value, options, onChange }) => (
    <div className="bg-white p-4 rounded-lg mb-2">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-green-500"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );

  const ToggleOption = ({ label, value, onChange }) => (
    <div className="bg-white p-4 rounded-lg mb-2 flex items-center justify-between">
      <span className="text-gray-700">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full transition ${
          value ? 'bg-green-500' : 'bg-gray-300'
        }`}
      >
        <div
          className={`w-5 h-5 bg-white rounded-full transition transform ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="bg-white border-b p-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-600">
          <FiArrowLeft size={24} />
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Privacy Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FiLock size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold">Privacy</h2>
          </div>

          <PrivacyOption
            label="Last Seen"
            value={settings.last_seen_privacy}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'contacts', label: 'My Contacts' },
              { value: 'nobody', label: 'Nobody' }
            ]}
            onChange={(val) => updateSetting('last_seen_privacy', val)}
          />

          <PrivacyOption
            label="Profile Photo"
            value={settings.profile_photo_privacy}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'contacts', label: 'My Contacts' },
              { value: 'nobody', label: 'Nobody' }
            ]}
            onChange={(val) => updateSetting('profile_photo_privacy', val)}
          />

          <PrivacyOption
            label="Status"
            value={settings.status_privacy}
            options={[
              { value: 'everyone', label: 'Everyone' },
              { value: 'contacts', label: 'My Contacts' },
              { value: 'nobody', label: 'Nobody' }
            ]}
            onChange={(val) => updateSetting('status_privacy', val)}
          />

          <ToggleOption
            label="Read Receipts"
            value={settings.read_receipts}
            onChange={(val) => updateSetting('read_receipts', val)}
          />
        </div>

        {/* Notifications Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FiBell size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold">Notifications</h2>
          </div>

          <ToggleOption
            label="Show Notifications"
            value={settings.show_notifications}
            onChange={(val) => updateSetting('show_notifications', val)}
          />

          <ToggleOption
            label="Show Preview"
            value={settings.show_preview}
            onChange={(val) => updateSetting('show_preview', val)}
          />
        </div>

        {/* Auto Download Section */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <FiDownload size={20} className="text-gray-600" />
            <h2 className="text-lg font-semibold">Auto Download</h2>
          </div>

          <ToggleOption
            label="Photos"
            value={settings.auto_download_photos}
            onChange={(val) => updateSetting('auto_download_photos', val)}
          />

          <ToggleOption
            label="Videos"
            value={settings.auto_download_videos}
            onChange={(val) => updateSetting('auto_download_videos', val)}
          />

          <ToggleOption
            label="Documents"
            value={settings.auto_download_documents}
            onChange={(val) => updateSetting('auto_download_documents', val)}
          />
        </div>

        {/* Backup Section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Backup</h2>
          <button
            onClick={async () => {
              try {
                await api.post('/settings/backup');
                toast.success('Backup created successfully');
              } catch (error) {
                toast.error('Failed to create backup');
              }
            }}
            className="w-full bg-green-500 text-white p-3 rounded-lg hover:bg-green-600"
          >
            Create Backup
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
