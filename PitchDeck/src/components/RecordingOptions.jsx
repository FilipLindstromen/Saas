import { useState, useEffect, useRef } from 'react'
import './RecordingOptions.css'

function RecordingOptions({ recordSettings, onClose, onUpdateSettings, buttonRef, embedded }) {
  const dropdownRef = useRef(null)
  const [localSettings, setLocalSettings] = useState({
    recordInPresentMode: recordSettings?.recordInPresentMode !== undefined ? recordSettings.recordInPresentMode : false,
    webcamEnabled: recordSettings?.webcamEnabled || false,
    webcamSize: recordSettings?.webcamSize || 'large',
    webcamFlipHorizontal: recordSettings?.webcamFlipHorizontal || false,
    webcamFlipVertical: recordSettings?.webcamFlipVertical || false,
    selectedCameraId: recordSettings?.selectedCameraId || '',
    microphoneEnabled: recordSettings?.microphoneEnabled || false,
    selectedMicrophoneId: recordSettings?.selectedMicrophoneId || '',
    recordingFileFormat: recordSettings?.recordingFileFormat || 'webm-vp9',
    recordingResolution: recordSettings?.recordingResolution || '1080p',
    recordingQuality: recordSettings?.recordingQuality || 'high',
    videoBrightness: typeof recordSettings?.videoBrightness === 'number' ? recordSettings.videoBrightness : 1,
    videoContrast: typeof recordSettings?.videoContrast === 'number' ? recordSettings.videoContrast : 1,
    videoSaturation: typeof recordSettings?.videoSaturation === 'number' ? recordSettings.videoSaturation : 1,
    videoShadows: typeof recordSettings?.videoShadows === 'number' ? recordSettings.videoShadows : 1,
    videoMidtones: typeof recordSettings?.videoMidtones === 'number' ? recordSettings.videoMidtones : 1,
    videoHighlights: typeof recordSettings?.videoHighlights === 'number' ? recordSettings.videoHighlights : 1,
    videoShadowHue: typeof recordSettings?.videoShadowHue === 'number' ? recordSettings.videoShadowHue : 0,
    videoMidHue: typeof recordSettings?.videoMidHue === 'number' ? recordSettings.videoMidHue : 0,
    videoHighlightHue: typeof recordSettings?.videoHighlightHue === 'number' ? recordSettings.videoHighlightHue : 0
  })
  const [availableCameras, setAvailableCameras] = useState([])
  const [availableMicrophones, setAvailableMicrophones] = useState([])

  useEffect(() => {
    loadDevices()
  }, [])

  // Position dropdown relative to button (skip when embedded)
  useEffect(() => {
    if (embedded) return
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
  }, [buttonRef, embedded])

  // Close on escape key (skip when embedded)
  useEffect(() => {
    if (embedded) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [onClose, embedded])

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
      webcamFlipHorizontal: newSettings.webcamFlipHorizontal ?? false,
      webcamFlipVertical: newSettings.webcamFlipVertical ?? false,
      selectedCameraId: newSettings.selectedCameraId,
      microphoneEnabled: newSettings.microphoneEnabled,
      selectedMicrophoneId: newSettings.selectedMicrophoneId,
      recordingFileFormat: newSettings.recordingFileFormat,
      recordingResolution: newSettings.recordingResolution,
      recordingQuality: newSettings.recordingQuality,
      videoBrightness: newSettings.videoBrightness,
      videoContrast: newSettings.videoContrast,
      videoSaturation: newSettings.videoSaturation,
      videoShadows: newSettings.videoShadows,
      videoMidtones: newSettings.videoMidtones,
      videoHighlights: newSettings.videoHighlights,
      videoShadowHue: newSettings.videoShadowHue,
      videoMidHue: newSettings.videoMidHue,
      videoHighlightHue: newSettings.videoHighlightHue,
      analyzeWithAI: newSettings.analyzeWithAI
    }
    
    // Update global record settings immediately
    if (onUpdateSettings) {
      onUpdateSettings(updatedSettings)
    }
  }

  const content = (
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

          {localSettings.webcamEnabled && (
            <div className="recording-options-field">
              <label className="recording-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.webcamFlipHorizontal}
                  onChange={(e) => handleChange('webcamFlipHorizontal', e.target.checked)}
                />
                <span>Flip camera horizontally</span>
              </label>
            </div>
          )}

          {localSettings.webcamEnabled && (
            <div className="recording-options-field">
              <label className="recording-options-checkbox">
                <input
                  type="checkbox"
                  checked={localSettings.webcamFlipVertical}
                  onChange={(e) => handleChange('webcamFlipVertical', e.target.checked)}
                />
                <span>Flip camera vertically</span>
              </label>
            </div>
          )}

          <div className="recording-options-output-section">
            <div className="recording-options-video-adj-title">Recording output</div>
            <div className="recording-options-field">
              <label htmlFor="recording-format-select">File format</label>
              <select
                id="recording-format-select"
                value={localSettings.recordingFileFormat || 'webm-vp9'}
                onChange={(e) => handleChange('recordingFileFormat', e.target.value)}
                className="recording-options-select"
              >
                <option value="webm-vp9">WebM (VP9)</option>
                <option value="webm-vp8">WebM (VP8)</option>
                <option value="webm">WebM (browser default)</option>
              </select>
            </div>
            <div className="recording-options-field">
              <label htmlFor="recording-resolution-select">Resolution</label>
              <select
                id="recording-resolution-select"
                value={localSettings.recordingResolution || '1080p'}
                onChange={(e) => handleChange('recordingResolution', e.target.value)}
                className="recording-options-select"
              >
                <option value="original">Original (share resolution)</option>
                <option value="1080p">1080p (1920×1080)</option>
                <option value="720p">720p (1280×720)</option>
                <option value="480p">480p (854×480)</option>
              </select>
            </div>
            <div className="recording-options-field">
              <label htmlFor="recording-quality-select">Quality</label>
              <select
                id="recording-quality-select"
                value={localSettings.recordingQuality || 'high'}
                onChange={(e) => handleChange('recordingQuality', e.target.value)}
                className="recording-options-select"
              >
                <option value="low">Low (~1 Mbps)</option>
                <option value="medium">Medium (~2.5 Mbps)</option>
                <option value="high">High (~5 Mbps)</option>
              </select>
            </div>
          </div>

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
              <label className="recording-options-video-adj-label">Shadows (dark)</label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={localSettings.videoShadows}
                onChange={(e) => handleChange('videoShadows', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{Math.round(localSettings.videoShadows * 100)}%</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Midtones</label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={localSettings.videoMidtones}
                onChange={(e) => handleChange('videoMidtones', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{Math.round(localSettings.videoMidtones * 100)}%</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Highlights (bright)</label>
              <input
                type="range"
                min="0.5"
                max="1.5"
                step="0.05"
                value={localSettings.videoHighlights}
                onChange={(e) => handleChange('videoHighlights', parseFloat(e.target.value))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{Math.round(localSettings.videoHighlights * 100)}%</span>
            </div>
            <div className="recording-options-video-adj-title recording-options-video-adj-title-sub">Color (hue)</div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Dark color</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={localSettings.videoShadowHue ?? 0}
                onChange={(e) => handleChange('videoShadowHue', parseInt(e.target.value, 10))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{localSettings.videoShadowHue ?? 0}°</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Mid color</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={localSettings.videoMidHue ?? 0}
                onChange={(e) => handleChange('videoMidHue', parseInt(e.target.value, 10))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{localSettings.videoMidHue ?? 0}°</span>
            </div>
            <div className="recording-options-video-adj-row">
              <label className="recording-options-video-adj-label">Highlight color</label>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={localSettings.videoHighlightHue ?? 0}
                onChange={(e) => handleChange('videoHighlightHue', parseInt(e.target.value, 10))}
                className="recording-options-video-adj-slider"
              />
              <span className="recording-options-video-adj-value">{localSettings.videoHighlightHue ?? 0}°</span>
            </div>
            <button
              type="button"
              className="recording-options-video-adj-reset"
              onClick={() => {
                const defaults = { videoBrightness: 1, videoContrast: 1, videoSaturation: 1, videoShadows: 1, videoMidtones: 1, videoHighlights: 1, videoShadowHue: 0, videoMidHue: 0, videoHighlightHue: 0 }
                setLocalSettings(prev => ({ ...prev, ...defaults }))
                onUpdateSettings?.({ ...recordSettings, ...defaults })
              }}
            >
              Reset
            </button>
          </div>
    </div>
  )

  if (embedded) {
    return content
  }
  return (
    <>
      <div className="recording-options-backdrop" onClick={onClose} />
      <div className="recording-options-dropdown" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </>
  )
}

export default RecordingOptions
