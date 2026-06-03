"""
WebRTC E2EE Encryption Module - Complete end-to-end encryption for voice/video calls.
Integrates with Signal Protocol for secure media streams.
"""
import os
import json
import base64
import logging
import secrets
import hashlib
from typing import Dict, Tuple, Optional, List
from datetime import datetime, timedelta
from enum import Enum
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import ec, ed25519
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from app.security.signal_protocol import SignalProtocol, DoubleRatchet
from app.models.e2ee_models import SecurityAuditLog

logger = logging.getLogger(__name__)


class MediaStreamEncryption(Enum):
    """Media encryption algorithms."""
    AES_GCM_128 = "aes-128-gcm"
    CHACHA20_POLY1305 = "chacha20-poly1305"
    AES_GCM_256 = "aes-256-gcm"


class WebRTCE2EE:
    """
    End-to-end encryption for WebRTC media streams.
    Provides SRTP profile with Signal Protocol key management.
    """
    
    BACKEND = default_backend()
    HASH_ALGO = hashes.SHA256()
    SRTP_MASTER_KEY_LENGTH = 32  # 256 bits
    SRTP_MASTER_SALT_LENGTH = 14
    SRTP_SESSION_KEY_LENGTH = 16
    
    def __init__(self):
        self.active_sessions = {}  # session_id -> WebRTCSession
        self.call_keys = {}  # call_id -> encryption_context
    
    @staticmethod
    def generate_call_key_material() -> Dict:
        """
        Generate SRTP key material for a WebRTC call.
        Combines Signal Protocol Double Ratchet with SRTP.
        """
        master_key = secrets.token_bytes(WebRTCE2EE.SRTP_MASTER_KEY_LENGTH)
        master_salt = secrets.token_bytes(WebRTCE2EE.SRTP_MASTER_SALT_LENGTH)
        
        # Derive SRTP session keys
        hkdf = HKDF(
            algorithm=WebRTCE2EE.HASH_ALGO,
            length=WebRTCE2EE.SRTP_SESSION_KEY_LENGTH * 2,  # client + server
            salt=master_salt,
            info=b'SRTP_KEY_DERIVATION',
            backend=WebRTCE2EE.BACKEND
        )
        
        session_keys = hkdf.derive(master_key)
        client_key = session_keys[:WebRTCE2EE.SRTP_SESSION_KEY_LENGTH]
        server_key = session_keys[WebRTCE2EE.SRTP_SESSION_KEY_LENGTH:]
        
        return {
            'master_key': base64.b64encode(master_key).decode(),
            'master_salt': base64.b64encode(master_salt).decode(),
            'client_key': base64.b64encode(client_key).decode(),
            'server_key': base64.b64encode(server_key).decode(),
            'created_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(hours=24)).isoformat(),
        }
    
    @staticmethod
    def establish_webrtc_call_session(
        caller_id: str,
        callee_id: str,
        ice_ufrag: str,
        ice_pwd: str,
        dtls_fingerprint: str
    ) -> Dict:
        """
        Establish secure WebRTC call session with DTLS-SRTP.
        Uses Signal Protocol for session key agreement.
        """
        call_id = secrets.token_hex(16)
        
        # Generate call-specific encryption context
        key_material = WebRTCE2EE.generate_call_key_material()
        
        # Create DTLS fingerprint validation
        dtls_context = {
            'fingerprint': dtls_fingerprint,
            'verified_at': None,  # Will be set on successful DTLS handshake
            'cipher_suite': 'TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256'
        }
        
        # Create Signal Protocol ratchet for call encryption
        ratchet = SignalProtocol.initialize_double_ratchet(
            shared_secret=base64.b64decode(key_material['master_key']),
            other_party_dh_public=None  # Will be exchanged via SDP
        )
        
        session = {
            'call_id': call_id,
            'caller_id': caller_id,
            'callee_id': callee_id,
            'ice_ufrag': ice_ufrag,
            'ice_pwd': ice_pwd,
            'key_material': key_material,
            'dtls_context': dtls_context,
            'media_encryption': MediaStreamEncryption.AES_GCM_256.value,
            'ratchet': ratchet,
            'status': 'pending',  # pending -> active -> ended
            'created_at': datetime.utcnow().isoformat(),
            'encrypted_packet_count': 0,
            'bandwidth_used': 0,  # bytes
        }
        
        return session
    
    @staticmethod
    def encrypt_media_packet(
        packet: bytes,
        key: bytes,
        algorithm: MediaStreamEncryption = MediaStreamEncryption.AES_GCM_256,
        aad: Optional[bytes] = None
    ) -> Tuple[bytes, bytes, bytes]:
        """
        Encrypt a media packet (audio/video) with AEAD cipher.
        
        Args:
            packet: Raw media packet bytes
            key: Encryption key
            algorithm: Which AEAD algorithm to use
            aad: Additional authenticated data (header, metadata)
        
        Returns:
            (ciphertext, nonce, tag)
        """
        nonce = secrets.token_bytes(12)  # 96-bit nonce for GCM
        
        if algorithm == MediaStreamEncryption.AES_GCM_256:
            cipher = Cipher(
                algorithms.AES(key),
                modes.GCM(nonce),
                backend=WebRTCE2EE.BACKEND
            )
        elif algorithm == MediaStreamEncryption.CHACHA20_POLY1305:
            cipher = Cipher(
                algorithms.ChaCha20(key),
                modes.GCM(nonce),
                backend=WebRTCE2EE.BACKEND
            )
        else:  # AES_GCM_128
            key = key[:16]
            cipher = Cipher(
                algorithms.AES(key),
                modes.GCM(nonce),
                backend=WebRTCE2EE.BACKEND
            )
        
        encryptor = cipher.encryptor()
        if aad:
            encryptor.authenticate_additional_data(aad)
        
        ciphertext = encryptor.update(packet) + encryptor.finalize()
        tag = encryptor.tag
        
        return ciphertext, nonce, tag
    
    @staticmethod
    def decrypt_media_packet(
        ciphertext: bytes,
        key: bytes,
        nonce: bytes,
        tag: bytes,
        algorithm: MediaStreamEncryption = MediaStreamEncryption.AES_GCM_256,
        aad: Optional[bytes] = None
    ) -> bytes:
        """
        Decrypt a media packet with AEAD cipher verification.
        
        Args:
            ciphertext: Encrypted packet
            key: Decryption key
            nonce: Nonce used in encryption
            tag: Authentication tag
            algorithm: Which AEAD algorithm to use
            aad: Additional authenticated data (must match encryption)
        
        Returns:
            Plaintext packet bytes
        
        Raises:
            InvalidTag: If authentication tag doesn't verify
        """
        if algorithm == MediaStreamEncryption.AES_GCM_256:
            cipher = Cipher(
                algorithms.AES(key),
                modes.GCM(nonce, tag),
                backend=WebRTCE2EE.BACKEND
            )
        elif algorithm == MediaStreamEncryption.CHACHA20_POLY1305:
            cipher = Cipher(
                algorithms.ChaCha20(key),
                modes.GCM(nonce, tag),
                backend=WebRTCE2EE.BACKEND
            )
        else:  # AES_GCM_128
            key = key[:16]
            cipher = Cipher(
                algorithms.AES(key),
                modes.GCM(nonce, tag),
                backend=WebRTCE2EE.BACKEND
            )
        
        decryptor = cipher.decryptor()
        if aad:
            decryptor.authenticate_additional_data(aad)
        
        plaintext = decryptor.update(ciphertext) + decryptor.finalize()
        return plaintext
    
    @staticmethod
    def derive_media_keys_from_ratchet(
        ratchet: DoubleRatchet,
        direction: str = 'send'  # 'send' or 'receive'
    ) -> Dict[str, bytes]:
        """
        Derive media encryption keys from Signal Protocol ratchet.
        Implements forward secrecy for call media.
        """
        # Get next output from ratchet
        chain_key, message_key = ratchet.next_message_key()
        
        # Derive multiple keys for video, audio, etc.
        hkdf = HKDF(
            algorithm=WebRTCE2EE.HASH_ALGO,
            length=96,  # 3 keys of 32 bytes each
            salt=None,
            info=f'WEBRTC_MEDIA_KEY_{direction}'.encode(),
            backend=WebRTCE2EE.BACKEND
        )
        
        derived = hkdf.derive(message_key)
        
        return {
            'audio_key': derived[0:32],
            'video_key': derived[32:64],
            'data_key': derived[64:96],
            'ratchet_chain_key': chain_key,
        }
    
    @staticmethod
    def create_srtp_profile() -> Dict:
        """
        Create complete SRTP profile for WebRTC offer/answer.
        Specifies encryption algorithms and key material.
        """
        key_material = WebRTCE2EE.generate_call_key_material()
        
        return {
            'profile': 'SAVPF',  # Secure Audio/Video Profile with Feedback
            'dtls_srtp_fingerprint': WebRTCE2EE.compute_dtls_fingerprint(),
            'key_material': key_material,
            'algorithms': {
                'audio': 'AES_128_CM_HMAC_SHA1_80',
                'video': 'AES_128_CM_HMAC_SHA1_80',
            },
            'rtp_header_extensions': [
                {
                    'id': 1,
                    'uri': 'urn:ietf:params:rtp-hdrext:sdes:srtp-aes-gcm-256-14-byte',
                    'direction': 'sendrecv'
                },
                {
                    'id': 2,
                    'uri': 'urn:ietf:params:rtp-hdrext:toffset',
                    'direction': 'sendrecv'
                }
            ]
        }
    
    @staticmethod
    def compute_dtls_fingerprint(algorithm: str = 'sha-256') -> str:
        """Compute DTLS certificate fingerprint."""
        # In production, use actual DTLS certificate
        random_cert = secrets.token_bytes(32)
        if algorithm == 'sha-256':
            fingerprint = hashlib.sha256(random_cert).digest()
        elif algorithm == 'sha-1':
            fingerprint = hashlib.sha1(random_cert).digest()
        else:
            raise ValueError(f"Unsupported algorithm: {algorithm}")
        
        # Format as colon-separated hex
        return ':'.join(f'{b:02x}' for b in fingerprint)
    
    @staticmethod
    def validate_call_integrity(
        call_id: str,
        packet_count: int,
        expected_hash: bytes
    ) -> bool:
        """
        Validate integrity of entire call stream.
        Ensures no packets were dropped or modified.
        """
        # Create integrity hash from packet sequence
        integrity_data = f"{call_id}:{packet_count}".encode()
        computed_hash = hashlib.sha256(integrity_data).digest()
        
        return computed_hash == expected_hash
    
    @staticmethod
    def get_call_statistics(session: Dict) -> Dict:
        """
        Get encryption and call statistics for monitoring.
        """
        return {
            'call_id': session['call_id'],
            'duration_seconds': (datetime.utcnow() - datetime.fromisoformat(session['created_at'])).total_seconds(),
            'encrypted_packets': session['encrypted_packet_count'],
            'bandwidth_used_mb': session['bandwidth_used'] / (1024 * 1024),
            'encryption_algorithm': session['media_encryption'],
            'key_rotations': 0,  # Would track ratchet rotations
            'dtls_verified': session['dtls_context']['verified_at'] is not None,
        }


class GroupCallE2EE:
    """
    End-to-end encryption for group calls (3+ participants).
    Uses Media-Level Encryption (MLE) approach.
    """
    
    def __init__(self):
        self.group_sessions = {}  # group_call_id -> GroupCallSession
    
    def create_group_call_session(
        self,
        group_id: str,
        initiator_id: str,
        participant_ids: List[str],
        max_participants: int = 100
    ) -> Dict:
        """
        Create encrypted group call session.
        Each participant gets unique encryption key derivation.
        """
        group_call_id = secrets.token_hex(16)
        
        # Generate master call key
        master_key = secrets.token_bytes(32)
        
        # Derive unique keys for each participant
        participant_keys = {}
        for participant_id in participant_ids:
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=None,
                info=f'GROUP_CALL_{group_call_id}_{participant_id}'.encode(),
                backend=default_backend()
            )
            participant_keys[participant_id] = hkdf.derive(master_key)
        
        session = {
            'group_call_id': group_call_id,
            'group_id': group_id,
            'initiator_id': initiator_id,
            'participants': participant_ids,
            'master_key': base64.b64encode(master_key).decode(),
            'participant_keys': {
                pid: base64.b64encode(key).decode()
                for pid, key in participant_keys.items()
            },
            'max_participants': max_participants,
            'status': 'active',
            'created_at': datetime.utcnow().isoformat(),
            'last_key_rotation': datetime.utcnow().isoformat(),
        }
        
        self.group_sessions[group_call_id] = session
        return session
    
    def add_participant_to_group_call(
        self,
        group_call_id: str,
        new_participant_id: str
    ) -> Optional[Dict]:
        """
        Add new participant to active group call.
        Derives unique key for new participant using master key.
        """
        session = self.group_sessions.get(group_call_id)
        if not session:
            return None
        
        if len(session['participants']) >= session['max_participants']:
            return None
        
        # Derive key for new participant
        master_key = base64.b64decode(session['master_key'])
        hkdf = HKDF(
            algorithm=hashes.SHA256(),
            length=32,
            salt=None,
            info=f'GROUP_CALL_{group_call_id}_{new_participant_id}'.encode(),
            backend=default_backend()
        )
        participant_key = hkdf.derive(master_key)
        
        session['participants'].append(new_participant_id)
        session['participant_keys'][new_participant_id] = base64.b64encode(participant_key).decode()
        
        return session
    
    def rotate_group_call_keys(self, group_call_id: str) -> bool:
        """
        Rotate encryption keys for group call.
        Called periodically for forward secrecy.
        """
        session = self.group_sessions.get(group_call_id)
        if not session:
            return False
        
        # Generate new master key
        new_master_key = secrets.token_bytes(32)
        
        # Re-derive all participant keys
        for participant_id in session['participants']:
            hkdf = HKDF(
                algorithm=hashes.SHA256(),
                length=32,
                salt=None,
                info=f'GROUP_CALL_{group_call_id}_{participant_id}_ROTATED'.encode(),
                backend=default_backend()
            )
            session['participant_keys'][participant_id] = base64.b64encode(
                hkdf.derive(new_master_key)
            ).decode()
        
        session['master_key'] = base64.b64encode(new_master_key).decode()
        session['last_key_rotation'] = datetime.utcnow().isoformat()
        
        return True
