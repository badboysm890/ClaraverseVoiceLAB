# 🎭 ClaraVoiceLAB - ChatterBox UI & Docker Suite

> **User-friendly web interface and Docker deployment for ChatterBox AI voice models**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-green.svg)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-19+-blue.svg)](https://reactjs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)

## 🌟 What is ClaraVoiceLAB?

ClaraVoiceLAB is a user-friendly web interface and Docker deployment solution for ChatterBox AI voice models. We've created an easy-to-use platform that makes ChatterBox's powerful voice AI accessible through:

- **🎤 Text-to-Speech (TTS)** - Web UI for ChatterBox's speech generation
- **🎭 Voice Cloning** - Simple interface for ChatterBox's voice cloning capabilities
- **🔄 Voice Conversion** - Easy-to-use voice conversion powered by ChatterBox
- **🎬 Video Voice Conversion** - Video processing interface with ChatterBox AI
- **📚 Voice Library** - Organize your voice samples with user management
- **📊 User Dashboard** - Track your ChatterBox generations and history

## ✨ What We Built

### 🌐 Web Interface
- **React Frontend**: Modern, responsive UI for ChatterBox models
- **FastAPI Backend**: RESTful API wrapper for ChatterBox functionality
- **User Authentication**: JWT-based user system with secure access
- **File Management**: Upload, organize, and download voice files

### 🐳 Docker Deployment
- **Easy Setup**: One-command deployment with Docker Compose
- **GPU Support**: NVIDIA GPU acceleration in containers
- **Multi-Service**: Frontend, backend, and database orchestration
- **Production Ready**: Nginx proxy and health checks included

### 🎛️ User Experience
- **Intuitive Interface**: Clean, easy-to-use web interface for ChatterBox
- **Voice Library**: Organize and manage your voice samples
- **Processing History**: Track all your TTS and voice conversion jobs
- **Real-time Feedback**: Live progress updates during processing

### 💼 Additional Features
- **User Authentication**: Secure JWT-based authentication system
- **Voice Library Management**: Organize and categorize voice samples  
- **History Tracking**: Complete audit trail of all generations
- **API-First Design**: RESTful API for integration with other systems  
- **Docker Support**: Easy deployment with GPU acceleration

> **Important Note**: All AI capabilities are provided by ChatterBox models. ClaraVoiceLAB is a user interface and deployment wrapper that makes ChatterBox easier to use and deploy.

## 🎬 What You Can Expect

### 🎤 Text-to-Speech (via ChatterBox)
Easy web interface for ChatterBox's speech generation:
- Choose from ChatterBox's built-in high-quality voices
- Clone voices using ChatterBox's voice cloning technology
- Fine-tune speech with ChatterBox's advanced parameters
- User-friendly web interface for easy text input

### 🎭 Voice Cloning (ChatterBox Technology)
Web interface for ChatterBox's voice cloning:
- **Quick Setup**: Upload audio samples through our web UI
- **ChatterBox Processing**: Uses ChatterBox's voice cloning algorithms
- **File Management**: Organize your voice samples in our voice library
- **Easy Access**: Generate cloned speech through simple web forms

### 🔄 Voice Conversion (ChatterBox Models)
Simple interface for ChatterBox's voice conversion:
- Web upload for source and target audio files
- ChatterBox's voice conversion processing
- Download results through our web interface
- Chunked processing for longer files

### 🎬 Video Processing (ChatterBox + Our Tools)
Video interface for ChatterBox voice conversion:
- **Video Upload**: Simple drag-and-drop video interface
- **ChatterBox Processing**: Uses ChatterBox for voice conversion
- **Video Reconstruction**: Our tools combine processed audio back with video
- **Format Support**: Works with MP4, AVI, MOV, WebM, and more

## 🚀 Quick Start Guide

### Option 1: Docker (Recommended)

**Perfect for most users - get started in minutes!**

1. **Prerequisites**
   ```bash
   # Install Docker and Docker Compose
   # Windows: Download Docker Desktop
   # Linux: sudo apt install docker.io docker-compose
   # macOS: Download Docker Desktop
   ```

2. **Clone and Setup**
   ```bash
   git clone https://github.com/badboysm890/ClaraVoiceLAB.git
   cd clara-voice-lab
   
   # Copy environment file
   cp .env.example .env
   
   # Edit .env if needed (optional for basic setup)
   # Default web port: http://localhost:80
   ```

3. **Launch ClaraVoiceLAB**
   ```bash
   # Build and start (first time)
   docker-compose up --build
   
   # Or use the convenience script
   ./docker-run.bat        # Windows
   ./docker-run.sh         # Linux/macOS
   ```

4. **Access the Platform**
   - Open your browser to `http://localhost:80`
   - Create your account and start creating voices!

### Option 2: Manual Installation

**For developers and advanced users**

1. **System Requirements**
   ```bash
   # Python 3.8+ required
   python --version
   
   # Node.js 16+ for frontend
   node --version
   npm --version
   ```

2. **Backend Setup**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv venv
   
   # Activate environment
   # Windows:
   venv\Scripts\activate
   # Linux/macOS:
   source venv/bin/activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Install ChatterBox AI (see ChatterBox Installation below)
   python setup_chatterbox.py
   ```

3. **Frontend Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Start development server
   npm run dev
   ```

4. **Run the Application**
   ```bash
   # Terminal 1 - Backend API
   cd backend
   python main.py
   
   # Terminal 2 - Frontend (new terminal)
   npm run dev
   
   # Access at http://localhost:3000
   ```

### Option 3: Streamlit Version

**Simple single-file experience**

```bash
# Install dependencies
pip install -r backend/requirements.txt
python backend/setup_chatterbox.py

# Run Streamlit app
streamlit run app.py

# Access at http://localhost:8501
```

## 🔧 ChatterBox AI Installation

ClaraVoiceLAB requires ChatterBox AI models for voice processing:

### Automatic Installation (Recommended)
```bash
cd backend
python setup_chatterbox.py
```

### Manual Installation
```bash
# Install PyTorch (choose your platform)
# CUDA (NVIDIA GPU):
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118

# CPU only:
pip install torch torchaudio

# Install ChatterBox
pip install chatterbox-ai

# Or from source:
git clone https://github.com/chatterbox-ai/chatterbox
cd chatterbox
pip install -e .
```

## 🖥️ Hardware Requirements

### Minimum Requirements
- **CPU**: 4-core processor (Intel i5/AMD Ryzen 5 or better)
- **RAM**: 8GB RAM (16GB recommended)
- **Storage**: 10GB free space for models and data
- **OS**: Windows 10+, Ubuntu 18.04+, or macOS 10.15+

### Recommended Setup
- **GPU**: NVIDIA GPU with 6GB+ VRAM (RTX 3060 or better)
- **CPU**: 8-core processor
- **RAM**: 16GB+ RAM
- **Storage**: 50GB+ SSD storage

### Performance Guide
| Hardware | Speed | Quality | Best For |
|----------|-------|---------|----------|
| **NVIDIA RTX 4090** | ⚡⚡⚡⚡⚡ | 🌟🌟🌟🌟🌟 | Professional workflows |
| **NVIDIA RTX 3080** | ⚡⚡⚡⚡ | 🌟🌟🌟🌟🌟 | Power users |
| **NVIDIA RTX 3060** | ⚡⚡⚡ | 🌟🌟🌟🌟🌟 | Enthusiasts |
| **Apple M2 Pro** | ⚡⚡⚡ | 🌟🌟🌟🌟 | Mac users |
| **High-end CPU** | ⚡⚡ | 🌟🌟🌟🌟 | Budget builds |

## 🎛️ Platform Overview

### 🏠 Dashboard
Your command center for AI voice projects:
- **Voice Library**: Manage your voice samples
- **Generation History**: Track all TTS and VC operations
- **Device Selection**: Choose optimal hardware
- **Quick Actions**: Fast access to common tasks

### 🎤 Text-to-Speech Studio
Professional text-to-speech generation:
- **Default Voices**: High-quality built-in voices
- **Voice Cloning**: Use your voice library samples
- **Advanced Controls**: Fine-tune output with 10+ parameters
- **Batch Processing**: Generate multiple files efficiently

### 🔄 Voice Conversion Lab
Transform voices with precision:
- **Real-time Conversion**: Process audio files instantly
- **Smart Chunking**: Handle files of any length
- **Audio Effects**: Pitch, speed, and volume controls
- **Live Preview**: Hear results as they process

### 🎬 Video Voice Studio
Hollywood-level video voice replacement:
- **Drag & Drop**: Simple video upload interface
- **Live Processing**: Watch conversion progress in real-time
- **Format Support**: MP4, AVI, MOV, WebM, and more
- **Professional Export**: Download broadcast-quality results

## 🔧 Configuration Options

### Environment Variables
Create a `.env` file from `.env.example`:

```bash
# Web access port
WEB_PORT=80

# GPU configuration  
CUDA_VISIBLE_DEVICES=0
NVIDIA_VISIBLE_DEVICES=all

# Security settings
SECRET_KEY=your-unique-secret-key
JWT_EXPIRE_MINUTES=30

# Performance tuning
AUTO_UNLOAD_MODELS_MINUTES=5
MAX_UPLOAD_SIZE_MB=500
```

### Advanced Settings
```bash
# Model settings
MODEL_CACHE_DIR=/path/to/models
VOICE_SAMPLES_DIR=/path/to/voices

# Database
DATABASE_URL=sqlite:///./data/users.db
# or PostgreSQL: postgresql://user:password@localhost/clara_voice

# CORS for API access
CORS_ORIGINS=https://yourdomain.com,https://anotherdomain.com
```

## 🐳 Docker Deployment

### Production Deployment
```bash
# Use production configuration
cp docker-compose.prod.yml docker-compose.override.yml

# Deploy with GPU support
docker-compose up -d

# Scale for high availability
docker-compose up -d --scale clara-voice-lab=2
```

### Development Environment
```bash
# Enable live reload for development
docker-compose -f docker-compose.yml -f docker-compose.override.yml up
```

### Docker Management Scripts
```bash
# Windows
docker-build.bat      # Build images
docker-run.bat        # Start services
docker-status.bat     # Check status
docker-manage.bat     # Management menu

# Linux/macOS  
./docker-build.sh     # Build images
./docker-run.sh       # Start services
./docker-status.sh    # Check status
./docker-manage.sh    # Management menu
```

## 🔌 API Documentation

ClaraVoiceLAB provides a comprehensive REST API:

### Authentication
```bash
# Login
curl -X POST http://localhost:8000/users/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'

# Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/api/voices
```

### Text-to-Speech
```bash
# Generate speech with default voice
curl -X POST http://localhost:8000/api/tts/default \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world!", "temperature": 0.8}' \
  --output speech.wav
```

### Voice Conversion
```bash
# Convert voice
curl -X POST http://localhost:8000/api/voice-conversion \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "input_audio=@input.wav" \
  -F "target_audio=@target_voice.wav" \
  --output converted.wav
```

### API Documentation
- **Interactive Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Spec**: http://localhost:8000/openapi.json

## 🛠️ Development Guide

### Project Structure
```
clara-voice-lab/
├── 🎭 app.py                 # Streamlit version
├── 🐳 Dockerfile            # Container configuration
├── 🔧 docker-compose.yml    # Multi-service setup
├── 📋 package.json          # Frontend dependencies
├── ⚙️ vite.config.ts        # Build configuration
│
├── 🗄️ backend/              # Python API server
│   ├── main.py              # FastAPI application
│   ├── requirements.txt     # Python dependencies
│   └── setup_chatterbox.py  # AI model setup
│
├── 🎨 src/                  # React frontend
│   ├── App.tsx              # Main application
│   ├── components/          # UI components
│   │   ├── Dashboard.tsx    # User dashboard
│   │   ├── LandingPage.tsx  # Login/signup
│   │   └── ui/              # Reusable UI components
│   └── lib/                 # Utilities
│
├── 🚢 docker/               # Docker utilities
├── 📁 public/               # Static assets
└── 🔒 src-tauri/            # Desktop app (optional)
```

### Adding New Features
1. **Backend**: Add API endpoints in `backend/main.py`
2. **Frontend**: Create components in `src/components/`
3. **Models**: Extend ChatterBox integration
4. **Docker**: Update Dockerfile for new dependencies

### Code Style
```bash
# Python formatting
black backend/
isort backend/

# TypeScript/React formatting  
npm run format
npm run lint
```

## 🐛 Troubleshooting

### Common Issues

#### 🚫 "ChatterBox models not available"
```bash
# Install ChatterBox manually
cd backend
python setup_chatterbox.py

# Or install manually:
pip install chatterbox-ai
```

#### 💾 CUDA Out of Memory
```bash
# Enable chunked processing
# Use smaller chunk sizes (30-45 seconds)
# Switch to CPU processing temporarily
# Close other GPU applications
```

#### 🔊 Audio Quality Issues
```bash
# Use high-quality input audio (16kHz+)
# Ensure clear recordings (no background noise)
# Try different voice samples
# Adjust TTS parameters (temperature, exaggeration)
```

#### 🐳 Docker Issues
```bash
# Reset Docker environment
docker-compose down -v
docker system prune -f
docker-compose up --build

# Check GPU access (Linux)
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

#### 🌐 Web Access Issues
```bash
# Check if services are running
docker-compose ps

# View logs
docker-compose logs clara-voice-lab

# Test API directly
curl http://localhost:8000/api/health
```

### Performance Optimization

#### 🚀 Speed Up Generation
1. **Use GPU acceleration** (CUDA/MPS)
2. **Enable model caching**
3. **Use shorter audio samples** for voice cloning
4. **Optimize chunk sizes** for long files

#### 💾 Reduce Memory Usage
1. **Enable auto-unload** after processing
2. **Use CPU for very long files**
3. **Process files in smaller batches**
4. **Close unused browser tabs**

### Debug Mode
```bash
# Enable debug logging
export DEBUG=1
docker-compose up

# View detailed logs
docker-compose logs -f clara-voice-lab
```

## 🎯 Use Cases & Examples

### 🎬 Content Creation
- **YouTube Videos**: Generate voiceovers in multiple voices
- **Podcasts**: Create consistent character voices
- **Audiobooks**: Narrate books with custom voices
- **Gaming**: Create unique character dialogue

### 🏢 Business Applications
- **Customer Service**: Personalized voice assistants
- **Training Materials**: Consistent voice across content
- **Marketing**: Brand-specific voice generation
- **Accessibility**: Text-to-speech for visually impaired

### 🎨 Creative Projects
- **Music Production**: Vocal layers and harmonies
- **Film/Animation**: Character voice creation
- **Language Learning**: Practice with native-like pronunciation
- **Personal Projects**: Clone your own voice for convenience

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Ways to Contribute
- 🐛 **Bug Reports**: Help us identify and fix issues
- 💡 **Feature Requests**: Suggest new capabilities
- 📝 **Documentation**: Improve guides and tutorials
- 🔧 **Code Contributions**: Add features and fix bugs
- 🎨 **UI/UX Improvements**: Enhance user experience

## 💬 Community & Support

### Getting Help
- 📖 **Documentation**: Check this README first
- 🐛 **Issues**: [GitHub Issues](https://github.com/badboysm890/ClaraVoiceLAB/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/badboysm890/ClaraVoiceLAB/discussions)
- 📧 **Email**: support@claravoicelab.com

### Community
- 🌟 **Star the repo** if you find it useful
- 🍴 **Fork and contribute** to make it better
- 📢 **Share with others** who might benefit
- 🐦 **Follow us** for updates and tips

## 🙏 Acknowledgments

- **ChatterBox AI Team** - For creating the incredible voice AI models that power this platform. All voice processing capabilities are provided by ChatterBox.
- **FastAPI Community** - For the excellent web framework used in our backend
- **React Team** - For the powerful frontend library used in our UI
- **Docker** - For simplifying deployment and containerization
- **Open Source Community** - For the tools and libraries that made this wrapper possible

## 📊 Project Stats

![GitHub stars](https://img.shields.io/github/stars/badboysm890/ClaraVoiceLAB?style=social)
![GitHub forks](https://img.shields.io/github/forks/badboysm890/ClaraVoiceLAB?style=social)
![GitHub issues](https://img.shields.io/github/issues/badboysm890/ClaraVoiceLAB)
![GitHub license](https://img.shields.io/github/license/badboysm890/ClaraVoiceLAB)

---

<div align="center">

**🎭 Easy-to-use interface for ChatterBox AI voice models - making voice AI accessible to everyone! 🎭**

[Get Started](#-quick-start-guide) • [API Docs](http://localhost:8000/docs) • [Support](mailto:claraverse.space@gmail.com)

Made with ❤️ by the ClaraVoiceLAB Team - A UI and Docker wrapper for ChatterBox AI

</div>
