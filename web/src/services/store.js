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

// ── 1-to-1 Call State ─────────────────────────────────────────────────────────
export const useCallStore = create((set) => ({
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

// ── Group Call State ──────────────────────────────────────────────────────────
export const useGroupCallStore = create((set) => ({
  // 'idle' | 'incoming' | 'active'
  groupCallState: 'idle',
  groupCallId: null,
  groupCallType: null,
  groupId: null,
  groupName: null,
  initiatorId: null,
  initiatorName: null,
  initiatorAvatar: null,
  callDuration: 0,
  incomingGroupCallData: null,

  setGroupCallState: (groupCallState) => set({ groupCallState }),
  setGroupCallId: (groupCallId) => set({ groupCallId }),
  setGroupCallType: (groupCallType) => set({ groupCallType }),
  setGroupInfo: ({ groupId, groupName }) => set({ groupId, groupName }),
  setInitiator: ({ initiatorId, initiatorName, initiatorAvatar }) =>
    set({ initiatorId, initiatorName, initiatorAvatar }),
  setCallDuration: (callDuration) => set({ callDuration }),
  setIncomingGroupCallData: (data) => set({ incomingGroupCallData: data }),

  resetGroupCall: () => set({
    groupCallState: 'idle',
    groupCallId: null,
    groupCallType: null,
    groupId: null,
    groupName: null,
    initiatorId: null,
    initiatorName: null,
    initiatorAvatar: null,
    callDuration: 0,
    incomingGroupCallData: null,
  }),
}));
