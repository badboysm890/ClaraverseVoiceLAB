import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/toast"
import { 
  MessageSquare,
  Play,
  Pause,
  Download,
  Loader2,
  FileAudio,
  CheckCircle,
  Clock,
  Trash2,
  RotateCcw,
  Upload,
  Mic,
  Square
} from "lucide-react"

type VoiceSample = {
  id: number
  name: string
  description: string
}

type TTSHistoryItem = {
  id: number
  user_id: number
  text: string
  voice_id: number | null
  voice_name: string | null
  file_size: number
  duration: number
  settings: string | null
  created_at: string
}

type VCHistoryItem = {
  id: number
  user_id: number
  voice_id: number | null
  voice_name: string | null
  input_file_size: number
  output_file_size: number
  input_duration: number
  output_duration: number
  settings: string | null
  created_at: string
}

type TTSSettings = {
  exaggeration: number
  temperature: number
  cfg_weight: number
  min_p: number
  top_p: number
  repetition_penalty: number
  seed: number
  volume: number
}

type VCSettings = {
  pitch_shift: number
  speed_factor: number
  volume_factor: number
  chunk_duration: number
  enable_chunking: boolean
}

export function PlaygroundPage() {
  const [activeTab, setActiveTab] = useState("text-to-speech")
  const [text, setText] = useState("Hello! This is ChatterBox AI voice synthesis. I can convert any text into natural-sounding speech using your custom voice samples.")
  const [voices, setVoices] = useState<VoiceSample[]>([])
  const [selectedVoice, setSelectedVoice] = useState<number | null>(null)
  const { addToast } = useToast()
  const [ttsSettings, setTTSSettings] = useState<TTSSettings>({
    exaggeration: 0.5,
    temperature: 0.8,
    cfg_weight: 0.5,
    min_p: 0.05,
    top_p: 1.0,
    repetition_penalty: 1.2,
    seed: 0,
    volume: 0.8
  })
  const [vcSettings, setVCSettings] = useState<VCSettings>({
    pitch_shift: 0.0,
    speed_factor: 1.0,
    volume_factor: 1.0,
    chunk_duration: 60,
    enable_chunking: true
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null)
  const [voiceDropdownOpen, setVoiceDropdownOpen] = useState(false)
  const [showSuccessFeedback, setShowSuccessFeedback] = useState(false)
  const [activeSettingsTab, setActiveSettingsTab] = useState("settings")
  const [historyItems, setHistoryItems] = useState<TTSHistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [vcHistoryItems, setVcHistoryItems] = useState<VCHistoryItem[]>([])
  const [isLoadingVcHistory, setIsLoadingVcHistory] = useState(false)

  const [vcInputMode, setVcInputMode] = useState<'upload' | 'record'>('upload')
  const [vcInputFile, setVcInputFile] = useState<File | null>(null)
  const [vcRecordedBlob, setVcRecordedBlob] = useState<Blob | null>(null)
  const [isVcRecording, setIsVcRecording] = useState(false)
  const [vcRecordingTime, setVcRecordingTime] = useState(0)
  const [isVcGenerating, setIsVcGenerating] = useState(false)
  const [vcGeneratedAudioUrl, setVcGeneratedAudioUrl] = useState<string | null>(null)
  const [vcAudioDevices, setVcAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [vcSelectedDevice, setVcSelectedDevice] = useState<string>('')
  const [isVcPlaying, setIsVcPlaying] = useState(false)
  const [vcCurrentAudio, setVcCurrentAudio] = useState<HTMLAudioElement | null>(null)

  const vcMediaRecorderRef = useRef<MediaRecorder | null>(null)
  const vcAudioStreamRef = useRef<MediaStream | null>(null)
  const vcCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const vcAnimationFrameRef = useRef<number | null>(null)
  const vcAudioContextRef = useRef<AudioContext | null>(null)
  const vcAnalyserRef = useRef<AnalyserNode | null>(null)
  const vcRecordingTimerRef = useRef<number | null>(null)
  const vcPlaybackAudioRef = useRef<HTMLAudioElement | null>(null)
  const vcIsRecordingRef = useRef<boolean>(false)

  const fetchVoices = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('http://localhost:8000/api/voices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setVoices(data)
        if (data.length > 0 && !selectedVoice) {
          setSelectedVoice(data[0].id)
        }
      }
    } catch (error) {
      console.error('Error fetching voices:', error)
    }
  }

  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('http://localhost:8000/api/tts/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setHistoryItems(data)
      }
    } catch (error) {
      console.error('Error fetching history:', error)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const fetchVcHistory = async () => {
    try {
      setIsLoadingVcHistory(true)
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('http://localhost:8000/api/vc/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setVcHistoryItems(data)
      }
    } catch (error) {
      console.error('Error fetching VC history:', error)
    } finally {
      setIsLoadingVcHistory(false)
    }
  }

  useEffect(() => {
    fetchVoices()
    fetchHistory()
    fetchVcHistory()
    getVcAudioDevices()
  }, [])

  useEffect(() => {
    return () => {
      vcCleanup()
    }
  }, [])

  const generateSpeech = async () => {
    if (!text.trim() || !selectedVoice) {
      addToast({
        title: 'Missing Information',
        description: 'Please enter text and select a voice',
        type: 'warning'
      })
      return
    }

    setIsGenerating(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/tts/voice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text.trim(),
          voice_id: selectedVoice,
          exaggeration: ttsSettings.exaggeration,
          temperature: ttsSettings.temperature,
          cfg_weight: ttsSettings.cfg_weight,
          min_p: ttsSettings.min_p,
          top_p: ttsSettings.top_p,
          repetition_penalty: ttsSettings.repetition_penalty,
          seed: ttsSettings.seed !== 0 ? ttsSettings.seed : undefined
        })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setGeneratedAudioUrl(url)
        
        // Show success feedback
        setShowSuccessFeedback(true)
        setTimeout(() => setShowSuccessFeedback(false), 3000)
        
        addToast({
          title: 'Speech Generated',
          description: 'Your audio is ready to play and download',
          type: 'success'
        })
        
        // Refresh history to show the new item
        fetchHistory()
      } else {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
        const errorMessage = error.detail || 'Speech generation failed'
        addToast({
          title: 'Generation Failed',
          description: errorMessage,
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error generating speech:', error)
      const errorMessage = 'Failed to connect to the backend server'
      addToast({
        title: 'Connection Error',
        description: errorMessage,
        type: 'error'
      })
    } finally {
      setIsGenerating(false)
    }
  }

  const playAudio = () => {
    if (!generatedAudioUrl) return

    if (currentAudio) {
      currentAudio.pause()
      setCurrentAudio(null)
      setIsPlaying(false)
    }

    const audio = new Audio(generatedAudioUrl)
    audio.volume = ttsSettings.volume
    setCurrentAudio(audio)
    setIsPlaying(true)

    audio.onended = () => {
      setIsPlaying(false)
      setCurrentAudio(null)
    }

    audio.onerror = () => {
      setIsPlaying(false)
      setCurrentAudio(null)
      alert('Error playing audio')
    }

    audio.play()
  }

  const pauseAudio = () => {
    if (currentAudio) {
      currentAudio.pause()
      setCurrentAudio(null)
      setIsPlaying(false)
    }
  }

  const downloadAudio = () => {
    if (!generatedAudioUrl) return

    const a = document.createElement('a')
    a.href = generatedAudioUrl
    a.download = `tts-${Date.now()}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  const getSelectedVoiceName = () => {
    const voice = voices.find(v => v.id === selectedVoice)
    return voice ? voice.name : 'Select a voice'
  }

  const getEmojiForVoice = (id: number) => {
    const emojis = ['😊', '🙂', '😄', '😃', '🤗', '😌', '😎', '🥰', '😇', '🤓', '😋', '🙃', '😉', '🤔', '😐', '🙄', '😏', '🤨', '😑', '😶']
    return emojis[id % emojis.length]
  }

  const playHistoryAudio = async (historyId: number) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/tts/history/${historyId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        
        // Stop current audio if playing
        if (currentAudio) {
          currentAudio.pause()
          setCurrentAudio(null)
          setIsPlaying(false)
        }
        
        const audio = new Audio(url)
        audio.volume = ttsSettings.volume
        setCurrentAudio(audio)
        setIsPlaying(true)
        
        audio.onended = () => {
          setIsPlaying(false)
          setCurrentAudio(null)
          URL.revokeObjectURL(url)
        }
        
        audio.onerror = () => {
          setIsPlaying(false)
          setCurrentAudio(null)
          URL.revokeObjectURL(url)
          alert('Error playing audio')
        }
        
        audio.play()
      }
    } catch (error) {
      console.error('Error playing history audio:', error)
      alert('Failed to play audio')
    }
  }

  const deleteHistoryItem = async (historyId: number) => {
    if (!confirm('Are you sure you want to delete this history item?')) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/tts/history/${historyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        fetchHistory() // Refresh the list
      } else {
        alert('Failed to delete history item')
      }
    } catch (error) {
      console.error('Error deleting history item:', error)
      alert('Failed to delete history item')
    }
  }

  const clearAllHistory = async () => {
    if (!confirm('Are you sure you want to clear all TTS history? This action cannot be undone.')) return
    
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/tts/history', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        setHistoryItems([])
      } else {
        alert('Failed to clear history')
      }
    } catch (error) {
      console.error('Error clearing history:', error)
      alert('Failed to clear history')
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const loadHistoryText = (historyItem: TTSHistoryItem) => {
    setText(historyItem.text)
    if (historyItem.voice_id && voices.some(v => v.id === historyItem.voice_id)) {
      setSelectedVoice(historyItem.voice_id)
    }
    
    // Load settings if available
    if (historyItem.settings) {
      try {
        const settings = JSON.parse(historyItem.settings)
        setTTSSettings(prev => ({ ...prev, ...settings }))
      } catch (error) {
        console.error('Error parsing history settings:', error)
      }
    }
  }

  const getVcAudioDevices = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      const devices = await navigator.mediaDevices.enumerateDevices()
      const audioInputs = devices.filter(device => device.kind === 'audioinput')
      setVcAudioDevices(audioInputs)
      if (audioInputs.length > 0 && !vcSelectedDevice) {
        setVcSelectedDevice(audioInputs[0].deviceId)
      }
    } catch (error) {
      console.error('Error getting audio devices:', error)
    }
  }

  const vcCleanup = () => {
    vcIsRecordingRef.current = false
    
    if (vcAudioStreamRef.current) {
      vcAudioStreamRef.current.getTracks().forEach(track => track.stop())
    }
    if (vcAudioContextRef.current) {
      vcAudioContextRef.current.close()
    }
    if (vcAnimationFrameRef.current) {
      cancelAnimationFrame(vcAnimationFrameRef.current)
    }
    if (vcRecordingTimerRef.current) {
      clearInterval(vcRecordingTimerRef.current)
    }
    if (vcPlaybackAudioRef.current) {
      vcPlaybackAudioRef.current.pause()
    }
  }

  const startVcRecording = async () => {
    try {
      const constraints = {
        audio: {
          deviceId: vcSelectedDevice ? { exact: vcSelectedDevice } : undefined,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      vcAudioStreamRef.current = stream

      vcAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
      
      if (vcAudioContextRef.current.state === 'suspended') {
        await vcAudioContextRef.current.resume()
      }
      
      vcAnalyserRef.current = vcAudioContextRef.current.createAnalyser()
      vcAnalyserRef.current.fftSize = 512
      vcAnalyserRef.current.smoothingTimeConstant = 0.8
      vcAnalyserRef.current.minDecibels = -90
      vcAnalyserRef.current.maxDecibels = -10
      
      const source = vcAudioContextRef.current.createMediaStreamSource(stream)
      source.connect(vcAnalyserRef.current)
      
      vcMediaRecorderRef.current = new MediaRecorder(stream)
      const chunks: BlobPart[] = []
      
      vcMediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }
      
      vcMediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        setVcRecordedBlob(blob)
      }

      vcMediaRecorderRef.current.start()
      setIsVcRecording(true)
      vcIsRecordingRef.current = true
      setVcRecordingTime(0)
      
      vcRecordingTimerRef.current = setInterval(() => {
        setVcRecordingTime(prev => {
          const newTime = prev + 1
          if (newTime >= 600) {
            stopVcRecording()
          }
          return newTime
        })
      }, 1000)
      
      setTimeout(() => {
        visualizeVcAudio()
      }, 100)
      
    } catch (error) {
      console.error('Error starting recording:', error)
      alert('Failed to start recording. Please check your microphone permissions.')
    }
  }

  const stopVcRecording = () => {
    if (vcMediaRecorderRef.current && (isVcRecording || vcIsRecordingRef.current)) {
      vcMediaRecorderRef.current.stop()
      setIsVcRecording(false)
      vcIsRecordingRef.current = false
      
      if (vcRecordingTimerRef.current) {
        clearInterval(vcRecordingTimerRef.current)
      }
      
      if (vcAudioStreamRef.current) {
        vcAudioStreamRef.current.getTracks().forEach(track => track.stop())
      }
      
      if (vcAnimationFrameRef.current) {
        cancelAnimationFrame(vcAnimationFrameRef.current)
      }
    }
  }

  const resetVcRecording = () => {
    setVcRecordedBlob(null)
    setVcRecordingTime(0)
    vcIsRecordingRef.current = false
    
    if (vcCanvasRef.current) {
      const canvas = vcCanvasRef.current
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgb(15, 15, 15)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.font = '12px Arial'
        ctx.textAlign = 'center'
        ctx.fillText('Click "Start Recording" to begin', canvas.width / 2, canvas.height / 2)
      }
    }
  }

  const playVcRecording = () => {
    if (vcRecordedBlob) {
      if (vcPlaybackAudioRef.current) {
        vcPlaybackAudioRef.current.pause()
      }
      
      const url = URL.createObjectURL(vcRecordedBlob)
      vcPlaybackAudioRef.current = new Audio(url)
      
      vcPlaybackAudioRef.current.onended = () => {
        setIsVcPlaying(false)
        URL.revokeObjectURL(url)
      }
      
      vcPlaybackAudioRef.current.play()
      setIsVcPlaying(true)
    }
  }

  const pauseVcPlayback = () => {
    if (vcPlaybackAudioRef.current) {
      vcPlaybackAudioRef.current.pause()
      setIsVcPlaying(false)
    }
  }

  const visualizeVcAudio = () => {
    if (!vcAnalyserRef.current || !vcCanvasRef.current) {
      return
    }

    const canvas = vcCanvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return
    }

    canvas.width = canvas.offsetWidth || 400
    canvas.height = canvas.offsetHeight || 96

    vcAnalyserRef.current.fftSize = 512
    const bufferLength = vcAnalyserRef.current.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      if (!vcAnalyserRef.current || !vcIsRecordingRef.current) {
        return
      }

      vcAnalyserRef.current.getByteFrequencyData(dataArray)

      ctx.fillStyle = 'rgb(15, 15, 15)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      const barCount = Math.min(bufferLength, 64)
      const barWidth = (canvas.width / barCount) * 0.8
      const barSpacing = (canvas.width / barCount) * 0.2

      for (let i = 0; i < barCount; i++) {
        const binSize = Math.floor(bufferLength / barCount)
        let sum = 0
        for (let j = 0; j < binSize; j++) {
          sum += dataArray[i * binSize + j]
        }
        const average = sum / binSize

        const barHeight = (average / 255) * canvas.height * 0.9
        const x = i * (barWidth + barSpacing)
        const y = canvas.height - barHeight

        const hue = (i / barCount) * 360
        const saturation = 70 + (average / 255) * 30
        const lightness = 40 + (average / 255) * 40

        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`
        ctx.fillRect(x, y, barWidth, barHeight)
        
        if (average > 10) {
          ctx.shadowColor = ctx.fillStyle
          ctx.shadowBlur = 10
          ctx.fillRect(x, y, barWidth, barHeight)
          ctx.shadowBlur = 0
        }
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()

      if (vcIsRecordingRef.current) {
        vcAnimationFrameRef.current = requestAnimationFrame(draw)
      }
    }

    draw()
  }

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handleVcFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null
    setVcInputFile(file)
  }

  const convertVoice = async () => {
    if (!selectedVoice || (!vcInputFile && !vcRecordedBlob)) {
      addToast({
        title: 'Missing Information',
        description: 'Please select a voice and provide audio input',
        type: 'warning'
      })
      return
    }

    setIsVcGenerating(true)
    try {
      const token = localStorage.getItem('token')
      const formData = new FormData()
      
      // Add input audio
      if (vcInputMode === 'record' && vcRecordedBlob) {
        const recordedFile = new File([vcRecordedBlob], `vc_input_${Date.now()}.wav`, { type: 'audio/wav' })
        formData.append('input_audio', recordedFile)
      } else if (vcInputMode === 'upload' && vcInputFile) {
        formData.append('input_audio', vcInputFile)
      }
      
      // Add voice conversion settings
      formData.append('voice_id', selectedVoice.toString())
      formData.append('chunk_duration', vcSettings.chunk_duration.toString())
      formData.append('enable_chunking', vcSettings.enable_chunking.toString())
      formData.append('pitch_shift', vcSettings.pitch_shift.toString())
      formData.append('speed_factor', vcSettings.speed_factor.toString())
      formData.append('volume_factor', vcSettings.volume_factor.toString())

      const response = await fetch('http://localhost:8000/api/voice-conversion/with-voice', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        setVcGeneratedAudioUrl(url)
        
        addToast({
          title: 'Voice Converted',
          description: 'Your converted audio is ready to play and download',
          type: 'success'
        })
        
        // Refresh history to show the new item
        fetchVcHistory()
      } else {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
        const errorMessage = error.detail || 'Voice conversion failed'
        addToast({
          title: 'Conversion Failed',
          description: errorMessage,
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error converting voice:', error)
      addToast({
        title: 'Connection Error',
        description: 'Failed to connect to the backend server',
        type: 'error'
      })
    } finally {
      setIsVcGenerating(false)
    }
  }

  const playVcAudio = () => {
    if (!vcGeneratedAudioUrl) return

    if (vcCurrentAudio) {
      vcCurrentAudio.pause()
      setVcCurrentAudio(null)
      setIsVcPlaying(false)
    }

    const audio = new Audio(vcGeneratedAudioUrl)
    audio.volume = ttsSettings.volume
    setVcCurrentAudio(audio)
    setIsVcPlaying(true)

    audio.onended = () => {
      setIsVcPlaying(false)
      setVcCurrentAudio(null)
    }

    audio.onerror = () => {
      setIsVcPlaying(false)
      setVcCurrentAudio(null)
      alert('Error playing audio')
    }

    audio.play()
  }

  const pauseVcAudio = () => {
    if (vcCurrentAudio) {
      vcCurrentAudio.pause()
      setVcCurrentAudio(null)
      setIsVcPlaying(false)
    }
  }

  const downloadVcAudio = () => {
    if (!vcGeneratedAudioUrl) return

    const a = document.createElement('a')
    a.href = vcGeneratedAudioUrl
    a.download = `voice-converted-${Date.now()}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Playground</h1>
        <p className="text-gray-600">Experiment with different voice tools and features</p>
      </div>
      
      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("text-to-speech")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "text-to-speech"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <MessageSquare className="h-4 w-4 inline mr-2" />
            Text to Speech
          </button>
          <button
            onClick={() => setActiveTab("voice-changer")}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === "voice-changer"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Voice Changer
          </button>
        </nav>
                </div>

            {activeTab === "text-to-speech" && (
        <div className="h-[calc(100vh-220px)] flex overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            {/* <div className="text-center py-6 px-6 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Text to Speech</h1>
              <p className="text-gray-600">Start typing here or paste any text you want to turn into lifelike speech...</p>
            </div> */}
            
            {/* Content Area */}
            <div className="flex-1 flex flex-col p-6 min-h-0">
              {/* Text Input Area */}
              <div className="flex-1 flex flex-col mb-6 min-h-0">
                <div className="relative flex-1 min-h-[300px]">
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Start typing here or paste any text you want to turn into lifelike speech..."
                    className="w-full h-full p-4 text-base border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                    maxLength={5000}
                  />
                  <div className="absolute bottom-3 right-3 text-sm text-gray-500 bg-white px-2 py-1 rounded">
                    {text.length}/5000 characters
                  </div>
                </div>
              </div>

              {/* Generated Audio Output */}
              {generatedAudioUrl && (
                <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg flex-shrink-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <FileAudio className="h-4 w-4 mr-2 text-gray-600" />
                      <h3 className="text-sm font-medium text-gray-800">Generated Audio</h3>
                    </div>
                    <span className="text-sm text-gray-500">Ready to play</span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={isPlaying ? pauseAudio : playAudio}
                      className="flex-1"
                    >
                      {isPlaying ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Play
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadAudio}
                      className="px-3"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Generate Button - Properly positioned at bottom */}
              <div className="flex flex-col items-center pt-4 border-t border-gray-200">
                {/* Success Feedback */}
                {showSuccessFeedback && (
                  <div className="mb-3 flex items-center px-4 py-2 bg-green-50 border border-green-200 rounded-lg text-green-700 animate-in slide-in-from-bottom-2 duration-300">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Speech generated successfully!</span>
                  </div>
                )}
                
                <Button
                  onClick={generateSpeech}
                  disabled={isGenerating || !text.trim() || !selectedVoice}
                  className="bg-black text-white hover:bg-gray-800 px-12 py-3 rounded-lg font-medium text-base"
                  size="lg"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    "Generate speech"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
            {/* Settings/History Tabs */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              <button 
                onClick={() => setActiveSettingsTab("settings")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeSettingsTab === "settings"
                    ? "text-gray-900 bg-white border-b-2 border-black"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Settings
              </button>
              <button 
                onClick={() => {
                  setActiveSettingsTab("history")
                  fetchHistory()
                }}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeSettingsTab === "history"
                    ? "text-gray-900 bg-white border-b-2 border-black"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                History
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {activeSettingsTab === "settings" && (
                <>
              {/* Settings Content */}
              {/* Voice Selection */}
              <div className="relative">
                <h4 className="text-sm font-semibold text-gray-900 mb-2">Voice</h4>
                <div 
                  className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-sm mr-3">
                        {selectedVoice ? getEmojiForVoice(selectedVoice) : "👤"}
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {selectedVoice ? getSelectedVoiceName() : "Select Voice"}
                      </span>
                    </div>
                    <span className={`text-gray-400 transition-transform ${voiceDropdownOpen ? 'rotate-90' : ''}`}>›</span>
                  </div>
                </div>
                
                {/* Voice Options */}
                {voiceDropdownOpen && voices.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-[240px] overflow-y-auto z-50">
                    {voices.map((voice) => (
                      <div
                        key={voice.id}
                        onClick={() => {
                          setSelectedVoice(voice.id)
                          setVoiceDropdownOpen(false)
                        }}
                        className={`flex items-center p-3 cursor-pointer transition-colors ${
                          selectedVoice === voice.id
                            ? "bg-blue-50 border-l-2 border-blue-500"
                            : "hover:bg-gray-50"
                        }`}
                      >
                        <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs mr-3">
                          {getEmojiForVoice(voice.id)}
                        </div>
                        <span className="text-sm">{voice.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Voice Settings */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">Speed</Label>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-500 w-12">Slower</span>
                    <Slider
                      value={[ttsSettings.temperature]}
                      onValueChange={(value) => setTTSSettings(prev => ({ ...prev, temperature: value[0] }))}
                      min={0.1}
                      max={2.0}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 w-12 text-right">Faster</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-center">{ttsSettings.temperature.toFixed(1)}</div>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">Stability</Label>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-500 w-12">Variable</span>
                    <Slider
                      value={[ttsSettings.cfg_weight]}
                      onValueChange={(value) => setTTSSettings(prev => ({ ...prev, cfg_weight: value[0] }))}
                      min={0.0}
                      max={1.0}
                      step={0.05}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 w-12 text-right">Stable</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-center">{ttsSettings.cfg_weight.toFixed(2)}</div>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">Similarity</Label>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-500 w-12">Low</span>
                    <Slider
                      value={[ttsSettings.min_p]}
                      onValueChange={(value) => setTTSSettings(prev => ({ ...prev, min_p: value[0] }))}
                      min={0.0}
                      max={1.0}
                      step={0.01}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 w-12 text-right">High</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-center">{ttsSettings.min_p.toFixed(2)}</div>
                </div>

                <div>
                  <Label className="text-sm font-semibold text-gray-900 mb-2 block">Style Exaggeration</Label>
                  <div className="flex items-center space-x-3">
                    <span className="text-xs text-gray-500 w-12">None</span>
                    <Slider
                      value={[ttsSettings.exaggeration]}
                      onValueChange={(value) => setTTSSettings(prev => ({ ...prev, exaggeration: value[0] }))}
                      min={0.0}
                      max={2.0}
                      step={0.1}
                      className="flex-1"
                    />
                    <span className="text-xs text-gray-500 w-12 text-right">Max</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1 text-center">{ttsSettings.exaggeration.toFixed(1)}</div>
                </div>

                {/* Speaker Boost */}
                <div className="flex items-center justify-between py-2">
                  <Label className="text-sm font-semibold text-gray-900">Speaker boost</Label>
                  <div className="flex items-center">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={ttsSettings.volume > 0.8}
                        onChange={(e) => setTTSSettings(prev => ({ 
                          ...prev, 
                          volume: e.target.checked ? 1.0 : 0.8 
                        }))}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Reset Button */}
              <div className="pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTTSSettings({
                    exaggeration: 0.5,
                    temperature: 0.8,
                    cfg_weight: 0.5,
                    min_p: 0.05,
                    top_p: 1.0,
                    repetition_penalty: 1.2,
                    seed: 0,
                    volume: 0.8
                  })}
                  className="w-full text-gray-600"
                >
                  🔄 Reset values
                </Button>
              </div>
                </>
              )}

              {activeSettingsTab === "history" && (
                <>
                  {/* History Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-2 text-gray-600" />
                      <h4 className="text-sm font-semibold text-gray-900">TTS History</h4>
                    </div>
                    {historyItems.length > 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={clearAllHistory}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Clear All
                      </Button>
                    )}
                  </div>

                  {/* History List */}
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : historyItems.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                      <p className="text-sm">No TTS history yet</p>
                      <p className="text-xs">Generate some speech to see it here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {historyItems.map((item) => (
                        <div
                          key={item.id}
                          className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                        >
                          {/* History Item Header */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center mb-1">
                                <div className="w-4 h-4 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs mr-2">
                                  {item.voice_id ? getEmojiForVoice(item.voice_id) : "🔊"}
                                </div>
                                <span className="text-xs font-medium text-gray-900 truncate">
                                  {item.voice_name || "Default Voice"}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mb-1">
                                {formatDate(item.created_at)} • {formatDuration(item.duration)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteHistoryItem(item.id)}
                              className="text-gray-400 hover:text-red-600 p-1 h-6 w-6"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Text Preview */}
                          <p className="text-xs text-gray-700 mb-3 line-clamp-3 break-words">
                            {item.text}
                          </p>

                          {/* Action Buttons */}
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => playHistoryAudio(item.id)}
                              className="flex-1 text-xs"
                            >
                              <Play className="h-3 w-3 mr-1" />
                              Play
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadHistoryText(item)}
                              className="flex-1 text-xs"
                            >
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Load
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
      </div>
      )}

      {activeTab === "voice-changer" && (
        <div className="h-[calc(100vh-220px)] flex overflow-hidden">
          {/* Main Content Area */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            {/* <div className="text-center py-6 px-6 border-b border-gray-100">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Voice Changer</h1>
              <p className="text-gray-600">Upload or record audio to convert using your selected voice</p>
            </div> */}
            
            {/* Content Area */}
            <div className="flex-1 flex flex-col p-6 min-h-0 space-y-6">
              {/* Input Mode Selection */}
              <div className="flex-shrink-0">
                <Label className="block text-sm font-medium text-gray-700 mb-3">
                  Choose Input Method
                </Label>
                <div className="flex space-x-4">
                  <button
                    type="button"
                    onClick={() => setVcInputMode('upload')}
                    className={`flex-1 p-3 border rounded-lg transition-colors ${
                      vcInputMode === 'upload' 
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
                    onClick={() => setVcInputMode('record')}
                    className={`flex-1 p-3 border rounded-lg transition-colors ${
                      vcInputMode === 'record' 
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

              {/* Input Area */}
              <div className="flex-1 min-h-0">
                {vcInputMode === 'upload' ? (
                  <div className="h-full flex flex-col">
                    <Label className="block text-sm font-medium text-gray-700 mb-3">
                      Audio File
                    </Label>
                    <div className="flex-1 min-h-[200px] max-h-[300px]">
                      <div className="flex items-center justify-center w-full h-full">
                        <label className="flex flex-col items-center justify-center w-full h-full border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                          <div className="flex flex-col items-center justify-center py-8">
                            <Upload className="w-12 h-12 mb-4 text-gray-500" />
                            <p className="mb-2 text-base text-gray-600 font-medium">
                              <span className="font-semibold">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-sm text-gray-500 mb-4">WAV, MP3, M4A, FLAC (MAX. 100MB)</p>
                            {vcInputFile && (
                              <div className="px-4 py-2 bg-green-100 border border-green-300 rounded-lg">
                                <p className="text-sm text-green-700 font-medium flex items-center">
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Selected: {vcInputFile.name}
                                </p>
                              </div>
                            )}
                          </div>
                          <input
                            type="file"
                            accept="audio/*"
                            onChange={handleVcFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <Label className="text-sm font-medium text-gray-700">
                        Record Audio
                      </Label>
                      {vcAudioDevices.length > 1 && (
                        <select
                          value={vcSelectedDevice}
                          onChange={(e) => setVcSelectedDevice(e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded-md text-sm bg-white"
                          disabled={isVcRecording}
                        >
                          {vcAudioDevices.map((device) => (
                            <option key={device.deviceId} value={device.deviceId}>
                              {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex-1 border-2 border-gray-300 rounded-lg p-6 bg-gray-50 min-h-[200px] max-h-[300px] flex flex-col">
                      {/* Audio Visualization */}
                      <div className="flex-1 mb-4 relative min-h-[120px]">
                        <canvas
                          ref={vcCanvasRef}
                          className="w-full h-full bg-gray-900 rounded-lg shadow-inner"
                        />
                        {isVcRecording && (
                          <div className="absolute top-3 right-3 flex items-center space-x-2 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span>RECORDING</span>
                          </div>
                        )}
                      </div>

                      {/* Timer */}
                      <div className="text-center mb-4">
                        <div className="text-3xl font-mono text-gray-800 font-bold">
                          {formatTime(vcRecordingTime)}
                        </div>
                        {vcRecordingTime >= 600 && (
                          <p className="text-sm text-amber-600 mt-1 font-medium">
                            ⚠️ Maximum recording time: 10 minutes
                          </p>
                        )}
                      </div>

                      {/* Recording Controls */}
                      <div className="flex justify-center space-x-3">
                        {!isVcRecording && !vcRecordedBlob && (
                          <Button
                            type="button"
                            onClick={startVcRecording}
                            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2"
                            disabled={isVcGenerating}
                          >
                            <Mic className="w-4 h-4 mr-2" />
                            Start Recording
                          </Button>
                        )}

                        {isVcRecording && (
                          <Button
                            type="button"
                            onClick={stopVcRecording}
                            className="bg-gray-600 hover:bg-gray-700 text-white px-6 py-2"
                          >
                            <Square className="w-4 h-4 mr-2" />
                            Stop Recording
                          </Button>
                        )}

                        {vcRecordedBlob && !isVcRecording && (
                          <>
                            <Button
                              type="button"
                              onClick={isVcPlaying ? pauseVcPlayback : playVcRecording}
                              variant="outline"
                              className="px-6 py-2"
                            >
                              {isVcPlaying ? (
                                <>
                                  <Pause className="w-4 h-4 mr-2" />
                                  Pause
                                </>
                              ) : (
                                <>
                                  <Play className="w-4 h-4 mr-2" />
                                  Play
                                </>
                              )}
                            </Button>
                            
                            <Button
                              type="button"
                              onClick={resetVcRecording}
                              variant="outline"
                              disabled={isVcGenerating}
                              className="px-6 py-2"
                            >
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Re-record
                            </Button>
                          </>
                        )}
                      </div>

                      {vcRecordedBlob && (
                        <div className="text-center mt-3">
                          <p className="text-sm text-green-600 font-medium flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Recording ready for conversion
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Generated Audio Output */}
              {vcGeneratedAudioUrl && (
                <div className="flex-shrink-0 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <FileAudio className="h-5 w-5 mr-2 text-gray-600" />
                      <h3 className="text-base font-medium text-gray-800">Converted Audio</h3>
                    </div>
                    <span className="text-sm text-gray-500 bg-green-100 px-2 py-1 rounded-full">Ready to play</span>
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      variant="outline"
                      onClick={isVcPlaying ? pauseVcAudio : playVcAudio}
                      className="flex-1 py-2"
                    >
                      {isVcPlaying ? (
                        <>
                          <Pause className="h-4 w-4 mr-2" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4 mr-2" />
                          Play
                        </>
                      )}
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={downloadVcAudio}
                      className="px-4 py-2"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              )}

              {/* Convert Button */}
              <div className="flex-shrink-0 flex justify-center pt-4 border-t border-gray-200">
                <Button
                  onClick={convertVoice}
                  disabled={isVcGenerating || !selectedVoice || (!vcInputFile && !vcRecordedBlob && vcInputMode === 'upload') || (vcInputMode === 'record' && !vcRecordedBlob)}
                  className="bg-black text-white hover:bg-gray-800 px-12 py-3 rounded-lg font-medium text-base shadow-lg"
                  size="lg"
                >
                  {isVcGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Converting Voice...
                    </>
                  ) : (
                    "Convert Voice"
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Right Sidebar - same as TTS */}
          <div className="w-80 border-l border-gray-200 bg-white flex flex-col">
            {/* Settings/History Tabs */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              <button 
                onClick={() => setActiveSettingsTab("settings")}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeSettingsTab === "settings"
                    ? "text-gray-900 bg-white border-b-2 border-black"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Settings
              </button>
              <button 
                onClick={() => {
                  setActiveSettingsTab("history")
                  fetchVcHistory()
                }}
                className={`flex-1 px-4 py-3 text-sm font-medium ${
                  activeSettingsTab === "history"
                    ? "text-gray-900 bg-white border-b-2 border-black"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                History
              </button>
            </div>

                         <div className="flex-1 p-4 space-y-4 overflow-y-auto">
               {activeSettingsTab === "settings" && (
                 <>
                   {/* Voice Selection */}
                   <div className="relative">
                     <h4 className="text-sm font-semibold text-gray-900 mb-2">Target Voice</h4>
                     <div 
                       className="border border-gray-200 rounded-lg p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                       onClick={() => setVoiceDropdownOpen(!voiceDropdownOpen)}
                     >
                       <div className="flex items-center justify-between">
                         <div className="flex items-center">
                           <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-sm mr-3">
                             {selectedVoice ? getEmojiForVoice(selectedVoice) : "👤"}
                           </div>
                           <span className="text-sm font-medium text-gray-900">
                             {selectedVoice ? getSelectedVoiceName() : "Select Voice"}
                           </span>
                         </div>
                         <span className={`text-gray-400 transition-transform ${voiceDropdownOpen ? 'rotate-90' : ''}`}>›</span>
                       </div>
                     </div>
                     
                     {voiceDropdownOpen && voices.length > 0 && (
                       <div className="absolute top-full left-0 right-0 mt-2 border border-gray-200 rounded-lg bg-white shadow-lg max-h-[240px] overflow-y-auto z-50">
                         {voices.map((voice) => (
                           <div
                             key={voice.id}
                             onClick={() => {
                               setSelectedVoice(voice.id)
                               setVoiceDropdownOpen(false)
                             }}
                             className={`flex items-center p-3 cursor-pointer transition-colors ${
                               selectedVoice === voice.id
                                 ? "bg-blue-50 border-l-2 border-blue-500"
                                 : "hover:bg-gray-50"
                             }`}
                           >
                             <div className="w-6 h-6 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs mr-3">
                               {getEmojiForVoice(voice.id)}
                             </div>
                             <span className="text-sm">{voice.name}</span>
                           </div>
                         ))}
                       </div>
                     )}
                   </div>

                   {/* VC Settings */}
                   <div className="space-y-4">
                     <div>
                       <Label className="text-sm font-semibold text-gray-900 mb-2 block">Pitch Shift</Label>
                       <div className="flex items-center space-x-3">
                         <span className="text-xs text-gray-500 w-12">Lower</span>
                         <Slider
                           value={[vcSettings.pitch_shift]}
                           onValueChange={(value) => setVCSettings(prev => ({ ...prev, pitch_shift: value[0] }))}
                           min={-12}
                           max={12}
                           step={0.5}
                           className="flex-1"
                         />
                         <span className="text-xs text-gray-500 w-12 text-right">Higher</span>
                       </div>
                       <div className="text-xs text-gray-400 mt-1 text-center">{vcSettings.pitch_shift.toFixed(1)} semitones</div>
                     </div>

                     <div>
                       <Label className="text-sm font-semibold text-gray-900 mb-2 block">Speed</Label>
                       <div className="flex items-center space-x-3">
                         <span className="text-xs text-gray-500 w-12">Slower</span>
                         <Slider
                           value={[vcSettings.speed_factor]}
                           onValueChange={(value) => setVCSettings(prev => ({ ...prev, speed_factor: value[0] }))}
                           min={0.5}
                           max={2.0}
                           step={0.1}
                           className="flex-1"
                         />
                         <span className="text-xs text-gray-500 w-12 text-right">Faster</span>
                       </div>
                       <div className="text-xs text-gray-400 mt-1 text-center">{vcSettings.speed_factor.toFixed(1)}x</div>
                     </div>

                     <div>
                       <Label className="text-sm font-semibold text-gray-900 mb-2 block">Volume</Label>
                       <div className="flex items-center space-x-3">
                         <span className="text-xs text-gray-500 w-12">Quiet</span>
                         <Slider
                           value={[vcSettings.volume_factor]}
                           onValueChange={(value) => setVCSettings(prev => ({ ...prev, volume_factor: value[0] }))}
                           min={0.1}
                           max={2.0}
                           step={0.1}
                           className="flex-1"
                         />
                         <span className="text-xs text-gray-500 w-12 text-right">Loud</span>
                       </div>
                       <div className="text-xs text-gray-400 mt-1 text-center">{vcSettings.volume_factor.toFixed(1)}x</div>
                     </div>

                     <div>
                       <Label className="text-sm font-semibold text-gray-900 mb-2 block">Chunk Duration</Label>
                       <div className="flex items-center space-x-3">
                         <span className="text-xs text-gray-500 w-12">30s</span>
                         <Slider
                           value={[vcSettings.chunk_duration]}
                           onValueChange={(value) => setVCSettings(prev => ({ ...prev, chunk_duration: value[0] }))}
                           min={30}
                           max={120}
                           step={10}
                           className="flex-1"
                         />
                         <span className="text-xs text-gray-500 w-12 text-right">120s</span>
                       </div>
                       <div className="text-xs text-gray-400 mt-1 text-center">{vcSettings.chunk_duration}s</div>
                     </div>

                     {/* Chunking Toggle */}
                     <div className="flex items-center justify-between py-2">
                       <Label className="text-sm font-semibold text-gray-900">Enable Chunking</Label>
                       <div className="flex items-center">
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input
                             type="checkbox"
                             className="sr-only peer"
                             checked={vcSettings.enable_chunking}
                             onChange={(e) => setVCSettings(prev => ({ 
                               ...prev, 
                               enable_chunking: e.target.checked 
                             }))}
                           />
                           <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-black"></div>
                         </label>
                       </div>
                     </div>
                   </div>

                   {/* Reset Button */}
                   <div className="pt-4 border-t border-gray-200">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setVCSettings({
                         pitch_shift: 0.0,
                         speed_factor: 1.0,
                         volume_factor: 1.0,
                         chunk_duration: 60,
                         enable_chunking: true
                       })}
                       className="w-full text-gray-600"
                     >
                       🔄 Reset values
                     </Button>
                   </div>
                 </>
               )}

               {activeSettingsTab === "history" && (
                 <>
                   {/* VC History Header */}
                   <div className="flex items-center justify-between">
                     <div className="flex items-center">
                       <Clock className="h-4 w-4 mr-2 text-gray-600" />
                       <h4 className="text-sm font-semibold text-gray-900">VC History</h4>
                     </div>
                     {vcHistoryItems.length > 0 && (
                       <Button
                         variant="outline"
                         size="sm"
                         onClick={() => {
                           // TODO: Add clear VC history function
                         }}
                         className="text-red-600 hover:text-red-700 hover:bg-red-50"
                       >
                         <Trash2 className="h-3 w-3 mr-1" />
                         Clear All
                       </Button>
                     )}
                   </div>

                   {/* VC History List */}
                   {isLoadingVcHistory ? (
                     <div className="flex items-center justify-center py-8">
                       <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                     </div>
                   ) : vcHistoryItems.length === 0 ? (
                     <div className="text-center py-8 text-gray-500">
                       <Clock className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                       <p className="text-sm">No VC history yet</p>
                       <p className="text-xs">Convert some voices to see them here</p>
                     </div>
                   ) : (
                     <div className="space-y-3">
                       {vcHistoryItems.map((item) => (
                         <div
                           key={item.id}
                           className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                         >
                           {/* VC History Item Header */}
                           <div className="flex items-start justify-between mb-2">
                             <div className="flex-1 min-w-0">
                               <div className="flex items-center mb-1">
                                 <div className="w-4 h-4 bg-gradient-to-br from-purple-400 to-pink-500 rounded-full flex items-center justify-center text-white text-xs mr-2">
                                   {item.voice_id ? getEmojiForVoice(item.voice_id) : "🔊"}
                                 </div>
                                 <span className="text-xs font-medium text-gray-900 truncate">
                                   {item.voice_name || "Default Voice"}
                                 </span>
                               </div>
                               <p className="text-xs text-gray-500 mb-1">
                                 {formatDate(item.created_at)} • {formatDuration(item.output_duration)}
                               </p>
                             </div>
                             <Button
                               variant="ghost"
                               size="sm"
                               onClick={() => {
                                 // TODO: Add delete VC history function
                               }}
                               className="text-gray-400 hover:text-red-600 p-1 h-6 w-6"
                             >
                               <Trash2 className="h-3 w-3" />
                             </Button>
                           </div>

                           {/* Action Buttons */}
                           <div className="flex space-x-2">
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                 // TODO: Add play VC history function
                               }}
                               className="flex-1 text-xs"
                             >
                               <Play className="h-3 w-3 mr-1" />
                               Play Output
                             </Button>
                             <Button
                               variant="outline"
                               size="sm"
                               onClick={() => {
                                 // TODO: Add play input function
                               }}
                               className="flex-1 text-xs"
                             >
                               <Play className="h-3 w-3 mr-1" />
                               Play Input
                             </Button>
                           </div>
                         </div>
                       ))}
                     </div>
                   )}
                 </>
               )}
                          </div>
           </div>
         </div>
       )}
     </div>
   )
 }
