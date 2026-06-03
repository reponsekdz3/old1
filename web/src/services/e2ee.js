/**
 * VipChat Signal Protocol E2EE Engine
 *
 * Implements the full Signal Protocol:
 *   - X3DH (Extended Triple Diffie-Hellman) initial key agreement
 *   - Double Ratchet Algorithm for forward-secret message encryption
 *
 * Security properties:
 *   - Forward Secrecy: Compromise of current keys does not expose past messages
 *   - Break-in Recovery: Future messages secure even after key compromise
 *   - Deniability: No long-term message authentication binding
 *   - Authenticated: Identity keys verified via safety numbers
 *
 * Crypto primitives (all open-source, audited):
 *   - X25519: Elliptic-curve Diffie-Hellman (@noble/curves)
 *   - Ed25519: Digital signatures (@noble/curves)
 *   - HKDF-SHA256: Key derivation (@noble/hashes)
 *   - HMAC-SHA256: Chain key ratchet (@noble/hashes)
 *   - AES-256-GCM: Symmetric encryption (Web Crypto API, hardware-accelerated)
 */

import { x25519, ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { keyStore } from './keyStore';

// ─── Protocol constants ───────────────────────────────────────────────────────
const F_BYTES = new Uint8Array(32).fill(0xff);            // X3DH domain separator
const RATCHET_INFO = enc('WhisperRatchet');
const MSG_KEY_INFO = enc('WhisperMessageKeys');
const X3DH_INFO = enc('VipChat X3DH v1');
const MAX_SKIP = 1000;                                     // max skipped message keys

// ─── Encoding helpers ─────────────────────────────────────────────────────────
function enc(s) { return new TextEncoder().encode(s); }
export const toB64 = (b) => btoa(String.fromCharCode(...b));
export const fromB64 = (s) => {
  try {
    return new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));
  } catch { return new Uint8Array(0); }
};
const concat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of arrs) { out.set(a, off); off += a.length; }
  return out;
};

// ─── Key generation ───────────────────────────────────────────────────────────
/** Generate a long-term Ed25519 identity key pair. */
export function generateIdentityKeyPair() {
  const priv = ed25519.utils.randomPrivateKey();
  return { privateKey: toB64(priv), publicKey: toB64(ed25519.getPublicKey(priv)) };
}

/** Generate an X25519 key pair (for SPK, OPK, ephemeral keys). */
export function generateX25519KeyPair() {
  const priv = x25519.utils.randomPrivateKey();
  return { privateKey: toB64(priv), publicKey: toB64(x25519.getPublicKey(priv)) };
}

/** Sign a prekey's public key with the identity private key. */
export function signPreKey(spkPublicKeyB64, identityPrivKeyB64) {
  const sig = ed25519.sign(fromB64(spkPublicKeyB64), fromB64(identityPrivKeyB64));
  return toB64(sig);
}

/** Verify a signed prekey — throws on failure (MITM protection). */
export function verifyPreKey(spkPubB64, sigB64, ikPubB64) {
  try {
    return ed25519.verify(fromB64(sigB64), fromB64(spkPubB64), fromB64(ikPubB64));
  } catch { return false; }
}

/** Generate a 14-bit random registration ID. */
export function generateRegistrationId() {
  return (new DataView(randomBytes(2).buffer).getUint16(0) & 0x3fff) + 1;
}

/** Generate a batch of OPK pairs starting at startId. */
export function generateOneTimePreKeys(startId = 0, count = 100) {
  return Array.from({ length: count }, (_, i) => {
    const kp = generateX25519KeyPair();
    return { id: startId + i, ...kp };
  });
}

// ─── KDF functions (Signal spec) ──────────────────────────────────────────────
function kdfRootKey(rootKey, dhOutput) {
  const out = hkdf(sha256, dhOutput, rootKey, RATCHET_INFO, 64);
  return { newRootKey: out.slice(0, 32), chainKey: out.slice(32) };
}

function kdfChainKey(chainKey) {
  const ck = typeof chainKey === 'string' ? fromB64(chainKey) : chainKey;
  return {
    messageKey: hmac(sha256, ck, new Uint8Array([0x01])),
    newChainKey: hmac(sha256, ck, new Uint8Array([0x02])),
  };
}

async function deriveMessageKeys(messageKey) {
  const mk = typeof messageKey === 'string' ? fromB64(messageKey) : messageKey;
  const out = hkdf(sha256, mk, new Uint8Array(32), MSG_KEY_INFO, 80);
  return { cipherKey: out.slice(0, 32), macKey: out.slice(32, 64), iv: out.slice(64, 80) };
}

// ─── AES-256-GCM (Web Crypto — hardware-accelerated) ─────────────────────────
async function encrypt256GCM(keyBytes, iv12, plaintext, aad) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv12, additionalData: aad }, k, plaintext);
  return new Uint8Array(ct);
}

async function decrypt256GCM(keyBytes, iv12, ciphertext, aad) {
  const k = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv12, additionalData: aad }, k, ciphertext);
  return new Uint8Array(pt);
}

// ─── X3DH ────────────────────────────────────────────────────────────────────
/**
 * SENDER (Alice): Establish shared secret from Bob's public key bundle.
 * Returns { sharedKey, x3dhHeader } — header is sent in the first message.
 */
export async function x3dhSender(myIKP, theirBundle) {
  const { identity_key: theirIKPub, signed_prekey: spk, one_time_prekey: opk } = theirBundle;

  if (!verifyPreKey(spk.public_key, spk.signature, theirIKPub)) {
    throw new Error('[E2EE] SPK signature invalid — possible man-in-the-middle attack!');
  }

  const ekp = generateX25519KeyPair();  // ephemeral key pair

  // Signal X3DH: IK_A × SPK_B, EK_A × IK_B, EK_A × SPK_B [, EK_A × OPK_B]
  const dh1 = x25519.getSharedSecret(fromB64(myIKP.privateKey),  fromB64(spk.public_key));
  const dh2 = x25519.getSharedSecret(fromB64(ekp.privateKey),     fromB64(theirIKPub));
  const dh3 = x25519.getSharedSecret(fromB64(ekp.privateKey),     fromB64(spk.public_key));

  let master;
  if (opk) {
    const dh4 = x25519.getSharedSecret(fromB64(ekp.privateKey), fromB64(opk.public_key));
    master = concat(F_BYTES, dh1, dh2, dh3, dh4);
  } else {
    master = concat(F_BYTES, dh1, dh2, dh3);
  }

  const sharedKey = hkdf(sha256, master, new Uint8Array(32), X3DH_INFO, 32);

  return {
    sharedKey,
    x3dhHeader: {
      type: 1,
      ik_pub: myIKP.publicKey,
      ek_pub: ekp.publicKey,
      spk_id: spk.id,
      opk_id: opk ? opk.id : null,
      registration_id: theirBundle.registration_id,
    },
  };
}

/**
 * RECEIVER (Bob): Derive shared secret from a received PreKey message.
 */
export async function x3dhReceiver(myIKP, mySpkKP, myOPKKP, header) {
  const dh1 = x25519.getSharedSecret(fromB64(mySpkKP.privateKey), fromB64(header.ik_pub));
  const dh2 = x25519.getSharedSecret(fromB64(myIKP.privateKey),   fromB64(header.ek_pub));
  const dh3 = x25519.getSharedSecret(fromB64(mySpkKP.privateKey), fromB64(header.ek_pub));

  let master;
  if (myOPKKP) {
    const dh4 = x25519.getSharedSecret(fromB64(myOPKKP.privateKey), fromB64(header.ek_pub));
    master = concat(F_BYTES, dh1, dh2, dh3, dh4);
  } else {
    master = concat(F_BYTES, dh1, dh2, dh3);
  }

  return hkdf(sha256, master, new Uint8Array(32), X3DH_INFO, 32);
}

// ─── Double Ratchet ───────────────────────────────────────────────────────────
/** Init DR session as SENDER after X3DH. */
export function drInitSender(sharedKey, theirSpkPub) {
  const ourRK = generateX25519KeyPair();
  const dhOut = x25519.getSharedSecret(fromB64(ourRK.privateKey), fromB64(theirSpkPub));
  const { newRootKey, chainKey } = kdfRootKey(sharedKey, dhOut);
  return {
    rootKey: toB64(newRootKey),
    sendChainKey: toB64(chainKey),
    recvChainKey: null,
    ourRK,
    theirRKPub: theirSpkPub,
    sendN: 0,
    recvN: 0,
    prevSendLen: 0,
    skipped: {},  // { "rk_pub:n": b64_msg_key }
  };
}

/** Init DR session as RECEIVER after X3DH. */
export function drInitReceiver(sharedKey, ourSpkKP) {
  return {
    rootKey: toB64(sharedKey),
    sendChainKey: null,
    recvChainKey: null,
    ourRK: ourSpkKP,
    theirRKPub: null,
    sendN: 0,
    recvN: 0,
    prevSendLen: 0,
    skipped: {},
  };
}

/** Encrypt plaintext with the Double Ratchet. Returns { ciphertext, header, session }. */
export async function drEncrypt(session, plaintext) {
  const { messageKey, newChainKey } = kdfChainKey(session.sendChainKey);
  const { cipherKey, iv } = await deriveMessageKeys(messageKey);

  const pt = typeof plaintext === 'string' ? enc(plaintext) : plaintext;
  const header = {
    rk_pub: session.ourRK.publicKey,
    prev_n: session.prevSendLen,
    n: session.sendN,
  };
  const aad = enc(JSON.stringify(header));
  const ct = await encrypt256GCM(cipherKey, iv.slice(0, 12), pt, aad);

  return {
    ciphertext: toB64(ct),
    header,
    session: { ...session, sendChainKey: toB64(newChainKey), sendN: session.sendN + 1 },
  };
}

/** Decrypt a Double Ratchet message. Returns { plaintext, session }. */
export async function drDecrypt(session, ciphertext, header) {
  const skipKey = `${header.rk_pub}:${header.n}`;

  // Try skipped message keys first
  if (session.skipped[skipKey]) {
    const mk = fromB64(session.skipped[skipKey]);
    const { cipherKey, iv } = await deriveMessageKeys(mk);
    const aad = enc(JSON.stringify(header));
    const pt = await decrypt256GCM(cipherKey, iv.slice(0, 12), fromB64(ciphertext), aad);
    const skipped = { ...session.skipped };
    delete skipped[skipKey];
    return { plaintext: new TextDecoder().decode(pt), session: { ...session, skipped } };
  }

  let s = { ...session };

  // DH ratchet step on new ratchet key
  if (!s.theirRKPub || header.rk_pub !== s.theirRKPub) {
    s = _skipKeys(s, header.prev_n, s.theirRKPub);
    s = _dhRatchet(s, header.rk_pub);
  }

  s = _skipKeys(s, header.n, header.rk_pub);

  const { messageKey, newChainKey } = kdfChainKey(s.recvChainKey);
  const { cipherKey, iv } = await deriveMessageKeys(messageKey);
  const aad = enc(JSON.stringify(header));
  const pt = await decrypt256GCM(cipherKey, iv.slice(0, 12), fromB64(ciphertext), aad);

  return {
    plaintext: new TextDecoder().decode(pt),
    session: { ...s, recvChainKey: toB64(newChainKey), recvN: s.recvN + 1 },
  };
}

function _skipKeys(s, until, rkPub) {
  if (!s.recvChainKey) return s;
  let ck = fromB64(s.recvChainKey);
  const skipped = { ...s.skipped };
  let n = s.recvN;
  while (n < until && Object.keys(skipped).length < MAX_SKIP) {
    const { messageKey, newChainKey } = kdfChainKey(ck);
    skipped[`${rkPub}:${n}`] = toB64(messageKey);
    ck = newChainKey;
    n++;
  }
  return { ...s, recvChainKey: toB64(ck), recvN: n, skipped };
}

function _dhRatchet(s, theirNewRKPub) {
  const prevSendLen = s.sendN;
  const dhRecv = x25519.getSharedSecret(fromB64(s.ourRK.privateKey), fromB64(theirNewRKPub));
  const { newRootKey: rk1, chainKey: recvCK } = kdfRootKey(fromB64(s.rootKey), dhRecv);

  const newRK = generateX25519KeyPair();
  const dhSend = x25519.getSharedSecret(fromB64(newRK.privateKey), fromB64(theirNewRKPub));
  const { newRootKey: rk2, chainKey: sendCK } = kdfRootKey(rk1, dhSend);

  return {
    ...s,
    rootKey: toB64(rk2),
    sendChainKey: toB64(sendCK),
    recvChainKey: toB64(recvCK),
    ourRK: newRK,
    theirRKPub: theirNewRKPub,
    sendN: 0,
    recvN: 0,
    prevSendLen,
  };
}

// ─── High-level API ───────────────────────────────────────────────────────────
/**
 * Generate and publish a full key bundle for a new user.
 * Called once on registration.
 */
export async function generateAndPublishKeys(apiClient) {
  const ikp = generateIdentityKeyPair();
  const spkKP = generateX25519KeyPair();
  const regId = generateRegistrationId();
  const spkId = Math.floor(Math.random() * 0xffffff) + 1;
  const sig = signPreKey(spkKP.publicKey, ikp.privateKey);
  const opks = generateOneTimePreKeys(1, 100);

  // Persist private keys in IndexedDB
  await keyStore.saveIdentityKeyPair(ikp);
  await keyStore.saveSignedPreKey(spkId, spkKP);
  await keyStore.setRegistrationId(regId);
  for (const opk of opks) {
    await keyStore.saveOneTimePreKey(opk.id, { privateKey: opk.privateKey, publicKey: opk.publicKey });
  }

  // Publish public material to server
  await apiClient.post('/e2ee/keys', {
    identity_key: ikp.publicKey,
    signed_prekey: { id: spkId, public_key: spkKP.publicKey, signature: sig },
    registration_id: regId,
    one_time_prekeys: opks.map(k => ({ id: k.id, public_key: k.publicKey })),
  });

  return { publicKey: ikp.publicKey, registrationId: regId };
}

/**
 * Ensure keys are present. Load from IndexedDB; regenerate if missing.
 * Also replenishes OPKs if running low.
 */
export async function ensureKeysReady(apiClient) {
  try {
    const existing = await keyStore.getIdentityKeyPair();
    if (!existing) {
      await generateAndPublishKeys(apiClient);
      return;
    }
    // Replenish OPKs if low
    const { data } = await apiClient.get('/e2ee/keys/status');
    if (data.needs_upload || data.low_prekeys) {
      const lastId = await keyStore.getLastOPKId();
      const newOPKs = generateOneTimePreKeys(lastId + 1, 50);
      for (const opk of newOPKs) {
        await keyStore.saveOneTimePreKey(opk.id, { privateKey: opk.privateKey, publicKey: opk.publicKey });
      }
      await apiClient.post('/e2ee/keys/one-time', {
        one_time_prekeys: newOPKs.map(k => ({ id: k.id, public_key: k.publicKey })),
      });
    }
  } catch (err) {
    console.warn('[E2EE] ensureKeysReady:', err.message);
  }
}

/**
 * Encrypt a plaintext message for a recipient.
 * Returns { encrypted_payload, e2ee_header, e2ee_type, e2ee: true }
 * or { plaintext, e2ee: false } as graceful fallback.
 */
export async function encryptForUser(recipientId, plaintext, apiClient) {
  try {
    const myIKP = await keyStore.getIdentityKeyPair();
    if (!myIKP) return { plaintext, e2ee: false };

    let session = await keyStore.getSession(recipientId);
    let x3dhHeader = null;
    let isPreKey = false;

    if (!session) {
      const resp = await apiClient.get(`/e2ee/keys/${recipientId}`);
      if (!resp.data.e2ee_supported) return { plaintext, e2ee: false };

      const { sharedKey, x3dhHeader: hdr } = await x3dhSender(myIKP, resp.data);
      x3dhHeader = hdr;
      session = drInitSender(sharedKey, resp.data.signed_prekey.public_key);
      isPreKey = true;
    }

    const { ciphertext, header: ratchetHeader, session: newSession } = await drEncrypt(session, plaintext);
    await keyStore.saveSession(recipientId, newSession);

    return {
      encrypted_payload: ciphertext,
      e2ee_header: JSON.stringify({ ratchet: ratchetHeader, x3dh: isPreKey ? x3dhHeader : null }),
      e2ee_type: isPreKey ? 1 : 0,
      e2ee: true,
    };
  } catch (err) {
    console.error('[E2EE] encrypt error:', err);
    return { plaintext, e2ee: false };
  }
}

/**
 * Decrypt a received E2EE message.
 * Returns { plaintext, success } or { plaintext: null, success: false, error }.
 */
export async function decryptFromUser(senderId, encryptedPayload, e2eeHeaderRaw, e2eeType, apiClient) {
  try {
    const myIKP = await keyStore.getIdentityKeyPair();
    if (!myIKP) throw new Error('No identity key');

    const e2eeHeader = JSON.parse(e2eeHeaderRaw);
    const ratchetHeader = e2eeHeader.ratchet;
    const x3dhHdr = e2eeHeader.x3dh;

    let session = await keyStore.getSession(senderId);

    if (!session && x3dhHdr && e2eeType === 1) {
      const mySpkKP = await keyStore.getSignedPreKey(x3dhHdr.spk_id);
      if (!mySpkKP) throw new Error('SignedPreKey not found: ' + x3dhHdr.spk_id);

      let myOPKKP = null;
      if (x3dhHdr.opk_id != null) {
        myOPKKP = await keyStore.getOneTimePreKey(x3dhHdr.opk_id);
        if (myOPKKP) await keyStore.deleteOneTimePreKey(x3dhHdr.opk_id);
      }

      const sharedKey = await x3dhReceiver(myIKP, mySpkKP, myOPKKP, x3dhHdr);
      session = drInitReceiver(sharedKey, mySpkKP);
    }

    if (!session) throw new Error('No session for sender ' + senderId);

    const { plaintext, session: newSession } = await drDecrypt(session, encryptedPayload, ratchetHeader);
    await keyStore.saveSession(senderId, newSession);

    return { plaintext, success: true };
  } catch (err) {
    console.error('[E2EE] decrypt error:', err);
    return { plaintext: null, success: false, error: err.message };
  }
}

/**
 * Compute safety number (Signal-style) for UI fingerprint verification.
 */
export async function computeSafetyNumber(myUserId, myIKPub, theirUserId, theirIKPub) {
  const pairs = [[myUserId, myIKPub], [theirUserId, theirIKPub]].sort((a, b) => a[0].localeCompare(b[0]));
  const raw = Array.from(pairs[0]).concat(Array.from(pairs[1])).join('');
  const hashBuf = await crypto.subtle.digest('SHA-512', enc(raw));
  const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const digits = Array.from({ length: 30 }, (_, i) => String(parseInt(hex.slice(i * 2, i * 2 + 2), 16)).padStart(3, '0')).join('');
  return Array.from({ length: 5 }, (_, i) => digits.slice(i * 12, i * 12 + 12)).join(' ');
}
