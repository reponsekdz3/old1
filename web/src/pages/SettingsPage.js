import React, { useState, useEffect } from 'react';
import {
  FiArrowLeft, FiLock, FiBell, FiDownload, FiDatabase,
  FiHelpCircle, FiInfo, FiChevronRight,
  FiCheck,
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../services/store';

function Toggle({ value, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!value)}
      className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-[#25D366]' : 'bg-gray-200'}`}>
      <motion.div
        animate={{ x: value ? 18 : 2 }}
        transition={{ type:'spring', stiffness:500, damping:30 }}
        className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm"
      />
    </button>
  );
}

function SectionHeader({ icon: Icon, title, desc }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-6 pb-3">
      <div className="w-8 h-8 rounded-xl bg-[#25D366]/10 flex items-center justify-center">
        <Icon size={15} className="text-[#25D366]" />
      </div>
      <div>
        <p className="text-sm font-bold text-gray-800">{title}</p>
        {desc && <p className="text-xs text-gray-400">{desc}</p>}
      </div>
    </div>
  );
}

function ToggleRow({ label, sub, value, onChange }) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50/50 transition">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <Toggle value={value} onChange={onChange} />
    </div>
  );
}

function SelectRow({ label, sub, value, options, onChange }) {
  const current = options.find(o => o.value === value);
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 border-b border-gray-50 hover:bg-gray-50/50 transition text-left">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[#25D366] font-semibold">{current?.label || value}</span>
          <FiChevronRight size={14} className={`text-gray-300 transition-transform ${open ? 'rotate-90' : ''}`} />
        </div>
      </button>
      {open && (
        <div className="absolute right-5 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 z-10 min-w-[160px] overflow-hidden">
          {options.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-green-50 transition
                ${opt.value === value ? 'text-[#25D366] font-semibold' : 'text-gray-700'}`}>
              {opt.label}
              {opt.value === value && <FiCheck size={13} strokeWidth={3} className="text-[#25D366]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionRow({ label, sub, icon: Icon, iconBg = 'bg-gray-100', iconColor = 'text-gray-500', onClick, danger }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 transition text-left
        ${danger ? 'hover:bg-red-50' : 'hover:bg-gray-50/50'}`}>
      <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        {Icon && <Icon size={14} className={iconColor} />}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-800'}`}>{label}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <FiChevronRight size={14} className={danger ? 'text-red-200' : 'text-gray-200'} />
    </button>
  );
}

const PRIVACY_OPTIONS = [
  { value: 'everyone', label: 'Everyone' },
  { value: 'contacts', label: 'My Contacts' },
  { value: 'nobody',   label: 'Nobody' },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
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
    show_preview: true,
    message_sound: true,
    group_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const { data } = await api.get('/settings');
      setSettings(s => ({ ...s, ...data }));
    } catch { toast.error('Could not load settings'); }
    finally { setLoading(false); }
  };

  const updateSetting = async (key, value) => {
    setSaving(true);
    setSettings(s => ({ ...s, [key]: value }));
    try {
      await api.put('/settings', { [key]: value });
    } catch {
      setSettings(s => ({ ...s, [key]: !value }));
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      await api.post('/settings/backup');
      toast.success('Backup created successfully');
    } catch { toast.error('Backup failed'); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
          className="w-8 h-8 border-2 border-[#25D366] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 flex-shrink-0 shadow-sm">
        <button onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-xl transition">
          <FiArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900">Settings</h1>
          <p className="text-xs text-gray-400">Manage your preferences</p>
        </div>
        {saving && (
          <motion.div animate={{ rotate:360 }} transition={{ duration:1, repeat:Infinity, ease:'linear' }}
            className="w-4 h-4 border-2 border-[#25D366] border-t-transparent rounded-full" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Account summary */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={() => navigate(-1)}
            className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/50 transition text-left">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 overflow-hidden">
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                : user?.full_name?.[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900">{user?.full_name}</p>
              <p className="text-sm text-gray-400">{user?.phone_number}</p>
              {user?.bio && <p className="text-xs text-gray-400 truncate mt-0.5">{user.bio}</p>}
            </div>
            <FiChevronRight size={16} className="text-gray-300 flex-shrink-0" />
          </button>
        </div>

        {/* Privacy */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiLock} title="Privacy" desc="Control who can see your information" />

          <SelectRow label="Last Seen" sub="Who can see when you were last online"
            value={settings.last_seen_privacy} options={PRIVACY_OPTIONS}
            onChange={v => updateSetting('last_seen_privacy', v)} />
          <SelectRow label="Profile Photo" sub="Who can see your profile picture"
            value={settings.profile_photo_privacy} options={PRIVACY_OPTIONS}
            onChange={v => updateSetting('profile_photo_privacy', v)} />
          <SelectRow label="Status" sub="Who can see your status updates"
            value={settings.status_privacy} options={PRIVACY_OPTIONS}
            onChange={v => updateSetting('status_privacy', v)} />
          <ToggleRow label="Read Receipts" sub="Let others know you've read their messages"
            value={settings.read_receipts} onChange={v => updateSetting('read_receipts', v)} />
        </div>

        {/* Notifications */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiBell} title="Notifications" desc="Manage alerts and sounds" />

          <ToggleRow label="Push Notifications" sub="Receive notifications when a new message arrives"
            value={settings.show_notifications} onChange={v => updateSetting('show_notifications', v)} />
          <ToggleRow label="Message Preview" sub="Show message content in notifications"
            value={settings.show_preview} onChange={v => updateSetting('show_preview', v)} />
          <ToggleRow label="Message Sounds" sub="Play sound when a message is received"
            value={settings.message_sound ?? true} onChange={v => updateSetting('message_sound', v)} />
          <ToggleRow label="Group Notifications" sub="Get notified for new group messages"
            value={settings.group_notifications ?? true} onChange={v => updateSetting('group_notifications', v)} />
        </div>

        {/* Storage & Data */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiDownload} title="Storage & Data" desc="Manage auto-download settings" />

          <ToggleRow label="Auto-Download Photos" sub="Automatically save received photos"
            value={settings.auto_download_photos} onChange={v => updateSetting('auto_download_photos', v)} />
          <ToggleRow label="Auto-Download Videos" sub="Automatically save received videos"
            value={settings.auto_download_videos} onChange={v => updateSetting('auto_download_videos', v)} />
          <ToggleRow label="Auto-Download Documents" sub="Automatically save received documents"
            value={settings.auto_download_documents} onChange={v => updateSetting('auto_download_documents', v)} />
        </div>

        {/* Backup */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiDatabase} title="Backup & Restore" desc="Keep your chats safe" />
          <ActionRow label="Create Backup" sub="Export your messages as a JSON file"
            icon={FiDatabase} iconBg="bg-blue-50" iconColor="text-blue-500" onClick={handleBackup} />
        </div>

        {/* Help & About */}
        <div className="mx-4 mt-4 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <SectionHeader icon={FiHelpCircle} title="Help & About" />
          <ActionRow label="Help Center" sub="FAQ and support articles"
            icon={FiHelpCircle} iconBg="bg-purple-50" iconColor="text-purple-500"
            onClick={() => toast('Help center coming soon!')} />
          <ActionRow label="About Bitese" sub="Version 1.0.0 · Privacy policy"
            icon={FiInfo} iconBg="bg-gray-100" iconColor="text-gray-500"
            onClick={() => toast('Bitese v1.0.0 – End-to-end encrypted messaging', { icon: 'ℹ️' })} />
        </div>

        <div className="mx-4 my-6 text-center">
          <p className="text-xs text-gray-300">Bitese v1.0.0 · End-to-end encrypted</p>
          <p className="text-xs text-gray-300 mt-0.5">Your messages are protected with industry-standard encryption</p>
        </div>
      </div>
    </div>
  );
}
