import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, StatusBar, Platform
} from 'react-native';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import sfuClient from '../services/sfuClient';
import { useAuthStore } from '../services/store';
import { COLORS } from '../config';

export default function GroupCallScreen() {
  const router = useRouter();
  const { roomId, groupId, groupName } = useLocalSearchParams();
  const { user } = useAuthStore();
  
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState(new Map());
  const [participants, setParticipants] = useState([]);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  
  const callStartTime = useRef(Date.now());
  const durationInterval = useRef(null);

  useEffect(() => {
    initializeCall();
    
    durationInterval.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - callStartTime.current) / 1000));
    }, 1000);

    return () => {
      endCall();
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  const initializeCall = async () => {
    try {
      await sfuClient.initialize(user.id, user.full_name, user.token);
      
      sfuClient.onLocalStream = (stream) => {
        setLocalStream(stream);
      };
      
      sfuClient.onRemoteStream = (peerId, stream) => {
        setRemoteStreams(prev => {
          const updated = new Map(prev);
          updated.set(peerId, stream);
          return updated;
        });
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
      Alert.alert('Call Failed', 'Could not connect to the call');
      router.back();
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

  const switchCamera = async () => {
    await sfuClient.switchCamera();
  };

  const endCall = () => {
    sfuClient.leaveRoom();
    router.back();
  };

  const formatDuration = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const renderVideoTile = ({ item }) => {
    const stream = remoteStreams.get(item.user_id);
    const participant = participants.find(p => p.user_id === item.user_id);
    
    return (
      <View style={styles.videoTile}>
        {stream && participant?.video_enabled ? (
          <RTCView streamURL={stream.toURL()} style={styles.video} objectFit="cover" />
        ) : (
          <View style={styles.videoPlaceholder}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>{participant?.username?.[0]?.toUpperCase() || 'U'}</Text>
            </View>
          </View>
        )}
        <View style={styles.participantInfo}>
          <Text style={styles.participantName}>{participant?.username || 'User'}</Text>
          {!participant?.audio_enabled && (
            <Ionicons name="mic-off" size={14} color="#fff" style={styles.mutedIcon} />
          )}
        </View>
      </View>
    );
  };

  const remoteParticipants = Array.from(remoteStreams.keys()).map(userId => ({ user_id: userId }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.groupName}>{groupName || 'Group Call'}</Text>
        <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
        <Text style={styles.participantCount}>{remoteStreams.size + 1} participants</Text>
      </View>

      <FlatList
        data={remoteParticipants}
        keyExtractor={(item) => item.user_id.toString()}
        renderItem={renderVideoTile}
        numColumns={2}
        contentContainerStyle={styles.videoGrid}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people-outline" size={48} color="#888" />
            <Text style={styles.emptyText}>Waiting for others to join...</Text>
          </View>
        }
      />

      {localStream && (
        <View style={styles.localVideoContainer}>
          {videoEnabled ? (
            <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" />
          ) : (
            <View style={[styles.localVideo, styles.videoPlaceholder]}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>{user?.full_name?.[0]?.toUpperCase() || 'Y'}</Text>
              </View>
            </View>
          )}
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlBtn, !audioEnabled && styles.controlBtnDisabled]}
          onPress={toggleAudio}
        >
          <Ionicons name={audioEnabled ? 'mic' : 'mic-off'} size={26} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, !videoEnabled && styles.controlBtnDisabled]}
          onPress={toggleVideo}
        >
          <Ionicons name={videoEnabled ? 'videocam' : 'videocam-off'} size={26} color="#fff" />
        </TouchableOpacity>

        {videoEnabled && (
          <TouchableOpacity style={styles.controlBtn} onPress={switchCamera}>
            <Ionicons name="camera-reverse" size={26} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.controlBtn, styles.endCallBtn]} onPress={endCall}>
          <Ionicons name="call" size={26} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 16,
    alignItems: 'center',
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  duration: {
    fontSize: 16,
    color: '#888',
    marginBottom: 2,
  },
  participantCount: {
    fontSize: 14,
    color: '#666',
  },
  videoGrid: {
    padding: 8,
  },
  videoTile: {
    flex: 1,
    aspectRatio: 0.75,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1A1A1A',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2A2A2A',
  },
  avatarPlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  participantInfo: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mutedIcon: {
    marginLeft: 6,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 80,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  localVideo: {
    width: '100%',
    height: '100%',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 16,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnDisabled: {
    backgroundColor: 'rgba(220,53,69,0.9)',
  },
  endCallBtn: {
    backgroundColor: '#DC3545',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 16,
  },
});
