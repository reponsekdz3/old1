---
name: VipChat architecture
description: Key facts about the VipChat project structure, workflows, and non-obvious quirks
---

## Stack
- Backend: Flask + SQLAlchemy (SQLite dev / PostgreSQL prod) on port 8000; started via `cd backend && python start.py`
- Frontend: React 18 + Tailwind CSS + Zustand on port 5000; started via `cd web && PORT=5000 npm start`
- Mobile: React Native Expo in `mobile/`
- Real-time: Socket.IO
- Auth: JWT (flask-jwt-extended), QR login endpoint at `/api/auth/qr-session/`

## Workflows
- "Backend API" → `cd backend && python start.py`, port 8000, console output
- "Start application" → `cd web && PORT=5000 npm start`, port 5000, webview output

## Non-obvious quirks
- Redis errors on startup are non-fatal (falls back to in-memory); do not treat as blocking
- Marketplace models are defined inline in `backend/app/routes/marketplace.py` (not in models.py)
- Frontend proxy to backend is set in `web/package.json` (`"proxy": "http://localhost:8000"`)
- Stripe keys needed via env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET — without them, paid flows return 503 gracefully
- QR login already existed in LoginPage.js (QRLoginPanel component); new QRLoginModal.js is for use from other pages
- `web/src/components/OfflineIndicator.js`, `PWAInstallBanner.js`, `DeviceSessionsModal.js` — all created fresh
- Device sessions endpoint `/api/auth/sessions` returns current session only (real persistence would need a UserSession table)

**Why:** Recorded after major build session to avoid re-discovering these quirks.
