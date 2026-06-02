import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,

  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, isAuthenticated: false }),
}));

export const useChatStore = create((set) => ({
  messages: [],
  activeChat: null,
  contacts: [],
  typing: {},
  messageStatuses: {},

  setActiveChat: (chatId) => set({ activeChat: chatId }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  setMessages: (messages) => set({ messages }),
  updateMessageStatus: (messageId, status) =>
    set((state) => ({
      messageStatuses: { ...state.messageStatuses, [messageId]: status },
    })),
  setTyping: (userId, isTyping) =>
    set((state) => ({
      typing: { ...state.typing, [userId]: isTyping },
    })),
  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => ({ contacts: [...state.contacts, contact] })),
  clearMessages: () => set({ messages: [] }),
  updateMessage: (messageId, updates) =>
    set((state) => ({
      messages: state.messages.map(m => m.id === messageId ? { ...m, ...updates } : m),
    })),
}));

export const useStatusStore = create((set) => ({
  statuses: [],
  myStatus: null,
  setStatuses: (statuses) => set({ statuses }),
  setMyStatus: (status) => set({ myStatus: status }),
  addStatus: (status) =>
    set((state) => ({ statuses: [...state.statuses, status] })),
}));

// ── Call State ────────────────────────────────────────────────────────────────
export const useCallStore = create((set) => ({
  // 'idle' | 'ringing' | 'outgoing' | 'active' | 'ended'
  callState: 'idle',
  callType: null,        // 'audio' | 'video'
  callId: null,
  caller: null,          // { id, name, avatar }
  callee: null,          // { id, name, avatar }
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isCameraOff: false,
  isSpeakerOn: true,
  callDuration: 0,
  callError: null,

  setCallState: (callState) => set({ callState }),
  setCallType: (callType) => set({ callType }),
  setCallId: (callId) => set({ callId }),
  setCaller: (caller) => set({ caller }),
  setCallee: (callee) => set({ callee }),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  setMuted: (isMuted) => set({ isMuted }),
  setCameraOff: (isCameraOff) => set({ isCameraOff }),
  setSpeakerOn: (isSpeakerOn) => set({ isSpeakerOn }),
  setCallDuration: (callDuration) => set({ callDuration }),
  setCallError: (callError) => set({ callError }),

  resetCall: () => set({
    callState: 'idle',
    callType: null,
    callId: null,
    caller: null,
    callee: null,
    localStream: null,
    remoteStream: null,
    isMuted: false,
    isCameraOff: false,
    isSpeakerOn: true,
    callDuration: 0,
    callError: null,
  }),
}));
