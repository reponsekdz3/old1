import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, useChatStore, useCallStore, useGroupCallStore } from '../services/store';
import { initializeSocket, disconnectSocket } from '../services/socket';
import { useWebRTC } from '../hooks/useWebRTC';
import { useGroupWebRTC } from '../hooks/useGroupWebRTC';
import api from '../services/api';
import MainNavigation from '../components/MainNavigation';
import ChatWindow from '../components/ChatWindow';
import ContactInfo from '../components/ContactInfo';
import ProfilePanel from '../components/ProfilePanel';
import NewChatModal from '../components/NewChatModal';
import IncomingCall from '../components/IncomingCall';
import CallScreen from '../components/CallScreen';
import GroupCallScreen from '../components/GroupCallScreen';
import { AnimatePresence, motion } from 'framer-motion';
import { FiMenu, FiX, FiPhone, FiVideo, FiPhoneOff } from 'react-icons/fi';
import toast from 'react-hot-toast';

function ChatPage() {
  const { user, logout } = useAuthStore();
  const { activeChat, setActiveChat, setContacts } = useChatStore();
  const {
    callState, callType, caller,
    setCallState, setCallType, setCaller, resetCall,
  } = useCallStore();
  const {
    groupCallState, groupCallId, groupCallType, groupName,
    setGroupCallState, setGroupCallId, setGroupCallType,
    setGroupInfo, setInitiator, setCallDuration: setGroupCallDuration,
    setIncomingGroupCallData, incomingGroupCallData,
    resetGroupCall,
  } = useGroupCallStore();

  const [socket, setSocket] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeChatData, setActiveChatData] = useState(null);
  const [incomingCallData, setIncomingCallData] = useState(null);
  const groupCallDurationRef = useRef(null);
  const navigate = useNavigate();

  const {
    initiateCall, answerCall, handleCallAnswered, handleIceCandidate,
    endCall, rejectCall, toggleMute, toggleCamera, flipCamera,
  } = useWebRTC(user);

  const {
    localStream: groupLocalStream,
    remoteStreams,
    participants: groupParticipants,
    isMuted: groupIsMuted,
    isCameraOff: groupIsCameraOff,
    callActive: groupCallActive,
    initiateGroupCall,
    joinGroupCall,
    handleGroupOffer,
    handleGroupAnswer,
    handleGroupIce,
    handleUserJoined,
    handleUserLeft,
    toggleMute: groupToggleMute,
    toggleCamera: groupToggleCamera,
    leaveGroupCall,
    cleanupGroupCall,
  } = useGroupWebRTC(user);

  // ── Socket setup & call event handlers ──────────────────────────────────
  useEffect(() => {
    if (!user) { navigate('/login'); return; }

    const sock = initializeSocket(user.id);
    setSocket(sock);
    loadContacts();

    // ── 1-to-1: Incoming call ────────────────────────────────────────────
    sock.on('incoming_call', (data) => {
      const { caller_id, caller_name, caller_avatar, call_type, call_id, offer } = data;
      if (useCallStore.getState().callState !== 'idle') {
        sock.emit('call_reject', { caller_id, call_id, reason: 'busy' });
        return;
      }
      setCallType(call_type || 'video');
      setCaller({ id: caller_id, full_name: caller_name || 'Unknown', avatar_url: caller_avatar || null });
      setCallState('ringing');
      setIncomingCallData({ caller_id, call_type, call_id, offer });
    });

    sock.on('call_answered', (data) => {
      handleCallAnswered(data);
      setCallState('active');
    });

    sock.on('ice_candidate', (data) => { handleIceCandidate(data); });

    sock.on('call_rejected', (data) => {
      toast(data.reason === 'busy' ? 'User is busy' : 'Call declined', { icon: '📵' });
      resetCall();
    });

    sock.on('call_ended', () => {
      toast('Call ended', { icon: '📞' });
      resetCall();
      setIncomingCallData(null);
    });

    // ── Group call events ─────────────────────────────────────────────────
    sock.on('group_incoming_call', (data) => {
      const { group_id: gId, group_name: gName, initiator_id, initiator_name, initiator_avatar, call_type, call_id } = data;
      if (useGroupCallStore.getState().groupCallState !== 'idle') return;
      setGroupCallState('incoming');
      setGroupCallId(call_id);
      setGroupCallType(call_type || 'video');
      setGroupInfo({ groupId: gId, groupName: gName });
      setInitiator({ initiatorId: initiator_id, initiatorName: initiator_name, initiatorAvatar: initiator_avatar });
      setIncomingGroupCallData(data);
    });

    sock.on('group_call_user_joined', (data) => { handleUserJoined(data); });
    sock.on('group_call_user_left', (data) => { handleUserLeft(data); });

    sock.on('group_call_offer', async (data) => {
      await handleGroupOffer(data);
    });

    sock.on('group_call_answer', async (data) => {
      await handleGroupAnswer(data);
    });

    sock.on('group_ice_candidate', async (data) => {
      await handleGroupIce(data);
    });

    sock.on('group_call_rejected', () => {});

    // ── Message events ────────────────────────────────────────────────────
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
      sock.off('group_incoming_call');
      sock.off('group_call_user_joined');
      sock.off('group_call_user_left');
      sock.off('group_call_offer');
      sock.off('group_call_answer');
      sock.off('group_ice_candidate');
      sock.off('new_message');
      sock.off('typing_indicator');
      sock.off('stop_typing_indicator');
      disconnectSocket();
    };
  }, [user, navigate]);

  // ── Group call duration timer ─────────────────────────────────────────
  useEffect(() => {
    if (groupCallActive) {
      let secs = 0;
      groupCallDurationRef.current = setInterval(() => {
        secs++;
        setGroupCallDuration(secs);
      }, 1000);
    }
    return () => { clearInterval(groupCallDurationRef.current); };
  }, [groupCallActive, setGroupCallDuration]);

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

  // ── 1-to-1 call actions ──────────────────────────────────────────────────
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

  // ── Group call actions ────────────────────────────────────────────────────
  const handleStartGroupCall = useCallback(async (groupId, gName, callType = 'video') => {
    try {
      setGroupInfo({ groupId, groupName: gName });
      setGroupCallType(callType);
      const callId = await initiateGroupCall(groupId, gName, callType);
      setGroupCallState('active');
      setGroupCallId(callId);
    } catch (err) {
      toast.error('Could not start group call');
    }
  }, [initiateGroupCall, setGroupInfo, setGroupCallType, setGroupCallState, setGroupCallId]);

  const handleAcceptGroupCall = useCallback(async () => {
    if (!incomingGroupCallData) return;
    const { call_id, call_type } = incomingGroupCallData;
    setGroupCallState('active');
    setIncomingGroupCallData(null);
    try {
      await joinGroupCall(call_id, call_type, []);
    } catch {
      toast.error('Could not join group call');
      resetGroupCall();
      cleanupGroupCall();
    }
  }, [incomingGroupCallData, joinGroupCall, setGroupCallState, setIncomingGroupCallData, resetGroupCall, cleanupGroupCall]);

  const handleDeclineGroupCall = useCallback(() => {
    const data = incomingGroupCallData;
    if (!data) return;
    if (socket) {
      socket.emit('group_call_reject', {
        initiator_id: data.initiator_id,
        user_id: user.id,
        user_name: user.full_name,
        call_id: data.call_id,
      });
    }
    setIncomingGroupCallData(null);
    resetGroupCall();
  }, [incomingGroupCallData, socket, user, setIncomingGroupCallData, resetGroupCall]);

  const handleLeaveGroupCall = useCallback(() => {
    leaveGroupCall(groupCallId);
    resetGroupCall();
    clearInterval(groupCallDurationRef.current);
  }, [leaveGroupCall, groupCallId, resetGroupCall]);

  if (!user) return null;

  const showCallScreen = ['outgoing', 'active', 'ringing'].includes(callState) && !incomingCallData;

  return (
    <div className="flex h-screen bg-[#f0f2f5] overflow-hidden">
      {/* Three-pane layout */}
      <div className="flex w-full h-full">
        
        {/* Pane 1: Left Icon Rail + Content Panel (Sidebar) */}
        <motion.div
          initial={false}
          animate={{ x: 0 }}
          className={`
            fixed md:relative z-40
            ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            w-full md:w-[420px] lg:w-[450px] h-full
            flex-shrink-0 flex
            transition-transform duration-300 ease-in-out
          `}
        >
          <div className="flex-1 h-full shadow-2xl md:shadow-none border-r border-gray-200">
            <MainNavigation
              socket={socket}
              onChatSelect={(chatId) => { setActiveChat(chatId); setIsMobileMenuOpen(false); }}
              onNewChat={() => setShowNewChat(true)}
              onProfileClick={() => setShowProfile(true)}
              onLogout={handleLogout}
              onStartGroupCall={handleStartGroupCall}
            />
          </div>
          
          {/* Mobile close button */}
          <button
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden absolute top-4 right-4 z-50 p-2 bg-white rounded-full shadow-lg"
          >
            <FiX size={24} />
          </button>
        </motion.div>

        {/* Pane 2: Main Chat Area */}
        <div className="flex-1 flex flex-col relative bg-[#f0f2f5] min-w-0">
          <AnimatePresence mode="wait">
            {activeChat ? (
              <motion.div
                key={activeChat}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.2 }}
                className="h-full w-full flex flex-col"
              >
                <ChatWindow
                  socket={socket}
                  onContactInfoClick={() => setShowContactInfo(v => !v)}
                  onBack={() => { setActiveChat(null); setActiveChatData(null); }}
                  onStartCall={handleStartCall}
                  onStartGroupCall={handleStartGroupCall}
                />
              </motion.div>
            ) : (
              <motion.div
                key="welcome"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full w-full"
              >
                <WelcomeScreen onOpenMenu={() => setIsMobileMenuOpen(true)} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Pane 3: Contact Info (Right Panel) */}
        <AnimatePresence>
          {showContactInfo && activeChatData && (
            <motion.div
              initial={{ x: 400, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 400, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="hidden lg:block w-[400px] border-l border-gray-200 bg-white z-20 h-full flex-shrink-0"
            >
              <ContactInfo contact={activeChatData} onClose={() => setShowContactInfo(false)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Right Sidebar Modal */}
      <AnimatePresence>
        {showContactInfo && activeChatData && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.3 }}
            className="lg:hidden fixed inset-0 bg-white z-[60]"
          >
            <ContactInfo contact={activeChatData} onClose={() => setShowContactInfo(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overlays & Modals */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 bg-black/40 backdrop-blur-[2px] z-30"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {showProfile && <ProfilePanel onClose={() => setShowProfile(false)} />}
      
      {showNewChat && (
        <NewChatModal
          onClose={() => setShowNewChat(false)}
          onChatCreated={(chatId) => { setActiveChat(chatId); setShowNewChat(false); }}
        />
      )}

      {/* Call Screens */}
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

      <AnimatePresence>
        {groupCallState === 'incoming' && incomingGroupCallData && (
          <IncomingGroupCall
            data={incomingGroupCallData}
            onAccept={handleAcceptGroupCall}
            onDecline={handleDeclineGroupCall}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(groupCallState === 'active' || groupCallActive) && (
          <GroupCallScreen
            localStream={groupLocalStream}
            remoteStreams={remoteStreams}
            participants={groupParticipants}
            groupName={groupName}
            callType={groupCallType}
            isMuted={groupIsMuted}
            isCameraOff={groupIsCameraOff}
            callDuration={useGroupCallStore.getState().callDuration}
            onToggleMute={groupToggleMute}
            onToggleCamera={groupToggleCamera}
            onLeave={handleLeaveGroupCall}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Incoming Group Call Notification ─────────────────────────────────────────
function IncomingGroupCall({ data, onAccept, onDecline }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -60 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 rounded-3xl shadow-2xl px-5 py-4 flex items-center gap-4 min-w-[320px] border border-white/10"
    >
      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
        {data.initiator_name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold truncate">{data.group_name || 'Group Call'}</p>
        <p className="text-white/50 text-sm">{data.initiator_name} · {data.call_type === 'video' ? 'Video' : 'Voice'} call</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onDecline}
          className="w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition">
          <FiPhoneOff size={18} className="text-white" />
        </button>
        <button onClick={onAccept}
          className="w-10 h-10 bg-[#25D366] hover:bg-[#1fbd5a] rounded-full flex items-center justify-center transition">
          {data.call_type === 'video' ? <FiVideo size={18} className="text-white" /> : <FiPhone size={18} className="text-white" />}
        </button>
      </div>
    </motion.div>
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
        <h2 className="text-3xl font-light text-gray-700 mb-3">VipChat Web</h2>
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
