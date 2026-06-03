import React, { useState } from 'react';
import { FiMessageCircle, FiUsers, FiRadio, FiSettings, FiUser } from 'react-icons/fi';
import ChatsTab from './ChatsTab';
import CommunitiesTab from './CommunitiesTab';
import ChannelsTab from './ChannelsTab';

function MainNavigation({ socket, onChatSelect, onNewChat, onProfileClick, onLogout }) {
  const [activeTab, setActiveTab] = useState('chats');

  const tabs = [
    { id: 'chats', label: 'Chats', icon: FiMessageCircle },
    { id: 'communities', label: 'Communities', icon: FiUsers },
    { id: 'channels', label: 'Channels', icon: FiRadio },
  ];

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Top Header */}
      <div className="bg-green-600 text-white p-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">VipChat</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={onProfileClick}
            className="p-2 hover:bg-green-700 rounded-full transition"
          >
            <FiUser size={20} />
          </button>
          <button
            onClick={() => window.location.href = '/settings'}
            className="p-2 hover:bg-green-700 rounded-full transition"
          >
            <FiSettings size={20} />
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b bg-white">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 border-b-2 transition ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600 bg-green-50'
                  : 'border-transparent text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              <span className="font-medium hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chats' && (
          <ChatsTab
            socket={socket}
            onChatSelect={onChatSelect}
            onNewChat={onNewChat}
          />
        )}
        {activeTab === 'communities' && (
          <CommunitiesTab socket={socket} />
        )}
        {activeTab === 'channels' && (
          <ChannelsTab socket={socket} />
        )}
      </div>
    </div>
  );
}

export default MainNavigation;
