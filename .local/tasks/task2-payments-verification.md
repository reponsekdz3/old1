# Stripe & Flutterwave Payment Verification System

## What & Why
Implement real payment-based account verification using both Stripe (card payments, international) and Flutterwave (Africa-focused, mobile money). Users pay a one-time fee to get a verified blue checkmark badge on their profile — like Twitter/X Blue or WhatsApp Business verified. Includes real Stripe Checkout Sessions, Flutterwave inline payment, webhook handling to confirm payment and mark user verified, and a polished verification purchase flow in the UI.

## Done looks like
- A "Get Verified" page/modal in the web app showing verification tiers (Personal $2.99 / Business $9.99)
- Clicking "Pay with Card" opens real Stripe Checkout in a new tab; on success the user's badge activates
- Clicking "Pay with Mobile Money / Africa" opens Flutterwave inline payment modal; on success badge activates
- Stripe webhook at `POST /api/payments/stripe/webhook` processes `checkout.session.completed` events
- Flutterwave webhook at `POST /api/payments/flutterwave/webhook` processes `charge.completed` events
- Payment records stored in DB (`payments` table: id, user_id, provider, amount, currency, status, provider_payment_id, created_at)
- After successful payment, `users.is_verified = true`, `users.verification_tier` set, `users.verified_at` set
- Verified users see an animated blue checkmark badge across the app (chat list, header, profile, contacts)
- Users can view their verification status and payment history at `/settings` → Verification tab
- All amounts and webhooks use real Stripe and Flutterwave APIs (no simulation)

## Out of scope
- Marketplace payments (Task 3)
- Business API subscription billing (Task 4)
- Refunds (admin handles manually via dashboard)

## Steps
1. **Payment model** — Create `Payment` SQLAlchemy model with provider, amount, currency, status, provider_payment_id, metadata JSON, and foreign key to User.
2. **Stripe backend** — Install `stripe` Python SDK. Create `/api/payments/stripe/create-checkout-session` (POST) that generates a real Stripe Checkout Session with success/cancel URLs. Create `/api/payments/stripe/webhook` (POST) that verifies Stripe signature and on `checkout.session.completed` marks the payment complete and user verified.
3. **Flutterwave backend** — Install `requests`. Create `/api/payments/flutterwave/initialize` (POST) that returns a Flutterwave payment link/tx_ref. Create `/api/payments/flutterwave/webhook` (POST) that verifies Flutterwave signature and on `charge.completed` marks the user verified.
4. **Verification status API** — Add `GET /api/payments/my-verification` for users to check their own verification status and payment history.
5. **Stripe frontend integration** — In the web app, add a "Get Verified" modal/page with plan selection. On "Pay with Card", call the backend to create a Checkout Session then redirect to `session.url`. On return from Stripe success URL, poll verification status and show success animation.
6. **Flutterwave frontend integration** — Integrate Flutterwave inline JS SDK. On "Pay with Mobile Money", call backend for tx_ref then open Flutterwave inline modal. On `onSuccess` callback, poll verification status and show success animation.
7. **Animated verified badge** — Build a `VerifiedBadge` React component with a pulsing blue checkmark animation (Framer Motion). Place it everywhere a username appears: ChatsTab items, ChatWindow header, ProfilePanel, ContactInfo, GroupCallScreen participant names.
8. **Settings verification tab** — Add a "Verification" tab in SettingsPage showing current status, payment history, and "Get Verified" CTA if not yet verified.

## Relevant files
- `backend/config.py`
- `backend/requirements.txt`
- `backend/app/__init__.py`
- `backend/app/models/models.py`
- `backend/app/routes/settings.py`
- `web/src/pages/SettingsPage.js`
- `web/src/components/ProfilePanel.js`
- `web/src/components/ContactInfo.js`
- `web/src/components/ChatsTab.js`
- `web/src/components/ChatWindow.js`
- `web/src/services/api.js`
