import { useState } from "react"
import { Button } from "@/components/ui/button"
import { 
  Home, 
  Mic, 
  Play, 
  AudioWaveform, 
  User,
  LogOut,
  Settings,
  Film
} from "lucide-react"
import { HomePage } from "./dashboard/HomePage"
import { VoicesPage } from "./dashboard/VoicesPage"
import { PlaygroundPage } from "./dashboard/PlaygroundPage"
import { StudioPage } from "./dashboard/StudioPage"
import { SettingsPage } from "./dashboard/SettingsPage"

type DashboardProps = {
  user: { id: number; username: string }
  onLogout: () => void
}

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeSection, setActiveSection] = useState("home")

  const sidebarItems = [
    { id: "home", label: "Home", icon: Home },
    { id: "voices", label: "Voices", icon: Mic },
    { id: "playground", label: "Playground", icon: Play },
    { id: "studio", label: "Studio", icon: Film },
    { id: "settings", label: "Settings", icon: Settings },
  ]

  const renderContent = () => {
    switch (activeSection) {
      case "home":
        return <HomePage user={user} onNavigate={setActiveSection} />
      case "voices":
        return <VoicesPage />
      case "playground":
        return <PlaygroundPage />
      case "studio":
        return <StudioPage />
      case "settings":
        return <SettingsPage />
      default:
        return <HomePage user={user} onNavigate={setActiveSection} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="w-64 bg-white border-r border-gray-200">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <AudioWaveform className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">Clara Voice Lab</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-left transition-colors ${
                activeSection === item.id
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User Profile */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-gray-200 bg-white">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <User className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-gray-900 text-sm font-medium truncate">{user.username}</p>
              <p className="text-gray-500 text-xs">Workspace {user.id}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onLogout}
              className="text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto bg-gray-50">
        <div className="p-8">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}
