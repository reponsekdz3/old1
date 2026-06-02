import { useRef, useCallback } from 'react';
import { useCallStore } from '../services/store';
import { getSocket } from '../services/socket';
import api from '../services/api';

// Public STUN servers for NAT traversal
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.stunprotocol.org:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 10,
};

export function useWebRTC(currentUser) {
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const timerRef = useRef(null);

  const {
    setCallState, setCallType, setCallId, setCallee,
    setLocalStream, setRemoteStream, setMuted, setCameraOff,
    setCallDuration, resetCall, isMuted, isCameraOff,
  } = useCallStore();

  // ── Cleanup ──────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    clearInterval(timerRef.current);
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    resetCall();
  }, [resetCall]);

  // ── Create RTCPeerConnection ─────────────────────────────────────────────
  const createPeerConnection = useCallback((targetUserId) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        const socket = getSocket();
        socket?.emit('ice_candidate', {
          sender_id: currentUser.id,
          receiver_id: targetUserId,
          candidate: event.candidate,
        });
      }
    };

    pc.ontrack = (event) => {
      if (event.streams?.[0]) {
        setRemoteStream(event.streams[0]);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState;
      console.log('[WebRTC] ICE state:', state);
      if (state === 'connected' || state === 'completed') {
        setCallState('active');
        // Start timer
        let seconds = 0;
        timerRef.current = setInterval(() => {
          seconds++;
          setCallDuration(seconds);
        }, 1000);
      }
      if (state === 'failed' || state === 'disconnected') {
        console.warn('[WebRTC] Connection failed/disconnected');
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('[WebRTC] Signaling state:', pc.signalingState);
    };

    return pc;
  }, [currentUser?.id, setRemoteStream, setCallState, setCallDuration]);

  // ── Get User Media ───────────────────────────────────────────────────────
  const getUserMedia = useCallback(async (type) => {
    const constraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: type === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      } : false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (err) {
      console.error('[WebRTC] getUserMedia error:', err);
      // Fallback: try audio only
      if (type === 'video') {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        return audioStream;
      }
      throw err;
    }
  }, [setLocalStream]);

  // ── Initiate Call ────────────────────────────────────────────────────────
  const initiateCall = useCallback(async (targetUser, type = 'video') => {
    try {
      setCallType(type);
      setCallee(targetUser);
      setCallState('outgoing');

      // Register call in backend
      const { data } = await api.post('/calls/initiate', {
        receiver_id: targetUser.id,
        call_type: type,
      });
      setCallId(data.call?.id);

      const stream = await getUserMedia(type);
      const pc = createPeerConnection(targetUser.id);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: type === 'video',
      });
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket?.emit('call_offer', {
        caller_id: currentUser.id,
        caller_name: currentUser.full_name,
        caller_avatar: currentUser.avatar_url,
        receiver_id: targetUser.id,
        call_type: type,
        call_id: data.call?.id,
        offer: offer,
      });
    } catch (err) {
      console.error('[WebRTC] initiateCall error:', err);
      cleanup();
    }
  }, [currentUser, setCallType, setCallee, setCallState, setCallId, getUserMedia, createPeerConnection, cleanup]);

  // ── Answer Call ──────────────────────────────────────────────────────────
  const answerCall = useCallback(async (incomingData) => {
    try {
      const { caller_id, call_type, call_id, offer } = incomingData;
      setCallState('active');

      // Update backend
      if (call_id) {
        await api.put(`/calls/${call_id}/answer`).catch(() => {});
        setCallId(call_id);
      }

      const stream = await getUserMedia(call_type || 'video');
      const pc = createPeerConnection(caller_id);

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket?.emit('call_answer', {
        caller_id,
        callee_id: currentUser.id,
        call_id,
        answer,
      });
    } catch (err) {
      console.error('[WebRTC] answerCall error:', err);
      cleanup();
    }
  }, [currentUser?.id, setCallState, setCallId, getUserMedia, createPeerConnection, cleanup]);

  // ── Handle Received Answer ───────────────────────────────────────────────
  const handleCallAnswered = useCallback(async ({ answer }) => {
    try {
      const pc = peerConnectionRef.current;
      if (!pc) return;
      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (err) {
      console.error('[WebRTC] handleCallAnswered error:', err);
    }
  }, []);

  // ── Handle ICE Candidate ─────────────────────────────────────────────────
  const handleIceCandidate = useCallback(async ({ candidate }) => {
    try {
      const pc = peerConnectionRef.current;
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.error('[WebRTC] addIceCandidate error:', err);
    }
  }, []);

  // ── End Call ─────────────────────────────────────────────────────────────
  const endCall = useCallback(async (targetUserId, callId) => {
    const socket = getSocket();
    socket?.emit('call_end', {
      receiver_id: targetUserId,
      call_id: callId,
      caller_id: currentUser?.id,
    });

    if (callId) {
      await api.put(`/calls/${callId}/end`, {
        duration: useCallStore.getState().callDuration,
      }).catch(() => {});
    }

    cleanup();
  }, [currentUser?.id, cleanup]);

  // ── Reject Call ──────────────────────────────────────────────────────────
  const rejectCall = useCallback((callerId, callId) => {
    const socket = getSocket();
    socket?.emit('call_reject', {
      caller_id: callerId,
      call_id: callId,
      reason: 'declined',
    });
    cleanup();
  }, [cleanup]);

  // ── Toggle Mute ──────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    const newMuted = !isMuted;
    audioTracks.forEach(track => { track.enabled = !newMuted; });
    setMuted(newMuted);
  }, [isMuted, setMuted]);

  // ── Toggle Camera ────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    const newCameraOff = !isCameraOff;
    videoTracks.forEach(track => { track.enabled = !newCameraOff; });
    setCameraOff(newCameraOff);
  }, [isCameraOff, setCameraOff]);

  // ── Flip Camera ──────────────────────────────────────────────────────────
  const flipCamera = useCallback(async () => {
    if (!localStreamRef.current || !peerConnectionRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (!videoTrack) return;

    const currentFacing = videoTrack.getSettings().facingMode;
    const newFacing = currentFacing === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacing },
        audio: false,
      });
      const newVideoTrack = newStream.getVideoTracks()[0];

      // Replace track in peer connection
      const sender = peerConnectionRef.current.getSenders()
        .find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newVideoTrack);

      // Replace in local stream
      videoTrack.stop();
      localStreamRef.current.removeTrack(videoTrack);
      localStreamRef.current.addTrack(newVideoTrack);
      setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
    } catch (err) {
      console.error('[WebRTC] flipCamera error:', err);
    }
  }, [setLocalStream]);

  return {
    initiateCall,
    answerCall,
    handleCallAnswered,
    handleIceCandidate,
    endCall,
    rejectCall,
    toggleMute,
    toggleCamera,
    flipCamera,
    cleanup,
  };
}
