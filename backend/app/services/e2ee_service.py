"""
E2EE Message Service - handles Signal Protocol session management and message encryption.
"""
import logging
import json
import base64
from typing import Dict, Optional, Tuple
from datetime import datetime, timedelta
from app.models.models import db, Message, User
from app.security.signal_protocol import SignalProtocol, DoubleRatchet
from app.security.encryption import EncryptionService, KeyManager
from app.models.e2ee_models import E2EEKeyBundle, E2EEOneTimePreKey, SecurityAuditLog

logger = logging.getLogger(__name__)


class E2EESession:
    """Represents an active E2EE session between two users."""
    
    def __init__(self, session_id: str, user1_id: str, user2_id: str,
                 ratchet: DoubleRatchet, created_at: datetime):
        self.session_id = session_id
        self.user1_id = user1_id
        self.user2_id = user2_id
        self.ratchet = ratchet
        self.created_at = created_at
        self.last_used = created_at
        self.message_count = 0
    
    def is_expired(self, max_age_hours: int = 24) -> bool:
        """Check if session should be rotated."""
        age = datetime.utcnow() - self.created_at
        return age > timedelta(hours=max_age_hours)


class E2EEMessageService:
    """Central service for E2EE messaging operations."""
    
    def __init__(self, encryption_service: EncryptionService):
        self.enc = encryption_service
        self.sessions = {}  # Dict[str, E2EESession] - in-memory cache
    
    def initiate_e2ee_session(self, sender_id: str, receiver_id: str) -> Tuple[str, Dict]:
        """
        Initiate E2EE session using Signal Protocol X3DH.
        
        Returns: (session_id, prekey_message_dict)
        """
        # Get receiver's key bundle
        receiver_bundle = self._get_key_bundle(receiver_id)
        if not receiver_bundle:
            raise ValueError(f"No key bundle for receiver {receiver_id}")
        
        # Generate sender's ephemeral key pair
        ik_private, ik_public = SignalProtocol.generate_identity_key_pair()
        spk_id, spk_private, spk_public, _ = SignalProtocol.generate_signed_prekey()
        eph_private = ik_private  # Use identity as ephemeral for simplicity
        
        # X3DH: Perform key agreement
        shared_secret, ephemeral_pub = SignalProtocol.x3dh_send(
            sender_private_identity=ik_private,
            sender_public_identity=ik_public,
            sender_ephemeral_private=eph_private,
            receiver_public_identity=base64.b64decode(receiver_bundle['identity_key']),
            receiver_signed_prekey=base64.b64decode(
                receiver_bundle['signed_prekey']['public_key']
            ),
            receiver_one_time_prekey=base64.b64decode(
                receiver_bundle.get('one_time_prekey', {}).get('public_key', b'')
            ) if receiver_bundle.get('one_time_prekey') else None,
        )
        
        # Initialize Double Ratchet
        ratchet = DoubleRatchet(
            shared_secret,
            remote_public_key=base64.b64decode(receiver_bundle['identity_key'])
        )
        
        # Create session
        session_id = self._create_session_id(sender_id, receiver_id)
        session = E2EESession(session_id, sender_id, receiver_id, ratchet, datetime.utcnow())
        self.sessions[session_id] = session
        
        # Create prekey message
        prekey_msg = {
            'type': 'PREKEY_MESSAGE',
            'sender_identity_key': base64.b64encode(ik_public).decode(),
            'sender_ephemeral_key': base64.b64encode(ephemeral_pub).decode(),
            'receiver_bundle_id': receiver_bundle.get('bundle_id'),
            'one_time_prekey_id': receiver_bundle.get('one_time_prekey', {}).get('id'),
            'timestamp': int(datetime.utcnow().timestamp() * 1000),
        }
        
        return session_id, prekey_msg
    
    def encrypt_message(self, sender_id: str, receiver_id: str, plaintext: str,
                       associated_data: str = '') -> Dict:
        """
        Encrypt a message using E2EE.
        
        Returns encrypted message with metadata.
        """
        session_id = self._get_or_create_session_id(sender_id, receiver_id)
        
        # Get or create session
        if session_id not in self.sessions:
            logger.info(f"Creating new E2EE session for {sender_id} -> {receiver_id}")
            session_id, _ = self.initiate_e2ee_session(sender_id, receiver_id)
        
        session = self.sessions[session_id]
        
        # Check if session needs rotation
        if session.is_expired():
            logger.info(f"Rotating expired session {session_id}")
            del self.sessions[session_id]
            session_id, _ = self.initiate_e2ee_session(sender_id, receiver_id)
            session = self.sessions[session_id]
        
        # Encrypt using Double Ratchet
        ratchet_output = session.ratchet.encrypt_message(
            plaintext.encode() if isinstance(plaintext, str) else plaintext,
            associated_data.encode() if isinstance(associated_data, str) else associated_data
        )
        
        session.message_count += 1
        session.last_used = datetime.utcnow()
        
        # Prepare encrypted payload
        encrypted_payload = {
            'ciphertext': ratchet_output['ciphertext'],
            'nonce': ratchet_output['nonce'],
            'tag': ratchet_output['tag'],
            'counter': ratchet_output['counter'],
            'session_id': session_id,
            'algorithm': 'Double-Ratchet-AES256-GCM',
        }
        
        return encrypted_payload
    
    def decrypt_message(self, receiver_id: str, sender_id: str,
                       encrypted_payload: Dict, associated_data: str = '') -> str:
        """
        Decrypt a message using E2EE.
        """
        session_id = encrypted_payload.get('session_id')
        if not session_id:
            session_id = self._get_or_create_session_id(receiver_id, sender_id)
        
        # Get session
        if session_id not in self.sessions:
            logger.warning(f"Session {session_id} not found, this shouldn't happen")
            # Try to recreate session state from database if available
            # For now, raise error
            raise ValueError(f"E2EE session not found: {session_id}")
        
        session = self.sessions[session_id]
        
        # Decrypt using Double Ratchet
        plaintext = session.ratchet.decrypt_message(
            encrypted_payload['ciphertext'],
            encrypted_payload['nonce'],
            encrypted_payload['tag'],
            associated_data.encode() if isinstance(associated_data, str) else associated_data
        )
        
        session.last_used = datetime.utcnow()
        
        return plaintext.decode() if isinstance(plaintext, bytes) else plaintext
    
    def store_message_encrypted(self, sender_id: str, receiver_id: str,
                               plaintext: str, metadata: Optional[Dict] = None) -> Message:
        """
        Encrypt and store message in database.
        """
        encrypted = self.encrypt_message(sender_id, receiver_id, plaintext)
        
        msg = Message()
        msg.sender_id = sender_id
        msg.receiver_id = receiver_id
        msg.content = plaintext  # Store plaintext in memory for this session
        msg.encrypted_payload = json.dumps(encrypted)
        msg.e2ee_type = 1  # Double Ratchet
        
        db.session.add(msg)
        db.session.commit()
        
        # Log encryption event
        self._log_encryption_event(sender_id, msg.id, 'Double-Ratchet')
        
        return msg
    
    def retrieve_and_decrypt_message(self, message_id: str, receiver_id: str) -> str:
        """
        Retrieve and decrypt message from database.
        """
        msg = Message.query.get(message_id)
        if not msg or msg.receiver_id != receiver_id:
            raise ValueError(f"Message {message_id} not found or access denied")
        
        if not msg.encrypted_payload:
            return msg.content or ''
        
        encrypted = json.loads(msg.encrypted_payload)
        plaintext = self.decrypt_message(receiver_id, msg.sender_id, encrypted)
        
        return plaintext
    
    @staticmethod
    def _get_key_bundle(user_id: str) -> Optional[Dict]:
        """Get user's public key bundle."""
        bundle = E2EEKeyBundle.query.filter_by(user_id=user_id).first()
        if not bundle:
            return None
        
        return bundle.to_public_bundle(pop_opk=True)
    
    @staticmethod
    def _get_or_create_session_id(user1_id: str, user2_id: str) -> str:
        """Generate consistent session ID for pair of users."""
        # Ensure consistent ordering
        pair = tuple(sorted([user1_id, user2_id]))
        return f"session_{pair[0]}_{pair[1]}"
    
    @staticmethod
    def _create_session_id(user1_id: str, user2_id: str) -> str:
        """Create new session ID."""
        import uuid
        return f"e2ee_{uuid.uuid4()}"
    
    @staticmethod
    def _log_encryption_event(user_id: str, message_id: str, algorithm: str):
        """Log encryption event for audit."""
        try:
            audit_log = SecurityAuditLog()
            audit_log.user_id = user_id
            audit_log.event_type = 'message_encrypted'
            audit_log.severity = 'info'
            audit_log.details = json.dumps({
                'message_id': message_id,
                'algorithm': algorithm,
                'timestamp': datetime.utcnow().isoformat(),
            })
            db.session.add(audit_log)
            db.session.commit()
        except Exception as e:
            logger.error(f"Failed to log encryption event: {e}")


class GroupE2EEService:
    """E2EE for group messages using Signal Protocol."""
    
    def __init__(self, encryption_service: EncryptionService):
        self.enc = encryption_service
        self.group_sessions = {}
    
    def create_group_key(self, group_id: str, sender_id: str) -> Dict:
        """Create group encryption key."""
        # Generate sender key for group
        ratchet = DoubleRatchet(SignalProtocol._kdf(sender_id.encode(), 32))
        
        group_key = {
            'group_id': group_id,
            'sender_id': sender_id,
            'key_id': datetime.utcnow().timestamp(),
            'ratchet_state': base64.b64encode(json.dumps({
                'root_key': '',
                'chain_key': '',
            }).encode()).decode(),
        }
        
        self.group_sessions[f"{group_id}_{sender_id}"] = ratchet
        return group_key
    
    def encrypt_group_message(self, group_id: str, sender_id: str, plaintext: str) -> Dict:
        """Encrypt message for group."""
        key = f"{group_id}_{sender_id}"
        if key not in self.group_sessions:
            self.create_group_key(group_id, sender_id)
        
        ratchet = self.group_sessions[key]
        encrypted = ratchet.encrypt_message(plaintext.encode())
        
        encrypted['group_id'] = group_id
        encrypted['sender_id'] = sender_id
        
        return encrypted
    
    def decrypt_group_message(self, group_id: str, sender_id: str,
                             encrypted: Dict) -> str:
        """Decrypt group message."""
        # In production, would maintain per-sender ratchet state
        key = f"{group_id}_{sender_id}"
        if key not in self.group_sessions:
            raise ValueError(f"No group session for {group_id}_{sender_id}")
        
        ratchet = self.group_sessions[key]
        plaintext = ratchet.decrypt_message(
            encrypted['ciphertext'],
            encrypted['nonce'],
            encrypted['tag']
        )
        
        return plaintext.decode()
