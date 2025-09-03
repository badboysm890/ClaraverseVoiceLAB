@echo off
REM Build script for Clara Voice Lab Docker image on Windows

echo Building Clara Voice Lab Docker image...

REM Check if Docker is available
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed or not in PATH
    exit /b 1
)

REM Build the Docker image
echo Building Docker image...
docker build -t clara-voice-lab:latest .

REM Create data directories
echo Creating data directories...
if not exist "data" mkdir data
if not exist "data\database" mkdir data\database
if not exist "data\voice_samples" mkdir data\voice_samples
if not exist "data\tts_history" mkdir data\tts_history
if not exist "data\vc_history" mkdir data\vc_history
if not exist "models" mkdir models

echo Build complete!
echo.
echo To run Clara Voice Lab:
echo   docker-compose up -d
echo.
echo To run with Docker directly (requires nvidia-docker):
echo   docker run --gpus all -p 80:80 -v %cd%/data:/app/data clara-voice-lab:latest
echo.
echo Access the application at http://localhost
