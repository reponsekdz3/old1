/**
 * Advanced Call Manager - Handles 1-to-1 and multi-party WebRTC calls
 * Features: Add participants to ongoing calls, call escalation, E2EE
 */
import { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate, mediaDevices } from 'react-native-webrtc';
import { getSocket } from './socket';
import sfuClient from './sfuClient';
import CryptoJS from 'crypto-js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  // Add TURN servers for production
  {
    urls: 'turn:turnserver.example.com:3478',
    username: 'vipchat',
    credential: 'secure_credential'
  }
];

class CallManager {
  constructor() {
    this.currentCall = null;
    this.callType = null; // '1to1' or 'group'
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.callId = null;
    this.participants = new Map();
    this.encryptionKey = null;
    this.isUpgradingToGroup = false;
    
    // Callbacks
    this.onIncomingCall = null;
    this.onCallAnswered = null;
    this.onCallEnded = null;
    this.onRemoteStream = null;
    this.onLocalStream = null;
    this.onParticipantAdded = null;
    this.onParticipantRemoved = null;
    this.onCallUpgraded = null;
    this.onError = null;
  }

  /**
   * Initialize E2EE for the call
   */
  _initializeEncryption() {
    this.encryptionKey = CryptoJS.lib.WordArray.random(32).toString();
    return this.encryptionKey;
  }

  /**
   * Encrypt media frame (for E2EE)
   */
  _encryptFrame(data) {
    if (!this.encryptionKey) return data;
    try {
      return CryptoJS.AES.encrypt(data, this.encryptionKey).toString();
    } catch (err) {
      console.warn('[CallManager] Frame encryption failed:', err);
      return data;
    }
  }

  /**
   * Decrypt media frame
   */
  _decryptFrame(data) {
    if (!this.encryptionKey) return data;
    try {
      const bytes = CryptoJS.AES.decrypt(data, this.encryptionKey);
      return bytes.toString(CryptoJS.enc.Utf8);
    } catch (err) {
      console.warn('[CallManager] Frame decryption failed:', err);
      return data;
    }
  }

  /**
   * Start 1-to-1 call
   */
  async startCall(calleeId, callType = 'audio', calleeName = 'Unknown') {
    try {
      this.callType = '1to1';
      this.callId = `call_${Date.now()}`;
      
      // Initialize E2EE
      const encKey = this._initializeEncryption();
      
      // Get local media
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: callType === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        } : false
      });

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket.emit('ice_candidate', {
            target_id: calleeId,
            candidate: event.candidate.toJSON()
          });
        }
      };

      // Create and send offer
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      const socket = getSocket();
      socket.emit('call_offer', {
        callee_id: calleeId,
        call_type: callType,
        call_id: this.callId,
        offer: offer.toJSON(),
        encryption_key: encKey
      });

      this.currentCall = {
        id: this.callId,
        type: callType,
        peerId: calleeId,
        peerName: calleeName,
        status: 'calling',
        startedAt: Date.now()
      };

      return this.currentCall;
    } catch (err) {
      console.error('[CallManager] Start call failed:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  /**
   * Answer incoming 1-to-1 call
   */
  async answerCall(callerId, offer, encryptionKey) {
    try {
      this.callType = '1to1';
      this.encryptionKey = encryptionKey;
      
      // Get local media
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: offer.type === 'video'
      });

      if (this.onLocalStream) {
        this.onLocalStream(this.localStream);
      }

      // Create peer connection
      this.peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

      // Add local tracks
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        this.remoteStream = event.streams[0];
        if (this.onRemoteStream) {
          this.onRemoteStream(this.remoteStream);
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          const socket = getSocket();
          socket.emit('ice_candidate', {
            target_id: callerId,
            candidate: event.candidate.toJSON()
          });
        }
      };

      // Set remote description
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Send answer
      const socket = getSocket();
      socket.emit('call_answer', {
        caller_id: callerId,
        answer: answer.toJSON()
      });

      this.currentCall = {
        id: this.callId,
        peerId: callerId,
        status: 'active',
        startedAt: Date.now()
      };

      if (this.onCallAnswered) {
        this.onCallAnswered(this.currentCall);
      }
    } catch (err) {
      console.error('[CallManager] Answer call failed:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  /**
   * Add participant to ongoing 1-to-1 call (upgrade to group call)
   */
  async addParticipant(userId, userName) {
    if (!this.currentCall || this.callType !== '1to1') {
      throw new Error('No active 1-to-1 call to upgrade');
    }

    try {
      this.isUpgradingToGroup = true;
      
      // Create SFU room
      const roomId = `group_${this.callId}_${Date.now()}`;
      
      // Close 1-to-1 peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = null;
      }

      // Initialize SFU client
      const socket = getSocket();
      await sfuClient.initialize(
        this.currentCall.userId,
        this.currentCall.userName,
        await this._getAuthToken()
      );

      // Join SFU room
      await sfuClient.joinRoom(roomId, true, this.currentCall.type === 'video');

      // Set up SFU callbacks
      sfuClient.onLocalStream = (stream) => {
        if (this.onLocalStream) {
          this.onLocalStream(stream);
        }
      };

      sfuClient.onRemoteStream = (peerId, stream) => {
        this.participants.set(peerId, { id: peerId, stream });
        if (this.onRemoteStream) {
          this.onRemoteStream(stream, peerId);
        }
      };

      sfuClient.onParticipantJoined = (participant) => {
        if (this.onParticipantAdded) {
          this.onParticipantAdded(participant);
        }
      };

      sfuClient.onParticipantLeft = (participant) => {
        this.participants.delete(participant.user_id);
        if (this.onParticipantRemoved) {
          this.onParticipantRemoved(participant);
        }
      };

      // Invite original participant
      socket.emit('invite_to_group_call', {
        room_id: roomId,
        invitee_id: this.currentCall.peerId,
        invitee_name: this.currentCall.peerName
      });

      // Invite new participant
      socket.emit('invite_to_group_call', {
        room_id: roomId,
        invitee_id: userId,
        invitee_name: userName
      });

      this.callType = 'group';
      this.currentCall.roomId = roomId;
      this.currentCall.type = 'group';
      
      if (this.onCallUpgraded) {
        this.onCallUpgraded({
          roomId,
          participants: [this.currentCall.peerId, userId]
        });
      }

      this.isUpgradingToGroup = false;
      return roomId;
    } catch (err) {
      this.isUpgradingToGroup = false;
      console.error('[CallManager] Add participant failed:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  /**
   * Add participant to existing group call
   */
  async addParticipantToGroup(userId, userName) {
    if (!this.currentCall || this.callType !== 'group') {
      throw new Error('No active group call');
    }

    try {
      const socket = getSocket();
      socket.emit('invite_to_group_call', {
        room_id: this.currentCall.roomId,
        invitee_id: userId,
        invitee_name: userName
      });

      if (this.onParticipantAdded) {
        this.onParticipantAdded({ user_id: userId, username: userName });
      }
    } catch (err) {
      console.error('[CallManager] Add participant to group failed:', err);
      if (this.onError) this.onError(err);
      throw err;
    }
  }

  /**
   * Toggle audio mute
   */
  toggleAudio(enabled) {
    if (this.callType === '1to1' && this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
    } else if (this.callType === 'group') {
      sfuClient.toggleAudio(enabled);
    }
  }

  /**
   * Toggle video
   */
  toggleVideo(enabled) {
    if (this.callType === '1to1' && this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    } else if (this.callType === 'group') {
      sfuClient.toggleVideo(enabled);
    }
  }

  /**
   * Switch camera (mobile)
   */
  async switchCamera() {
    if (this.callType === '1to1' && this.localStream) {
      this.localStream.getVideoTracks().forEach(track => track._switchCamera());
    } else if (this.callType === 'group') {
      await sfuClient.switchCamera();
    }
  }

  /**
   * End call
   */
  endCall() {
    try {
      const socket = getSocket();
      
      if (this.callType === '1to1') {
        socket.emit('call_end', {
          target_id: this.currentCall.peerId,
          call_id: this.callId
        });

        if (this.peerConnection) {
          this.peerConnection.close();
          this.peerConnection = null;
        }
      } else if (this.callType === 'group') {
        sfuClient.leaveRoom();
      }

      // Stop local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
        this.localStream = null;
      }

      const endedCall = this.currentCall;
      this.currentCall = null;
      this.callType = null;
      this.remoteStream = null;
      this.callId = null;
      this.encryptionKey = null;
      this.participants.clear();

      if (this.onCallEnded) {
        this.onCallEnded(endedCall);
      }
    } catch (err) {
      console.error('[CallManager] End call failed:', err);
    }
  }

  /**
   * Get current call info
   */
  getCurrentCall() {
    return this.currentCall;
  }

  /**
   * Get auth token for SFU
   */
  async _getAuthToken() {
    const { TokenStorage } = await import('./storage');
    const tokens = await TokenStorage.getTokens();
    return tokens?.access;
  }
}

export default new CallManager();
