"""
Encryption service for message encryption/decryption at scale.
Supports various encryption algorithms and key management.
"""
import os
import base64
import json
import logging
from typing import Dict, Tuple, Optional
from datetime import datetime
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import secrets

logger = logging.getLogger(__name__)


class KeyManager:
    """Manage encryption keys with rotation and versioning."""
    
    def __init__(self):
        self.current_key_version = 1
        self.keys = {}  # version -> key_material
        self.rotation_schedule = {}
    
    def generate_master_key(self, password: str, salt: Optional[bytes] = None) -> bytes:
        """Generate master key from password using PBKDF2."""
        if salt is None:
            salt = os.urandom(32)
        
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=480000,  # NIST recommended 2024
            backend=default_backend()
        )
        master_key = kdf.derive(password.encode())
        
        self.keys[self.current_key_version] = {
            'key': master_key,
            'salt': base64.b64encode(salt).decode(),
            'created_at': datetime.utcnow().isoformat(),
        }
        
        return master_key
    
    def rotate_key(self, new_password: str):
        """Rotate to new master key version."""
        old_version = self.current_key_version
        self.current_key_version += 1
        
        new_key = self.generate_master_key(new_password)
        
        logger.info(f"Key rotated from v{old_version} to v{self.current_key_version}")
    
    def get_current_key(self) -> bytes:
        """Get current active key."""
        if self.current_key_version not in self.keys:
            raise ValueError(f"Key version {self.current_key_version} not found")
        return self.keys[self.current_key_version]['key']
    
    def get_key_version(self, version: int) -> bytes:
        """Get key by version (for decryption of old messages)."""
        if version not in self.keys:
            raise ValueError(f"Key version {version} not found")
        return self.keys[version]['key']


class EncryptionService:
    """Encrypt and decrypt messages using modern algorithms."""
    
    AES_256_GCM = 'AES-256-GCM'
    XCHACHA20_POLY1305 = 'XChaCha20-Poly1305'
    
    def __init__(self, key_manager: KeyManager):
        self.key_manager = key_manager
    
    def encrypt_message(self, plaintext: str, associated_data: str = '',
                       algorithm: str = AES_256_GCM,
                       key_version: Optional[int] = None) -> Dict:
        """
        Encrypt message with authenticated encryption.
        
        Returns dict with:
        - ciphertext: base64-encoded encrypted data
        - nonce: base64-encoded nonce
        - tag: base64-encoded authentication tag
        - algorithm: algorithm used
        - key_version: key version used
        """
        if key_version is None:
            key_version = self.key_manager.current_key_version
        
        encryption_key = self.key_manager.get_key_version(key_version)
        
        if algorithm == self.AES_256_GCM:
            return self._encrypt_aes_256_gcm(
                plaintext, associated_data, encryption_key, key_version
            )
        elif algorithm == self.XCHACHA20_POLY1305:
            return self._encrypt_xchacha20_poly1305(
                plaintext, associated_data, encryption_key, key_version
            )
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")
    
    def decrypt_message(self, encrypted_data: Dict, associated_data: str = '') -> str:
        """Decrypt message."""
        algorithm = encrypted_data.get('algorithm', self.AES_256_GCM)
        key_version = encrypted_data.get('key_version', 
                                        self.key_manager.current_key_version)
        
        try:
            decryption_key = self.key_manager.get_key_version(key_version)
        except ValueError:
            logger.error(f"Key version {key_version} not found for decryption")
            raise
        
        if algorithm == self.AES_256_GCM:
            return self._decrypt_aes_256_gcm(encrypted_data, associated_data, decryption_key)
        elif algorithm == self.XCHACHA20_POLY1305:
            return self._decrypt_xchacha20_poly1305(encrypted_data, associated_data, decryption_key)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")
    
    @staticmethod
    def _encrypt_aes_256_gcm(plaintext: str, associated_data: str,
                            key: bytes, key_version: int) -> Dict:
        """AES-256-GCM encryption."""
        nonce = os.urandom(12)  # 96-bit nonce
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(nonce),
            backend=default_backend()
        )
        encryptor = cipher.encryptor()
        if associated_data:
            encryptor.authenticate_additional_data(associated_data.encode())
        ciphertext = encryptor.update(plaintext.encode()) + encryptor.finalize()
        
        return {
            'ciphertext': base64.b64encode(ciphertext).decode(),
            'nonce': base64.b64encode(nonce).decode(),
            'tag': base64.b64encode(encryptor.tag).decode(),
            'algorithm': 'AES-256-GCM',
            'key_version': key_version,
        }
    
    @staticmethod
    def _decrypt_aes_256_gcm(encrypted_data: Dict, associated_data: str,
                            key: bytes) -> str:
        """AES-256-GCM decryption."""
        ciphertext = base64.b64decode(encrypted_data['ciphertext'])
        nonce = base64.b64decode(encrypted_data['nonce'])
        tag = base64.b64decode(encrypted_data['tag'])
        
        cipher = Cipher(
            algorithms.AES(key),
            modes.GCM(nonce, tag),
            backend=default_backend()
        )
        decryptor = cipher.decryptor()
        if associated_data:
            decryptor.authenticate_additional_data(associated_data.encode())
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        
        return plaintext.decode()
    
    @staticmethod
    def _encrypt_xchacha20_poly1305(plaintext: str, associated_data: str,
                                   key: bytes, key_version: int) -> Dict:
        """XChaCha20-Poly1305 encryption (future-proof)."""
        # Note: Requires additional dependencies like PyNaCl
        # This is a placeholder for the pattern
        raise NotImplementedError("XChaCha20-Poly1305 requires PyNaCl dependency")
    
    @staticmethod
    def _decrypt_xchacha20_poly1305(encrypted_data: Dict, associated_data: str,
                                   key: bytes) -> str:
        """XChaCha20-Poly1305 decryption."""
        raise NotImplementedError("XChaCha20-Poly1305 requires PyNaCl dependency")


class PasswordHasher:
    """Securely hash passwords using Argon2."""
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password with Argon2."""
        try:
            from argon2 import PasswordHasher
            ph = PasswordHasher(
                time_cost=2,
                memory_cost=65536,
                parallelism=4,
                hash_len=32,
                salt_len=16,
            )
            return ph.hash(password)
        except ImportError:
            # Fallback to bcrypt if argon2 not available
            import bcrypt
            return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()
    
    @staticmethod
    def verify_password(password: str, hash_str: str) -> bool:
        """Verify password against hash."""
        try:
            from argon2 import PasswordHasher
            from argon2.exceptions import VerifyMismatchError, VerificationError
            ph = PasswordHasher()
            try:
                ph.verify(hash_str, password)
                return True
            except (VerifyMismatchError, VerificationError):
                return False
        except ImportError:
            import bcrypt
            return bcrypt.checkpw(password.encode(), hash_str.encode())


class DataEncryption:
    """Encrypt data at rest in database."""
    
    def __init__(self, encryption_service: EncryptionService):
        self.enc = encryption_service
    
    def encrypt_field(self, value: str, field_name: str = '') -> str:
        """Encrypt a database field."""
        encrypted = self.enc.encrypt_message(value, field_name)
        return json.dumps(encrypted)
    
    def decrypt_field(self, encrypted_json: str, field_name: str = '') -> str:
        """Decrypt a database field."""
        encrypted = json.loads(encrypted_json)
        return self.enc.decrypt_message(encrypted, field_name)
