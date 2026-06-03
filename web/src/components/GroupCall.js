import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiPhoneOff, FiRotateCw } from 'react-icons/fi';
import sfuClient from '../services/sfuClient';
import { useStore } from '../services/store';

export default function GroupCall() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useStore();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  const localVideoRef = useRef(null);
  const remoteVideoRefs = useRef(new Map());
  const callStartTime = useRef(Date.now());

  useEffect(() => {
    initializeCall();
    
    const interval = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
    }, 1000);

    return () => {
      clearInterval(interval);
      endCall();
    };
  }, []);

  useEffect(() => {
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    remoteStreams.forEach((stream, peerId) => {
      const videoElement = remoteVideoRefs.current.get(peerId);
      if (videoElement && videoElement.srcObject !== stream) {
        videoElement.srcObject = stream;
      }
    });
  }, [remoteStreams]);

  const initializeCall = async () => {
    try {
      await sfuClient.initialize(user.id, user.full_name, user.token);
      
      sfuClient.onLocalStream = (stream) => {
        setLocalStream(stream);
      };
      
      sfuClient.onRemoteStream = (peerId, stream) => {
        setRemoteStreams(prev => new Map(prev).set(peerId, stream));
      };
      
      sfuClient.onRemoteStreamRemoved = (peerId) => {
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.delete(peerId);
          return updated;
        });
      };
      
      sfuClient.onParticipantJoined = (participant) => {
        setParticipants(prev => [...prev, participant]);
      };
      
      sfuClient.onParticipantLeft = (data) => {
        setParticipants(prev => prev.filter(p => p.user_id !== data.user_id));
      };
      
      sfuClient.onMediaStateChanged = (data) => {
        setParticipants(prev => prev.map(p => 
          p.user_id === data.user_id 
            ? { ...p, audio_enabled: data.audio ?? p.audio_enabled, video_enabled: data.video ?? p.video_enabled }
            : p
        ));
      };

      await sfuClient.joinRoom(roomId, audioEnabled, videoEnabled);
    } catch (error) {
      console.error('[GroupCall] Failed to initialize:', error);
      alert('Could not connect to the call');
      navigate(-1);
    }
  };

  const toggleAudio = () => {
    const newState = !audioEnabled;
    sfuClient.toggleAudio(newState);
    setAudioEnabled(newState);
  };

  const toggleVideo = () => {
    const newState = !videoEnabled;
    sfuClient.toggleVideo(newState);
    setVideoEnabled(newState);
  };

  const toggleScreenShare = async () => {
    try {
      if (screenSharing) {
        sfuClient.stopScreenShare();
        setScreenSharing(false);
      } else {
        await sfuClient.shareScreen();
        setScreenSharing(true);
      }
    } catch (error) {
      console.error('[GroupCall] Screen share failed:', error);
    }
  };

  const endCall = () => {
    sfuClient.leaveRoom();
    navigate(-1);
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const remoteParticipants = Array.from(remoteStreams.keys());

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-6 py-4 flex items-center justify-between border-b border-gray-700">
        <div>
          <h2 className="text-white text-xl font-semibold">Group Call</h2>
          <p className="text-gray-400 text-sm">{formatDuration(callDuration)} • {remoteStreams.size + 1} participants</p>
        </div>
      </div>

      {/* Video Grid */}
      <div className="flex-1 overflow-auto p-4">
        <div className={`grid gap-4 h-full ${
          remoteParticipants.length === 0 ? 'grid-cols-1' :
          remoteParticipants.length === 1 ? 'grid-cols-2' :
          remoteParticipants.length <= 4 ? 'grid-cols-2' :
          remoteParticipants.length <= 9 ? 'grid-cols-3' : 'grid-cols-4'
        }`}>
          {remoteParticipants.map(peerId => {
            const participant = participants.find(p => p.user_id === peerId);
            return (
              <div key={peerId} className="relative bg-gray-800 rounded-lg overflow-hidden">
                <video
                  ref={(el) => {
                    if (el) remoteVideoRefs.current.set(peerId, el);
                  }}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {!participant?.video_enabled && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="w-20 h-20 rounded-full bg-teal-600 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold">
                        {participant?.username?.[0]?.toUpperCase() || 'U'}
                      </span>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full flex items-center gap-2">
                  <span className="text-white text-sm font-medium">{participant?.username || 'User'}</span>
                  {!participant?.audio_enabled && <FiMicOff className="text-red-400" size={14} />}
                </div>
              </div>
            );
          })}
        </div>

        {remoteParticipants.length === 0 && (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gray-800 flex items-center justify-center">
                <FiVideo className="text-gray-600" size={40} />
              </div>
              <p className="text-gray-400 text-lg">Waiting for others to join...</p>
            </div>
          </div>
        )}
      </div>

      {/* Local Video */}
      <div className="absolute top-20 right-6 w-48 h-36 bg-gray-800 rounded-lg overflow-hidden shadow-2xl border-2 border-gray-700">
        {videoEnabled ? (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className="w-full h-full object-cover mirror"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-800">
            <div className="w-16 h-16 rounded-full bg-teal-600 flex items-center justify-center">
              <span className="text-white text-xl font-bold">{user?.full_name?.[0]?.toUpperCase() || 'Y'}</span>
            </div>
          </div>
        )}
        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-white text-xs">You</div>
      </div>

      {/* Controls */}
      <div className="bg-gray-800 px-6 py-6 flex items-center justify-center gap-4 border-t border-gray-700">
        <button
          onClick={toggleAudio}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={audioEnabled ? 'Mute' : 'Unmute'}
        >
          {audioEnabled ? <FiMic className="text-white" size={22} /> : <FiMicOff className="text-white" size={22} />}
        </button>

        <button
          onClick={toggleVideo}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
          }`}
          title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {videoEnabled ? <FiVideo className="text-white" size={22} /> : <FiVideoOff className="text-white" size={22} />}
        </button>

        <button
          onClick={toggleScreenShare}
          className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            screenSharing ? 'bg-teal-600 hover:bg-teal-700' : 'bg-gray-700 hover:bg-gray-600'
          }`}
          title={screenSharing ? 'Stop sharing' : 'Share screen'}
        >
          <FiMonitor className="text-white" size={22} />
        </button>

        <button
          onClick={endCall}
          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 flex items-center justify-center transition-colors"
          title="End call"
        >
          <FiPhoneOff className="text-white" size={22} />
        </button>
      </div>

      <style jsx>{`
        .mirror {
          transform: scaleX(-1);
        }
      `}</style>
    </div>
  );
}
