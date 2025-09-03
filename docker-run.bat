@echo off
REM Simple Docker run script for Windows without docker-compose
REM Usage: docker-run.bat [PORT]

setlocal enabledelayedexpansion

REM Default web port
if "%1"=="" (set WEB_PORT=8080) else (set WEB_PORT=%1)

echo 🚀 Running Clara Voice Lab on port %WEB_PORT%

REM Check Docker availability
docker --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not installed!
    exit /b 1
)

REM Create data directories
if not exist "data" mkdir data
if not exist "models" mkdir models

REM Build the image if it doesn't exist
docker images | findstr clara-voice-lab >nul
if errorlevel 1 (
    echo 🔨 Building Clara Voice Lab image...
    docker build -t clara-voice-lab:latest .
)

REM Stop any existing container
docker stop clara-voice-lab >nul 2>&1
docker rm clara-voice-lab >nul 2>&1

REM Run the container
echo 🏃 Starting container...
docker run -d ^
    --name clara-voice-lab ^
    -p %WEB_PORT%:8000 ^
    -v "%cd%\data:/app/data" ^
    -v "%cd%\models:/app/models" ^
    -e WEB_PORT=80 ^
    -e BACKEND_PORT=8000 ^
    -e FRONTEND_PORT=3000 ^
    --restart unless-stopped ^
    clara-voice-lab:latest

REM Wait for startup
echo ⏳ Waiting for services to start...
timeout /t 15 /nobreak >nul

REM Health check
set /a attempts=0
:healthcheck
set /a attempts+=1
curl -s http://localhost:%WEB_PORT%/api/health >nul 2>&1
if !errorlevel! == 0 (
    echo ✅ Clara Voice Lab is running!
    goto success
)
if !attempts! geq 30 (
    echo ❌ Health check failed
    docker logs clara-voice-lab --tail=20
    exit /b 1
)
timeout /t 2 /nobreak >nul
goto healthcheck

:success
echo.
echo 🎉 Clara Voice Lab is now running!
echo 🌐 Access: http://localhost:%WEB_PORT%
echo 📚 API Docs: http://localhost:%WEB_PORT%/docs
echo.
echo 📊 Management commands:
echo    📋 Logs: docker logs -f clara-voice-lab
echo    🛑 Stop: docker stop clara-voice-lab
echo    🗑️  Remove: docker rm clara-voice-lab
echo.
pause
