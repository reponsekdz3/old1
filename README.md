# VipChat — Enterprise Messaging & Commerce Platform

<p align="center">
  <strong>Real-time encrypted messaging · HD video calls · Marketplace · Gift Economy · API Platform</strong>
</p>

## Quick Start

### Backend (Flask — port 8000)
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env   # fill in your env vars (see below)
python run.py
```

### Frontend (React — port 5000)
```bash
cd web
npm install
npm start
```

## Environment Variables

Create `backend/.env`:

```env
SECRET_KEY=your-secret-key
JWT_SECRET_KEY=your-jwt-secret

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal (sandbox: api-m.sandbox.paypal.com)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Flutterwave
FLUTTERWAVE_SECRET_KEY=FLWSECK_...
FLUTTERWAVE_WEBHOOK_HASH=...

# Web Push (VAPID)
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_CLAIMS_EMAIL=admin@example.com
```

## Gift / Coin Economy

| Item | Value |
|---|---|
| 1 USD | 100 Coins |
| Platform fee | 30% |
| Minimum withdrawal | $10 USD |

<p align="center">
  <img src="https://img.shields.io/badge/status-production--ready-brightgreen" />
  <img src="https://img.shields.io/badge/encryption-E2EE%20AES--256--GCM-blue" />
  <img src="https://img.shields.io/badge/database-MySQL%20%7C%20PostgreSQL%20%7C%20SQLite-orange" />
  <img src="https://img.shields.io/badge/license-Enterprise-purple" />
</p>

---

## What is VipChat?

VipChat is a **comprehensive enterprise communication and commerce platform** combining:

- 🔐 **Military-grade end-to-end encrypted messaging** (Signal Protocol / AES-256-GCM)
- 📹 **HD video and voice calls** with WebRTC and SFU cluster support
- 🛒 **Real marketplace** for digital goods, services, and B2B physical products
- 📢 **Sponsored ad platform** with CPM/CPC billing and real-time analytics
- 💼 **B2B commerce hub** with RFQ, bulk pricing, and wholesale trading
- 🔑 **Developer API platform** with tiered access, real Stripe billing, and usage metering
- 📱 **Cross-platform** — Web PWA + React Native mobile app (iOS & Android)
- 👥 **Groups & Communities** of up to 100,000 members
- 📣 **Broadcast Channels** for mass one-way communication
- ✅ **Verified Badge** system for trusted accounts
- 📇 **Phone contact auto-sync** — friends on VipChat appear automatically

---

## Who Uses VipChat?

### 👤 Individual Users
- **Secure daily communication** — E2EE chat, voice notes, photos, videos, documents
- **HD video and audio calls** — 1-on-1 and group up to 32 participants
- **Status updates** — share moments, auto-expire in 24 hours
- **Contact sync** — automatically discovers which phone contacts are on VipChat
- **QR Login** — scan from your phone to log into the web app instantly
- **Offline support** — messages queue and deliver when reconnected (PWA background sync)
- **Multi-device** — stay logged in on phone, tablet, and web simultaneously

### 🏢 Businesses & Enterprises
- **Team communication** — organized group chats for departments and projects
- **Broadcast channels** — send announcements to unlimited subscribers
- **Verified business badge** — build trust with customers
- **Business API** — integrate VipChat messaging into your CRM, helpdesk, or app
- **White-label options** — customize VipChat under your own brand (Enterprise plan)
- **Audit logs** — compliance-grade message and access logging

### 🛒 Sellers & Creators (Marketplace)
- **Digital goods** — sell eBooks, templates, music, video, software, courses, photos
- **Real Stripe payments** — instant checkout, real revenue
- **B2B trading** — list wholesale products with MOQ, bulk pricing, RFQ
- **Seller analytics** — track revenue, downloads, views, ratings in real time
- **Promoted listings** — pay to feature products at the top of search (CPM/CPC)
- **Wishlist & saves** — buyers save products for later
- **Seller inbox** — direct buyer-seller messaging tied to products

### 👨‍💻 Developers & SaaS Companies
- **Business API** — send messages, broadcasts, and media programmatically
- **Tiered plans** — Free → Starter ($9/mo) → Pro ($29/mo) → Enterprise ($99/mo)
- **Real-time webhooks** — receive delivery, read, and reply events
- **SDK & code samples** — JavaScript, Python, PHP, cURL examples built in
- **Usage dashboard** — live API call counts, rate limits, billing history
- **Sandbox testing** — full sandbox with test keys, no charges

### 🏭 B2B Buyers & Wholesalers
- **RFQ system** — send quote requests to verified suppliers, receive structured quotes
- **Bulk pricing tiers** — auto-negotiated pricing at defined quantity thresholds
- **Industry directory** — browse by industry, category, country
- **Direct supplier messaging** — negotiate deals inside the platform
- **Sample requests** — request product samples before bulk ordering

---

## Importance of VipChat

### 🌍 Privacy in an Insecure World
Most messaging apps collect your metadata, scan your messages, and sell your data.
VipChat uses **zero-knowledge E2EE** — the server stores only ciphertext.
Nobody — not VipChat staff, not governments, not hackers — can read your messages.

### 💰 One Platform for Communication AND Commerce
Instead of juggling WhatsApp for chat, Alibaba for B2B, Shopify for digital goods,
Twilio for messaging APIs, and AdSense for ads — VipChat does it all in one place.
This means less friction, better conversion, and lower cost for businesses.

### ⚡ Built for Emerging Markets
VipChat is built with African and Asian markets in mind:
- Africa's Talking SMS OTP works where email doesn't
- Low-bandwidth mode for 2G/3G connections
- Mobile-first design for smartphone-only users
- Flutterwave payment support alongside Stripe

### 🔒 Enterprise Security Without Enterprise Complexity
Signal Protocol key exchange, AES-256-GCM encryption, DTLS-SRTP for calls,
certificate pinning on mobile, military-grade security manager, rate limiting,
CSRF protection, audit logging — all configured out of the box.

---

## Core Features

### 💬 Messaging
| Feature | Details |
|---|---|
| Text messages | Rich text, emoji, links auto-preview |
| Media sharing | Photos, videos, audio, documents up to 2 GB |
| Voice notes | Compressed, waveform display |
| Location sharing | Real-time live GPS tracking |
| Disappearing messages | Auto-delete after configurable timer |
| Message reactions | Emoji reactions |
| Message editing | Edit within 15 minutes, shows edited indicator |
| Read receipts | ✓ sent · ✓✓ delivered · ✓✓ (blue) read |
| End-to-end encryption | AES-256-GCM + Signal Protocol Double Ratchet |
| Link previews | Auto-generated title, description, image |
| Contact sharing | Send vCard |
| Forwarding | Forward with original sender attribution |

### 📞 Calls
| Feature | Details |
|---|---|
| 1-on-1 voice | WebRTC HD audio |
| 1-on-1 video | WebRTC up to 4K |
| Group calls | Up to 32 participants, SFU-routed |
| Screen sharing | Desktop and mobile |
| Call recording | Local save with consent prompt |
| Noise cancellation | ML-based background noise removal |
| Adaptive bitrate | Quality adjusts to network conditions |
| E2EE calls | DTLS-SRTP encrypted media streams |

### 🛒 Marketplace
| Feature | Details |
|---|---|
| Digital goods | eBooks, templates, music, video, software, courses |
| Physical B2B | Wholesale, raw materials, manufacturing |
| Stripe payments | Real checkout, instant download delivery |
| Free downloads | One-click access for free items |
| Reviews & ratings | Verified purchase reviews, 1-5 stars |
| Seller analytics | Revenue, downloads, views, ratings dashboard |
| Wishlist | Save products for later, notify on price drop |
| Promoted ads | CPM/CPC campaigns with budget control |
| B2B listings | MOQ, bulk price tiers, lead times, sample orders |
| B2B RFQ | Send quote requests, receive structured quotes |
| Seller inbox | Direct buyer-seller messaging per product |
| File security | Extension whitelist, malware-safe upload handling |

### 📢 Ad Platform
| Feature | Details |
|---|---|
| Banner ads | Full-width promotional banners on homepage |
| Featured listings | Products boosted in search results |
| Sidebar ads | Contextual sidebar placement |
| Spotlight | Premium hero placement on marketplace |
| CPM billing | Cost per 1,000 impressions |
| CPC billing | Cost per click |
| Budget caps | Set total and remaining budget |
| Analytics | Impressions, clicks, CTR, conversions |
| Stripe payment | Real ad billing at campaign creation |
| Admin moderation | Approve/reject ad content |

### 🔑 Developer API
| Plan | Price | Msgs/day | Broadcasts | Webhooks |
|---|---|---|---|---|
| Free | $0 | 100 | 0 | 0 |
| Starter | $9/mo | 1,000 | 5/mo | 1 |
| Pro | $29/mo | 10,000 | 50/mo | 5 |
| Enterprise | $99/mo | Unlimited | Unlimited | 20 |

### 👥 Groups & Communities
- Groups: up to **1,024 members**, real-time WebSocket delivery
- Communities: up to **100,000 members**, paginated member list
- Admin / Moderator / Member roles with fine-grained permissions
- Sub-groups organized within community umbrella
- Group calls, polls, pinned messages, invite links with expiry

### 🔒 Security Architecture
- AES-256-GCM symmetric message encryption
- X3DH key agreement + Double Ratchet (forward secrecy, break-in recovery)
- DTLS-SRTP for all audio/video streams
- Two-factor authentication (TOTP)
- Biometric authentication on mobile (Face ID, fingerprint)
- JWT access + refresh token rotation
- Session management — view and revoke every device
- QR code login with one-time use and 5-minute expiry
- Military-grade security manager with intrusion detection
- Per-IP and per-user rate limiting
- CSRF token protection
- SQL injection prevention via parameterized ORM
- Audit logging with 365-day retention

---

## Tech Stack

### Backend
- **Flask** — Python web framework
- **SQLAlchemy** — ORM (MySQL · PostgreSQL · SQLite)
- **MySQL 8.0+** — Primary production database (utf8mb4)
- **PyMySQL** — Pure-Python MySQL connector
- **Flask-SocketIO** — Real-time WebSocket events
- **Flask-JWT-Extended** — JWT authentication with blocklist
- **Stripe** — Marketplace, ad, and API subscription billing
- **Africa's Talking** — SMS OTP for phone verification
- **Redis** — Caching, rate limiting, pub/sub (optional)

### Frontend (Web)
- **React 18** — Component UI
- **Tailwind CSS** — Utility-first styling
- **Zustand** — Global state management
- **Framer Motion** — Smooth animations
- **Socket.IO Client** — Real-time message delivery
- **QRCode.react** — QR code generation for login
- **React Router v6** — Client-side routing
- **PWA** — Service Worker, offline queue, install prompt, push notifications

### Mobile
- **React Native** + **Expo SDK 50**
- **Expo Router** — File-based navigation
- **expo-contacts** — Device phone contact access for auto-sync
- **expo-notifications** — Push notifications (FCM/APNs)
- **WebRTC** — Peer-to-peer and SFU-routed calls

---

## Getting Started

### Prerequisites
- Python 3.10+
- Node.js 18+
- MySQL 8.0+ (or use SQLite for development — no config needed)

### MySQL Local Setup

```sql
-- Run in MySQL shell
CREATE DATABASE vipchat CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'vipchat'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON vipchat.* TO 'vipchat'@'localhost';
FLUSH PRIVILEGES;
```

### Environment Configuration

Create `backend/.env`:

```env
# ── Database (MySQL — recommended) ──────────────────────────────────────────
MYSQL_HOST=localhost
MYSQL_USER=vipchat
MYSQL_PASSWORD=StrongPassword123!
MYSQL_DATABASE=vipchat
MYSQL_PORT=3306

# Or use a full connection URL:
# MYSQL_DATABASE_URL=mysql+pymysql://vipchat:password@localhost/vipchat?charset=utf8mb4

# ── Secrets (REQUIRED — change these!) ──────────────────────────────────────
SECRET_KEY=replace-with-64-random-hex-chars
JWT_SECRET_KEY=replace-with-another-64-random-hex-chars

# ── Stripe Payments (optional — paid features disabled without these) ────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ── SMS OTP (optional) ───────────────────────────────────────────────────────
AFRICAN_TALKING_USERNAME=sandbox
AFRICAN_TALKING_API_KEY=your_key

# ── Redis (optional — falls back to in-memory) ───────────────────────────────
REDIS_URL=redis://localhost:6379/0
```

### Run Backend

```bash
cd backend
pip install -r requirements.txt   # or: pip install PyMySQL flask flask-sqlalchemy flask-jwt-extended flask-socketio flask-cors flask-limiter stripe python-dotenv
python start.py
# → http://localhost:8000
```

Tables are created automatically on first start via `db.create_all()`.

### Run Web Frontend

```bash
cd web
npm install
PORT=5000 npm start
# → http://localhost:5000
```

### Run Mobile App

```bash
cd mobile
npm install
npx expo start
# Scan QR with Expo Go on your phone
```

---

## API Reference

### Auth Endpoints
```bash
POST /api/auth/register          # Register with phone + password
POST /api/auth/login             # Login, returns access + refresh tokens
POST /api/auth/refresh           # Refresh access token
POST /api/auth/logout            # Invalidate token
GET  /api/auth/sessions          # List active device sessions
DELETE /api/auth/sessions/<id>   # Revoke a specific session
POST /api/auth/qr-session/generate      # Generate QR login code
GET  /api/auth/qr-session/status/<id>   # Poll QR status
POST /api/auth/qr-session/confirm/<id>  # Confirm QR from mobile
```

### Messaging
```bash
GET    /api/messages/<contact_id>?page=1   # Load conversation
POST   /api/messages/send                  # Send message (text/media/location)
PUT    /api/messages/<id>/edit             # Edit message
DELETE /api/messages/<id>                  # Delete message
POST   /api/messages/<id>/react            # Add emoji reaction
```

### Contacts
```bash
GET  /api/contacts                     # List all contacts
POST /api/contacts                     # Add contact by phone
POST /api/contacts/discover            # Sync phone numbers → find VipChat users
POST /api/contacts/add-by-phone        # Add single contact by phone number
POST /api/contacts/bulk-add            # Import CSV/vCard contacts (max 1000)
GET  /api/contacts/search?q=John       # Search contacts
GET  /api/contacts/stats               # Contact stats (total, on VipChat, not on VipChat)
POST /api/contacts/sync-phone          # Legacy phone sync
```

### Marketplace
```bash
GET  /api/marketplace/products                    # Browse (search, filter, paginate)
POST /api/marketplace/products                    # Upload product (multipart)
GET  /api/marketplace/products/<id>               # Product detail (increments views)
PUT  /api/marketplace/products/<id>               # Update product (seller only)
DELETE /api/marketplace/products/<id>             # Remove product
POST /api/marketplace/products/<id>/purchase      # Buy (Stripe or free)
GET  /api/marketplace/products/<id>/download      # Get download URL (after purchase)
POST /api/marketplace/products/<id>/review        # Post a review (1-5 stars)
GET  /api/marketplace/my-products                 # Seller's products
GET  /api/marketplace/analytics/seller            # Seller revenue dashboard
GET  /api/marketplace/analytics/global            # Platform-wide stats
GET  /api/marketplace/featured                    # Promoted + top products
GET  /api/marketplace/ads?placement=homepage      # Get active ads for display
POST /api/marketplace/ads                         # Create ad campaign
POST /api/marketplace/ads/<id>/click              # Track ad click
GET  /api/marketplace/ads/my                      # My ad campaigns
POST /api/marketplace/promote/<product_id>        # Quick-promote a product
GET  /api/marketplace/b2b/listings                # Browse B2B listings
POST /api/marketplace/b2b/listings                # Create B2B listing
GET  /api/marketplace/b2b/listings/<id>           # B2B listing detail
POST /api/marketplace/b2b/listings/<id>/inquire   # Send RFQ
GET  /api/marketplace/b2b/inquiries?role=seller   # My inquiries (seller/buyer)
POST /api/marketplace/b2b/inquiries/<id>/quote    # Respond with quote
GET  /api/marketplace/wishlist                    # Get wishlist
POST /api/marketplace/wishlist/<product_id>       # Add to wishlist
DELETE /api/marketplace/wishlist/<product_id>     # Remove from wishlist
```

### API Billing
```bash
GET  /api/billing/subscription           # Get current API plan
POST /api/billing/subscription/upgrade   # Upgrade plan (Stripe checkout)
POST /api/billing/subscription/cancel    # Cancel at period end
GET  /api/billing/invoices               # Billing history
GET  /api/billing/usage?days=30          # API usage statistics
GET  /api/billing/plans                  # All available plans + features
POST /api/billing/webhook                # Stripe billing webhook
```

### Business API (with API key)
```bash
Authorization: Bearer vck_live_your_api_key

POST /v1/messages/send           # Send a message to a phone number
POST /v1/broadcasts/send         # Send to a group
GET  /v1/analytics               # Usage analytics
GET  /v1/webhooks                # List webhooks
POST /v1/webhooks                # Register a webhook
```

---

## Database Schema (Key Tables)

```
users                     — accounts, phone numbers, badges
messages                  — E2EE ciphertexts, media URLs
contacts                  — user → contact relationships
groups / group_members    — group chats
communities               — large group containers
channels                  — broadcast channels
marketplace_products      — digital/physical goods
marketplace_purchases     — payment records
marketplace_reviews       — ratings and reviews
marketplace_ads           — ad campaigns (CPM/CPC)
marketplace_ad_clicks     — impression/click events
b2b_listings              — wholesale product listings
b2b_inquiries             — RFQ / quote requests
marketplace_wishlists     — saved products
marketplace_analytic_events — view/purchase events
api_subscriptions         — API plan subscriptions
api_invoices              — billing history
api_usage_records         — per-request metering
user_subscriptions        — chat plan subscriptions
```

---

## Subscription Plans Summary

### Chat/User Plans
| Plan | Price | Storage | Calls | Features |
|---|---|---|---|---|
| Free | $0 | 5 GB | HD | Standard messaging |
| Pro | $9.99/mo | 50 GB | 4K | Priority delivery, themes |
| Business | $29.99/mo | Unlimited | 4K + recording | API access, verified badge, analytics |

### API Developer Plans
| Plan | Price | Msgs/day | Rate Limit | Features |
|---|---|---|---|---|
| Free | $0 | 100 | 10 req/min | Basic access |
| Starter | $9/mo | 1,000 | 30 req/min | Broadcasts, 1 webhook |
| Pro | $29/mo | 10,000 | 100 req/min | 50 broadcasts, 5 webhooks, analytics |
| Enterprise | $99/mo | Unlimited | 500 req/min | 20 webhooks, SLA, white-label, SSO |

---

## Architecture Overview

```
┌──────────────┐   ┌──────────────┐   ┌──────────────────┐
│  Web (PWA)   │   │ Mobile (RN)  │   │  3rd Party Apps  │
│  Port 5000   │   │  Expo Go     │   │  API Key Access  │
└──────┬───────┘   └──────┬───────┘   └────────┬─────────┘
       │                  │                     │
       └──────────────────┼─────────────────────┘
                          │ HTTPS + WSS
              ┌───────────▼───────────┐
              │   Flask API Server    │
              │   Port 8000           │
              │   REST + Socket.IO    │
              └───────────┬───────────┘
                          │
          ┌───────────────┼───────────────┐
          │               │               │
   ┌──────▼──────┐ ┌──────▼──────┐ ┌─────▼───────┐
   │  MySQL DB   │ │ Redis Cache │ │   Stripe    │
   │ (primary)   │ │ (optional)  │ │  Payments   │
   └─────────────┘ └─────────────┘ └─────────────┘
```

---

## Security Notes

- **Never commit `.env` files** — use environment secrets management
- **Rotate SECRET_KEY and JWT_SECRET_KEY** in production
- **Enable HTTPS** — all cookies are `Secure` and `HttpOnly` in production
- **Stripe webhooks** — always verify signature with `STRIPE_WEBHOOK_SECRET`
- **Database backups** — schedule daily MySQL dumps
- **Rate limiting** — default 100 req/min per IP, 50 req/min in production

---

## License

**VipChat Enterprise License** — All rights reserved.

This software is proprietary. Unauthorized copying, distribution, modification,
or use without written permission from VipChat Inc. is strictly prohibited.

For licensing: legal@vipchat.app

---

<p align="center">VipChat — Powering secure communication and commerce worldwide</p>
