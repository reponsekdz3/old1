import React, { useState, useEffect } from 'react';
import { FiMapPin, FiNavigation } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function LocationShare({ receiverId, onSent, socket }) {
  const [showOptions, setShowOptions] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const getCurrentLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => reject(error)
      );
    });
  };

  const sendLocation = async (isLive = false) => {
    try {
      setIsSharing(true);
      const location = await getCurrentLocation();

      const response = await api.post('/messages/location', {
        receiver_id: receiverId,
        latitude: location.latitude,
        longitude: location.longitude,
        location_name: 'Current Location',
        is_live: isLive,
        duration: 15
      });

      if (socket) {
        socket.emit('message', response.data);
      }

      onSent && onSent(response.data);
      toast.success(isLive ? 'Live location shared' : 'Location sent');
      setShowOptions(false);

      if (isLive) {
        startLiveLocationUpdates(response.data.id);
      }
    } catch (error) {
      toast.error('Failed to get location');
    } finally {
      setIsSharing(false);
    }
  };

  const startLiveLocationUpdates = (messageId) => {
    const interval = setInterval(async () => {
      try {
        const location = await getCurrentLocation();
        await api.put(`/messages/live-location/${messageId}`, location);
        
        if (socket) {
          socket.emit('location_share', {
            receiver_id: receiverId,
            sender_id: messageId,
            ...location
          });
        }
      } catch (error) {
        clearInterval(interval);
      }
    }, 10000); // Update every 10 seconds

    setTimeout(() => clearInterval(interval), 15 * 60 * 1000); // Stop after 15 minutes
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowOptions(!showOptions)}
        className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition"
        disabled={isSharing}
      >
        <FiMapPin size={20} />
      </button>

      {showOptions && (
        <div className="absolute bottom-12 left-0 bg-white shadow-lg rounded-lg p-2 w-48 z-10">
          <button
            onClick={() => sendLocation(false)}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
          >
            <FiMapPin size={18} />
            <span>Send Location</span>
          </button>
          <button
            onClick={() => sendLocation(true)}
            className="w-full text-left px-4 py-2 hover:bg-gray-100 rounded flex items-center gap-2"
          >
            <FiNavigation size={18} />
            <span>Share Live Location</span>
          </button>
        </div>
      )}
    </div>
  );
}

export default LocationShare;
