---
name: Bitese overhaul decisions
description: Key architecture and design decisions from the Bitese comprehensive overhaul
---

## DB: PostgreSQL, not SQLite
The backend uses PostgreSQL via psycopg2. Do NOT assume SQLite. `ALTER TABLE` migrations use PostgreSQL syntax (e.g. `ALTER COLUMN ... TYPE TEXT`). The migrations list in `backend/app/__init__.py` runs on every startup and silently swallows duplicate-column errors.

**Why:** Early assumption of SQLite caused missed column-type bugs. `password_hash` and `qr_code_url` overflow varchar(255) — both must be `db.Text`.

**How to apply:** Any new model column must use `db.Text` for long strings (hashes, base64 blobs, URLs). Add a matching `ALTER TABLE` migration for existing tables.

## Phone input component
`frontend/src/components/PhoneInput.js` — fully custom, no external library needed.
- Reads country data from `frontend/src/data/phoneCountries.js` (240+ countries with ISO2, dialCode)
- Flag emoji generated via `getFlag(iso2)` using Unicode regional indicator characters
- Dropdown is searchable by name, code, or ISO2
- Default country: Uganda (UG / +256)
- `onChange` always returns full international number: `+dialCode + localDigits`
- Used in both LoginPage and SignupPage for the phone field

## Country data
`frontend/src/data/phoneCountries.js` — 240+ countries, each `{ name, iso2, dialCode }`.
`getFlag(iso2)` converts ISO2 to flag emoji.
`detectCountryFromNumber(number)` finds the country from a full international number.

## Profile Panel
`frontend/src/components/ProfilePanel.js` — slide-in drawer (left side).
- View mode: shows all 7 profile fields (name, bio, phone, email, age, country, city) in info cards + profile completeness bar
- Edit mode: full form with inline validation, country searchable dropdown with flag emojis, avatar upload
- Saves via `PUT /api/auth/profile`, updates Zustand store with `setUser(data.user)` — NO page reload
- Backend `profile.py` now accepts age, country, city, email with full validation

## QR Code Scanner
`frontend/src/components/QRScannerModal.js` — modern modal.
- "My Code" tab: shows generated QR with branded frame + center logo, scan count, download + share buttons
- "Scan" tab: live camera with animated laser line + corner brackets overlay, auto-detects Bitese QR codes via jsQR
- `stopScanning()` properly tears down MediaStream via `streamRef`
- QR generate returns: `{ qr_code: { qr_image_url, scan_count } }` — access as `myQRCode.qr_code.qr_image_url`

## Settings page
`frontend/src/pages/SettingsPage.js` — fully redesigned.
- Card-based sections: Privacy, Notifications, Storage & Data, Backup, Help & About
- All toggles use animated `Toggle` component (spring motion)
- All selects use custom inline dropdowns (no native `<select>`)
- Optimistically updates state then rolls back on API error

## Status image/video upload
- StatusTab has three compose modes: Text, Photo (gallery/camera), Video
- Upload flow: POST to `/upload/image` or `/upload/video` → get `url` back → POST to `/status`
- StatusViewer: tap left half = go back, tap right half = advance; hold = pause timer

## Push notifications
`frontend/src/services/pushNotifications.js` — registers SW, requests permission, subscribes after login.
Backend fires push on every message send. VAPID keys auto-generated on startup.

## EmojiPicker
`frontend/src/components/EmojiPicker.js` — 10 categories × ~60 emojis, search, recent history (localStorage `bitese_recent_emojis`), category icon tabs. ChatWindow wraps it in absolute-positioned motion.div.

## Backend upload serving
Uploaded files at `backend/uploads/{images,videos,audio,documents}/`. Served via Flask route `/uploads/<path:filename>`.

## Flask-Limiter
`limiter = Limiter(key_func=get_remote_address)` in `__init__.py`. Login: 10/min, Signup: 5/min. In-memory storage.

## Group WebRTC calling
Mesh topology via `useGroupWebRTC` hook. All signaling through backend Socket.IO rooms. `GroupCallScreen` with adaptive grid layout.

## Attachment preview
`AttachmentPreviewModal` → `pendingAttachment` state → `handleSendAttachment(caption)` uploads then sends.
