@echo off
REM VipChat Docker Startup Script for Windows

echo ==========================================
echo      VipChat Docker Deployment
echo ==========================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running
    echo Please start Docker Desktop and try again
    pause
    exit /b 1
)

echo [OK] Docker is running
echo.

REM Check if .env file exists
if not exist .env (
    echo [WARNING] No .env file found
    if exist .env.docker (
        echo Creating .env from template...
        copy .env.docker .env
        echo [OK] .env file created
        echo.
        echo [WARNING] Please edit .env file with your configuration
        echo Press any key to open .env file in notepad...
        pause >nul
        notepad .env
    ) else (
        echo [ERROR] .env.docker template not found
        pause
        exit /b 1
    )
)

echo [OK] Environment configuration found
echo.

:menu
echo Select deployment mode:
echo 1) Development (single instance)
echo 2) Production (clustered)
echo 3) Stop all services
echo 4) View logs
echo 5) Backup database
echo 6) Exit
echo.
set /p choice="Enter choice [1-6]: "

if "%choice%"=="1" goto dev
if "%choice%"=="2" goto prod
if "%choice%"=="3" goto stop
if "%choice%"=="4" goto logs
if "%choice%"=="5" goto backup
if "%choice%"=="6" goto exit
echo [ERROR] Invalid choice
goto menu

:dev
echo.
echo [INFO] Starting VipChat in DEVELOPMENT mode...
docker-compose build
docker-compose up -d
echo.
echo [OK] VipChat is running!
echo.
echo Access URLs:
echo   Frontend: http://localhost:5000
echo   Backend:  http://localhost:8000
echo   MySQL:    localhost:3306
echo   Redis:    localhost:6379
echo.
echo View logs: docker-compose logs -f
echo Stop: docker-compose down
echo.
pause
goto exit

:prod
echo.
echo [INFO] Starting VipChat in PRODUCTION mode...
docker-compose -f docker-compose.production.yml build
docker-compose -f docker-compose.production.yml up -d
echo.
echo [OK] VipChat production cluster is running!
echo.
echo Access URLs:
echo   Load Balancer: http://localhost
echo   Prometheus:    http://localhost:9090
echo   Grafana:       http://localhost:3000
echo.
pause
goto exit

:stop
echo.
echo [INFO] Stopping all services...
docker-compose down 2>nul
docker-compose -f docker-compose.production.yml down 2>nul
echo [OK] All services stopped
echo.
pause
goto exit

:logs
echo.
echo Select environment:
echo 1) Development logs
echo 2) Production logs
set /p log_choice="Enter choice [1-2]: "
echo.
if "%log_choice%"=="1" (
    docker-compose logs -f
) else (
    docker-compose -f docker-compose.production.yml logs -f
)
goto exit

:backup
echo.
echo [INFO] Creating backup...
if not exist backups mkdir backups

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
set timestamp=%mydate%-%mytime%

echo Backing up MySQL database...
docker exec vipchat-mysql mysqldump -u vipchat -p%MYSQL_PASSWORD% vipchat > backups\mysql-%timestamp%.sql
echo [OK] Backup complete: backups\mysql-%timestamp%.sql
echo.
pause
goto exit

:exit
echo.
echo Done!
pause
exit /b 0
