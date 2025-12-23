import { useState, useEffect, useRef } from 'react'

export interface Device {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

interface DevicePanelProps {
  onStreamChange: (stream: MediaStream | null) => void
  onCameraStreamChange?: (stream: MediaStream | null) => void
  onMicrophoneStreamChange?: (stream: MediaStream | null) => void
  onScreenStreamChange?: (stream: MediaStream | null) => void
}

export default function DevicePanel({ 
  onStreamChange, 
  onCameraStreamChange,
  onMicrophoneStreamChange,
  onScreenStreamChange
}: DevicePanelProps) {
  const [cameraEnabled, setCameraEnabled] = useState(false)
  const [micEnabled, setMicEnabled] = useState(false)
  const [screenEnabled, setScreenEnabled] = useState(false)
  const [systemSoundEnabled, setSystemSoundEnabled] = useState(false)

  const [cameras, setCameras] = useState<Device[]>([])
  const [microphones, setMicrophones] = useState<Device[]>([])
  const [selectedCamera, setSelectedCamera] = useState<string>('')
  const [selectedMic, setSelectedMic] = useState<string>('')

  const [cameraResolution, setCameraResolution] = useState('')
  const [screenResolution, setScreenResolution] = useState('')

  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number>()

  const cameraStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)

  // ============================================
  // DEVICE ENUMERATION
  // ============================================
  const enumerateDevices = async () => {
    try {
      // Request permissions to get accurate device labels
      let tempStream: MediaStream | null = null
      try {
        tempStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        tempStream.getTracks().forEach(track => track.stop())
      } catch (permError) {
        console.log('Permission request (for device labels):', permError)
      }

      const devices = await navigator.mediaDevices.enumerateDevices()
      
      const videoDevices = devices
        .filter((d) => d.kind === 'videoinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Camera ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as MediaDeviceKind,
        }))
      
      const audioDevices = devices
        .filter((d) => d.kind === 'audioinput')
        .map((d) => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: d.kind as MediaDeviceKind,
        }))

      setCameras(videoDevices)
      setMicrophones(audioDevices)
      
      // Restore last selected devices from localStorage
      const lastCamera = localStorage.getItem('lastSelectedCamera')
      const lastMic = localStorage.getItem('lastSelectedMicrophone')
      
      if (videoDevices.length > 0) {
        if (lastCamera && videoDevices.find(d => d.deviceId === lastCamera)) {
          setSelectedCamera(lastCamera)
        } else if (!selectedCamera) {
          setSelectedCamera(videoDevices[0].deviceId)
        }
      }
      
      if (audioDevices.length > 0) {
        if (lastMic && audioDevices.find(d => d.deviceId === lastMic)) {
          setSelectedMic(lastMic)
        } else if (!selectedMic) {
          setSelectedMic(audioDevices[0].deviceId)
        }
      }
    } catch (error) {
      console.error('Error enumerating devices:', error)
    }
  }

  useEffect(() => {
    enumerateDevices()
    const handleDeviceChange = () => {
      console.log('Device change detected, refreshing device list...')
      enumerateDevices()
    }
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
      // Cleanup streams on unmount
      cameraStreamRef.current?.getTracks().forEach(track => track.stop())
      screenStreamRef.current?.getTracks().forEach(track => track.stop())
      micStreamRef.current?.getTracks().forEach(track => track.stop())
      audioContextRef.current?.close()
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [])

  // ============================================
  // CAMERA MANAGEMENT (COMPLETELY INDEPENDENT)
  // ============================================
  const manageCamera = async (enabled: boolean, deviceId?: string) => {
    const targetDeviceId = deviceId || selectedCamera
    
    if (enabled && targetDeviceId) {
      try {
        // Stop old camera stream ONLY
        if (cameraStreamRef.current) {
          cameraStreamRef.current.getVideoTracks().forEach(track => track.stop())
          cameraStreamRef.current = null
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Request camera stream - VIDEO ONLY, NO AUDIO
        let stream: MediaStream
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: { exact: targetDeviceId },
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false, // NEVER request audio from camera
          })
        } catch (exactError) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: targetDeviceId,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            },
            audio: false,
          })
        }
        
        // Verify we got ONLY video tracks
        const videoTracks = stream.getVideoTracks()
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length > 0) {
          console.warn('Warning: Camera stream contains audio tracks! Stopping them.')
          audioTracks.forEach(track => track.stop())
        }
        
        cameraStreamRef.current = stream
        
        // Update preview
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream
          const track = stream.getVideoTracks()[0]
          if (track) {
            const settings = track.getSettings()
            if (settings.width && settings.height) {
              setCameraResolution(`${settings.width}x${settings.height}`)
            }
          }
        }
        
        // Notify parent
        if (onCameraStreamChange) {
          onCameraStreamChange(stream)
        }
        
        console.log('Camera enabled:', targetDeviceId)
      } catch (error) {
        console.error('Error accessing camera:', error)
        setCameraEnabled(false)
        if (onCameraStreamChange) {
          onCameraStreamChange(null)
        }
      }
    } else {
      // Disable camera
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getVideoTracks().forEach(track => track.stop())
        cameraStreamRef.current = null
      }
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = null
      }
      setCameraResolution('')
      if (onCameraStreamChange) {
        onCameraStreamChange(null)
      }
      console.log('Camera disabled')
    }
  }

  const handleCameraToggle = async (enabled: boolean) => {
    setCameraEnabled(enabled)
    localStorage.setItem('lastCameraEnabled', enabled.toString())
    await manageCamera(enabled)
  }

  const handleCameraDeviceChange = async (newDeviceId: string) => {
    setSelectedCamera(newDeviceId)
    localStorage.setItem('lastSelectedCamera', newDeviceId)
    if (cameraEnabled) {
      await manageCamera(true, newDeviceId)
    }
  }

  // ============================================
  // MICROPHONE MANAGEMENT (COMPLETELY INDEPENDENT)
  // ============================================
  const manageMicrophone = async (enabled: boolean, deviceId?: string) => {
    const targetDeviceId = deviceId || selectedMic
    
    if (enabled && targetDeviceId) {
      try {
        // Stop old microphone stream ONLY
        if (micStreamRef.current) {
          micStreamRef.current.getAudioTracks().forEach(track => track.stop())
          micStreamRef.current = null
        }
        
        if (audioContextRef.current) {
          audioContextRef.current.close()
          audioContextRef.current = null
        }
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
        }
        
        await new Promise(resolve => setTimeout(resolve, 100))
        
        // Request microphone stream - AUDIO ONLY, NO VIDEO
        const audioStream = await navigator.mediaDevices.getUserMedia({
          video: false, // NEVER request video from microphone
          audio: { deviceId: targetDeviceId },
        })
        
        // Verify we got ONLY audio tracks
        const videoTracks = audioStream.getVideoTracks()
        const audioTracks = audioStream.getAudioTracks()
        if (videoTracks.length > 0) {
          console.warn('Warning: Microphone stream contains video tracks! Stopping them.')
          videoTracks.forEach(track => track.stop())
        }
        
        micStreamRef.current = audioStream
        
        // Update device list if label doesn't match
        const actualDeviceId = audioTracks[0]?.getSettings().deviceId
        const actualLabel = audioTracks[0]?.label
        if (actualDeviceId && actualLabel) {
          setMicrophones(prev => prev.map(mic => 
            mic.deviceId === actualDeviceId 
              ? { ...mic, label: actualLabel }
              : mic
          ))
        }
        
        // Notify parent
        if (onMicrophoneStreamChange) {
          onMicrophoneStreamChange(audioStream)
        }
        
        // Setup audio visualization
        const audioContext = new AudioContext()
        if (audioContext.state === 'suspended') {
          await audioContext.resume()
        }
        
        const analyser = audioContext.createAnalyser()
        analyser.fftSize = 2048
        analyser.smoothingTimeConstant = 0.0
        analyser.minDecibels = -100
        analyser.maxDecibels = 0
        
        const source = audioContext.createMediaStreamSource(audioStream)
        source.connect(analyser)
        
        audioContextRef.current = audioContext
        analyserRef.current = analyser
        
        const drawWaveform = () => {
          if (!analyserRef.current || !canvasRef.current) {
            return
          }
          
          const canvas = canvasRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) return
          
          const bufferLength = analyserRef.current.frequencyBinCount
          const timeDataArray = new Uint8Array(bufferLength)
          const freqDataArray = new Uint8Array(bufferLength)
          
          analyserRef.current.getByteTimeDomainData(timeDataArray)
          analyserRef.current.getByteFrequencyData(freqDataArray)
          
          ctx.fillStyle = 'rgb(0, 0, 0)'
          ctx.fillRect(0, 0, canvas.width, canvas.height)
          
          // Draw frequency bars
          const barWidth = (canvas.width / bufferLength) * 2.5
          let x = 0
          for (let i = 0; i < bufferLength; i++) {
            const normalizedValue = freqDataArray[i] / 255
            const barHeight = Math.max(1, normalizedValue * canvas.height * 0.8)
            const intensity = Math.min(255, freqDataArray[i] + 30)
            ctx.fillStyle = `rgb(${intensity}, ${Math.floor(intensity * 0.3)}, ${Math.floor(intensity * 0.1)})`
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight)
            x += barWidth + 1
          }
          
          // Draw waveform line
          ctx.lineWidth = 2
          ctx.strokeStyle = 'rgb(100, 200, 255)'
          ctx.beginPath()
          const sliceWidth = canvas.width / bufferLength
          x = 0
          for (let i = 0; i < bufferLength; i++) {
            const v = timeDataArray[i] / 128.0
            const y = (v * canvas.height) / 2
            if (i === 0) {
              ctx.moveTo(x, y)
            } else {
              ctx.lineTo(x, y)
            }
            x += sliceWidth
          }
          ctx.lineTo(canvas.width, canvas.height / 2)
          ctx.stroke()
          
          animationFrameRef.current = requestAnimationFrame(drawWaveform)
        }
        
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d')
          if (ctx) {
            ctx.fillStyle = 'rgb(0, 0, 0)'
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
          }
          drawWaveform()
        }
        
        console.log('Microphone enabled:', targetDeviceId)
      } catch (error) {
        console.error('Error accessing microphone:', error)
        setMicEnabled(false)
        if (onMicrophoneStreamChange) {
          onMicrophoneStreamChange(null)
        }
      }
    } else {
      // Disable microphone
      if (micStreamRef.current) {
        micStreamRef.current.getAudioTracks().forEach(track => track.stop())
        micStreamRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d')
        if (ctx) {
          ctx.fillStyle = 'rgb(0, 0, 0)'
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
        }
      }
      if (onMicrophoneStreamChange) {
        onMicrophoneStreamChange(null)
      }
      console.log('Microphone disabled')
    }
  }

  const handleMicToggle = async (enabled: boolean) => {
    setMicEnabled(enabled)
    localStorage.setItem('lastMicEnabled', enabled.toString())
    await manageMicrophone(enabled)
  }

  const handleMicDeviceChange = async (newDeviceId: string) => {
    setSelectedMic(newDeviceId)
    localStorage.setItem('lastSelectedMicrophone', newDeviceId)
    if (micEnabled) {
      await manageMicrophone(true, newDeviceId)
    }
  }

  // ============================================
  // SCREEN MANAGEMENT (COMPLETELY INDEPENDENT)
  // ============================================
  const manageScreen = async (enabled: boolean) => {
    if (enabled) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: false,
        })
        
        screenStreamRef.current = stream
        
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream
          const track = stream.getVideoTracks()[0]
          const settings = track.getSettings()
          if (settings.width && settings.height) {
            setScreenResolution(`${settings.width}x${settings.height}`)
          }
        }
        
        if (onScreenStreamChange) {
          onScreenStreamChange(stream)
        }
        
        // Stop screen share when user stops it
        stream.getVideoTracks()[0].onended = () => {
          setScreenEnabled(false)
          manageScreen(false)
        }
        
        console.log('Screen sharing enabled')
      } catch (error) {
        console.error('Error accessing screen:', error)
        setScreenEnabled(false)
        if (onScreenStreamChange) {
          onScreenStreamChange(null)
        }
      }
    } else {
      // Disable screen
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop())
        screenStreamRef.current = null
      }
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = null
      }
      setScreenResolution('')
      if (onScreenStreamChange) {
        onScreenStreamChange(null)
      }
      console.log('Screen sharing disabled')
    }
  }

  const handleScreenToggle = async (enabled: boolean) => {
    setScreenEnabled(enabled)
    await manageScreen(enabled)
  }

  // ============================================
  // RESTORE STATES ON MOUNT
  // ============================================
  const cameraRestoredRef = useRef(false)
  const micRestoredRef = useRef(false)

  useEffect(() => {
    if (selectedCamera && !cameraRestoredRef.current) {
      const lastCameraEnabled = localStorage.getItem('lastCameraEnabled') === 'true'
      if (lastCameraEnabled && !cameraEnabled) {
        cameraRestoredRef.current = true
        setTimeout(() => {
          handleCameraToggle(true)
        }, 500)
      }
    }
  }, [selectedCamera, cameraEnabled])

  useEffect(() => {
    if (selectedMic && !micRestoredRef.current) {
      const lastMicEnabled = localStorage.getItem('lastMicEnabled') === 'true'
      if (lastMicEnabled && !micEnabled) {
        micRestoredRef.current = true
        setTimeout(() => {
          handleMicToggle(true)
        }, 600)
      }
    }
  }, [selectedMic, micEnabled])

  // Clear canvas when mic is disabled
  useEffect(() => {
    if (canvasRef.current && !micEnabled) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgb(0, 0, 0)'
        ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height)
      }
    }
  }, [micEnabled])

  // ============================================
  // RENDER
  // ============================================
  return (
    <div className="w-80 bg-gray-900 border-r border-gray-700 p-4 space-y-6 overflow-y-auto">
      {/* Camera */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">Camera</span>
          <button
            onClick={() => handleCameraToggle(!cameraEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              cameraEnabled ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                cameraEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {cameraEnabled && (
          <>
            <select
              value={selectedCamera}
              onChange={(e) => handleCameraDeviceChange(e.target.value)}
              className="w-full bg-gray-800 text-white text-xs p-1 rounded mb-2"
            >
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
            <div className="relative bg-black rounded overflow-hidden mb-2">
              <video
                ref={cameraVideoRef}
                autoPlay
                muted
                className="w-full h-40 object-cover"
              />
            </div>
            {cameraResolution && (
              <p className="text-gray-400 text-xs">{cameraResolution}</p>
            )}
          </>
        )}
      </div>

      {/* Microphone */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">Microphone</span>
          <button
            onClick={() => handleMicToggle(!micEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              micEnabled ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                micEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {micEnabled && (
          <>
            <select
              value={selectedMic}
              onChange={(e) => handleMicDeviceChange(e.target.value)}
              className="w-full bg-gray-800 text-white text-xs p-1 rounded mb-2"
            >
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
            <canvas
              ref={canvasRef}
              width={300}
              height={60}
              className="w-full h-15 bg-black rounded mb-2"
              style={{ display: 'block' }}
            />
          </>
        )}
      </div>

      {/* Screen */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">Screen</span>
          <button
            onClick={() => handleScreenToggle(!screenEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              screenEnabled ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                screenEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {screenEnabled && (
          <>
            <div className="relative bg-black rounded overflow-hidden mb-2">
              <video
                ref={screenVideoRef}
                autoPlay
                muted
                className="w-full h-40 object-contain"
              />
            </div>
            {screenResolution && (
              <p className="text-gray-400 text-xs">{screenResolution}</p>
            )}
          </>
        )}
      </div>

      {/* System Sound */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-white text-sm font-medium">System Sound</span>
          <button
            onClick={() => setSystemSoundEnabled(!systemSoundEnabled)}
            className={`w-12 h-6 rounded-full transition-colors ${
              systemSoundEnabled ? 'bg-green-500' : 'bg-gray-600'
            }`}
          >
            <div
              className={`w-5 h-5 bg-white rounded-full transition-transform ${
                systemSoundEnabled ? 'translate-x-6' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  )
}
