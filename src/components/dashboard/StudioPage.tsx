import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/toast"
import { 
  FileVideo,
  Download,
  Loader2,
  CheckCircle,
  Film
} from "lucide-react"

type VoiceSample = {
  id: number
  name: string
  file_path: string
  duration: number
  created_at: string
}

export function StudioPage() {
  // Core State
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | null>(null)
  const [voices, setVoices] = useState<VoiceSample[]>([])
  const [selectedVoice, setSelectedVoice] = useState<number | null>(null)
  const { addToast } = useToast()
  
  // Settings (similar to playground)
  const [settings, setSettings] = useState({
    pitch_shift: 0.0,
    speed_factor: 1.0,
    volume_factor: 1.0,
    chunk_duration: 60,
    enable_chunking: true
  })
  
  // Processing State
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentChunk, setCurrentChunk] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [processingStep, setProcessingStep] = useState('')
  const [convertedVideoUrl, setConvertedVideoUrl] = useState<string | null>(null)
  
  // Playback
  const videoRef = useRef<HTMLVideoElement>(null)
  const convertedVideoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    fetchVoices()
  }, [])

  const fetchVoices = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) return

      const response = await fetch('http://localhost:8000/api/voices', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const voicesData = await response.json()
        setVoices(voicesData)
      }
    } catch (error) {
      console.error('Error fetching voices:', error)
    }
  }

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setVideoFile(file)
      const url = URL.createObjectURL(file)
      setVideoPreviewUrl(url)
    }
  }

  const startConversion = async () => {
    if (!videoFile || !selectedVoice) {
      addToast({
        title: 'Missing Information',
        description: 'Please select a video file and voice',
        type: 'warning'
      })
      return
    }

    setIsProcessing(true)
    setCurrentChunk(0)
    setTotalChunks(0)
    setProcessingStep('Uploading video...')

    try {
      const formData = new FormData()
      formData.append('video', videoFile)
      formData.append('voice_id', selectedVoice.toString())
      formData.append('pitch_shift', settings.pitch_shift.toString())
      formData.append('speed_factor', settings.speed_factor.toString())
      formData.append('volume_factor', settings.volume_factor.toString())
      formData.append('chunk_duration', settings.chunk_duration.toString())
      formData.append('enable_chunking', settings.enable_chunking.toString())

      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/video-conversion', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }))
        throw new Error(errorData.detail || `Server error: ${response.status}`)
      }

      setProcessingStep('Processing completed!')
      const videoBlob = await response.blob()
      const convertedUrl = URL.createObjectURL(videoBlob)
      setConvertedVideoUrl(convertedUrl)

      addToast({
        title: 'Video Converted',
        description: 'Your video has been successfully processed',
        type: 'success'
      })

    } catch (error) {
      console.error('Conversion error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      setProcessingStep(`Error: ${errorMessage}`)
      addToast({
        title: 'Conversion Failed',
        description: errorMessage,
        type: 'error'
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const downloadVideo = () => {
    if (!convertedVideoUrl) return
    const a = document.createElement('a')
    a.href = convertedVideoUrl
    a.download = `converted-${Date.now()}.mp4`
    a.click()
  }

  const resetStudio = () => {
    setVideoFile(null)
    setVideoPreviewUrl(null)
    setConvertedVideoUrl(null)
    setIsProcessing(false)
    setCurrentChunk(0)
    setTotalChunks(0)
    setProcessingStep('')
    setSelectedVoice(null)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-200 bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Video Studio</h1>
            <p className="text-sm text-gray-600">Convert voices in your videos with AI</p>
          </div>
          <Button 
            onClick={resetStudio} 
            variant="outline" 
            size="sm"
            className="text-gray-600 border-gray-300 hover:bg-gray-50"
          >
            New Project
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col p-6 overflow-hidden">
          {/* Video Section */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 overflow-hidden relative">
            {!videoFile ? (
              /* Upload State */
              <div className="h-full flex items-center justify-center p-8">
                <div className="text-center w-full max-w-md">
                  <input
                    type="file"
                    accept="video/mp4"
                    onChange={handleVideoUpload}
                    className="hidden"
                    id="video-upload"
                  />
                  <label
                    htmlFor="video-upload"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer hover:border-gray-400 transition-colors"
                  >
                    <FileVideo className="w-12 h-12 mb-4 text-gray-400" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Video</h3>
                    <p className="text-sm text-gray-600 mb-1">Click to select or drag and drop</p>
                    <p className="text-xs text-gray-500">MP4 format only (Max 500MB)</p>
                  </label>
                </div>
              </div>
            ) : !convertedVideoUrl ? (
              /* Preview State */
              <div className="h-full flex flex-col">
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-medium text-gray-900">Original Video</h3>
                </div>
                <div className="flex-1 p-6 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    src={videoPreviewUrl || undefined}
                    controls
                    className="max-w-full max-h-full rounded-lg shadow-sm"
                  />
                </div>
              </div>
            ) : (
              /* Converted State */
              <div className="h-full flex flex-col">
                <div className="flex-shrink-0 px-6 py-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <h3 className="text-lg font-medium text-gray-900">Converted Video</h3>
                    </div>
                    <Button onClick={downloadVideo} size="sm" variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
                <div className="flex-1 p-6 flex items-center justify-center">
                  <video
                    ref={convertedVideoRef}
                    src={convertedVideoUrl}
                    controls
                    className="max-w-full max-h-full rounded-lg shadow-sm"
                  />
                </div>
              </div>
            )}

            {/* Processing Overlay */}
            {isProcessing && (
              <div className="absolute inset-0 bg-white bg-opacity-95 flex items-center justify-center">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-gray-600" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Converting Video</h3>
                  <p className="text-sm text-gray-600 mb-4">{processingStep}</p>
                  {totalChunks > 0 && (
                    <div className="w-64 mx-auto">
                      <div className="flex justify-between text-xs text-gray-600 mb-1">
                        <span>Progress</span>
                        <span>{currentChunk}/{totalChunks} chunks</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${totalChunks > 0 ? (currentChunk / totalChunks) * 100 : 0}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col">
          {/* Voice Selection */}
          <div className="flex-shrink-0 p-6 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Select Voice</h3>
            <select
              value={selectedVoice || ''}
              onChange={(e) => setSelectedVoice(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={!videoFile}
            >
              <option value="">Choose a voice</option>
              {voices.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name}
                </option>
              ))}
            </select>
            {selectedVoice && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-800">
                    {voices.find(v => v.id === selectedVoice)?.name}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Audio Settings */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Audio Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Pitch: {settings.pitch_shift.toFixed(1)} semitones
                  </Label>
                  <Slider
                    value={[settings.pitch_shift]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, pitch_shift: value[0] }))}
                    min={-12}
                    max={12}
                    step={0.5}
                    className="w-full"
                    disabled={!videoFile}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Speed: {settings.speed_factor.toFixed(1)}x
                  </Label>
                  <Slider
                    value={[settings.speed_factor]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, speed_factor: value[0] }))}
                    min={0.5}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                    disabled={!videoFile}
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">
                    Volume: {settings.volume_factor.toFixed(1)}x
                  </Label>
                  <Slider
                    value={[settings.volume_factor]}
                    onValueChange={(value) => setSettings(prev => ({ ...prev, volume_factor: value[0] }))}
                    min={0.1}
                    max={2.0}
                    step={0.1}
                    className="w-full"
                    disabled={!videoFile}
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Label className="text-sm font-medium text-gray-700">Enable Chunking</Label>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={settings.enable_chunking}
                      onChange={(e) => setSettings(prev => ({ ...prev, enable_chunking: e.target.checked }))}
                      disabled={!videoFile}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex-shrink-0 p-6 border-t border-gray-200">
            <Button
              onClick={startConversion}
              disabled={isProcessing || !videoFile || !selectedVoice}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-sm font-medium"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <Film className="w-4 h-4 mr-2" />
                  Convert Video
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
