# VipChat — Real-Time Messaging Platform

A full-stack WhatsApp-like messaging platform built with React, React Native (Expo), and Flask. Supports real-time one-on-one and group chats, voice/video calls (including group calls), rich media attachments, live status updates, and a hardened security backend.

---

## Stack

| Layer | Technology |
|---|---|
| Web Frontend | React 18, Tailwind CSS, Framer Motion, Zustand |
| Mobile App | React Native (Expo SDK 51), Expo Router, Zustand |
| Backend | Flask, Flask-SocketIO, Flask-JWT-Extended, Flask-Limiter |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Real-time | WebSocket (Socket.IO) |
| Calling | WebRTC (SFU architecture for group calls, STUN/TURN) |
| Auth | JWT (access + refresh tokens), phone verification |

---

## Features

### Messaging
- One-to-one and group real-time chat
- Text, image, video, audio, document, and voice note messages
- Attachment preview before sending (with optional caption)
- Reply, forward, edit, delete (for me / for everyone)
- Emoji reactions and emoji picker
- Message search within conversations
- Link previews with metadata scraping
- Read receipts — single tick → double tick → blue ticks
- Typing indicators and online presence
- Location sharing and contact card sharing
- Paginated message history
- Starred messages and archived chats

### Calls
- One-to-one WebRTC voice and video calls
- **Group voice/video calls with SFU architecture** (up to 50 participants)
- Scalable media routing with bandwidth optimization
- E2EE support for group calls with AES-256-GCM
- STUN + TURN ICE servers for NAT traversal
- Full call screen with ring tone, accept/reject UI
- Minimizable call screen during active calls
- Mute / camera toggle / speaker / flip camera
- Screen sharing (web only)
- In-app call notifications with sound
- Call history with call-back buttons (voice + video)
- New call modal with contact search

### Status Updates
- 24-hour expiring status updates (text with coloured backgrounds)
- Image status support
- Status view tracking
- Full-screen status viewer with progress bars

### Mobile App (Expo)
- Full WhatsApp-like mobile UI (portrait only)
- Bottom tab bar: Chats, Updates, Calls
- Per-tab unread badge count
- **Automatic phone contact sync on login** (real device contacts)
- QR code scanner and generator
- Voice recorder with waveform
- Camera integration for photos/videos
- Push notifications with sound and vibration
- Full settings screen with Privacy, Notifications, Chats, Storage, Help, About
- Profile editor with avatar upload
- Blocked contacts management
- Two-step verification (coming soon)

### Web App
- WhatsApp Web-like three-pane layout (sidebar / chat / info)
- Tabs: Chats, Updates, Calls, Groups, Channels
- Group management and community features
- Channels (broadcast-only rooms)
- Admin dashboard (user management, ban/unban)
- Push notifications via VAPID web push
- QR code contact sharing
- Chat wallpapers and themes
- Starred messages view

### Security (Backend)
- JWT authentication (access + refresh tokens)
- **Advanced DDoS protection** with IP-based rate limiting and auto-blocking
- **Request signature verification** (HMAC-SHA256 with nonce)
- **Rate limiting** on auth endpoints (Flask-Limiter + custom in-memory sliding window)
  - Login: 10 req/min
  - Signup: 5 req/min
  - API calls: 100 req/min per IP
- **Media encryption** for WebRTC calls (AES-256-GCM, per-frame encryption)
- **Hardened HTTP security headers** on every response:
  - `Content-Security-Policy` (full policy)
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `X-XSS-Protection: 1; mode=block`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Strict-Transport-Security` (HTTPS enforced)
  - `Permissions-Policy` for camera/mic/geolocation
  - Server fingerprinting removed (`Server`, `X-Powered-By`)
  - API cache headers (`Cache-Control: no-store`)
- Input sanitization middleware (null-byte stripping, max-length enforcement)
- Account ban/unban via admin panel
- SMS phone verification (Africa's Talking)
- VAPID push notification security
- Automatic IP blocking after 10 failed auth attempts
- Suspicious activity monitoring

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- npm

### Backend

```bash
cd backend
pip install -r requirements.txt
python run.py
```

Backend runs on **port 8000**.

### Web

```bash
cd web
npm install
npm start
```

Web app runs on **port 5000** and proxies API calls to `:8000`.

### Mobile

```bash
cd mobile
npm install
npx expo start --port 8080
```

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register (5 req/min limit) |
| POST | `/api/auth/login` | Login (10 req/min limit) |
| POST | `/api/auth/send-verification-sms` | Send phone verification code |
| POST | `/api/auth/verify-code` | Verify phone code |
| GET | `/api/auth/user` | Current user profile |
| PUT | `/api/auth/user/profile` | Update profile |
| GET | `/api/messages/chat/:id` | Chat history |
| POST | `/api/messages/:id` | Send message |
| PUT | `/api/messages/:id/read` | Mark as read |
| POST | `/api/messages/:id/react` | Add emoji reaction |
| POST | `/api/upload/image` | Upload image |
| POST | `/api/upload/video` | Upload video |
| POST | `/api/upload/audio` | Upload audio |
| POST | `/api/upload/document` | Upload document |
| GET | `/api/contacts` | Contact list |
| POST | `/api/contacts` | Add contact |
| POST | `/api/contacts/sync-phone` | Sync device contacts with VipChat users |
| GET | `/api/status/all` | All friend statuses |
| POST | `/api/status` | Post status update |
| GET | `/api/calls/history` | Call history |
| POST | `/api/calls/initiate` | Log and start WebRTC call |
| GET | `/api/groups` | List groups |
| POST | `/api/groups` | Create group |
| POST | `/api/groups/:id/messages` | Send group message |
| POST | `/api/sfu/room/create` | Create SFU room for group call |
| GET | `/api/sfu/room/:id/participants` | Get SFU room participants |
| GET | `/api/settings` | Get user settings |
| PUT | `/api/settings` | Update user settings |
| GET | `/api/health` | Health check |
| GET | `/uploads/<path>` | Serve uploaded files |

---

## WebSocket Events

### Messaging
| Event | Direction | Description |
|---|---|---|
| `message` | → Server | Send a message |
| `new_message` | ← Server | Receive a message |
| `typing` / `stop_typing` | ↔ | Typing indicators |
| `message_deleted` | ← Server | Message removed |
| `message_edited` | ← Server | Message updated |
| `reaction` / `reaction_added` | ↔ | Emoji reactions |
| `message_read` | ← Server | Read receipt |

### 1-to-1 Calls
| Event | Description |
|---|---|
| `call_offer` / `incoming_call` | Initiate / receive a call |
| `call_answer` / `call_answered` | Accept a call |
| `ice_candidate` | ICE candidate relay |
| `call_reject` / `call_rejected` | Decline a call |
| `call_end` / `call_ended` | End a call |

### Group Calls (SFU Architecture)
| Event | Description |
|---|---|
| `sfu_join` | Join SFU room for group call |
| `sfu_joined` | Confirmation with existing participants |
| `sfu_peer_joined` | New participant joined |
| `sfu_peer_left` | Participant left |
| `sfu_offer` / `sfu_answer` | Per-peer WebRTC negotiation |
| `sfu_ice_candidate` | Per-peer ICE candidate relay |
| `sfu_media_state` | Audio/video/screen toggle |
| `sfu_leave` | Leave group call |

### Legacy Group Calls (Deprecated)
| Event | Description |
|---|---|
| `group_call_start` | Initiate group call, notifies all members |
| `group_incoming_call` | Incoming group call notification |
| `group_call_join` | Join a group call room |
| `group_call_offer` / `group_call_answer` | Per-peer WebRTC negotiation |
| `group_ice_candidate` | Per-peer ICE candidate relay |
| `group_call_leave` / `group_call_user_left` | Participant left |
| `group_call_reject` / `group_call_rejected` | Call declined |

### Presence & Groups
| Event | Description |
|---|---|
| `status_update` | User online/offline broadcast |
| `join_group` / `leave_group` | Group room management |
| `group_message` | Real-time group message |
| `group_typing` | Group typing indicator |
| `location_share` | Live location message |

---

## Environment Variables

```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=sqlite:///vipchat.db
AFRICAS_TALKING_API_KEY=your-at-key
AFRICAS_TALKING_USERNAME=sandbox
VAPID_PRIVATE_KEY=your-vapid-private
VAPID_PUBLIC_KEY=your-vapid-public
ALLOWED_ORIGINS=*
REDIS_URL=redis://localhost:6379/0
```

---

## License

MIT © 2026 VipChat
