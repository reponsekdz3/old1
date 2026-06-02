---
name: Bitese overhaul decisions
description: Key architecture and design decisions from the Bitese comprehensive overhaul
---

## DB: PostgreSQL, not SQLite
The backend uses PostgreSQL via psycopg2. Do NOT assume SQLite. `ALTER TABLE` migrations use PostgreSQL syntax (e.g. `ALTER COLUMN ... TYPE TEXT`). The migrations list in `backend/app/__init__.py` runs on every startup and silently swallows duplicate-column errors.

**Why:** Early assumption of SQLite caused missed column-type bugs. `password_hash` and `qr_code_url` overflow varchar(255) — both must be `db.Text`.

**How to apply:** Any new model column must use `db.Text` for long strings (hashes, base64 blobs, URLs). Add a matching `ALTER TABLE` migration for existing tables.

## Status image/video upload
- StatusTab has three compose modes: Text (colour bg + text), Photo (gallery/camera), Video (file picker)
- StatusComposer uses hidden `<input type="file">` refs: one for gallery, one with `capture="environment"` for camera
- Upload flow: POST to `/upload/image` or `/upload/video` first → get `url` back → POST to `/status` with `media_url`, `media_type`, `background_color`, `content` (caption for media)
- StatusViewer detects image/video from `media_type` field OR by matching URL extensions
- StatusViewer: tap left half = go back, tap right half = advance; hold = pause timer
- Own statuses show delete button + viewers count row at bottom
- Backend status model got two new columns (`media_type`, `background_color`) added via runtime ALTER TABLE migration (June 2026)
- Legacy `__bg:#XXXXXX__text` prefix still parsed for backwards compat in both create and get_all_statuses routes
- Added `/api/status/create` alias route for forwards compat (frontend now uses `/api/status`)

## Login page
- Left panel is an animated Bitese app mockup: contacts list + 8 animated chat bubbles (text, voice, image, link, location types), cycling active contact every 3.5s
- Right panel: clean login form with inline field-level validation errors, show/hide password, push registration after success
- Use `h-screen overflow-hidden` on outer container

## Signup page
- 3-step wizard with AnimatePresence transitions: Step 1 (phone, name, email), Step 2 (age, country dropdown with search, city — all optional), Step 3 (password with 5-level strength meter + account summary)
- Country dropdown: searchable from COUNTRIES array, click-to-select, clear button
- Account summary box on Step 3 shows all collected data before commit

## Push notifications
Fully wired: `backend/app/routes/push.py` exposes `/api/push/subscribe`, `/api/push/unsubscribe`, `/api/push/vapid-public-key`. Push fires on every message send in `messages.py`. Frontend service at `frontend/src/services/pushNotifications.js` registers SW, requests permission, and subscribes after login.

## EmojiPicker
The custom `EmojiPicker.js` has 10 categories × ~60 emojis each, with search, recent history (localStorage `bitese_recent_emojis`), and per-category icon tabs. ChatWindow wraps it in an `absolute` positioned motion.div — EmojiPicker provides inner content only (no positioning).

## Backend upload serving
- Uploaded files are served via `@app.route('/uploads/<path:filename>')` → `send_from_directory` from `backend/uploads/`
- Upload folder structure: `backend/uploads/images/`, `videos/`, `audio/`, `documents/`
- Upload URLs returned as `/uploads/{type}/{filename}` — these now resolve correctly

## Flask-Limiter setup
- `limiter = Limiter(key_func=get_remote_address)` initialized in `backend/app/__init__.py`
- Auth routes import `from app import limiter` and use `@limiter.limit("10 per minute")` on login, `@limiter.limit("5 per minute")` on signup
- Uses in-memory storage (fine for dev; add Redis for prod)

## Group WebRTC calling
- Mesh topology: every participant creates a peer connection to every other participant
- Socket relay: all signaling goes through backend via `user_{user_id}` rooms
- Hook `useGroupWebRTC` manages Map of peer connections and remote streams
- `GroupCallScreen` shows grid of VideoTiles (1 col for 1 user, 2 cols for 2-4, 3 cols for 5+)
- `IncomingGroupCall` toast-style notification at top of screen
- `useGroupCallStore` in store.js holds group call state separately from 1-to-1 call store

## Attachment preview
- `AttachmentPreviewModal` shows file preview before sending (image, video, audio, document)
- `handleAttach` in ChatWindow now sets `pendingAttachment` state instead of uploading immediately
- `handleSendAttachment(caption)` does the actual upload + message send
- Upload endpoint map: image→`/upload/image`, video→`/upload/video`, audio→`/upload/audio`, doc→`/upload/document`

## Document display
- Filename extracted from `media_url.split('/').pop().split('?')[0]` for display in chat bubble
- Audio messages (`media_type === 'audio'`) render with an `<audio controls>` element
