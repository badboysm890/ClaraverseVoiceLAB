#!/bin/bash

# Flexible deployment script for Clara Voice Lab
# Usage: ./run.sh [WEB_PORT] [BACKEND_PORT] [FRONTEND_PORT]

set -e

# Default ports
DEFAULT_WEB_PORT=80
DEFAULT_BACKEND_PORT=8000
DEFAULT_FRONTEND_PORT=3000

# Parse command line arguments
WEB_PORT=${1:-$DEFAULT_WEB_PORT}
BACKEND_PORT=${2:-$DEFAULT_BACKEND_PORT}
FRONTEND_PORT=${3:-$DEFAULT_FRONTEND_PORT}

echo "🚀 Starting Clara Voice Lab with custom ports..."
echo "📋 Configuration:"
echo "   🌐 Web Port (Nginx): $WEB_PORT"
echo "   🔧 Backend API: $BACKEND_PORT"
echo "   ⚛️  Frontend: $FRONTEND_PORT"
echo ""

# Check if ports are in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "❌ Port $port is already in use!"
        echo "   Please choose a different port or stop the service using that port."
        exit 1
    fi
}

echo "🔍 Checking if ports are available..."
check_port $WEB_PORT
check_port $BACKEND_PORT
check_port $FRONTEND_PORT

# Create .env file with custom ports
echo "📝 Creating environment configuration..."
cat > .env << EOF
# Clara Voice Lab Configuration - Generated $(date)
WEB_PORT=$WEB_PORT
BACKEND_PORT=$BACKEND_PORT
FRONTEND_PORT=$FRONTEND_PORT

# GPU Configuration
CUDA_VISIBLE_DEVICES=0
NVIDIA_VISIBLE_DEVICES=all

# Database configuration
DATABASE_URL=sqlite:///./data/database/users.db

# Security (change in production)
SECRET_KEY=your-secret-key-change-in-production
JWT_EXPIRE_MINUTES=30

# Application settings
AUTO_UNLOAD_MODELS_MINUTES=5
MAX_UPLOAD_SIZE_MB=500

# CORS settings
CORS_ORIGINS=*
EOF

# Create data directories
echo "📁 Creating data directories..."
mkdir -p data/database
mkdir -p data/voice_samples
mkdir -p data/tts_history
mkdir -p data/vc_history
mkdir -p models

# Check Docker and NVIDIA support
echo "🐳 Checking Docker configuration..."
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed!"
    exit 1
fi

if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon is not running!"
    exit 1
fi

# Check for NVIDIA Docker support
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

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Build and start the application
echo "🔨 Building and starting Clara Voice Lab..."
docker-compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 10

# Health check
echo "🔍 Performing health check..."
for i in {1..30}; do
    if curl -s http://localhost:$WEB_PORT/api/health >/dev/null 2>&1; then
        echo "✅ Clara Voice Lab is running successfully!"
        break
    elif [ $i -eq 30 ]; then
        echo "❌ Health check failed after 30 attempts"
        echo "📋 Container logs:"
        docker-compose logs --tail=20
        exit 1
    else
        echo "   Attempt $i/30 - waiting for services..."
        sleep 2
    fi
done

echo ""
echo "🎉 Clara Voice Lab is now running!"
echo "🌐 Access the application at: http://localhost:$WEB_PORT"
echo "📚 API Documentation: http://localhost:$WEB_PORT/api/docs"
echo ""
echo "📊 Useful commands:"
echo "   📋 View logs: docker-compose logs -f"
echo "   🛑 Stop: docker-compose down"
echo "   🔄 Restart: docker-compose restart"
echo "   📈 Monitor: docker stats"
echo ""

# Show GPU status if available
if [ -n "$GPU_SUPPORT" ]; then
    echo "🎮 GPU Status:"
    docker exec clara-voice-lab nvidia-smi --query-gpu=name,memory.used,memory.total --format=csv,noheader,nounits 2>/dev/null || echo "   GPU info not available yet"
    echo ""
fi
