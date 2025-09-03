import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Mic, AudioWaveform, Upload, Settings } from "lucide-react"

type LandingPageProps = {
  onAuthenticated?: (token: string, user: { id: number; username: string }) => void
}

export function LandingPage({ onAuthenticated }: LandingPageProps) {
  const [open, setOpen] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("login")

  const handleAuth = async (isSignup: boolean) => {
    setError(null)
    if (!username || !password) {
      setError("Please enter username and password")
      return
    }
    setLoading(true)
    try {
      const endpoint = isSignup ? "/users/signup" : "/users/login"
      const res = await fetch(`http://127.0.0.1:8000${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const msg = await res.json().catch(() => null)
        throw new Error(msg?.detail || `${isSignup ? 'Signup' : 'Login'} failed`)
      }
      const data = await res.json()
      
      if (isSignup) {
        // After successful signup, automatically login
        const loginRes = await fetch("http://127.0.0.1:8000/users/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        })
        if (loginRes.ok) {
          const loginData = await loginRes.json()
          localStorage.setItem("token", loginData.access_token)
          onAuthenticated?.(loginData.access_token, data)
        }
      } else {
        // Login successful
        localStorage.setItem("token", data.access_token)
        // Get user info
        const userRes = await fetch("http://127.0.0.1:8000/users/me", {
          headers: { "Authorization": `Bearer ${data.access_token}` }
        })
        if (userRes.ok) {
          const userData = await userRes.json()
          onAuthenticated?.(data.access_token, userData)
        }
      }
      
      setOpen(false)
      setUsername("")
      setPassword("")
    } catch (e: any) {
      setError(e.message || "Something went wrong")
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-4 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-8 -right-4 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-10 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 container mx-auto px-6 py-8">
        <nav className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <AudioWaveform className="h-8 w-8 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">Clara Voice Lab</span>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white border-0 px-6 py-2 shadow-lg hover:shadow-xl transition-all duration-300">
            Get Started
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-20 text-center">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl font-bold text-white mb-6 leading-tight">
            Transform Your Voice with
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              {" "}AI Magic
            </span>
          </h1>
          <p className="text-xl text-gray-300 mb-12 leading-relaxed">
            Experience the future of voice transformation. Upload your audio, choose a voice, 
            and watch our advanced AI technology create stunning vocal conversions in seconds.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => setOpen(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-4 text-lg">
              <Mic className="mr-2 h-5 w-5" />
              Start Creating
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="text-white border-gray-600 hover:bg-white/10 px-8 py-4 text-lg"
              onClick={() => {
                // Scroll to features section to show what the app can do
                document.querySelector('[data-section="features"]')?.scrollIntoView({ behavior: 'smooth' })
              }}
            >
              See Features
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section data-section="features" className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">What You Can Do</h2>
          <p className="text-gray-300 text-lg">Real features available in Clara Voice Lab</p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-white/10 border-purple-500/20 backdrop-blur-sm">
            <CardHeader>
              <Mic className="h-12 w-12 text-purple-400 mb-4" />
              <CardTitle className="text-white">Voice Synthesis</CardTitle>
              <CardDescription className="text-gray-300">
                Convert any text to speech using AI voices. Perfect for content creation and accessibility.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-purple-500/20 backdrop-blur-sm">
            <CardHeader>
              <AudioWaveform className="h-12 w-12 text-purple-400 mb-4" />
              <CardTitle className="text-white">Voice Conversion</CardTitle>
              <CardDescription className="text-gray-300">
                Transform your voice into any style or clone existing voices with advanced AI processing.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-white/10 border-purple-500/20 backdrop-blur-sm">
            <CardHeader>
              <Upload className="h-12 w-12 text-purple-400 mb-4" />
              <CardTitle className="text-white">Video Dubbing</CardTitle>
              <CardDescription className="text-gray-300">
                Upload videos and automatically dub them with AI voices while preserving timing and emotion.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-white mb-4">How It Works</h2>
          <p className="text-gray-300 text-lg">Simple, powerful voice transformation</p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">1</span>
              </div>
              <h3 className="text-white text-xl font-semibold mb-4">Choose Mode</h3>
              <p className="text-gray-300">Select text-to-speech, voice conversion, or video dubbing from the dashboard</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">2</span>
              </div>
              <h3 className="text-white text-xl font-semibold mb-4">Input Content</h3>
              <p className="text-gray-300">Upload audio/video files or type text, then select your desired AI voice</p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white text-2xl font-bold">3</span>
              </div>
              <h3 className="text-white text-xl font-semibold mb-4">Get Results</h3>
              <p className="text-gray-300">Download your transformed content instantly with professional quality</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border-purple-500/30 backdrop-blur-sm">
            <CardContent className="p-12">
              <h2 className="text-4xl font-bold text-white mb-6">Ready to Transform Your Voice?</h2>
              <p className="text-gray-300 text-lg mb-8">
                Join thousands of creators, podcasters, and content makers who trust Clara Voice Lab
              </p>
              <Button 
                size="lg" 
                onClick={() => setOpen(true)} 
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-12 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Settings className="mr-2 h-5 w-5" />
                Launch Voice Lab
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12 border-t border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AudioWaveform className="h-6 w-6 text-purple-400" />
            <span className="text-gray-400">© 2025 Clara Voice Lab</span>
          </div>
          <div className="text-gray-400">
            Powered by Advanced AI Technology
          </div>
        </div>
      </footer>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-white text-gray-900 border-0 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-semibold mb-4">Welcome to Clara Voice Lab</DialogTitle>
          </DialogHeader>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-gray-100">
              <TabsTrigger value="login" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Login</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">Sign Up</TabsTrigger>
            </TabsList>
            <TabsContent value="login" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="login-username" className="text-sm font-medium text-gray-700">Username</Label>
                  <Input
                    id="login-username"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <Button 
                  disabled={loading} 
                  onClick={() => handleAuth(false)} 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2"
                >
                  {loading ? "Signing in..." : "Sign In"}
                </Button>
              </div>
            </TabsContent>
            <TabsContent value="signup" className="space-y-4 mt-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="signup-username" className="text-sm font-medium text-gray-700">Username</Label>
                  <Input
                    id="signup-username"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="signup-password" className="text-sm font-medium text-gray-700">Password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white border-gray-300 text-gray-900 placeholder:text-gray-500 focus:border-purple-500 focus:ring-purple-500"
                  />
                </div>
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}
                <Button 
                  disabled={loading} 
                  onClick={() => handleAuth(true)} 
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium py-2"
                >
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
