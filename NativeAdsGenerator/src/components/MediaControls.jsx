import { useRef, useState } from 'react'
import './MediaControls.css'

export default function MediaControls({
  mediaMode,
  onMediaModeChange,
  onUploadImage,
  onUploadVideo,
  onWebcamPhoto,
  onStartWebcamVideo,
  onStopWebcam,
  onOpenUnsplash,
  onOpenPexelsVideo,
  webcamActive,
  webcamPhotoPreview,
  hasMedia,
  mediaScale,
  onMediaScaleChange,
  onResetTransform,
  isVideoBackground = false,
  backgroundMusic,
  musicVolume = 0.8,
  onUploadMusic,
  onRemoveMusic,
  onMusicVolumeChange,
  embedded = false,
}) {
  const imageInputRef = useRef(null)
  const videoInputRef = useRef(null)
  const musicInputRef = useRef(null)
  const [error, setError] = useState(null)

  const handleImageFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError(null)
    onUploadImage(file)
    e.target.value = ''
  }

  const handleVideoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('video/')) {
      setError('Please choose a video file.')
      return
    }
    setError(null)
    onUploadVideo(file)
    e.target.value = ''
  }

  const handleMusicFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('audio/')) {
      setError('Please choose an audio file.')
      return
    }
    setError(null)
    onUploadMusic?.(file)
    e.target.value = ''
  }

  return (
    <section className={`nag-panel-section ${embedded ? 'nag-panel-embedded' : ''}`}>
      {!embedded && <h3 className="nag-section-title">Media</h3>}
      {error && <p className="nag-error">{error}</p>}

      <div className="nag-btn-grid">
        <button type="button" className="nag-btn" onClick={() => imageInputRef.current?.click()}>
          Upload image
        </button>
        <button type="button" className="nag-btn" onClick={() => videoInputRef.current?.click()}>
          Upload video
        </button>
        <button
          type="button"
          className={`nag-btn ${webcamPhotoPreview ? 'active' : ''}`}
          onClick={async () => {
            setError(null)
            try {
              await onWebcamPhoto()
            } catch (err) {
              setError(err?.message || 'Webcam failed')
            }
          }}
        >
          {webcamPhotoPreview ? 'Take photo' : 'Webcam photo'}
        </button>
        <button
          type="button"
          className={`nag-btn ${webcamActive ? 'active' : ''}`}
          onClick={async () => {
            setError(null)
            try {
              if (webcamActive) {
                onStopWebcam()
                return
              }
              await onStartWebcamVideo()
              onMediaModeChange('webcam-video')
            } catch (err) {
              setError(err?.message || 'Webcam failed')
            }
          }}
        >
          {webcamActive ? 'Stop webcam' : 'Webcam video'}
        </button>
        <button type="button" className="nag-btn nag-btn-accent" onClick={onOpenUnsplash}>
          Unsplash
        </button>
        <button type="button" className="nag-btn nag-btn-accent" onClick={onOpenPexelsVideo}>
          Pexels video
        </button>
      </div>

      <input ref={imageInputRef} type="file" accept="image/*" hidden onChange={handleImageFile} />
      <input ref={videoInputRef} type="file" accept="video/*" hidden onChange={handleVideoFile} />
      <input ref={musicInputRef} type="file" accept="audio/*" hidden onChange={handleMusicFile} />

      {isVideoBackground && (
        <div className="nag-field-group nag-music-group">
          <label className="nag-label">Background music</label>
          <div className="nag-music-row">
            <button type="button" className="nag-btn" onClick={() => musicInputRef.current?.click()}>
              {backgroundMusic ? 'Replace music' : 'Upload music'}
            </button>
            {backgroundMusic && (
              <button type="button" className="nag-btn nag-btn-ghost nag-music-remove" onClick={onRemoveMusic}>
                Remove
              </button>
            )}
          </div>
          {backgroundMusic && (
            <>
              <p className="nag-music-name" title={backgroundMusic.name}>{backgroundMusic.name}</p>
              <label className="nag-label">
                Music volume
                <span className="nag-label-value">{Math.round(musicVolume * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={(e) => onMusicVolumeChange?.(parseFloat(e.target.value))}
              />
              <p className="nag-hint">Music is mixed into the exported video. Loops if shorter than the clip.</p>
            </>
          )}
        </div>
      )}

      {hasMedia && (
        <div className="nag-field-group">
          <label className="nag-label">
            Scale
            <span className="nag-label-value">{Math.round(mediaScale * 100)}%</span>
          </label>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={mediaScale}
            onChange={(e) => onMediaScaleChange(parseFloat(e.target.value))}
          />
          <p className="nag-hint">Drag the preview to move the image or video.</p>
          <button type="button" className="nag-btn nag-btn-ghost" onClick={onResetTransform}>
            Reset position & scale
          </button>
        </div>
      )}

      {mediaMode && (
        <p className="nag-media-status">
          Source: <strong>{mediaMode.replace('-', ' ')}</strong>
        </p>
      )}
    </section>
  )
}
