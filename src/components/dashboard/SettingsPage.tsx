import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { 
  Settings,
  Monitor,
  Cpu,
  Zap,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Server
} from "lucide-react"

type DeviceInfo = {
  available_devices: string[]
  current_device: string
  cuda_available: boolean
  mps_available: boolean
  gpu_name?: string
  gpu_memory?: number
}

type HealthStatus = {
  status: string
  chatterbox_available: boolean
  models_loaded: boolean
  current_device: string
}

export function SettingsPage() {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [healthStatus, setHealthStatus] = useState<HealthStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [changingDevice, setChangingDevice] = useState(false)

  const fetchDeviceInfo = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/device-info', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (response.ok) {
        const data = await response.json()
        setDeviceInfo(data)
      } else {
        console.error('Failed to fetch device info:', response.status)
        // Set fallback data if API fails
        setDeviceInfo({
          available_devices: ['cpu'],
          current_device: 'cpu',
          cuda_available: false,
          mps_available: false
        })
      }
    } catch (error) {
      console.error('Error fetching device info:', error)
      // Set fallback data if network fails
      setDeviceInfo({
        available_devices: ['cpu'],
        current_device: 'cpu',
        cuda_available: false,
        mps_available: false
      })
    }
  }

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/health')
      if (response.ok) {
        const data = await response.json()
        setHealthStatus(data)
      } else {
        console.error('Failed to fetch health status:', response.status)
        // Set fallback status
        setHealthStatus({
          status: 'unknown',
          chatterbox_available: false,
          models_loaded: false,
          current_device: 'cpu'
        })
      }
    } catch (error) {
      console.error('Error fetching health status:', error)
      // Set fallback status for network errors
      setHealthStatus({
        status: 'backend_unavailable',
        chatterbox_available: false,
        models_loaded: false,
        current_device: 'cpu'
      })
    }
  }

  const changeDevice = async (device: string) => {
    setChangingDevice(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('http://localhost:8000/api/set-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ device })
      })

      if (response.ok) {
        await fetchDeviceInfo()
        await fetchHealthStatus()
        alert(`Successfully changed device to ${device}`)
      } else {
        const error = await response.json()
        alert(`Failed to change device: ${error.detail || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error changing device:', error)
      alert('Failed to change device. Please check if the backend is running.')
    } finally {
      setChangingDevice(false)
    }
  }

  const refreshStatus = async () => {
    setLoading(true)
    await Promise.all([fetchDeviceInfo(), fetchHealthStatus()])
    setLoading(false)
  }

  useEffect(() => {
    refreshStatus()
  }, [])

  const getDeviceIcon = (device: string) => {
    switch (device) {
      case 'cuda':
        return <Zap className="h-4 w-4 text-green-600" />
      case 'mps':
        return <Cpu className="h-4 w-4 text-blue-600" />
      case 'cpu':
        return <Monitor className="h-4 w-4 text-gray-600" />
      default:
        return <Monitor className="h-4 w-4 text-gray-600" />
    }
  }

  const getDeviceDescription = (device: string) => {
    switch (device) {
      case 'cuda':
        return 'NVIDIA GPU (Fastest)'
      case 'mps':
        return 'Apple Silicon (Optimized)'
      case 'cpu':
        return 'CPU (Universal)'
      default:
        return device.toUpperCase()
    }
  }

  const getStatusIcon = (status: boolean | string) => {
    if (typeof status === 'string') {
      switch (status) {
        case 'healthy':
          return <CheckCircle className="h-5 w-5 text-green-600" />
        case 'backend_unavailable':
          return <XCircle className="h-5 w-5 text-red-600" />
        case 'unknown':
          return <AlertCircle className="h-5 w-5 text-yellow-600" />
        default:
          return <XCircle className="h-5 w-5 text-red-600" />
      }
    }
    return status ? (
      <CheckCircle className="h-5 w-5 text-green-600" />
    ) : (
      <XCircle className="h-5 w-5 text-red-600" />
    )
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'Online'
      case 'backend_unavailable':
        return 'Backend Offline'
      case 'unknown':
        return 'Unknown'
      default:
        return status
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Configure your Clara Voice Lab backend settings</p>
        </div>
        <Button
          onClick={refreshStatus}
          disabled={loading}
          variant="outline"
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </Button>
      </div>

      {/* Health Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Server className="h-5 w-5" />
            <span>Backend Health Status</span>
          </CardTitle>
          <CardDescription>
            Current status of the Clara Voice Lab API backend
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthStatus ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">API Status</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(healthStatus.status)}
                  <span className="text-sm">{getStatusText(healthStatus.status)}</span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">ChatterBox Available</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(healthStatus.chatterbox_available)}
                  <span className="text-sm">
                    {healthStatus.chatterbox_available ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Models Loaded</span>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(healthStatus.models_loaded)}
                  <span className="text-sm">
                    {healthStatus.models_loaded ? 'Yes' : 'No'}
                  </span>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Device</span>
                <div className="flex items-center space-x-2">
                  {getDeviceIcon(healthStatus.current_device)}
                  <span className="text-sm font-medium">
                    {healthStatus.current_device.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-2 text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span>Loading health status...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Settings className="h-5 w-5" />
            <span>Device Configuration</span>
          </CardTitle>
          <CardDescription>
            Choose the processing device for AI operations. GPU acceleration provides significant speedup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {deviceInfo ? (
            <>
              {/* Current Device Info */}
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center space-x-3">
                  {getDeviceIcon(deviceInfo.current_device)}
                  <div>
                    <p className="font-medium text-blue-900">
                      Current Device: {getDeviceDescription(deviceInfo.current_device)}
                    </p>
                    {deviceInfo.gpu_name && (
                      <p className="text-sm text-blue-700">
                        GPU: {deviceInfo.gpu_name} ({deviceInfo.gpu_memory}GB)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Available Devices */}
              <div>
                <Label className="text-base font-semibold">Available Devices</Label>
                <div className="mt-3 space-y-2">
                  {deviceInfo.available_devices.map((device) => (
                    <div
                      key={device}
                      className={`p-4 border rounded-lg transition-colors ${
                        device === deviceInfo.current_device
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getDeviceIcon(device)}
                          <div>
                            <p className="font-medium">{getDeviceDescription(device)}</p>
                            <p className="text-sm text-gray-500">
                              {device === 'cuda' && 'Fastest performance with NVIDIA GPU'}
                              {device === 'mps' && 'Optimized for Apple Silicon Macs'}
                              {device === 'cpu' && 'Universal compatibility, slower performance'}
                            </p>
                          </div>
                        </div>
                        
                        {device === deviceInfo.current_device ? (
                          <div className="flex items-center space-x-2 text-blue-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">Active</span>
                          </div>
                        ) : (
                          <Button
                            onClick={() => changeDevice(device)}
                            disabled={changingDevice}
                            variant="outline"
                            size="sm"
                          >
                            {changingDevice ? 'Switching...' : 'Switch'}
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Tips */}
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h3 className="font-medium text-yellow-900 mb-2">Performance Tips</h3>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• <strong>CUDA</strong>: Provides 5-10x speedup over CPU (requires NVIDIA GPU)</li>
                  <li>• <strong>MPS</strong>: Optimized for Apple Silicon, 2-3x speedup over CPU</li>
                  <li>• <strong>CPU</strong>: Slower but works on all systems</li>
                  <li>• Switch devices based on your hardware capabilities</li>
                </ul>
              </div>
            </>
          ) : (
            <div className="flex items-center space-x-2 text-gray-500">
              <AlertCircle className="h-4 w-4" />
              <span>Loading device information...</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Configuration Card */}
      <Card>
        <CardHeader>
          <CardTitle>API Configuration</CardTitle>
          <CardDescription>
            Backend API settings and connection information
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Backend URL</span>
              <span className="text-sm text-gray-600">http://localhost:8000</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">API Version</span>
              <span className="text-sm text-gray-600">1.0.0</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Authentication</span>
              <span className="text-sm text-gray-600">JWT Bearer Token</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
