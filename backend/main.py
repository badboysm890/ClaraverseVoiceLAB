from datetime import datetime, timedelta
from typing import Optional, List
import os
import tempfile
import io
import random
import threading
import time
import json
import subprocess
import shutil
import traceback
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, status, File, UploadFile, Form
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
import bcrypt
from jose import JWTError, jwt

# ChatterBox AI imports
import torch
import torchaudio as ta
import numpy as np
import librosa
import sounddevice as sd
from moviepy import VideoFileClip, AudioFileClip, AudioClip, concatenate_audioclips
import cv2

# Import ChatterBox models (these need to be installed separately)
try:
    from chatterbox.tts import ChatterboxTTS
    from chatterbox.vc import ChatterboxVC
    CHATTERBOX_AVAILABLE = True
except ImportError:
    CHATTERBOX_AVAILABLE = False
    print("Warning: ChatterBox models not available. Install chatterbox package to enable AI features.")

# Database setup
DATABASE_URL = "sqlite:///./users.db"
Base = declarative_base()
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# JWT settings
SECRET_KEY = "your-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours

# Global model instances - will be loaded on demand
tts_model = None
vc_model = None
current_device = "cpu"
model_load_time = None

# Device management functions
def get_available_devices():
    """Get list of available devices"""
    devices = ["cpu"]
    if torch.cuda.is_available():
        devices.append("cuda")
    if torch.backends.mps.is_available():
        devices.append("mps")
    return devices

def get_default_device():
    """Get the default best available device"""
    if torch.cuda.is_available():
        return "cuda"
    elif torch.backends.mps.is_available():
        return "mps"
    else:
        return "cpu"

def load_models(device: str = None):
    """Load ChatterBox models with specified device"""
    global tts_model, vc_model, current_device, model_load_time
    
    if not CHATTERBOX_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="ChatterBox models are not available. Please install the chatterbox package."
        )
    
    if device is None:
        device = get_default_device()
    
    try:
        # Only reload if device changed or models not loaded
        if current_device != device or tts_model is None or vc_model is None:
            print(f"Loading models on {device}...")
            tts_model = ChatterboxTTS.from_pretrained(device=device)
            vc_model = ChatterboxVC.from_pretrained(device=device)
            current_device = device
            model_load_time = time.time()
            print(f"Models loaded successfully on {device}")
        
        return True
    except Exception as e:
        print(f"Error loading models: {str(e)}")
        return False

def unload_models():
    """Unload models to free VRAM"""
    global tts_model, vc_model, model_load_time
    
    if tts_model is not None:
        del tts_model
        tts_model = None
    
    if vc_model is not None:
        del vc_model
        vc_model = None
    
    model_load_time = None
    
    # Force garbage collection to free GPU memory
    import gc
    gc.collect()
    
    # Clear CUDA cache if available
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass
    
    print("Models unloaded and VRAM freed")

def ensure_tts_model_loaded(device: str = None):
    """Ensure TTS model is loaded before use"""
    global tts_model
    
    if tts_model is None:
        success = load_models(device)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to load TTS model")
    
    return tts_model

def ensure_vc_model_loaded(device: str = None):
    """Ensure VC model is loaded before use"""
    global vc_model
    
    if vc_model is None:
        success = load_models(device)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to load VC model")
    
    return vc_model

def auto_unload_models_after_delay(delay_minutes: int = 5):
    """Auto-unload models after specified delay to free VRAM"""
    global model_load_time
    
    def unload_after_delay():
        time.sleep(delay_minutes * 60)  # Convert to seconds
        
        # Check if models are still idle
        if model_load_time and (time.time() - model_load_time) >= (delay_minutes * 60):
            unload_models()
    
    # Start background thread to unload models
    import threading
    threading.Thread(target=unload_after_delay, daemon=True).start()

def set_seed(seed: int):
    """Set random seed for reproducibility"""
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    random.seed(seed)
    np.random.seed(seed)

def safe_file_cleanup(file_path, max_retries=3, delay=0.1):
    """Safely delete a file with retries to handle file locking issues"""
    for attempt in range(max_retries):
        try:
            if os.path.exists(file_path):
                time.sleep(delay)
                os.unlink(file_path)
            return True
        except (PermissionError, FileNotFoundError):
            if attempt < max_retries - 1:
                time.sleep(delay * (attempt + 1))  # Exponential backoff
                continue
            return False
    return False

def get_audio_duration_seconds(file_path):
    """Get audio duration in seconds"""
    try:
        audio, sr = librosa.load(file_path, sr=None)
        return len(audio) / sr
    except Exception as e:
        print(f"Error getting audio duration: {e}")
        return 0

def validate_audio_file(file_path, max_duration_minutes=10):
    """Validate audio file constraints"""
    if not os.path.exists(file_path):
        return False, "File does not exist"
    
    # Check file size (max 100MB)
    file_size = os.path.getsize(file_path)
    max_size = 100 * 1024 * 1024  # 100MB
    if file_size > max_size:
        return False, f"File too large. Maximum size is {max_size // (1024*1024)}MB"
    
    # Check duration
    duration = get_audio_duration_seconds(file_path)
    if duration > max_duration_minutes * 60:
        return False, f"Audio too long. Maximum duration is {max_duration_minutes} minutes"
    
    if duration < 1:
        return False, "Audio too short. Minimum duration is 1 second"
    
    return True, "Valid"

def save_voice_sample_file(uploaded_file, user_id, sample_name):
    """Save uploaded voice sample file to user's directory"""
    # Create user voice directory
    voice_dir = Path(f"voice_samples/user_{user_id}")
    voice_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate unique filename
    timestamp = int(time.time())
    file_extension = uploaded_file.filename.split('.')[-1] if '.' in uploaded_file.filename else 'wav'
    safe_name = "".join(c for c in sample_name if c.isalnum() or c in (' ', '-', '_')).rstrip()
    filename = f"{safe_name}_{timestamp}.{file_extension}"
    file_path = voice_dir / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(uploaded_file.file.read())
    
    return str(file_path)

def save_tts_history(db: Session, user_id: int, text: str, audio_file_path: str, 
                    voice_id: Optional[int] = None, voice_name: Optional[str] = None, 
                    settings: Optional[dict] = None):
    """Save TTS generation to history"""
    try:
        # Get file info
        file_size = os.path.getsize(audio_file_path)
        duration = int(get_audio_duration_seconds(audio_file_path))
        
        # Create permanent file path for history
        history_dir = Path(f"tts_history/user_{user_id}")
        history_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        permanent_filename = f"tts_{timestamp}.wav"
        permanent_path = history_dir / permanent_filename
        
        # Copy the temporary file to permanent location
        import shutil
        shutil.copy2(audio_file_path, permanent_path)
        
        # Create history record
        history_record = TTSHistory(
            user_id=user_id,
            text=text,
            voice_id=voice_id,
            voice_name=voice_name or "Default Voice",
            file_path=str(permanent_path),
            file_size=file_size,
            duration=duration,
            settings=json.dumps(settings) if settings else None
        )
        
        db.add(history_record)
        db.commit()
        db.refresh(history_record)
        
        return history_record
        
    except Exception as e:
        print(f"Error saving TTS history: {e}")
        return None

def save_vc_history(db: Session, user_id: int, input_file_path: str, output_file_path: str,
                   voice_id: Optional[int] = None, voice_name: Optional[str] = None,
                   settings: Optional[dict] = None):
    """Save VC generation to history"""
    try:
        # Get file info
        input_file_size = os.path.getsize(input_file_path)
        output_file_size = os.path.getsize(output_file_path)
        input_duration = int(get_audio_duration_seconds(input_file_path))
        output_duration = int(get_audio_duration_seconds(output_file_path))
        
        # Create permanent file paths for history
        history_dir = Path(f"vc_history/user_{user_id}")
        history_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = int(time.time())
        input_filename = f"vc_input_{timestamp}.wav"
        output_filename = f"vc_output_{timestamp}.wav"
        permanent_input_path = history_dir / input_filename
        permanent_output_path = history_dir / output_filename
        
        # Copy files to permanent location
        import shutil
        shutil.copy2(input_file_path, permanent_input_path)
        shutil.copy2(output_file_path, permanent_output_path)
        
        # Create history record
        history_record = VCHistory(
            user_id=user_id,
            voice_id=voice_id,
            voice_name=voice_name or "Default Voice",
            input_file_path=str(permanent_input_path),
            output_file_path=str(permanent_output_path),
            input_file_size=input_file_size,
            output_file_size=output_file_size,
            input_duration=input_duration,
            output_duration=output_duration,
            settings=json.dumps(settings) if settings else None
        )
        
        db.add(history_record)
        db.commit()
        db.refresh(history_record)
        
        return history_record
        
    except Exception as e:
        print(f"Error saving VC history: {e}")
        return None

def split_audio_into_chunks(audio_path: str, chunk_duration_seconds: int = 60, sample_rate: int = 16000):
    """Split audio file into chunks of specified duration"""
    try:
        # Load audio
        audio, sr = librosa.load(audio_path, sr=sample_rate)
        
        # Calculate chunk size in samples
        chunk_size = chunk_duration_seconds * sample_rate
        
        # Split audio into chunks
        chunks = []
        for i in range(0, len(audio), chunk_size):
            chunk = audio[i:i + chunk_size]
            chunks.append(chunk)
        
        return chunks, sr
    except Exception as e:
        print(f"Error splitting audio: {e}")
        return [], sample_rate

def apply_audio_effects(audio_array, sample_rate, pitch_shift=0.0, speed_factor=1.0, volume_factor=1.0):
    """Apply audio effects like pitch shift, speed change, and volume adjustment"""
    try:
        # Apply pitch shift
        if pitch_shift != 0.0:
            audio_array = librosa.effects.pitch_shift(audio_array, sr=sample_rate, n_steps=pitch_shift)
        
        # Apply speed change
        if speed_factor != 1.0:
            audio_array = librosa.effects.time_stretch(audio_array, rate=speed_factor)
        
        # Apply volume adjustment
        if volume_factor != 1.0:
            audio_array = audio_array * volume_factor
            # Prevent clipping
            audio_array = np.clip(audio_array, -1.0, 1.0)
        
        return audio_array
    except Exception as e:
        print(f"Error applying audio effects: {e}")
        return audio_array

def process_audio_chunks(vc_model, chunks, sample_rate, target_voice_path=None, 
                        pitch_shift=0.0, speed_factor=1.0, volume_factor=1.0):
    """Process audio chunks through voice conversion and combine results"""
    converted_chunks = []
    
    for i, chunk in enumerate(chunks):
        try:
            # Save chunk to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                # Convert numpy array to tensor and save
                chunk_tensor = torch.from_numpy(chunk).float().unsqueeze(0)
                ta.save(tmp_file.name, chunk_tensor, sample_rate)
                
                # Process chunk through voice conversion
                converted_wav = vc_model.generate(
                    audio=tmp_file.name,
                    target_voice_path=target_voice_path
                )
                
                # Extract audio data and apply effects
                converted_audio = converted_wav.squeeze(0).numpy()
                converted_audio = apply_audio_effects(
                    converted_audio, sample_rate, pitch_shift, speed_factor, volume_factor
                )
                converted_chunks.append(converted_audio)
                
                # Clean up temporary file
                safe_file_cleanup(tmp_file.name)
                
        except Exception as e:
            print(f"Error processing chunk {i+1}: {e}")
            # If a chunk fails, add silence of the same length
            silence = np.zeros_like(chunk)
            converted_chunks.append(silence)
            continue
    
    # Combine all converted chunks
    if converted_chunks:
        combined_audio = np.concatenate(converted_chunks)
        return torch.from_numpy(combined_audio).unsqueeze(0)
    else:
        return None

# Database Models
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class VoiceSample(Base):
    __tablename__ = "voice_samples"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)  # Foreign key to users
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    file_path = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)  # File size in bytes
    duration = Column(Integer, nullable=False)  # Duration in seconds
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class TTSHistory(Base):
    __tablename__ = "tts_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)  # Foreign key to users
    text = Column(String, nullable=False)  # The text that was converted
    voice_id = Column(Integer, nullable=True)  # Voice sample ID if used, null for default voice
    voice_name = Column(String, nullable=True)  # Voice name for display
    file_path = Column(String, nullable=False)  # Path to generated audio file
    file_size = Column(Integer, nullable=False)  # File size in bytes
    duration = Column(Integer, nullable=False)  # Duration in seconds
    settings = Column(String, nullable=True)  # JSON string of TTS settings used
    created_at = Column(DateTime, default=datetime.utcnow)

class VCHistory(Base):
    __tablename__ = "vc_history"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)  # Foreign key to users
    voice_id = Column(Integer, nullable=True)  # Target voice sample ID if used, null for default voice
    voice_name = Column(String, nullable=True)  # Target voice name for display
    input_file_path = Column(String, nullable=False)  # Path to input audio file
    output_file_path = Column(String, nullable=False)  # Path to converted audio file
    input_file_size = Column(Integer, nullable=False)  # Input file size in bytes
    output_file_size = Column(Integer, nullable=False)  # Output file size in bytes
    input_duration = Column(Integer, nullable=False)  # Input duration in seconds
    output_duration = Column(Integer, nullable=False)  # Output duration in seconds
    settings = Column(String, nullable=True)  # JSON string of VC settings used
    created_at = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

# Pydantic Models
class UserCreate(BaseModel):
    username: str
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    is_active: bool
    created_at: datetime

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# ChatterBox API Models
class DeviceInfo(BaseModel):
    available_devices: List[str]
    current_device: str
    cuda_available: bool
    mps_available: bool
    gpu_name: Optional[str] = None
    gpu_memory: Optional[int] = None

class TTSRequest(BaseModel):
    text: str
    exaggeration: float = 0.5
    temperature: float = 0.8
    cfg_weight: float = 0.5
    min_p: float = 0.05
    top_p: float = 1.0
    repetition_penalty: float = 1.2
    seed: int = 0

class TTSCloneRequest(BaseModel):
    text: str
    exaggeration: float = 0.5
    temperature: float = 0.8
    cfg_weight: float = 0.5
    seed: int = 0

class TTSVoiceRequest(BaseModel):
    text: str
    voice_id: int
    exaggeration: float = 0.5
    temperature: float = 0.8
    cfg_weight: float = 0.5
    min_p: float = 0.05
    top_p: float = 1.0
    repetition_penalty: float = 1.2
    seed: int = 0

class VoiceConversionRequest(BaseModel):
    chunk_duration: int = 60
    enable_chunking: bool = True
    # Audio processing settings
    pitch_shift: float = 0.0  # Semitones (-12 to +12)
    speed_factor: float = 1.0  # Speed multiplier (0.5 to 2.0)
    volume_factor: float = 1.0  # Volume multiplier (0.1 to 2.0)

class DeviceChangeRequest(BaseModel):
    device: str

# Voice Library Models
class VoiceSampleCreate(BaseModel):
    name: str
    description: str = ""

class VoiceSampleResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str
    file_size: int
    duration: int
    created_at: datetime
    updated_at: datetime

class VoiceSampleUpdate(BaseModel):
    name: str = None
    description: str = None

# TTS History Models
class TTSHistoryResponse(BaseModel):
    id: int
    user_id: int
    text: str
    voice_id: Optional[int]
    voice_name: Optional[str]
    file_size: int
    duration: int
    settings: Optional[str]
    created_at: datetime

# Voice Conversion Models
class VoiceConversionWithVoiceRequest(BaseModel):
    voice_id: int
    chunk_duration: int = 60
    enable_chunking: bool = True
    # Audio processing settings
    pitch_shift: float = 0.0  # Semitones (-12 to +12)
    speed_factor: float = 1.0  # Speed multiplier (0.5 to 2.0)
    volume_factor: float = 1.0  # Volume multiplier (0.1 to 2.0)

# VC History Models  
class VCHistoryResponse(BaseModel):
    id: int
    user_id: int
    voice_id: Optional[int]
    voice_name: Optional[str]
    input_file_size: int
    output_file_size: int
    input_duration: int
    output_duration: int
    settings: Optional[str]
    created_at: datetime

# FastAPI app
app = FastAPI(title="Clara Voice Lab API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBearer()

# Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Password utilities
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

# JWT utilities
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_data = TokenData(username=username)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return token_data

def get_current_user(db: Session = Depends(get_db), token_data: TokenData = Depends(verify_token)):
    user = db.query(User).filter(User.username == token_data.username).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user

# ChatterBox API Routes
@app.get("/api/device-info", response_model=DeviceInfo)
def get_device_info():
    """Get information about available devices"""
    available_devices = get_available_devices()
    
    device_info = {
        "available_devices": available_devices,
        "current_device": current_device,
        "cuda_available": torch.cuda.is_available(),
        "mps_available": torch.backends.mps.is_available(),
    }
    
    # Add GPU information if CUDA is available
    if torch.cuda.is_available():
        device_info["gpu_name"] = torch.cuda.get_device_name(0)
        device_info["gpu_memory"] = torch.cuda.get_device_properties(0).total_memory // 1024**3
    
    return device_info

@app.post("/api/set-device")
def set_device(request: DeviceChangeRequest, current_user: User = Depends(get_current_user)):
    """Change the processing device"""
    available_devices = get_available_devices()
    
    if request.device not in available_devices:
        raise HTTPException(
            status_code=400,
            detail=f"Device '{request.device}' not available. Available devices: {available_devices}"
        )
    
    success = load_models(request.device)
    if not success:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to load models on device '{request.device}'"
        )
    
    return {"message": f"Device changed to {request.device}", "current_device": current_device}

@app.post("/api/tts/default")
def text_to_speech_default(
    request: TTSRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate speech using default voice"""
    
    # Load TTS model on demand
    tts_model = ensure_tts_model_loaded()
    
    try:
        if request.seed != 0:
            set_seed(request.seed)
        
        wav = tts_model.generate(
            request.text,
            exaggeration=request.exaggeration,
            temperature=request.temperature,
            cfg_weight=request.cfg_weight,
            min_p=request.min_p,
            top_p=request.top_p,
            repetition_penalty=request.repetition_penalty
        )
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            ta.save(tmp_file.name, wav, tts_model.sr)
            
            # Save to history
            settings_dict = {
                "exaggeration": request.exaggeration,
                "temperature": request.temperature,
                "cfg_weight": request.cfg_weight,
                "min_p": request.min_p,
                "top_p": request.top_p,
                "repetition_penalty": request.repetition_penalty,
                "seed": request.seed
            }
            save_tts_history(
                db=db,
                user_id=current_user.id,
                text=request.text,
                audio_file_path=tmp_file.name,
                voice_id=None,
                voice_name="Default Voice",
                settings=settings_dict
            )
            
            # Start auto-unload timer
            auto_unload_models_after_delay(5)
            
            return FileResponse(
                tmp_file.name,
                media_type="audio/wav",
                filename="tts_default_voice.wav",
                background=lambda: safe_file_cleanup(tmp_file.name) or None
            )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/api/tts/voice")
def text_to_speech_with_voice(
    request: TTSVoiceRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate speech using a voice from the user's library"""
    
    # Load TTS model on demand
    tts_model = ensure_tts_model_loaded()
    
    # Get the voice sample from database
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == request.voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    # Check if voice file exists
    if not os.path.exists(voice_sample.file_path):
        raise HTTPException(status_code=404, detail="Voice file not found on disk")
    
    try:
        # Set seed if provided
        if request.seed != 0:
            set_seed(request.seed)
        
        # Generate speech with voice cloning
        wav = tts_model.generate(
            request.text,
            audio_prompt_path=voice_sample.file_path,
            exaggeration=request.exaggeration,
            temperature=request.temperature,
            cfg_weight=request.cfg_weight,
            min_p=request.min_p,
            top_p=request.top_p,
            repetition_penalty=request.repetition_penalty
        )
        
        # Save to temporary file for download
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            ta.save(tmp_file.name, wav, tts_model.sr)
            
            # Save to history
            settings_dict = {
                "exaggeration": request.exaggeration,
                "temperature": request.temperature,
                "cfg_weight": request.cfg_weight,
                "min_p": request.min_p,
                "top_p": request.top_p,
                "repetition_penalty": request.repetition_penalty,
                "seed": request.seed
            }
            save_tts_history(
                db=db,
                user_id=current_user.id,
                text=request.text,
                audio_file_path=tmp_file.name,
                voice_id=voice_sample.id,
                voice_name=voice_sample.name,
                settings=settings_dict
            )
            
            # Start auto-unload timer
            auto_unload_models_after_delay(5)
            
            # Return audio file
            return FileResponse(
                tmp_file.name,
                media_type="audio/wav",
                filename=f"tts_voice_{voice_sample.name}.wav",
                background=lambda: safe_file_cleanup(tmp_file.name) or None
            )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")

@app.post("/api/tts/clone")
def text_to_speech_clone(
    request: TTSCloneRequest = Form(),
    reference_audio: UploadFile = File(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Generate speech using voice cloning"""
    
    # Load TTS model on demand
    tts_model = ensure_tts_model_loaded()
    
    # Save uploaded reference audio
    reference_audio_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_ref:
            tmp_ref.write(reference_audio.file.read())
            reference_audio_path = tmp_ref.name
        
        if request.seed != 0:
            set_seed(request.seed)
        
        wav = tts_model.generate(
            request.text,
            audio_prompt_path=reference_audio_path,
            exaggeration=request.exaggeration,
            temperature=request.temperature,
            cfg_weight=request.cfg_weight
        )
        
        # Save generated audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            ta.save(tmp_file.name, wav, tts_model.sr)
            
            # Save to history
            settings_dict = {
                "exaggeration": request.exaggeration,
                "temperature": request.temperature,
                "cfg_weight": request.cfg_weight,
                "seed": request.seed
            }
            save_tts_history(
                db=db,
                user_id=current_user.id,
                text=request.text,
                audio_file_path=tmp_file.name,
                voice_id=None,
                voice_name="Cloned Voice",
                settings=settings_dict
            )
            
            # Start auto-unload timer
            auto_unload_models_after_delay(5)
            
            return FileResponse(
                tmp_file.name,
                media_type="audio/wav",
                filename="tts_cloned_voice.wav",
                background=lambda: (
                    safe_file_cleanup(tmp_file.name),
                    safe_file_cleanup(reference_audio_path) if reference_audio_path else None
                ) and None
            )
    
    except Exception as e:
        # Cleanup on error
        if reference_audio_path:
            safe_file_cleanup(reference_audio_path)
        raise HTTPException(status_code=500, detail=f"Voice cloning failed: {str(e)}")

@app.post("/api/unload-models")
def manual_unload_models(current_user: User = Depends(get_current_user)):
    """Manually unload models to free VRAM"""
    try:
        unload_models()
        return {"message": "Models unloaded successfully", "vram_freed": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to unload models: {str(e)}")

@app.get("/api/model-status")
def get_model_status():
    """Get current model loading status"""
    global tts_model, vc_model, model_load_time
    
    tts_loaded = tts_model is not None
    vc_loaded = vc_model is not None
    
    status = {
        "tts_model_loaded": tts_loaded,
        "vc_model_loaded": vc_loaded,
        "both_models_loaded": tts_loaded and vc_loaded,
        "current_device": current_device,
        "load_time": model_load_time,
        "idle_time": (time.time() - model_load_time) if model_load_time else None
    }
    
    return status

@app.post("/api/voice-conversion/with-voice")
def voice_conversion_with_voice(
    voice_id: int = Form(),
    chunk_duration: int = Form(60),
    enable_chunking: bool = Form(True),
    pitch_shift: float = Form(0.0),
    speed_factor: float = Form(1.0),
    volume_factor: float = Form(1.0),
    input_audio: UploadFile = File(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convert voice using a voice from the user's library"""
    global vc_model
    
    if vc_model is None:
        success = load_models()
        if not success:
            raise HTTPException(status_code=503, detail="VC model not available")
    
    # Get the target voice sample from database
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    # Check if voice file exists
    if not os.path.exists(voice_sample.file_path):
        raise HTTPException(status_code=404, detail="Voice file not found on disk")
    
    input_audio_path = None
    try:
        # Save input audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_input:
            tmp_input.write(input_audio.file.read())
            input_audio_path = tmp_input.name
        
        # Get audio duration to determine processing method
        audio_duration = get_audio_duration_seconds(input_audio_path)
        use_chunking = enable_chunking and audio_duration > chunk_duration
        
        if use_chunking:
            # Split audio into chunks for long audio
            chunks, sample_rate = split_audio_into_chunks(
                input_audio_path, 
                chunk_duration_seconds=chunk_duration
            )
            
            if chunks:
                # Process chunks
                wav = process_audio_chunks(
                    vc_model, 
                    chunks, 
                    sample_rate, 
                    target_voice_path=voice_sample.file_path,
                    pitch_shift=pitch_shift,
                    speed_factor=speed_factor,
                    volume_factor=volume_factor
                )
                
                if wav is None:
                    raise HTTPException(status_code=500, detail="Chunked processing failed")
            else:
                raise HTTPException(status_code=500, detail="Failed to split audio into chunks")
        else:
            # Standard processing for short audio
            wav = vc_model.generate(
                audio=input_audio_path,
                target_voice_path=voice_sample.file_path
            )
            
            # Apply audio effects to the result
            converted_audio = wav.squeeze(0).numpy()
            converted_audio = apply_audio_effects(
                converted_audio, vc_model.sr, 
                pitch_shift, speed_factor, volume_factor
            )
            wav = torch.from_numpy(converted_audio).unsqueeze(0)
        
        # Save converted audio to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            ta.save(tmp_file.name, wav, vc_model.sr)
            
            # Save to history
            settings_dict = {
                "chunk_duration": chunk_duration,
                "enable_chunking": enable_chunking,
                "used_chunking": use_chunking,
                "audio_duration": audio_duration,
                "pitch_shift": pitch_shift,
                "speed_factor": speed_factor,
                "volume_factor": volume_factor
            }
            save_vc_history(
                db=db,
                user_id=current_user.id,
                input_file_path=input_audio_path,
                output_file_path=tmp_file.name,
                voice_id=voice_sample.id,
                voice_name=voice_sample.name,
                settings=settings_dict
            )
            
            # Return converted audio file
            return FileResponse(
                tmp_file.name,
                media_type="audio/wav",
                filename=f"vc_{voice_sample.name}_{int(time.time())}.wav",
                background=lambda: (
                    safe_file_cleanup(tmp_file.name),
                    safe_file_cleanup(input_audio_path) if input_audio_path else None
                ) and None
            )
    
    except Exception as e:
        # Cleanup on error
        if input_audio_path:
            safe_file_cleanup(input_audio_path)
        raise HTTPException(status_code=500, detail=f"Voice conversion failed: {str(e)}")

@app.post("/api/voice-conversion")
def voice_conversion(
    chunk_duration: int = Form(60),
    enable_chunking: bool = Form(True),
    pitch_shift: float = Form(0.0),
    speed_factor: float = Form(1.0),
    volume_factor: float = Form(1.0),
    input_audio: UploadFile = File(),
    target_audio: UploadFile = File(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convert voice using uploaded audio"""
    global vc_model
    
    if vc_model is None:
        success = load_models()
        if not success:
            raise HTTPException(status_code=500, detail="Failed to load VC model")
    
    input_audio_path = None
    target_audio_path = None
    
    try:
        # Save input audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_input:
            tmp_input.write(input_audio.file.read())
            input_audio_path = tmp_input.name
        
        # Save target audio if provided
        if target_audio:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_target:
                tmp_target.write(target_audio.file.read())
                target_audio_path = tmp_target.name
        
        # Process voice conversion
        wav = vc_model.generate(
            audio=input_audio_path,
            target_voice_path=target_audio_path
        )
        
        # Apply audio effects to the result
        converted_audio = wav.squeeze(0).numpy()
        converted_audio = apply_audio_effects(
            converted_audio, vc_model.sr,
            pitch_shift, speed_factor, volume_factor
        )
        wav = torch.from_numpy(converted_audio).unsqueeze(0)
        
        # Save converted audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            ta.save(tmp_file.name, wav, vc_model.sr)
            
            # Save to history
            settings_dict = {
                "chunk_duration": chunk_duration,
                "enable_chunking": enable_chunking,
                "pitch_shift": pitch_shift,
                "speed_factor": speed_factor,
                "volume_factor": volume_factor
            }
            save_vc_history(
                db=db,
                user_id=current_user.id,
                input_file_path=input_audio_path,
                output_file_path=tmp_file.name,
                voice_id=None,
                voice_name="Default Voice" if not target_audio_path else "Custom Voice",
                settings=settings_dict
            )
            
            return FileResponse(
                tmp_file.name,
                media_type="audio/wav",
                filename="voice_converted.wav",
                background=lambda: (
                    safe_file_cleanup(tmp_file.name),
                    safe_file_cleanup(input_audio_path) if input_audio_path else None,
                    safe_file_cleanup(target_audio_path) if target_audio_path else None
                ) and None
            )
    
    except Exception as e:
        # Cleanup on error
        if input_audio_path:
            safe_file_cleanup(input_audio_path)
        if target_audio_path:
            safe_file_cleanup(target_audio_path)
        raise HTTPException(status_code=500, detail=f"Voice conversion failed: {str(e)}")

@app.post("/api/video-conversion")
def video_voice_conversion(
    voice_id: int = Form(),
    pitch_shift: float = Form(0.0),
    speed_factor: float = Form(1.0),
    volume_factor: float = Form(1.0),
    chunk_duration: int = Form(60),
    enable_chunking: bool = Form(True),
    video: UploadFile = File(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Convert voice in video using a voice from the user's library"""
    global vc_model
    
    if vc_model is None:
        success = load_models()
        if not success:
            raise HTTPException(status_code=503, detail="VC model not available")
    
    # Get the target voice sample from database
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    # Check if voice file exists
    if not os.path.exists(voice_sample.file_path):
        raise HTTPException(status_code=404, detail="Voice file not found on disk")

    video_path = None
    audio_path = None
    converted_audio_path = None
    final_video_path = None
    
    try:
        # Determine the correct file extension based on content type
        file_extension = ".mp4"  # default
        content_type = video.content_type
        if content_type:
            if "webm" in content_type.lower():
                file_extension = ".webm"
            elif "avi" in content_type.lower():
                file_extension = ".avi"
            elif "mov" in content_type.lower():
                file_extension = ".mov"
            elif "mkv" in content_type.lower():
                file_extension = ".mkv"
        
        # Also check filename extension as fallback
        if video.filename:
            filename_ext = Path(video.filename).suffix.lower()
            if filename_ext in ['.webm', '.avi', '.mov', '.mkv', '.mp4']:
                file_extension = filename_ext
        
        # Save uploaded video with correct extension
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as tmp_video:
            tmp_video.write(video.file.read())
            video_path = tmp_video.name
        
        # Handle WebM files with special care
        if file_extension == ".webm":
            try:
                # Try to get basic video info without full parsing
                import subprocess
                import json
                
                # Use ffprobe to get video info more reliably
                cmd = [
                    'ffprobe', '-v', 'quiet', '-print_format', 'json',
                    '-show_format', '-show_streams', video_path
                ]
                result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
                
                if result.returncode == 0:
                    info = json.loads(result.stdout)
                    # Extract duration from format or streams
                    duration = None
                    if 'format' in info and 'duration' in info['format']:
                        duration = float(info['format']['duration'])
                    
                    # If still no duration, estimate from file size and bitrate
                    if duration is None or duration <= 0:
                        print("Warning: Could not determine video duration, using estimated duration")
                        # Use a reasonable default or estimate
                        duration = 60  # Default to 60 seconds if we can't determine
                else:
                    print(f"ffprobe failed: {result.stderr}")
                    duration = 60  # Fallback duration
                    
            except Exception as probe_error:
                print(f"Error probing WebM file: {probe_error}")
                duration = 60  # Fallback duration
        
        # Extract audio from video with better error handling
        try:
            video_clip = VideoFileClip(video_path)
            if video_clip.audio is None:
                video_clip.close()
                raise HTTPException(status_code=400, detail="Video has no audio track")
            
            video_duration = video_clip.duration
            
            # If duration is still None or invalid, use our estimated duration for WebM
            if (video_duration is None or video_duration <= 0) and file_extension == ".webm":
                video_duration = duration  # Use our estimated duration
                
        except Exception as video_error:
            # If VideoFileClip fails completely, try alternative approach
            if file_extension == ".webm":
                raise HTTPException(
                    status_code=400, 
                    detail="WebM video format is not fully supported. Please convert to MP4 format and try again."
                )
            else:
                raise HTTPException(status_code=500, detail=f"Failed to process video: {str(video_error)}")
        
        # Save extracted audio with better error handling
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_audio:
            try:
                video_clip.audio.write_audiofile(tmp_audio.name, logger=None)
                audio_path = tmp_audio.name
            except Exception as audio_error:
                video_clip.close()
                raise HTTPException(status_code=500, detail=f"Failed to extract audio: {str(audio_error)}")
        
        video_clip.close()
        
        # Get audio duration to determine processing method
        audio_duration = get_audio_duration_seconds(audio_path)
        use_chunking = enable_chunking and audio_duration > chunk_duration
        
        if use_chunking:
            # Split audio into chunks for long audio
            chunks, sample_rate = split_audio_into_chunks(
                audio_path, 
                chunk_duration_seconds=chunk_duration
            )
            
            if chunks:
                # Process chunks
                wav = process_audio_chunks(
                    vc_model, 
                    chunks, 
                    sample_rate, 
                    target_voice_path=voice_sample.file_path,
                    pitch_shift=pitch_shift,
                    speed_factor=speed_factor,
                    volume_factor=volume_factor
                )
                
                if wav is None:
                    raise HTTPException(status_code=500, detail="Chunked processing failed")
            else:
                raise HTTPException(status_code=500, detail="Failed to split audio into chunks")
        else:
            # Standard processing for short audio
            wav = vc_model.generate(
                audio=audio_path,
                target_voice_path=voice_sample.file_path
            )
            
            # Apply audio effects to the result
            converted_audio = wav.squeeze(0).numpy()
            converted_audio = apply_audio_effects(
                converted_audio, vc_model.sr,
                pitch_shift, speed_factor, volume_factor
            )
            wav = torch.from_numpy(converted_audio).unsqueeze(0)
        
        # Save converted audio
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_converted:
            ta.save(tmp_converted.name, wav, vc_model.sr)
            converted_audio_path = tmp_converted.name
        
        # Combine converted audio with original video
        try:
            video_clip = VideoFileClip(video_path)
            converted_audio_clip = AudioFileClip(converted_audio_path)
            
            # Ensure audio matches video duration
            if converted_audio_clip.duration > video_duration:
                converted_audio_clip = converted_audio_clip.subclipped(0, video_duration)
            elif converted_audio_clip.duration < video_duration:
                # Pad with silence if needed
                silence_duration = video_duration - converted_audio_clip.duration
                silence_clip = AudioClip(lambda t: [0, 0], duration=silence_duration)
                converted_audio_clip = concatenate_audioclips([converted_audio_clip, silence_clip])
            
            # Create final video with converted audio
            final_video_clip = video_clip.with_audio(converted_audio_clip)
            
            # Save final video
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_final:
                final_video_clip.write_videofile(
                    tmp_final.name,
                    codec='libx264',
                    audio_codec='aac',
                    logger=None
                )
                final_video_path = tmp_final.name
            
            # Close clips
            video_clip.close()
            converted_audio_clip.close()
            final_video_clip.close()
            
        except Exception as video_error:
            raise HTTPException(status_code=500, detail=f"Failed to combine video and audio: {str(video_error)}")
        
        # Return the converted video file
        return FileResponse(
            final_video_path,
            media_type="video/mp4",
            filename=f"converted_video_{int(time.time())}.mp4"
        )
        
    except Exception as e:
        print(f"Video conversion error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        
        # Cleanup on error
        for path in [video_path, audio_path, converted_audio_path, final_video_path]:
            if path and os.path.exists(path):
                safe_file_cleanup(path)
        raise HTTPException(status_code=500, detail=f"Video conversion failed: {str(e)}")
    
    finally:
        # Cleanup temporary files
        for path in [video_path, audio_path, converted_audio_path]:
            if path and os.path.exists(path):
                safe_file_cleanup(path)

@app.post("/api/test-video-upload")
def test_video_upload(
    video: UploadFile = File(),
    current_user: User = Depends(get_current_user)
):
    """Test video upload and basic processing"""
    try:
        # Save uploaded video
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_video:
            tmp_video.write(video.file.read())
            video_path = tmp_video.name
        
        # Try to open video with moviepy
        video_clip = VideoFileClip(video_path)
        
        video_info = {
            "filename": video.filename,
            "duration": video_clip.duration,
            "fps": video_clip.fps,
            "size": video_clip.size,
            "has_audio": video_clip.audio is not None
        }
        
        video_clip.close()
        
        # Cleanup
        if os.path.exists(video_path):
            os.unlink(video_path)
            
        return {"status": "success", "video_info": video_info}
        
    except Exception as e:
        print(f"Test video upload error: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"status": "error", "error": str(e)}

@app.get("/api/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "chatterbox_available": CHATTERBOX_AVAILABLE,
        "models_loaded": tts_model is not None and vc_model is not None,
        "current_device": current_device
    }

# Voice Library API Routes
@app.post("/api/voices", response_model=VoiceSampleResponse)
def add_voice_sample(
    name: str = Form(),
    description: str = Form(""),
    audio_file: UploadFile = File(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new voice sample to user's library"""
    
    # Validate file type
    allowed_extensions = ['.wav', '.mp3', '.m4a', '.flac', '.ogg']
    file_ext = Path(audio_file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )
    
    # Save uploaded file temporarily for validation
    temp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
            temp_file.write(audio_file.file.read())
            temp_file_path = temp_file.name
        
        # Validate audio file
        is_valid, error_message = validate_audio_file(temp_file_path)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_message)
        
        # Get file info
        file_size = os.path.getsize(temp_file_path)
        duration = int(get_audio_duration_seconds(temp_file_path))
        
        # Save to permanent location
        # Reset file pointer for saving
        audio_file.file.seek(0)
        permanent_path = save_voice_sample_file(audio_file, current_user.id, name)
        
        # Create database record
        voice_sample = VoiceSample(
            user_id=current_user.id,
            name=name,
            description=description,
            file_path=permanent_path,
            file_size=file_size,
            duration=duration
        )
        
        db.add(voice_sample)
        db.commit()
        db.refresh(voice_sample)
        
        return voice_sample
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save voice sample: {str(e)}")
    finally:
        # Cleanup temporary file
        if temp_file_path:
            safe_file_cleanup(temp_file_path)

@app.get("/api/voices", response_model=List[VoiceSampleResponse])
def list_voice_samples(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all voice samples for the current user"""
    voice_samples = db.query(VoiceSample).filter(
        VoiceSample.user_id == current_user.id
    ).order_by(VoiceSample.created_at.desc()).all()
    
    return voice_samples

@app.get("/api/voices/{voice_id}", response_model=VoiceSampleResponse)
def get_voice_sample(
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific voice sample"""
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    return voice_sample

@app.get("/api/voices/{voice_id}/download")
def download_voice_sample(
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a voice sample file"""
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    if not os.path.exists(voice_sample.file_path):
        raise HTTPException(status_code=404, detail="Voice sample file not found")
    
    return FileResponse(
        voice_sample.file_path,
        media_type="audio/wav",
        filename=f"{voice_sample.name}.wav"
    )

@app.put("/api/voices/{voice_id}", response_model=VoiceSampleResponse)
def update_voice_sample(
    voice_id: int,
    update_data: VoiceSampleUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update voice sample metadata"""
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    # Update fields
    if update_data.name is not None:
        voice_sample.name = update_data.name
    if update_data.description is not None:
        voice_sample.description = update_data.description
    
    voice_sample.updated_at = datetime.utcnow()
    
    db.commit()
    db.refresh(voice_sample)
    
    return voice_sample

@app.delete("/api/voices/{voice_id}")
def delete_voice_sample(
    voice_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a voice sample"""
    voice_sample = db.query(VoiceSample).filter(
        VoiceSample.id == voice_id,
        VoiceSample.user_id == current_user.id
    ).first()
    
    if not voice_sample:
        raise HTTPException(status_code=404, detail="Voice sample not found")
    
    # Delete file
    if os.path.exists(voice_sample.file_path):
        safe_file_cleanup(voice_sample.file_path)
    
    # Delete database record
    db.delete(voice_sample)
    db.commit()
    
    return {"message": "Voice sample deleted successfully"}

# TTS History API Routes
@app.get("/api/tts/history", response_model=List[TTSHistoryResponse])
def get_tts_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """Get TTS generation history for the current user"""
    history_records = db.query(TTSHistory).filter(
        TTSHistory.user_id == current_user.id
    ).order_by(TTSHistory.created_at.desc()).limit(limit).all()
    
    return history_records

@app.get("/api/tts/history/{history_id}")
def download_tts_history(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a TTS history file"""
    history_record = db.query(TTSHistory).filter(
        TTSHistory.id == history_id,
        TTSHistory.user_id == current_user.id
    ).first()
    
    if not history_record:
        raise HTTPException(status_code=404, detail="TTS history record not found")
    
    if not os.path.exists(history_record.file_path):
        raise HTTPException(status_code=404, detail="TTS history file not found")
    
    return FileResponse(
        history_record.file_path,
        media_type="audio/wav",
        filename=f"tts_history_{history_record.id}.wav"
    )

@app.delete("/api/tts/history/{history_id}")
def delete_tts_history(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a TTS history record"""
    history_record = db.query(TTSHistory).filter(
        TTSHistory.id == history_id,
        TTSHistory.user_id == current_user.id
    ).first()
    
    if not history_record:
        raise HTTPException(status_code=404, detail="TTS history record not found")
    
    # Delete file
    if os.path.exists(history_record.file_path):
        safe_file_cleanup(history_record.file_path)
    
    # Delete database record
    db.delete(history_record)
    db.commit()
    
    return {"message": "TTS history deleted successfully"}

@app.delete("/api/tts/history")
def clear_tts_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all TTS history for the current user"""
    history_records = db.query(TTSHistory).filter(
        TTSHistory.user_id == current_user.id
    ).all()
    
    # Delete all files
    for record in history_records:
        if os.path.exists(record.file_path):
            safe_file_cleanup(record.file_path)
    
    # Delete all database records
    db.query(TTSHistory).filter(TTSHistory.user_id == current_user.id).delete()
    db.commit()
    
    return {"message": "All TTS history cleared successfully"}

# VC History API Routes
@app.get("/api/vc/history", response_model=List[VCHistoryResponse])
def get_vc_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    limit: int = 50
):
    """Get VC generation history for the current user"""
    history_records = db.query(VCHistory).filter(
        VCHistory.user_id == current_user.id
    ).order_by(VCHistory.created_at.desc()).limit(limit).all()
    
    return history_records

@app.get("/api/vc/history/{history_id}/input")
def download_vc_history_input(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a VC history input file"""
    history_record = db.query(VCHistory).filter(
        VCHistory.id == history_id,
        VCHistory.user_id == current_user.id
    ).first()
    
    if not history_record:
        raise HTTPException(status_code=404, detail="VC history record not found")
    
    if not os.path.exists(history_record.input_file_path):
        raise HTTPException(status_code=404, detail="VC history input file not found")
    
    return FileResponse(
        history_record.input_file_path,
        media_type="audio/wav",
        filename=f"vc_input_{history_record.id}.wav"
    )

@app.get("/api/vc/history/{history_id}/output")
def download_vc_history_output(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Download a VC history output file"""
    history_record = db.query(VCHistory).filter(
        VCHistory.id == history_id,
        VCHistory.user_id == current_user.id
    ).first()
    
    if not history_record:
        raise HTTPException(status_code=404, detail="VC history record not found")
    
    if not os.path.exists(history_record.output_file_path):
        raise HTTPException(status_code=404, detail="VC history output file not found")
    
    return FileResponse(
        history_record.output_file_path,
        media_type="audio/wav",
        filename=f"vc_output_{history_record.id}.wav"
    )

@app.delete("/api/vc/history/{history_id}")
def delete_vc_history(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a VC history record"""
    history_record = db.query(VCHistory).filter(
        VCHistory.id == history_id,
        VCHistory.user_id == current_user.id
    ).first()
    
    if not history_record:
        raise HTTPException(status_code=404, detail="VC history record not found")
    
    # Delete files
    if os.path.exists(history_record.input_file_path):
        safe_file_cleanup(history_record.input_file_path)
    if os.path.exists(history_record.output_file_path):
        safe_file_cleanup(history_record.output_file_path)
    
    # Delete database record
    db.delete(history_record)
    db.commit()
    
    return {"message": "VC history deleted successfully"}

@app.delete("/api/vc/history")
def clear_vc_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Clear all VC history for the current user"""
    history_records = db.query(VCHistory).filter(
        VCHistory.user_id == current_user.id
    ).all()
    
    # Delete all files
    for record in history_records:
        if os.path.exists(record.input_file_path):
            safe_file_cleanup(record.input_file_path)
        if os.path.exists(record.output_file_path):
            safe_file_cleanup(record.output_file_path)
    
    # Delete all database records
    db.query(VCHistory).filter(VCHistory.user_id == current_user.id).delete()
    db.commit()
    
    return {"message": "All VC history cleared successfully"}

# User API Routes
@app.post("/users/signup", response_model=UserResponse)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.username == user_data.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    db_user = User(
        username=user_data.username,
        hashed_password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return db_user

@app.post("/users/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # Authenticate user
    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Create access token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

@app.get("/")
def read_root():
    return {"message": "Clara Voice Lab API", "version": "1.0.0"}

# Startup event - no longer loading models automatically
@app.on_event("startup")
async def startup_event():
    """Initialize Clara Voice Lab API without loading models"""
    print("Initializing Clara Voice Lab API...")
    if CHATTERBOX_AVAILABLE:
        print("ChatterBox models available - will load on demand")
    else:
        print("Warning: ChatterBox models not available")

# Mount static files for frontend (in Docker environment) - MUST BE LAST ROUTE
frontend_path = Path("../frontend")
if frontend_path.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_path / "assets")), name="assets")
    
    # Serve frontend for all non-API routes (this MUST be the LAST route defined)
    @app.get("/{path:path}")
    def serve_frontend(path: str):
        """Serve frontend files for non-API routes"""
        # Exclude all API endpoints from frontend serving
        api_prefixes = ["api/", "users/", "docs", "openapi.json", "redoc"]
        if any(path.startswith(prefix) for prefix in api_prefixes):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        return FileResponse(str(frontend_path / "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
