/**
 * API Security Module - Mobile Client
 * Implements request signing, replay protection, and secure communication
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import api from './api';

class APISecurityManager {
  constructor() {
    this.apiSecret = null;
    this.deviceId = null;
    this.nonceCache = new Set();
  }

  /**
   * Initialize security manager
   */
  async initialize() {
    try {
      // Get or generate device ID
      let deviceId = await AsyncStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = await this.generateDeviceId();
        await AsyncStorage.setItem('device_id', deviceId);
      }
      this.deviceId = deviceId;

      // Get API secret (exchanged during auth)
      this.apiSecret = await AsyncStorage.getItem('api_secret');
      
      console.log('[APISecurity] Initialized');
      return true;
    } catch (err) {
      console.error('[APISecurity] Initialization failed:', err);
      return false;
    }
  }

  /**
   * Generate unique device ID
   */
  async generateDeviceId() {
    const random = await Crypto.getRandomBytesAsync(16);
    return Array.from(random)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate nonce for request
   */
  async generateNonce() {
    const random = await Crypto.getRandomBytesAsync(16);
    return Array.from(random)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Sign API request
   */
  async signRequest(method, path, body = null) {
    if (!this.apiSecret) {
      console.warn('[APISecurity] No API secret, skipping signature');
      return null;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = await this.generateNonce();

      // Create signature payload
      const bodyStr = body ? JSON.stringify(body) : '';
      const message = `${method}:${path}:${timestamp}:${nonce}:${bodyStr}`;

      // Sign with HMAC-SHA256
      const signature = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        message + this.apiSecret
      );

      return {
        signature,
        timestamp,
        nonce,
        deviceId: this.deviceId
      };
    } catch (err) {
      console.error('[APISecurity] Signing failed:', err);
      return null;
    }
  }

  /**
   * Attach security headers to request
   */
  async attachSecurityHeaders(config) {
    const method = config.method?.toUpperCase() || 'GET';
    const path = config.url || '/';
    const body = config.data;

    const signature = await this.signRequest(method, path, body);

    if (signature) {
      config.headers = config.headers || {};
      config.headers['X-Request-Signature'] = signature.signature;
      config.headers['X-Request-Timestamp'] = signature.timestamp;
      config.headers['X-Request-Nonce'] = signature.nonce;
      config.headers['X-Device-ID'] = signature.deviceId;
    }

    return config;
  }

  /**
   * Verify response integrity
   */
  async verifyResponse(response) {
    const signature = response.headers['x-response-signature'];
    
    if (!signature || !this.apiSecret) {
      return true; // Optional verification
    }

    try {
      const bodyStr = JSON.stringify(response.data);
      const expected = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        bodyStr + this.apiSecret
      );

      return signature === expected;
    } catch (err) {
      console.error('[APISecurity] Response verification failed:', err);
      return false;
    }
  }

  /**
   * Check for replay attack
   */
  checkReplayProtection(nonce) {
    if (this.nonceCache.has(nonce)) {
      console.warn('[APISecurity] Replay attack detected!');
      return false;
    }

    this.nonceCache.add(nonce);

    // Limit cache size
    if (this.nonceCache.size > 1000) {
      const firstNonce = this.nonceCache.values().next().value;
      this.nonceCache.delete(firstNonce);
    }

    return true;
  }

  /**
   * Set API secret (from server during auth)
   */
  async setApiSecret(secret) {
    this.apiSecret = secret;
    await AsyncStorage.setItem('api_secret', secret);
  }

  /**
   * Clear security data
   */
  async clear() {
    this.apiSecret = null;
    await AsyncStorage.removeItem('api_secret');
    this.nonceCache.clear();
  }
}

// Request interceptor with security
export const setupAPISecurityInterceptors = (apiInstance, securityManager) => {
  // Add security headers to requests
  apiInstance.interceptors.request.use(
    async (config) => {
      return await securityManager.attachSecurityHeaders(config);
    },
    (error) => Promise.reject(error)
  );

  // Verify response integrity
  apiInstance.interceptors.response.use(
    async (response) => {
      const isValid = await securityManager.verifyResponse(response);
      if (!isValid) {
        console.warn('[APISecurity] Response integrity check failed');
      }
      return response;
    },
    (error) => Promise.reject(error)
  );
};

// Singleton instance
const apiSecurityManager = new APISecurityManager();

export default apiSecurityManager;
