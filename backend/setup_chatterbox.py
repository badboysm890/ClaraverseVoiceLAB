#!/usr/bin/env python3
"""
Setup script for ChatterBox dependencies in Clara Voice Lab
"""

import subprocess
import sys
import os

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}")
    print(f"Running: {command}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed")
        print(f"Error: {e.stderr}")
        return False

def check_python_version():
    """Check if Python version is compatible"""
    version = sys.version_info
    if version.major < 3 or (version.major == 3 and version.minor < 8):
        print("❌ Python 3.8 or higher is required")
        return False
    
    print(f"✅ Python {version.major}.{version.minor}.{version.micro} detected")
    return True

def install_pytorch():
    """Install PyTorch with CUDA support if available"""
    print("\n🔍 Checking for CUDA availability...")
    
    try:
        import torch
        print(f"✅ PyTorch already installed: {torch.__version__}")
        if torch.cuda.is_available():
            print(f"✅ CUDA available: {torch.version.cuda}")
            print(f"✅ GPU: {torch.cuda.get_device_name(0)}")
        else:
            print("ℹ️ CUDA not available, using CPU version")
        return True
    except ImportError:
        pass
    
    print("\n🤔 PyTorch not found. Let's install it...")
    
    # Check if NVIDIA GPU is available
    try:
        # Try to detect NVIDIA GPU
        result = subprocess.run("nvidia-smi", shell=True, capture_output=True, text=True)
        has_nvidia_gpu = result.returncode == 0
    except:
        has_nvidia_gpu = False
    
    if has_nvidia_gpu:
        print("🎮 NVIDIA GPU detected! Installing CUDA version...")
        # Try different CUDA versions
        cuda_commands = [
            ("pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121", "CUDA 12.1"),
            ("pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118", "CUDA 11.8"),
            ("pip install torch torchaudio", "CPU fallback")
        ]
        
        for cmd, desc in cuda_commands:
            print(f"\n🔄 Trying {desc}...")
            if run_command(cmd, f"Installing PyTorch ({desc})"):
                # Test if CUDA actually works
                test_cmd = 'python -c "import torch; print(\'CUDA available:\', torch.cuda.is_available())"'
                try:
                    result = subprocess.run(test_cmd, shell=True, capture_output=True, text=True)
                    if "CUDA available: True" in result.stdout:
                        print(f"✅ {desc} installation successful and CUDA is working!")
                        return True
                    else:
                        print(f"⚠️ {desc} installed but CUDA not working, trying next option...")
                except:
                    print(f"⚠️ Could not test {desc}, trying next option...")
                continue
        
        print("❌ All CUDA installations failed")
        return False
    else:
        print("💻 No NVIDIA GPU detected. Installing CPU version...")
        return run_command("pip install torch torchaudio", "Installing PyTorch (CPU version)")

def install_dependencies():
    """Install all required dependencies"""
    dependencies = [
        ("pip install -r requirements.txt", "Installing base requirements"),
        ("pip install librosa", "Installing librosa for audio processing"),
        ("pip install sounddevice", "Installing sounddevice for audio I/O"),
        ("pip install moviepy", "Installing moviepy for video processing"),
        ("pip install opencv-python", "Installing OpenCV for video processing"),
    ]
    
    success = True
    for cmd, desc in dependencies:
        if not run_command(cmd, desc):
            success = False
    
    return success

def install_chatterbox():
    """Install ChatterBox models"""
    print("\n📦 Installing ChatterBox models...")
    print("Note: ChatterBox models need to be installed separately.")
    print("Please follow the ChatterBox installation instructions:")
    print("1. Visit the ChatterBox repository")
    print("2. Follow the installation guide")
    print("3. Install the chatterbox package")
    
    # Try to install if available
    chatterbox_commands = [
        "pip install chatterbox-tts",
        "pip install git+https://github.com/chatterbox/chatterbox.git"
    ]
    
    for cmd in chatterbox_commands:
        if run_command(cmd, f"Trying: {cmd}"):
            return True
    
    print("⚠️ ChatterBox not installed automatically.")
    print("The backend will work but AI features will be disabled.")
    return False

def test_installation():
    """Test if everything is working"""
    print("\n🧪 Testing installation...")
    
    test_script = '''
import torch
import torchaudio
import numpy as np
import librosa
import sounddevice as sd
import cv2
from moviepy import VideoFileClip

print("✅ All dependencies imported successfully")
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU: {torch.cuda.get_device_name(0)}")

try:
    from chatterbox.tts import ChatterboxTTS
    from chatterbox.vc import ChatterboxVC
    print("✅ ChatterBox models available")
except ImportError:
    print("⚠️ ChatterBox models not available")
'''
    
    try:
        exec(test_script)
        print("✅ Installation test passed")
        return True
    except Exception as e:
        print(f"❌ Installation test failed: {e}")
        return False

def main():
    """Main setup function"""
    print("🚀 Clara Voice Lab - ChatterBox Setup")
    print("=" * 50)
    
    if not check_python_version():
        sys.exit(1)
    
    print(f"📁 Working directory: {os.getcwd()}")
    
    # Install PyTorch first
    if not install_pytorch():
        print("❌ Failed to install PyTorch")
        sys.exit(1)
    
    # Install other dependencies
    if not install_dependencies():
        print("⚠️ Some dependencies failed to install")
    
    # Try to install ChatterBox
    install_chatterbox()
    
    # Test installation
    test_installation()
    
    print("\n🎉 Setup complete!")
    print("You can now start the backend server with:")
    print("python main.py")
    print("\nOr use uvicorn:")
    print("uvicorn main:app --host 0.0.0.0 --port 8000 --reload")

if __name__ == "__main__":
    main()
