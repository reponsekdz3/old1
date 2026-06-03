---
name: Bitese mobile app structure
description: Expo SDK 51 React Native app in mobile/ — key conventions, API wiring, and quirks
---

# Bitese Mobile App

## Stack
- Expo SDK ~51.0.0, expo-router ~3.5.0 (file-based routing in mobile/app/)
- Zustand for state, Axios with JWT refresh interceptor, Socket.IO client
- expo-camera SDK 51 uses `CameraView` + `useCameraPermissions` (NOT the old `Camera` component)
- entry point: `"main": "expo-router/entry"` in package.json
- babel.config.js must include `'react-native-reanimated/plugin'`

## API wiring
- `EXPO_PUBLIC_API_URL` env var → config.js exports `API_URL` and `SOCKET_URL`
- Falls back to `http://localhost:8000` (won't work on a real phone; user must set env var)
- Set in `mobile/.env` — format: `EXPO_PUBLIC_API_URL=https://8000-<user>-<repl>.replit.dev`

## File layout
- `mobile/services/` — api.js (axios), store.js (zustand), socket.js (socket.io), storage.js (AsyncStorage)
- `mobile/components/` — Avatar, EmptyState, TypingIndicator, ChatListItem, PhoneInput, MessageBubble, EmojiPicker, VoiceRecorder
- `mobile/data/countries.js` — 190+ dial codes + `getFlag(iso2)` helper
- `mobile/assets/` — placeholder PNG assets (icon, splash, adaptive-icon, favicon)

## Workflow
- "Mobile App" workflow: `cd mobile && npx expo start --port 8080` (console type)
- Port 8080 is in Replit's supported port list; user scans Expo Go QR from the Metro output

**Why:** Expo's Metro bundler is a console tool, not a web server — use console output type, not webview.
