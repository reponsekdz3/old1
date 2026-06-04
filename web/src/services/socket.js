/**
 * Advanced Socket Service with Offline Support
 * Handles real-time communication with reconnection and message queuing
 */
import { io } from 'socket.io-client';
import offlineManager from './offlineManager';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || window.location.origin;

let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const messageQueue = [];
const eventListeners = new Map();

export const initializeSocket = (userId) => {
  if (socket && socket.connected) return socket;

  if (!socket) {
    const token = localStorage.getItem('access_token');
    
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      timeout: 15000,
      auth: token ? { token } : {},
      forceNew: false,
      multiplex: true,
    });

    setupSocketListeners(userId);
  }

  return socket;
};

function setupSocketListeners(userId) {
  socket.on('connect', async () => {
    console.log('[Socket] Connected:', socket.id);
    reconnectAttempts = 0;
    
    socket.emit('user_connect', { user_id: userId });

    // Process queued messages
    await processMessageQueue();
    
    // Trigger offline queue sync
    if (offlineManager.isOnline) {
      offlineManager.syncQueue();
    }

    notifyListeners('connection_status', { connected: true });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
    notifyListeners('connection_status', { connected: false, reason });

    if (reason === 'io server disconnect') {
      socket.connect();
    }
  });

  socket.on('reconnect', (attemptNumber) => {
    console.log('[Socket] Reconnected after', attemptNumber, 'attempts');
    notifyListeners('reconnected', { attempts: attemptNumber });
  });

  socket.on('reconnect_attempt', (attemptNumber) => {
    reconnectAttempts = attemptNumber;
    console.log('[Socket] Reconnection attempt:', attemptNumber);
    
    if (attemptNumber >= MAX_RECONNECT_ATTEMPTS) {
      console.warn('[Socket] Max reconnection attempts reached');
      notifyListeners('reconnect_failed', { attempts: attemptNumber });
    }
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    notifyListeners('connection_error', { error: err.message });
  });

  socket.on('error', (err) => {
    console.error('[Socket] Socket error:', err);
    notifyListeners('error', { error: err });
  });

  // Message events
  socket.on('new_message', async (data) => {
    console.log('[Socket] New message received');
    
    // Cache message
    if (data.sender_id && data.receiver_id) {
      const chatId = data.sender_id === userId ? data.receiver_id : data.sender_id;
      await offlineManager.saveMessage(chatId, data);
    }
    
    notifyListeners('new_message', data);
  });

  socket.on('message_sent', (data) => {
    console.log('[Socket] Message sent confirmation');
    notifyListeners('message_sent', data);
  });

  socket.on('delivery_confirmation', (data) => {
    notifyListeners('message_delivered', data);
  });

  socket.on('read_confirmation', (data) => {
    notifyListeners('message_read', data);
  });

  socket.on('typing_indicator', (data) => {
    notifyListeners('typing', data);
  });

  socket.on('stop_typing_indicator', (data) => {
    notifyListeners('stop_typing', data);
  });

  // Call events
  socket.on('incoming_call', (data) => {
    console.log('[Socket] Incoming call');
    notifyListeners('incoming_call', data);
  });

  socket.on('call_answered', (data) => {
    notifyListeners('call_answered', data);
  });

  socket.on('call_rejected', (data) => {
    notifyListeners('call_rejected', data);
  });

  socket.on('call_ended', (data) => {
    notifyListeners('call_ended', data);
  });

  socket.on('ice_candidate', (data) => {
    notifyListeners('ice_candidate', data);
  });

  // Group events
  socket.on('new_group_message', async (data) => {
    console.log('[Socket] New group message');
    
    if (data.group_id) {
      await offlineManager.saveMessage(`group_${data.group_id}`, data);
    }
    
    notifyListeners('new_group_message', data);
  });

  socket.on('user_status_changed', (data) => {
    notifyListeners('user_status', data);
  });

  socket.on('reaction_added', (data) => {
    notifyListeners('reaction_added', data);
  });

  socket.on('message_deleted_notification', (data) => {
    notifyListeners('message_deleted', data);
  });

  socket.on('message_edited_notification', (data) => {
    notifyListeners('message_edited', data);
  });
}

function notifyListeners(event, data) {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.forEach(callback => {
      try {
        callback(data);
      } catch (err) {
        console.error('[Socket] Listener error:', err);
      }
    });
  }
}

async function processMessageQueue() {
  if (messageQueue.length === 0) return;

  console.log('[Socket] Processing', messageQueue.length, 'queued messages');

  while (messageQueue.length > 0) {
    const { event, data, resolve, reject } = messageQueue.shift();
    
    try {
      if (socket && socket.connected) {
        socket.emit(event, data);
        resolve();
      } else {
        reject(new Error('Socket not connected'));
      }
    } catch (err) {
      console.error('[Socket] Failed to send queued message:', err);
      reject(err);
    }
  }
}

export const emitWithQueue = (event, data) => {
  return new Promise((resolve, reject) => {
    if (socket && socket.connected) {
      try {
        socket.emit(event, data);
        resolve();
      } catch (err) {
        reject(err);
      }
    } else {
      console.log('[Socket] Queuing message:', event);
      messageQueue.push({ event, data, resolve, reject });
      
      // Add to offline queue
      offlineManager.addToQueue(event, data, 'normal');
    }
  });
};

export const addEventListener = (event, callback) => {
  if (!eventListeners.has(event)) {
    eventListeners.set(event, new Set());
  }
  eventListeners.get(event).add(callback);

  return () => {
    const listeners = eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  };
};

export const removeEventListener = (event, callback) => {
  const listeners = eventListeners.get(event);
  if (listeners) {
    listeners.delete(callback);
  }
};

export const removeAllListeners = (event) => {
  if (event) {
    eventListeners.delete(event);
  } else {
    eventListeners.clear();
  }
};

export const getSocket = () => socket;

export const isConnected = () => socket && socket.connected;

export const getConnectionStatus = () => ({
  connected: socket && socket.connected,
  reconnecting: reconnectAttempts > 0,
  attempts: reconnectAttempts,
  queuedMessages: messageQueue.length,
});

export const disconnectSocket = () => {
  if (socket) {
    removeAllListeners();
    socket.off();
    socket.disconnect();
    socket = null;
    console.log('[Socket] Disconnected and cleaned up');
  }
};

export const reconnectSocket = (userId) => {
  if (socket) {
    socket.connect();
  } else {
    initializeSocket(userId);
  }
};

