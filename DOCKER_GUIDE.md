# 🐋 VipChat Docker Deployment Guide

## Quick Start (3 Commands)

```bash
# 1. Build and start all services
docker-compose up -d --build

# 2. Check status
docker-compose ps

# 3. View logs
docker-compose logs -f backend
```

**Access the app:**
- Web Frontend: http://localhost
- Backend API: http://localhost:8000
- MySQL: localhost:3306
- Redis: localhost:6379

---

## What Gets Deployed

| Service | Container | Port | Purpose |
|---------|-----------|------|---------|
| MySQL 8.0 | vipchat-mysql | 3306 | Primary database with utf8mb4 |
| Redis 7 | vipchat-redis | 6379 | Cache + pub/sub + rate limiting |
| Backend | vipchat-backend | 8000 | Flask API + Socket.IO |
| Nginx | vipchat-web | 80, 443 | Reverse proxy + static files |

---

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB RAM minimum (8GB recommended)
- 20GB disk space

---

## Configuration

### 1. Environment Variables

Create `.env` in project root:

```env
# Secrets (REQUIRED - change these!)
SECRET_KEY=your-production-secret-key-64-chars-min
JWT_SECRET_KEY=your-jwt-secret-key-64-chars-min

# Stripe (optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# PayPal (optional)
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...

# Flutterwave (optional)
FLUTTERWAVE_SECRET_KEY=FLWSECK_...

# SMS (optional)
AFRICAN_TALKING_USERNAME=sandbox
AFRICAN_TALKING_API_KEY=...

# Push Notifications (optional)
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_CLAIMS_EMAIL=admin@vipchat.app
```

### 2. Build Configuration

**Production build** (optimized, smaller images):
```bash
docker-compose up -d --build
```

**Development build** (with hot reload):
```bash
docker-compose -f docker-compose.dev.yml up
```

---

## Commands

### Start Services
```bash
# Start all
docker-compose up -d

# Start specific service
docker-compose up -d backend

# Force rebuild
docker-compose up -d --build --force-recreate
```

### Stop Services
```bash
# Stop all
docker-compose down

# Stop and remove volumes (WARNING: deletes data!)
docker-compose down -v
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f mysql

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Database Operations
```bash
# Enter MySQL shell
docker exec -it vipchat-mysql mysql -u vipchat -pVipChat123! vipchat

# Backup database
docker exec vipchat-mysql mysqldump -u vipchat -pVipChat123! vipchat > backup.sql

# Restore database
docker exec -i vipchat-mysql mysql -u vipchat -pVipChat123! vipchat < backup.sql

# Reset database (WARNING: deletes all data!)
docker-compose down -v
docker-compose up -d mysql
```

### Redis Operations
```bash
# Enter Redis CLI
docker exec -it vipchat-redis redis-cli

# Clear cache
docker exec vipchat-redis redis-cli FLUSHALL
```

### Backend Shell
```bash
# Enter backend container
docker exec -it vipchat-backend bash

# Run migrations
docker exec vipchat-backend python migrate.py

# Run tests
docker exec vipchat-backend pytest
```

### Monitor Resources
```bash
# Resource usage
docker stats

# Disk usage
docker system df

# Clean unused images/volumes
docker system prune -a --volumes
```

---

## Scaling

### Horizontal Scaling
```bash
# Scale backend to 3 replicas
docker-compose up -d --scale backend=3
```

### Production Stack (Kubernetes)
```bash
kubectl apply -f kubernetes-production.yaml
```

---

## Health Checks

All services have built-in health checks:

```bash
# Check all services health
docker-compose ps

# Backend health endpoint
curl http://localhost:8000/api/health

# Expected response:
# {"status":"healthy","service":"vipchat-backend","version":"1.0.0"}
```

---

## Troubleshooting

### Backend won't start
```bash
# Check logs
docker-compose logs backend

# Common issues:
# - MySQL not ready → wait 30s, check: docker-compose logs mysql
# - Port 8000 in use → change in docker-compose.yml
# - Missing env vars → check .env file exists
```

### Database connection failed
```bash
# Verify MySQL is running
docker-compose ps mysql

# Test connection
docker exec vipchat-mysql mysqladmin -u vipchat -pVipChat123! ping

# Restart MySQL
docker-compose restart mysql
```

### Out of disk space
```bash
# Check disk usage
docker system df

# Clean everything (WARNING: removes all unused data!)
docker system prune -a --volumes

# Remove old logs
docker exec vipchat-backend rm -rf /app/logs/*.log
```

### Slow performance
```bash
# Check resource usage
docker stats

# Increase memory limit in docker-compose.yml:
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
        reservations:
          memory: 1G
```

---

## Production Deployment

### SSL/TLS Setup

1. Get SSL certificate (Let's Encrypt):
```bash
# Install certbot
sudo apt-get install certbot

# Generate certificate
sudo certbot certonly --standalone -d yourdomain.com

# Certificates location: /etc/letsencrypt/live/yourdomain.com/
```

2. Update nginx.conf:
```nginx
server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;
    
    # ... rest of config
}
```

3. Mount certificates in docker-compose.yml:
```yaml
web:
  volumes:
    - /etc/letsencrypt/live/yourdomain.com:/etc/nginx/ssl:ro
```

### Environment Hardening

1. Change default passwords in docker-compose.yml
2. Set strong SECRET_KEY and JWT_SECRET_KEY
3. Enable firewall rules
4. Set up automated backups
5. Enable Redis password protection
6. Use Docker secrets instead of environment variables

### Monitoring

**Prometheus + Grafana** (recommended):
```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

**Simple logging:**
```bash
# Centralized logging
docker-compose logs -f | tee vipchat.log
```

---

## Backup Strategy

### Automated Daily Backup
```bash
# Add to crontab
0 2 * * * docker exec vipchat-mysql mysqldump -u vipchat -pVipChat123! vipchat | gzip > /backups/vipchat-$(date +\%Y\%m\%d).sql.gz

# Cleanup old backups (keep 30 days)
0 3 * * * find /backups -name "vipchat-*.sql.gz" -mtime +30 -delete
```

### Volume Backup
```bash
# Backup uploads
docker run --rm -v old1_mysql_data:/data -v $(pwd):/backup ubuntu tar czf /backup/mysql-backup.tar.gz /data

# Restore uploads
docker run --rm -v old1_mysql_data:/data -v $(pwd):/backup ubuntu tar xzf /backup/mysql-backup.tar.gz -C /
```

---

## Performance Optimization

### Enable Redis Caching
Already configured! Redis handles:
- Session storage
- Rate limiting
- Message queue
- Pub/sub events

### Database Optimization
```sql
-- Run inside MySQL container
USE vipchat;

-- Add indexes for common queries
CREATE INDEX idx_messages_created ON messages(created_at);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_contacts_user ON contacts(user_id);
```

### Nginx Caching
```nginx
# Add to nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;

location /api/marketplace/products {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
}
```

---

## Update & Maintenance

### Update VipChat
```bash
# Pull latest code
git pull origin main

# Rebuild containers
docker-compose down
docker-compose up -d --build

# Run migrations if needed
docker exec vipchat-backend python migrate.py
```

### Update Docker Images
```bash
# Update base images
docker-compose pull

# Rebuild with new base
docker-compose up -d --build
```

---

## Success Checklist

- [ ] MySQL running and accepting connections
- [ ] Redis responding to PING
- [ ] Backend health check returns 200
- [ ] Can access web UI at http://localhost
- [ ] Can register a new account
- [ ] Can send a test message
- [ ] WebSocket connection established
- [ ] File uploads working
- [ ] Database persists after restart

---

## Support

**Documentation:** README.md  
**Issues:** Check logs with `docker-compose logs -f`  
**Performance:** Run `docker stats` to check resource usage

---

**VipChat is now running! 🚀**

Access: http://localhost  
API: http://localhost:8000/api  
Docs: http://localhost:8000/api/docs
