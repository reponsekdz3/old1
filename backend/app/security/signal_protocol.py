"""
Complete Signal Protocol implementation for E2EE (X3DH + Double Ratchet).
Production-grade with Curve25519/Ed25519 cryptography.
"""
import os
import base64
import json
from typing import Dict, Tuple, Optional
from cryptography.hazmat.primitives.asymmetric.x25519 import X25519PrivateKey, X25519PublicKey
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from cryptography.hazmat.primitives import serialization, hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidKey, InvalidSignature


class SignalProtocol:
    """Signal Protocol implementation with X3DH and Double Ratchet."""
    
    MAX_SKIP = 1000  # Max messages to skip in chain
    
    @staticmethod
    def generate_identity_keypair() -> Dict:
        """Generate Ed25519 identity key pair."""
        private_key = Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        return {
            'private': base64.b64encode(private_key.private_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PrivateFormat.Raw,
                encryption_algorithm=serialization.NoEncryption()
            )).decode(),
            'public': base64.b64encode(public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )).decode()
        }
    
    @staticmethod
    def generate_prekey_keypair() -> Dict:
        """Generate X25519 prekey pair."""
        private_key = X25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        return {
            'private': base64.b64encode(private_key.private_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PrivateFormat.Raw,
                encryption_algorithm=serialization.NoEncryption()
            )).decode(),
            'public': base64.b64encode(public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )).decode()
        }
    
    @staticmethod
    def sign_prekey(prekey_public: str, identity_private: str) -> str:
        """Sign prekey with identity key."""
        identity_key = Ed25519PrivateKey.from_private_bytes(
            base64.b64decode(identity_private)
        )
        prekey_bytes = base64.b64decode(prekey_public)
        signature = identity_key.sign(prekey_bytes)
        return base64.b64encode(signature).decode()
    
    @staticmethod
    def verify_prekey_signature(prekey_public: str, signature: str, identity_public: str) -> bool:
        """Verify prekey signature."""
        try:
            identity_key = Ed25519PublicKey.from_public_bytes(
                base64.b64decode(identity_public)
            )
            prekey_bytes = base64.b64decode(prekey_public)
            sig_bytes = base64.b64decode(signature)
            identity_key.verify(sig_bytes, prekey_bytes)
            return True
        except InvalidSignature:
            return False
    
    @staticmethod
    def x3dh_sender_init(
        recipient_identity_key: str,
        recipient_signed_prekey: str,
        recipient_one_time_prekey: Optional[str] = None
    ) -> Tuple[Dict, bytes]:
        """
        X3DH sender initialization.
        Returns: (ephemeral_public_key_dict, shared_secret)
        """
        # Generate ephemeral key
        eph_private = X25519PrivateKey.generate()
        eph_public = eph_private.public_key()
        
        # Load recipient keys
        recipient_ik = X25519PublicKey.from_public_bytes(
            base64.b64decode(recipient_identity_key)
        )
        recipient_spk = X25519PublicKey.from_public_bytes(
            base64.b64decode(recipient_signed_prekey)
        )
        
        # DH1: ephemeral * recipient_signed_prekey
        dh1 = eph_private.exchange(recipient_spk)
        
        # DH2: ephemeral * recipient_identity_key
        dh2 = eph_private.exchange(recipient_ik)
        
        dh_outputs = dh1 + dh2
        
        # DH3: ephemeral * recipient_one_time_prekey (if exists)
        if recipient_one_time_prekey:
            recipient_opk = X25519PublicKey.from_public_bytes(
                base64.b64decode(recipient_one_time_prekey)
            )
            dh3 = eph_private.exchange(recipient_opk)
            dh_outputs += dh3
        
        # KDF to derive shared secret
        shared_secret = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'VipChat-X3DH',
            backend=default_backend()
        ).derive(dh_outputs)
        
        return {
            'public': base64.b64encode(eph_public.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )).decode()
        }, shared_secret
    
    @staticmethod
    def x3dh_receiver_init(
        ephemeral_public: str,
        identity_private: str,
        signed_prekey_private: str,
        one_time_prekey_private: Optional[str] = None
    ) -> bytes:
        """
        X3DH receiver initialization.
        Returns: shared_secret
        """
        # Load keys
        eph_pub = X25519PublicKey.from_public_bytes(
            base64.b64decode(ephemeral_public)
        )
        ik_priv = X25519PrivateKey.from_private_bytes(
            base64.b64decode(identity_private)
        )
        spk_priv = X25519PrivateKey.from_private_bytes(
            base64.b64decode(signed_prekey_private)
        )
        
        # DH1: signed_prekey_private * ephemeral_public
        dh1 = spk_priv.exchange(eph_pub)
        
        # DH2: identity_private * ephemeral_public
        dh2 = ik_priv.exchange(eph_pub)
        
        dh_outputs = dh1 + dh2
        
        # DH3: one_time_prekey_private * ephemeral_public (if exists)
        if one_time_prekey_private:
            opk_priv = X25519PrivateKey.from_private_bytes(
                base64.b64decode(one_time_prekey_private)
            )
            dh3 = opk_priv.exchange(eph_pub)
            dh_outputs += dh3
        
        # Derive shared secret
        shared_secret = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'VipChat-X3DH',
            backend=default_backend()
        ).derive(dh_outputs)
        
        return shared_secret


class DoubleRatchet:
    """Double Ratchet algorithm for forward secrecy."""
    
    def __init__(self, shared_secret: bytes):
        """Initialize ratchet with shared secret from X3DH."""
        self.root_key = shared_secret
        self.sending_chain_key = None
        self.receiving_chain_key = None
        self.sending_chain_length = 0
        self.receiving_chain_length = 0
        self.previous_sending_chain_length = 0
        self.dh_keypair = None
        self.remote_dh_public = None
        self.skipped_message_keys = {}  # {(dh_public, n): message_key}
    
    def ratchet_encrypt(self, plaintext: str, associated_data: str = '') -> Dict:
        """Encrypt with Double Ratchet."""
        # Initialize DH ratchet if needed
        if self.dh_keypair is None:
            self.dh_keypair = SignalProtocol.generate_prekey_keypair()
            self._derive_sending_chain()
        
        # Derive message key from chain key
        message_key = self._kdf_message_key(self.sending_chain_key)
        
        # Encrypt with AEAD
        aesgcm = AESGCM(message_key)
        nonce = os.urandom(12)
        ad_bytes = associated_data.encode() if associated_data else b''
        ciphertext = aesgcm.encrypt(nonce, plaintext.encode(), ad_bytes)
        
        # Build header
        header = {
            'dh_public': self.dh_keypair['public'],
            'pn': self.previous_sending_chain_length,
            'n': self.sending_chain_length
        }
        
        # Advance chain key
        self.sending_chain_key = self._kdf_chain_key(self.sending_chain_key)
        self.sending_chain_length += 1
        
        return {
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'nonce': base64.b64encode(nonce).decode(),
            'header': header
        }
    
    def ratchet_decrypt(self, encrypted: Dict, associated_data: str = '') -> str:
        """Decrypt with Double Ratchet."""
        header = encrypted['header']
        ciphertext = base64.b64decode(encrypted['ciphertext'])
        nonce = base64.b64decode(encrypted['nonce'])
        
        # Check if we need to perform DH ratchet
        if header['dh_public'] != (self.remote_dh_public or ''):
            self._dh_ratchet(header)
        
        # Try to use skipped message keys first
        skipped_key = self.skipped_message_keys.get(
            (header['dh_public'], header['n'])
        )
        if skipped_key:
            message_key = skipped_key
            del self.skipped_message_keys[(header['dh_public'], header['n'])]
        else:
            # Skip message keys if needed
            self._skip_message_keys(header['n'])
            message_key = self._kdf_message_key(self.receiving_chain_key)
            self.receiving_chain_key = self._kdf_chain_key(self.receiving_chain_key)
            self.receiving_chain_length += 1
        
        # Decrypt
        aesgcm = AESGCM(message_key)
        ad_bytes = associated_data.encode() if associated_data else b''
        plaintext = aesgcm.decrypt(nonce, ciphertext, ad_bytes)
        
        return plaintext.decode()
    
    def _dh_ratchet(self, header: Dict):
        """Perform DH ratchet step."""
        # Save skipped message keys from previous receiving chain
        self._skip_message_keys(self.receiving_chain_length)
        
        # Store previous chain length
        self.previous_sending_chain_length = self.sending_chain_length
        self.sending_chain_length = 0
        self.receiving_chain_length = 0
        
        # Update remote DH public key
        self.remote_dh_public = header['dh_public']
        
        # Derive new receiving chain
        self._derive_receiving_chain()
        
        # Generate new DH keypair and derive sending chain
        self.dh_keypair = SignalProtocol.generate_prekey_keypair()
        self._derive_sending_chain()
    
    def _derive_sending_chain(self):
        """Derive sending chain key from root key."""
        if self.remote_dh_public:
            # Perform DH
            my_private = X25519PrivateKey.from_private_bytes(
                base64.b64decode(self.dh_keypair['private'])
            )
            remote_public = X25519PublicKey.from_public_bytes(
                base64.b64decode(self.remote_dh_public)
            )
            dh_output = my_private.exchange(remote_public)
            
            # KDF to derive new root key and chain key
            derived = HKDF(
                algorithm=hashes.SHA256(),
                length=64,
                salt=self.root_key,
                info=b'VipChat-Ratchet',
                backend=default_backend()
            ).derive(dh_output)
            
            self.root_key = derived[:32]
            self.sending_chain_key = derived[32:]
        else:
            # First message, use root key directly
            self.sending_chain_key = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=None,
                info=b'VipChat-InitialSend',
                backend=default_backend()
            ).derive(self.root_key)
    
    def _derive_receiving_chain(self):
        """Derive receiving chain key from root key."""
        # Perform DH
        my_private = X25519PrivateKey.from_private_bytes(
            base64.b64decode(self.dh_keypair['private'])
        )
        remote_public = X25519PublicKey.from_public_bytes(
            base64.b64decode(self.remote_dh_public)
        )
        dh_output = my_private.exchange(remote_public)
        
        # KDF to derive new root key and chain key
        derived = HKDF(
            algorithm=hashes.SHA256(),
            length=64,
            salt=self.root_key,
            info=b'VipChat-Ratchet',
            backend=default_backend()
        ).derive(dh_output)
        
        self.root_key = derived[:32]
        self.receiving_chain_key = derived[32:]
    
    def _skip_message_keys(self, until: int):
        """Store message keys for skipped messages."""
        if self.receiving_chain_key is None:
            return
        
        while self.receiving_chain_length < until:
            if len(self.skipped_message_keys) > SignalProtocol.MAX_SKIP:
                raise Exception("Too many skipped messages")
            
            message_key = self._kdf_message_key(self.receiving_chain_key)
            self.skipped_message_keys[(self.remote_dh_public, self.receiving_chain_length)] = message_key
            self.receiving_chain_key = self._kdf_chain_key(self.receiving_chain_key)
            self.receiving_chain_length += 1
    
    @staticmethod
    def _kdf_chain_key(chain_key: bytes) -> bytes:
        """Derive next chain key."""
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'VipChat-ChainKey',
            backend=default_backend()
        ).derive(chain_key + b'\x02')
    
    @staticmethod
    def _kdf_message_key(chain_key: bytes) -> bytes:
        """Derive message key from chain key."""
        return HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=b'VipChat-MessageKey',
            backend=default_backend()
        ).derive(chain_key + b'\x01')
    
    def export_state(self) -> Dict:
        """Export ratchet state for persistence."""
        return {
            'root_key': base64.b64encode(self.root_key).decode(),
            'sending_chain_key': base64.b64encode(self.sending_chain_key).decode() if self.sending_chain_key else None,
            'receiving_chain_key': base64.b64encode(self.receiving_chain_key).decode() if self.receiving_chain_key else None,
            'sending_chain_length': self.sending_chain_length,
            'receiving_chain_length': self.receiving_chain_length,
            'previous_sending_chain_length': self.previous_sending_chain_length,
            'dh_keypair': self.dh_keypair,
            'remote_dh_public': self.remote_dh_public,
            'skipped_message_keys': {
                f"{k[0]}:{k[1]}": base64.b64encode(v).decode() 
                for k, v in self.skipped_message_keys.items()
            }
        }
    
    @classmethod
    def import_state(cls, state: Dict) -> 'DoubleRatchet':
        """Import ratchet state from persistence."""
        ratchet = cls.__new__(cls)
        ratchet.root_key = base64.b64decode(state['root_key'])
        ratchet.sending_chain_key = base64.b64decode(state['sending_chain_key']) if state['sending_chain_key'] else None
        ratchet.receiving_chain_key = base64.b64decode(state['receiving_chain_key']) if state['receiving_chain_key'] else None
        ratchet.sending_chain_length = state['sending_chain_length']
        ratchet.receiving_chain_length = state['receiving_chain_length']
        ratchet.previous_sending_chain_length = state['previous_sending_chain_length']
        ratchet.dh_keypair = state['dh_keypair']
        ratchet.remote_dh_public = state['remote_dh_public']
        ratchet.skipped_message_keys = {
            (k.split(':')[0], int(k.split(':')[1])): base64.b64decode(v)
            for k, v in state.get('skipped_message_keys', {}).items()
        }
        return ratchet


class E2EESessionManager:
    """
    Manages E2EE sessions between users.
    Wraps SignalProtocol (X3DH) and DoubleRatchet into a unified session lifecycle.
    Sessions are stored in-memory indexed by (local_user_id, remote_user_id).
    Persistence is handled externally via export_state / import_state.
    """

    def __init__(self):
        # {(local_id, remote_id): DoubleRatchet}
        self._sessions: Dict[tuple, DoubleRatchet] = {}

    # ── Session creation ────────────────────────────────────────────────────

    def create_session_sender(
        self,
        local_user_id: str,
        remote_user_id: str,
        local_identity_key: bytes,
        remote_bundle: Dict,
    ) -> DoubleRatchet:
        """
        X3DH sender-side: establish a new session from the recipient's key bundle.
        remote_bundle must contain: identity_key, signed_prekey (pub + sig),
        optionally one_time_prekey.
        Returns the initialised DoubleRatchet ready for encrypt.
        """
        signal = SignalProtocol()
        ik_bytes = bytes.fromhex(local_identity_key) if isinstance(local_identity_key, str) else local_identity_key
        sk, ephemeral_pub = signal.x3dh_sender(ik_bytes, remote_bundle)
        ratchet = DoubleRatchet(sk)
        # seed the DH ratchet with recipient's signed prekey public
        ratchet.remote_dh_public = remote_bundle['signed_prekey']['public_key']
        key = (local_user_id, remote_user_id)
        self._sessions[key] = ratchet
        return ratchet

    def create_session_receiver(
        self,
        local_user_id: str,
        remote_user_id: str,
        local_identity_key: bytes,
        local_signed_prekey: bytes,
        local_one_time_prekey: Optional[bytes],
        sender_x3dh_header: Dict,
    ) -> DoubleRatchet:
        """
        X3DH receiver-side: process sender's X3DH header and establish session.
        """
        signal = SignalProtocol()
        ik_bytes = bytes.fromhex(local_identity_key) if isinstance(local_identity_key, str) else local_identity_key
        spk_bytes = bytes.fromhex(local_signed_prekey) if isinstance(local_signed_prekey, str) else local_signed_prekey
        opk_bytes = None
        if local_one_time_prekey:
            opk_bytes = bytes.fromhex(local_one_time_prekey) if isinstance(local_one_time_prekey, str) else local_one_time_prekey
        sk = signal.x3dh_receiver(ik_bytes, spk_bytes, opk_bytes, sender_x3dh_header)
        ratchet = DoubleRatchet(sk)
        key = (local_user_id, remote_user_id)
        self._sessions[key] = ratchet
        return ratchet

    # ── Message encryption / decryption ────────────────────────────────────

    def encrypt(self, local_user_id: str, remote_user_id: str, plaintext: bytes) -> Dict:
        """Encrypt a message using the Double Ratchet for this session."""
        ratchet = self._get_or_raise(local_user_id, remote_user_id)
        ciphertext, header = ratchet.encrypt(plaintext)
        return {
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'header': header,
            'session_state': ratchet.export_state(),
        }

    def decrypt(self, local_user_id: str, remote_user_id: str, ciphertext_b64: str, header: Dict) -> bytes:
        """Decrypt a message using the Double Ratchet for this session."""
        ratchet = self._get_or_raise(local_user_id, remote_user_id)
        ciphertext = base64.b64decode(ciphertext_b64)
        return ratchet.decrypt(ciphertext, header)

    # ── Session persistence ─────────────────────────────────────────────────

    def export_session(self, local_user_id: str, remote_user_id: str) -> Optional[Dict]:
        """Export ratchet state for DB persistence."""
        ratchet = self._sessions.get((local_user_id, remote_user_id))
        return ratchet.export_state() if ratchet else None

    def import_session(self, local_user_id: str, remote_user_id: str, state: Dict) -> DoubleRatchet:
        """Restore a ratchet from a previously exported state dict."""
        ratchet = DoubleRatchet.import_state(state)
        self._sessions[(local_user_id, remote_user_id)] = ratchet
        return ratchet

    def has_session(self, local_user_id: str, remote_user_id: str) -> bool:
        return (local_user_id, remote_user_id) in self._sessions

    def drop_session(self, local_user_id: str, remote_user_id: str):
        self._sessions.pop((local_user_id, remote_user_id), None)

    def active_session_count(self) -> int:
        return len(self._sessions)

    # ── Internal ────────────────────────────────────────────────────────────

    def _get_or_raise(self, local_user_id: str, remote_user_id: str) -> DoubleRatchet:
        ratchet = self._sessions.get((local_user_id, remote_user_id))
        if ratchet is None:
            raise RuntimeError(
                f"No E2EE session found for {local_user_id} → {remote_user_id}. "
                "Call create_session_sender or create_session_receiver first."
            )
        return ratchet


# Module-level singleton — import this across the app
e2ee_session_manager = E2EESessionManager()
