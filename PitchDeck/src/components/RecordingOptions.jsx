import { useState, useEffect, useRef } from 'react'
import './RecordingOptions.css'

function RecordingOptions({ recordSettings, onClose, onUpdateSettings, buttonRef }) {
  const dropdownRef = useRef(null)
  const [localSettings, setLocalSettings] = useState({
    recordInPresentMode: recordSettings?.recordInPresentMode !== undefined ? recordSettings.recordInPresentMode : false,
    webcamEnabled: recordSettings?.webcamEnabled || false,
    webcamSize: recordSettings?.webcamSize || 'large',
    selectedCameraId: recordSettings?.selectedCameraId || '',
    microphoneEnabled: recordSettings?.microphoneEnabled || false,
    selectedMicrophoneId: recordSettings?.selectedMicrophoneId || ''
  })
  const [availableCameras, setAvailableCameras] = useState([])
  const [availableMicrophones, setAvailableMicrophones] = useState([])

  useEffect(() => {
    loadDevices()
  }, [])

  // Position dropdown relative to button
  useEffect(() => {
    const updatePosition = () => {
      if (buttonRef?.current && dropdownRef?.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect()
        const dropdown = dropdownRef.current
        
        dropdown.style.top = `${buttonRect.bottom + 8}px`
        dropdown.style.right = `${window.innerWidth - buttonRect.right}px`
      }
    }
    
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [buttonRef])

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose])

  const loadDevices = async () => {
    try {
      // Request permission first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
        stream.getTracks().forEach(track => track.stop())
      })
      
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(device => device.kind === 'videoinput')
      const audioDevices = devices.filter(device => device.kind === 'audioinput')
      
      setAvailableCameras(videoDevices)
      setAvailableMicrophones(audioDevices)
      
      // Auto-select first camera if none selected
      if (videoDevices.length > 0 && !localSettings.selectedCameraId) {
        setLocalSettings(prev => ({
          ...prev,
          selectedCameraId: videoDevices[0].deviceId
        }))
      }
      
      // Auto-select first microphone if none selected
      if (audioDevices.length > 0 && !localSettings.selectedMicrophoneId) {
        setLocalSettings(prev => ({
          ...prev,
          selectedMicrophoneId: audioDevices[0].deviceId
        }))
      }
    } catch (error) {
      console.error('Error loading devices:', error)
    }
  }

  const handleChange = (key, value) => {
    const newSettings = { ...localSettings, [key]: value }
    setLocalSettings(newSettings)
    
    // Apply changes immediately
    const updatedSettings = {
      ...recordSettings,
      recordInPresentMode: newSettings.recordInPresentMode,
      webcamEnabled: newSettings.webcamEnabled,
      webcamSize: newSettings.webcamSize,
      selectedCameraId: newSettings.selectedCameraId,
      microphoneEnabled: newSettings.microphoneEnabled,
      selectedMicrophoneId: newSettings.selectedMicrophoneId
    }
    
    // Update global record settings immediately
    if (onUpdateSettings) {
      onUpdateSettings(updatedSettings)
    }
  }

  return (
    <>
      <div className="recording-options-backdrop" onClick={onClose} />
      <div className="recording-options-dropdown" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <div className="recording-options-content">
          <div className="recording-options-field">
            <label className="recording-options-checkbox">
              <input
                type="checkbox"
                checked={localSettings.recordInPresentMode}
                onChange={(e) => handleChange('recordInPresentMode', e.target.checked)}
              />
              <span>Record screen and audio in Present mode</span>
            </label>
          </div>
          
          <div className="recording-options-field">
            <label className="recording-options-checkbox">
              <input
                type="checkbox"
                checked={localSettings.webcamEnabled}
                onChange={(e) => handleChange('webcamEnabled', e.target.checked)}
              />
              <span>Show camera in Edit and Present (round, lower right)</span>
            </label>
          </div>

          {localSettings.webcamEnabled && (
            <div className="recording-options-field">
              <label htmlFor="recording-webcam-size-select">Webcam size</label>
              <select
                id="recording-webcam-size-select"
                value={localSettings.webcamSize || 'large'}
                onChange={(e) => handleChange('webcamSize', e.target.value)}
                className="recording-options-select"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
          )}

          {localSettings.webcamEnabled && (
            <div className="recording-options-field">
              <label htmlFor="recording-camera-select">Camera</label>
              <select
                id="recording-camera-select"
                value={localSettings.selectedCameraId || ''}
                onChange={(e) => handleChange('selectedCameraId', e.target.value)}
                className="recording-options-select"
              >
                {availableCameras.length === 0 ? (
                  <option value="">Default camera</option>
                ) : (
                  availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
              
          {localSettings.recordInPresentMode && (
            <div className="recording-options-field">
              <label htmlFor="recording-microphone-select">Microphone</label>
              <select
                id="recording-microphone-select"
                value={localSettings.selectedMicrophoneId || ''}
                onChange={(e) => handleChange('selectedMicrophoneId', e.target.value)}
                className="recording-options-select"
              >
                {availableMicrophones.length === 0 ? (
                  <option value="">Default microphone</option>
                ) : (
                  availableMicrophones.map((microphone) => (
                    <option key={microphone.deviceId} value={microphone.deviceId}>
                      {microphone.label || `Microphone ${microphone.deviceId.slice(0, 8)}`}
                    </option>
                  ))
                )}
              </select>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default RecordingOptions
