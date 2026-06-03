import React, { useState, useRef } from 'react';
import { FiMic, FiX, FiSend } from 'react-icons/fi';
import api from '../services/api';
import toast from 'react-hot-toast';

function VoiceRecorder({ receiverId, onSent, socket }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      
      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/ogg' });
        await sendVoiceMessage(audioBlob);
      };
      
      setIsRecording(false);
      setDuration(0);
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      clearInterval(timerRef.current);
      setIsRecording(false);
      setDuration(0);
      audioChunksRef.current = [];
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'voice.ogg');
      formData.append('receiver_id', receiverId);
      formData.append('duration', duration);

      const response = await api.post('/messages/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (socket) {
        socket.emit('message', {
          ...response.data,
          sender_id: response.data.sender_id,
          receiver_id: receiverId
        });
      }

      onSent && onSent(response.data);
      toast.success('Voice message sent');
    } catch (error) {
      toast.error('Failed to send voice message');
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isRecording) {
    return (
      <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg">
        <button onClick={cancelRecording} className="text-red-500">
          <FiX size={24} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          <span className="text-red-600 font-mono">{formatDuration(duration)}</span>
        </div>
        <button onClick={stopRecording} className="bg-green-500 text-white p-2 rounded-full">
          <FiSend size={20} />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      className="p-2 text-gray-500 hover:bg-gray-100 rounded-full transition"
    >
      <FiMic size={20} />
    </button>
  );
}

export default VoiceRecorder;
