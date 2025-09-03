@echo off
REM Self-contained Docker deployment script for Windows - everything runs inside Docker
REM Usage: docker-build.bat [WEB_PORT]

setlocal enabledelayedexpansion

REM Default web port
if "%1"=="" (set WEB_PORT=8080) else (set WEB_PORT=%1)

echo 🚀 Building and running Clara Voice Lab (self-contained)
echo 🌐 Will be accessible on port: %WEB_PORT%
echo.

REM Check Docker availability
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed!
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker daemon is not running!
    exit /b 1
)

REM Create .env file for this deployment
echo 📝 Creating environment configuration...
(
echo WEB_PORT=%WEB_PORT%
echo BACKEND_PORT=8000
echo FRONTEND_PORT=3000
echo.
echo # GPU Configuration
echo CUDA_VISIBLE_DEVICES=0
echo NVIDIA_VISIBLE_DEVICES=all
echo.
echo # Database configuration (internal Docker volume^)
echo DATABASE_URL=sqlite:///./data/database/users.db
echo.
echo # Security
echo SECRET_KEY=clara-voice-lab-%RANDOM%-%RANDOM%
echo JWT_EXPIRE_MINUTES=30
echo.
echo # Application settings
echo AUTO_UNLOAD_MODELS_MINUTES=5
echo MAX_UPLOAD_SIZE_MB=500
echo CORS_ORIGINS=*
) > .env

REM Stop any existing containers
echo 🛑 Stopping any existing Clara Voice Lab containers...
docker-compose down >nul 2>&1

REM Remove existing containers if they exist
docker rm -f clara-voice-lab clara-voice-lab-proxy >nul 2>&1

REM Build the Docker image
echo 🔨 Building Clara Voice Lab Docker image...
docker-compose build --no-cache

REM Start the application
echo 🚀 Starting Clara Voice Lab services...
docker-compose up -d

REM Wait for services to start
echo ⏳ Waiting for services to initialize...
timeout /t 15 /nobreak >nul

REM Health check
echo 🔍 Performing health check...
set /a attempts=0
:healthcheck
set /a attempts+=1
curl -s http://localhost:%WEB_PORT%/api/health >nul 2>&1
if !errorlevel! == 0 (
    echo ✅ Clara Voice Lab is running successfully!
    goto success
)
if !attempts! geq 60 (
    echo ❌ Health check failed after 60 attempts
    echo 📋 Container logs:
    docker-compose logs --tail=20
    exit /b 1
)
echo    Attempt !attempts!/60 - waiting for services...
timeout /t 2 /nobreak >nul
goto healthcheck

:success
REM Show container status
echo.
echo 📊 Container Status:
docker-compose ps

REM Show volume information
echo.
echo 📦 Docker Volumes:
docker volume ls | findstr clara_voice
if errorlevel 1 echo    No Clara Voice volumes found yet (will be created on first use)

echo.
echo 🎉 Clara Voice Lab is now running completely inside Docker!
echo 🌐 Access the application at: http://localhost:%WEB_PORT%
echo 📚 API Documentation: http://localhost:%WEB_PORT%/api/docs
echo.
echo 📊 Management commands:
echo    📋 View logs: docker-compose logs -f
echo    🛑 Stop: docker-compose down
echo    🔄 Restart: docker-compose restart
echo    📈 Monitor: docker stats
echo    🗑️  Clean up: docker-compose down -v (WARNING: deletes all data!)
echo.

REM Show GPU status if available
docker exec clara-voice-lab nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader,nounits >nul 2>&1
if !errorlevel! == 0 (
    echo 🎮 GPU Status available in container
) else (
    echo 🎮 GPU info will be available once container is fully started
)

echo.
echo 🔒 Data Persistence:
echo    All data is stored in Docker volumes:
echo    - clara_voice_data: User data, voice samples, history
echo    - clara_voice_models: AI models cache
echo    These persist between container restarts!
echo.
pause
