import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/toast"
import { Upload, X, Mic, Square, Play, Pause, RotateCcw } from "lucide-react"

type AddVoiceModalProps = {
  isOpen: boolean
  onClose: () => void
  onSuccess: (voiceData: any) => void
}

export function AddVoiceModal({ isOpen, onClose, onSuccess }: AddVoiceModalProps) {
  const [uploading, setUploading] = useState(false)
  const [inputMode, setInputMode] = useState<'upload' | 'record'>('upload')
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    file: null as File | null
  })
  const { addToast } = useToast()

  // Recording states
  const [isRecording, setIsRecording] = useState(false)

  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [recordingTime, setRecordingTime] = useState(0)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [isPlaying, setIsPlaying] = useState(false)

  // Refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioStreamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const recordingTimerRef = useRef<number | null>(null)
  const playbackAudioRef = useRef<HTMLAudioElement | null>(null)
  const isRecordingRef = useRef<boolean>(false)

  // Get audio devices on component mount
  useEffect(() => {
    if (isOpen) {
      getAudioDevices()
      // Initialize canvas
      if (canvasRef.current) {
        const canvas = canvasRef.current
        canvas.width = canvas.offsetWidth || 400
        canvas.height = canvas.offsetHeight || 96
        
        // Draw initial state
        const ctx = canvas.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'rgb(15, 15, 15)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // Add "Ready to record" text
          ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
          ctx.font = '12px Arial'
          ctx.textAlign = 'center'
          ctx.fillText('Click "Start Recording" to begin', canvas.width / 2, canvas.height / 2)
        }
      }
    }
    return () => {
      cleanup()
    }
  }, [isOpen])

  const getAudioDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      setAudioDevices(audioInputs)
      if (audioInputs.length > 0 && !selectedDevice) {
        setSelectedDevice(audioInputs[0].deviceId)
      }
    } catch (error) {
      console.error('Error getting audio devices:', error)
    }
  }

  const cleanup = () => {
    // Reset recording state
    isRecordingRef.current = false
    
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
    }
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
    }
  }

  const startRecording = async () => {
    try {
      const constraints = {
        audio: {
          deviceId: selectedDevice ? { exact: selectedDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      audioStreamRef.current = stream

      // Setup audio context for visualization
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      // Resume audio context if suspended (required by some browsers)
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume()
      }
      
      analyserRef.current = audioContextRef.current.createAnalyser()
      analyserRef.current.fftSize = 512
      analyserRef.current.smoothingTimeConstant = 0.8
      analyserRef.current.minDecibels = -90
      analyserRef.current.maxDecibels = -10
      
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      
      // Setup media recorder
      mediaRecorderRef.current = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      
      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        setRecordedBlob(blob)
        
        // Create file from blob for form submission
        const file = new File([blob], `recording_${Date.now()}.wav`, { type: 'audio/wav' })
        setFormData(prev => ({ ...prev, file }))
      }

      mediaRecorderRef.current.start()
      setIsRecording(true)
      isRecordingRef.current = true // Set ref immediately for visualization
      setRecordingTime(0)
      
      // Start timer with 10-minute limit
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1
          // Auto-stop at 10 minutes (600 seconds)
          if (newTime >= 600) {
            stopRecording()
          }
          return newTime
        })
      }, 1000)
      
      // Start visualization with a small delay to ensure everything is set up
      setTimeout(() => {
        console.log('Starting audio visualization...')
        visualizeAudio(true) // Force start since React state hasn't updated yet
      }, 100)
      
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to start recording. Please check your microphone permissions.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && (isRecording || isRecordingRef.current)) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      isRecordingRef.current = false // Clear ref immediately
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current)
      }
      
      if (audioStreamRef.current) {
        audioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }

  const resetRecording = () => {
    setRecordedBlob(null)
    setRecordingTime(0)
    setFormData(prev => ({ ...prev, file: null }))
    isRecordingRef.current = false // Reset ref
    
    // Clear canvas and show ready state
    if (canvasRef.current) {
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgb(15, 15, 15)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // Add "Ready to record" text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Click "Start Recording" to begin', canvas.width / 2, canvas.height / 2)
      }
    }
  }

  const playRecording = () => {
    if (recordedBlob) {
      if (playbackAudioRef.current) {
        playbackAudioRef.current.pause()
      }
      
      const url = URL.createObjectURL(recordedBlob)
      playbackAudioRef.current = new Audio(url)
      
      playbackAudioRef.current.onended = () => {
        setIsPlaying(false)
        URL.revokeObjectURL(url)
      }
      
      playbackAudioRef.current.play()
      setIsPlaying(true)
    }
  }

  const pausePlayback = () => {
    if (playbackAudioRef.current) {
      playbackAudioRef.current.pause()
      setIsPlaying(false)
    }
  }

  const visualizeAudio = (forceStart = false) => {
    console.log('visualizeAudio called, isRecording:', isRecording, 'isRecordingRef:', isRecordingRef.current, 'forceStart:', forceStart)
    
    if (!analyserRef.current || !canvasRef.current) {
      console.log('Missing analyser or canvas:', { 
        analyser: !!analyserRef.current, 
        canvas: !!canvasRef.current 
      })
      return
    }

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.log('Failed to get canvas context')
      return
    }

    // Set canvas size explicitly
    canvas.width = canvas.offsetWidth || 400
    canvas.height = canvas.offsetHeight || 96
    
    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height)

    analyserRef.current.fftSize = 512
    const bufferLength = analyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    
    console.log('Audio analysis setup - bufferLength:', bufferLength)

    const draw = () => {
      // Check if we should continue using the ref for immediate updates
      if (!analyserRef.current || !isRecordingRef.current) {
        console.log('Stopping visualization - isRecordingRef:', isRecordingRef.current)
        return
      }

      analyserRef.current.getByteFrequencyData(dataArray)

      // Clear canvas with dark background
      ctx.fillStyle = 'rgb(15, 15, 15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Calculate bar dimensions
      const barCount = Math.min(bufferLength, 64) // Limit bars for better visualization
      const barWidth = (canvas.width / barCount) * 0.8
      const barSpacing = (canvas.width / barCount) * 0.2

      for (let i = 0; i < barCount; i++) {
        // Average multiple frequency bins for each bar
        const binSize = Math.floor(bufferLength / barCount)
        let sum = 0
        for (let j = 0; j < binSize; j++) {
          sum += dataArray[i * binSize + j]
        }
        const average = sum / binSize

        const barHeight = (average / 255) * canvas.height * 0.9
        const x = i * (barWidth + barSpacing)
        const y = canvas.height - barHeight

        // Create gradient colors
        const hue = (i / barCount) * 360
        const saturation = 70 + (average / 255) * 30
        const lightness = 40 + (average / 255) * 40

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        
        // Draw rounded bars
        ctx.fillRect(x, y, barWidth, barHeight)
        
        // Add glow effect for active bars
        if (average > 10) {
          ctx.shadowColor = ctx.fillStyle
          ctx.shadowBlur = 10
          ctx.fillRect(x, y, barWidth, barHeight)
          ctx.shadowBlur = 0
        }
      }

      // Add center line for reference
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()

      // Continue animation if recording using the ref for immediate updates
      if (isRecordingRef.current) {
        animationFrameRef.current = requestAnimationFrame(draw)
      }
    }

    // Start the animation
    draw()
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Check if we have a file (either uploaded or recorded)
    const fileToUpload = inputMode === 'record' ? recordedBlob : formData.file
    if (!fileToUpload || !formData.name.trim()) {
      addToast({
        title: 'Missing Information',
        description: 'Please provide a name and either upload a file or record audio',
        type: 'warning'
      })
      return
    }

    setUploading(true)
    try {
      const uploadData = new FormData()
      uploadData.append('name', formData.name)
      uploadData.append('description', formData.description)
      
      // Handle both uploaded files and recorded audio
      if (inputMode === 'record' && recordedBlob) {
        const recordedFile = new File([recordedBlob], `${formData.name}_recording.wav`, { type: 'audio/wav' })
        uploadData.append('audio_file', recordedFile)
      } else if (inputMode === 'upload' && formData.file) {
        uploadData.append('audio_file', formData.file)
      }

      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/voices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: uploadData
      })

      if (response.ok) {
        const newVoiceData = await response.json()
        onSuccess(newVoiceData)
        setFormData({ name: "", description: "", file: null })
        addToast({
          title: 'Voice Added',
          description: `"${formData.name}" has been added to your voice library`,
          type: 'success'
        })
        onClose()
      } else {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
        addToast({
          title: 'Upload Failed',
          description: error.detail || 'Failed to add voice',
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error adding voice:', error)
      addToast({
        title: 'Connection Error',
        description: 'Could not connect to the backend server',
        type: 'error'
      })
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setFormData({ ...formData, file })
  }

  const handleClose = () => {
    if (!uploading && !isRecording) {
      cleanup()
      setFormData({ name: "", description: "", file: null })
      setInputMode('upload')
      setRecordedBlob(null)
      setRecordingTime(0)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={handleClose}
      />
      
      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Add New Voice Sample</h2>
            <p className="text-sm text-gray-600 mt-1">
              Upload an audio file (1-10 minutes) to add to your voice library
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={uploading}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Input Mode Selection */}
          <div className="mb-6">
            <Label className="block text-sm font-medium text-gray-700 mb-3">
              Choose Input Method
            </Label>
            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`flex-1 p-3 border rounded-lg transition-colors ${
                  inputMode === 'upload' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Upload className="w-5 h-5 mx-auto mb-2" />
                <div className="text-sm font-medium">Upload File</div>
                <div className="text-xs text-gray-500">Select audio file</div>
              </button>
              <button
                type="button"
                onClick={() => setInputMode('record')}
                className={`flex-1 p-3 border rounded-lg transition-colors ${
                  inputMode === 'record' 
                    ? 'border-blue-500 bg-blue-50 text-blue-700' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <Mic className="w-5 h-5 mx-auto mb-2" />
                <div className="text-sm font-medium">Record Audio</div>
                <div className="text-xs text-gray-500">Record your voice</div>
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {/* Voice Name */}
            <div>
              <Label htmlFor="voice-name" className="block text-sm font-medium text-gray-700 mb-2">
                Voice Name *
              </Label>
              <Input
                id="voice-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., My Voice, Character Voice, etc."
                className="w-full"
                required
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="voice-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </Label>
              <Input
                id="voice-description"
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description..."
                className="w-full"
              />
            </div>

            {/* File Upload or Recording */}
            {inputMode === 'upload' ? (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Audio File *
                </Label>
                <div className="mt-1">
                  <div className="flex items-center justify-center w-full">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <Upload className="w-8 h-8 mb-4 text-gray-500" />
                        <p className="mb-2 text-sm text-gray-500">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-gray-500">WAV, MP3, M4A, FLAC, OGG (MAX. 100MB)</p>
                        {formData.file && (
                          <p className="text-xs text-green-600 mt-2 font-medium">
                            ✓ Selected: {formData.file.name}
                          </p>
                        )}
                      </div>
                      <input
                        type="file"
                        accept=".wav,.mp3,.m4a,.flac,.ogg,audio/*"
                        onChange={handleFileChange}
                        className="hidden"
                        required
                      />
                    </label>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: WAV, MP3, M4A, FLAC, OGG • Duration: 1 second - 10 minutes
                </p>
              </div>
            ) : (
              <div>
                <Label className="block text-sm font-medium text-gray-700 mb-2">
                  Record Audio *
                </Label>
                
                {/* Audio Device Selection */}
                {audioDevices.length > 1 && (
                  <div className="mb-4">
                    <Label className="block text-xs font-medium text-gray-600 mb-1">
                      Microphone
                    </Label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md text-sm"
                      disabled={isRecording}
                    >
                      {audioDevices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Recording Interface */}
                <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
                  {/* Audio Visualizer */}
                  <div className="mb-4 relative">
                    <canvas
                      ref={canvasRef}
                      className="w-full h-24 bg-gray-900 rounded border"
                      style={{ width: '100%', height: '96px' }}
                    />
                    {/* Recording indicator */}
                    {isRecording && (
                      <div className="absolute top-2 right-2 flex items-center space-x-1 bg-red-600 text-white px-2 py-1 rounded-full text-xs">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                        <span>REC</span>
                      </div>
                    )}
                  </div>

                  {/* Recording Timer */}
                  <div className="text-center mb-4">
                    <div className="text-2xl font-mono text-gray-700">
                      {formatTime(recordingTime)}
                    </div>
                    {recordingTime >= 600 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Maximum recording time: 10 minutes
                      </p>
                    )}
                  </div>

                  {/* Recording Controls */}
                  <div className="flex justify-center space-x-3">
                    {!isRecording && !recordedBlob && (
                      <Button
                        type="button"
                        onClick={startRecording}
                        className="bg-red-600 hover:bg-red-700 text-white"
                        disabled={uploading}
                      >
                        <Mic className="w-4 h-4 mr-2" />
                        Start Recording
                      </Button>
                    )}

                    {isRecording && (
                      <Button
                        type="button"
                        onClick={stopRecording}
                        className="bg-gray-600 hover:bg-gray-700 text-white"
                      >
                        <Square className="w-4 h-4 mr-2" />
                        Stop Recording
                      </Button>
                    )}

                    {recordedBlob && !isRecording && (
                      <>
                        <Button
                          type="button"
                          onClick={isPlaying ? pausePlayback : playRecording}
                          variant="outline"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 mr-2" />
                          ) : (
                            <Play className="w-4 h-4 mr-2" />
                          )}
                          {isPlaying ? 'Pause' : 'Play'}
                        </Button>
                        
                        <Button
                          type="button"
                          onClick={resetRecording}
                          variant="outline"
                          disabled={uploading}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Re-record
                        </Button>
                      </>
                    )}
                  </div>

                  {recordedBlob && (
                    <p className="text-xs text-green-600 text-center mt-2">
                      ✓ Recording ready for upload
                    </p>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Click "Start Recording" to begin. Maximum duration: 10 minutes
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={
                uploading || 
                !formData.name.trim() || 
                (inputMode === 'upload' && !formData.file) ||
                (inputMode === 'record' && !recordedBlob)
              }
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {uploading ? (
                <>
                  <Upload className="h-4 w-4 mr-2 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Add Voice
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
