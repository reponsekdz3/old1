# VipChat Docker Deployment Guide

Complete Docker setup for VipChat platform with multi-service orchestration, load balancing, and production-ready configurations.

## 🚀 Quick Start

### Prerequisites
- Docker 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 20GB+ disk space

### Development Setup (Single Command)

```bash
# Clone and start
git clone <repository>
cd vipchat
cp .env.docker .env
docker-compose up -d

# Access the application
# Frontend: http://localhost:5000
# Backend API: http://localhost:8000
# MySQL: localhost:3306
# Redis: localhost:6379
```

## 📁 Docker Architecture

```
VipChat Docker Setup
├── backend/
│   ├── Dockerfile                 # Multi-stage Python build
│   ├── docker-entrypoint.sh       # Startup script
│   └── .dockerignore
├── web/
│   ├── Dockerfile                 # Multi-stage Node + Nginx
│   ├── nginx.conf                 # Frontend proxy config
│   └── .dockerignore
├── docker-compose.yml             # Development orchestration
├── docker-compose.production.yml  # Production with clustering
├── nginx-production.conf          # Load balancer config
├── mysql-primary.cnf              # MySQL optimization
├── prometheus.yml                 # Monitoring config
└── .env.docker                    # Environment template
```

## 🔧 Configuration

### Step 1: Environment Variables

```bash
cp .env.docker .env
```

Edit `.env` with your values:

```env
# Required - Change These!
SECRET_KEY=$(openssl rand -hex 32)
JWT_SECRET_KEY=$(openssl rand -hex 32)
MYSQL_ROOT_PASSWORD=YourSecurePassword123!
MYSQL_PASSWORD=YourDatabasePassword123!
REDIS_PASSWORD=YourRedisPassword123!

# Payment Gateways (Optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
FLUTTERWAVE_SECRET_KEY=FLWSECK_...

# SMS Provider (Optional)
AFRICAN_TALKING_API_KEY=...

# Web Push (Generate VAPID keys)
VAPID_PRIVATE_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_CLAIMS_EMAIL=admin@yourdomain.com
```

### Step 2: Generate VAPID Keys (for push notifications)

```bash
docker run --rm node:18-alpine npx web-push generate-vapid-keys
```

Copy the output to your `.env` file.

## 🏗️ Build & Deploy

### Development (Single Instance)

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Production (Clustered)

```bash
# Use production compose file
docker-compose -f docker-compose.production.yml build

# Start with 2 backend instances + load balancer
docker-compose -f docker-compose.production.yml up -d

# Scale backend instances
docker-compose -f docker-compose.production.yml up -d --scale backend-1=3 --scale backend-2=3

# View logs
docker-compose -f docker-compose.production.yml logs -f backend-1 backend-2 nginx
```

## 🔍 Service URLs

| Service | URL | Credentials |
|---------|-----|-------------|
| Frontend | http://localhost:5000 | - |
| Backend API | http://localhost:8000 | - |
| MySQL | localhost:3306 | user: vipchat, password: from .env |
| Redis | localhost:6379 | password: from .env |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin / from .env |

## 🗄️ Database Management

### Access MySQL Container

```bash
# Connect to MySQL
docker exec -it vipchat-mysql mysql -u vipchat -p

# Backup database
docker exec vipchat-mysql mysqldump -u vipchat -p vipchat > backup.sql

# Restore database
docker exec -i vipchat-mysql mysql -u vipchat -p vipchat < backup.sql
```

### Access Redis Container

```bash
# Connect to Redis
docker exec -it vipchat-redis redis-cli -a YourRedisPassword123!

# Monitor Redis commands
docker exec -it vipchat-redis redis-cli -a YourRedisPassword123! MONITOR

# Get Redis info
docker exec -it vipchat-redis redis-cli -a YourRedisPassword123! INFO
```

## 📊 Monitoring & Logs

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend

# Production logs
docker-compose -f docker-compose.production.yml logs -f
```

### Health Checks

```bash
# Backend health
curl http://localhost:8000/health

# Frontend health
curl http://localhost:5000/health

# Detailed readiness check
curl http://localhost:8000/health/ready

# Prometheus metrics
curl http://localhost:8000/metrics
```

### Prometheus & Grafana

1. Access Grafana: http://localhost:3000
2. Login: admin / (password from .env)
3. Add Prometheus data source: http://prometheus:9090
4. Import VipChat dashboard

## 🔒 SSL/TLS Setup

### Let's Encrypt with Certbot

```bash
# Install Certbot
docker run -it --rm --name certbot \
  -v "/etc/letsencrypt:/etc/letsencrypt" \
  -v "/var/lib/letsencrypt:/var/lib/letsencrypt" \
  -p 80:80 \
  certbot/certbot certonly --standalone -d yourdomain.com

# Copy certificates
mkdir -p ssl
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/

# Auto-renewal (add to crontab)
0 0 * * 0 docker run --rm --name certbot -v "/etc/letsencrypt:/etc/letsencrypt" -v "/var/lib/letsencrypt:/var/lib/letsencrypt" -p 80:80 certbot/certbot renew --quiet
```

### Self-Signed Certificate (Development)

```bash
# Generate self-signed certificate
mkdir -p ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ssl/privkey.pem \
  -out ssl/fullchain.pem \
  -subj "/CN=localhost"
```

## 🚀 Production Deployment

### AWS EC2

```bash
# 1. Launch EC2 instance (t3.large or better)
# 2. Install Docker
sudo yum update -y
sudo yum install -y docker
sudo service docker start
sudo usermod -a -G docker ec2-user

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Clone repository
git clone <repository>
cd vipchat

# 5. Configure environment
cp .env.docker .env
nano .env  # Edit with production values

# 6. Deploy
docker-compose -f docker-compose.production.yml up -d

# 7. Setup auto-start on reboot
sudo systemctl enable docker
```

### DigitalOcean Droplet

```bash
# 1. Create Droplet (4GB RAM minimum)
# 2. SSH into droplet
ssh root@your-droplet-ip

# 3. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# 4. Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 5. Deploy
git clone <repository>
cd vipchat
cp .env.docker .env
nano .env
docker-compose -f docker-compose.production.yml up -d
```

## 🔧 Troubleshooting

### Backend won't start

```bash
# Check logs
docker-compose logs backend

# Common issues:
# 1. MySQL not ready - wait 30 seconds and retry
# 2. Missing environment variables - check .env file
# 3. Port already in use - stop conflicting service

# Restart backend
docker-compose restart backend
```

### Database connection errors

```bash
# Verify MySQL is running
docker ps | grep mysql

# Test connection
docker exec vipchat-mysql mysqladmin ping -h localhost

# Reset database
docker-compose down -v
docker-compose up -d
```

### Redis connection errors

```bash
# Verify Redis is running
docker ps | grep redis

# Test Redis
docker exec vipchat-redis redis-cli ping

# Check Redis password
docker exec vipchat-redis redis-cli -a YourPassword123! ping
```

### Build errors

```bash
# Clean rebuild
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

### Out of disk space

```bash
# Clean up Docker
docker system prune -a --volumes

# Remove old images
docker image prune -a

# Remove unused volumes
docker volume prune
```

## 📈 Performance Tuning

### MySQL Optimization

Edit `mysql-primary.cnf`:

```ini
innodb_buffer_pool_size=4G    # 70-80% of available RAM
max_connections=500            # Adjust based on load
innodb_log_file_size=512M
```

### Redis Optimization

```bash
# Increase max memory
docker-compose exec redis redis-cli CONFIG SET maxmemory 2gb
docker-compose exec redis redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### Backend Scaling

```bash
# Add more backend workers
docker-compose -f docker-compose.production.yml up -d --scale backend-1=5 --scale backend-2=5
```

## 🔐 Security Best Practices

1. **Change default passwords** in `.env`
2. **Use strong SECRET_KEY and JWT_SECRET_KEY** (64+ random hex chars)
3. **Enable firewall** - only expose ports 80, 443
4. **Setup SSL/TLS** with Let's Encrypt
5. **Regular backups** of MySQL and Redis data
6. **Update images** regularly: `docker-compose pull && docker-compose up -d`
7. **Monitor logs** for suspicious activity
8. **Use secrets management** (AWS Secrets Manager, HashiCorp Vault)

## 📦 Backup & Restore

### Automated Backup Script

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

# MySQL backup
docker exec vipchat-mysql mysqldump -u vipchat -p$MYSQL_PASSWORD vipchat > $BACKUP_DIR/mysql.sql

# Redis backup
docker exec vipchat-redis redis-cli -a $REDIS_PASSWORD SAVE
docker cp vipchat-redis:/data/dump.rdb $BACKUP_DIR/redis.rdb

# Uploads backup
docker cp vipchat-backend:/app/uploads $BACKUP_DIR/

# Compress
tar -czf $BACKUP_DIR.tar.gz $BACKUP_DIR
rm -rf $BACKUP_DIR

# Keep last 7 days
find /backups -name "*.tar.gz" -mtime +7 -delete
```

### Restore

```bash
# Stop services
docker-compose down

# Restore MySQL
docker-compose up -d mysql
docker exec -i vipchat-mysql mysql -u vipchat -p$MYSQL_PASSWORD vipchat < backup/mysql.sql

# Restore Redis
docker cp backup/redis.rdb vipchat-redis:/data/dump.rdb
docker-compose restart redis

# Restore uploads
docker cp backup/uploads vipchat-backend:/app/

# Start all services
docker-compose up -d
```

## 🎯 Next Steps

1. **Domain Setup**: Point your domain to server IP
2. **SSL Certificate**: Setup Let's Encrypt SSL
3. **Email Service**: Configure SMTP for notifications
4. **CDN**: Setup CloudFlare or AWS CloudFront
5. **Monitoring**: Setup Sentry for error tracking
6. **Backups**: Automate daily backups
7. **CI/CD**: Setup GitHub Actions for auto-deployment

## 📞 Support

- Documentation: https://docs.vipchat.app
- GitHub Issues: https://github.com/vipchat/vipchat/issues
- Email: support@vipchat.app

---

**VipChat** - Enterprise Messaging & Commerce Platform
