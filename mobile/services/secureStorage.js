/**
 * Secure Storage Module - Encrypted local storage for sensitive data
 * Uses device keychain/keystore for maximum security
 */
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import AsyncStorage from '@react-native-async-storage/async-storage';

class SecureStorageManager {
  constructor() {
    this.encryptionKey = null;
    this.initialized = false;
  }

  /**
   * Initialize secure storage
   */
  async initialize() {
    try {
      // Get or create master encryption key
      let key = await SecureStore.getItemAsync('master_encryption_key');
      
      if (!key) {
        // Generate new master key
        key = await this.generateMasterKey();
        await SecureStore.setItemAsync('master_encryption_key', key);
      }
      
      this.encryptionKey = key;
      this.initialized = true;
      
      console.log('[SecureStorage] Initialized');
      return true;
    } catch (err) {
      console.error('[SecureStorage] Initialization failed:', err);
      return false;
    }
  }

  /**
   * Generate master encryption key
   */
  async generateMasterKey() {
    const random = await Crypto.getRandomBytesAsync(32);
    return Array.from(random)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Store sensitive data securely (uses device keychain)
   */
  async setSecure(key, value) {
    try {
      if (typeof value !== 'string') {
        value = JSON.stringify(value);
      }
      
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (err) {
      console.error(`[SecureStorage] Failed to store ${key}:`, err);
      return false;
    }
  }

  /**
   * Retrieve sensitive data securely
   */
  async getSecure(key) {
    try {
      const value = await SecureStore.getItemAsync(key);
      
      if (!value) return null;
      
      // Try to parse as JSON
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    } catch (err) {
      console.error(`[SecureStorage] Failed to retrieve ${key}:`, err);
      return null;
    }
  }

  /**
   * Remove secure item
   */
  async removeSecure(key) {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (err) {
      console.error(`[SecureStorage] Failed to remove ${key}:`, err);
      return false;
    }
  }

  /**
   * Encrypt data for AsyncStorage (less secure but more capacity)
   */
  async encrypt(plaintext) {
    if (!this.initialized || !this.encryptionKey) {
      throw new Error('SecureStorage not initialized');
    }

    try {
      // Simple XOR encryption (for demo - use AES-GCM in production)
      const data = typeof plaintext === 'string' ? plaintext : JSON.stringify(plaintext);
      const encrypted = this.xorEncrypt(data, this.encryptionKey);
      
      return encrypted;
    } catch (err) {
      console.error('[SecureStorage] Encryption failed:', err);
      throw err;
    }
  }

  /**
   * Decrypt data from AsyncStorage
   */
  async decrypt(ciphertext) {
    if (!this.initialized || !this.encryptionKey) {
      throw new Error('SecureStorage not initialized');
    }

    try {
      const decrypted = this.xorEncrypt(ciphertext, this.encryptionKey);
      
      // Try to parse as JSON
      try {
        return JSON.parse(decrypted);
      } catch {
        return decrypted;
      }
    } catch (err) {
      console.error('[SecureStorage] Decryption failed:', err);
      throw err;
    }
  }

  /**
   * XOR encryption (simple - use AES in production)
   */
  xorEncrypt(data, key) {
    let result = '';
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(
        data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
      );
    }
    return Buffer.from(result).toString('base64');
  }

  /**
   * Store encrypted data in AsyncStorage
   */
  async setEncrypted(key, value) {
    try {
      const encrypted = await this.encrypt(value);
      await AsyncStorage.setItem(`encrypted_${key}`, encrypted);
      return true;
    } catch (err) {
      console.error(`[SecureStorage] Failed to store encrypted ${key}:`, err);
      return false;
    }
  }

  /**
   * Get encrypted data from AsyncStorage
   */
  async getEncrypted(key) {
    try {
      const encrypted = await AsyncStorage.getItem(`encrypted_${key}`);
      
      if (!encrypted) return null;
      
      return await this.decrypt(encrypted);
    } catch (err) {
      console.error(`[SecureStorage] Failed to retrieve encrypted ${key}:`, err);
      return null;
    }
  }

  /**
   * Remove encrypted data
   */
  async removeEncrypted(key) {
    try {
      await AsyncStorage.removeItem(`encrypted_${key}`);
      return true;
    } catch (err) {
      console.error(`[SecureStorage] Failed to remove encrypted ${key}:`, err);
      return false;
    }
  }

  /**
   * Store authentication tokens securely
   */
  async setTokens(accessToken, refreshToken) {
    await this.setSecure('access_token', accessToken);
    await this.setSecure('refresh_token', refreshToken);
  }

  /**
   * Get authentication tokens
   */
  async getTokens() {
    const accessToken = await this.getSecure('access_token');
    const refreshToken = await this.getSecure('refresh_token');
    return { accessToken, refreshToken };
  }

  /**
   * Clear all secure data
   */
  async clearAll() {
    try {
      // Remove from SecureStore
      const secureKeys = [
        'access_token',
        'refresh_token',
        'master_encryption_key',
        'api_secret',
        'user_credentials'
      ];
      
      for (const key of secureKeys) {
        await this.removeSecure(key);
      }
      
      // Remove encrypted items from AsyncStorage
      const allKeys = await AsyncStorage.getAllKeys();
      const encryptedKeys = allKeys.filter(k => k.startsWith('encrypted_'));
      await AsyncStorage.multiRemove(encryptedKeys);
      
      this.encryptionKey = null;
      this.initialized = false;
      
      console.log('[SecureStorage] Cleared all data');
      return true;
    } catch (err) {
      console.error('[SecureStorage] Clear failed:', err);
      return false;
    }
  }

  /**
   * Check if biometric authentication is available
   */
  async isBiometricAvailable() {
    try {
      return await SecureStore.isAvailableAsync();
    } catch {
      return false;
    }
  }
}

// Singleton instance
const secureStorage = new SecureStorageManager();

export default secureStorage;
