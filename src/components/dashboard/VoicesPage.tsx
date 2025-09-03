import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { AddVoiceModal } from "./AddVoiceModal"
import { useToast } from "@/components/ui/toast"
import { 
  Plus,
  Play,
  Pause,
  Trash2,
  FileAudio,
  AlertCircle
} from "lucide-react"

type VoiceSample = {
  id: number
  name: string
  description: string
  file_size: number
  duration: number
  created_at: string
  updated_at: string
}

export function VoicesPage() {
  const [voices, setVoices] = useState<VoiceSample[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { addToast } = useToast()

  const fetchVoices = async () => {
    try {
      setError(null)
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }

      const response = await fetch('http://localhost:8000/api/voices', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setVoices(data)
      } else if (response.status === 401) {
        setError('Authentication failed - please login again')
        addToast({
          title: 'Authentication Error',
          description: 'Please login again',
          type: 'error'
        })
      } else {
        setError(`Failed to fetch voices: ${response.status}`)
        addToast({
          title: 'Error Loading Voices',
          description: `Server returned ${response.status}`,
          type: 'error'
        })
      }
    } catch (error) {
      const errorMessage = 'Backend server may not be running'
      setError(errorMessage)
      addToast({
        title: 'Connection Error',
        description: 'Could not connect to the backend server',
        type: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleVoiceAdded = (newVoiceData: VoiceSample) => {
    setVoices([newVoiceData, ...voices])
  }

  const handleDeleteVoice = async (id: number) => {
    if (!confirm('Are you sure you want to delete this voice sample? This action cannot be undone.')) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/voices/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        setVoices(voices.filter(v => v.id !== id))
        addToast({
          title: 'Voice Deleted',
          description: 'Voice sample has been removed from your library',
          type: 'success'
        })
      } else {
        const errorData = await response.json().catch(() => null)
        const errorMessage = errorData?.detail || 'Failed to delete voice'
        addToast({
          title: 'Delete Failed',
          description: errorMessage,
          type: 'error'
        })
      }
    } catch (error) {
      console.error('Error deleting voice:', error)
      addToast({
        title: 'Delete Failed',
        description: 'Could not connect to server',
        type: 'error'
      })
    }
  }

  const handlePlayVoice = async (id: number) => {
    try {
      // If there's currently playing audio, stop it first
      if (currentAudio) {
        currentAudio.pause()
        currentAudio.currentTime = 0
        setCurrentAudio(null)
        setPlayingId(null)
      }

      const token = localStorage.getItem('token')
      const response = await fetch(`http://localhost:8000/api/voices/${id}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = URL.createObjectURL(blob)
        const audio = new Audio(url)
        
        setPlayingId(id)
        setCurrentAudio(audio)
        
        audio.onended = () => {
          setPlayingId(null)
          setCurrentAudio(null)
          URL.revokeObjectURL(url)
        }
        
        audio.onerror = () => {
          console.error('Error playing audio')
          setPlayingId(null)
          setCurrentAudio(null)
          URL.revokeObjectURL(url)
        }
        
        await audio.play()
      }
    } catch (error) {
      console.error('Error playing voice:', error)
      setPlayingId(null)
      setCurrentAudio(null)
    }
  }

  const handlePauseVoice = () => {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio.currentTime = 0
      setCurrentAudio(null)
      setPlayingId(null)
    }
  }





  useEffect(() => {
    fetchVoices()
  }, [])

  // Cleanup audio when component unmounts
  useEffect(() => {
    return () => {
      if (currentAudio) {
        currentAudio.pause()
        setCurrentAudio(null)
        setPlayingId(null)
      }
    }
  }, [currentAudio])

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voices</h1>
          <p className="text-gray-600">Manage your voice library and samples</p>
        </div>
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading voices...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voices</h1>
          <p className="text-gray-600">Manage your voice library and samples</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Voices</h3>
              <p className="text-gray-500 mb-4">{error}</p>
              <Button onClick={() => {
                setError(null)
                setLoading(true)
                fetchVoices()
              }}>
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Voice Library</h1>
          <p className="text-gray-600">Manage your personal voice samples (1-10 minutes each)</p>
        </div>
        
        <Button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>Add Voice Sample</span>
        </Button>
      </div>

      {voices.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileAudio className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No voice samples yet</h3>
              <p className="text-gray-500 mb-4">
                Start building your voice library by adding your first voice sample
              </p>
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Voice
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {voices.map((voice) => {
            // Generate random emoji based on voice ID for consistency
            const emojis = ['😊', '🙂', '😄', '😃', '🤗', '😌', '😎', '🥰', '😇', '🤓', '😋', '🙃', '😉', '🤔', '😐', '🙄', '😏', '🤨', '😑', '😶']
            const randomEmoji = emojis[voice.id % emojis.length]
            
            return (
              <div key={voice.id} className="flex items-center p-4 bg-white rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xl mr-4 flex-shrink-0">
                  {randomEmoji}
                </div>
                
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-gray-900 truncate">
                    {voice.name}
                  </h3>
                  <p className="text-sm text-gray-600 line-clamp-1">
                    {voice.description || "No description"}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => playingId === voice.id ? handlePauseVoice() : handlePlayVoice(voice.id)}
                    className="text-gray-600 hover:text-blue-600"
                  >
                    {playingId === voice.id ? (
                      <Pause className="h-5 w-5" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteVoice(voice.id)}
                    className="text-gray-600 hover:text-red-600"
                  >
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <AddVoiceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={handleVoiceAdded}
      />
    </div>
  )
}