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
