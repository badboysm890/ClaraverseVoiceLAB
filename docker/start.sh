#!/bin/bash

# Clara Voice Lab Startup Script

set -e

echo "Starting Clara Voice Lab..."

# Get port configuration from environment variables
BACKEND_PORT=${BACKEND_PORT:-8000}
FRONTEND_PORT=${FRONTEND_PORT:-3000}
WEB_PORT=${WEB_PORT:-80}

echo "Configuration:"
echo "  Backend Port: $BACKEND_PORT"
echo "  Frontend Port: $FRONTEND_PORT"
echo "  Web Port: $WEB_PORT"

# Set up database directory
export DATABASE_URL="${DATABASE_URL:-sqlite:///./data/database/users.db}"

# Create directories if they don't exist
mkdir -p /app/data/database
mkdir -p /app/data/voice_samples
mkdir -p /app/data/tts_history
mkdir -p /app/data/vc_history

# Change to backend directory
cd /app/backend

# Check GPU availability
echo "Checking GPU availability..."
python3 -c "
import torch
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'GPU Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB')
"

# Start the backend API server in background
echo "Starting FastAPI backend on port $BACKEND_PORT..."
uvicorn main:app --host 0.0.0.0 --port $BACKEND_PORT --workers 1 &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 5

# Start a simple static file server for the frontend
echo "Starting frontend server on port $FRONTEND_PORT..."
cd /app
python3 -c "
import asyncio
import aiofiles
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn
import os

app = FastAPI()

# Serve static files
app.mount('/assets', StaticFiles(directory='frontend/assets'), name='assets')

# Serve index.html for all routes (SPA)
@app.get('/{path:path}')
async def serve_spa(path: str):
    if path.startswith('api/'):
        # This shouldn't happen due to proxy, but just in case
        return {'error': 'API endpoint not found'}
    return FileResponse('frontend/index.html')

if __name__ == '__main__':
    port = int(os.environ.get('FRONTEND_PORT', '3000'))
    uvicorn.run(app, host='0.0.0.0', port=port)
" &
FRONTEND_PID=$!

# Function to handle shutdown
cleanup() {
    echo 'Shutting down...'
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

echo "Clara Voice Lab is running!"
echo "Frontend: http://localhost:$FRONTEND_PORT"
echo "API: http://localhost:$BACKEND_PORT"
echo "API Docs: http://localhost:$BACKEND_PORT/docs"
echo "Main App (via proxy): http://localhost:$WEB_PORT"

# Wait for both processes
wait
