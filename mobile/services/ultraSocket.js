"""
Ultra-Efficient Web Socket Manager
- Connection pooling and multiplexing
- Binary message protocol
- Automatic reconnection with backoff
- Offline queue sync
"""

import { EventEmitter } from 'events';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import msgpack from 'msgpack-lite';
import pako from 'pako';

class UltraEfficientSocket extends EventEmitter {
    constructor() {
        super();
        
        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 50;
        this.reconnectDelay = 1000;
        this.maxReconnectDelay = 60000;
        
        this.messageQueue = [];
        this.pendingAcks = new Map();
        this.subscriptions = new Map();
        
        // Connection multiplexing
        this.channels = new Map();
        this.activeChannel = null;
        
        // Compression
        this.useCompression = true;
        
        // Metrics
        this.metrics = {
            messagesReceived: 0,
            messagesSent: 0,
            bytesReceived: 0,
            bytesSent: 0,
            avgLatency: 0,
        };
    }
    
    // Connect with authentication
    async connect(token) {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this.getBaseUrl()}?token=${token}&protocol=bin`;
            
            this.ws = new WebSocket(wsUrl, {
                headers: {
                    'Accept-Encoding': 'gzip, deflate',
                }
            });
            
            this.ws.binaryType = 'arraybuffer';
            
            this.ws.onopen = () => {
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.reconnectDelay = 1000;
                
                // Process queued messages
                this.flushQueue();
                
                // Resubscribe to channels
                this.resubscribeAll();
                
                this.emit('connected');
                resolve();
            };
            
            this.ws.onmessage = (event) => {
                this.handleMessage(event.data);
            };
            
            this.ws.onclose = (event) => {
                this.isConnected = false;
                this.emit('disconnected', event.code, event.reason);
                
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.scheduleReconnect(token);
                }
            };
            
            this.ws.onerror = (error) => {
                this.emit('error', error);
                reject(error);
            };
        });
    }
    
    // Handle incoming binary message
    handleMessage(data) {
        this.metrics.messagesReceived++;
        this.metrics.bytesReceived += data.byteLength;
        
        let message;
        
        try {
            // Decompress if needed
            let buffer = new Uint8Array(data);
            if (buffer[0] === 0x78 && buffer[1] === 0x9C) {
                buffer = pako.ungzip(buffer);
            }
            
            // Decode MessagePack
            message = msgpack.decode(buffer);
        } catch (err) {
            console.error('Failed to decode message:', err);
            return;
        }
        
        // Handle different message types
        const { type, payload, id } = message;
        
        // ACK handling
        if (type === 'ack' && id) {
            const pending = this.pendingAcks.get(id);
            if (pending) {
                clearTimeout(pending.timeout);
                this.pendingAcks.delete(id);
                
                // Update latency metric
                const latency = Date.now() - pending.sentAt;
                this.metrics.avgLatency = (this.metrics.avgLatency + latency) / 2;
            }
            return;
        }
        
        // Route to appropriate handler
        switch (type) {
            case 'message':
            case 'new_message':
                this.emit('message', payload);
                break;
            case 'typing':
                this.emit('typing', payload);
                break;
            case 'presence':
                this.emit('presence', payload);
                break;
            case 'call_offer':
            case 'incoming_call':
                this.emit('call', payload);
                break;
            case 'delta':
                this.emit('delta', payload);
                break;
            case 'ping':
                this.send({ type: 'pong', timestamp: Date.now() }, false);
                break;
            default:
                this.emit(type, payload);
        }
    }
    
    // Send message with optional ACK
    send(message, requireAck = true, priority = 'normal') {
        if (!this.isConnected) {
            // Queue message for later
            this.messageQueue.push({ message, requireAck, priority });
            return;
        }
        
        // Generate message ID for ACK
        const id = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        message.id = id;
        
        // Encode to MessagePack
        let buffer = msgpack.encode(message);
        
        // Compress if > 100 bytes
        if (this.useCompression && buffer.length > 100) {
            buffer = pako.gzip(buffer);
        }
        
        // Send
        this.ws.send(buffer);
        
        this.metrics.messagesSent++;
        this.metrics.bytesSent += buffer.length;
        
        // Set ACK timeout
        if (requireAck) {
            const timeout = setTimeout(() => {
                // Retry if no ACK
                if (this.pendingAcks.has(id)) {
                    this.pendingAcks.delete(id);
                    this.send(message, false, priority); // Retry without ACK to prevent loop
                }
            }, 10000);
            
            this.pendingAcks.set(id, { sentAt: Date.now(), timeout });
        }
    }
    
    // Queue message for offline sending
    async queueOffline(message) {
        const offlineQueue = await this.getOfflineQueue();
        offlineQueue.push({
            ...message,
            queuedAt: Date.now(),
        });
        await AsyncStorage.setItem('offline_queue', JSON.stringify(offlineQueue));
    }
    
    // Get offline queue
    async getOfflineQueue() {
        const data = await AsyncStorage.getItem('offline_queue');
        return data ? JSON.parse(data) : [];
    }
    
    // Flush queued messages
    flushQueue() {
        if (this.messageQueue.length === 0) return;
        
        // Sort by priority
        const priorityOrder = { high: 0, normal: 1, low: 2 };
        this.messageQueue.sort((a, b) => 
            priorityOrder[a.priority] - priorityOrder[b.priority]
        );
        
        // Send all queued messages
        while (this.messageQueue.length > 0) {
            const { message, requireAck } = this.messageQueue.shift();
            this.send(message, requireAck);
        }
    }
    
    // Subscribe to channel with multiplexing
    subscribe(channel, callback) {
        if (!this.subscriptions.has(channel)) {
            this.subscriptions.set(channel, new Set());
            
            // Send subscribe message
            this.send({
                type: 'subscribe',
                channel,
            });
        }
        
        this.subscriptions.get(channel).add(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscriptions.get(channel);
            callbacks.delete(callback);
            
            if (callbacks.size === 0) {
                this.subscriptions.delete(channel);
                this.send({ type: 'unsubscribe', channel });
            }
        };
    }
    
    // Resubscribe to all channels after reconnect
    resubscribeAll() {
        for (const channel of this.subscriptions.keys()) {
            this.send({ type: 'subscribe', channel });
        }
    }
    
    // Schedule reconnection with exponential backoff
    scheduleReconnect(token) {
        this.reconnectAttempts++;
        
        const delay = Math.min(
            this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1),
            this.maxReconnectDelay
        );
        
        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
        
        setTimeout(() => {
            this.connect(token).catch(() => {});
        }, delay);
    }
    
    // Get base URL
    getBaseUrl() {
        return Platform.select({
            ios: 'wss://api.vipchat.io/ws',
            android: 'wss://api.vipchat.io/ws',
            web: 'wss://api.vipchat.io/ws',
        });
    }
    
    // Get connection metrics
    getMetrics() {
        return {
            ...this.metrics,
            queueSize: this.messageQueue.length,
            pendingAcks: this.pendingAcks.size,
            subscriptions: this.subscriptions.size,
            compressionRatio: this.metrics.bytesSent > 0 
                ? ((this.metrics.bytesReceived / this.metrics.bytesSent) * 100).toFixed(2) + '%'
                : 'N/A',
        };
    }
    
    // Disconnect
    disconnect() {
        if (this.ws) {
            this.ws.close(1000, 'Client disconnect');
            this.ws = null;
        }
        
        this.isConnected = false;
        this.subscriptions.clear();
        this.pendingAcks.clear();
    }
}

// Singleton instance
const ultraSocket = new UltraEfficientSocket();
export default ultraSocket;
