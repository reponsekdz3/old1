import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null, isAuthenticated: false }),
  updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
}));

export const useChatStore = create((set) => ({
  messages: {},
  contacts: [],
  activeChat: null,
  typing: {},
  unreadCounts: {},

  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) => set((state) => ({
    contacts: state.contacts.find(c => c.id === contact.id)
      ? state.contacts.map(c => c.id === contact.id ? contact : c)
      : [contact, ...state.contacts],
  })),

  setActiveChat: (chatId) => set({ activeChat: chatId }),

  setMessages: (chatId, msgs) => set((state) => ({
    messages: { ...state.messages, [chatId]: msgs },
  })),
  addMessage: (chatId, msg) => set((state) => {
    const prev = state.messages[chatId] || [];
    const exists = prev.find(m => m.id === msg.id);
    return {
      messages: {
        ...state.messages,
        [chatId]: exists ? prev.map(m => m.id === msg.id ? { ...m, ...msg } : m) : [...prev, msg],
      },
    };
  }),
  updateMessage: (chatId, msgId, updates) => set((state) => ({
    messages: {
      ...state.messages,
      [chatId]: (state.messages[chatId] || []).map(m =>
        m.id === msgId ? { ...m, ...updates } : m
      ),
    },
  })),
  removeMessage: (chatId, msgId) => set((state) => ({
    messages: {
      ...state.messages,
      [chatId]: (state.messages[chatId] || []).filter(m => m.id !== msgId),
    },
  })),

  setTyping: (chatId, userId, isTyping) => set((state) => ({
    typing: { ...state.typing, [`${chatId}:${userId}`]: isTyping },
  })),

  setUnread: (chatId, count) => set((state) => ({
    unreadCounts: { ...state.unreadCounts, [chatId]: count },
  })),
  clearUnread: (chatId) => set((state) => ({
    unreadCounts: { ...state.unreadCounts, [chatId]: 0 },
  })),

  updateContactLastMessage: (chatId, lastMsg, time) => set((state) => ({
    contacts: state.contacts.map(c =>
      (c.contact_user_id === chatId || c.id === chatId)
        ? { ...c, lastMessage: lastMsg, lastMessageTime: time }
        : c
    ),
  })),

  clearMessages: (chatId) => set((state) => {
    const msgs = { ...state.messages };
    delete msgs[chatId];
    return { messages: msgs };
  }),
}));

export const useStatusStore = create((set) => ({
  statuses: [],
  myStatuses: [],
  setStatuses: (statuses) => set({ statuses }),
  setMyStatuses: (myStatuses) => set({ myStatuses }),
}));

export const useCallStore = create((set) => ({
  callHistory: [],
  setCallHistory: (callHistory) => set({ callHistory }),
  addCall: (call) => set((state) => ({ callHistory: [call, ...state.callHistory] })),
}));
