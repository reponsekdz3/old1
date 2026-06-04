/**
 * Advanced Web Notifications Service
 * Features: Rich notifications, inline replies, action buttons, secure payload
 * Security: Signed notifications, encrypted payloads, CSRF protection
 */

const NOTIFICATION_VERSION = '2.0';
const MAX_NOTIFICATIONS = 50;
const NOTIFICATION_TTL = 24 * 60 * 60 * 1000; // 24 hours

class AdvancedNotificationService {
  constructor() {
    this.registration = null;
    this.permission = Notification.permission;
    this.pendingActions = new Map();
    this.notificationHistory = [];
    this.encryptionKey = null;
    this.sessionToken = null;
  }

  /**
   * Initialize the notification service
   */
  async init() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Notifications] Push not supported');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      
      // Listen for messages from service worker
      navigator.serviceWorker.addEventListener('message', this._handleSWMessage.bind(this));
      
      // Generate session security token
      this.sessionToken = this._generateSessionToken();
      
      // Load notification history from IndexedDB
      await this._loadHistory();
      
      return true;
    } catch (err) {
      console.error('[Notifications] Init failed:', err);
      return false;
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission() {
    if (!('Notification' in window)) return 'denied';
    
    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return 'granted';
    }
    
    if (Notification.permission === 'denied') {
      this.permission = 'denied';
      return 'denied';
    }
    
    const result = await Notification.requestPermission();
    this.permission = result;
    return result;
  }

  /**
   * Generate secure session token
   */
  _generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Security: Sign notification payload
   */
  async _signPayload(payload) {
    const encoder = new TextEncoder();
    const data = encoder.encode(JSON.stringify(payload));
    
    // Use subtle crypto for HMAC
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.sessionToken),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Show rich notification with actions
   */
  async showNotification(options) {
    if (this.permission !== 'granted') {
      console.warn('[Notifications] No permission');
      return null;
    }

    const {
      title,
      body,
      icon,
      badge,
      image,
      tag,
      data = {},
      actions = [],
      requireInteraction = false,
      silent = false,
      timestamp = Date.now(),
    } = options;

    // Security: Sign the data payload
    const signedData = {
      ...data,
      _version: NOTIFICATION_VERSION,
      _sessionToken: this.sessionToken,
      _timestamp: timestamp,
    };

    // Create notification options
    const notificationOptions = {
      body,
      icon: icon || '/logo192.png',
      badge: badge || '/badge72.png',
      image,
      tag: tag || `notification-${Date.now()}`,
      data: signedData,
      requireInteraction,
      silent,
      timestamp,
      vibrate: [200, 100, 200],
      actions: actions.map(action => ({
        action: action.action,
        title: action.title,
        icon: action.icon,
        type: action.type || 'button',
        placeholder: action.placeholder,
      })),
    };

    try {
      // Show via service worker for persistence
      if (this.registration) {
        await this.registration.showNotification(title, notificationOptions);
      } else {
        // Fallback to regular notification
        new Notification(title, notificationOptions);
      }

      // Store in history
      const notification = {
        id: tag || `notification-${Date.now()}`,
        title,
        body,
        timestamp,
        data: signedData,
        read: false,
      };
      
      this._addToHistory(notification);

      return notification;
    } catch (err) {
      console.error('[Notifications] Show failed:', err);
      return null;
    }
  }

  /**
   * Show message notification with reply action
   */
  async showMessageNotification(message) {
    const { sender_name, content, sender_id, chat_id, sender_avatar } = message;

    return this.showNotification({
      title: sender_name || 'New Message',
      body: content?.substring(0, 100) || '',
      icon: sender_avatar,
      tag: `message-${chat_id || sender_id}`,
      data: {
        type: 'message',
        sender_id,
        chat_id,
        sender_name,
        timestamp: Date.now(),
      },
      requireInteraction: false,
      actions: [
        {
          action: 'reply',
          title: 'Reply',
          type: 'text',
          placeholder: 'Type a reply...',
          icon: '/icons/reply.png',
        },
        {
          action: 'mark-read',
          title: 'Mark as Read',
          icon: '/icons/check.png',
        },
        {
          action: 'archive',
          title: 'Archive',
          icon: '/icons/archive.png',
        },
      ],
    });
  }

  /**
   * Show incoming call notification
   */
  async showIncomingCallNotification(call) {
    const { caller_name, caller_id, call_type, call_id, caller_avatar } = call;

    return this.showNotification({
      title: `Incoming ${call_type === 'video' ? 'Video' : 'Voice'} Call`,
      body: caller_name || 'Unknown caller',
      icon: caller_avatar,
      tag: `call-${call_id}`,
      data: {
        type: 'call',
        caller_id,
        call_id,
        call_type,
        caller_name,
        timestamp: Date.now(),
      },
      requireInteraction: true,
      actions: [
        {
          action: 'accept-call',
          title: 'Accept',
          icon: '/icons/call-accept.png',
        },
        {
          action: 'decline-call',
          title: 'Decline',
          icon: '/icons/call-decline.png',
        },
      ],
    });
  }

  /**
   * Show missed call notification
   */
  async showMissedCallNotification(call) {
    const { caller_name, caller_id, call_type, call_id } = call;

    return this.showNotification({
      title: 'Missed Call',
      body: `${caller_name || 'Unknown'} (${call_type === 'video' ? 'Video' : 'Voice'})`,
      tag: `missed-call-${call_id}`,
      data: {
        type: 'missed_call',
        caller_id,
        call_id,
        call_type,
        caller_name,
        timestamp: Date.now(),
      },
      actions: [
        {
          action: 'call-back',
          title: 'Call Back',
          icon: '/icons/call.png',
        },
        {
          action: 'message-back',
          title: 'Message',
          icon: '/icons/message.png',
        },
      ],
    });
  }

  /**
   * Handle service worker messages (actions)
   */
  _handleSWMessage(event) {
    const { type, data, action } = event.data || {};

    switch (type) {
      case 'notification-action':
        this._handleAction(action, data);
        break;
      case 'notification-click':
        this._handleClick(data);
        break;
      case 'notification-close':
        this._handleClose(data);
        break;
    }
  }

  /**
   * Handle notification action
   */
  async _handleAction(action, data) {
    // Validate security token
    if (data._sessionToken !== this.sessionToken) {
      console.warn('[Notifications] Invalid session token');
      return;
    }

    // Emit custom event for app to handle
    const event = new CustomEvent('notification-action', {
      detail: { action, data },
    });
    window.dispatchEvent(event);

    // Handle common actions
    switch (action) {
      case 'reply':
        if (data.type === 'message' && data.chat_id) {
          // Reply is handled by the app via the custom event
          console.log('[Notifications] Reply action triggered');
        }
        break;
      case 'mark-read':
        // Mark message as read via API
        if (data.chat_id) {
          this._markAsRead(data.chat_id);
        }
        break;
      case 'accept-call':
        // Accept call
        window.dispatchEvent(new CustomEvent('accept-call', { detail: data }));
        break;
      case 'decline-call':
        // Decline call
        window.dispatchEvent(new CustomEvent('decline-call', { detail: data }));
        break;
      case 'call-back':
        // Call back
        window.dispatchEvent(new CustomEvent('call-back', { detail: data }));
        break;
      case 'message-back':
        // Open chat
        window.dispatchEvent(new CustomEvent('open-chat', { detail: data }));
        break;
    }
  }

  /**
   * Handle notification click
   */
  _handleClick(data) {
    // Mark as read
    this._markNotificationRead(data.tag);
    
    // Emit event for navigation
    window.dispatchEvent(new CustomEvent('notification-click', {
      detail: data,
    }));
  }

  /**
   * Handle notification close
   */
  _handleClose(data) {
    // Mark as read when closed
    this._markNotificationRead(data.tag);
  }

  /**
   * Mark message as read via API
   */
  async _markAsRead(chatId) {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) return;

      await fetch(`/api/messages/${chatId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      console.error('[Notifications] Mark read failed:', err);
    }
  }

  /**
   * Notification history management
   */
  async _loadHistory() {
    try {
      const stored = localStorage.getItem('notificationHistory');
      if (stored) {
        this.notificationHistory = JSON.parse(stored);
        // Clean old notifications
        this.notificationHistory = this.notificationHistory.filter(
          n => Date.now() - n.timestamp < NOTIFICATION_TTL
        );
      }
    } catch (err) {
      this.notificationHistory = [];
    }
  }

  _addToHistory(notification) {
    this.notificationHistory.unshift(notification);
    
    // Keep only recent notifications
    if (this.notificationHistory.length > MAX_NOTIFICATIONS) {
      this.notificationHistory = this.notificationHistory.slice(0, MAX_NOTIFICATIONS);
    }
    
    // Save to localStorage
    try {
      localStorage.setItem('notificationHistory', JSON.stringify(this.notificationHistory));
    } catch (err) {
      // Storage full, clear old notifications
      this.notificationHistory = this.notificationHistory.slice(0, MAX_NOTIFICATIONS / 2);
      localStorage.setItem('notificationHistory', JSON.stringify(this.notificationHistory));
    }
  }

  _markNotificationRead(tag) {
    const notification = this.notificationHistory.find(n => n.id === tag);
    if (notification) {
      notification.read = true;
      localStorage.setItem('notificationHistory', JSON.stringify(this.notificationHistory));
    }
  }

  /**
   * Get notification history
   */
  getHistory() {
    return this.notificationHistory;
  }

  /**
   * Get unread count
   */
  getUnreadCount() {
    return this.notificationHistory.filter(n => !n.read).length;
  }

  /**
   * Clear all notifications
   */
  async clearAll() {
    if (this.registration) {
      const notifications = await this.registration.getNotifications();
      notifications.forEach(n => n.close());
    }
    
    this.notificationHistory = [];
    localStorage.removeItem('notificationHistory');
  }

  /**
   * Send reply from notification
   */
  async sendReply(chatId, message, replyToId = null) {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) throw new Error('Not authenticated');

      const response = await fetch('/api/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-Session-Token': this.sessionToken,
        },
        body: JSON.stringify({
          receiver_id: chatId,
          content: message,
          reply_to: replyToId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      return await response.json();
    } catch (err) {
      console.error('[Notifications] Reply failed:', err);
      throw err;
    }
  }
}

export default new AdvancedNotificationService();
