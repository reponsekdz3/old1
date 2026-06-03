import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
  Image, Modal, ActionSheetIOS,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import MessageBubble from '../../components/MessageBubble';
import TypingIndicator from '../../components/TypingIndicator';
import EmojiPicker from '../../components/EmojiPicker';
import VoiceRecorder from '../../components/VoiceRecorder';
import Avatar from '../../components/Avatar';
import { useChatStore, useAuthStore } from '../../services/store';
import { getSocket } from '../../services/socket';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { Cache } from '../../services/cache';
import api from '../../services/api';
import { COLORS } from '../../config';

export default function ChatScreen() {
  const { id, name, avatar } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { messages: allMessages, setMessages, addMessage, updateMessage, typing } = useChatStore();
  const messages = allMessages[id] || [];

  const { isOnline } = useNetworkStatus();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const flatListRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);

  const isTyping = Object.keys(typing).some(k => k.startsWith(`${id}:`) && typing[k]);

  useEffect(() => {
    loadMessages();
    markRead();
    setupSocket();
    return () => teardownSocket();
  }, [id]);

  const loadMessages = async () => {
    // Show cached messages immediately for fast load
    const cached = await Cache.getMessages(id);
    if (cached?.length) {
      setMessages(id, cached);
      setLoading(false);
    }
    // Then try to fetch fresh from network
    try {
      const { data } = await api.get(`/messages/chat/${id}`);
      const msgs = data.messages || [];
      setMessages(id, msgs);
      await Cache.setMessages(id, msgs);
    } catch (e) {
      console.warn('Messages fetch failed, using cache:', e.message);
    } finally {
      setLoading(false);
    }
  };

  const markRead = async () => {
    try { await api.put(`/messages/chat/${id}/read-all`); } catch {}
  };

  const setupSocket = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('new_message', handleNewMessage);
    socket.on('typing', handleTyping);
    socket.on('stop_typing', handleStopTyping);
    socket.on('message_read', handleMessageRead);
  };

  const teardownSocket = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.off('new_message', handleNewMessage);
    socket.off('typing', handleTyping);
    socket.off('stop_typing', handleStopTyping);
    socket.off('message_read', handleMessageRead);
  };

  const handleNewMessage = useCallback((msg) => {
    if (msg.sender_id === id || msg.receiver_id === id) {
      addMessage(id, msg);
      if (msg.sender_id === id) markRead();
    }
  }, [id]);

  const handleTyping = useCallback((data) => {
    if (data.sender_id === id) {
      useChatStore.getState().setTyping(id, id, true);
    }
  }, [id]);

  const handleStopTyping = useCallback((data) => {
    if (data.sender_id === id) {
      useChatStore.getState().setTyping(id, id, false);
    }
  }, [id]);

  const handleMessageRead = useCallback((data) => {
    if (data.reader_id === id) {
      (useChatStore.getState().messages[id] || []).forEach(m => {
        if (m.sender_id === user?.id && m.status !== 'read') {
          updateMessage(id, m.id, { status: 'read' });
        }
      });
    }
  }, [id, user?.id]);

  const initiateCall = (callType) => {
    const socket = getSocket();
    if (!socket) {
      Alert.alert('Not connected', 'Cannot make calls right now. Check your connection.');
      return;
    }
    Alert.alert(
      `${callType === 'video' ? 'Video' : 'Voice'} Call`,
      `Call ${name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            socket.emit('call_offer', { callee_id: id, call_type: callType });
          },
        },
      ]
    );
  };

  const emitTyping = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing', { receiver_id: id });
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop_typing', { receiver_id: id });
    }, 2000);
  };

  const sendMessage = async (content, mediaUrl, mediaType) => {
    if (!content?.trim() && !mediaUrl) return;
    setSending(true);
    const tempId = `temp_${Date.now()}`;
    const tempMsg = {
      id: tempId,
      sender_id: user?.id,
      receiver_id: id,
      content: content || null,
      media_url: mediaUrl || null,
      media_type: mediaType || null,
      status: 'sending',
      created_at: new Date().toISOString(),
    };
    addMessage(id, tempMsg);
    setText('');

    // If offline, queue the message
    if (!isOnline) {
      await Cache.addToOfflineQueue({ chatId: id, content, mediaUrl, mediaType, tempId });
      updateMessage(id, tempId, { status: 'queued' });
      setSending(false);
      return;
    }

    try {
      const { data } = await api.post(`/messages/${id}`, {
        content: content || undefined,
        media_url: mediaUrl || undefined,
        media_type: mediaType || undefined,
      });
      updateMessage(id, tempId, { ...data, id: data.id || tempId });
      await Cache.appendMessage(id, { ...data });
      const socket = getSocket();
      if (socket) socket.emit('message', data);
    } catch (err) {
      updateMessage(id, tempId, { status: 'failed' });
      Alert.alert('Failed', 'Message could not be sent. Tap to retry when connected.');
    } finally {
      setSending(false);
    }
  };

  // Flush queued messages when back online
  useEffect(() => {
    if (!isOnline) return;
    Cache.getOfflineQueue().then(async (queue) => {
      for (const item of queue) {
        if (item.chatId !== id) continue;
        try {
          const { data } = await api.post(`/messages/${item.chatId}`, {
            content: item.content || undefined,
            media_url: item.mediaUrl || undefined,
            media_type: item.mediaType || undefined,
          });
          updateMessage(id, item.tempId, { ...data, id: data.id || item.tempId });
          await Cache.removeFromOfflineQueue(item.id);
          const socket = getSocket();
          if (socket) socket.emit('message', data);
        } catch {}
      }
    });
  }, [isOnline, id]);

  const handleSend = () => {
    if (text.trim()) sendMessage(text.trim(), null, null);
  };

  const handleVoiceSend = async ({ uri, duration }) => {
    setShowVoice(false);
    try {
      const formData = new FormData();
      formData.append('audio', { uri, name: 'voice.m4a', type: 'audio/m4a' });
      formData.append('receiver_id', id);
      formData.append('duration', String(duration));
      const { data } = await api.post('/messages/voice', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      addMessage(id, data);
    } catch (err) {
      Alert.alert('Error', 'Failed to send voice message');
    }
  };

  const handleImagePick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied', 'Camera roll access is needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    uploadImage(result.assets[0].uri);
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission denied'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (result.canceled) return;
    uploadImage(result.assets[0].uri);
  };

  const uploadImage = async (uri) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', { uri, name: 'photo.jpg', type: 'image/jpeg' });
      const { data } = await api.post('/upload/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      sendMessage(null, data.url || data.image_url, 'image');
    } catch (err) {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const showAttachMenu = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancel', 'Photo Library', 'Camera'], cancelButtonIndex: 0 },
        (idx) => { if (idx === 1) handleImagePick(); else if (idx === 2) handleCamera(); }
      );
    } else {
      Alert.alert('Attach', 'Choose source', [
        { text: 'Photo Library', onPress: handleImagePick },
        { text: 'Camera', onPress: handleCamera },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const handleLongPress = (msg) => {
    const options = ['Cancel', 'Copy'];
    const cancelIndex = 0;
    if (msg.sender_id === user?.id) options.push('Delete');
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: options.indexOf('Delete') },
        async (idx) => {
          const action = options[idx];
          if (action === 'Copy') {
            const Clipboard = await import('expo-clipboard');
            Clipboard.default.setStringAsync(msg.content || '');
          } else if (action === 'Delete') {
            try {
              await api.delete(`/messages/${msg.id}/delete`);
              updateMessage(id, msg.id, { is_deleted: true, content: null });
            } catch {}
          }
        }
      );
    }
  };

  const renderMessage = ({ item, index }) => {
    const isOwn = item.sender_id === user?.id;
    return (
      <MessageBubble
        message={item}
        isOwn={isOwn}
        onLongPress={() => handleLongPress(item)}
        onImagePress={(uri) => setSelectedImage(uri)}
      />
    );
  };

  const reversedMessages = [...messages].reverse();

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={{ backgroundColor: COLORS.primary }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Avatar uri={avatar || undefined} name={name} size={38} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName} numberOfLines={1}>{name}</Text>
            <Text style={styles.headerSub}>{isTyping ? 'typing...' : 'tap here for contact info'}</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => initiateCall('video')}>
              <Ionicons name="videocam-outline" size={22} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={() => initiateCall('audio')}>
              <Ionicons name="call-outline" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={styles.offlineBannerText}>You're offline — messages will be sent when connected</Text>
        </View>
      )}

      <View style={styles.chatBg}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          {loading ? (
            <View style={styles.loadingBox}><ActivityIndicator size="large" color={COLORS.accent} /></View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={reversedMessages}
              keyExtractor={item => item.id}
              renderItem={renderMessage}
              inverted
              contentContainerStyle={styles.messageList}
              onContentSizeChange={() => {}}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={isTyping ? <TypingIndicator /> : null}
            />
          )}

          {showEmoji && (
            <EmojiPicker
              onSelect={(emoji) => {
                setText(t => t + emoji);
                setShowEmoji(false);
              }}
            />
          )}

          <SafeAreaView edges={['bottom']} style={styles.inputArea}>
            <View style={styles.inputRow}>
              <TouchableOpacity style={styles.emojiBtn} onPress={() => { setShowEmoji(v => !v); setShowVoice(false); }}>
                <Ionicons name={showEmoji ? 'keyboard' : 'happy-outline'} size={24} color={COLORS.textGray} />
              </TouchableOpacity>

              {showVoice ? (
                <VoiceRecorder
                  onSend={handleVoiceSend}
                  onCancel={() => setShowVoice(false)}
                />
              ) : (
                <>
                  <TextInput
                    ref={inputRef}
                    style={styles.textInput}
                    value={text}
                    onChangeText={t => { setText(t); emitTyping(); }}
                    placeholder="Message"
                    placeholderTextColor={COLORS.gray}
                    multiline
                    maxLength={4000}
                    onFocus={() => setShowEmoji(false)}
                  />
                  <TouchableOpacity style={styles.attachBtn} onPress={showAttachMenu}>
                    {uploadingImage
                      ? <ActivityIndicator size="small" color={COLORS.gray} />
                      : <Ionicons name="attach" size={24} color={COLORS.textGray} />}
                  </TouchableOpacity>
                </>
              )}

              {text.trim() || showVoice ? (
                <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={sending}>
                  {sending
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="send" size={20} color="#fff" />}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.micBtn} onPress={() => { setShowVoice(v => !v); setShowEmoji(false); }}>
                  <Ionicons name={showVoice ? 'close' : 'mic'} size={24} color={COLORS.textGray} />
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>

      {selectedImage && (
        <Modal visible animationType="fade" onRequestClose={() => setSelectedImage(null)}>
          <View style={styles.imageModal}>
            <TouchableOpacity style={styles.imageModalClose} onPress={() => setSelectedImage(null)}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
            <Image source={{ uri: selectedImage }} style={styles.fullImage} resizeMode="contain" />
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  offlineBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, backgroundColor: '#FF9500', paddingVertical: 6, paddingHorizontal: 12,
  },
  offlineBannerText: { color: '#fff', fontSize: 12, fontWeight: '500', flex: 1, textAlign: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 8, paddingVertical: 10, backgroundColor: COLORS.primary,
  },
  backBtn: { padding: 4 },
  headerName: { color: '#fff', fontSize: 17, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  headerActions: { flexDirection: 'row', gap: 4 },
  iconBtn: { padding: 6 },
  chatBg: { flex: 1, backgroundColor: '#E5DDD5' },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { paddingVertical: 8, paddingHorizontal: 4 },
  inputArea: { backgroundColor: '#F0F2F5' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 4,
    paddingHorizontal: 8, paddingVertical: 8,
  },
  emojiBtn: { padding: 6, paddingBottom: 10 },
  textInput: {
    flex: 1, backgroundColor: '#fff', borderRadius: 24,
    paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10,
    fontSize: 15, color: COLORS.dark, maxHeight: 120,
    elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2,
  },
  attachBtn: { padding: 6, paddingBottom: 10 },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: COLORS.accent,
    alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: COLORS.accent, shadowOpacity: 0.3, shadowRadius: 4,
  },
  micBtn: { padding: 6, paddingBottom: 10 },
  imageModal: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  imageModalClose: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 8 },
  fullImage: { width: '100%', height: '80%' },
});
