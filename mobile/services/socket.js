import { io } from 'socket.io-client';
import { SOCKET_URL } from '../config';

let socket = null;

export const initializeSocket = async (userId) => {
  if (socket && socket.connected) return socket;

  const { TokenStorage } = await import('./storage');
  const token = await TokenStorage.getAccessToken();

  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
      transports: ['websocket', 'polling'],
      timeout: 10000,
      auth: token ? { token } : {},
    });
  }

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    if (userId) socket.emit('user_connect', { user_id: userId });
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.off();
    socket.disconnect();
    socket = null;
  }
};
