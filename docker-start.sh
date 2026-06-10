#!/bin/bash

# VipChat Docker Startup Script
# This script handles complete setup and deployment

set -e

echo "=========================================="
echo "     VipChat Docker Deployment"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Error: Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from template...${NC}"
    if [ -f .env.docker ]; then
        cp .env.docker .env
        echo -e "${GREEN}✓ .env file created${NC}"
        echo -e "${YELLOW}⚠ Please edit .env file with your configuration before continuing${NC}"
        echo ""
        read -p "Press Enter to edit .env file now, or Ctrl+C to exit..."
        ${EDITOR:-nano} .env
    else
        echo -e "${RED}Error: .env.docker template not found${NC}"
        exit 1
    fi
fi

echo -e "${GREEN}✓ Environment configuration found${NC}"
echo ""

# Menu
echo "Select deployment mode:"
echo "1) Development (single instance, hot reload)"
echo "2) Production (clustered, load balanced)"
echo "3) Stop all services"
echo "4) View logs"
echo "5) Backup database"
echo "6) Exit"
echo ""
read -p "Enter choice [1-6]: " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Starting VipChat in DEVELOPMENT mode...${NC}"
        docker-compose build
        docker-compose up -d
        echo ""
        echo -e "${GREEN}✓ VipChat is running!${NC}"
        echo ""
        echo "Access URLs:"
        echo "  Frontend: http://localhost:5000"
        echo "  Backend:  http://localhost:8000"
        echo "  MySQL:    localhost:3306"
        echo "  Redis:    localhost:6379"
        echo ""
        echo "View logs: docker-compose logs -f"
        echo "Stop: docker-compose down"
        ;;
    
    2)
        echo ""
        echo -e "${GREEN}Starting VipChat in PRODUCTION mode...${NC}"
        docker-compose -f docker-compose.production.yml build
        docker-compose -f docker-compose.production.yml up -d
        echo ""
        echo -e "${GREEN}✓ VipChat production cluster is running!${NC}"
        echo ""
        echo "Access URLs:"
        echo "  Load Balancer: http://localhost"
        echo "  Prometheus:    http://localhost:9090"
        echo "  Grafana:       http://localhost:3000"
        echo ""
        echo "View logs: docker-compose -f docker-compose.production.yml logs -f"
        echo "Stop: docker-compose -f docker-compose.production.yml down"
        ;;
    
    3)
        echo ""
        echo -e "${YELLOW}Stopping all services...${NC}"
        docker-compose down 2>/dev/null || true
        docker-compose -f docker-compose.production.yml down 2>/dev/null || true
        echo -e "${GREEN}✓ All services stopped${NC}"
        ;;
    
    4)
        echo ""
        echo "Select environment:"
        echo "1) Development logs"
        echo "2) Production logs"
        read -p "Enter choice [1-2]: " log_choice
        
        if [ "$log_choice" = "1" ]; then
            docker-compose logs -f
        else
            docker-compose -f docker-compose.production.yml logs -f
        fi
        ;;
    
    5)
        echo ""
        echo -e "${GREEN}Creating backup...${NC}"
        mkdir -p backups
        TIMESTAMP=$(date +%Y%m%d-%H%M%S)
        
        # Check which environment is running
        if docker ps | grep -q "vipchat-mysql"; then
            echo "Backing up MySQL database..."
            docker exec vipchat-mysql mysqldump -u vipchat -p${MYSQL_PASSWORD} vipchat > "backups/mysql-${TIMESTAMP}.sql"
            echo "Backing up uploads..."
            docker cp vipchat-backend:/app/uploads "backups/uploads-${TIMESTAMP}"
            echo -e "${GREEN}✓ Backup complete: backups/mysql-${TIMESTAMP}.sql${NC}"
        else
            echo -e "${RED}Error: No running MySQL container found${NC}"
            exit 1
        fi
        ;;
    
    6)
        echo "Exiting..."
        exit 0
        ;;
    
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Done!${NC}"
