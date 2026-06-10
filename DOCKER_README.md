# 🐳 VipChat Docker Deployment

Complete production-ready Docker setup with multi-service orchestration, load balancing, monitoring, and auto-scaling.

## 📋 Quick Start

```bash
# 1. Clone repository
git clone <repository>
cd vipchat

# 2. Configure environment
cp .env.docker .env
nano .env  # Edit with your values

# 3. Start services
docker-compose up -d

# 4. Access application
# Frontend: http://localhost:5000
# Backend:  http://localhost:8000
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx Load Balancer                  │
│                  (Port 80/443 - SSL/TLS)                │
└──────────────┬──────────────────────┬───────────────────┘
               │                      │
       ┌───────▼────────┐    ┌───────▼────────┐
       │   Frontend     │    │   Backend      │
       │   (Nginx)      │    │   Cluster      │
       │   Port 80      │    │   (2+ instances)│
       └────────────────┘    └───────┬────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
            ┌───────▼──────┐  ┌──────▼─────┐  ┌──────▼─────┐
            │    MySQL     │  │   Redis    │  │   Celery   │
            │   Primary    │  │   Master   │  │   Worker   │
            └──────────────┘  └────────────┘  └────────────┘
                    │                │
            ┌───────▼──────┐  ┌──────▼─────┐
            │    MySQL     │  │   Redis    │
            │   Replica    │  │   Replica  │
            └──────────────┘  └────────────┘
```

## 📦 What's Included

### Services
- **Backend (Flask)** - Python API with WebSocket support (2+ instances)
- **Frontend (React)** - Static files served by Nginx
- **MySQL 8.0** - Primary database with replication
- **Redis 7** - Cache and pub/sub with replication
- **Nginx** - Load balancer with SSL termination
- **Celery** - Background task processing
- **Prometheus** - Metrics collection
- **Grafana** - Monitoring dashboards

### Features
- ✅ Multi-stage Docker builds (optimized image sizes)
- ✅ Auto-scaling with Docker Compose
- ✅ Health checks and auto-restart
- ✅ Load balancing across backend instances
- ✅ Database replication (MySQL + Redis)
- ✅ SSL/TLS support with Let's Encrypt
- ✅ Prometheus metrics + Grafana dashboards
- ✅ Automated backups
- ✅ Hot reload for development
- ✅ Resource limits and reservations
- ✅ Logging aggregation
- ✅ CI/CD with GitHub Actions

## 🚀 Deployment Options

### Development
```bash
docker-compose up -d
```

### Production
```bash
docker-compose -f docker-compose.production.yml up -d
```

### Kubernetes
```bash
kubectl apply -f kubernetes.yml
```

## 📝 Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Development setup (single instance) |
| `docker-compose.production.yml` | Production cluster (2+ instances) |
| `backend/Dockerfile` | Multi-stage backend build |
| `web/Dockerfile` | Multi-stage frontend build |
| `nginx-production.conf` | Load balancer configuration |
| `mysql-primary.cnf` | MySQL performance tuning |
| `prometheus.yml` | Monitoring configuration |
| `.env.docker` | Environment variables template |
| `Makefile` | Convenience commands |

## 🔧 Commands

### Using Makefile
```bash
make help          # Show all commands
make build         # Build images
make up            # Start services
make down          # Stop services
make logs          # View logs
make backup        # Backup database
make health        # Check service health
make prod-up       # Start production cluster
make scale         # Scale backend instances
```

### Using Docker Compose
```bash
# Development
docker-compose build
docker-compose up -d
docker-compose logs -f
docker-compose down

# Production
docker-compose -f docker-compose.production.yml up -d
docker-compose -f docker-compose.production.yml scale backend-1=5 backend-2=5
docker-compose -f docker-compose.production.yml logs -f
```

## 🔐 Security

### Required Changes Before Production
1. Generate strong secrets:
```bash
openssl rand -hex 32  # For SECRET_KEY
openssl rand -hex 32  # For JWT_SECRET_KEY
```

2. Update `.env` file with production values
3. Setup SSL certificates (Let's Encrypt recommended)
4. Configure firewall rules (only expose 80, 443)
5. Enable database backups
6. Setup monitoring alerts

## 📊 Monitoring

### Access Dashboards
- **Grafana**: http://localhost:3000 (admin/password from .env)
- **Prometheus**: http://localhost:9090

### Health Checks
```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/ready
curl http://localhost:8000/metrics
```

## 💾 Backup & Restore

### Automated Backups
```bash
# Run backup
make backup

# Backups saved to: backups/mysql-YYYYMMDD-HHMMSS.sql
```

### Manual Backup
```bash
docker exec vipchat-mysql mysqldump -u vipchat -p vipchat > backup.sql
docker cp vipchat-backend:/app/uploads ./uploads-backup
```

### Restore
```bash
docker exec -i vipchat-mysql mysql -u vipchat -p vipchat < backup.sql
docker cp ./uploads-backup vipchat-backend:/app/uploads
```

## 📈 Scaling

### Scale Backend Instances
```bash
# Development
docker-compose up -d --scale backend=5

# Production
docker-compose -f docker-compose.production.yml up -d --scale backend-1=5 --scale backend-2=5
```

### Auto-Scaling (Kubernetes)
```yaml
# kubernetes.yml includes HorizontalPodAutoscaler
# Automatically scales based on CPU/Memory usage
minReplicas: 3
maxReplicas: 10
```

## 🐛 Troubleshooting

### Backend won't start
```bash
docker-compose logs backend
docker-compose restart backend
```

### Database connection issues
```bash
docker exec vipchat-mysql mysqladmin ping
docker-compose restart mysql
```

### Clear everything and restart
```bash
docker-compose down -v
docker-compose build --no-cache
docker-compose up -d
```

## 📚 Documentation

- [Full Deployment Guide](DOCKER_DEPLOYMENT.md)
- [API Documentation](backend/API.md)
- [Architecture Overview](README.md)

## 🎯 Production Checklist

- [ ] Update all passwords in `.env`
- [ ] Generate strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Configure SSL certificates
- [ ] Setup domain DNS records
- [ ] Configure payment gateways (Stripe, PayPal)
- [ ] Setup SMS provider (Africa's Talking)
- [ ] Generate VAPID keys for push notifications
- [ ] Configure SMTP for emails
- [ ] Setup monitoring alerts
- [ ] Configure automated backups
- [ ] Test disaster recovery procedure
- [ ] Setup CI/CD pipeline
- [ ] Configure CDN (CloudFlare/AWS CloudFront)
- [ ] Enable rate limiting
- [ ] Configure firewall rules
- [ ] Review security settings

## 📞 Support

- GitHub: https://github.com/vipchat/vipchat
- Email: support@vipchat.app
- Docs: https://docs.vipchat.app

---

**Built with ❤️ for production deployments**
