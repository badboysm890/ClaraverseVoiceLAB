import { useState, useEffect } from 'react'
import { LandingPage } from './components/LandingPage'
import { Dashboard } from './components/Dashboard'
import { ToastProvider } from './components/ui/toast'

function App() {
  const [user, setUser] = useState<{ id: number; username: string } | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check if user is already logged in
    const savedToken = localStorage.getItem('token')
    if (savedToken) {
      // Verify token and get user info
      fetch('http://127.0.0.1:8000/users/me', {
        headers: { 'Authorization': `Bearer ${savedToken}` }
      })
      .then(res => {
        if (res.ok) {
          return res.json()
        }
        throw new Error('Token invalid')
      })
      .then(userData => {
        setToken(savedToken)
        setUser(userData)
      })
      .catch(() => {
        localStorage.removeItem('token')
      })
      .finally(() => {
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  const handleAuthenticated = (newToken: string, userData: { id: number; username: string }) => {
    setToken(newToken)
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  if (loading) {
    return (
      <ToastProvider>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-slate-300">Loading...</p>
          </div>
        </div>
      </ToastProvider>
    )
  }

  return (
    <ToastProvider>
      {user && token ? (
        <Dashboard user={user} onLogout={handleLogout} />
      ) : (
        <LandingPage onAuthenticated={handleAuthenticated} />
      )}
    </ToastProvider>
  )
}

export default App
