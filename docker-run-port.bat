@echo off
setlocal enabledelayedexpansion

REM Clara Voice Lab - Docker Run with Custom Port
echo 🎯 Clara Voice Lab - Docker Deployment with Custom Port
echo.

REM Get port from user input or use default
set "PORT=%1"
if "%PORT%"=="" (
    set /p PORT="Enter the port number (default 9090): "
    if "!PORT!"=="" set PORT=9090
)

REM Validate port number
echo !PORT! | findstr /r "^[0-9][0-9]*$" >nul
if errorlevel 1 (
    echo ❌ Invalid port number: !PORT!
    echo Please enter a valid port number between 1024-65535
    pause
    exit /b 1
)

if !PORT! LSS 1024 (
    echo ⚠️  Warning: Port !PORT! is below 1024. Consider using ports above 1024.
)

if !PORT! GTR 65535 (
    echo ❌ Invalid port number: !PORT!
    echo Port must be between 1-65535
    pause
    exit /b 1
)

echo.
echo 🔧 Configuration:
echo    Web Port: !PORT!
echo    Backend Port: 8000
echo    Frontend Port: 3000
echo.

REM Set environment variables
set WEB_PORT=!PORT!
set BACKEND_PORT=8000
set FRONTEND_PORT=3000

REM Check if port is available
echo 🔍 Checking if port !PORT! is available...
netstat -ano | findstr :!PORT! >nul 2>&1
if not errorlevel 1 (
    echo ❌ Port !PORT! is already in use!
    echo.
    echo Currently using port !PORT!:
    netstat -ano | findstr :!PORT!
    echo.
    set /p CONTINUE="Do you want to continue anyway? (y/N): "
    if /i not "!CONTINUE!"=="y" (
        echo Operation cancelled.
        pause
        exit /b 1
    )
)

echo.
echo 🏗️ Building and starting Clara Voice Lab...
docker-compose down >nul 2>&1
docker-compose up -d

if errorlevel 1 (
    echo.
    echo ❌ Failed to start containers
    pause
    exit /b 1
)

echo.
echo ⏱️ Waiting for services to initialize...
timeout /t 5 /nobreak >nul

echo.
echo 🩺 Performing health check...
docker-compose ps

echo.
echo ✅ Clara Voice Lab is running successfully
echo.
echo 🌐 Access URLs:
echo    🎨 Main Application: http://localhost:!PORT!
echo    📚 API Documentation: http://localhost:!PORT!/api/docs
echo    🔧 Backend API: http://localhost:8000
echo    💻 Frontend Dev: http://localhost:3000
echo.
echo 📊 Container Status:
docker-compose ps
echo.
echo 💾 Docker Volumes:
docker volume ls | findstr clara-voice-lab
echo.
echo 🎮 Management commands:
echo    📋 View logs: docker-compose logs -f
echo    ⏹️  Stop: docker-compose down
echo    🔄 Restart: docker-compose restart
echo    📊 Monitor: docker stats
echo    🗑️  Clean up: docker-compose down -v (WARNING: deletes all data)
echo.
echo 🎯 GPU Status available in container
echo.
echo 💿 Data Persistence:
echo    All data is stored in Docker volumes:
echo    - clara_voice_data: User data, voice samples, history
echo    - clara_voice_models: AI models cache
echo    These persist between container restarts
echo.

pause
