# Clara Voice Lab Backend

FastAPI backend for Clara Voice Lab with ChatterBox AI integration.

## Features

- 🎤 **Text-to-Speech (TTS)** with default and cloned voices
- 🔄 **Voice Conversion** with chunked processing for long audio
- 🎬 **Video Voice Conversion** (planned)
- ⚙️ **Multi-device Support** (CPU, CUDA, MPS)
- 🔐 **JWT Authentication**
- 📊 **Real-time Device Management**

## Quick Setup

### 1. Install Dependencies

```bash
# Navigate to backend directory
cd backend

# Run the automated setup script
python setup_chatterbox.py
```

### 2. Manual Installation (Alternative)

#### Option A: CUDA Support (Recommended for NVIDIA GPU users)
```bash
# Install PyTorch with CUDA support first
python install_cuda_pytorch.py

# Then install other requirements
pip install -r requirements.txt
```

#### Option B: CPU Only
```bash
# Install all requirements (CPU-only PyTorch)
pip install -r requirements.txt
```

#### Option C: Manual CUDA Installation
```bash
# Install base requirements first
pip install fastapi uvicorn sqlalchemy bcrypt python-jose python-multipart

# Install PyTorch with CUDA 11.8 (most compatible)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# Install remaining dependencies
pip install numpy librosa sounddevice moviepy opencv-python

# Install ChatterBox models (follow their installation guide)
# pip install chatterbox-tts  # Example - check actual installation method
```

### 3. Start the Server

```bash
# Development server with auto-reload
python main.py

# Or using uvicorn directly
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## API Endpoints

### Authentication
- `POST /users/signup` - User registration
- `POST /users/login` - User login
- `GET /users/me` - Get current user

### Device Management
- `GET /api/device-info` - Get available devices and current configuration
- `POST /api/set-device` - Change processing device (CPU/CUDA/MPS)
- `GET /api/health` - Health check and status

### ChatterBox AI Features
- `POST /api/tts/default` - Generate speech with default voice
- `POST /api/tts/clone` - Generate speech with voice cloning
- `POST /api/voice-conversion` - Convert voice using uploaded audio

## Device Support

### CUDA (NVIDIA GPU)
- **Performance**: 5-10x faster than CPU
- **Requirements**: NVIDIA GPU with CUDA support
- **Memory**: Requires sufficient VRAM for model loading

### MPS (Apple Silicon)
- **Performance**: 2-3x faster than CPU
- **Requirements**: Apple M1/M2/M3 processors
- **Compatibility**: macOS only

### CPU
- **Performance**: Baseline performance
- **Requirements**: Any modern CPU
- **Compatibility**: Universal

## Configuration

### Environment Variables
```bash
# JWT Secret (change in production)
SECRET_KEY="your-secret-key-change-in-production"

# Database URL
DATABASE_URL="sqlite:///./users.db"
```

### Device Selection
The backend automatically selects the best available device:
1. CUDA (if NVIDIA GPU available)
2. MPS (if Apple Silicon available)
3. CPU (fallback)

You can change devices through the API or frontend settings.

## Troubleshooting

### ChatterBox Not Available
If you see "ChatterBox models not available":
1. Install the ChatterBox package following their official guide
2. Ensure all dependencies are installed
3. Check Python version (3.8+ required)

### CUDA Issues
If CUDA is not detected:
1. Install NVIDIA drivers
2. Install CUDA toolkit
3. Reinstall PyTorch with CUDA support:
   ```bash
   pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118
   ```

### Memory Issues
For large audio files or limited VRAM:
1. Use CPU processing
2. Enable chunked processing
3. Reduce chunk duration
4. Close other GPU applications

## Development

### Project Structure
```
backend/
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── setup_chatterbox.py  # Setup script
├── users.db            # SQLite database
└── README.md           # This file
```

### Adding New Endpoints
1. Add Pydantic models for request/response
2. Implement endpoint function
3. Add authentication if needed
4. Update this README

## Production Deployment

### Security
- Change `SECRET_KEY` in production
- Use proper database (PostgreSQL recommended)
- Enable HTTPS
- Configure CORS properly
- Add rate limiting

### Performance
- Use production ASGI server (Gunicorn + Uvicorn)
- Configure proper logging
- Monitor GPU memory usage
- Consider model caching strategies

## API Documentation

When the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Support

For issues related to:
- **Clara Voice Lab**: Check the main repository
- **ChatterBox Models**: Check the ChatterBox repository
- **PyTorch/CUDA**: Check PyTorch documentation
