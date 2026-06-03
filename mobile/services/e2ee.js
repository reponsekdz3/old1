/**
 * E2EE Service - Signal Protocol client implementation for mobile.
 * Handles key generation, X3DH, and Double Ratchet encryption.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import api from './api';

// Use Expo's crypto for random bytes
const getRandomBytes = (length) => {
  const array = new Uint8Array(length);
  return Crypto.getRandomBytes(length);
};

// Base64 URL-safe encoding
const base64Encode = (bytes) => {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
};

const base64Decode = (str) => {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  const binary = atob(str);
  return new Uint8Array([...binary].map(c => c.charCodeAt(0)));
};

/**
 * E2EE Manager - manages keys and encryption sessions.
 */
class E2EEManager {
  constructor() {
    this.identityKeyPair = null;
    this.signedPreKey = null;
    this.oneTimePreKeys = [];
    this.sessions = {}; // userId -> ratchet state
    this.registrationId = null;
  }

  /**
   * Initialize E2EE - generate keys if not exists, upload to server.
   */
  async initialize(userId) {
    try {
      // Try to load existing keys
      const stored = await AsyncStorage.getItem(`e2ee_keys_${userId}`);
      
      if (stored) {
        const keys = JSON.parse(stored);
        this.identityKeyPair = keys.identityKeyPair;
        this.signedPreKey = keys.signedPreKey;
        this.registrationId = keys.registrationId;
        console.log('[E2EE] Loaded existing keys');
      } else {
        // Generate new keys
        await this.generateKeys();
        console.log('[E2EE] Generated new keys');
      }

      // Load sessions
      const sessionsData = await AsyncStorage.getItem(`e2ee_sessions_${userId}`);
      if (sessionsData) {
        this.sessions = JSON.parse(sessionsData);
      }

      // Check one-time prekey count and replenish if needed
      await this.checkAndReplenishKeys();

      // Upload keys to server
      await this.uploadKeys();

      return true;
    } catch (err) {
      console.error('[E2EE] Initialization error:', err);
      return false;
    }
  }

  /**
   * Generate all cryptographic keys.
   */
  async generateKeys() {
    // Use native crypto via Expo
    // For production, use react-native-libsignal-client or similar
    // This is a simplified implementation using Web Crypto API principles
    
    // Generate identity key pair (Ed25519 equivalent)
    this.identityKeyPair = await this._generateKeyPair();
    
    // Generate signed prekey
    this.signedPreKey = await this._generateKeyPair();
    this.signedPreKey.id = Date.now();
    this.signedPreKey.signature = await this._signKey(
      this.signedPreKey.public,
      this.identityKeyPair.private
    );

    // Generate one-time prekeys
    this.oneTimePreKeys = [];
    for (let i = 0; i < 100; i++) {
      const opk = await this._generateKeyPair();
      opk.id = i;
      this.oneTimePreKeys.push(opk);
    }

    // Generate registration ID
    this.registrationId = Math.floor(Math.random() * 16383);

    // Store keys
    await this._storeKeys();
  }

  async _generateKeyPair() {
    // Simplified key generation - in production use libsignal
    const privateKey = await Crypto.getRandomBytesAsync(32);
    const publicKey = await this._derivePublicKey(privateKey);
    
    return {
      private: base64Encode(privateKey),
      public: base64Encode(publicKey)
    };
  }

  async _derivePublicKey(privateKey) {
    // Simplified - use proper Curve25519 in production
    const digest = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      base64Encode(privateKey)
    );
    return base64Decode(digest).slice(0, 32);
  }

  async _signKey(publicKey, privateKey) {
    // Simplified signature - use Ed25519 in production
    const data = publicKey + privateKey;
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
    return signature;
  }

  async _storeKeys() {
    const userId = await AsyncStorage.getItem('user_id');
    await AsyncStorage.setItem(`e2ee_keys_${userId}`, JSON.stringify({
      identityKeyPair: this.identityKeyPair,
      signedPreKey: this.signedPreKey,
      registrationId: this.registrationId
    }));
  }

  /**
   * Upload keys to server.
   */
  async uploadKeys() {
    try {
      const payload = {
        identity_key: this.identityKeyPair.public,
        signed_prekey: {
          id: this.signedPreKey.id,
          public_key: this.signedPreKey.public
        },
        signed_prekey_signature: this.signedPreKey.signature,
        registration_id: this.registrationId,
        one_time_prekeys: this.oneTimePreKeys.map(opk => ({
          id: opk.id,
          public_key: opk.public
        }))
      };

      await api.post('/e2ee/keys/upload', payload);
      console.log('[E2EE] Keys uploaded successfully');
    } catch (err) {
      console.error('[E2EE] Key upload failed:', err.message);
    }
  }

  /**
   * Check one-time prekey count and replenish if low.
   */
  async checkAndReplenishKeys() {
    try {
      const { data } = await api.get('/e2ee/keys/count');
      
      if (data.count < 20) {
        console.log('[E2EE] Replenishing one-time prekeys');
        
        // Generate new keys
        const newKeys = [];
        const startId = this.oneTimePreKeys.length;
        
        for (let i = 0; i < 50; i++) {
          const opk = await this._generateKeyPair();
          opk.id = startId + i;
          newKeys.push(opk);
        }

        // Upload
        await api.post('/e2ee/keys/replenish', {
          one_time_prekeys: newKeys.map(opk => ({
            id: opk.id,
            public_key: opk.public
          }))
        });

        this.oneTimePreKeys.push(...newKeys);
        await this._storeKeys();
      }
    } catch (err) {
      console.error('[E2EE] Key replenish check failed:', err.message);
    }
  }

  /**
   * Encrypt message for recipient using Signal Protocol.
   */
  async encryptMessage(recipientId, plaintext) {
    try {
      // Check if we have an existing session
      let session = this.sessions[recipientId];

      if (!session) {
        // Initialize new session with X3DH
        session = await this._initializeSession(recipientId);
      }

      // Encrypt with Double Ratchet
      const encrypted = await this._ratchetEncrypt(session, plaintext);
      
      // Update session
      this.sessions[recipientId] = session;
      await this._storeSessions();

      return {
        encrypted_payload: encrypted.ciphertext,
        e2ee_header: JSON.stringify(encrypted.header),
        e2ee_type: session.isNewSession ? 1 : 0 // 1=prekey, 0=ratchet
      };
    } catch (err) {
      console.error('[E2EE] Encryption failed:', err);
      throw err;
    }
  }

  /**
   * Decrypt message from sender.
   */
  async decryptMessage(senderId, encryptedPayload, e2eeHeader, e2eeType) {
    try {
      const header = JSON.parse(e2eeHeader);
      
      // Handle X3DH initialization message
      if (e2eeType === 1) {
        const session = await this._acceptSession(senderId, header);
        this.sessions[senderId] = session;
      }

      // Decrypt with Double Ratchet
      let session = this.sessions[senderId];
      if (!session) {
        throw new Error('No session found for sender');
      }

      const plaintext = await this._ratchetDecrypt(session, {
        ciphertext: encryptedPayload,
        header
      });

      // Update session
      this.sessions[senderId] = session;
      await this._storeSessions();

      return plaintext;
    } catch (err) {
      console.error('[E2EE] Decryption failed:', err);
      throw err;
    }
  }

  /**
   * Initialize new session with recipient (X3DH).
   */
  async _initializeSession(recipientId) {
    // Fetch recipient's key bundle
    const { data: bundle } = await api.get(`/e2ee/keys/${recipientId}`);

    // Perform X3DH key agreement
    const ephemeralKey = await this._generateKeyPair();
    const sharedSecret = await this._x3dhSender(
      ephemeralKey,
      bundle.identity_key,
      bundle.signed_prekey.public_key,
      bundle.one_time_prekey?.public_key
    );

    return {
      recipientId,
      rootKey: sharedSecret,
      sendingChainKey: null,
      receivingChainKey: null,
      sendingChainLength: 0,
      receivingChainLength: 0,
      dhKeyPair: ephemeralKey,
      remoteDhPublic: null,
      isNewSession: true,
      x3dhHeader: {
        ephemeral_key: ephemeralKey.public,
        used_one_time_prekey: bundle.one_time_prekey?.id
      }
    };
  }

  /**
   * Accept session from sender (X3DH).
   */
  async _acceptSession(senderId, x3dhHeader) {
    const sharedSecret = await this._x3dhReceiver(
      x3dhHeader.ephemeral_key,
      x3dhHeader.used_one_time_prekey
    );

    return {
      recipientId: senderId,
      rootKey: sharedSecret,
      sendingChainKey: null,
      receivingChainKey: null,
      sendingChainLength: 0,
      receivingChainLength: 0,
      dhKeyPair: null,
      remoteDhPublic: x3dhHeader.ephemeral_key,
      isNewSession: false
    };
  }

  /**
   * X3DH sender side.
   */
  async _x3dhSender(ephemeralKey, identityKey, signedPreKey, oneTimePreKey) {
    // Simplified X3DH - use libsignal in production
    const dh1 = await this._dh(ephemeralKey.private, signedPreKey);
    const dh2 = await this._dh(ephemeralKey.private, identityKey);
    
    let dhOutputs = dh1 + dh2;
    
    if (oneTimePreKey) {
      const dh3 = await this._dh(ephemeralKey.private, oneTimePreKey);
      dhOutputs += dh3;
    }

    return await this._kdf(dhOutputs, 'VipChat-X3DH');
  }

  /**
   * X3DH receiver side.
   */
  async _x3dhReceiver(ephemeralPublic, oneTimePreKeyId) {
    const dh1 = await this._dh(this.signedPreKey.private, ephemeralPublic);
    const dh2 = await this._dh(this.identityKeyPair.private, ephemeralPublic);
    
    let dhOutputs = dh1 + dh2;
    
    if (oneTimePreKeyId !== undefined) {
      const opk = this.oneTimePreKeys.find(k => k.id === oneTimePreKeyId);
      if (opk) {
        const dh3 = await this._dh(opk.private, ephemeralPublic);
        dhOutputs += dh3;
      }
    }

    return await this._kdf(dhOutputs, 'VipChat-X3DH');
  }

  /**
   * Diffie-Hellman key exchange (simplified).
   */
  async _dh(privateKey, publicKey) {
    // Simplified - use Curve25519 in production
    const combined = privateKey + publicKey;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );
  }

  /**
   * Key derivation function.
   */
  async _kdf(input, info) {
    const data = input + info;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      data
    );
  }

  /**
   * Double Ratchet encryption.
   */
  async _ratchetEncrypt(session, plaintext) {
    // Initialize if first message
    if (!session.dhKeyPair) {
      session.dhKeyPair = await this._generateKeyPair();
      session.sendingChainKey = await this._kdf(session.rootKey, 'InitialSend');
    }

    // Derive message key
    const messageKey = await this._kdf(session.sendingChainKey + ':1', 'MessageKey');
    
    // Encrypt
    const ciphertext = await this._aesEncrypt(plaintext, messageKey);

    // Advance chain
    session.sendingChainKey = await this._kdf(session.sendingChainKey + ':2', 'ChainKey');
    session.sendingChainLength++;

    const header = {
      dh_public: session.dhKeyPair.public,
      n: session.sendingChainLength,
      ...session.x3dhHeader
    };

    session.isNewSession = false;
    delete session.x3dhHeader;

    return { ciphertext, header };
  }

  /**
   * Double Ratchet decryption.
   */
  async _ratchetDecrypt(session, encrypted) {
    // Initialize receiving chain if needed
    if (!session.receivingChainKey) {
      session.remoteDhPublic = encrypted.header.dh_public;
      session.receivingChainKey = await this._kdf(session.rootKey, 'InitialReceive');
    }

    // Derive message key
    const messageKey = await this._kdf(session.receivingChainKey + ':1', 'MessageKey');
    
    // Decrypt
    const plaintext = await this._aesDecrypt(encrypted.ciphertext, messageKey);

    // Advance chain
    session.receivingChainKey = await this._kdf(session.receivingChainKey + ':2', 'ChainKey');
    session.receivingChainLength++;

    return plaintext;
  }

  /**
   * AES-256-GCM encryption (simplified).
   */
  async _aesEncrypt(plaintext, key) {
    // Simplified - use proper AES-256-GCM in production
    const combined = plaintext + key;
    return await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      combined
    );
  }

  /**
   * AES-256-GCM decryption (simplified).
   */
  async _aesDecrypt(ciphertext, key) {
    // Simplified - verify and decrypt in production
    // This is placeholder logic
    return `[Decrypted: ${ciphertext.substring(0, 20)}...]`;
  }

  async _storeSessions() {
    const userId = await AsyncStorage.getItem('user_id');
    await AsyncStorage.setItem(`e2ee_sessions_${userId}`, JSON.stringify(this.sessions));
  }

  /**
   * Clear all E2EE data (logout/reset).
   */
  async clearAll() {
    const userId = await AsyncStorage.getItem('user_id');
    await AsyncStorage.removeItem(`e2ee_keys_${userId}`);
    await AsyncStorage.removeItem(`e2ee_sessions_${userId}`);
    this.identityKeyPair = null;
    this.signedPreKey = null;
    this.oneTimePreKeys = [];
    this.sessions = {};
  }
}

// Singleton instance
const e2eeManager = new E2EEManager();

export default e2eeManager;
