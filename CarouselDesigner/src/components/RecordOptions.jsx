import { useState, useEffect } from 'react'
import './RecordOptions.css'

function RecordOptions({ recordSettings, onUpdate, onClose }) {
  const [localSettings, setLocalSettings] = useState(recordSettings)
  const [availableCameras, setAvailableCameras] = useState([])
  const [availableMicrophones, setAvailableMicrophones] = useState([])

  useEffect(() => {
    loadDevices()
  }, [])

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
    const updated = { ...localSettings, [key]: value }
    setLocalSettings(updated)
  }

  const handleSave = () => {
    onUpdate(localSettings)
    onClose()
  }

  return (
    <div className="record-options-overlay" onClick={onClose}>
      <div className="record-options-modal" onClick={(e) => e.stopPropagation()}>
        <div className="record-options-header">
          <h2>Record Options</h2>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>
        <div className="record-options-content">
          <div className="record-options-section">
            <h3>Webcam</h3>
            <div className="record-options-field">
              <label className="record-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.webcamEnabled || false}
                  onChange={(e) => handleChange('webcamEnabled', e.target.checked)}
                />
                <span>Enable Webcam</span>
              </label>
            </div>
            {localSettings.webcamEnabled && availableCameras.length > 0 && (
              <div className="record-options-field">
                <label htmlFor="camera-select">Camera</label>
                <select
                  id="camera-select"
                  value={localSettings.selectedCameraId || ''}
                  onChange={(e) => handleChange('selectedCameraId', e.target.value)}
                  className="record-options-select"
                >
                  {availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId}>
                      {camera.label || `Camera ${camera.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          
          <div className="record-options-section">
            <h3>Microphone</h3>
            <div className="record-options-field">
              <label className="record-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.microphoneEnabled || false}
                  onChange={(e) => handleChange('microphoneEnabled', e.target.checked)}
                />
                <span>Enable Microphone</span>
              </label>
            </div>
            {localSettings.microphoneEnabled && availableMicrophones.length > 0 && (
              <div className="record-options-field">
                <label htmlFor="microphone-select">Microphone</label>
                <select
                  id="microphone-select"
                  value={localSettings.selectedMicrophoneId || ''}
                  onChange={(e) => handleChange('selectedMicrophoneId', e.target.value)}
                  className="record-options-select"
                >
                  {availableMicrophones.map((microphone) => (
                    <option key={microphone.deviceId} value={microphone.deviceId}>
                      {microphone.label || `Microphone ${microphone.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="record-options-footer">
          <button className="btn-primary" onClick={handleSave}>Save</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default RecordOptions
