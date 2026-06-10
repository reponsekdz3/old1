---
name: Voice transcription architecture
description: How voice note transcription is implemented across web and mobile.
---

## Rule
Voice note transcription uses OS-native speech recognition, **not** any AI/cloud API.

## Web
- `window.SpeechRecognition || window.webkitSpeechRecognition` — works in Chrome, Edge, Safari
- `continuous = true`, `interimResults = true`; restart on `onend` if still recording (browsers stop after silence)
- `phaseRef` pattern used to avoid stale closures in `onend` callback
- Waveform decoded post-recording via `AudioContext.decodeAudioData(blob.arrayBuffer())`
- **Transcript stored as `content` field** on Message — no DB migration needed; backend already accepts content + media_url together for voice messages

## Mobile
- `@react-native-voice/voice` ^3.2.4 — requires `expo prebuild` / EAS Build (native module)
- Wrapped in `try { Voice = require(...).default } catch {}` so the app doesn't crash without native build
- `expo-av` used for recording; expo-av Sound.createAsync used for playback with progress callbacks

## Why content field (not new column)
Backend `messages.py` validates: if `media_url` exists, `content` can be null — so transcript can be optionally stored there with no schema change.
