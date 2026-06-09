---
name: Database Configuration
description: MySQL-first, PostgreSQL supported, SQLite dev-only with warning.
---

# Database Configuration

File: `backend/config.py`

**Priority:**
1. `MYSQL_URL` env var → MySQL (production default)
2. `DATABASE_URL` env var → PostgreSQL (alternative production)
3. SQLite → dev-only fallback with `RuntimeWarning` — NEVER use in production

**Why:** User requirement — no SQLite in production. SQLite fallback kept for local dev convenience but warns loudly.

**How to apply:** Set `MYSQL_URL` or `DATABASE_URL` in environment secrets for any deployed/staging environment. Never rely on silent SQLite fallback.
