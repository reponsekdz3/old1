## 🏗️ Bitese Enterprise Architecture Overview

Complete technical architecture for a production-grade, globally-scalable messaging platform with Signal Protocol E2EE.

---

## 📐 System Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                       │
│  ┌────────────┐  ┌───────────────┐  ┌──────────────────┐   │
│  │  Web App   │  │  Mobile Apps  │  │  Desktop Client  │   │
│  │  (React)   │  │  (React Native)│  │  (Electron)      │   │
│  └────────────┘  └───────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTPS/WSS │
                              │
┌─────────────────────────────────────────────────────────────┐
│                   API GATEWAY LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │  Load        │  │  Rate        │  │  TLS           │   │
│  │  Balancer    │  │  Limiter     │  │  Termination   │   │
│  │  (Nginx)     │  │  (SlowAPI)   │  │  (mTLS)        │   │
│  └──────────────┘  └──────────────┘  └────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Flask Application                      │  │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────┐   │  │
│  │  │  E2EE        │  │  Security   │  │  Payment │   │  │
│  │  │  Service     │  │  Manager    │  │  Service │   │  │
│  │  │  (Signal)    │  │  (Audit)    │  │  (Stripe)│   │  │
│  │  └──────────────┘  └─────────────┘  └──────────┘   │  │
│  │  ┌──────────────┐  ┌─────────────┐  ┌──────────┐   │  │
│  │  │  Message     │  │  User       │  │  Group   │   │  │
│  │  │  Service     │  │  Service    │  │  Service │   │  │
│  │  └──────────────┘  └─────────────┘  └──────────┘   │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
    │              │              │              │
    │ Messages     │ Cache        │ Queue        │ Metrics
    │ Search       │ Sessions     │ Tasks        │ Logs
    ▼              ▼              ▼              ▼
┌─────────────┐ ┌──────────────┐ ┌────────────┐ ┌──────────┐
│ PostgreSQL  │ │ Redis        │ │ Message    │ │ Elastic  │
│ (Sharded)   │ │ Cluster      │ │ Queue      │ │ search   │
│             │ │              │ │            │ │          │
│ 256 Shards  │ │ Multi-node   │ │ Celery     │ │ Logs     │
└─────────────┘ └──────────────┘ └────────────┘ └──────────┘
```

---

## 🔐 End-to-End Encryption Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE (Alice)                          │
│                                                                  │
│  1. Generate Keys                                               │
│     ├─ Identity Key (Ed25519) - long-term                      │
│     ├─ Signed PreKey (Curve25519) - medium-term               │
│     └─ One-Time PreKeys (Curve25519) - single-use            │
│                                                                  │
│  2. Publish Bundle                                             │
│     └─ POST /api/v2/e2ee/keys/register                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Bundle Published
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE                                  │
│                                                                  │
│  • Store: E2EEKeyBundle (Alice's public keys)                 │
│  • Store: E2EEOneTimePreKeys (Alice's OTKs)                  │
│  • Index: Shard by user_id for fast retrieval                │
│  • Cache: Redis for <5min for fast lookups                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Bob Needs Bundle
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE (Bob)                            │
│                                                                  │
│  3. Retrieve Bundle & X3DH                                      │
│     ├─ GET /api/v2/e2ee/keys/<alice_id>                       │
│     ├─ Receive: identity_key, signed_prekey, one_time_prekey│
│     │                                                           │
│     └─ X3DH Key Agreement:                                     │
│        ├─ DH1: ephemeral_key × alice_signed_prekey           │
│        ├─ DH2: bob_identity × alice_signed_prekey            │
│        ├─ DH3: bob_identity × alice_identity                 │
│        ├─ DH4: ephemeral_key × alice_one_time_prekey         │
│        └─ KDF(DH1||DH2||DH3||DH4) = SHARED_SECRET            │
│                                                                  │
│  4. Double Ratchet Initialization                             │
│     ├─ root_key = SHARED_SECRET                              │
│     ├─ chain_key = KDF(SHARED_SECRET)                        │
│     └─ message_key = KDF(chain_key)                          │
│                                                                  │
│  5. Encrypt Message                                            │
│     ├─ plaintext = "Hello Alice!"                            │
│     ├─ nonce = random_bytes(12)                              │
│     ├─ ciphertext = AES-256-GCM(message_key, plaintext)     │
│     ├─ Payload: {ciphertext, nonce, tag}                    │
│     └─ POST /api/v2/e2ee/messages/send                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    Message transmitted (encrypted)
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    SERVER SIDE                                  │
│                                                                  │
│  • Store encrypted payload in messages_p{X}                   │
│  • NO plaintext stored                                         │
│  • Notification sent: "[Encrypted Message]"                  │
│  • Audit logged: message_encrypted_sent                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Message delivered
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    CLIENT SIDE (Alice)                          │
│                                                                  │
│  6. Decrypt Message                                            │
│     ├─ GET /api/v2/e2ee/messages/<msg_id>                    │
│     ├─ Receive: {ciphertext, nonce, tag}                    │
│     ├─ Ratchet Step: message_key = KDF(chain_key)           │
│     ├─ plaintext = AES-256-GCM-DECRYPT(message_key, ...)   │
│     └─ Display: "Hello Alice!"                              │
│                                                                  │
│  7. Forward Secrecy                                            │
│     ├─ DH Ratchet: Generate ephemeral keypair                │
│     ├─ Update: root_key = KDF(DH_shared || root_key)        │
│     ├─ Update: chain_key = KDF(root_key)                    │
│     └─ New keys never reused                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Database Sharding Strategy

```
User ID Hash Distribution:
┌─────────────────────────────────────────┐
│  hash(user_id) % 256 = shard_number     │
└─────────────────────────────────────────┘

Physical Distribution:
┌─────────────────────────────────────────────────────────────┐
│ Shard 0-31:   PostgreSQL Primary 1    (Region: US-East)   │
│ Shard 32-63:  PostgreSQL Primary 2    (Region: US-West)   │
│ Shard 64-95:  PostgreSQL Primary 3    (Region: EU)        │
│ Shard 96-127: PostgreSQL Primary 4    (Region: Asia-SE)   │
│ Shard 128-159: PostgreSQL Replica 1   (Region: US-East)   │
│ ...                                                         │
└─────────────────────────────────────────────────────────────┘

Messages Table Partitioning (per shard):
┌─────────────────────────────────────────┐
│ CREATE TABLE messages_p0                │
│   PARTITION OF messages_partitioned     │
│   FOR VALUES WITH (MODULUS 256, REMAINDER 0)
└─────────────────────────────────────────┘

Query Routing:
┌─────────────────────────────────────────┐
│ shard = hash(sender_id) % 256          │
│ connection_string = shard_map[shard]   │
│ execute(query, connection_string)      │
└─────────────────────────────────────────┘
```

---

## 💰 Subscription & Monetization Flow

```
┌─────────────────────────────────────────┐
│   User Signs Up (Free Tier)             │
│   • 1GB storage                         │
│   • 100 messages/day                    │
│   • Basic features only                 │
└─────────────────────────────────────────┘
           │
           │ User Triggers Upgrade
           │
┌─────────────────────────────────────────┐
│   Select Subscription Tier              │
│   • Basic ($4.99/mo)                   │
│   • Professional ($14.99/mo)           │
│   • Enterprise ($99.99/mo)             │
└─────────────────────────────────────────┘
           │
           │ Payment Processing
           │
┌─────────────────────────────────────────┐
│   Stripe API Integration                │
│   1. Create Customer                    │
│   2. Attach Payment Method              │
│   3. Create Subscription                │
│   4. Handle Webhooks                    │
└─────────────────────────────────────────┘
           │
           │ Success/Failure
           │
┌─────────────────────────────────────────┐
│   Update SubscriptionPlan               │
│   • plan = 'professional'               │
│   • stripe_subscription_id = sub_...   │
│   • period_end = +30 days              │
│   • Record revenue transaction         │
└─────────────────────────────────────────┘
           │
           │ Feature Activation
           │
┌─────────────────────────────────────────┐
│   Grant Tier-Specific Features          │
│   • Unlock video calls                  │
│   • Increase storage limit              │
│   • Enable API access                   │
│   • Priority support queue              │
└─────────────────────────────────────────┘
```

---

## 📊 Scalability & Load Testing

### Expected Performance

```
Single Server Capacity:
├─ Concurrent Users: 1,000-2,000
├─ Messages/Second: 5,000-10,000
├─ API Responses: < 100ms (p50), < 500ms (p99)
├─ Memory Usage: 4-8GB
└─ CPU Usage: 40-60%

Cluster Performance (10 servers):
├─ Concurrent Users: 10,000-20,000
├─ Messages/Second: 50,000-100,000
├─ API Responses: < 50ms (p50), < 300ms (p99)
├─ Availability: 99.9%
└─ Data Consistency: Strong (PostgreSQL)

Multi-Region Performance (100 servers, 4 regions):
├─ Concurrent Users: 100,000+
├─ Messages/Second: 500,000+
├─ API Responses: < 50ms (p50), < 200ms (p99)
├─ Availability: 99.99%
└─ Geo-distributed latency: < 100ms
```

### Load Testing Results

```python
# Locust load test configuration
from locust import HttpUser, task, between

class BitesUser(HttpUser):
    wait_time = between(1, 5)
    
    @task(10)
    def send_message(self):
        self.client.post("/api/v2/e2ee/messages/send", json={
            "receiver_id": "user-id",
            "content": "test message"
        })
    
    @task(3)
    def get_messages(self):
        self.client.get("/api/v2/e2ee/messages/list")
    
    @task(1)
    def register_keys(self):
        self.client.post("/api/v2/e2ee/keys/register", json={...})
```

---

## 🔒 Security Model

```
┌─────────────────────────────────────────┐
│   TRANSPORT SECURITY                    │
│   • HTTPS/TLS 1.3                      │
│   • WSS (WebSocket Secure)             │
│   • Certificate Pinning                │
│   • mTLS for service-to-service       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│   MESSAGE ENCRYPTION                    │
│   • Signal Protocol E2EE               │
│   • AES-256-GCM per message            │
│   • Perfect Forward Secrecy (PFS)      │
│   • Double Ratchet algorithm           │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│   DATA ENCRYPTION                       │
│   • AES-256-GCM at-rest                │
│   • Key rotation every 90 days         │
│   • Field-level PII encryption         │
│   • Encrypted database backups         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│   ACCESS CONTROL                        │
│   • JWT authentication                 │
│   • Role-based permissions (RBAC)      │
│   • Rate limiting per endpoint         │
│   • IP reputation tracking             │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│   AUDIT & COMPLIANCE                    │
│   • Immutable audit logs               │
│   • All user actions logged            │
│   • 365-day retention                  │
│   • GDPR data export support           │
└─────────────────────────────────────────┘
```

---

## 🚀 Deployment Architecture

```
                    Global Users
                        │
        ┌───────────────┼───────────────┐
        │               │               │
    US-East         EU-West         Asia-SE
        │               │               │
    CDN Edge        CDN Edge        CDN Edge
        │               │               │
        └───────────────┼───────────────┘
                        │
                  Global Load Balancer
                        │
        ┌───────────────┼───────────────┐
        │               │               │
    Region 1        Region 2        Region 3
    Kubernetes       Kubernetes      Kubernetes
        │               │               │
    ┌───────────┐   ┌───────────┐   ┌───────────┐
    │3x API Pod │   │3x API Pod │   │3x API Pod │
    └────┬──────┘   └────┬──────┘   └────┬──────┘
         │               │               │
    ┌────┴────────┬──────┴────────┬──────┴────┐
    │             │              │            │
    DB Shard  DB Shard       DB Shard     DB Shard
    (4x per region)
    │
    └─ Replicated Primary
       with Standby
```

---

**Version**: 2.0.0-Enterprise  
**Last Updated**: June 2024  
**Author**: Bitese Development Team
