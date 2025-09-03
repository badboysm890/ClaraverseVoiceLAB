import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  MessageSquare,
  Headphones,
  Music,
  Sparkles,
  Wand2,
  Mic,
  Package
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

type HomePageProps = {
  user: { id: number; username: string }
  onNavigate?: (section: string) => void
}

export function HomePage({ user, onNavigate }: HomePageProps) {
  const [latestVoices, setLatestVoices] = useState<VoiceSample[]>([])
  const [loading, setLoading] = useState(true)

  // Dynamic greeting based on time of day
  const getTimeBasedGreeting = () => {
    const hour = new Date().getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const fetchLatestVoices = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
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
        // Get the latest 5 voices (sorted by created_at desc)
        const sortedVoices = data.sort((a: VoiceSample, b: VoiceSample) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ).slice(0, 5)
        setLatestVoices(sortedVoices)
      }
    } catch (error) {
      console.error('Error fetching latest voices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLatestVoices()
  }, [])
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{getTimeBasedGreeting()}, {user.username}!</h1>
        <p className="text-gray-600">Welcome to your voice workspace</p>
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card 
          className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => onNavigate?.('playground')}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <p className="text-gray-900 text-sm font-medium">Instant speech</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => {
            // Navigate to playground with TTS pre-selected
            onNavigate?.('playground')
          }}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Headphones className="h-6 w-6 text-white" />
            </div>
            <p className="text-gray-900 text-sm font-medium">Audiobook</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => {
            // Navigate to playground with conversational AI settings
            onNavigate?.('playground')
          }}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquare className="h-6 w-6 text-white" />
            </div>
            <p className="text-gray-900 text-sm font-medium">Conversational AI</p>
          </CardContent>
        </Card>

        <Card 
          className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => {
            alert('Music generation feature coming soon! Currently focusing on voice synthesis and conversion.')
          }}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Music className="h-6 w-6 text-white" />
            </div>
            <p className="text-gray-900 text-sm font-medium">Music</p>
            <span className="text-xs text-gray-500 mt-1 block">Coming Soon</span>
          </CardContent>
        </Card>

        <Card 
          className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => {
            alert('Sound effects generation feature coming soon! Stay tuned for updates.')
          }}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3">
              <Headphones className="h-6 w-6 text-white" />
            </div>
            <p className="text-gray-900 text-sm font-medium">Sound effect</p>
            <span className="text-xs text-gray-500 mt-1 block">Coming Soon</span>
          </CardContent>
        </Card>

        <Card 
          className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer hover:bg-gray-50"
          onClick={() => onNavigate?.('studio')}
        >
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <p className="text-gray-900 text-sm font-medium">Dubbed video</p>
          </CardContent>
        </Card>
      </div>

      {/* Two Column Layout */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Latest from the library */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Latest from the library</h2>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Loading latest voices...</p>
              </div>
            ) : latestVoices.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No voice samples yet</p>
                <Button 
                  variant="outline" 
                  onClick={() => onNavigate?.('voices')}
                  className="text-blue-600 border-blue-600 hover:bg-blue-50"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  Add Your First Voice
                </Button>
              </div>
            ) : (
              latestVoices.map((voice) => {
                // Generate random emoji based on voice ID for consistency
                const emojis = ['😊', '🙂', '😄', '😃', '🤗', '😌', '😎', '🥰', '😇', '🤓', '😋', '🙃', '😉', '🤔', '😐', '🙄', '😏', '🤨', '😑', '😶']
                const randomEmoji = emojis[voice.id % emojis.length]
                const colors = ['bg-yellow-500', 'bg-green-500', 'bg-purple-500', 'bg-blue-500', 'bg-red-500', 'bg-indigo-500', 'bg-pink-500', 'bg-teal-500']
                const randomColor = colors[voice.id % colors.length]
                
                return (
                  <Card key={voice.id} className="bg-white border-gray-200 hover:shadow-sm transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className={`w-10 h-10 ${randomColor} rounded-full flex items-center justify-center text-white text-lg`}>
                          {randomEmoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-gray-900 font-medium text-sm mb-1">{voice.name}</h3>
                          <p className="text-gray-600 text-xs leading-relaxed">
                            {voice.description || "No description available"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })
            )}
          </div>
          <Button 
            variant="ghost" 
            className="text-gray-700 hover:bg-gray-100 mt-4 w-full"
            onClick={() => onNavigate?.('voices')}
          >
            Explore Library
          </Button>
        </div>

        {/* Create or clone a voice */}
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Create or clone a voice</h2>
          <div className="space-y-4">
            <Card 
              className="bg-white border-gray-200 hover:shadow-sm transition-shadow cursor-pointer hover:bg-gray-50"
              onClick={() => {
                alert('Voice Design feature coming soon! This will allow you to create voices from text descriptions using advanced AI.')
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center">
                    <Wand2 className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">Voice Design</h3>
                    <p className="text-gray-600 text-sm">Design an entirely new voice from a text prompt</p>
                    <span className="text-xs text-red-600 font-medium">Coming Soon</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-white border-gray-200 hover:shadow-sm transition-shadow cursor-pointer hover:bg-gray-50"
              onClick={() => onNavigate?.('voices')}
            >
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
                    <Mic className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">Clone your Voice</h3>
                    <p className="text-gray-600 text-sm">Create a realistic digital clone of your voice</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="bg-white border-gray-200 hover:shadow-sm transition-shadow cursor-pointer hover:bg-gray-50"
              onClick={() => {
                alert('Voice Collections feature coming soon! We\'re curating professional voice libraries for different use cases.')
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                    <Package className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-gray-900 font-medium">Voice Collections</h3>
                    <p className="text-gray-600 text-sm">Curated AI voices for every use case</p>
                    <span className="text-xs text-blue-600 font-medium">Coming Soon</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
