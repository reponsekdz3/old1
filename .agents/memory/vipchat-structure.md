---
name: VipChat app structure
description: Project layout, Expo SDK version, API URL config, and mobile navigation structure
---

## Project layout
- `backend/` — Flask API, port 8000
- `web/` — React 18 + Tailwind, port 5000 (proxies `/api` to 8000)
- `mobile/` — Expo SDK 51, expo-router v3, port 8080

## Mobile key facts
- Entry: `expo-router/entry` (file-based routing in `mobile/app/`)
- Backend URL: `EXPO_PUBLIC_API_URL` env var → `mobile/config.js`
- Camera for QR: uses `expo-camera` CameraView API (not the older Camera component)
- Auth state: Zustand `useAuthStore` in `mobile/services/store.js`
- Tokens: `expo-secure-store` via `mobile/services/storage.js`

## App name history
- Originally: Bitese → Renamed to VipChat (June 2026)
- Bundle ID: `com.vipchat.app`
- Slug: `vipchat`

**Why:** Full project rebrand; all "Bitese" strings replaced across web/mobile/backend/README.
