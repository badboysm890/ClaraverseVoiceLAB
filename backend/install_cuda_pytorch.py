#!/usr/bin/env python3
"""
Script to install PyTorch with CUDA support for Clara Voice Lab
"""

import subprocess
import sys

def run_command(command, description):
    """Run a command and handle errors"""
    print(f"\n🔄 {description}")
    print(f"Running: {command}")
    
    try:
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True)
        print(f"✅ {description} completed successfully")
        if result.stdout:
            print(f"Output: {result.stdout.strip()}")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ {description} failed")
        if e.stderr:
            print(f"Error: {e.stderr.strip()}")
        if e.stdout:
            print(f"Output: {e.stdout.strip()}")
        return False

def check_nvidia_gpu():
    """Check if NVIDIA GPU is available"""
    print("🔍 Checking for NVIDIA GPU...")
    
    try:
        result = subprocess.run("nvidia-smi", shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print("✅ NVIDIA GPU detected!")
            print("GPU Information:")
            # Extract GPU info from nvidia-smi output
            lines = result.stdout.split('\n')
            for line in lines:
                if 'GeForce' in line or 'RTX' in line or 'GTX' in line or 'Quadro' in line:
                    print(f"  {line.strip()}")
            return True
        else:
            print("❌ NVIDIA GPU not detected or nvidia-smi not available")
            return False
    except Exception as e:
        print(f"❌ Error checking for NVIDIA GPU: {e}")
        return False

def check_current_pytorch():
    """Check current PyTorch installation"""
    print("\n🔍 Checking current PyTorch installation...")
    
    try:
        import torch
        print(f"✅ PyTorch version: {torch.__version__}")
        print(f"CUDA available: {torch.cuda.is_available()}")
        
        if torch.cuda.is_available():
            print(f"CUDA version: {torch.version.cuda}")
            print(f"GPU count: {torch.cuda.device_count()}")
            for i in range(torch.cuda.device_count()):
                print(f"GPU {i}: {torch.cuda.get_device_name(i)}")
        else:
            print("Current installation is CPU-only")
        
        return True
    except ImportError:
        print("❌ PyTorch not installed")
        return False

def install_cuda_pytorch():
    """Install PyTorch with CUDA support"""
    print("\n🚀 Installing PyTorch with CUDA support...")
    
    # Uninstall existing PyTorch first
    uninstall_commands = [
        "pip uninstall torch torchaudio torchvision -y"
    ]
    
    for cmd in uninstall_commands:
        run_command(cmd, "Uninstalling existing PyTorch")
    
    # Install CUDA versions in order of preference
    cuda_options = [
        {
            "version": "CUDA 12.1",
            "command": "pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121",
            "test_import": True
        },
        {
            "version": "CUDA 11.8", 
            "command": "pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118",
            "test_import": True
        },
        {
            "version": "CPU (fallback)",
            "command": "pip install torch torchaudio",
            "test_import": True
        }
    ]
    
    for option in cuda_options:
        print(f"\n🔄 Trying {option['version']}...")
        
        if run_command(option["command"], f"Installing PyTorch with {option['version']}"):
            # Test the installation
            if option["test_import"]:
                print("🧪 Testing installation...")
                test_script = '''
import torch
print(f"PyTorch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
if torch.cuda.is_available():
    print(f"CUDA version: {torch.version.cuda}")
    print(f"GPU count: {torch.cuda.device_count()}")
    for i in range(torch.cuda.device_count()):
        print(f"GPU {i}: {torch.cuda.get_device_name(i)}")
'''
                
                try:
                    result = subprocess.run([sys.executable, "-c", test_script], 
                                          capture_output=True, text=True, timeout=30)
                    
                    if result.returncode == 0:
                        print("✅ Installation test passed!")
                        print("Test output:")
                        print(result.stdout)
                        
                        # Check if CUDA is actually working
                        if "CUDA available: True" in result.stdout:
                            print(f"🎉 Successfully installed PyTorch with {option['version']}!")
                            return True
                        elif option['version'] == "CPU (fallback)":
                            print(f"✅ Successfully installed PyTorch CPU version")
                            return True
                        else:
                            print(f"⚠️ {option['version']} installed but CUDA not working")
                            continue
                    else:
                        print(f"❌ Installation test failed: {result.stderr}")
                        continue
                        
                except subprocess.TimeoutExpired:
                    print("⚠️ Installation test timed out")
                    continue
                except Exception as e:
                    print(f"⚠️ Installation test error: {e}")
                    continue
            else:
                return True
    
    print("❌ All installation attempts failed")
    return False

def main():
    """Main function"""
    print("🚀 Clara Voice Lab - CUDA PyTorch Installation")
    print("=" * 60)
    
    # Check current state
    has_gpu = check_nvidia_gpu()
    has_pytorch = check_current_pytorch()
    
    if not has_gpu:
        print("\n⚠️ No NVIDIA GPU detected.")
        response = input("Do you want to install CPU-only PyTorch? (y/n): ")
        if response.lower() != 'y':
            print("Installation cancelled.")
            return
    
    if has_pytorch:
        print("\n🤔 PyTorch is already installed.")
        response = input("Do you want to reinstall with CUDA support? (y/n): ")
        if response.lower() != 'y':
            print("Installation cancelled.")
            return
    
    # Install PyTorch
    if install_cuda_pytorch():
        print("\n🎉 Installation completed successfully!")
        print("\nYou can now:")
        print("1. Start the Clara Voice Lab backend: python main.py")
        print("2. Check the settings page for device configuration")
        print("3. Use GPU acceleration for faster AI processing")
    else:
        print("\n❌ Installation failed.")
        print("Please check the error messages above and try manual installation:")
        print("pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu118")

if __name__ == "__main__":
    main()
