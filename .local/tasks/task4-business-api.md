# WhatsApp Business API Platform — Sell API Access

## What & Why
Build a full WhatsApp Business API-equivalent platform that lets businesses buy API access to send messages, manage contacts, create chatbots, and use bulk messaging features — all via a paid subscription. Like Twilio or the official WhatsApp Business API but running on this platform. Includes API key management, subscription billing via Stripe, rate-limited REST endpoints for external use, webhook configuration for businesses, developer documentation portal, and an admin dashboard to manage API clients.

## Done looks like
- Businesses can register for an API account at `/api-platform` (web page)
- API subscription tiers: Starter (free, 100 msg/day), Pro ($29/mo, 10k msg/day), Enterprise ($99/mo, unlimited)
- Stripe recurring subscription (monthly) for Pro and Enterprise tiers
- Each API client gets a unique API key (`vck_live_...`) stored hashed in DB
- Real functional REST API endpoints (separate from the user-facing app API):
  - `POST /v1/messages/send` — Send a text/media message to a phone number
  - `GET /v1/messages` — List sent messages with delivery status
  - `POST /v1/contacts/import` — Bulk import contacts
  - `GET /v1/contacts` — List contacts
  - `POST /v1/groups/create` — Create a group
  - `POST /v1/broadcasts/send` — Send broadcast to multiple numbers
  - `GET /v1/analytics` — Message delivery stats
  - `POST /v1/webhooks/configure` — Set a webhook URL to receive inbound message events
- API key auth via `Authorization: Bearer vck_live_...` header
- Rate limiting enforced per tier using Redis (or in-memory fallback)
- Inbound messages (when a platform user replies to a business message) are forwarded to the business's configured webhook URL
- Developer portal web page with API docs (auto-generated from routes), code examples (curl, Python, JS), and API key management
- Business dashboard: usage stats (messages sent, delivered, failed), webhook logs, billing management
- All API calls logged to `api_usage` table for billing and analytics

## Out of scope
- Mobile SDK (web API only)
- SMS fallback (platform messages only)
- Marketplace integration (Task 3)

## Steps
1. **API platform DB models** — Create models: `ApiClient` (user_id, business_name, api_key_hash, tier, is_active, webhook_url, webhook_secret), `ApiSubscription` (client_id, stripe_subscription_id, tier, status, current_period_end), `ApiUsageLog` (client_id, endpoint, method, status_code, timestamp, message_count).
2. **API key system** — Generate cryptographically secure API keys (`vck_live_` prefix + 32 random bytes hex), store only bcrypt hash, return plaintext only once at creation. Add middleware that validates `Authorization: Bearer` header against hashed keys and attaches client context to request.
3. **Business API v1 routes** — Create `/v1/` Blueprint with all 8 endpoints listed above. Each endpoint uses the existing platform user/message/group infrastructure but scoped to the API client's account. Apply per-tier rate limits.
4. **Stripe subscription billing** — Add `POST /api/platform/subscribe` to create Stripe recurring subscription for Pro/Enterprise. Add webhook handler for `customer.subscription.updated/deleted` to update tier. Add `GET /api/platform/billing` for billing portal redirect.
5. **Webhook delivery** — When a platform user sends a message to a business (API client), forward it to the business's configured webhook URL with HMAC-SHA256 signature. Retry up to 3 times on failure. Log delivery attempts.
6. **Rate limiting enforcement** — Use flask-limiter with per-client dynamic limits based on tier (Starter: 100/day, Pro: 10k/day, Enterprise: unlimited). Return `429` with `X-RateLimit-Remaining` header.
7. **Developer portal UI** — Add `/api-platform` page in the web app. Include: sign-up/login for API access, interactive API documentation (OpenAPI-style, rendered in UI), API key display (shown once, copy button), usage dashboard with charts (messages sent/delivered/failed over time).
8. **Business dashboard** — Usage stats page with daily/weekly message volume charts, webhook event log (last 100 events with payload preview), billing section with current plan and "Upgrade" / "Manage Billing" buttons.
9. **Admin controls** — In the existing AdminPage, add an "API Clients" section to view all registered businesses, their tier, usage, and ability to suspend/reinstate API access.
10. **API documentation page** — Auto-rendered docs page from route metadata showing endpoint descriptions, request/response schemas, curl examples, and error codes. Include authentication guide prominently.

## Relevant files
- `backend/app/__init__.py`
- `backend/app/models/models.py`
- `backend/app/routes/admin.py`
- `backend/app/routes/messages.py`
- `backend/app/routes/groups.py`
- `backend/app/routes/advanced_features.py`
- `backend/config.py`
- `backend/requirements.txt`
- `web/src/pages/AdminPage.js`
- `web/src/pages/ChatPage.js`
- `web/src/components/MainNavigation.js`
- `web/src/services/api.js`
