---
title: Fix errors + PostgreSQL + Verified badge system
---
# Foundation: Fix Errors + PostgreSQL + Core Infrastructure

## What & Why
Fix the `normalizeOptions is not a function` CRA startup error, migrate from SQLite to PostgreSQL as the production database, set up environment variable management for all API keys (Stripe, Flutterwave), and add the `Verified` badge system to users (paid verification via payment). This is the foundation all other tasks depend on.

## Done looks like
- `npm start` in `web/` starts without any errors
- Backend connects to PostgreSQL (configured via `DATABASE_URL` env var); falls back to SQLite for local dev
- All existing DB migrations applied cleanly on PostgreSQL
- Users table has `is_verified`, `verified_at`, `verification_payment_id` columns
- A verified blue checkmark badge appears on verified users' profile/chat headers
- All env vars for Stripe, Flutterwave documented in `.env.example` files (backend + web)
- Backend health check at `/api/health` returns `{"status":"healthy"}`

## Out of scope
- Actual Stripe/Flutterwave payment flows (Task 2)
- Marketplace models (Task 3)
- Business API models (Task 4)

## Steps
1. **Fix CRA normalizeOptions error** — Upgrade or pin `react-scripts` and conflicting deps (ajv, ajv-keywords) to compatible versions so `npm start` works without errors.
2. **PostgreSQL support** — Update `config.py` to properly parse `DATABASE_URL` (handle `postgres://` → `postgresql://` for SQLAlchemy), add `psycopg2-binary` if missing, configure pool settings for production.
3. **Environment variable setup** — Add `.env.example` files for backend and web listing all required vars (DATABASE_URL, SECRET_KEY, JWT_SECRET_KEY, STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, FLUTTERWAVE_SECRET_KEY, FLUTTERWAVE_PUBLIC_KEY). Set placeholder env vars in Replit environment.
4. **Verified badge model** — Add `is_verified` (bool), `verified_at` (datetime), `verification_tier` (string: 'personal'|'business'), `verification_payment_id` (string) columns to the `User` model via migration.
5. **Verified badge API** — Add `GET /api/users/{id}/verification-status` and admin endpoint `POST /api/admin/users/{id}/verify` for manual verification override.
6. **Verified badge UI** — Add a blue checkmark badge component that shows on verified users in: chat list, chat header, profile panel, contact info, and group member lists.
7. **Restart and validate** — Restart both workflows, confirm health check passes and the app loads correctly.

## Relevant files
- `web/package.json`
- `backend/config.py`
- `backend/requirements.txt`
- `backend/app/__init__.py`
- `backend/app/models/models.py`
- `backend/app/routes/auth.py`
- `backend/app/routes/profile.py`
- `web/src/components/ProfilePanel.js`
- `web/src/components/ContactInfo.js`
- `web/src/components/ChatsTab.js`
- `web/src/components/ChatWindow.js`