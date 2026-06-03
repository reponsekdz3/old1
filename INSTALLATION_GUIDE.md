# Installation Guide for SFU & Advanced Security Features

## Prerequisites

- Python 3.10+
- Node.js 18+
- npm or yarn
- Expo CLI (for mobile)

---

## Backend Setup

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

Key new dependencies:
- `cryptography==42.0.0` - E2EE and media encryption
- `PyNaCl==1.5.0` - Additional crypto primitives
- `flask-socketio==5.3.5` - WebSocket/SFU support

### 2. Initialize Security Manager

The advanced security manager is automatically initialized in `app/__init__.py`.

### 3. Run Backend

```bash
python run.py
```

Backend runs on port 8000 with:
- SFU signaling endpoints
- Advanced security middleware
- Contact sync API

---

## Mobile Setup

### 1. Install Dependencies

```bash
cd mobile
npm install
```

### 2. Install WebRTC (Critical for Group Calls)

```bash
npm install react-native-webrtc@118.0.0
```

**Note**: If npm install fails due to network issues, try:
```bash
npm install react-native-webrtc@118.0.0 --legacy-peer-deps
```

Or use yarn:
```bash
yarn add react-native-webrtc@118.0.0
```

### 3. Configure Expo for WebRTC

Add to `app.json`:
```json
{
  "expo": {
    "plugins": [
      [
        "react-native-webrtc",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera for video calls",
          "microphonePermission": "Allow $(PRODUCT_NAME) to access your microphone for calls"
        }
      ]
    ]
  }
}
```

### 4. Run Mobile App

```bash
npx expo start --port 8080
```

---

## Web Setup

### 1. Install Dependencies

```bash
cd web
npm install
```

No additional dependencies needed (uses native browser WebRTC).

### 2. Run Web App

```bash
npm start
```

Runs on port 5000.

---

## Feature Configuration

### Automatic Contact Sync (Mobile Only)

Contacts are automatically synced on login. No configuration needed.

**How it works**:
1. User logs in
2. App requests contacts permission
3. Device contacts are fetched
4. Phone numbers sent to `/api/contacts/sync-phone`
5. Backend matches against registered users
6. VipChat contacts automatically added
7. Results cached locally (30-minute TTL)

**Manual Sync**:
```javascript
import { autoSyncOnLogin } from '../services/phoneContacts';

const result = await autoSyncOnLogin();
console.log(`Found ${result.vipchatContacts.length} users`);
```

### SFU Group Calls

**Mobile**:
```javascript
import sfuClient from '../services/sfuClient';

// Initialize
await sfuClient.initialize(userId, username, token);

// Join room
await sfuClient.joinRoom(roomId, audioEnabled=true, videoEnabled=true);

// Controls
sfuClient.toggleAudio(false);
sfuClient.toggleVideo(false);
sfuClient.switchCamera();

// Leave
sfuClient.leaveRoom();
```

**Web**:
```javascript
import sfuClient from '../services/sfuClient';

// Same API as mobile
await sfuClient.initialize(userId, username, token);
await sfuClient.joinRoom(roomId, true, true);

// Additional: Screen sharing
await sfuClient.shareScreen();
sfuClient.stopScreenShare();
```

### Advanced Security

**Enabled by default**. No configuration needed.

**Optional: Request Signing** (for extra security):
```javascript
import { sign_request } from '../services/security';

const payload = { phone_number: "+250788123456", password: "..." };
const { signature, timestamp, nonce } = sign_request(payload, secretKey);

// Add headers
headers['X-Request-Signature'] = signature;
headers['X-Request-Timestamp'] = timestamp;
headers['X-Request-Nonce'] = nonce;
```

---

## Environment Variables

Add to `backend/.env`:

```env
# Existing
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=sqlite:///vipchat.db

# New (optional)
SFU_MAX_PARTICIPANTS=50
ENABLE_MEDIA_ENCRYPTION=true
RATE_LIMIT_ENABLED=true
IP_BLOCKING_ENABLED=true
```

---

## Testing

### Test Contact Sync

```bash
# Mobile
curl -X POST http://localhost:8000/api/contacts/sync-phone \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"phone_numbers": ["+250788123456", "+250788999999"]}'
```

### Test SFU Room Creation

```bash
curl -X POST http://localhost:8000/api/sfu/room/create \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"room_id": "test-room-123", "group_id": "group-id"}'
```

### Test Security Headers

```bash
curl -I http://localhost:8000/api/health
```

Should return:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## Troubleshooting

### Mobile: WebRTC Install Fails

**Solution 1**: Use legacy peer deps
```bash
npm install react-native-webrtc@118.0.0 --legacy-peer-deps
```

**Solution 2**: Use yarn
```bash
yarn add react-native-webrtc@118.0.0
```

**Solution 3**: Clear cache
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Backend: Import Error for SFU

Ensure file exists:
```bash
ls backend/app/services/sfu_server.py
ls backend/app/routes/sfu_routes.py
ls backend/app/security/advanced_security.py
```

If missing, files were not created. Re-copy from the implementation.

### Contact Sync: No Permission

On iOS/Android, user must grant contacts permission. Handle rejection:
```javascript
const result = await autoSyncOnLogin();
if (!result.granted) {
  Alert.alert('Contacts Permission Required', 'Enable contacts access in Settings');
}
```

### Group Call: No Video/Audio

Check permissions in device settings:
- Camera permission
- Microphone permission

On web, check browser permissions (usually a popup).

---

## Production Deployment

### 1. Use PostgreSQL (not SQLite)

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/vipchat
```

### 2. Add Redis for Caching

```env
REDIS_URL=redis://localhost:6379/0
```

### 3. Configure TURN Servers

For NAT traversal in production:

```javascript
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: 'turn:your-turn-server.com:3478',
    username: 'user',
    credential: 'pass'
  }
];
```

### 4. Enable HTTPS

Required for WebRTC:
```bash
gunicorn --certfile=cert.pem --keyfile=key.pem --bind 0.0.0.0:8000 wsgi:app
```

### 5. Rate Limiting Tuning

Adjust in `backend/app/security/advanced_security.py`:
```python
# For high-traffic production
self.request_history = defaultdict(lambda: deque(maxlen=200))  # Increase buffer
```

---

## Support

For issues, see:
- `SFU_SECURITY_IMPLEMENTATION.md` - Architecture details
- `README.md` - Feature overview
- GitHub Issues (if applicable)

---

## License

MIT © 2026 VipChat
