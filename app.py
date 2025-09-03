import streamlit as st
import torch
import torchaudio as ta
import numpy as np
import tempfile
import io
import os
import random
from pathlib import Path
import sounddevice as sd
import time
import threading
import librosa
from audio_recorder_streamlit import audio_recorder
from moviepy import VideoFileClip, AudioFileClip, AudioClip, concatenate_audioclips
import cv2

# Import ChatterBox models
from chatterbox.tts import ChatterboxTTS
from chatterbox.vc import ChatterboxVC

# Utility function for safe file cleanup
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

# Page configuration
st.set_page_config(
    page_title="ChatterBox - AI Voice Suite",
    page_icon="🎭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better styling
st.markdown("""
<style>
    .main-header {
        font-size: 3rem;
        color: #FF6B6B;
        text-align: center;
        margin-bottom: 2rem;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
    }
    .feature-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1.5rem;
        border-radius: 10px;
        margin: 1rem 0;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .success-box {
        background-color: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }
    .warning-box {
        background-color: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }
    .error-box {
        background-color: #f8d7da;
        border: 1px solid #f5c6cb;
        color: #721c24;
        padding: 1rem;
        border-radius: 5px;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

# Initialize session state
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

@st.cache_resource
def load_tts_model(device):
    """Load TTS model with specified device"""
    try:
        model = ChatterboxTTS.from_pretrained(device=device)
        return model, None
    except Exception as e:
        return None, str(e)

@st.cache_resource
def load_vc_model(device):
    """Load Voice Conversion model with specified device"""
    try:
        model = ChatterboxVC.from_pretrained(device=device)
        return model, None
    except Exception as e:
        return None, str(e)

def set_seed(seed: int):
    """Set random seed for reproducibility"""
    torch.manual_seed(seed)
    torch.cuda.manual_seed(seed)
    torch.cuda.manual_seed_all(seed)
    random.seed(seed)
    np.random.seed(seed)

def save_uploaded_file(uploaded_file):
    """Save uploaded file to temporary location and return path"""
    if uploaded_file is not None:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
            tmp_file.write(uploaded_file.getvalue())
            return tmp_file.name
    return None

def save_recorded_audio(audio_bytes):
    """Save recorded audio bytes to temporary file"""
    if audio_bytes:
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                tmp_file.write(audio_bytes)
                return tmp_file.name
        except Exception as e:
            st.error(f"Error saving recorded audio: {str(e)}")
            return None
    return None

def split_audio_into_chunks(audio_path, chunk_duration_seconds=60, sample_rate=16000):
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
        st.error(f"Error splitting audio: {str(e)}")
        return [], sample_rate

def process_audio_chunks(vc_model, chunks, sample_rate, target_voice_path=None):
    """Process audio chunks through voice conversion and combine results"""
    converted_chunks = []
    
    progress_bar = st.progress(0)
    status_text = st.empty()
    
    for i, chunk in enumerate(chunks):
        try:
            status_text.text(f"Processing chunk {i+1}/{len(chunks)}...")
            progress_bar.progress((i + 1) / len(chunks))
            
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
                
                # Extract audio data
                converted_audio = converted_wav.squeeze(0).numpy()
                converted_chunks.append(converted_audio)
                
                # Clean up temporary file with better error handling
                safe_file_cleanup(tmp_file.name)
                
        except Exception as e:
            st.error(f"Error processing chunk {i+1}: {str(e)}")
            # Clean up temp file even on error
            if 'tmp_file' in locals():
                safe_file_cleanup(tmp_file.name)
            # If a chunk fails, add silence of the same length
            silence = np.zeros_like(chunk)
            converted_chunks.append(silence)
            continue
    
    # Combine all converted chunks
    if converted_chunks:
        combined_audio = np.concatenate(converted_chunks)
        progress_bar.progress(1.0)
        status_text.text("✅ All chunks processed and combined!")
        return torch.from_numpy(combined_audio).unsqueeze(0)
    else:
        status_text.text("❌ No chunks were successfully processed")
        return None

def get_audio_duration(audio_path):
    """Get duration of audio file in seconds"""
    try:
        audio, sr = librosa.load(audio_path, sr=None)
        duration = len(audio) / sr
        return duration
    except:
        return 0

def extract_audio_from_video(video_path):
    """Extract audio from video file"""
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_audio:
            video = VideoFileClip(video_path)
            audio = video.audio
            if audio is not None:
                audio.write_audiofile(tmp_audio.name, logger=None)
                audio.close()
            video.close()
            return tmp_audio.name, video.duration
    except Exception as e:
        st.error(f"Error extracting audio from video: {str(e)}")
        return None, 0

def get_video_info(video_path):
    """Get video information"""
    try:
        video = VideoFileClip(video_path)
        info = {
            'duration': video.duration,
            'fps': video.fps,
            'size': video.size,
            'has_audio': video.audio is not None
        }
        video.close()
        return info
    except Exception as e:
        st.error(f"Error getting video info: {str(e)}")
        return None

def process_video_chunks_with_preview(vc_model, video_path, audio_chunks, target_voice_path=None):
    """Process video chunks with live preview"""
    try:
        # Load the original video
        video = VideoFileClip(video_path)
        original_audio = video.audio
        
        if original_audio is None:
            st.error("Video has no audio track")
            return None
        
        # Get video properties
        fps = video.fps
        duration = video.duration
        
        converted_chunks = []
        preview_container = st.container()
        progress_bar = st.progress(0)
        status_text = st.empty()
        
        # Process each chunk
        for i, chunk in enumerate(audio_chunks):
            try:
                status_text.text(f"Processing chunk {i+1}/{len(audio_chunks)}...")
                progress_bar.progress((i + 1) / len(audio_chunks))
                
                # Save chunk to temporary file
                with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                    chunk_tensor = torch.from_numpy(chunk).float().unsqueeze(0)
                    ta.save(tmp_file.name, chunk_tensor, 16000)
                    
                    # Process chunk through voice conversion
                    converted_wav = vc_model.generate(
                        audio=tmp_file.name,
                        target_voice_path=target_voice_path
                    )
                    
                    # Extract audio data
                    converted_audio = converted_wav.squeeze(0).numpy()
                    converted_chunks.append(converted_audio)
                    
                    # Clean up temporary file with better error handling
                    safe_file_cleanup(tmp_file.name)
                    
                    # Create preview of processed chunks so far
                    if i == 0 or (i + 1) % 3 == 0:  # Preview every 3 chunks
                        with preview_container:
                            preview_audio = np.concatenate(converted_chunks)
                            st.write(f"**Preview after {i+1} chunks:**")
                            st.audio(preview_audio, sample_rate=vc_model.sr)
                
            except Exception as e:
                st.error(f"Error processing chunk {i+1}: {str(e)}")
                # Clean up temp file even on error
                if 'tmp_file' in locals():
                    safe_file_cleanup(tmp_file.name)
                # Add silence for failed chunk
                silence = np.zeros_like(chunk)
                converted_chunks.append(silence)
                continue
        
        # Combine all converted chunks
        if converted_chunks:
            combined_audio = np.concatenate(converted_chunks)
            
            # Create new audio clip from converted audio
            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_converted:
                converted_tensor = torch.from_numpy(combined_audio).unsqueeze(0)
                ta.save(tmp_converted.name, converted_tensor, vc_model.sr)
                
                # Create new audio clip
                new_audio = AudioFileClip(tmp_converted.name)
                
                # Ensure audio matches video duration
                if new_audio.duration > duration:
                    new_audio = new_audio.subclipped(0, duration)
                elif new_audio.duration < duration:
                    # Pad with silence if needed
                    silence_duration = duration - new_audio.duration
                    silence = AudioClip(lambda t: [0, 0], duration=silence_duration)
                    new_audio = concatenate_audioclips([new_audio, silence])
                
                # Combine video with new audio
                final_video = video.with_audio(new_audio)
                
                # Save final video
                with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp_video:
                    final_video.write_videofile(
                        tmp_video.name, 
                        codec='libx264', 
                        audio_codec='aac',
                        logger=None
                    )
                    
                    # Cleanup with proper file closing
                    new_audio.close()
                    final_video.close()
                    
                    # Safe cleanup of temporary file
                    safe_file_cleanup(tmp_converted.name)
                
                progress_bar.progress(1.0)
                status_text.text("✅ Video processing complete!")
                
                return tmp_video.name
        
        else:
            status_text.text("❌ No chunks were successfully processed")
            return None
            
    except Exception as e:
        st.error(f"Error in video processing: {str(e)}")
        return None
    finally:
        # Cleanup video objects
        if 'video' in locals():
            video.close()
        if 'original_audio' in locals() and original_audio is not None:
            original_audio.close()

def main():
    # Header
    st.markdown('<h1 class="main-header">🎭 ChatterBox AI Voice Suite</h1>', unsafe_allow_html=True)
    
    # Sidebar for device selection and navigation
    st.sidebar.title("⚙️ Settings")
    
    # Device selection
    available_devices = get_available_devices()
    default_device = get_default_device()
    
    device = st.sidebar.selectbox(
        "🖥️ Select Device:",
        options=available_devices,
        index=available_devices.index(default_device) if default_device in available_devices else 0,
        help="Choose the device for AI processing. CUDA is fastest if you have an NVIDIA GPU."
    )
    
    # Device info
    device_info = {
        "cuda": "🚀 NVIDIA GPU (Fastest)",
        "mps": "🍎 Apple Silicon (Optimized)",
        "cpu": "💻 CPU (Universal)"
    }
    st.sidebar.info(f"Using: **{device_info.get(device, device.upper())}**")
    
    # Add device performance tips
    if device == "cuda":
        st.sidebar.success("🚀 Excellent! CUDA will provide the fastest performance.")
        if torch.cuda.is_available():
            gpu_name = torch.cuda.get_device_name(0)
            st.sidebar.info(f"GPU: {gpu_name}")
    elif device == "mps":
        st.sidebar.success("🍎 Great! MPS is optimized for Apple Silicon.")
    elif device == "cpu":
        st.sidebar.warning("💻 CPU mode selected. Processing will be slower but compatible with all systems.")
    
    # Device switching warning
    if 'previous_device' not in st.session_state:
        st.session_state.previous_device = device
    elif st.session_state.previous_device != device:
        st.sidebar.warning("⚠️ Device changed! Models will reload on next operation.")
        st.session_state.previous_device = device
        # Clear model cache to force reload with new device
        load_tts_model.clear()
        load_vc_model.clear()
    
    # Check if this is first run after PyTorch update
    if 'pytorch_checked' not in st.session_state:
        st.session_state.pytorch_checked = True
        # Clear cache to ensure fresh model loading
        load_tts_model.clear()
        load_vc_model.clear()
    
    # Load models with selected device
    loading_msg = f"Loading AI models on {device.upper()}..."
    if device == "cuda":
        loading_msg += " (This should be fast! 🚀)"
    elif device == "mps":
        loading_msg += " (Optimized for Apple Silicon 🍎)"
    else:
        loading_msg += " (This may take a moment... ⏳)"
        
    with st.spinner(loading_msg):
        tts_model, tts_error = load_tts_model(device)
        vc_model, vc_error = load_vc_model(device)
    
    if tts_error:
        st.error(f"Failed to load TTS model: {tts_error}")
    if vc_error:
        st.error(f"Failed to load VC model: {vc_error}")
    
    if not tts_model and not vc_model:
        st.error("No models could be loaded. Please check your installation.")
        return
    
    # Sidebar for navigation
    st.sidebar.title("🎛️ Features")
    feature = st.sidebar.selectbox(
        "Choose a feature:",
        [
            "🎤 Text-to-Speech (Default Voice)",
            "🎭 Text-to-Speech (Voice Cloning)",
            "🔄 Voice Conversion",
            "🎬 Video Voice Conversion",
            "📝 Record & Clone Your Voice",
            "ℹ️ About ChatterBox"
        ]
    )
    
    # Main content area
    if feature == "🎤 Text-to-Speech (Default Voice)":
        text_to_speech_default(tts_model)
    
    elif feature == "🎭 Text-to-Speech (Voice Cloning)":
        text_to_speech_cloning(tts_model)
    
    elif feature == "🔄 Voice Conversion":
        voice_conversion(vc_model)
    
    elif feature == "🎬 Video Voice Conversion":
        video_voice_conversion(vc_model)
    
    elif feature == "📝 Record & Clone Your Voice":
        record_and_clone(tts_model)
    
    elif feature == "ℹ️ About ChatterBox":
        about_page()

def text_to_speech_default(tts_model):
    """Text-to-Speech with built-in default voice"""
    st.markdown('<div class="feature-card"><h2>🎤 Text-to-Speech (Default Voice)</h2><p>Generate speech using the built-in default voice</p></div>', unsafe_allow_html=True)
    
    if not tts_model:
        st.error("TTS model not available")
        return
    
    # Text input
    text = st.text_area(
        "Enter text to synthesize:",
        value="Hello! This is ChatterBox AI voice synthesis. I can convert any text into natural-sounding speech.",
        height=100,
        max_chars=500
    )
    
    # Advanced settings
    with st.expander("🔧 Advanced Settings"):
        col1, col2 = st.columns(2)
        
        with col1:
            exaggeration = st.slider(
                "Exaggeration (Neutral = 0.5)",
                min_value=0.25, max_value=2.0, value=0.5, step=0.05,
                help="Controls voice expressiveness"
            )
            temperature = st.slider(
                "Temperature",
                min_value=0.05, max_value=5.0, value=0.8, step=0.05,
                help="Controls randomness in generation"
            )
            cfg_weight = st.slider(
                "CFG Weight/Pace",
                min_value=0.0, max_value=1.0, value=0.5, step=0.05,
                help="Controls generation pace"
            )
        
        with col2:
            min_p = st.slider(
                "Min P",
                min_value=0.0, max_value=1.0, value=0.05, step=0.01,
                help="Newer sampler parameter"
            )
            top_p = st.slider(
                "Top P",
                min_value=0.0, max_value=1.0, value=1.0, step=0.01,
                help="Original sampler parameter"
            )
            repetition_penalty = st.slider(
                "Repetition Penalty",
                min_value=1.0, max_value=2.0, value=1.2, step=0.1,
                help="Prevents repetitive outputs"
            )
        
        seed = st.number_input(
            "Random Seed (0 for random)",
            min_value=0, max_value=999999, value=0,
            help="For reproducible results"
        )
    
    # Generate button
    if st.button("🎵 Generate Speech", type="primary", use_container_width=True):
        if text.strip():
            try:
                with st.spinner("Generating speech..."):
                    if seed != 0:
                        set_seed(int(seed))
                    
                    wav = tts_model.generate(
                        text,
                        exaggeration=exaggeration,
                        temperature=temperature,
                        cfg_weight=cfg_weight,
                        min_p=min_p,
                        top_p=top_p,
                        repetition_penalty=repetition_penalty
                    )
                    
                    # Convert to audio format for Streamlit
                    audio_array = wav.squeeze(0).numpy()
                    
                    st.markdown('<div class="success-box">✅ Speech generated successfully!</div>', unsafe_allow_html=True)
                    st.audio(audio_array, sample_rate=tts_model.sr)
                    
                    # Download button
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                        ta.save(tmp_file.name, wav, tts_model.sr)
                        with open(tmp_file.name, "rb") as file:
                            st.download_button(
                                label="📥 Download Audio",
                                data=file.read(),
                                file_name="tts_default_voice.wav",
                                mime="audio/wav"
                            )
                        os.unlink(tmp_file.name)
            
            except Exception as e:
                st.markdown(f'<div class="error-box">❌ Error: {str(e)}</div>', unsafe_allow_html=True)
        else:
            st.warning("Please enter some text to synthesize.")

def text_to_speech_cloning(tts_model):
    """Text-to-Speech with voice cloning"""
    st.markdown('<div class="feature-card"><h2>🎭 Text-to-Speech (Voice Cloning)</h2><p>Clone any voice from an audio sample and generate speech</p></div>', unsafe_allow_html=True)
    
    if not tts_model:
        st.error("TTS model not available")
        return
    
    # Text input
    text = st.text_area(
        "Enter text to synthesize:",
        value="This is a demonstration of voice cloning technology. The AI will mimic the voice from your audio sample.",
        height=100,
        max_chars=500
    )
    
    # Audio input options
    st.subheader("🎵 Reference Voice")
    audio_source = st.radio(
        "Choose audio source:",
        ["Upload Audio File", "Record Audio"],
        horizontal=True
    )
    
    reference_audio_path = None
    
    if audio_source == "Upload Audio File":
        uploaded_file = st.file_uploader(
            "Upload reference voice audio (WAV format recommended)",
            type=["wav", "mp3", "m4a", "flac"],
            help="Upload a clear audio sample of the voice you want to clone (3-30 seconds recommended)"
        )
        if uploaded_file:
            reference_audio_path = save_uploaded_file(uploaded_file)
            st.write("**Reference Audio:**")
            st.audio(uploaded_file)
    
    elif audio_source == "Record Audio":
        st.info("🎙️ Record a voice sample to clone (speak clearly for 3-10 seconds)")
        try:
            audio_bytes = audio_recorder(
                text="Click to record",
                recording_color="#e8b62c",
                neutral_color="#6aa36f",
                icon_name="microphone",
                icon_size="2x",
            )
            if audio_bytes:
                reference_audio_path = save_recorded_audio(audio_bytes)
                if reference_audio_path:
                    st.write("**Recorded Reference Audio:**")
                    st.audio(audio_bytes)
        except Exception as e:
            st.error(f"Audio recording failed: {str(e)}")
            st.info("Please try uploading an audio file instead.")
    
    # Advanced settings
    with st.expander("🔧 Advanced Settings"):
        col1, col2 = st.columns(2)
        
        with col1:
            exaggeration = st.slider(
                "Exaggeration",
                min_value=0.25, max_value=2.0, value=0.5, step=0.05
            )
            temperature = st.slider(
                "Temperature",
                min_value=0.05, max_value=5.0, value=0.8, step=0.05
            )
        
        with col2:
            cfg_weight = st.slider(
                "CFG Weight",
                min_value=0.0, max_value=1.0, value=0.5, step=0.05
            )
            seed = st.number_input(
                "Random Seed",
                min_value=0, max_value=999999, value=0
            )
    
    # Generate button
    if st.button("🎭 Clone Voice & Generate", type="primary", use_container_width=True):
        if text.strip() and reference_audio_path:
            try:
                with st.spinner("Cloning voice and generating speech..."):
                    if seed != 0:
                        set_seed(int(seed))
                    
                    wav = tts_model.generate(
                        text,
                        audio_prompt_path=reference_audio_path,
                        exaggeration=exaggeration,
                        temperature=temperature,
                        cfg_weight=cfg_weight
                    )
                    
                    audio_array = wav.squeeze(0).numpy()
                    
                    st.markdown('<div class="success-box">✅ Voice cloned and speech generated successfully!</div>', unsafe_allow_html=True)
                    st.audio(audio_array, sample_rate=tts_model.sr)
                    
                    # Download button
                    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                        ta.save(tmp_file.name, wav, tts_model.sr)
                        with open(tmp_file.name, "rb") as file:
                            st.download_button(
                                label="📥 Download Cloned Voice Audio",
                                data=file.read(),
                                file_name="tts_cloned_voice.wav",
                                mime="audio/wav"
                            )
                        os.unlink(tmp_file.name)
                
                # Cleanup
                if reference_audio_path and os.path.exists(reference_audio_path):
                    os.unlink(reference_audio_path)
            
            except Exception as e:
                st.markdown(f'<div class="error-box">❌ Error: {str(e)}</div>', unsafe_allow_html=True)
        else:
            st.warning("Please provide both text and reference audio.")

def voice_conversion(vc_model):
    """Voice Conversion feature with chunked processing for long audio"""
    st.markdown('<div class="feature-card"><h2>🔄 Voice Conversion</h2><p>Convert your voice to sound like another person</p></div>', unsafe_allow_html=True)
    
    if not vc_model:
        st.error("Voice Conversion model not available")
        return
    
    # Processing settings
    st.subheader("⚙️ Processing Settings")
    col1, col2 = st.columns(2)
    
    with col1:
        chunk_duration = st.slider(
            "Chunk Duration (seconds)",
            min_value=30, max_value=120, value=60, step=10,
            help="Longer chunks may cause CUDA OOM errors, shorter chunks process faster"
        )
    
    with col2:
        enable_chunking = st.checkbox(
            "Enable Chunked Processing",
            value=True,
            help="Automatically split long audio to prevent memory issues"
        )
    
    # Input audio
    st.subheader("🎙️ Input Audio")
    input_source = st.radio(
        "Choose input audio source:",
        ["Upload Audio File", "Record Audio"],
        horizontal=True
    )
    
    input_audio_path = None
    audio_duration = 0
    
    if input_source == "Upload Audio File":
        uploaded_file = st.file_uploader(
            "Upload your audio to convert",
            type=["wav", "mp3", "m4a", "flac"],
            help="Upload clear speech audio"
        )
        if uploaded_file:
            input_audio_path = save_uploaded_file(uploaded_file)
            if input_audio_path:
                audio_duration = get_audio_duration(input_audio_path)
                st.write("**Input Audio:**")
                st.audio(uploaded_file)
                st.info(f"📊 Audio duration: {audio_duration:.1f} seconds")
                
                # Warn about long audio
                if audio_duration > chunk_duration and not enable_chunking:
                    st.warning(f"⚠️ Audio is {audio_duration:.1f}s long. Consider enabling chunked processing to avoid memory issues.")
    
    elif input_source == "Record Audio":
        st.info("🎙️ Record the audio you want to convert")
        try:
            audio_bytes = audio_recorder(
                text="Record input audio",
                recording_color="#e8b62c",
                neutral_color="#6aa36f",
                icon_name="microphone",
                icon_size="2x",
            )
            if audio_bytes:
                input_audio_path = save_recorded_audio(audio_bytes)
                if input_audio_path:
                    audio_duration = get_audio_duration(input_audio_path)
                    st.write("**Recorded Input Audio:**")
                    st.audio(audio_bytes)
                    st.info(f"📊 Audio duration: {audio_duration:.1f} seconds")
        except Exception as e:
            st.error(f"Audio recording failed: {str(e)}")
            st.info("Please try uploading an audio file instead.")
    
    # Target voice
    st.subheader("🎯 Target Voice")
    target_source = st.radio(
        "Choose target voice:",
        ["Use Built-in Voice", "Upload Target Voice", "Record Target Voice"],
        horizontal=True
    )
    
    target_audio_path = None
    
    if target_source == "Upload Target Voice":
        target_file = st.file_uploader(
            "Upload target voice audio",
            type=["wav", "mp3", "m4a", "flac"],
            help="Upload an audio sample of the voice you want to convert to",
            key="target_upload"
        )
        if target_file:
            target_audio_path = save_uploaded_file(target_file)
            if target_audio_path:
                st.write("**Target Voice:**")
                st.audio(target_file)
    
    elif target_source == "Record Target Voice":
        st.info("🎙️ Record a sample of the target voice")
        try:
            target_bytes = audio_recorder(
                text="Record target voice",
                recording_color="#e8b62c",
                neutral_color="#6aa36f",
                icon_name="microphone",
                icon_size="2x",
                key="target_recorder"
            )
            if target_bytes:
                target_audio_path = save_recorded_audio(target_bytes)
                if target_audio_path:
                    st.write("**Recorded Target Voice:**")
                    st.audio(target_bytes)
        except Exception as e:
            st.error(f"Audio recording failed: {str(e)}")
            st.info("Please try uploading an audio file instead.")
    
    # Convert button
    if st.button("🔄 Convert Voice", type="primary", use_container_width=True):
        if input_audio_path:
            try:
                # Determine processing method
                use_chunking = enable_chunking and audio_duration > chunk_duration
                
                if use_chunking:
                    st.info(f"🔄 Processing {audio_duration:.1f}s audio in {chunk_duration}s chunks to prevent memory issues...")
                    
                    # Split audio into chunks
                    chunks, sample_rate = split_audio_into_chunks(
                        input_audio_path, 
                        chunk_duration_seconds=chunk_duration
                    )
                    
                    if chunks:
                        st.info(f"📊 Split into {len(chunks)} chunks for processing")
                        
                        # Process chunks
                        wav = process_audio_chunks(
                            vc_model, 
                            chunks, 
                            sample_rate, 
                            target_voice_path=target_audio_path
                        )
                        
                        if wav is not None:
                            audio_array = wav.squeeze(0).numpy()
                            
                            if target_audio_path:
                                st.markdown('<div class="success-box">✅ Voice converted to target voice successfully using chunked processing!</div>', unsafe_allow_html=True)
                            else:
                                st.markdown('<div class="success-box">✅ Voice converted to built-in voice successfully using chunked processing!</div>', unsafe_allow_html=True)
                            
                            st.audio(audio_array, sample_rate=vc_model.sr)
                            
                            # Download button
                            with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                                ta.save(tmp_file.name, wav, vc_model.sr)
                                with open(tmp_file.name, "rb") as file:
                                    st.download_button(
                                        label="📥 Download Converted Audio",
                                        data=file.read(),
                                        file_name="voice_converted_chunked.wav",
                                        mime="audio/wav"
                                    )
                                os.unlink(tmp_file.name)
                        else:
                            st.error("❌ Chunked processing failed")
                    else:
                        st.error("❌ Failed to split audio into chunks")
                        
                else:
                    # Standard processing for short audio
                    with st.spinner("Converting voice..."):
                        wav = vc_model.generate(
                            audio=input_audio_path,
                            target_voice_path=target_audio_path
                        )
                        
                        audio_array = wav.squeeze(0).numpy()
                        
                        if target_audio_path:
                            st.markdown('<div class="success-box">✅ Voice converted to target voice successfully!</div>', unsafe_allow_html=True)
                        else:
                            st.markdown('<div class="success-box">✅ Voice converted to built-in voice successfully!</div>', unsafe_allow_html=True)
                        
                        st.audio(audio_array, sample_rate=vc_model.sr)
                        
                        # Download button
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                            ta.save(tmp_file.name, wav, vc_model.sr)
                            with open(tmp_file.name, "rb") as file:
                                st.download_button(
                                    label="📥 Download Converted Audio",
                                    data=file.read(),
                                    file_name="voice_converted.wav",
                                    mime="audio/wav"
                                )
                            os.unlink(tmp_file.name)
                
                # Cleanup
                if input_audio_path and os.path.exists(input_audio_path):
                    os.unlink(input_audio_path)
                if target_audio_path and os.path.exists(target_audio_path):
                    os.unlink(target_audio_path)
            
            except Exception as e:
                st.markdown(f'<div class="error-box">❌ Error during voice conversion: {str(e)}</div>', unsafe_allow_html=True)
                st.info("💡 If you're getting memory errors, try:\n• Enabling chunked processing\n• Using shorter chunk duration\n• Switching to CPU processing\n• Using shorter audio files")
        else:
            st.warning("Please provide input audio.")

def video_voice_conversion(vc_model):
    """Video Voice Conversion feature with chunked processing"""
    st.markdown('<div class="feature-card"><h2>🎬 Video Voice Conversion</h2><p>Convert voices in video files with chunked processing and live preview</p></div>', unsafe_allow_html=True)
    
    if not vc_model:
        st.error("Voice Conversion model not available")
        return
    
    # Processing settings
    st.subheader("⚙️ Processing Settings")
    col1, col2, col3 = st.columns(3)
    
    with col1:
        chunk_duration = st.slider(
            "Audio Chunk Duration (seconds)",
            min_value=30, max_value=120, value=60, step=10,
            help="Shorter chunks prevent CUDA OOM but increase processing time"
        )
    
    with col2:
        preview_frequency = st.selectbox(
            "Preview Frequency",
            [1, 3, 5],
            index=1,
            help="Show preview after every N chunks (1=every chunk, 3=every 3 chunks)"
        )
    
    with col3:
        video_quality = st.selectbox(
            "Output Video Quality",
            ["High", "Medium", "Low"],
            index=1,
            help="Higher quality = larger file size"
        )
    
    # Video upload
    st.subheader("🎬 Upload Video")
    uploaded_video = st.file_uploader(
        "Upload your video file",
        type=["mp4", "avi", "mov", "mkv", "webm"],
        help="Upload video file with audio to convert"
    )
    
    video_info = None
    video_path = None
    
    if uploaded_video:
        video_path = save_uploaded_file(uploaded_video)
        if video_path:
            video_info = get_video_info(video_path)
            if video_info:
                col1, col2 = st.columns(2)
                
                with col1:
                    st.write("**Video Information:**")
                    st.write(f"• Duration: {video_info['duration']:.1f} seconds")
                    st.write(f"• FPS: {video_info['fps']:.1f}")
                    st.write(f"• Resolution: {video_info['size'][0]}x{video_info['size'][1]}")
                    st.write(f"• Has Audio: {'✅' if video_info['has_audio'] else '❌'}")
                
                with col2:
                    st.write("**Processing Preview:**")
                    if video_info['has_audio']:
                        estimated_chunks = int(np.ceil(video_info['duration'] / chunk_duration))
                        st.write(f"• Estimated chunks: {estimated_chunks}")
                        st.write(f"• Processing time: ~{estimated_chunks * 3:.0f}-{estimated_chunks * 8:.0f} seconds")
                    else:
                        st.error("Video has no audio track!")
                
                # Show video preview
                st.video(uploaded_video)
            else:
                st.error("Could not read video file information")
    
    # Target voice
    st.subheader("🎯 Reference Voice")
    target_source = st.radio(
        "Choose reference voice:",
        ["Use Built-in Voice", "Upload Voice Sample", "Record Voice Sample"],
        horizontal=True
    )
    
    target_audio_path = None
    
    if target_source == "Upload Voice Sample":
        target_file = st.file_uploader(
            "Upload reference voice audio",
            type=["wav", "mp3", "m4a", "flac"],
            help="Upload a clear sample of the target voice (3-30 seconds recommended)",
            key="video_target_upload"
        )
        if target_file:
            target_audio_path = save_uploaded_file(target_file)
            if target_audio_path:
                st.write("**Reference Voice Sample:**")
                st.audio(target_file)
    
    elif target_source == "Record Voice Sample":
        st.info("🎙️ Record a sample of the target voice")
        try:
            target_bytes = audio_recorder(
                text="Record reference voice",
                recording_color="#e8b62c",
                neutral_color="#6aa36f",
                icon_name="microphone",
                icon_size="2x",
                key="video_target_recorder"
            )
            if target_bytes:
                target_audio_path = save_recorded_audio(target_bytes)
                if target_audio_path:
                    st.write("**Recorded Reference Voice:**")
                    st.audio(target_bytes)
        except Exception as e:
            st.error(f"Audio recording failed: {str(e)}")
            st.info("Please try uploading an audio file instead.")
    
    # Process button
    if st.button("🎬 Convert Video Voice", type="primary", use_container_width=True):
        if video_path and video_info and video_info['has_audio']:
            try:
                with st.spinner("Extracting audio from video..."):
                    # Extract audio from video
                    audio_path, video_duration = extract_audio_from_video(video_path)
                    
                    if audio_path:
                        st.success(f"✅ Audio extracted successfully! Duration: {video_duration:.1f}s")
                        
                        # Split audio into chunks
                        st.info(f"🔄 Splitting audio into {chunk_duration}s chunks...")
                        chunks, sample_rate = split_audio_into_chunks(
                            audio_path, 
                            chunk_duration_seconds=chunk_duration
                        )
                        
                        if chunks:
                            st.info(f"📊 Split into {len(chunks)} chunks for processing")
                            
                            # Process video with live preview
                            st.subheader("🎥 Processing Video with Live Preview")
                            final_video_path = process_video_chunks_with_preview(
                                vc_model,
                                video_path,
                                chunks,
                                target_voice_path=target_audio_path
                            )
                            
                            if final_video_path:
                                st.success("🎉 Video voice conversion completed!")
                                
                                # Show final result
                                st.subheader("🎬 Final Result")
                                
                                # Load and display final video
                                with open(final_video_path, "rb") as video_file:
                                    video_bytes = video_file.read()
                                    st.video(video_bytes)
                                    
                                    # Download button
                                    st.download_button(
                                        label="📥 Download Converted Video",
                                        data=video_bytes,
                                        file_name="voice_converted_video.mp4",
                                        mime="video/mp4"
                                    )
                                
                                # Cleanup
                                os.unlink(final_video_path)
                            else:
                                st.error("❌ Video processing failed")
                        else:
                            st.error("❌ Failed to split audio into chunks")
                        
                        # Cleanup audio file
                        if os.path.exists(audio_path):
                            os.unlink(audio_path)
                    else:
                        st.error("❌ Failed to extract audio from video")
                
                # Cleanup uploaded files
                if video_path and os.path.exists(video_path):
                    os.unlink(video_path)
                if target_audio_path and os.path.exists(target_audio_path):
                    os.unlink(target_audio_path)
            
            except Exception as e:
                st.error(f"❌ Error during video processing: {str(e)}")
                st.info("""
                💡 **Troubleshooting Tips:**
                • Try shorter chunk duration (30-45 seconds)
                • Switch to CPU processing for very long videos
                • Ensure video has a clear audio track
                • Check available disk space for temporary files
                • Use smaller video files for testing
                """)
        else:
            if not video_path:
                st.warning("Please upload a video file.")
            elif not video_info or not video_info.get('has_audio'):
                st.warning("The uploaded video has no audio track to convert.")
            else:
                st.warning("Please ensure the video file is valid.")

def record_and_clone(tts_model):
    """Record your voice and clone it"""
    st.markdown('<div class="feature-card"><h2>📝 Record & Clone Your Voice</h2><p>Record your own voice and use it for text-to-speech</p></div>', unsafe_allow_html=True)
    
    if not tts_model:
        st.error("TTS model not available")
        return
    
    # Step 1: Record voice sample
    st.subheader("Step 1: 🎙️ Record Your Voice Sample")
    st.info("Record a clear sample of your voice (speak for 5-15 seconds). This will be used to clone your voice.")
    
    try:
        voice_sample_bytes = audio_recorder(
            text="Record your voice sample",
            recording_color="#e8b62c",
            neutral_color="#6aa36f",
            icon_name="microphone",
            icon_size="2x",
            key="voice_sample_recorder"
        )
        
        voice_sample_path = None
        if voice_sample_bytes:
            voice_sample_path = save_recorded_audio(voice_sample_bytes)
            if voice_sample_path:
                st.write("**Your Voice Sample:**")
                st.audio(voice_sample_bytes)
                st.success("✅ Voice sample recorded! Now you can use it for text-to-speech.")
    except Exception as e:
        st.error(f"Audio recording failed: {str(e)}")
        st.info("Please check your microphone permissions and try again.")
        voice_sample_path = None
    
    # Step 2: Text input and generation
    if voice_sample_path:
        st.subheader("Step 2: 📝 Enter Text to Synthesize")
        
        text = st.text_area(
            "Enter text to synthesize with your cloned voice:",
            value="Hello! This is my cloned voice speaking. Isn't it amazing how AI can replicate my voice from just a short sample?",
            height=100,
            max_chars=500
        )
        
        # Advanced settings
        with st.expander("🔧 Advanced Settings"):
            col1, col2 = st.columns(2)
            
            with col1:
                exaggeration = st.slider(
                    "Exaggeration",
                    min_value=0.25, max_value=2.0, value=0.5, step=0.05
                )
                temperature = st.slider(
                    "Temperature",
                    min_value=0.05, max_value=5.0, value=0.8, step=0.05
                )
            
            with col2:
                cfg_weight = st.slider(
                    "CFG Weight",
                    min_value=0.0, max_value=1.0, value=0.5, step=0.05
                )
                seed = st.number_input(
                    "Random Seed",
                    min_value=0, max_value=999999, value=0
                )
        
        # Generate with cloned voice
        if st.button("🎭 Generate with My Cloned Voice", type="primary", use_container_width=True):
            if text.strip():
                try:
                    with st.spinner("Generating speech with your cloned voice..."):
                        if seed != 0:
                            set_seed(int(seed))
                        
                        wav = tts_model.generate(
                            text,
                            audio_prompt_path=voice_sample_path,
                            exaggeration=exaggeration,
                            temperature=temperature,
                            cfg_weight=cfg_weight
                        )
                        
                        audio_array = wav.squeeze(0).numpy()
                        
                        st.markdown('<div class="success-box">✅ Your cloned voice speech generated successfully!</div>', unsafe_allow_html=True)
                        st.audio(audio_array, sample_rate=tts_model.sr)
                        
                        # Download button
                        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_file:
                            ta.save(tmp_file.name, wav, tts_model.sr)
                            with open(tmp_file.name, "rb") as file:
                                st.download_button(
                                    label="📥 Download Your Cloned Voice",
                                    data=file.read(),
                                    file_name="my_cloned_voice.wav",
                                    mime="audio/wav"
                                )
                            os.unlink(tmp_file.name)
                    
                    # Cleanup
                    if voice_sample_path and os.path.exists(voice_sample_path):
                        os.unlink(voice_sample_path)
                
                except Exception as e:
                    st.markdown(f'<div class="error-box">❌ Error: {str(e)}</div>', unsafe_allow_html=True)
            else:
                st.warning("Please enter text to synthesize.")

def about_page():
    """About ChatterBox page"""
    st.markdown('<div class="feature-card"><h2>ℹ️ About ChatterBox</h2><p>AI-powered voice synthesis and conversion suite</p></div>', unsafe_allow_html=True)
    
    # Device Information Section
    st.subheader("🖥️ Device Information")
    
    available_devices = get_available_devices()
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.write("**Available Devices:**")
        for dev in available_devices:
            if dev == "cuda":
                st.write(f"✅ **CUDA** - NVIDIA GPU acceleration")
                if torch.cuda.is_available():
                    st.write(f"   GPU: {torch.cuda.get_device_name(0)}")
                    st.write(f"   Memory: {torch.cuda.get_device_properties(0).total_memory // 1024**3} GB")
            elif dev == "mps":
                st.write(f"✅ **MPS** - Apple Silicon acceleration")
            elif dev == "cpu":
                st.write(f"✅ **CPU** - Universal compatibility")
    
    with col2:
        st.write("**Performance Guide:**")
        st.write("🚀 **CUDA**: Fastest (5-10x speedup)")
        st.write("🍎 **MPS**: Fast (2-3x speedup)")  
        st.write("💻 **CPU**: Slower but reliable")
        
        st.write("\n**Recommended for:**")
        st.write("• **Real-time use**: CUDA/MPS")
        st.write("• **Batch processing**: CUDA")
        st.write("• **Compatibility**: CPU")
    
    # Device benchmark section
    st.subheader("⚡ Performance Test")
    
    if st.button("🧪 Run Quick Performance Test"):
        test_device = st.selectbox("Select device for test:", available_devices, key="test_device")
        
        with st.spinner(f"Running performance test on {test_device.upper()}..."):
            import time
            start_time = time.time()
            
            try:
                # Load a small model for testing
                test_model, test_error = load_tts_model(test_device)
                if test_model:
                    # Generate a short sample
                    test_wav = test_model.generate("Testing performance.", temperature=0.8)
                    end_time = time.time()
                    
                    duration = end_time - start_time
                    st.success(f"✅ Test completed in {duration:.2f} seconds on {test_device.upper()}")
                    
                    # Performance rating
                    if duration < 5:
                        st.balloons()
                        st.success("🚀 Excellent performance!")
                    elif duration < 15:
                        st.info("👍 Good performance!")
                    else:
                        st.warning("⏳ Consider using GPU acceleration for better performance.")
                        
                else:
                    st.error(f"Failed to load model on {test_device}: {test_error}")
                    
            except Exception as e:
                st.error(f"Performance test failed: {str(e)}")
    
    st.markdown("""
    ## 🎭 What is ChatterBox?
    
    ChatterBox is a cutting-edge AI voice synthesis and conversion platform that offers:
    
    ### 🎤 Text-to-Speech (TTS)
    - **Default Voice**: High-quality speech synthesis with built-in voice
    - **Voice Cloning**: Clone any voice from a short audio sample
    - **Customizable**: Adjust exaggeration, temperature, and other parameters
    
    ### 🔄 Voice Conversion
    - **Real-time Conversion**: Convert your voice to sound like someone else
    - **Flexible Input**: Support for uploaded files or live recording
    - **Target Voice Options**: Use built-in voices or custom voice samples
    - **Chunked Processing**: Automatically split long audio to prevent CUDA OOM errors
    - **Memory Management**: Smart processing for files of any length
    
    ### 🎬 Video Voice Conversion
    - **Video Processing**: Convert voices in video files with audio
    - **Live Preview**: See processed chunks as they complete
    - **Chunked Video**: Smart splitting for long videos to prevent memory errors
    - **Final Video Extraction**: Download the complete converted video
    - **Quality Control**: Adjustable output quality and chunk sizes
    
    ### 🎵 Key Features
    - **Multi-device Support**: Works on CPU, CUDA, and MPS (Apple Silicon)
    - **High Quality**: State-of-the-art AI models for natural-sounding speech
    - **User-friendly**: Simple web interface with advanced options
    - **Audio Recording**: Built-in recording capabilities
    - **Video Processing**: Convert voices in video files with live preview
    - **Download Options**: Save generated audio and video files
    - **Chunked Processing**: Handle long audio/video files without memory issues
    - **Device Selection**: Choose optimal hardware for your needs
    - **Live Preview**: Real-time feedback during video processing
    
    ### 🛠️ Technology Stack
    - **Models**: Advanced transformer-based neural networks
    - **Framework**: PyTorch with optimized inference
    - **Interface**: Streamlit for interactive web application
    - **Audio Processing**: High-quality audio sampling and processing
    
    ### 🎯 Use Cases
    - **Content Creation**: Generate voiceovers for videos and podcasts
    - **Accessibility**: Convert text to speech for visually impaired users
    - **Entertainment**: Create character voices for games and stories
    - **Education**: Develop interactive learning materials
    - **Voice Dubbing**: Convert speech to different voices
    
    ### ⚡ Performance Tips
    - Use **CUDA** for fastest processing (requires NVIDIA GPU)
    - **MPS** works great on Apple Silicon Macs (M1/M2/M3)
    - **CPU** mode works but may be slower for longer texts
    - Clear audio samples (3-15 seconds) work best for voice cloning
    - Avoid background noise in recordings for best results
    - Switch devices in the sidebar to optimize for your hardware
    - GPU acceleration provides 5-10x speedup over CPU
    
    ### 🔒 Privacy & Security
    - All processing happens locally on your device
    - No audio data is sent to external servers
    - Temporary files are automatically cleaned up
    - Your voice samples remain private
    
    ---
    
    **Made with ❤️ using ChatterBox AI**
    """)

if __name__ == "__main__":
    main()
