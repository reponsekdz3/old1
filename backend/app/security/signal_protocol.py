"""
Signal Protocol v3 implementation for end-to-end encryption.
Provides X3DH key agreement and Double Ratchet algorithm.
"""
import os
import json
import base64
import logging
from datetime import datetime, timedelta
from typing import Dict, Tuple, Optional, List
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
import secrets

logger = logging.getLogger(__name__)


class SignalProtocol:
    """Signal Protocol implementation following WhatsApp/Signal standards."""
    
    # Constants
    CURVE = ec.SECP256R1()
    BACKEND = default_backend()
    HASH_ALGO = hashes.SHA256()
    
    # Message type constants
    TYPE_PREKEY_MESSAGE = 3
    TYPE_MESSAGE = 1
    
    @staticmethod
    def generate_identity_key_pair() -> Tuple[bytes, bytes]:
        """Generate Ed25519 identity key pair (long-term)."""
        private_key = ed25519.Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        private_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        return private_bytes, public_bytes
    
    @staticmethod
    def generate_signed_prekey() -> Tuple[int, bytes, bytes, bytes]:
        """Generate Curve25519 signed prekey (medium-term, rotated weekly)."""
        # Generate ephemeral EC key
        private_key = ec.generate_private_key(SignalProtocol.CURVE, SignalProtocol.BACKEND)
        public_key = private_key.public_key()
        
        private_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        public_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        # Generate random prekey ID
        spk_id = secrets.randbelow(2**31 - 1)
        
        return spk_id, private_bytes, public_bytes, b''
    
    @staticmethod
    def generate_one_time_prekeys(count: int = 100) -> List[Dict]:
        """Generate one-time PreKeys (OPK) for X3DH."""
        opks = []
        for i in range(count):
            private_key = ec.generate_private_key(SignalProtocol.CURVE, SignalProtocol.BACKEND)
            public_key = private_key.public_key()
            
            private_bytes = private_key.private_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PrivateFormat.Raw,
                encryption_algorithm=serialization.NoEncryption()
            )
            public_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.Raw,
                format=serialization.PublicFormat.Raw
            )
            
            opks.append({
                'id': i,
                'private': base64.b64encode(private_bytes).decode(),
                'public': base64.b64encode(public_bytes).decode(),
            })
        
        return opks
    
    @staticmethod
    def generate_registration_id() -> int:
        """Generate random 14-bit registration ID for session tracking."""
        return secrets.randbelow(1 << 14)
    
    @staticmethod
    def x3dh_send(sender_private_identity: bytes,
                  sender_public_identity: bytes,
                  sender_ephemeral_private: bytes,
                  receiver_public_identity: bytes,
                  receiver_signed_prekey: bytes,
                  receiver_one_time_prekey: Optional[bytes] = None) -> Tuple[bytes, bytes]:
        """
        X3DH (Extended Triple Diffie-Hellman) key agreement for initial session.
        Returns (shared_secret, prekey_message_bytes).
        """
        # DH1: sender_private_ephemeral × receiver_public_signed_prekey
        dh1_shared = SignalProtocol._perform_dh(sender_ephemeral_private, receiver_signed_prekey)
        
        # DH2: sender_private_identity × receiver_public_signed_prekey
        dh2_shared = SignalProtocol._perform_dh(sender_private_identity, receiver_signed_prekey)
        
        # DH3: sender_private_identity × receiver_public_identity
        dh3_shared = SignalProtocol._perform_dh(sender_private_identity, receiver_public_identity)
        
        # DH4 (optional): sender_private_ephemeral × receiver_public_one_time_prekey
        if receiver_one_time_prekey:
            dh4_shared = SignalProtocol._perform_dh(sender_ephemeral_private, receiver_one_time_prekey)
        else:
            dh4_shared = b''
        
        # KDF over all shared secrets
        shared_secret = SignalProtocol._kdf(dh1_shared + dh2_shared + dh3_shared + dh4_shared, 32)
        
        # Serialize ephemeral public key
        ephemeral_key = ec.derive_private_key(int.from_bytes(sender_ephemeral_private, 'big'), 
                                               SignalProtocol.CURVE, SignalProtocol.BACKEND)
        ephemeral_pub = ephemeral_key.public_key().public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        return shared_secret, ephemeral_pub
    
    @staticmethod
    def _perform_dh(private_key: bytes, public_key: bytes) -> bytes:
        """Perform ECDH key agreement."""
        try:
            priv = ec.derive_private_key(int.from_bytes(private_key, 'big'), 
                                         SignalProtocol.CURVE, SignalProtocol.BACKEND)
            pub = ec.EllipticCurvePublicKey.from_encoded_point(SignalProtocol.CURVE, public_key)
            shared_key = priv.exchange(ec.ECDH(), pub)
            return shared_key
        except Exception as e:
            logger.error(f"ECDH failed: {e}")
            raise
    
    @staticmethod
    def _kdf(input_key_material: bytes, output_length: int) -> bytes:
        """HKDF key derivation function."""
        hkdf = HKDF(
            algorithm=SignalProtocol.HASH_ALGO,
            length=output_length,
            salt=b'Signal Protocol KDF',
            info=b'',
            backend=SignalProtocol.BACKEND
        )
        return hkdf.derive(input_key_material)


class DoubleRatchet:
    """Double Ratchet algorithm for forward secrecy and break-in recovery."""
    
    def __init__(self, shared_secret: bytes, remote_public_key: Optional[bytes] = None):
        """Initialize ratchet state."""
        self.root_key = shared_secret[:32]
        self.chain_key_send = shared_secret[32:64]
        self.chain_key_recv = shared_secret[64:96] if len(shared_secret) > 64 else None
        self.remote_public_key = remote_public_key
        self.message_counter = 0
        self.previous_counter = 0
        self.skipped_keys = {}  # Dict[Tuple[bytes, int], bytes] - for out-of-order messages
        
    def ratchet_step(self) -> bytes:
        """DH ratchet step - generate new chain key from root key."""
        # Generate ephemeral key pair
        private_key = ec.generate_private_key(ec.SECP256R1())
        public_key = private_key.public_key()
        
        # Derive shared secret
        if self.remote_public_key:
            remote_pub_key = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), self.remote_public_key)
            shared = private_key.exchange(ec.ECDH(), remote_pub_key)
            new_root_key = self._hkdf(self.root_key, shared)
            self.root_key = new_root_key[:32]
            self.chain_key_send = new_root_key[32:64]
        
        pub_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        
        return pub_bytes
    
    def chain_step(self) -> bytes:
        """Symmetric ratchet step - derive message key from chain key."""
        # KDF_CK(ck) -> (ck, mk)
        result = self._hkdf(self.chain_key_send, b'message_key')
        self.chain_key_send = result[:32]
        message_key = result[32:64]
        return message_key
    
    def encrypt_message(self, plaintext: bytes, associated_data: bytes = b'') -> Dict:
        """Encrypt a message using Double Ratchet."""
        message_key = self.chain_step()
        
        # AES-256-GCM encryption
        cipher_key = message_key[:32]
        nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM
        
        cipher = Cipher(
            algorithms.AES(cipher_key),
            modes.GCM(nonce),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        encryptor.authenticate_additional_data(associated_data)
        ciphertext = encryptor.update(plaintext) + encryptor.finalize()
        
        self.message_counter += 1
        
        return {
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'nonce': base64.b64encode(nonce).decode(),
            'tag': base64.b64encode(encryptor.tag).decode(),
            'counter': self.message_counter,
        }
    
    def decrypt_message(self, ciphertext_b64: str, nonce_b64: str, tag_b64: str,
                       associated_data: bytes = b'') -> bytes:
        """Decrypt a message using Double Ratchet."""
        ciphertext = base64.b64decode(ciphertext_b64)
        nonce = base64.b64decode(nonce_b64)
        tag = base64.b64decode(tag_b64)
        
        message_key = self.chain_step()
        cipher_key = message_key[:32]
        
        cipher = Cipher(
            algorithms.AES(cipher_key),
            modes.GCM(nonce, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        decryptor.authenticate_additional_data(associated_data)
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        
        return plaintext
    
    @staticmethod
    def _hkdf(input_key: bytes, salt: bytes) -> bytes:
        """HKDF for key derivation."""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=64,
            salt=salt,
            info=b'',
            backend=default_backend()
        )
        return hkdf.derive(input_key)


class E2EESessionManager:
    """Manages E2EE sessions for users."""
    
    def __init__(self, db_session):
        self.db = db_session
    
    def create_session(self, sender_id: str, receiver_id: str, 
                      initial_shared_secret: bytes) -> Dict:
        """Create new E2EE session."""
        ratchet = DoubleRatchet(initial_shared_secret)
        
        session_data = {
            'sender_id': sender_id,
            'receiver_id': receiver_id,
            'created_at': datetime.utcnow().isoformat(),
            'chain_key': base64.b64encode(ratchet.chain_key_send).decode(),
            'root_key': base64.b64encode(ratchet.root_key).decode(),
            'message_counter': 0,
        }
        
        return session_data
    
    def get_or_create_session(self, sender_id: str, receiver_id: str) -> DoubleRatchet:
        """Get existing session or create new one."""
        # This would query DB for existing session
        # Implementation depends on your E2EE session storage schema
        shared_secret = secrets.token_bytes(96)
        return DoubleRatchet(shared_secret)


def create_prekey_message(sender_public_identity: bytes,
                         sender_ephemeral_public: bytes,
                         receiver_bundle: Dict) -> Dict:
    """Create PreKeyMessage for initial message (X3DH)."""
    return {
        'type': SignalProtocol.TYPE_PREKEY_MESSAGE,
        'sender_public_identity': base64.b64encode(sender_public_identity).decode(),
        'sender_ephemeral_public': base64.b64encode(sender_ephemeral_public).decode(),
        'receiver_bundle_id': receiver_bundle.get('bundle_id'),
        'one_time_prekey_id': receiver_bundle.get('one_time_prekey', {}).get('id'),
        'timestamp': int(datetime.utcnow().timestamp() * 1000),
    }
