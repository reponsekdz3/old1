import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore, useChatStore } from '../services/store';
import api from '../services/api';
import { FiSend, FiSmile, FiMoreVertical, FiPhone, FiVideo, FiMic } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import EmojiPicker from './EmojiPicker';
import { motion } from 'framer-motion';

function ChatWindow({ socket }) {
  const { user } = useAuthStore();
  const { messages, activeChat, setMessages, addMessage, typing } = useChatStore();
  const [messageText, setMessageText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [contact, setContact] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (activeChat) {
      loadChatHistory();
      loadContactInfo();
    }
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/messages/chat/${activeChat}`);
      setMessages(response.data.messages);
    } catch (error) {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadContactInfo = async () => {
    try {
      const response = await api.get(`/contacts/${activeChat}`);
      setContact(response.data);
    } catch (error) {
      console.error('Failed to load contact:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();

    if (!messageText.trim()) return;

    try {
      const response = await api.post(`/messages/${activeChat}`, {
        content: messageText,
      });

      const messageData = response.data;
      addMessage(messageData);

      if (socket) {
        socket.emit('message', {
          sender_id: user.id,
          receiver_id: activeChat,
          content: messageText,
          message_id: messageData.id,
          timestamp: new Date().toISOString(),
        });
      }

      setMessageText('');
      setShowEmoji(false);
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  const handleTyping = () => {
    if (socket) {
      socket.emit('typing', {
        user_id: user.id,
        receiver_id: activeChat,
      });

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('stop_typing', {
          user_id: user.id,
          receiver_id: activeChat,
        });
      }, 1000);
    }
  };

  if (!contact) {
    return (
      <div className="flex items-center justify-center h-full bg-gradient-to-br from-gray-50 to-gray-100">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity }}>
          <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-white">
      {/* Chat Header */}
      <motion.div
        initial={{ y: -10 }}
        animate={{ y: 0 }}
        className="bg-white border-b border-gray-200 px-4 md:px-6 py-4 flex items-center justify-between shadow-sm"
      >
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Avatar */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0"
          >
            {contact.contact_name?.[0] || '?'}
          </motion.div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-gray-900 truncate text-lg">
              {contact.contact_name || contact.phone_number}
            </h3>
            <motion.p className="text-sm text-gray-500">
              {typing[activeChat] ? (
                <span className="text-green-500 font-medium">typing...</span>
              ) : isOnline ? (
                <span>Active now</span>
              ) : (
                <span>Offline</span>
              )}
            </motion.p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 hover:bg-gray-100 rounded-full transition"
            title="Voice call"
          >
            <FiPhone className="text-green-600" size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 hover:bg-gray-100 rounded-full transition"
            title="Video call"
          >
            <FiVideo className="text-green-600" size={20} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="p-2.5 hover:bg-gray-100 rounded-full transition"
          >
            <FiMoreVertical className="text-gray-600" size={20} />
          </motion.button>
        </div>
      </motion.div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 scroll-smooth">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="w-12 h-12 border-4 border-green-200 border-t-green-500 rounded-full" />
            </motion.div>
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center h-full text-gray-400"
          >
            <div className="text-6xl mb-4">💬</div>
            <p className="text-lg font-medium">No messages yet</p>
            <p className="text-sm">Start a conversation!</p>
          </motion.div>
        ) : (
          messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={`flex ${message.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl shadow-sm transition ${
                  message.sender_id === user.id
                    ? 'bg-gradient-to-br from-green-500 to-teal-500 text-white rounded-br-none'
                    : 'bg-white text-gray-900 border border-gray-200 rounded-bl-none'
                }`}
              >
                {/* Message Content */}
                <p className="break-words text-sm md:text-base leading-relaxed">
                  {message.content}
                </p>

                {/* Timestamp & Status */}
                <div className="flex items-center justify-end gap-2 mt-2">
                  <p
                    className={`text-xs ${
                      message.sender_id === user.id ? 'text-green-100' : 'text-gray-500'
                    }`}
                  >
                    {formatDistanceToNow(new Date(message.created_at), { addSuffix: false })}
                  </p>
                  {message.sender_id === user.id && (
                    <span className="text-lg">
                      {message.status === 'read'
                        ? '✓✓'
                        : message.status === 'delivered'
                        ? '✓✓'
                        : '✓'}
                    </span>
                  )}
                </div>

                {/* Reactions */}
                {message.reactions && message.reactions.length > 0 && (
                  <motion.div className="flex gap-1 mt-3 flex-wrap pt-2 border-t border-white/20">
                    {message.reactions.map((reaction) => (
                      <motion.span
                        key={reaction.id}
                        whileHover={{ scale: 1.3 }}
                        className="text-lg cursor-pointer"
                        title={reaction.user_name}
                      >
                        {reaction.emoji}
                      </motion.span>
                    ))}
                  </motion.div>
                )}

                {/* Edit indicator */}
                {message.is_edited && (
                  <p className="text-xs opacity-70 mt-1">edited</p>
                )}
              </motion.div>
            </motion.div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <motion.div
        initial={{ y: 10 }}
        animate={{ y: 0 }}
        className="bg-white border-t border-gray-200 px-4 md:px-6 py-4 shadow-lg"
      >
        <form onSubmit={sendMessage} className="flex items-end gap-3">
          {/* Emoji Button */}
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => setShowEmoji(!showEmoji)}
            className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
          >
            <FiSmile size={22} />
          </motion.button>

          {/* Message Input */}
          <div className="flex-1 relative">
            <input
              type="text"
              value={messageText}
              onChange={(e) => {
                setMessageText(e.target.value);
                handleTyping();
              }}
              placeholder="Type a message..."
              className="w-full px-4 py-3 bg-gray-100 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:bg-white transition resize-none"
            />
          </div>

          {/* Voice/Send Button */}
          {messageText.trim() ? (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              className="p-2.5 text-white bg-gradient-to-r from-green-500 to-teal-500 rounded-full hover:shadow-lg transition flex-shrink-0"
            >
              <FiSend size={22} />
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition flex-shrink-0"
              title="Hold to record voice message"
            >
              <FiMic size={22} />
            </motion.button>
          )}
        </form>

        {/* Emoji Picker */}
        {showEmoji && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mt-3"
          >
            <EmojiPicker onEmojiSelect={(emoji) => setMessageText(messageText + emoji)} />
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

export default ChatWindow;
