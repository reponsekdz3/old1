import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useChatStore, useCallStore } from '../services/store';
import { initializeSocket, disconnectSocket } from '../services/socket';
import { useWebRTC } from '../hooks/useWebRTC';
import api from '../services/api';
import MainNavigation from '../components/MainNavigation';
import ChatWindow from '../components/ChatWindow';
import ContactInfo from '../components/ContactInfo';
import ProfilePanel from '../components/ProfilePanel';
import NewChatModal from '../components/NewChatModal';
import IncomingCall from '../components/IncomingCall';
import CallScreen from '../components/CallScreen';
import { AnimatePresence } from 'framer-motion';
import { FiMenu, FiX } from 'react-icons/fi';
import toast from 'react-hot-toast';

function ChatPage() {
  const { user, logout } = useAuthStore();
  const { activeChat, setActiveChat, setContacts } = useChatStore();
  const {
    callState, callType, caller,
    setCallState, setCallType, setCaller, resetCall,
  } = useCallStore();

  const [socket, setSocket] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeChatData, setActiveChatData] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const navigate = useNavigate();

  const {
    initiateCall, answerCall, handleCallAnswered, handleIceCandidate,
    endCall, rejectCall, toggleMute, toggleCamera, flipCamera,
  } = useWebRTC(user);

  // ── Socket setup & call event handlers ──────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const sock = initializeSocket(user.id);
    setSocket(sock);
    loadContacts();

    // ── Incoming call ────────────────────────────────────────────────────
    sock.on('incoming_call', (data) => {
      const { caller_id, caller_name, caller_avatar, call_type, call_id, offer } = data;
      // If already in a call, send busy signal
      if (useCallStore.getState().callState !== 'idle') {
        sock.emit('call_reject', { caller_id, call_id, reason: 'busy' });
        return;
      }
      setCallType(call_type || 'video');
      setCaller({
        id: caller_id,
        full_name: caller_name || 'Unknown',
        avatar_url: caller_avatar || null,
      });
      setCallState('ringing');
      setIncomingCallData({ caller_id, call_type, call_id, offer });
    });

    // ── Call answered ────────────────────────────────────────────────────
    sock.on('call_answered', (data) => {
      handleCallAnswered(data);
      setCallState('active');
    });

    // ── ICE candidate ────────────────────────────────────────────────────
    sock.on('ice_candidate', (data) => {
      handleIceCandidate(data);
    });

    // ── Call rejected ────────────────────────────────────────────────────
    sock.on('call_rejected', (data) => {
      const reason = data.reason || 'declined';
      const msg = reason === 'busy' ? 'User is busy' : 'Call declined';
      toast(msg, { icon: '📵' });
      resetCall();
    });

    // ── Call ended ───────────────────────────────────────────────────────
    sock.on('call_ended', () => {
      toast('Call ended', { icon: '📞' });
      resetCall();
      setIncomingCallData(null);
    });

    // ── Message events ───────────────────────────────────────────────────
    sock.on('new_message', (msg) => {
      if (msg.sender_id === useChatStore.getState().activeChat) {
        useChatStore.getState().addMessage(msg);
      }
    });

    sock.on('typing_indicator', ({ user_id }) => {
      useChatStore.getState().setTyping(user_id, true);
      setTimeout(() => useChatStore.getState().setTyping(user_id, false), 3000);
    });

    sock.on('stop_typing_indicator', ({ user_id }) => {
      useChatStore.getState().setTyping(user_id, false);
    });

    return () => {
      sock.off('incoming_call');
      sock.off('call_answered');
      sock.off('ice_candidate');
      sock.off('call_rejected');
      sock.off('call_ended');
      sock.off('new_message');
      sock.off('typing_indicator');
      sock.off('stop_typing_indicator');
      disconnectSocket();
    };
  }, [user, navigate]);

  useEffect(() => {
    if (activeChat) loadActiveChatData();
  }, [activeChat]);

  const loadContacts = async () => {
    try {
      const response = await api.get('/contacts');
      setContacts(response.data.contacts || []);
    } catch { console.error('Failed to load contacts'); }
  };

  const loadActiveChatData = async () => {
    try {
      const response = await api.get(`/contacts/${activeChat}`);
      setActiveChatData(response.data);
    } catch { console.error('Failed to load chat data'); }
  };

  const handleLogout = () => {
    logout();
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    navigate('/login');
    toast.success('Logged out successfully');
  };

  // ── Call actions ─────────────────────────────────────────────────────────
  const handleStartCall = useCallback(async (targetUser, type) => {
    await initiateCall(targetUser, type);
  }, [initiateCall]);

  const handleAcceptCall = useCallback(async (audioOnly = false) => {
    if (!incomingCallData) return;
    const effectiveType = audioOnly ? 'audio' : incomingCallData.call_type;
    setCallType(effectiveType);
    setIncomingCallData(null);
    await answerCall({ ...incomingCallData, call_type: effectiveType });
  }, [incomingCallData, answerCall, setCallType]);

  const handleDeclineCall = useCallback(() => {
    if (!incomingCallData) return;
    rejectCall(incomingCallData.caller_id, incomingCallData.call_id);
    setIncomingCallData(null);
    setCallState('idle');
  }, [incomingCallData, rejectCall, setCallState]);

  const handleEndCall = useCallback(() => {
    const store = useCallStore.getState();
    const targetId = store.caller?.id || store.callee?.id;
    endCall(targetId, store.callId);
    setIncomingCallData(null);
  }, [endCall]);

  if (!user) return null;

  const showCallScreen = ['outgoing', 'active', 'ringing'].includes(callState) && !incomingCallData;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Left Sidebar */}
      <div className={`
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        md:translate-x-0 fixed md:relative
        w-full md:w-[400px] lg:w-[420px] h-full
        bg-white border-r border-gray-200
        transition-transform duration-300 z-40 flex flex-col
      `}>
        <button
          onClick={() => setIsMobileMenuOpen(false)}
          className="md:hidden absolute top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg"
        >
          <FiX size={24} />
        </button>
        <MainNavigation
          socket={socket}
          onChatSelect={(chatId) => { setActiveChat(chatId); setIsMobileMenuOpen(false); }}
          onNewChat={() => setShowNewChat(true)}
          onProfileClick={() => setShowProfile(true)}
          onLogout={handleLogout}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col relative">
        {activeChat ? (
          <>
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden absolute top-4 left-4 z-30 p-2 bg-white rounded-full shadow-lg"
            >
              <FiMenu size={24} />
            </button>
            <ChatWindow
              socket={socket}
              onContactInfoClick={() => setShowContactInfo(true)}
              onBack={() => { setActiveChat(null); setActiveChatData(null); }}
              onStartCall={handleStartCall}
            />
          </>
        ) : (
          <WelcomeScreen onOpenMenu={() => setIsMobileMenuOpen(true)} />
        )}
      </div>

      {/* Right Sidebar — Contact Info */}
      {showContactInfo && activeChatData && (
        <>
          <div className="hidden lg:block w-[400px] border-l border-gray-200 bg-white">
            <ContactInfo contact={activeChatData} onClose={() => setShowContactInfo(false)} />
          </div>
          <div className="lg:hidden fixed inset-0 bg-white z-50">
            <ContactInfo contact={activeChatData} onClose={() => setShowContactInfo(false)} />
          </div>
        </>
      )}

      {/* Profile Panel */}
      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}

      {/* New Chat Modal */}
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={(chatId) => { setActiveChat(chatId); setShowNewChat(false); }}
        />
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* ── INCOMING CALL OVERLAY ── */}
      <AnimatePresence>
        {incomingCallData && callState === 'ringing' && (
          <IncomingCall
            caller={caller}
            callType={callType}
            onAccept={handleAcceptCall}
            onDecline={handleDeclineCall}
          />
        )}
      </AnimatePresence>

      {/* ── ACTIVE / OUTGOING CALL SCREEN ── */}
      <AnimatePresence>
        {showCallScreen && (
          <CallScreen
            onEndCall={handleEndCall}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onFlipCamera={flipCamera}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function WelcomeScreen({ onOpenMenu }) {
  return (
    <div className="flex items-center justify-center h-full bg-[#f0f2f5]">
      <div className="text-center px-8 max-w-md">
        <div className="w-64 h-64 mx-auto mb-8 relative">
          <div className="absolute inset-0 bg-gradient-to-br from-green-400 to-teal-500 rounded-full opacity-10 animate-pulse" />
          <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center shadow-lg">
            <svg className="w-32 h-32 text-green-500" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12c0 1.54.36 3 .97 4.29L2 22l5.71-.97C9 21.64 10.46 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 18c-1.38 0-2.67-.33-3.82-.91l-.27-.16-2.84.48.48-2.84-.16-.27C4.33 14.67 4 13.38 4 12c0-4.41 3.59-8 8-8s8 3.59 8 8-3.59 8-8 8z"/>
              <path d="M17.25 14.77c-.27-.14-1.59-.78-1.84-.87-.25-.09-.43-.14-.61.14-.18.27-.7.87-.86 1.05-.16.18-.32.2-.59.07-.27-.14-1.13-.42-2.16-1.33-.8-.71-1.34-1.59-1.5-1.86-.16-.27-.02-.42.12-.56.13-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.61-1.46-.84-2-.22-.52-.45-.45-.61-.46h-.52c-.18 0-.48.07-.73.34-.25.27-.96.94-.96 2.3s.98 2.66 1.12 2.84c.14.18 1.94 2.96 4.7 4.15.66.28 1.17.45 1.57.58.66.21 1.26.18 1.74.11.53-.08 1.59-.65 1.82-1.28.23-.63.23-1.17.16-1.28-.07-.11-.25-.18-.52-.32z"/>
            </svg>
          </div>
        </div>
        <h2 className="text-3xl font-light text-gray-700 mb-3">Bitese Web</h2>
        <p className="text-gray-500 text-sm mb-2">Send and receive messages, make video and voice calls.</p>
        <p className="text-gray-400 text-xs mb-6">Your personal messages are end-to-end encrypted.</p>
        <div className="flex items-center justify-center gap-2 text-gray-400">
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
          </svg>
          <span className="text-xs">End-to-end encrypted</span>
        </div>
        <button
          onClick={onOpenMenu}
          className="md:hidden mt-6 px-6 py-3 bg-green-500 text-white rounded-full hover:bg-green-600 font-medium"
        >
          Start Messaging
        </button>
      </div>
    </div>
  );
}

export default ChatPage;
