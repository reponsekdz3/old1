"""
Comprehensive tests for WebRTC E2EE encryption module.
"""
import pytest
import secrets
import base64
from datetime import datetime, timedelta
from app.security.webrtc_e2ee import WebRTCE2EE, MediaStreamEncryption, GroupCallE2EE
from app.security.signal_protocol import SignalProtocol, DoubleRatchet


class TestWebRTCE2EE:
    """Test WebRTC E2EE functionality."""
    
    def test_generate_call_key_material(self):
        """Test key material generation for calls."""
        key_material = WebRTCE2EE.generate_call_key_material()
        
        assert 'master_key' in key_material
        assert 'master_salt' in key_material
        assert 'client_key' in key_material
        assert 'server_key' in key_material
        assert 'created_at' in key_material
        assert 'expires_at' in key_material
        
        # Verify keys are properly base64 encoded
        assert isinstance(base64.b64decode(key_material['master_key']), bytes)
        assert isinstance(base64.b64decode(key_material['master_salt']), bytes)
        
        # Verify key lengths
        master_key = base64.b64decode(key_material['master_key'])
        assert len(master_key) == WebRTCE2EE.SRTP_MASTER_KEY_LENGTH
        
        master_salt = base64.b64decode(key_material['master_salt'])
        assert len(master_salt) == WebRTCE2EE.SRTP_MASTER_SALT_LENGTH
    
    def test_establish_webrtc_call_session(self):
        """Test establishing secure WebRTC call session."""
        session = WebRTCE2EE.establish_webrtc_call_session(
            caller_id='user_1',
            callee_id='user_2',
            ice_ufrag='abc123',
            ice_pwd='pwd456',
            dtls_fingerprint='sha-256 AA:BB:CC:DD:EE:FF'
        )
        
        assert 'call_id' in session
        assert session['caller_id'] == 'user_1'
        assert session['callee_id'] == 'user_2'
        assert session['status'] == 'pending'
        assert session['media_encryption'] == MediaStreamEncryption.AES_GCM_256.value
        assert session['encrypted_packet_count'] == 0
        assert session['dtls_context']['verified_at'] is None
    
    def test_encrypt_decrypt_media_packet_aes_gcm_256(self):
        """Test AES-256-GCM media packet encryption/decryption."""
        key = secrets.token_bytes(32)
        packet = b"This is a sample media packet"
        aad = b"RTP header and metadata"
        
        # Encrypt
        ciphertext, nonce, tag = WebRTCE2EE.encrypt_media_packet(
            packet=packet,
            key=key,
            algorithm=MediaStreamEncryption.AES_GCM_256,
            aad=aad
        )
        
        assert ciphertext != packet
        assert len(nonce) == 12  # 96-bit nonce
        assert len(tag) > 0
        
        # Decrypt
        decrypted = WebRTCE2EE.decrypt_media_packet(
            ciphertext=ciphertext,
            key=key,
            nonce=nonce,
            tag=tag,
            algorithm=MediaStreamEncryption.AES_GCM_256,
            aad=aad
        )
        
        assert decrypted == packet
    
    def test_encrypt_decrypt_media_packet_aes_gcm_128(self):
        """Test AES-128-GCM media packet encryption/decryption."""
        key = secrets.token_bytes(32)  # Will be truncated to 16 bytes
        packet = b"Audio frame data"
        
        ciphertext, nonce, tag = WebRTCE2EE.encrypt_media_packet(
            packet=packet,
            key=key,
            algorithm=MediaStreamEncryption.AES_GCM_128
        )
        
        decrypted = WebRTCE2EE.decrypt_media_packet(
            ciphertext=ciphertext,
            key=key,
            nonce=nonce,
            tag=tag,
            algorithm=MediaStreamEncryption.AES_GCM_128
        )
        
        assert decrypted == packet
    
    def test_encrypt_decrypt_media_packet_chacha20(self):
        """Test ChaCha20-Poly1305 media packet encryption/decryption."""
        key = secrets.token_bytes(32)
        packet = b"Video frame data with multiple bytes" * 10
        
        ciphertext, nonce, tag = WebRTCE2EE.encrypt_media_packet(
            packet=packet,
            key=key,
            algorithm=MediaStreamEncryption.CHACHA20_POLY1305
        )
        
        assert ciphertext != packet
        
        decrypted = WebRTCE2EE.decrypt_media_packet(
            ciphertext=ciphertext,
            key=key,
            nonce=nonce,
            tag=tag,
            algorithm=MediaStreamEncryption.CHACHA20_POLY1305
        )
        
        assert decrypted == packet
    
    def test_media_packet_tampering_detection(self):
        """Test that tampering with ciphertext is detected."""
        key = secrets.token_bytes(32)
        packet = b"Original media content"
        
        ciphertext, nonce, tag = WebRTCE2EE.encrypt_media_packet(
            packet=packet,
            key=key,
            algorithm=MediaStreamEncryption.AES_GCM_256
        )
        
        # Tamper with ciphertext
        tampered_ciphertext = bytearray(ciphertext)
        tampered_ciphertext[0] ^= 0xFF  # Flip bits in first byte
        
        # Decryption should fail or raise exception
        with pytest.raises(Exception):  # cryptography raises InvalidTag
            WebRTCE2EE.decrypt_media_packet(
                ciphertext=bytes(tampered_ciphertext),
                key=key,
                nonce=nonce,
                tag=tag,
                algorithm=MediaStreamEncryption.AES_GCM_256
            )
    
    def test_media_packet_aad_validation(self):
        """Test that AAD (Additional Authenticated Data) is properly validated."""
        key = secrets.token_bytes(32)
        packet = b"Media packet"
        aad = b"RTP header with specific values"
        
        ciphertext, nonce, tag = WebRTCE2EE.encrypt_media_packet(
            packet=packet,
            key=key,
            aad=aad
        )
        
        # Decryption with different AAD should fail
        with pytest.raises(Exception):
            WebRTCE2EE.decrypt_media_packet(
                ciphertext=ciphertext,
                key=key,
                nonce=nonce,
                tag=tag,
                aad=b"Different AAD value"
            )
    
    def test_compute_dtls_fingerprint_sha256(self):
        """Test DTLS fingerprint computation."""
        fingerprint = WebRTCE2EE.compute_dtls_fingerprint('sha-256')
        
        assert isinstance(fingerprint, str)
        assert ':' in fingerprint
        parts = fingerprint.split(':')
        assert len(parts) > 0
        for part in parts:
            assert len(part) == 2  # Two hex digits
            int(part, 16)  # Should be valid hex
    
    def test_create_srtp_profile(self):
        """Test SRTP profile creation."""
        profile = WebRTCE2EE.create_srtp_profile()
        
        assert profile['profile'] == 'SAVPF'
        assert 'dtls_srtp_fingerprint' in profile
        assert 'key_material' in profile
        assert 'algorithms' in profile
        assert profile['algorithms']['audio']
        assert profile['algorithms']['video']
        assert 'rtp_header_extensions' in profile
        assert len(profile['rtp_header_extensions']) > 0
    
    def test_get_call_statistics(self):
        """Test call statistics generation."""
        session = WebRTCE2EE.establish_webrtc_call_session(
            caller_id='user_1',
            callee_id='user_2',
            ice_ufrag='test',
            ice_pwd='pwd',
            dtls_fingerprint='aa:bb:cc'
        )
        
        # Simulate some activity
        session['encrypted_packet_count'] = 1000
        session['bandwidth_used'] = 5242880  # 5 MB
        
        stats = WebRTCE2EE.get_call_statistics(session)
        
        assert stats['call_id'] == session['call_id']
        assert stats['encrypted_packets'] == 1000
        assert stats['bandwidth_used_mb'] == 5.0
        assert stats['encryption_algorithm'] == MediaStreamEncryption.AES_GCM_256.value
        assert stats['dtls_verified'] == False


class TestGroupCallE2EE:
    """Test group call E2EE functionality."""
    
    def test_create_group_call_session(self):
        """Test creating group call session."""
        group_e2ee = GroupCallE2EE()
        
        participants = ['user_1', 'user_2', 'user_3', 'user_4']
        session = group_e2ee.create_group_call_session(
            group_id='group_123',
            initiator_id='user_1',
            participant_ids=participants
        )
        
        assert 'group_call_id' in session
        assert session['group_id'] == 'group_123'
        assert session['initiator_id'] == 'user_1'
        assert len(session['participants']) == 4
        assert session['status'] == 'active'
        assert len(session['participant_keys']) == 4
        
        # Each participant should have unique key
        keys = list(session['participant_keys'].values())
        assert len(keys) == len(set(keys))
    
    def test_add_participant_to_group_call(self):
        """Test adding new participant to group call."""
        group_e2ee = GroupCallE2EE()
        
        initial_participants = ['user_1', 'user_2']
        session = group_e2ee.create_group_call_session(
            group_id='group_123',
            initiator_id='user_1',
            participant_ids=initial_participants
        )
        
        group_call_id = session['group_call_id']
        
        # Add new participant
        updated_session = group_e2ee.add_participant_to_group_call(
            group_call_id=group_call_id,
            new_participant_id='user_3'
        )
        
        assert updated_session is not None
        assert len(updated_session['participants']) == 3
        assert 'user_3' in updated_session['participants']
        assert 'user_3' in updated_session['participant_keys']
    
    def test_max_participants_limit(self):
        """Test that maximum participant limit is enforced."""
        group_e2ee = GroupCallE2EE()
        
        participants = [f'user_{i}' for i in range(5)]
        session = group_e2ee.create_group_call_session(
            group_id='group_123',
            initiator_id='user_0',
            participant_ids=participants,
            max_participants=5
        )
        
        # Try to add participant beyond limit
        result = group_e2ee.add_participant_to_group_call(
            group_call_id=session['group_call_id'],
            new_participant_id='user_999'
        )
        
        assert result is None
    
    def test_rotate_group_call_keys(self):
        """Test group call key rotation."""
        group_e2ee = GroupCallE2EE()
        
        participants = ['user_1', 'user_2', 'user_3']
        session = group_e2ee.create_group_call_session(
            group_id='group_123',
            initiator_id='user_1',
            participant_ids=participants
        )
        
        group_call_id = session['group_call_id']
        old_master_key = session['master_key']
        old_participant_keys = {k: v for k, v in session['participant_keys'].items()}
        
        # Rotate keys
        result = group_e2ee.rotate_group_call_keys(group_call_id)
        
        assert result == True
        
        rotated_session = group_e2ee.group_sessions[group_call_id]
        assert rotated_session['master_key'] != old_master_key
        
        # All participant keys should be rotated
        for participant_id in participants:
            assert rotated_session['participant_keys'][participant_id] != old_participant_keys[participant_id]
    
    def test_group_call_key_uniqueness(self):
        """Test that each participant gets unique key."""
        group_e2ee = GroupCallE2EE()
        
        participants = ['user_1', 'user_2', 'user_3', 'user_4', 'user_5']
        session = group_e2ee.create_group_call_session(
            group_id='group_123',
            initiator_id='user_1',
            participant_ids=participants
        )
        
        # Convert base64 keys to actual bytes for comparison
        keys_set = set()
        for participant_id, key_b64 in session['participant_keys'].items():
            key_bytes = base64.b64decode(key_b64)
            keys_set.add(key_bytes)
        
        # All keys should be unique
        assert len(keys_set) == len(participants)


class TestWebRTCIntegration:
    """Integration tests for WebRTC E2EE."""
    
    def test_full_call_flow(self):
        """Test complete call setup and media encryption."""
        # Step 1: Create call session
        session = WebRTCE2EE.establish_webrtc_call_session(
            caller_id='alice',
            callee_id='bob',
            ice_ufrag='ufrag123',
            ice_pwd='pwd456',
            dtls_fingerprint='sha-256 AA:BB:CC:DD'
        )
        
        # Step 2: Encrypt audio packet
        audio_packet = b"Audio frame from Alice" * 100
        key = base64.b64decode(session['key_material']['client_key'])
        
        audio_ct, audio_nonce, audio_tag = WebRTCE2EE.encrypt_media_packet(
            packet=audio_packet,
            key=key
        )
        
        # Step 3: Simulate transmission and decryption by Bob
        bob_key = base64.b64decode(session['key_material']['server_key'])
        
        # Bob decrypts (using his side of the keys)
        # Note: In real scenario, Bob would have different key derivation
        decrypted_audio = WebRTCE2EE.decrypt_media_packet(
            ciphertext=audio_ct,
            key=key,  # Same key in this test setup
            nonce=audio_nonce,
            tag=audio_tag
        )
        
        assert decrypted_audio == audio_packet
        
        # Step 4: Get statistics
        session['encrypted_packet_count'] = 1000
        stats = WebRTCE2EE.get_call_statistics(session)
        
        assert stats['encrypted_packets'] == 1000
    
    def test_group_call_encryption_flow(self):
        """Test group call encryption with multiple participants."""
        group_e2ee = GroupCallE2EE()
        
        participants = ['alice', 'bob', 'charlie']
        session = group_e2ee.create_group_call_session(
            group_id='conference_123',
            initiator_id='alice',
            participant_ids=participants
        )
        
        # Each participant encrypts with their own key
        message = b"Group message from Alice"
        
        for participant_id in participants:
            key_b64 = session['participant_keys'][participant_id]
            key = base64.b64decode(key_b64)
            
            # Encrypt for this participant
            ct, nonce, tag = WebRTCE2EE.encrypt_media_packet(
                packet=message,
                key=key
            )
            
            # Decrypt to verify
            decrypted = WebRTCE2EE.decrypt_media_packet(
                ciphertext=ct,
                key=key,
                nonce=nonce,
                tag=tag
            )
            
            assert decrypted == message
