.PHONY: help build up down restart logs clean backup restore

help:
	@echo "VipChat Docker Commands:"
	@echo "  make build          - Build all Docker images"
	@echo "  make up             - Start all services"
	@echo "  make down           - Stop all services"
	@echo "  make restart        - Restart all services"
	@echo "  make logs           - View logs"
	@echo "  make clean          - Clean up Docker resources"
	@echo "  make backup         - Backup database and files"
	@echo "  make restore        - Restore from backup"
	@echo "  make prod-build     - Build production images"
	@echo "  make prod-up        - Start production cluster"
	@echo "  make prod-down      - Stop production cluster"
	@echo "  make scale          - Scale backend instances"
	@echo "  make health         - Check service health"

build:
	docker-compose build

up:
	docker-compose up -d
	@echo "✓ VipChat is starting..."
	@echo "  Frontend: http://localhost:5000"
	@echo "  Backend:  http://localhost:8000"
	@echo "  MySQL:    localhost:3306"
	@echo "  Redis:    localhost:6379"

down:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f

clean:
	docker-compose down -v
	docker system prune -f

backup:
	@mkdir -p backups
	@echo "Backing up MySQL..."
	docker exec vipchat-mysql mysqldump -u vipchat -p$${MYSQL_PASSWORD} vipchat > backups/mysql-$$(date +%Y%m%d-%H%M%S).sql
	@echo "Backing up uploads..."
	docker cp vipchat-backend:/app/uploads backups/uploads-$$(date +%Y%m%d-%H%M%S)
	@echo "✓ Backup complete"

restore:
	@read -p "Enter backup file (e.g., backups/mysql-20240101-120000.sql): " file; \
	docker exec -i vipchat-mysql mysql -u vipchat -p$${MYSQL_PASSWORD} vipchat < $$file
	@echo "✓ Restore complete"

prod-build:
	docker-compose -f docker-compose.production.yml build

prod-up:
	docker-compose -f docker-compose.production.yml up -d
	@echo "✓ VipChat production cluster started"
	@echo "  Load Balancer: http://localhost"
	@echo "  Prometheus:    http://localhost:9090"
	@echo "  Grafana:       http://localhost:3000"

prod-down:
	docker-compose -f docker-compose.production.yml down

scale:
	@read -p "Number of backend instances (default 4): " count; \
	count=$${count:-4}; \
	docker-compose -f docker-compose.production.yml up -d --scale backend-1=$$count --scale backend-2=$$count

health:
	@echo "Checking service health..."
	@curl -f http://localhost:8000/health && echo "✓ Backend: healthy" || echo "✗ Backend: unhealthy"
	@curl -f http://localhost:5000/health && echo "✓ Frontend: healthy" || echo "✗ Frontend: unhealthy"
	@docker exec vipchat-mysql mysqladmin ping -h localhost && echo "✓ MySQL: healthy" || echo "✗ MySQL: unhealthy"
	@docker exec vipchat-redis redis-cli ping && echo "✓ Redis: healthy" || echo "✗ Redis: unhealthy"
