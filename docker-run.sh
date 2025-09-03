#!/bin/bash

# Simple Docker run script without docker-compose - self-contained
# Usage: ./docker-run.sh [PORT]

set -e

# Default web port
WEB_PORT=${1:-8080}

echo "🚀 Running Clara Voice Lab on port $WEB_PORT (self-contained)"

# Check if port is in use
if lsof -Pi :$WEB_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Port $WEB_PORT is already in use!"
    echo "   Please choose a different port: ./docker-run.sh [PORT]"
    exit 1
fi

# Check for GPU support
if command -v nvidia-docker &> /dev/null || docker info 2>/dev/null | grep -q nvidia; then
    echo "✅ GPU support detected"
    GPU_FLAGS="--gpus all"
else
    echo "⚠️  No GPU support - running in CPU mode"
    GPU_FLAGS=""
fi

# Build the image if it doesn't exist
if ! docker images | grep -q clara-voice-lab; then
    echo "🔨 Building Clara Voice Lab image..."
    docker build -t clara-voice-lab:latest .
fi

# Create Docker volumes if they don't exist
echo "📦 Creating Docker volumes..."
docker volume create clara-voice-data 2>/dev/null || true
docker volume create clara-voice-models 2>/dev/null || true

# Stop any existing container
docker stop clara-voice-lab 2>/dev/null || true
docker rm clara-voice-lab 2>/dev/null || true

# Run the container
echo "🏃 Starting container..."
docker run -d \
    --name clara-voice-lab \
    $GPU_FLAGS \
    -p $WEB_PORT:8000 \
    -p $((WEB_PORT + 1)):3000 \
    -v clara-voice-data:/app/data \
    -v clara-voice-models:/app/models \
    -e WEB_PORT=80 \
    -e BACKEND_PORT=8000 \
    -e FRONTEND_PORT=3000 \
    --restart unless-stopped \
    clara-voice-lab:latest

# Wait for startup
echo "⏳ Waiting for services to start..."
sleep 15

# Health check
for i in {1..30}; do
    if curl -s http://localhost:$WEB_PORT/api/health >/dev/null 2>&1; then
        echo "✅ Clara Voice Lab is running!"
        break
    elif [ $i -eq 30 ]; then
        echo "❌ Health check failed"
        docker logs clara-voice-lab --tail=20
        exit 1
    else
        sleep 2
    fi
done

echo ""
echo "🎉 Clara Voice Lab is now running (self-contained)!"
echo "🌐 Access: http://localhost:$WEB_PORT"
echo "📚 API Docs: http://localhost:$WEB_PORT/docs"
echo ""
echo "📊 Management commands:"
echo "   📋 Logs: docker logs -f clara-voice-lab"
echo "   🛑 Stop: docker stop clara-voice-lab"
echo "   🗑️  Remove: docker rm clara-voice-lab"
echo "   🔍 Volumes: docker volume ls | grep clara-voice"
echo ""
echo "🔒 Data stored in Docker volumes:"
echo "   - clara-voice-data: All user data and database"
echo "   - clara-voice-models: AI models cache"
echo ""
