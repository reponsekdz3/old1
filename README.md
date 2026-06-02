# Bitese — Real-Time Messaging App

A full-stack WhatsApp-like messaging platform built with React and Flask. Supports real-time one-on-one and group chats, voice/video calls (including group calls), file attachments with preview, live status updates, and a high-security backend.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Tailwind CSS, Framer Motion, Zustand |
| Backend | Flask, Flask-SocketIO, Flask-JWT-Extended, Flask-Limiter |
| Database | SQLite (dev) / PostgreSQL (prod) |
| Real-time | WebSocket (Socket.IO) |
| Calling | WebRTC (STUN/TURN mesh topology) |

---

## Features

### Messaging
- One-to-one and group chat
- Text, image, video, audio, document, and voice note messages
- **Attachment preview before sending** (with optional caption)
- Reply, forward, edit, delete (for me / for everyone)
- Emoji reactions and emoji picker
- Message search within conversations
- Link previews with metadata scraping
- Read receipts (single tick → double tick → blue ticks)
- Typing indicators
- Location sharing
- Paginated message history

### Calls
- One-to-one WebRTC voice and video calls
- **Group voice/video calls** (mesh topology, up to ~8 participants)
- STUN + TURN ICE servers for NAT traversal
- Minimizable call screen during calls
- Mute / camera toggle / speaker controls
- Call history with call-back functionality

### Status
- 24-hour expiring status updates (text with colour backgrounds)
- Status view tracking
- Full-screen status viewer with progress bars

### Security
- JWT-based authentication (access + refresh tokens)
- **Rate limiting on auth endpoints** (Flask-Limiter): 10 req/min on login, 5 req/min on signup
- Security headers on every response: `X-Content-Type-Options`, `X-Frame-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`
- Input sanitization middleware
- Account ban/unban via admin panel
- No-scroll fixed login page (no layout shift)

### Other
- WhatsApp-style chat backgrounds / wallpapers
- Push notifications (VAPID web push)
- QR code contact sharing
- Admin dashboard (user management)
- Mobile-responsive design

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
cp .env.example .env   # fill in JWT_SECRET_KEY and other vars
python run.py
```

Backend runs on **port 8000**.

### Frontend

```bash
cd frontend
npm install
npm start
```

Frontend runs on **port 5000** and proxies API calls to `:8000`.

---

## API Overview

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/signup` | Register (5 req/min limit) |
| POST | `/api/auth/login` | Login (10 req/min limit) |
| GET | `/api/auth/user` | Current user profile |
| GET | `/api/messages/chat/:id` | Chat history |
| POST | `/api/messages/:id` | Send message |
| POST | `/api/upload/image` | Upload image |
| POST | `/api/upload/video` | Upload video |
| POST | `/api/upload/audio` | Upload audio file |
| POST | `/api/upload/document` | Upload document |
| GET | `/api/contacts` | Contact list |
| POST | `/api/contacts` | Add contact |
| GET | `/api/status/all` | All friend statuses |
| POST | `/api/status` | Post status update |
| GET | `/uploads/<path>` | Serve uploaded files |

---

## WebSocket Events

### Messaging
- `message` — send a message
- `new_message` — receive a message
- `typing` / `stop_typing` — typing indicators
- `message_deleted` / `message_edited` — mutation events
- `reaction` / `reaction_added` — emoji reactions

### 1-to-1 Calls
- `call_offer` / `incoming_call`
- `call_answer` / `call_answered`
- `ice_candidate`
- `call_reject` / `call_rejected`
- `call_end` / `call_ended`

### Group Calls
- `group_call_start` — initiate group call, notifies all group members
- `group_incoming_call` — incoming group call notification
- `group_call_join` — join call room
- `group_call_offer` / `group_call_answer` — WebRTC negotiation (per peer pair)
- `group_ice_candidate` — ICE candidate relay (per peer)
- `group_call_leave` / `group_call_user_left` — participant left
- `group_call_reject` / `group_call_rejected` — call declined

---

## Environment Variables

```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret
DATABASE_URL=sqlite:///bitese.db
AFRICAS_TALKING_API_KEY=your-at-key
AFRICAS_TALKING_USERNAME=sandbox
VAPID_PRIVATE_KEY=your-vapid-private
VAPID_PUBLIC_KEY=your-vapid-public
```

---

## License

MIT © 2026 Bitese
