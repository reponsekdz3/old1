# VipChat SFU Architecture & Security Implementation

## Overview
VipChat now uses a **Selective Forwarding Unit (SFU)** architecture for group video/voice calls instead of mesh topology. This provides:

- **Scalability**: Support 50+ participants per call
- **Bandwidth Efficiency**: Each client sends once, receives N streams
- **Lower CPU Usage**: No encoding/decoding for forwarding
- **Better Quality**: Adaptive bitrate per receiver

---

## Architecture

### SFU Server (Backend)
**File**: `backend/app/services/sfu_server.py`

- Manages WebRTC rooms and participant state
- Routes media streams between peers
- Tracks audio/video/screen share states
- Handles participant joins/leaves
- Enforces max participant limits

### WebRTC Signaling
**File**: `backend/app/routes/sfu_routes.py`

Socket.IO events:
- `sfu_join` - Join SFU room
- `sfu_offer` / `sfu_answer` - WebRTC negotiation
- `sfu_ice_candidate` - ICE candidate exchange
- `sfu_media_state` - Audio/video toggle
- `sfu_leave` - Leave room

### Mobile Client
**File**: `mobile/services/sfuClient.js`

React Native WebRTC client with:
- Automatic reconnection
- Camera switching
- Audio/video toggle
- Participant tracking
- Stream management

### Web Client
**File**: `web/src/services/sfuClient.js`

Browser WebRTC client with:
- Screen sharing support
- Adaptive quality
- Grid layout optimization
- Audio/video controls

---

## Security Features

### 1. Advanced Security Middleware
**File**: `backend/app/security/advanced_security.py`

**Features**:
- DDoS mitigation with IP-based rate limiting
- Request signature verification (HMAC-SHA256)
- Nonce-based replay attack prevention
- Automatic IP blocking after 10 failed auth attempts
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- Server fingerprint removal

**Rate Limits**:
- 100 requests/min per IP (burst protection)
- Automatic suspicious IP detection
- Failed auth tracking per IP and user

### 2. Media Encryption (E2EE for Calls)
**File**: `backend/app/security/media_encryption.py`

**Features**:
- AES-256-GCM encryption for media frames
- Per-peer key derivation using HKDF
- Frame-level encryption with nonce rotation
- Key rotation support (every 30s)
- Group call master key distribution

**Key Management**:
- Separate keys per peer connection
- Derived from group master key
- Automatic key exchange during signaling
- Forward secrecy support

### 3. Enhanced HTTP Security Headers

All API responses include:
```
Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Cache-Control: no-store, no-cache, must-revalidate, private
```

### 4. Request Signing
Optional HMAC-based request signing for sensitive operations:
- Timestamp validation (5-minute window)
- Nonce replay prevention
- HMAC-SHA256 signature verification

---

## Automatic Phone Contact Sync

### Mobile Implementation
**File**: `mobile/services/phoneContacts.js`

**Features**:
- Automatic sync on login
- Background sync every 30 minutes
- Expo Contacts API integration
- Phone number normalization
- Caching for offline access

**Flow**:
1. Request contacts permission
2. Fetch all device contacts
3. Extract phone numbers
4. Send batch to backend (`/api/contacts/sync-phone`)
5. Match against registered users
6. Auto-add matched users to contacts
7. Cache results locally

### Backend Implementation
**File**: `backend/app/routes/contacts_sync.py`

**Endpoint**: `POST /api/contacts/sync-phone`

**Features**:
- Batch phone number matching (up to 5000 numbers)
- Normalized phone comparison
- Automatic contact creation
- Returns registered vs unregistered users

**Response**:
```json
{
  "registered": [
    {
      "id": "user_id",
      "phone_number": "+250788123456",
      "full_name": "John Doe",
      "avatar_url": "...",
      "badge_verified": true
    }
  ],
  "unregistered": ["+250788999999"],
  "registered_count": 1,
  "unregistered_count": 1
}
```

### Web Implementation
Contact sync not available on web (browser limitation).

---

## Installation & Setup

### Backend Dependencies
```bash
cd backend
pip install -r requirements.txt
```

Required packages:
- `cryptography==42.0.0` - E2EE encryption
- `PyNaCl==1.5.0` - Additional crypto primitives
- `flask-socketio==5.3.5` - WebSocket support

### Mobile Dependencies
```bash
cd mobile
npm install
```

New package:
- `react-native-webrtc@^118.0.0` - WebRTC for React Native

Install WebRTC peer deps:
```bash
npx expo install react-native-webrtc
```

### Web Dependencies
```bash
cd web
npm install
```

Uses built-in browser WebRTC APIs (no additional deps).

---

## Usage Examples

### Start Group Call (Mobile)
```javascript
import sfuClient from '../services/sfuClient';

// Initialize
await sfuClient.initialize(userId, username, token);

// Join room
await sfuClient.joinRoom(roomId, audioEnabled=true, videoEnabled=true);

// Toggle media
sfuClient.toggleAudio(false); // Mute
sfuClient.toggleVideo(false); // Camera off

// Leave
sfuClient.leaveRoom();
```

### Start Group Call (Web)
```javascript
import sfuClient from '../services/sfuClient';

// Initialize
await sfuClient.initialize(userId, username, token);

// Join room
await sfuClient.joinRoom(roomId, audioEnabled=true, videoEnabled=true);

// Screen share
await sfuClient.shareScreen();
sfuClient.stopScreenShare();

// Leave
sfuClient.leaveRoom();
```

### Sync Contacts (Mobile)
```javascript
import { autoSyncOnLogin } from '../services/phoneContacts';

// Auto-sync on login
const result = await autoSyncOnLogin();

console.log(`Found ${result.vipchatContacts.length} VipChat users`);
console.log(`${result.phoneOnlyContacts.length} contacts not on VipChat`);
```

---

## Security Best Practices

### Rate Limiting
- Login: 10 req/min per IP
- Signup: 5 req/min per IP
- API calls: 100 req/min per IP
- Failed auth: Auto-block after 10 attempts

### Call Encryption
- Enable E2EE for all calls
- Rotate keys every 30 seconds
- Use DTLS-SRTP for transport security
- Verify peer identities via signaling

### Contact Sync
- Request permission before accessing contacts
- Normalize phone numbers before comparison
- Limit batch size to prevent abuse
- Cache results to minimize API calls

---

## Performance Optimization

### SFU Server
- In-memory participant tracking
- Efficient socket.io room management
- Automatic cleanup of empty rooms
- Per-peer bandwidth limits (2500 kbps default)

### Mobile Client
- Stream caching and reuse
- Automatic reconnection on disconnect
- Lazy video rendering
- Background audio support

### Web Client
- Grid layout optimization based on participant count
- Adaptive video quality
- Screen share priority routing
- Hardware acceleration support

---

## Monitoring & Debugging

### Backend Logs
```python
logger.info(f"[SFU] User {user_id} joined room {room_id}")
logger.warning(f"[Security] IP blocked: {ip}")
```

### Client Logs
```javascript
console.log('[SFU] Joined room:', data);
console.error('[SFU] Connection error:', err);
```

### Health Check
```bash
curl http://localhost:8000/api/health
```

---

## Migration from Mesh to SFU

### Breaking Changes
- Group call events changed from `group_call_*` to `sfu_*`
- Room creation requires explicit API call
- Per-peer connections instead of full mesh

### Backward Compatibility
- Old 1-to-1 call events still supported
- Existing mesh group calls will be deprecated
- Migration script not required (parallel deployment)

---

## Future Enhancements

- [ ] TURN server integration for NAT traversal
- [ ] Recording support with E2EE
- [ ] Simulcast for adaptive quality
- [ ] Red5 Pro / Janus Gateway integration
- [ ] AI-based noise cancellation
- [ ] Virtual backgrounds
- [ ] Call analytics dashboard
- [ ] WebRTC stats monitoring

---

## License
MIT © 2026 VipChat
