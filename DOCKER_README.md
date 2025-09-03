# Clara Voice Lab - Docker Deployment

A containerized version of Clara Voice Lab with CUDA support for GPU acceleration and **flexible port configuration**.

## 🚀 Quick Start

### Option 1: Easy Run Script (Recommended)
```bash
# Run on default port 80
./run.sh

# Run on custom port (e.g., port 8080)
./run.sh 8080

# Run with all custom ports: [WEB_PORT] [BACKEND_PORT] [FRONTEND_PORT]  
./run.sh 8080 8001 3001
```

#### Windows:
```cmd
rem Run on default port 80
run.bat

rem Run on custom port
run.bat 8080

rem Run with all custom ports
run.bat 8080 8001 3001
```

### Option 2: Simple Docker Run
```bash
# Run on port 8080 (single container)
./docker-run.sh 8080

# Windows
docker-run.bat 8080
```

### Option 3: Docker Compose with Environment
```bash
# Create .env file with your ports
echo "WEB_PORT=8080" > .env
echo "BACKEND_PORT=8001" >> .env
echo "FRONTEND_PORT=3001" >> .env

# Build and run
docker-compose up --build -d
```

### Option 4: Manual Docker Commands
```bash
# Build
docker build -t clara-voice-lab .

# Run on custom port (e.g., 8080)
docker run --gpus all \
  -p 8080:8000 \
  -v $(pwd)/data:/app/data \
  clara-voice-lab
```

## 🔧 Port Configuration

The application uses **three configurable ports**:

| Service | Default Port | Environment Variable | Description |
|---------|-------------|---------------------|-------------|
| **Web App** | 80 | `WEB_PORT` | Main access point (Nginx proxy) |
| **Backend API** | 8000 | `BACKEND_PORT` | FastAPI server (internal) |
| **Frontend** | 3000 | `FRONTEND_PORT` | React dev server (internal) |

### Examples:

```bash
# Development setup (non-privileged ports)
./run.sh 8080 8001 3001

# Production setup (standard web port)
./run.sh 80 8000 3000

# Custom setup for multiple instances
./run.sh 9000 9001 9002
```

## 📋 Environment Configuration

Create a `.env` file to customize your deployment:

```bash
# Copy example configuration
cp .env.example .env

# Edit with your preferred settings
nano .env
```

**Example .env file:**
```bash
# Port configuration
WEB_PORT=8080
BACKEND_PORT=8001  
FRONTEND_PORT=3001

# GPU settings
CUDA_VISIBLE_DEVICES=0
NVIDIA_VISIBLE_DEVICES=all

# Security (IMPORTANT: Change in production!)
SECRET_KEY=your-very-secure-secret-key-here
JWT_EXPIRE_MINUTES=30

# Application settings
AUTO_UNLOAD_MODELS_MINUTES=5
MAX_UPLOAD_SIZE_MB=500
CORS_ORIGINS=*
```

## Architecture

```
┌─────────────────┐    ┌──────────────────┐
│   Nginx Proxy   │    │   Clara Voice    │
│   Port 80       │────┤   Lab Container  │
└─────────────────┘    │   CUDA Enabled   │
                       └──────────────────┘
                              │
                       ┌──────┴──────┐
                       │   FastAPI    │
                       │   Backend    │
                       │   Port 8000  │
                       └─────────────┘
                              │
                       ┌──────┴──────┐
                       │   Frontend   │
                       │   SPA        │
                       │   Port 3000  │
                       └─────────────┘
```

## GPU Memory Management

The application includes automatic GPU memory management:
- **On-demand loading**: Models load only when needed
- **Auto-unload**: Models unload after 5 minutes of inactivity
- **Memory monitoring**: Check GPU usage via `/api/device-info`
- **Manual control**: Force unload via `/api/unload-models`

## Troubleshooting

### GPU Not Detected
```bash
# Check NVIDIA Docker installation
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi

# Verify GPU in container
docker exec -it clara-voice-lab nvidia-smi
```

### High Memory Usage
```bash
# Monitor GPU memory
docker exec -it clara-voice-lab python3 -c "
import torch
print(f'GPU Memory: {torch.cuda.memory_allocated()/1024**3:.1f}GB')
"

# Force model unload
curl -X POST http://localhost/api/unload-models \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Build Issues
```bash
# Clean build
docker system prune -a
docker-compose down -v
docker-compose up --build

# Check logs
docker-compose logs clara-voice-lab
```

## Performance Optimization

### For RTX 4090/4080 (24GB+ VRAM):
- Enable chunking for long audio processing
- Increase batch sizes in model settings
- Use FP16 precision for faster inference

### For RTX 3080/3070 (8-12GB VRAM):
- Enable auto-unload (default: 5 minutes)
- Use smaller chunk sizes for voice conversion
- Process audio files sequentially

### For GTX 1080/1660 (8GB VRAM):
- Enable aggressive memory management
- Use CPU fallback for very long audio
- Reduce model precision if available

## Security Considerations

### Production Deployment:
1. **Change default secrets** in environment variables
2. **Use HTTPS** with proper SSL certificates
3. **Limit CORS origins** to your domain
4. **Set up authentication** for multi-user access
5. **Use a proper database** (PostgreSQL) instead of SQLite

### Network Security:
```yaml
# docker-compose.override.yml for production
version: '3.8'
services:
  clara-voice-lab:
    environment:
      - SECRET_KEY=your-production-secret-key
      - CORS_ORIGINS=https://yourdomain.com
    ports: []  # Remove direct port exposure
  
  nginx:
    ports:
      - "443:443"
    volumes:
      - ./ssl:/etc/ssl/certs
```

## Monitoring and Logs

### Health Checks
```bash
# Check application health
curl http://localhost/api/health

# Check container health
docker-compose ps
```

### Logs
```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f clara-voice-lab
docker-compose logs -f nginx
```

### Metrics
```bash
# GPU utilization
docker exec clara-voice-lab nvidia-smi

# Container stats
docker stats clara-voice-lab
```

## Backup and Restore

### Backup Data
```bash
# Backup all data
tar -czf clara-voice-lab-backup.tar.gz data/ models/

# Backup database only
cp data/database/users.db backup/users-$(date +%Y%m%d).db
```

### Restore Data
```bash
# Restore from backup
tar -xzf clara-voice-lab-backup.tar.gz

# Restart containers
docker-compose restart
```

## Updates

### Update Application
```bash
# Pull latest changes
git pull

# Rebuild and restart
docker-compose down
docker-compose up --build -d
```

### Update Base Images
```bash
# Update CUDA base image
docker pull nvidia/cuda:12.1-devel-ubuntu22.04

# Rebuild
docker-compose build --no-cache
```
