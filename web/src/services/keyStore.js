/**
 * VipChat E2EE Key Store
 * IndexedDB-backed secure storage for Signal Protocol private keys and sessions.
 *
 * Keys NEVER leave this store. Only public material is sent to the server.
 * The store is scoped per browser origin and is NOT accessible to other origins.
 */

const DB_NAME = 'vipchat_e2ee_v1';
const DB_VERSION = 1;

const STORES = {
  IDENTITY: 'identity_keys',
  SIGNED: 'signed_prekeys',
  OTP: 'one_time_prekeys',
  SESSIONS: 'sessions',
  META: 'metadata',
};

class KeyStore {
  constructor() {
    this._db = null;
  }

  async _open() {
    if (this._db) return this._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        for (const name of Object.values(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, { keyPath: 'k' });
          }
        }
      };
      req.onsuccess = (e) => { this._db = e.target.result; resolve(this._db); };
      req.onerror = () => reject(new Error('Failed to open E2EE key store: ' + req.error));
    });
  }

  async _get(store, key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(String(key));
      req.onsuccess = () => resolve(req.result ? req.result.v : null);
      req.onerror = () => reject(req.error);
    });
  }

  async _put(store, key, value) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put({ k: String(key), v: value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _delete(store, key) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).delete(String(key));
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async _getAllKeys(store) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).getAllKeys();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // ── Identity Key Pair ────────────────────────────────────────────────────
  async saveIdentityKeyPair(kp) { await this._put(STORES.IDENTITY, 'local', kp); }
  async getIdentityKeyPair() { return this._get(STORES.IDENTITY, 'local'); }

  // ── Signed PreKey ────────────────────────────────────────────────────────
  async saveSignedPreKey(id, kp) { await this._put(STORES.SIGNED, id, kp); }
  async getSignedPreKey(id) { return this._get(STORES.SIGNED, id); }
  async getAllSignedPreKeyIds() { return this._getAllKeys(STORES.SIGNED); }

  // ── One-Time PreKeys ─────────────────────────────────────────────────────
  async saveOneTimePreKey(id, kp) { await this._put(STORES.OTP, id, kp); }
  async getOneTimePreKey(id) { return this._get(STORES.OTP, id); }
  async deleteOneTimePreKey(id) { await this._delete(STORES.OTP, id); }

  async getLastOPKId() {
    const keys = await this._getAllKeys(STORES.OTP);
    if (!keys.length) return 0;
    return Math.max(...keys.map(k => parseInt(k, 10) || 0));
  }

  async getOPKCount() {
    const keys = await this._getAllKeys(STORES.OTP);
    return keys.length;
  }

  // ── Sessions (Double Ratchet state per contact) ──────────────────────────
  async saveSession(userId, state) { await this._put(STORES.SESSIONS, userId, state); }
  async getSession(userId) { return this._get(STORES.SESSIONS, userId); }
  async deleteSession(userId) { await this._delete(STORES.SESSIONS, userId); }

  async getAllSessionIds() { return this._getAllKeys(STORES.SESSIONS); }

  // ── Metadata ─────────────────────────────────────────────────────────────
  async setRegistrationId(id) { await this._put(STORES.META, 'reg_id', id); }
  async getRegistrationId() { return this._get(STORES.META, 'reg_id'); }

  async setLastSPKRotation(ts) { await this._put(STORES.META, 'last_spk_rotation', ts); }
  async getLastSPKRotation() { return this._get(STORES.META, 'last_spk_rotation'); }

  // ── Nuke on logout ────────────────────────────────────────────────────────
  async clearAll() {
    const db = await this._open();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(Object.values(STORES), 'readwrite');
      for (const name of Object.values(STORES)) tx.objectStore(name).clear();
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    this._db = null;
  }
}

export const keyStore = new KeyStore();
