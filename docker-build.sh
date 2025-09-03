#!/bin/bash

# Self-contained Docker deployment script - everything runs inside Docker
# Usage: ./docker-build.sh [WEB_PORT]

set -e

# Default web port
WEB_PORT=${1:-8080}

echo "🚀 Building and running Clara Voice Lab (self-contained)"
echo "🌐 Will be accessible on port: $WEB_PORT"
echo ""

# Check Docker availability
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon is not running!"
    exit 1
fi

# Check for GPU support
if docker info 2>/dev/null | grep -q nvidia; then
    echo "✅ NVIDIA Docker runtime detected"
    GPU_SUPPORT="--gpus all"
elif command -v nvidia-docker &> /dev/null; then
    echo "✅ nvidia-docker detected"  
    GPU_SUPPORT="--gpus all"
else
    echo "⚠️  No GPU support detected - running in CPU mode"
    GPU_SUPPORT=""
fi

# Create .env file for this deployment
echo "📝 Creating environment configuration..."
cat > .env << EOF
WEB_PORT=$WEB_PORT
BACKEND_PORT=8000
FRONTEND_PORT=3000

# GPU Configuration
CUDA_VISIBLE_DEVICES=0
NVIDIA_VISIBLE_DEVICES=all

# Database configuration (internal Docker volume)
DATABASE_URL=sqlite:///./data/database/users.db

# Security
SECRET_KEY=clara-voice-lab-$(date +%s)-$(openssl rand -hex 16)
JWT_EXPIRE_MINUTES=30

# Application settings
AUTO_UNLOAD_MODELS_MINUTES=5
MAX_UPLOAD_SIZE_MB=500
CORS_ORIGINS=*
EOF

# Stop any existing containers
echo "🛑 Stopping any existing Clara Voice Lab containers..."
docker-compose down 2>/dev/null || true

# Remove existing containers if they exist
docker rm -f clara-voice-lab clara-voice-lab-proxy 2>/dev/null || true

# Build the Docker image
echo "🔨 Building Clara Voice Lab Docker image..."
docker-compose build --no-cache

# Start the application
echo "🚀 Starting Clara Voice Lab services..."
docker-compose up -d

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 15

# Health check
echo "🔍 Performing health check..."
for i in {1..60}; do
    if curl -s http://localhost:$WEB_PORT/api/health >/dev/null 2>&1; then
        echo "✅ Clara Voice Lab is running successfully!"
        break
    elif [ $i -eq 60 ]; then
        echo "❌ Health check failed after 60 attempts"
        echo "📋 Container logs:"
        docker-compose logs --tail=20
        exit 1
    else
        echo "   Attempt $i/60 - waiting for services..."
        sleep 2
    fi
done

# Show container status
echo ""
echo "📊 Container Status:"
docker-compose ps

# Show volume information
echo ""
echo "📦 Docker Volumes:"
docker volume ls | grep clara_voice || echo "   No Clara Voice volumes found yet (will be created on first use)"

echo ""
echo "🎉 Clara Voice Lab is now running completely inside Docker!"
echo "🌐 Access the application at: http://localhost:$WEB_PORT"
echo "📚 API Documentation: http://localhost:$WEB_PORT/api/docs"
echo ""
echo "📊 Management commands:"
echo "   📋 View logs: docker-compose logs -f"
echo "   🛑 Stop: docker-compose down"
echo "   🔄 Restart: docker-compose restart"
echo "   📈 Monitor: docker stats"
echo "   🗑️  Clean up: docker-compose down -v (WARNING: deletes all data!)"
echo ""

# Show GPU status if available
if [ -n "$GPU_SUPPORT" ]; then
    echo "🎮 GPU Status:"
    docker exec clara-voice-lab nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null || echo "   GPU info will be available once container is fully started"
    echo ""
fi

echo "🔒 Data Persistence:"
echo "   All data is stored in Docker volumes:"
echo "   - clara_voice_data: User data, voice samples, history"
echo "   - clara_voice_models: AI models cache"
echo "   These persist between container restarts!"
echo ""
