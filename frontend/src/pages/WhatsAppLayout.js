import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../services/store';
import { initializeSocket, disconnectSocket } from '../services/socket';
import MainNavigation from '../components/MainNavigation';
import ChatWindow from '../components/ChatWindow';
import ProfilePanel from '../components/ProfilePanel';
import ContactInfo from '../components/ContactInfo';
import NewChatModal from '../components/NewChatModal';
import { FiMenu, FiX } from 'react-icons/fi';

function WhatsAppLayout() {
  const { user, logout } = useAuthStore();
  const [socket, setSocket] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    const newSocket = initializeSocket(user.id);
    setSocket(newSocket);

    return () => {
      disconnectSocket();
    };
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left Sidebar - Navigation */}
      <div className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0
        fixed md:relative
        w-full md:w-[400px] lg:w-[420px]
        h-full
        bg-white
        border-r border-gray-200
        transition-transform duration-300
        z-40
        flex flex-col
      `}>
        {/* Mobile Close Button */}
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg"
        >
          <FiX size={24} />
        </button>

        <MainNavigation
          socket={socket}
          onChatSelect={(chat) => {
            setActiveChat(chat);
            setIsMobileMenuOpen(false);
          }}
          onNewChat={() => setShowNewChat(true)}
          onProfileClick={() => setShowProfile(true)}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeChat ? (
          <>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden absolute top-4 left-4 z-30 p-2 bg-white rounded-full shadow-lg"
            >
              <FiMenu size={24} />
            </button>

            <ChatWindow
              socket={socket}
              chat={activeChat}
              onContactInfoClick={() => setShowContactInfo(true)}
              onBack={() => setActiveChat(null)}
            />
          </>
        ) : (
          <div className="flex items-center justify-center h-full bg-gray-50">
            <div className="text-center px-8">
              <div className="w-64 h-64 mx-auto mb-8 relative">
                <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-blue-500 rounded-full opacity-20 animate-pulse" />
                <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-32 h-32 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.67-.33-3.82-.91l-.27-.16-2.84.48.48-2.84-.16-.27C4.33 14.67 4 13.38 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
                    <path d="M17.25 14.77c-.27-.14-1.59-.78-1.84-.87-.25-.09-.43-.14-.61.14-.18.27-.7.87-.86 1.05-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.33-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.56.13-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.46-.84-2-.22-.52-.45-.45-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3s.98 2.66 1.12 2.84c.14.18 1.94 2.96 4.7 4.15.66.28 1.17.45 1.57.58.66.21 1.26.18 1.74.11.53-.08 1.59-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z"/>
                  </svg>
                </div>
              </div>
              <h2 className="text-3xl font-light text-gray-800 mb-4">
                Bitese Web
              </h2>
              <p className="text-gray-600 mb-2">
                Send and receive messages without keeping your phone online.
              </p>
              <p className="text-gray-500 text-sm">
                Use Bitese on up to 4 linked devices and 1 phone at the same time.
              </p>
              
              <button
                onClick={() => setIsMobileMenuOpen(true)}
                className="md:hidden mt-8 px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600"
              >
                Start Messaging
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Sidebar - Contact Info (Desktop only) */}
      {showContactInfo && activeChat && (
        <div className="hidden lg:block w-[400px] border-l border-gray-200 bg-white">
          <ContactInfo
            contact={activeChat}
            onClose={() => setShowContactInfo(false)}
          />
        </div>
      )}

      {/* Mobile Contact Info Overlay */}
      {showContactInfo && activeChat && (
        <div className="lg:hidden fixed inset-0 bg-white z-50">
          <ContactInfo
            contact={activeChat}
            onClose={() => setShowContactInfo(false)}
          />
        </div>
      )}

      {/* Profile Panel */}
      {showProfile && (
        <ProfilePanel
          onClose={() => setShowProfile(false)}
        />
      )}

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={(chat) => {
            setActiveChat(chat);
            setShowNewChat(false);
          }}
        />
      )}

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}

export default WhatsAppLayout;
