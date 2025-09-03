#!/bin/bash

# Build script for Clara Voice Lab Docker image

set -e

echo "Building Clara Voice Lab Docker image..."

# Check if NVIDIA Docker is available
if command -v nvidia-docker &> /dev/null; then
    echo "NVIDIA Docker detected"
elif docker info | grep -q "nvidia"; then
    echo "NVIDIA Docker runtime detected"
else
    echo "Warning: NVIDIA Docker not detected. GPU acceleration may not work."
    echo "Please install nvidia-docker2 for GPU support."
fi

# Build the Docker image
echo "Building Docker image..."
docker build -t clara-voice-lab:latest .

# Create data directories
echo "Creating data directories..."
mkdir -p data/database
mkdir -p data/voice_samples
mkdir -p data/tts_history
mkdir -p data/vc_history
mkdir -p models

echo "Build complete!"
echo ""
echo "To run Clara Voice Lab:"
echo "  docker-compose up -d"
echo ""
echo "To run with Docker directly:"
echo "  docker run --gpus all -p 80:80 -v \$(pwd)/data:/app/data clara-voice-lab:latest"
echo ""
echo "Access the application at http://localhost"
