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
    selectedMicrophoneId: recordSettings?.selectedMicrophoneId || '',
    videoBrightness: typeof recordSettings?.videoBrightness === 'number' ? recordSettings.videoBrightness : 1,
    videoContrast: typeof recordSettings?.videoContrast === 'number' ? recordSettings.videoContrast : 1,
    videoSaturation: typeof recordSettings?.videoSaturation === 'number' ? recordSettings.videoSaturation : 1,
    videoHue: typeof recordSettings?.videoHue === 'number' ? recordSettings.videoHue : 0
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
      selectedMicrophoneId: newSettings.selectedMicrophoneId,
      videoBrightness: newSettings.videoBrightness,
      videoContrast: newSettings.videoContrast,
      videoSaturation: newSettings.videoSaturation,
      videoHue: newSettings.videoHue,
      analyzeWithAI: newSettings.analyzeWithAI
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
                checked={localSettings.analyzeWithAI}
                onChange={(e) => handleChange('analyzeWithAI', e.target.checked)}
              />
              <span>Training mode: get AI feedback after recording</span>
            </label>
            <p className="recording-options-hint">Transcribes your recording and gives coach-style feedback on content and pacing.</p>
          </div>
          <div className="recording-options-field">
            <label className="recording-options-checkbox">
              <input
                type="checkbox"
                checked={localSettings.recordInPresentMode}
                onChange={(e) => handleChange('recordInPresentMode', e.target.checked)}
              />
              <span>Enable Recording</span>
            </label>
          </div>
          
          <div className="recording-options-field">
            <label className="recording-options-checkbox">
              <input
                type="checkbox"
                checked={localSettings.webcamEnabled}
                onChange={(e) => handleChange('webcamEnabled', e.target.checked)}
              />
              <span>Enable Webcam</span>
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

          <div className="recording-options-video-adj">
            <div className="recording-options-video-adj-title">Video adjustments</div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Brightness</label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={localSettings.videoBrightness}
                onChange={(e) => handleChange('videoBrightness', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{Math.round(localSettings.videoBrightness * 100)}%</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Contrast</label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={localSettings.videoContrast}
                onChange={(e) => handleChange('videoContrast', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{Math.round(localSettings.videoContrast * 100)}%</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Saturation</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={localSettings.videoSaturation}
                onChange={(e) => handleChange('videoSaturation', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{Math.round(localSettings.videoSaturation * 100)}%</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Hue</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={localSettings.videoHue}
                onChange={(e) => handleChange('videoHue', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{localSettings.videoHue}°</span>
            </div>
            <button
              type="button"
              className="recording-options-video-adj-reset"
              onClick={() => {
                setLocalSettings(prev => ({ ...prev, videoBrightness: 1, videoContrast: 1, videoSaturation: 1, videoHue: 0 }))
                onUpdateSettings?.({ ...recordSettings, videoBrightness: 1, videoContrast: 1, videoSaturation: 1, videoHue: 0 })
              }}
            >
              Reset
            </button>
          </div>
              
          {localSettings.recordInPresentMode && (
            <>
              <div className="recording-options-field">
                <label className="recording-options-checkbox">
                  <input
                    type="checkbox"
                    checked={localSettings.microphoneEnabled}
                    onChange={(e) => handleChange('microphoneEnabled', e.target.checked)}
                  />
                  <span>Enable Microphone</span>
                </label>
              </div>
              
              {localSettings.microphoneEnabled && (
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
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default RecordingOptions
