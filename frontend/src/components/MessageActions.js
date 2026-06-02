import React, { useState } from 'react';
import { FiMoreVertical, FiStar, FiShare2, FiTrash2, FiEdit2, FiCopy } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function MessageActions({ message, isOwnMessage, onDelete, onEdit, onForward }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleStar = async () => {
    try {
      await api.post(`/messages/${message.id}/star`);
      toast.success('Message starred');
      setShowMenu(false);
    } catch (error) {
      toast.error('Failed to star message');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Copied to clipboard');
    setShowMenu(false);
  };

  const handleDeleteForMe = async () => {
    try {
      await api.delete(`/messages/${message.id}/delete`);
      onDelete && onDelete(message.id);
      toast.success('Message deleted');
      setShowMenu(false);
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  const handleDeleteForEveryone = async () => {
    try {
      await api.delete(`/messages/${message.id}/delete-for-everyone`);
      onDelete && onDelete(message.id);
      toast.success('Message deleted for everyone');
      setShowMenu(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to delete');
    }
  };

  const canDeleteForEveryone = () => {
    const messageTime = new Date(message.created_at);
    const now = new Date();
    const hoursDiff = (now - messageTime) / (1000 * 60 * 60);
    return isOwnMessage && hoursDiff < 1;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition"
      >
        <FiMoreVertical size={16} />
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 top-6 bg-white shadow-lg rounded-lg py-2 w-48 z-20">
            <button
              onClick={handleStar}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3"
            >
              <FiStar size={16} />
              <span>Star</span>
            </button>

            {message.content && (
              <button
                onClick={handleCopy}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3"
              >
                <FiCopy size={16} />
                <span>Copy</span>
              </button>
            )}

            <button
              onClick={() => {
                onForward && onForward(message);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3"
            >
              <FiShare2 size={16} />
              <span>Forward</span>
            </button>

            {isOwnMessage && (
              <button
                onClick={() => {
                  onEdit && onEdit(message);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3"
              >
                <FiEdit2 size={16} />
                <span>Edit</span>
              </button>
            )}

            <div className="border-t my-1" />

            <button
              onClick={handleDeleteForMe}
              className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3 text-red-600"
            >
              <FiTrash2 size={16} />
              <span>Delete for me</span>
            </button>

            {canDeleteForEveryone() && (
              <button
                onClick={handleDeleteForEveryone}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 flex items-center gap-3 text-red-600"
              >
                <FiTrash2 size={16} />
                <span>Delete for everyone</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default MessageActions;
