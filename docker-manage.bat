@echo off
:: Clara Voice Lab Docker Management Script for Windows

setlocal enabledelayedexpansion

:: Check if Docker is running
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not installed or not in PATH
    exit /b 1
)

docker info >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop and try again.
    exit /b 1
)

:: Parse command
set command=%1
if "%command%"=="" (
    goto :show_help
)

goto :%command% 2>nul
if %errorlevel% neq 0 (
    echo Unknown command: %command%
    echo Use "%0 help" for usage information.
    exit /b 1
)

:dev
echo [INFO] Starting Clara Voice Lab in development mode...
call :check_env
docker-compose up -d
if %errorlevel% equ 0 (
    echo [SUCCESS] Development environment started!
    echo [INFO] Frontend: http://localhost:%FRONTEND_PORT%
    echo [INFO] Backend API: http://localhost:%BACKEND_PORT%
    echo [INFO] API Docs: http://localhost:%BACKEND_PORT%/docs
    echo [INFO] Main App: http://localhost:%WEB_PORT%
)
goto :eof

:prod
echo [INFO] Starting Clara Voice Lab in production mode...
call :check_env
if "%SECRET_KEY%"=="" (
    echo [ERROR] SECRET_KEY must be set in production. Please update your .env file.
    exit /b 1
)
docker-compose -f docker-compose.prod.yml up -d
if %errorlevel% equ 0 (
    echo [SUCCESS] Production environment started!
    echo [INFO] Main App: http://localhost:%WEB_PORT%
)
goto :eof

:build
echo [INFO] Building Docker images...
if "%2"=="--no-cache" (
    docker-compose build --no-cache
) else (
    docker-compose build
)
if %errorlevel% equ 0 (
    echo [SUCCESS] Images built successfully!
)
goto :eof

:rebuild
echo [INFO] Rebuilding Docker images from scratch...
docker-compose down --rmi all --volumes --remove-orphans
docker-compose build --no-cache
if %errorlevel% equ 0 (
    echo [SUCCESS] Images rebuilt successfully!
)
goto :eof

:stop
echo [INFO] Stopping Clara Voice Lab services...
docker-compose down
docker-compose -f docker-compose.prod.yml down 2>nul
echo [SUCCESS] Services stopped!
goto :eof

:restart
echo [INFO] Restarting Clara Voice Lab services...
docker-compose restart
echo [SUCCESS] Services restarted!
goto :eof

:logs
set tail_lines=%2
if "%tail_lines%"=="" set tail_lines=100
echo [INFO] Showing logs (last %tail_lines% lines)...
docker-compose logs --tail=%tail_lines% -f
goto :eof

:status
echo [INFO] Clara Voice Lab Service Status:
echo.
docker-compose ps
echo.
echo [INFO] Docker System Info:
docker system df
goto :eof

:clean
if not "%2"=="--force" (
    echo [WARNING] This will remove all containers, networks, and unused images.
    set /p confirm="Are you sure? (y/N): "
    if /i not "!confirm!"=="y" (
        echo [INFO] Cleanup cancelled.
        goto :eof
    )
)
echo [INFO] Cleaning up Docker resources...
docker-compose down --rmi all --volumes --remove-orphans
docker-compose -f docker-compose.prod.yml down --rmi all --volumes --remove-orphans 2>nul
docker system prune -f
echo [SUCCESS] Cleanup completed!
goto :eof

:shell
echo [INFO] Opening shell in Clara Voice Lab container...
docker-compose ps | findstr /C:"clara-voice-lab" | findstr /C:"Up" >nul
if %errorlevel% equ 0 (
    docker-compose exec clara-voice-lab /bin/bash
    goto :eof
)
docker-compose -f docker-compose.prod.yml ps | findstr /C:"clara-voice-lab-prod" | findstr /C:"Up" >nul
if %errorlevel% equ 0 (
    docker-compose -f docker-compose.prod.yml exec clara-voice-lab /bin/bash
    goto :eof
)
echo [ERROR] No running containers found. Please start the services first.
exit /b 1

:backup
set backup_dir=backups\%date:~6,4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%
set backup_dir=%backup_dir: =0%
mkdir "%backup_dir%" 2>nul
echo [INFO] Creating backup in %backup_dir%...

docker volume ls | findstr clara_voice_data >nul
if %errorlevel% equ 0 (
    docker run --rm -v clara_voice_data:/source -v "%cd%\%backup_dir%":/backup alpine tar czf /backup/clara_voice_data.tar.gz -C /source .
    echo [SUCCESS] Backed up development data volume
)

docker volume ls | findstr clara_voice_models >nul
if %errorlevel% equ 0 (
    docker run --rm -v clara_voice_models:/source -v "%cd%\%backup_dir%":/backup alpine tar czf /backup/clara_voice_models.tar.gz -C /source .
    echo [SUCCESS] Backed up development models volume
)

echo [SUCCESS] Backup completed in %backup_dir%
goto :eof

:check_env
:: Load environment variables from .env file
if exist .env (
    for /f "tokens=1,2 delims==" %%a in (.env) do (
        set %%a=%%b
    )
    echo [INFO] Loaded environment variables from .env
) else (
    echo [WARNING] .env file not found. Using default values.
    set FRONTEND_PORT=3000
    set BACKEND_PORT=8000
    set WEB_PORT=8080
)
goto :eof

:show_help
echo Clara Voice Lab Docker Management
echo.
echo Usage: %0 [COMMAND] [OPTIONS]
echo.
echo Commands:
echo     dev         Start development environment
echo     prod        Start production environment
echo     build       Build Docker images
echo     rebuild     Rebuild Docker images from scratch
echo     stop        Stop all services
echo     restart     Restart all services
echo     logs        Show logs
echo     clean       Clean up containers and images
echo     status      Show status of services
echo     shell       Open shell in main container
echo     backup      Backup data volumes
echo.
echo Options:
echo     --no-cache  Build without cache
echo     --force     Force operation without confirmation
echo.
echo Examples:
echo     %0 dev                 Start development environment
echo     %0 prod                Start production environment
echo     %0 logs                Show logs
echo     %0 clean --force       Clean up without confirmation
echo     %0 backup              Create backup of data volumes
echo.
goto :eof

:help
goto :show_help
