---
name: VipChat push & offline
description: How push notifications and offline queue work across mobile, web, and backend
---

## Mobile push (Expo)
- `mobile/services/notifications.js` handles everything: token registration, foreground listener, notification-tap handler, offline queue drain
- `registerExpoPushToken()` calls `POST /api/push/register-expo-token` — wired in `_layout.js` after user auth
- `startOfflineQueueDrain()` uses NetInfo.addEventListener; drains `useOfflineStore.queue` on reconnect; retries server errors but drops 4xx
- `startNotificationListeners(onNavigate)` taps into `addNotificationReceivedListener` + `addNotificationResponseReceivedListener`

## Backend push sender
- `push_sender.py::push_to_user()` is now non-blocking (daemon thread)
- Detects Expo tokens by `endpoint.startsWith('ExponentPushToken')` or `auth == 'expo'`
- Expo: HTTP POST to `https://exp.host/--/api/v2/push/send` (no SDK needed)
- Web: pywebpush VAPID; deactivates sub on 404/410

**Why:** Original push_sender blocked the request thread and only supported web push.

## Web push / service worker
- `web/public/sw.js` — network-first fetch, push events → showNotification with reply/dismiss actions, notificationclick → focus existing window or openWindow
- `web/src/services/pushService.js` — registerServiceWorker + subscribeToPush (VAPID)
- `web/src/App.js` already calls registerServiceWorker + subscribeToPush on app load

## Download banners (never scroll)
- Web: LoginPage + SignupPage right panels are now `overflow-hidden flex-col`; inner form is `flex-1 overflow-y-auto`; `<DownloadAppBanner compact>` sits below as `flex-shrink-0`
- Mobile: `DownloadBanner` component uses `position:'absolute', bottom:0, zIndex:99` in login.js and signup.js; opens App Store / Play Store via Linking

## Audit fixes applied
- `settings.py`: added `send_file`, `io`, `Message` imports
- `contacts_validation.py`: replaced 240 restcountries.com HTTP calls with phonenumbers library + emoji flag helper; removed unused `requests` import
- `upload.py` `/multi`: implemented real multi-file routing (size check, compress images, per-type subdirs)
- `app_services.py verify_code`: deletes VerificationCode row on success (prevents OTP reuse)
- Dead code deleted: `ChatWindowModern.js`, `WhatsAppLayout.js`
