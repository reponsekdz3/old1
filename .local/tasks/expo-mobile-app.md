# Complete Expo Mobile App

## What & Why
Build a full-featured React Native / Expo Go mobile app (`mobile/`) that is a real WhatsApp-like messaging experience — identical in power to the web version — using all existing backend APIs (Flask + Socket.IO at port 8000). No mocks, no placeholders. Every feature connects to real data.

## Done looks like
- `mobile/` directory contains a complete Expo project launchable with `npx expo start`
- A new workflow "Mobile App" starts the Expo Metro bundler with a QR code users scan with Expo Go
- **Auth**: Login and Signup screens with international phone input (flag + dial code for all 240+ countries), password strength, 3-step signup wizard matching the web version
- **Chats tab**: Real-time chat list updated via Socket.IO; unread badges; search; contacts/new chat
- **Chat window**: Full message thread with send/receive, typing indicators, double-tick read receipts, emoji picker, voice message recorder/player, image/file attachment picker, message reactions, reply/forward/star/delete, link previews
- **Status tab**: View and post status updates (text, image, video); contact statuses with progress rings; my status section
- **Calls tab**: Recent calls log; initiate voice/video calls using WebRTC
- **Profile screen**: Full profile with all fields (name, bio, phone, email, age, country, city), avatar upload, QR code display/scanner, profile completeness indicator
- **Settings screen**: Privacy toggles, notification settings, storage/download settings, backup, help — all persisted to backend
- **QR Scanner**: Expo Camera-based QR scan to add contacts, plus display own QR code
- **Push notifications**: Expo push notifications for new messages
- All screens polished with native components, smooth animations, dark/light status bar, proper safe area insets

## Out of scope
- App Store / Play Store submission (build only for Expo Go)
- Advanced WebRTC infrastructure (basic voice/video call screens with WebRTC signaling via backend)
- Offline-first caching / IndexedDB

## Steps
1. **Initialize Expo project** — Create `mobile/` with Expo Router, install all dependencies (expo, expo-router, socket.io-client, axios, zustand, expo-camera, expo-av, expo-image-picker, expo-notifications, expo-file-system, react-native-safe-area-context, @react-native-community/netinfo, expo-blur, expo-haptics, expo-linear-gradient, react-native-reanimated, react-native-gesture-handler)
2. **Core services** — Build `mobile/services/api.js` (axios with JWT interceptors pointing to backend port 8000), `store.js` (zustand auth + chat state), `socket.js` (Socket.IO with reconnect logic), `pushNotifications.js` (Expo push token registration)
3. **Country data + phone input** — Port country picker component to React Native with FlatList scrollable searchable dropdown, flag emoji rendering, dial code selection; all 240+ countries
4. **Auth screens** — Login screen (phone input + password, animated preview panel) and 3-step Signup screen (phone/name/email → age/country/city → password with strength meter), both wired to `/api/auth/login` and `/api/auth/signup`
5. **Tab layout + navigation** — Expo Router tabs for Chats, Status, Calls + stack navigators for chat windows, profile, settings; proper back navigation, header styling
6. **Chats tab** — Real-time chat list fetched from `/api/chat/` and updated via Socket.IO `new_message` events; unread count badges; swipe-to-archive; new chat floating button; contact search
7. **Chat window** — Full message thread with Socket.IO real-time delivery; message bubbles with timestamps, read/delivered ticks; typing indicator (3-dot animation); emoji picker (native grid); voice message recorder (Expo AV) with waveform display; image/video picker + upload to `/api/upload/`; file attachment; message long-press menu (react, reply, star, copy, forward, delete)
8. **Status tab** — Fetch contacts' statuses via `/api/status/`; horizontal contact story rings; status viewer with progress bar and auto-advance; compose status (text with background color picker, or image/video from gallery); my status section
9. **Calls tab** — Recent call logs from `/api/calls/`; call type icons (voice/video/missed); initiate calls through Socket.IO signaling; basic WebRTC call screen with mute/speaker/end
10. **Profile + QR** — Profile screen with all 7 fields editable, avatar camera/gallery picker, profile completeness bar, QR code image display; camera-based QR scanner using Expo Camera + jsQR for adding contacts
11. **Settings screen** — Privacy selectors, notification toggles, auto-download toggles, backup action — all wired to `/api/settings`
12. **Polish** — Safe area insets everywhere, haptic feedback on send/react, smooth screen transitions via Reanimated, proper keyboard avoiding, pull-to-refresh on all lists, empty state illustrations, loading skeletons
13. **Workflow** — Add "Mobile App" workflow to `.replit` running `cd mobile && npx expo start --port 8081` on port 8081

## Relevant files
- `backend/app/routes/` (all existing API routes for reference)
- `web/src/services/api.js`
- `web/src/services/store.js`
- `web/src/services/socket.js`
- `web/src/data/phoneCountries.js`
- `web/src/components/PhoneInput.js`
- `web/src/components/EmojiPicker.js`
- `web/src/components/QRScannerModal.js`
- `web/src/components/VoiceRecorder.js`
- `web/src/pages/LoginPage.js`
- `web/src/pages/SignupPage.js`
- `web/src/components/ChatWindow.js`
- `web/src/components/ChatsTab.js`
- `web/src/components/StatusTab.js`
- `web/src/pages/SettingsPage.js`
- `web/src/components/ProfilePanel.js`
