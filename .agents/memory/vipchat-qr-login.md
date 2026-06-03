---
name: VipChat QR Login Flow
description: How QR web login works across backend, mobile, and web — endpoints, data format, and session lifecycle
---

# QR Web Login Flow

**Backend endpoints** (blueprint `qr_login_bp`, prefix `/api/auth/qr-session`):
- `POST /generate` — creates in-memory session `{status: pending, ...}`, returns `{session_id, qr_data: "vipchat://qr-login/{id}"}` — no auth required
- `GET /status/<id>` — web polls every 2s; returns `{status: pending|confirmed|expired}` + tokens + user on confirm; consumes session on confirm
- `POST /confirm` — mobile calls (JWT required), marks session confirmed, stores fresh tokens for the web

**Mobile scan prefix**: `vipchat://qr-login/{session_id}` — strip prefix before calling confirm endpoint.

**TTL**: 120 seconds in-memory. Sessions are cleaned up on poll and on expire.

**In-memory store**: `_sessions` dict protected by `threading.Lock()` in `backend/app/routes/qr_login.py`.

**Why:** QR sessions must never persist to DB — they are ephemeral single-use tokens. In-memory is correct for this use case.

**How to apply:** Web shows QR, polls status. Mobile scans → strips prefix → POST confirm with JWT. Web gets tokens, logs in.
