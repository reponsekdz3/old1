---
name: VipChat Architecture
description: Stack overview — backend port, frontend port, mobile setup, proxy config.
---

# VipChat Architecture

**Backend**: Flask + Flask-SocketIO, port 8000, `backend/` directory. Entry: `backend/start.py`. Blueprints registered in `backend/app/__init__.py` (including wallet_bp, trends_bp).

**Frontend**: React 18 + Tailwind + Zustand + Framer Motion, port 5000, `web/` directory. `/api` proxied to backend (port 8000).

**Mobile**: Expo Router, React Native, `mobile/app/(tabs)/` for tab screens.

**Why:** The proxy config means frontend code always calls relative `/api/…` paths; never hardcode backend port in frontend.

**How to apply:** When adding new API routes, register blueprint in `backend/app/__init__.py`. Frontend fetches via `/api/…` automatically proxied.
