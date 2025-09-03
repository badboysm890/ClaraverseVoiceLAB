@echo off
REM Flexible deployment script for Clara Voice Lab on Windows
REM Usage: run.bat [WEB_PORT] [BACKEND_PORT] [FRONTEND_PORT]

setlocal enabledelayedexpansion

REM Default ports
set DEFAULT_WEB_PORT=80
set DEFAULT_BACKEND_PORT=8000
set DEFAULT_FRONTEND_PORT=3000

REM Parse command line arguments
if "%1"=="" (set WEB_PORT=%DEFAULT_WEB_PORT%) else (set WEB_PORT=%1)
if "%2"=="" (set BACKEND_PORT=%DEFAULT_BACKEND_PORT%) else (set BACKEND_PORT=%2)
if "%3"=="" (set FRONTEND_PORT=%DEFAULT_FRONTEND_PORT%) else (set FRONTEND_PORT=%3)

echo 🚀 Starting Clara Voice Lab with custom ports...
echo 📋 Configuration:
echo    🌐 Web Port (Nginx): %WEB_PORT%
echo    🔧 Backend API: %BACKEND_PORT%
echo    ⚛️  Frontend: %FRONTEND_PORT%
echo.

REM Check Docker availability
echo 🐳 Checking Docker configuration...
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

REM Create .env file with custom ports
echo 📝 Creating environment configuration...
(
echo # Clara Voice Lab Configuration - Generated %date% %time%
echo WEB_PORT=%WEB_PORT%
echo BACKEND_PORT=%BACKEND_PORT%
echo FRONTEND_PORT=%FRONTEND_PORT%
echo.
echo # GPU Configuration
echo CUDA_VISIBLE_DEVICES=0
echo NVIDIA_VISIBLE_DEVICES=all
echo.
echo # Database configuration
echo DATABASE_URL=sqlite:///./data/database/users.db
echo.
echo # Security (change in production^)
echo SECRET_KEY=your-secret-key-change-in-production
echo JWT_EXPIRE_MINUTES=30
echo.
echo # Application settings
echo AUTO_UNLOAD_MODELS_MINUTES=5
echo MAX_UPLOAD_SIZE_MB=500
echo.
echo # CORS settings
echo CORS_ORIGINS=*
) > .env

REM Create data directories
echo 📁 Creating data directories...
if not exist "data" mkdir data
if not exist "data\database" mkdir data\database
if not exist "data\voice_samples" mkdir data\voice_samples
if not exist "data\tts_history" mkdir data\tts_history
if not exist "data\vc_history" mkdir data\vc_history
if not exist "models" mkdir models

REM Stop any existing containers
echo 🛑 Stopping existing containers...
docker-compose down >nul 2>&1

REM Build and start the application
echo 🔨 Building and starting Clara Voice Lab...
docker-compose up --build -d

REM Wait for services to start
echo ⏳ Waiting for services to start...
timeout /t 10 /nobreak >nul

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
if !attempts! geq 30 (
    echo ❌ Health check failed after 30 attempts
    echo 📋 Container logs:
    docker-compose logs --tail=20
    exit /b 1
)
echo    Attempt !attempts!/30 - waiting for services...
timeout /t 2 /nobreak >nul
goto healthcheck

:success
echo.
echo 🎉 Clara Voice Lab is now running!
echo 🌐 Access the application at: http://localhost:%WEB_PORT%
echo 📚 API Documentation: http://localhost:%WEB_PORT%/api/docs
echo.
echo 📊 Useful commands:
echo    📋 View logs: docker-compose logs -f
echo    🛑 Stop: docker-compose down
echo    🔄 Restart: docker-compose restart
echo    📈 Monitor: docker stats
echo.

REM Show GPU status if available
docker exec clara-voice-lab nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader,nounits 2>nul
if !errorlevel! == 0 (
    echo 🎮 GPU Status shown above
) else (
    echo 🎮 GPU info not available yet
)

echo.
pause
