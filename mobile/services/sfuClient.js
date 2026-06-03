import { io } from 'socket.io-client';
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices } from 'react-native-webrtc';
import { SOCKET_URL } from '../config';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

class SFUClient {
  constructor() {
    this.socket = null;
    this.roomId = null;
    this.userId = null;
    this.username = null;
    this.peerConnections = new Map();
    this.localStream = null;
    this.remoteStreams = new Map();
    this.participants = new Map();
    
    this.onLocalStream = null;
    this.onRemoteStream = null;
    this.onRemoteStreamRemoved = null;
    this.onParticipantJoined = null;
    this.onParticipantLeft = null;
    this.onMediaStateChanged = null;
  }

  async initialize(userId, username, token) {
    this.userId = userId;
    this.username = username;

    if (!this.socket) {
      this.socket = io(SOCKET_URL, {
        reconnection: true,
        reconnectionDelay: 1000,
        auth: { token },
        transports: ['websocket', 'polling']
      });

      this._setupSocketListeners();
    }

    return new Promise((resolve) => {
      if (this.socket.connected) {
        resolve();
      } else {
        this.socket.once('connect', resolve);
      }
    });
  }

  _setupSocketListeners() {
    this.socket.on('sfu_joined', (data) => {
      console.log('[SFU] Joined room:', data);
      this.roomId = data.room_id;
      
      // Create peer connections for existing participants
      data.participants.forEach(participant => {
        this._createPeerConnection(participant.user_id, true);
        this.participants.set(participant.user_id, participant);
        if (this.onParticipantJoined) {
          this.onParticipantJoined(participant);
        }
      });
    });

    this.socket.on('sfu_peer_joined', async (data) => {
      console.log('[SFU] Peer joined:', data);
      this.participants.set(data.user_id, data);
      await this._createPeerConnection(data.user_id, true);
      
      if (this.onParticipantJoined) {
        this.onParticipantJoined(data);
      }
    });

    this.socket.on('sfu_peer_left', (data) => {
      console.log('[SFU] Peer left:', data);
      this._removePeerConnection(data.user_id);
      this.participants.delete(data.user_id);
      
      if (this.onParticipantLeft) {
        this.onParticipantLeft(data);
      }
    });

    this.socket.on('sfu_offer', async (data) => {
      await this._handleOffer(data.sender_user_id, data.offer);
    });

    this.socket.on('sfu_answer', async (data) => {
      await this._handleAnswer(data.sender_user_id, data.answer);
    });

    this.socket.on('sfu_ice_candidate', async (data) => {
      await this._handleIceCandidate(data.sender_user_id, data.candidate);
    });

    this.socket.on('sfu_peer_media_state', (data) => {
      const participant = this.participants.get(data.user_id);
      if (participant) {
        if (data.audio !== undefined) participant.audio_enabled = data.audio;
        if (data.video !== undefined) participant.video_enabled = data.video;
        if (data.screen !== undefined) participant.screen_share = data.screen;
        
        if (this.onMediaStateChanged) {
          this.onMediaStateChanged(data);
        }
      }
    });

    this.socket.on('sfu_error', (data) => {
      console.error('[SFU] Error:', data.error);
    });
  }

  async joinRoom(roomId, audioEnabled = true, videoEnabled = true) {
    this.roomId = roomId;

    // Get local media stream
    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: audioEnabled,
        video: videoEnabled ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      });

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }
    } catch (error) {
      console.error('[SFU] Failed to get media:', error);
      throw error;
    }

    // Join room via socket
    this.socket.emit('sfu_join', {
      room_id: roomId,
      user_id: this.userId,
      username: this.username
    });
  }

  async _createPeerConnection(peerId, isInitiator) {
    if (this.peerConnections.has(peerId)) {
      return this.peerConnections.get(peerId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        pc.addTrack(track, this.localStream);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('[SFU] Received remote track from', peerId);
      const stream = event.streams[0];
      this.remoteStreams.set(peerId, stream);
      
      if (this.onRemoteStream) {
        this.onRemoteStream(peerId, stream);
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.socket.emit('sfu_ice_candidate', {
          target_user_id: peerId,
          sender_user_id: this.userId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[SFU] ICE state for', peerId, ':', pc.iceConnectionState);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        this._removePeerConnection(peerId);
      }
    };

    this.peerConnections.set(peerId, pc);

    // If initiator, create and send offer
    if (isInitiator) {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await pc.setLocalDescription(offer);

      this.socket.emit('sfu_offer', {
        target_user_id: peerId,
        sender_user_id: this.userId,
        offer: offer.toJSON()
      });
    }

    return pc;
  }

  async _handleOffer(peerId, offer) {
    const pc = await this._createPeerConnection(peerId, false);
    
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    this.socket.emit('sfu_answer', {
      target_user_id: peerId,
      sender_user_id: this.userId,
      answer: answer.toJSON()
    });
  }

  async _handleAnswer(peerId, answer) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  }

  async _handleIceCandidate(peerId, candidate) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }

  _removePeerConnection(peerId) {
    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }

    const stream = this.remoteStreams.get(peerId);
    if (stream) {
      this.remoteStreams.delete(peerId);
      if (this.onRemoteStreamRemoved) {
        this.onRemoteStreamRemoved(peerId);
      }
    }
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      
      this.socket.emit('sfu_media_state', {
        user_id: this.userId,
        audio: enabled
      });
    }
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      
      this.socket.emit('sfu_media_state', {
        user_id: this.userId,
        video: enabled
      });
    }
  }

  async switchCamera() {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => track._switchCamera());
    }
  }

  leaveRoom() {
    console.log('[SFU] Leaving room');

    this.socket.emit('sfu_leave', { user_id: this.userId });

    // Close all peer connections
    this.peerConnections.forEach(pc => pc.close());
    this.peerConnections.clear();
    this.remoteStreams.clear();
    this.participants.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.roomId = null;
  }

  disconnect() {
    this.leaveRoom();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export default new SFUClient();
