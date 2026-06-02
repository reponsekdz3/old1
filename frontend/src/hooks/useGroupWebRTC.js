import { useRef, useCallback, useState } from 'react';
import { getSocket } from '../services/socket';
import api from '../services/api';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
  iceCandidatePoolSize: 10,
};

export function useGroupWebRTC(currentUser) {
  const peerConnectionsRef = useRef({});
  const localStreamRef = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [groupCallId, setGroupCallId] = useState(null);

  const getLocalStream = useCallback(async (callType = 'video') => {
    const constraints = {
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
    };
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch {
      if (callType === 'video') {
        const fallback = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
        localStreamRef.current = fallback;
        setLocalStream(fallback);
        return fallback;
      }
      throw new Error('Could not access media devices');
    }
  }, []);

  const createPeerConnection = useCallback((targetUserId, stream) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    stream?.getTracks().forEach(track => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('group_ice_candidate', {
          from_user_id: currentUser.id,
          target_user_id: targetUserId,
          call_id: groupCallId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        setRemoteStreams(prev => ({ ...prev, [targetUserId]: event.streams[0] }));
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[targetUserId];
          return next;
        });
      }
    };

    peerConnectionsRef.current[targetUserId] = pc;
    return pc;
  }, [currentUser?.id, groupCallId]);

  const sendOfferTo = useCallback(async (targetUserId, stream, callType, callId) => {
    const pc = createPeerConnection(targetUserId, stream);
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: callType === 'video' });
    await pc.setLocalDescription(offer);
    const socket = getSocket();
    socket?.emit('group_call_offer', {
      from_user_id: currentUser.id,
      from_user_name: currentUser.full_name,
      target_user_id: targetUserId,
      call_id: callId,
      call_type: callType,
      offer,
    });
  }, [createPeerConnection, currentUser]);

  const initiateGroupCall = useCallback(async (groupId, groupName, callType = 'video') => {
    try {
      const callId = `gc_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      setGroupCallId(callId);
      const stream = await getLocalStream(callType);
      setCallActive(true);

      const socket = getSocket();
      socket?.emit('group_call_start', {
        group_id: groupId,
        initiator_id: currentUser.id,
        initiator_name: currentUser.full_name,
        initiator_avatar: currentUser.avatar_url,
        call_type: callType,
        call_id: callId,
        group_name: groupName,
      });
      socket?.emit('group_call_join', { call_id: callId, user_id: currentUser.id, user_name: currentUser.full_name });

      // Log call in backend
      api.post('/calls/initiate', { receiver_id: null, call_type: callType, group_id: groupId }).catch(() => {});

      return callId;
    } catch (err) {
      console.error('[GroupWebRTC] initiateGroupCall error:', err);
      cleanupGroupCall();
      throw err;
    }
  }, [currentUser, getLocalStream]);

  const joinGroupCall = useCallback(async (callId, callType, existingParticipants) => {
    try {
      setGroupCallId(callId);
      const localSt = await getLocalStream(callType);
      setCallActive(true);

      const socket = getSocket();
      socket?.emit('group_call_join', { call_id: callId, user_id: currentUser.id, user_name: currentUser.full_name });

      for (const p of (existingParticipants || [])) {
        if (p.user_id !== currentUser.id) {
          await sendOfferTo(p.user_id, localSt, callType, callId);
        }
      }
    } catch (err) {
      console.error('[GroupWebRTC] joinGroupCall error:', err);
      cleanupGroupCall();
      throw err;
    }
  }, [currentUser, getLocalStream, sendOfferTo]);

  const handleGroupOffer = useCallback(async (data) => {
    const { from_user_id, call_id, call_type, offer } = data;
    const stream = localStreamRef.current;
    if (!stream) return;

    const pc = createPeerConnection(from_user_id, stream);
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    const socket = getSocket();
    socket?.emit('group_call_answer', {
      from_user_id: currentUser.id,
      target_user_id: from_user_id,
      call_id,
      answer,
    });
  }, [createPeerConnection, currentUser?.id]);

  const handleGroupAnswer = useCallback(async (data) => {
    const { from_user_id, answer } = data;
    const pc = peerConnectionsRef.current[from_user_id];
    if (pc && pc.signalingState === 'have-local-offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }, []);

  const handleGroupIce = useCallback(async (data) => {
    const { from_user_id, candidate } = data;
    const pc = peerConnectionsRef.current[from_user_id];
    if (pc && candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }, []);

  const handleUserJoined = useCallback((data) => {
    setParticipants(prev => {
      if (prev.find(p => p.user_id === data.user_id)) return prev;
      return [...prev, { user_id: data.user_id, user_name: data.user_name }];
    });
  }, []);

  const handleUserLeft = useCallback((data) => {
    const { user_id } = data;
    const pc = peerConnectionsRef.current[user_id];
    if (pc) { pc.close(); delete peerConnectionsRef.current[user_id]; }
    setRemoteStreams(prev => { const n = { ...prev }; delete n[user_id]; return n; });
    setParticipants(prev => prev.filter(p => p.user_id !== user_id));
  }, []);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsMuted(m => !m);
  }, []);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
    setIsCameraOff(v => !v);
  }, []);

  const cleanupGroupCall = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    Object.values(peerConnectionsRef.current).forEach(pc => pc.close());
    peerConnectionsRef.current = {};
    setLocalStream(null);
    setRemoteStreams({});
    setParticipants([]);
    setCallActive(false);
    setGroupCallId(null);
    setIsMuted(false);
    setIsCameraOff(false);
  }, []);

  const leaveGroupCall = useCallback((callId) => {
    const socket = getSocket();
    socket?.emit('group_call_leave', { call_id: callId || groupCallId, user_id: currentUser.id });
    cleanupGroupCall();
  }, [currentUser?.id, groupCallId, cleanupGroupCall]);

  return {
    localStream,
    remoteStreams,
    participants,
    isMuted,
    isCameraOff,
    callActive,
    groupCallId,
    initiateGroupCall,
    joinGroupCall,
    handleGroupOffer,
    handleGroupAnswer,
    handleGroupIce,
    handleUserJoined,
    handleUserLeft,
    toggleMute,
    toggleCamera,
    leaveGroupCall,
    cleanupGroupCall,
  };
}
