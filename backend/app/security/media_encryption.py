"""
E2EE for WebRTC Media Streams
AES-256-GCM encryption for RTP packets with frame-level encryption
"""
import os
import hashlib
import hmac
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
import secrets
import base64
from typing import Tuple

class MediaEncryption:
    """Encrypt/decrypt WebRTC media frames"""
    
    def __init__(self):
        self.master_key = None
        self.salt = None
        self.frame_cipher = None
        self.frame_count = 0
        
    def generate_session_key(self) -> Tuple[bytes, bytes]:
        """Generate new session key and salt"""
        self.master_key = AESGCM.generate_key(bit_length=256)
        self.salt = os.urandom(16)
        self.frame_cipher = AESGCM(self.master_key)
        self.frame_count = 0
        return self.master_key, self.salt
    
    def set_session_key(self, master_key: bytes, salt: bytes):
        """Set session key from peer"""
        self.master_key = master_key
        self.salt = salt
        self.frame_cipher = AESGCM(master_key)
        self.frame_count = 0
    
    def encrypt_frame(self, frame_data: bytes) -> bytes:
        """Encrypt single media frame"""
        if not self.frame_cipher:
            raise ValueError("Session key not initialized")
        
        # Use frame counter as nonce (96-bit)
        nonce = self.frame_count.to_bytes(12, 'big')
        self.frame_count += 1
        
        # Encrypt frame
        encrypted = self.frame_cipher.encrypt(nonce, frame_data, None)
        
        # Return nonce + encrypted data
        return nonce + encrypted
    
    def decrypt_frame(self, encrypted_frame: bytes) -> bytes:
        """Decrypt single media frame"""
        if not self.frame_cipher:
            raise ValueError("Session key not initialized")
        
        # Extract nonce and ciphertext
        nonce = encrypted_frame[:12]
        ciphertext = encrypted_frame[12:]
        
        # Decrypt frame
        frame_data = self.frame_cipher.decrypt(nonce, ciphertext, None)
        return frame_data
    
    def derive_peer_key(self, shared_secret: bytes, peer_id: str) -> bytes:
        """Derive encryption key for specific peer using HKDF"""
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=self.salt,
            info=f"vipchat-webrtc-{peer_id}".encode(),
            backend=default_backend()
        )
        return hkdf.derive(shared_secret)
    
    def rotate_key(self):
        """Rotate encryption key (every 30 seconds recommended)"""
        return self.generate_session_key()
    
    def export_key(self) -> str:
        """Export key for signaling exchange"""
        if not self.master_key or not self.salt:
            raise ValueError("No key to export")
        
        key_material = base64.b64encode(self.master_key + self.salt).decode()
        return key_material
    
    def import_key(self, key_material: str):
        """Import key from peer"""
        decoded = base64.b64decode(key_material)
        master_key = decoded[:32]
        salt = decoded[32:]
        self.set_session_key(master_key, salt)

class GroupCallKeyManager:
    """Manage encryption keys for group calls"""
    
    def __init__(self):
        self.participant_keys = {}  # peer_id -> MediaEncryption
        self.group_master_key = None
        
    def initialize_group_call(self):
        """Generate master key for group call"""
        self.group_master_key = AESGCM.generate_key(bit_length=256)
        return base64.b64encode(self.group_master_key).decode()
    
    def add_participant(self, peer_id: str) -> MediaEncryption:
        """Add new participant with dedicated encryption"""
        media_enc = MediaEncryption()
        
        if self.group_master_key:
            # Derive peer-specific key from group master
            salt = os.urandom(16)
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                info=f"vipchat-peer-{peer_id}".encode(),
                backend=default_backend()
            )
            peer_key = hkdf.derive(self.group_master_key)
            media_enc.set_session_key(peer_key, salt)
        else:
            media_enc.generate_session_key()
        
        self.participant_keys[peer_id] = media_enc
        return media_enc
    
    def remove_participant(self, peer_id: str):
        """Remove participant encryption"""
        self.participant_keys.pop(peer_id, None)
    
    def get_participant_encryption(self, peer_id: str) -> MediaEncryption:
        """Get encryption for specific peer"""
        return self.participant_keys.get(peer_id)

# Global instances
media_encryption = MediaEncryption()
group_key_manager = GroupCallKeyManager()
