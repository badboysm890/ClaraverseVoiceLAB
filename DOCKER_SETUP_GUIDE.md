# 🐳 Clara Voice Lab - Complete Docker Setup Guide

This guide provides comprehensive Docker deployment options for Clara Voice Lab with all the configurations you need for development and production environments.

## 📋 Prerequisites

### System Requirements
- **Docker**: Version 20.10+ 
- **Docker Compose**: Version 2.0+
- **NVIDIA Docker** (for GPU acceleration): nvidia-container-toolkit
- **Hardware**: 
  - CPU: 4+ cores recommended
  - RAM: 8GB+ (16GB+ for production)
  - GPU: NVIDIA GPU with 6GB+ VRAM (optional but recommended)
  - Storage: 20GB+ free space

## 🚀 Quick Start

### Method 1: Using Docker Management Scripts (Recommended)

We've provided convenient scripts to manage your Docker deployment:

#### Linux/Mac:
```bash
# Make script executable
chmod +x docker-manage.sh

# Start development environment
./docker-manage.sh dev

# Start production environment
./docker-manage.sh prod

# View all available commands
./docker-manage.sh help
```

#### Windows:
```cmd
# Start development environment
docker-manage.bat dev

# Start production environment
docker-manage.bat prod

# View all available commands
docker-manage.bat help
```

### Method 2: Direct Docker Compose

```bash
# Development environment
docker-compose up -d

# Production environment
docker-compose -f docker-compose.prod.yml up -d

# Stop services
docker-compose down
```

## 🔧 Configuration

### Environment Setup (.env)

Copy and customize the environment file:

```bash
cp .env.example .env
```

Key configurations in `.env`:

```env
# Port Configuration
WEB_PORT=8080                    # Main application port
BACKEND_PORT=8000                # API port (internal)
FRONTEND_PORT=3000               # Frontend port (internal)

# GPU Configuration  
CUDA_VISIBLE_DEVICES=0           # GPU device index
NVIDIA_VISIBLE_DEVICES=all       # NVIDIA devices

# Security (IMPORTANT: Change in production!)
SECRET_KEY=your-super-secret-key-here
JWT_EXPIRE_MINUTES=60

# Application Settings
AUTO_UNLOAD_MODELS_MINUTES=10    # Auto-unload models to save memory
MAX_UPLOAD_SIZE_MB=1000          # Max file upload size
CORS_ORIGINS=*                   # Allowed origins (restrict in production)
```

## 📊 Architecture Overview

```
User Request
     ↓
┌─────────────────┐
│   NGINX Proxy   │  ← Port 8080 (configurable)
│   Load Balancer │
└─────────────────┘
     │
     ├─── /api/* ────────────────┐
     │                          │
     └─── /* ─────────────┐     │
                          │     │
                          ▼     ▼
                 ┌─────────────────┐    ┌─────────────────┐
                 │   Frontend      │    │   Backend API   │
                 │   (React SPA)   │    │   (FastAPI)     │
                 │   Port: 3000    │    │   Port: 8000    │
                 └─────────────────┘    └─────────────────┘
                                               │
                                               ▼
                                        ┌─────────────────┐
                                        │   AI Models     │
                                        │   (CUDA/PyTorch)│
                                        │   ChatterBox    │
                                        └─────────────────┘
```

## 🛠️ Available Commands

### Docker Management Script Commands

```bash
# Service Management
./docker-manage.sh dev          # Start development environment
./docker-manage.sh prod         # Start production environment  
./docker-manage.sh stop         # Stop all services
./docker-manage.sh restart      # Restart services

# Build & Maintenance
./docker-manage.sh build        # Build Docker images
./docker-manage.sh rebuild      # Rebuild from scratch (no cache)

# Monitoring & Debugging
./docker-manage.sh status       # Show service status
./docker-manage.sh logs         # View logs (use --tail N for specific count)
./docker-manage.sh shell        # Open shell in main container

# Data Management
./docker-manage.sh backup       # Backup data volumes
./docker-manage.sh clean        # Clean up Docker resources (use --force to skip confirmation)
```

Examples:
```bash
# View last 50 log lines
./docker-manage.sh logs --tail 50

# Force cleanup without confirmation
./docker-manage.sh clean --force

# Build without cache
./docker-manage.sh build --no-cache
```

## 📁 Data Persistence & Volumes

The application uses Docker volumes for persistent data:

### Volume Structure
- **`clara_voice_data`**: User uploads, generated files, SQLite database
- **`clara_voice_models`**: AI models and model cache
- **`clara_voice_data_prod`**: Production data (separate from dev)
- **`clara_voice_models_prod`**: Production models (separate from dev)

### Volume Locations
```
/app/data/
├── database/
│   └── users.db           # SQLite database
├── voice_samples/
│   └── user_1/           # User voice uploads
├── tts_history/
│   └── user_1/           # Generated speech files
└── vc_history/
    └── user_1/           # Voice conversion results

/app/models/
├── chatterbox/           # ChatterBox TTS models
└── cache/               # Model cache
```

## 🔍 Access Points

Once running, your application will be available at:

| Service | URL | Description |
|---------|-----|-------------|
| **Main App** | `http://localhost:8080` | Complete application via NGINX proxy |
| **API Documentation** | `http://localhost:8080/api/docs` | Interactive API documentation |
| **Health Check** | `http://localhost:8080/health` | Service health status |
| **Frontend Direct** | `http://localhost:3000` | Direct React app (dev only) |
| **Backend Direct** | `http://localhost:8000` | Direct API access (dev only) |

## 🚀 Production Deployment

### Pre-Production Checklist

1. **Security Configuration**:
   ```bash
   # Generate secure secret key
   python3 -c "import secrets; print(secrets.token_urlsafe(32))"
   ```
   
   Update `.env`:
   ```env
   SECRET_KEY=your-generated-secure-key-here
   CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
   WEB_PORT=80  # or 443 for HTTPS
   ```

2. **SSL/HTTPS Setup** (recommended):
   - Get SSL certificates (Let's Encrypt, commercial CA, etc.)
   - Update `nginx.prod.conf` with SSL configuration
   - Uncomment HTTPS server block in `nginx.prod.conf`

3. **Resource Limits**:
   ```yaml
   # Already configured in docker-compose.prod.yml
   deploy:
     resources:
       limits:
         memory: 8G
       reservations:
         memory: 4G
   ```

### Production Deployment Steps

```bash
# 1. Clone and configure
git clone <repository-url>
cd clara-voice-lab
cp .env.example .env
# Edit .env with production values

# 2. Start production environment
./docker-manage.sh prod

# 3. Verify deployment
./docker-manage.sh status
./docker-manage.sh logs

# 4. Test application
curl -f http://localhost/health
```

## 🔧 GPU Setup (Optional but Recommended)

### Install NVIDIA Container Toolkit

#### Ubuntu/Debian:
```bash
# Add NVIDIA package repository
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install toolkit
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Restart Docker
sudo systemctl restart docker
```

#### CentOS/RHEL:
```bash
curl -s -L https://nvidia.github.io/libnvidia-container/stable/rpm/nvidia-container-toolkit.repo | \
  sudo tee /etc/yum.repos.d/nvidia-container-toolkit.repo

sudo yum install -y nvidia-container-toolkit
sudo systemctl restart docker
```

### Test GPU Access
```bash
# Test NVIDIA Docker runtime
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi

# Should show your GPU information
```

## 🔍 Monitoring & Troubleshooting

### Health Monitoring

```bash
# Check service health
curl -f http://localhost:8080/health

# View detailed service status
./docker-manage.sh status

# Monitor resource usage
docker stats
```

### Common Issues & Solutions

#### 1. Port Already in Use
```bash
# Check what's using the port
netstat -tulpn | grep :8080

# Change port in .env file
WEB_PORT=8081
```

#### 2. GPU Not Detected
```bash
# Verify NVIDIA runtime
docker info | grep nvidia

# Test GPU access
docker run --rm --gpus all nvidia/cuda:12.0-base-ubuntu20.04 nvidia-smi

# Check container GPU access
./docker-manage.sh shell
nvidia-smi
```

#### 3. Memory Issues
```bash
# Monitor memory usage
docker stats

# Adjust model unloading in .env
AUTO_UNLOAD_MODELS_MINUTES=2

# Increase Docker memory (Docker Desktop)
# Settings → Resources → Memory → 8GB+
```

#### 4. Permission Issues
```bash
# Fix volume permissions
docker-compose exec clara-voice-lab chown -R app:app /app/data
```

#### 5. Container Won't Start
```bash
# Check detailed logs
./docker-manage.sh logs

# Check Docker daemon
sudo systemctl status docker

# Check image integrity
docker images | grep clara-voice-lab
```

### Log Analysis

```bash
# View all logs
./docker-manage.sh logs

# Follow logs in real-time
./docker-manage.sh logs --tail 0 -f

# View specific service logs
docker-compose logs clara-voice-lab
docker-compose logs nginx

# Export logs for analysis
docker-compose logs > logs_$(date +%Y%m%d_%H%M%S).txt
```

## 💾 Backup & Recovery

### Automated Backup
```bash
# Create backup
./docker-manage.sh backup
# Creates backups/YYYYMMDD_HHMMSS/ directory with volume exports
```

### Manual Backup
```bash
# Create backup directory
backup_dir="backups/manual_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$backup_dir"

# Backup data volume
docker run --rm \
  -v clara_voice_data:/source \
  -v "$(pwd)/$backup_dir":/backup \
  alpine tar czf /backup/clara_voice_data.tar.gz -C /source .

# Backup models volume
docker run --rm \
  -v clara_voice_models:/source \
  -v "$(pwd)/$backup_dir":/backup \
  alpine tar czf /backup/clara_voice_models.tar.gz -C /source .
```

### Recovery
```bash
# Stop services
./docker-manage.sh stop

# Restore data volume
docker run --rm \
  -v clara_voice_data:/target \
  -v "$(pwd)/backups/20241201_143000":/backup \
  alpine tar xzf /backup/clara_voice_data.tar.gz -C /target

# Restart services
./docker-manage.sh dev  # or prod
```

## 📈 Performance Optimization

### Resource Allocation

1. **Memory Optimization**:
   ```env
   # In .env
   AUTO_UNLOAD_MODELS_MINUTES=5  # Aggressive unloading
   MAX_UPLOAD_SIZE_MB=500        # Limit upload size
   ```

2. **GPU Memory Management**:
   ```env
   CUDA_VISIBLE_DEVICES=0        # Use specific GPU
   ```

3. **Container Resource Limits**:
   ```yaml
   # Already configured in docker-compose files
   deploy:
     resources:
       limits:
         memory: 8G
         cpus: '4'
   ```

### Scaling for High Load

1. **Horizontal Scaling**:
   ```bash
   # Scale backend instances
   docker-compose up --scale clara-voice-lab=3 -d
   ```

2. **Load Balancing** (update nginx.conf):
   ```nginx
   upstream backend {
       server clara-voice-lab-1:8000;
       server clara-voice-lab-2:8000;
       server clara-voice-lab-3:8000;
   }
   ```

## 🔄 Updates & Maintenance

### Application Updates
```bash
# Pull latest code
git pull origin main

# Backup current data
./docker-manage.sh backup

# Rebuild and restart
./docker-manage.sh rebuild
./docker-manage.sh prod  # or dev
```

### Regular Maintenance
```bash
# Weekly cleanup
./docker-manage.sh clean

# Monthly backup
./docker-manage.sh backup

# Update base images
docker-compose pull
./docker-manage.sh rebuild
```

### Version Management
```bash
# Tag current version before update
docker tag clara-voice-lab:latest clara-voice-lab:backup-$(date +%Y%m%d)

# Rollback if needed
docker tag clara-voice-lab:backup-20241201 clara-voice-lab:latest
./docker-manage.sh restart
```

## 🔒 Security Best Practices

### Production Security Checklist

- [ ] **Change default SECRET_KEY** to a strong, random value
- [ ] **Restrict CORS_ORIGINS** to your specific domain(s)
- [ ] **Enable HTTPS** with proper SSL certificates
- [ ] **Configure firewall** to only allow necessary ports
- [ ] **Regular security updates** for base images and dependencies
- [ ] **Monitor logs** for suspicious activity
- [ ] **Use strong authentication** for any admin interfaces
- [ ] **Encrypt backups** containing sensitive data
- [ ] **Network isolation** using Docker networks
- [ ] **Run containers as non-root** user (already configured)

### Security Configuration Example
```env
# Production .env example
SECRET_KEY=AbCdEf123456789_very_long_random_string_here
CORS_ORIGINS=https://voicelab.yourcompany.com,https://www.voicelab.yourcompany.com
JWT_EXPIRE_MINUTES=60
MAX_UPLOAD_SIZE_MB=500  # Limit to reduce attack surface
```

## 🆘 Getting Help

### Debug Information Collection

When reporting issues, please include:

```bash
# System information
echo "=== System Info ==="
uname -a
docker --version
docker-compose --version

echo "=== Docker Info ==="
docker info

echo "=== Service Status ==="
./docker-manage.sh status

echo "=== Recent Logs ==="
./docker-manage.sh logs --tail 100

echo "=== Volume Status ==="
docker volume ls | grep clara

echo "=== Network Status ==="
docker network ls | grep clara
```

### Support Channels

1. **Check logs first**: `./docker-manage.sh logs`
2. **Review this documentation** for common solutions
3. **GitHub Issues**: Create an issue with debug information
4. **Community Discord/Slack**: For real-time help

### Useful Commands for Debugging

```bash
# Enter container for debugging
./docker-manage.sh shell

# Check GPU inside container
docker-compose exec clara-voice-lab nvidia-smi

# Test API directly
curl -X GET http://localhost:8080/api/health

# Check volume contents
docker run --rm -v clara_voice_data:/data alpine ls -la /data

# Network debugging
docker-compose exec clara-voice-lab ping nginx
```

---

## 🎉 Success!

You now have a complete Docker setup for Clara Voice Lab! 

### Quick Start Summary:
1. **Setup**: `cp .env.example .env` and customize
2. **Start Development**: `./docker-manage.sh dev`
3. **Access**: http://localhost:8080
4. **Monitor**: `./docker-manage.sh status`
5. **Backup**: `./docker-manage.sh backup`

**Happy Voice Processing! 🎙️✨**
