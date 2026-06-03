---
name: VipChat overhaul decisions
description: Design, security, and mobile UX decisions made during the June 2026 VipChat rebrand and feature overhaul
---

## Branding
- All "Bitese"/"bitese" strings replaced via `sed` batch + targeted edits
- Files updated: `mobile/app.json`, `mobile/package.json`, all JS screens, web HTML/JS, backend Python, README

## Mobile tab bar
- Tab bar is now dark (`COLORS.primary` = `#075E54`) not white — matches WhatsApp exactly
- Tab active/inactive tint: white / semi-transparent white
- Unread badge shown on Chats tab icon (red pill with count)
- Header now shows "VipChat" with QR + menu buttons on right

## Mobile settings overhaul
- Sections: Account, Privacy, Notifications, Chats, Storage & Data, Help & Support, About, Account Actions
- Privacy section: Read Receipts, Last Seen, Profile Photo, Status, Who Can Call Me, Groups, Blocked Contacts
- Danger actions: Log Out, Delete Account (with confirmation alerts)
- Profile card uses LinearGradient with avatar, online dot, bio

## Mobile calls tab
- FAB opens "New Call" modal with contact search
- Each contact shows voice + video call buttons
- Each call history row shows call-back buttons (voice + video)
- Call initiation emits `call_offer` socket event with `{ callee_id, call_type }`

## Mobile chat header
- Video and voice call buttons wired to `initiateCall()` which emits `call_offer` socket event
- Shows Alert confirmation before dialing

## Backend security headers (security.py)
- Added: `Content-Security-Policy` (full restrictive policy)
- Added: `Strict-Transport-Security` (only on HTTPS: max-age 1 year + preload)
- Added: Server fingerprinting removal (`Server`, `X-Powered-By` headers stripped)
- Added: API cache-busting headers (`Cache-Control: no-store` on `/api/` routes)
- Rate limiter now also returns `retry_after` field in 429 responses
- X-Forwarded-For properly parsed for IP detection behind proxies

**Why:** User requested "high level security and advanced powerful" backend.

## Offline support (added June 2026)
- `mobile/services/cache.js` — AsyncStorage wrapper: messages (200/chat), contacts, settings, call history, offline queue (`vc_offline_queue`).
- `mobile/hooks/useNetworkStatus.js` — `@react-native-community/netinfo` hook exposing `{ isOnline }`.
- Chat screen (`mobile/app/chat/[id].js`): cache-first load → network fetch → update cache. On send when offline → addToOfflineQueue. On reconnect (isOnline effect) → flush queue for current chatId.
- MessageBubble: `queued` = cloud-upload icon (gray), `failed` = alert-circle (red), bubble bg changes for failed/queued.
- Orange offline banner shown below chat header when disconnected.

## Phone contacts sync (added June 2026)
- `expo-contacts` + `READ_CONTACTS` in `mobile/app.json`. `mobile/services/phoneContacts.js` normalizes + POSTs to `/api/contacts/sync-phone`.
- Backend `POST /api/contacts/sync-phone` in `contacts.py` — returns `{ vipchat_contacts, phone_only_contacts }`.
- Contacts tab: VipChat contacts section + "Invite to VipChat" section for phone-only.
- ChatListItem: green online dot bottom-right of avatar when `contact.is_online`.

## Admin panel (added June 2026)
- `web/src/pages/AdminPage.js` (865 lines): Dashboard, Users (ban/unban/make-admin/delete/confirm), Messages, Groups, Activity charts, Broadcast modal.
- `backend/app/routes/admin.py` (382 lines, 17 endpoints): `/admin/me`, `/admin/dashboard`, `/admin/users` CRUD + actions, `/admin/groups`, `/admin/messages`, `/admin/broadcast`, `/admin/stats/activity`, `/admin/setup` (first-admin self-promote).
- `admin_required` decorator: checks `user.is_admin`. `/admin/setup` is JWT-only (no admin check) to bootstrap.

**Why:** User wanted WhatsApp-parity: phone contacts sync, offline first, real calls, no mocks or demos.
