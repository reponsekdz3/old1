## 🚀 Deployment Guide - Bitese Enterprise

Complete guide for deploying Bitese Enterprise to production with 2B+ user support.

---

## 📋 Pre-Deployment Checklist

- [ ] PostgreSQL 13+ installed and optimized
- [ ] Redis 6+ running
- [ ] SSL/TLS certificates obtained (Let's Encrypt recommended)
- [ ] Stripe/PayPal accounts created
- [ ] Sentry error tracking configured
- [ ] CDN service configured (Cloudflare/AWS CloudFront)
- [ ] Domain name and DNS configured
- [ ] Kubernetes cluster provisioned (for scale)
- [ ] Monitoring stack ready (Prometheus/Grafana)

---

## 🐳 Docker Deployment

### Quick Start (Development)
```bash
cd bitese1
docker-compose up -d
# Backend: http://localhost:5000
# Frontend: http://localhost:3000
# Mobile: http://localhost:19000
```

### Production Docker Stack

**1. Build and push images**
```bash
docker build -t bitese/backend:2.0.0 ./backend
docker build -t bitese/web:2.0.0 ./web
docker push bitese/backend:2.0.0
docker push bitese/web:2.0.0
```

**2. Deploy with Docker Swarm**
```bash
docker swarm init
docker stack deploy -c docker-compose.prod.yml bitese
```

---

## ☸️ Kubernetes Deployment

### 1. Create Namespace
```bash
kubectl create namespace bitese
kubectl label namespace bitese name=bitese
```

### 2. Configure Secrets
```bash
kubectl create secret generic bitese-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=redis-url="redis://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=stripe-key="..." \
  -n bitese
```

### 3. Create ConfigMap
```bash
kubectl create configmap bitese-config \
  --from-literal=flask-env="production" \
  --from-literal=log-level="INFO" \
  --from-literal=shard-count="256" \
  -n bitese
```

### 4. Deploy Backend
```bash
kubectl apply -f k8s/backend-deployment.yaml -n bitese
kubectl apply -f k8s/backend-service.yaml -n bitese
```

### 5. Deploy Frontend
```bash
kubectl apply -f k8s/web-deployment.yaml -n bitese
kubectl apply -f k8s/web-service.yaml -n bitese
```

### 6. Setup Ingress
```bash
kubectl apply -f k8s/ingress.yaml -n bitese
```

### 7. Auto-scaling
```bash
kubectl autoscale deployment backend \
  --min=3 --max=100 \
  --cpu-percent=70 \
  -n bitese
```

---

## 🗄️ Database Optimization

### PostgreSQL Tuning (Production)

```sql
-- Connection limits
ALTER SYSTEM SET max_connections = 1000;
ALTER SYSTEM SET shared_buffers = '4GB';
ALTER SYSTEM SET effective_cache_size = '12GB';
ALTER SYSTEM SET maintenance_work_mem = '1GB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '32MB';
ALTER SYSTEM SET default_statistics_target = 100;

-- Enable parallel queries
ALTER SYSTEM SET max_worker_processes = 8;
ALTER SYSTEM SET max_parallel_workers = 8;
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;

-- Apply changes
SELECT pg_reload_conf();
```

### Database Replication Setup

**Master-Slave Replication:**
```bash
# Configure master
wal_level = replica
max_wal_senders = 10
wal_keep_size = 1GB

# Configure slave
primary_conninfo = 'host=master dbname=bitese user=replication password=...'
```

### Sharding Strategy

```
User ID Range Distribution:
Shard 0-25:   Database 1 (Region: US-East)
Shard 26-51:  Database 2 (Region: US-West)
Shard 52-77:  Database 3 (Region: EU-West)
Shard 78-103: Database 4 (Region: AP-SE)
...
```

---

## 🔒 Security Configuration

### TLS/SSL Setup

```bash
# Generate self-signed cert (dev)
openssl req -x509 -newkey rsa:4096 -nodes -out cert.pem -keyout key.pem -days 365

# Or use Let's Encrypt (prod)
certbot certonly --standalone -d api.bitese.app
```

### Nginx Configuration

```nginx
upstream backend {
    server backend-1:5000 weight=3;
    server backend-2:5000 weight=2;
    server backend-3:5000 weight=2;
}

server {
    listen 443 ssl http2;
    server_name api.bitese.app;

    ssl_certificate /etc/ssl/certs/bitese.crt;
    ssl_certificate_key /etc/ssl/private/bitese.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=100r/s;
    limit_req zone=api burst=200 nodelay;

    location / {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 📊 Monitoring & Logging

### Prometheus Configuration

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'bitese'
    static_configs:
      - targets: ['localhost:9090']
  - job_name: 'postgres'
    static_configs:
      - targets: ['localhost:9187']
  - job_name: 'redis'
    static_configs:
      - targets: ['localhost:9121']
```

### ELK Stack (Elasticsearch, Logstash, Kibana)

```yaml
# Filebeat config
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/log/bitese/*.log

output.elasticsearch:
  hosts: ["elasticsearch:9200"]

setup.kibana:
  host: "kibana:5601"
```

### Sentry Error Tracking

```python
import sentry_sdk
from sentry_sdk.integrations.flask import FlaskIntegration

sentry_sdk.init(
    dsn="https://key@sentry.io/project",
    integrations=[FlaskIntegration()],
    traces_sample_rate=0.1,
    environment="production"
)
```

---

## 🚀 Scaling Strategy

### Horizontal Scaling Steps

**Phase 1: Initial Setup (0-100K users)**
- Single PostgreSQL instance
- Single Redis instance
- 2-4 API servers

**Phase 2: Growth (100K-10M users)**
- Master-slave PostgreSQL replication
- Redis cluster (3+ nodes)
- 10-20 API servers
- CDN for static assets

**Phase 3: Enterprise (10M-1B+ users)**
- Database sharding (256 shards across 8-16 databases)
- Redis cluster with 20+ nodes
- 50-200 API servers
- Global CDN with edge caching
- Multi-region deployment

### Auto-scaling Rules

```yaml
triggers:
  - cpu_usage > 70% → scale up +2 servers
  - memory_usage > 80% → scale up +1 server
  - request_rate > 10k/sec → scale up +3 servers
  - queue_size > 50k → scale up workers +2
  
cooldown_period: 300 seconds
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example

```yaml
name: Deploy Bitese

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run tests
        run: pytest tests/ --cov

  build:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build Docker image
        run: docker build -t bitese/backend:${{ github.sha }} ./backend
      - name: Push to registry
        run: docker push bitese/backend:${{ github.sha }}

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Kubernetes
        run: |
          kubectl set image deployment/backend \
            backend=bitese/backend:${{ github.sha }} \
            -n bitese
```

---

## ✅ Post-Deployment Verification

```bash
# Check health
curl https://api.bitese.app/health

# Check database
psql postgresql://user:pass@host/bitese -c "SELECT COUNT(*) FROM messages_partitioned;"

# Check Redis
redis-cli -u redis://host:6379 ping

# Check Kubernetes
kubectl get pods -n bitese
kubectl logs -n bitese deployment/backend

# Load testing
locust -f load_tests.py -u 1000 -r 100 --run-time 5m
```

---

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Check connections
psql -U user -d bitese -c "SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;"

# Kill idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
WHERE state = 'idle' AND query_start < NOW() - INTERVAL '10 min';
```

### High Memory Usage
```bash
# Check Redis
redis-cli info memory

# Evict old keys
redis-cli FLUSHDB

# Restart service
systemctl restart redis
```

### API Latency
```bash
# Check database query performance
EXPLAIN ANALYZE SELECT * FROM messages WHERE sender_id = '...';

# Add indexes if needed
CREATE INDEX idx_messages_sender ON messages(sender_id);
```

---

## 📱 Client Configuration

### Web Frontend (.env)
```
REACT_APP_API_URL=https://api.bitese.app
REACT_APP_WS_URL=wss://api.bitese.app/ws
REACT_APP_SENTRY_DSN=https://...
```

### Mobile App (env.json)
```json
{
  "api": "https://api.bitese.app",
  "ws": "wss://api.bitese.app/ws",
  "stripe": "pk_live_...",
  "version": "2.0.0"
}
```

---

## 📈 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| API Response Time | < 100ms | - |
| P99 Latency | < 500ms | - |
| Message Delivery | < 50ms | - |
| Database Query | < 10ms | - |
| Cache Hit Rate | > 95% | - |
| Uptime | 99.99% | - |

---

**Version**: 2.0.0-Enterprise  
**Last Updated**: June 2024
