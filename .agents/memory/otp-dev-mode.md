---
name: OTP dev mode
description: How OTP/SMS verification works in dev when no AFRICAN_TALKING_API_KEY is set.
---

## Rule
When `AFRICAN_TALKING_API_KEY` env var is not set, `AfricanTalkingService.send_verification_code()` runs in dev mode:
- Logs the OTP code to the backend console (WARNING level).
- Returns `{"ok": True, "dev": True, "code": "<the-code>"}` instead of calling the API.

`AuthService.send_verification_sms()` (in `app_services.py`) returns `{'ok': bool, 'dev_code': str|None}` — NOT a bool.

Both auth routes (`/auth/send-verification-sms` and `/auth/send-reconfirmation-sms`) include `dev_code` in the JSON response when in dev mode.

The frontend (`AccountVerificationPage.js`) checks `res.data.dev_code` and shows it as a toast + an amber banner on the OTP input screen.

**Why:** Allows full end-to-end OTP testing without an SMS provider API key during development.

**How to apply:** To enable real SMS, set `AFRICAN_TALKING_API_KEY` and `AFRICAN_TALKING_USERNAME` env vars. The `VIPCHAT_DEV_OTP=false` env var can also force-disable dev mode as a safety check for staging.
