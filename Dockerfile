# Multi-stage Dockerfile for Clara Voice Lab with CUDA support
# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the frontend
RUN npm run build

# Stage 2: Python backend with CUDA support
FROM nvidia/cuda:13.0.0-devel-ubuntu22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    build-essential \
    wget \
    curl \
    git \
    ffmpeg \
    libsndfile1 \
    libportaudio2 \
    libportaudiocpp0 \
    portaudio19-dev \
    libasound2-dev \
    libpulse-dev \
    libgl1-mesa-glx \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip3 install --no-cache-dir --upgrade pip

# Install PyTorch with CUDA support first
RUN pip3 install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install other requirements
RUN pip3 install --no-cache-dir -r backend/requirements.txt

# Install ChatterBox TTS for voice generation
RUN pip3 install --no-cache-dir chatterbox-tts

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/dist ./frontend/

# Create directories for data persistence (inside Docker volumes)
RUN mkdir -p /app/data/voice_samples \
    /app/data/tts_history \
    /app/data/vc_history \
    /app/data/database && \
    mkdir -p /app/models && \
    chmod -R 755 /app/data /app/models

# Create a simple static file server for the frontend
RUN pip3 install --no-cache-dir aiofiles

# Set working directory
WORKDIR /app

# Copy startup script
COPY docker/start.sh /start.sh
RUN chmod +x /start.sh

# Expose ports
EXPOSE 8000 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Start the application
CMD ["/start.sh"]
