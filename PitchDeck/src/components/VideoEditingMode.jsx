import { useState, useEffect, useRef, useCallback } from 'react'
import { transcribeRecording } from '../services/presentationAnalysis'
import { exportTrimmedVideo, convertToMp4 } from '../utils/ffmpegExport'
import './VideoEditingMode.css'

function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function VideoEditingMode({ videoBlob, latestRecordingRef, onExit, openaiKey }) {
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const fileUrlRef = useRef(null)
  const playbackBlobRef = useRef(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const timelineRef = useRef(null)

  // Left panel: transcription (transcribeStatus shows "Compressing…" / "Transcribing…" on the button)
  const [transcript, setTranscript] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState('')
  const [transcribeError, setTranscribeError] = useState(null)

  // Resizable panels (px)
  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [rightPanelWidth, setRightPanelWidth] = useState(280)
  const leftResizeRef = useRef({ dragging: false, startX: 0, startW: 0 })
  const rightResizeRef = useRef({ dragging: false, startX: 0, startW: 0 })

  // Right panel: settings
  const [studioSound, setStudioSound] = useState(false)
  const [addCaptions, setAddCaptions] = useState(false)
  const [captionStyle, setCaptionStyle] = useState('bottom-black')
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')

  const revokeUrl = useCallback(() => {
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current)
      fileUrlRef.current = null
    }
  }, [])

  const loadBlob = useCallback((blob) => {
    if (!blob) return
    setLoadError(null)
    revokeUrl()
    setVideoUrl(null)
    setDuration(0)
    setTranscript('')
    setTranscribeError(null)
    playbackBlobRef.current = null

    const url = URL.createObjectURL(blob)
    fileUrlRef.current = url
    playbackBlobRef.current = blob
    setVideoUrl(url)
  }, [revokeUrl])

  useEffect(() => {
    const blob = latestRecordingRef?.current ?? videoBlob
    if (blob) {
      loadBlob(blob)
      return () => revokeUrl()
    } else {
      revokeUrl()
      setVideoUrl(null)
      setDuration(0)
      setCurrentTime(0)
      setTranscript('')
    }
  }, [latestRecordingRef, videoBlob, loadBlob, revokeUrl])

  useEffect(() => () => revokeUrl(), [revokeUrl])

  const applyDuration = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const d = video.duration
    if (Number.isFinite(d) && d > 0 && !Number.isNaN(d)) setDuration(d)
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    setLoadError(null)
    const onMeta = () => applyDuration()
    const onTimeUpdate = () => applyDuration()
    const onError = () => {
      const err = video.error
      const msg = err?.message || (err?.code === 4 ? 'Video format or codec not supported.' : 'Video failed to load.')
      setLoadError(msg)
    }
    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('durationchange', onMeta)
    video.addEventListener('canplay', onMeta)
    video.addEventListener('loadeddata', onMeta)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('durationchange', onMeta)
      video.removeEventListener('canplay', onMeta)
      video.removeEventListener('loadeddata', onMeta)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('error', onError)
    }
  }, [videoUrl, applyDuration])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onEnded = () => setPlaying(false)
    video.addEventListener('ended', onEnded)
    return () => video.removeEventListener('ended', onEnded)
  }, [videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let rafId = null
    const tick = () => {
      if (video.paused || video.ended) return
      const t = video.currentTime
      setCurrentTime(t)
      // Some sources (e.g. WebM from MediaRecorder) only report duration after playback starts
      const d = video.duration
      if (Number.isFinite(d) && d > 0 && !Number.isNaN(d)) setDuration(d)
      rafId = requestAnimationFrame(tick)
    }
    if (playing) {
      video.play().catch(() => setPlaying(false))
      rafId = requestAnimationFrame(tick)
    } else {
      video.pause()
    }
    return () => { if (rafId != null) cancelAnimationFrame(rafId) }
  }, [playing])

  const togglePlay = () => setPlaying((p) => !p)

  const seekTo = (time) => {
    const video = videoRef.current
    if (!video) return
    let t = Number.isFinite(time) ? time : 0
    if (Number.isFinite(duration) && duration > 0) t = Math.max(0, Math.min(duration, t))
    video.currentTime = t
    setCurrentTime(t)
  }

  const handleTimelineClick = (e) => {
    const effective = Number.isFinite(duration) && duration > 0 ? duration : Math.max(currentTime, 0) || 1
    if (!timelineRef.current || effective <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = rect.width > 0 ? Math.max(0, Math.min(1, x / rect.width)) : 0
    seekTo(pct * effective)
  }

  const WHISPER_MAX_BYTES = 25 * 1024 * 1024 // 25 MB API limit

  /** Extract audio from video using browser APIs (no FFmpeg). Returns an audio blob, usually much smaller. */
  const extractAudioFromVideo = useCallback((videoBlob, onProgress) => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(videoBlob)
      const video = document.createElement('video')
      video.muted = true
      video.preload = 'auto'
      video.playsInline = true
      video.src = url

      const cleanup = () => {
        URL.revokeObjectURL(url)
        video.src = ''
        video.load()
      }

      video.onerror = () => {
        cleanup()
        reject(new Error('Video failed to load for audio extraction.'))
      }

      video.onloadedmetadata = () => {
        const stream = video.captureStream?.() ?? video.mozCaptureStream?.()
        if (!stream) {
          cleanup()
          reject(new Error('Audio extraction not supported in this browser.'))
          return
        }
        const audioTracks = stream.getAudioTracks()
        if (!audioTracks.length) {
          cleanup()
          reject(new Error('No audio track in video.'))
          return
        }
        const audioStream = new MediaStream(audioTracks)
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm'
        const recorder = new MediaRecorder(audioStream)
        const chunks = []
        recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data) }
        recorder.onstop = () => {
          cleanup()
          const audioBlob = new Blob(chunks, { type: mimeType })
          resolve(audioBlob)
        }
        recorder.start(2000)
        if (onProgress) onProgress('Extracting audio…')
        video.play().catch((err) => {
          try { recorder.stop() } catch (_) {}
          cleanup()
          reject(new Error('Could not play video for audio extraction.'))
        })
        video.onended = () => recorder.stop()
        const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 300
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }, Math.min(duration * 1000 * 1.5, 5 * 60 * 1000))
      }

      video.load()
    })
  }, [])

  const handleTranscribe = async () => {
    const blob = playbackBlobRef.current
    if (!blob || !openaiKey?.trim()) {
      setTranscribeError(openaiKey?.trim() ? 'No video loaded.' : 'Add your OpenAI API key in Settings.')
      return
    }
    setIsTranscribing(true)
    setTranscribeError(null)
    setTranscribeStatus('')
    try {
      let audioBlob = blob
      if (blob.size > WHISPER_MAX_BYTES) {
        setTranscribeStatus('Extracting audio…')
        const extracted = await Promise.race([
          extractAudioFromVideo(blob, setTranscribeStatus),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Audio extraction is taking too long. Try a shorter clip.')), 5 * 60 * 1000)
          )
        ])
        if (extracted.size > WHISPER_MAX_BYTES) {
          const mb = (extracted.size / (1024 * 1024)).toFixed(1)
          setTranscribeError(`Audio is still too large (${mb} MB). Try a shorter clip.`)
          return
        }
        const ext = extracted.type?.includes('webm') ? 'webm' : 'mp4'
        audioBlob = new File([extracted], `audio.${ext}`, { type: extracted.type || 'audio/webm' })
        setTranscribeStatus('Transcribing…')
      } else {
        setTranscribeStatus('Transcribing…')
      }
      const text = await Promise.race([
        transcribeRecording(audioBlob, openaiKey.trim()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transcription is taking too long. Try again.')), 60000)
        )
      ])
      setTranscript(text || '')
    } catch (e) {
      setTranscribeError(e?.message || 'Transcription failed.')
    } finally {
      setIsTranscribing(false)
      setTranscribeStatus('')
    }
  }

  const handleLeftResizeStart = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    leftResizeRef.current = { dragging: true, startX: e.clientX, startW: leftPanelWidth }
    const onMove = (e2) => {
      if (!leftResizeRef.current.dragging) return
      const delta = e2.clientX - leftResizeRef.current.startX
      setLeftPanelWidth(Math.min(500, Math.max(240, leftResizeRef.current.startW + delta)))
    }
    const onUp = () => {
      leftResizeRef.current.dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [leftPanelWidth])

  const handleRightResizeStart = useCallback((e) => {
    if (e.button !== 0) return
    e.preventDefault()
    rightResizeRef.current = { dragging: true, startX: e.clientX, startW: rightPanelWidth }
    const onMove = (e2) => {
      if (!rightResizeRef.current.dragging) return
      const delta = rightResizeRef.current.startX - e2.clientX
      setRightPanelWidth(Math.min(480, Math.max(200, rightResizeRef.current.startW + delta)))
    }
    const onUp = () => {
      rightResizeRef.current.dragging = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [rightPanelWidth])

  const handleExport = useCallback(async () => {
    const blob = playbackBlobRef.current
    if (!blob || duration <= 0) return
    if (addCaptions && !transcript?.trim()) {
      alert('Add captions is enabled but the transcript is empty. Transcribe the video first or disable captions.')
      return
    }
    setIsExporting(true)
    setExportProgress('Preparing…')
    try {
      const segments = [{ start: 0, end: duration }]
      setExportProgress('Exporting with FFmpeg…')
      const exportOpts = { onProgress: setExportProgress }
      if (addCaptions && transcript?.trim()) {
        exportOpts.captions = { transcript: transcript.trim(), duration, style: captionStyle }
      }
      const result = await exportTrimmedVideo(blob, segments, exportOpts)
      const ext = result.type?.includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(result)
      const a = document.createElement('a')
      a.href = url
      a.download = `video-export-${new Date().toISOString().split('T')[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
      setExportProgress('')
      alert('Export failed: ' + (e?.message ?? 'Unknown error'))
      return
    }
    setExportProgress('')
    setIsExporting(false)
  }, [duration, addCaptions, transcript, captionStyle])

  if (!videoUrl) {
    return (
      <div className="video-editing-mode">
        <header className="video-editing-header">
          <h1 className="video-editing-title">Video editing</h1>
          <button type="button" className="video-editing-btn-exit" onClick={onExit}>Exit</button>
        </header>
        <div className="video-editing-empty">
          {loadError && <p className="video-editing-empty-error">{loadError}</p>}
          <p>No video loaded. Record a presentation first, or load a video file (WebM, MP4, OGG).</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/webm,video/mp4,video/ogg"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) loadBlob(file)
              e.target.value = ''
            }}
          />
          <button type="button" className="video-editing-btn-primary" onClick={() => fileInputRef.current?.click()}>
            Load video file
          </button>
        </div>
      </div>
    )
  }

  // Use reported duration when valid; otherwise show at least current time so timeline has full length
  const displayDuration = Number.isFinite(duration) && duration > 0 ? duration : Math.max(currentTime, 0) || 1
  const currentPct = Math.min(100, Math.max(0, (currentTime / displayDuration) * 100))

  return (
    <div className="video-editing-mode">
      <header className="video-editing-header">
        <h1 className="video-editing-title">Video editing</h1>
        <button type="button" className="video-editing-btn-exit" onClick={onExit}>Exit</button>
      </header>

      <div className="video-editing-layout">
        {/* Left panel: Transcription */}
        <aside className="video-editing-panel video-editing-panel-left" style={{ width: leftPanelWidth }}>
          <h2 className="video-editing-panel-title">Transcription</h2>
          <p className="video-editing-panel-desc">Transcribe this video with OpenAI Whisper.</p>
          <button
            type="button"
            className="video-editing-btn-primary"
            onClick={handleTranscribe}
            disabled={isTranscribing || !openaiKey?.trim()}
          >
            {isTranscribing ? (transcribeStatus || 'Transcribing…') : 'Transcribe with OpenAI'}
          </button>
          {transcribeError && <p className="video-editing-error" role="alert">{transcribeError}</p>}
          {transcript && (
            <div className="video-editing-transcript">
              <label className="video-editing-transcript-label">Transcript</label>
              <textarea
                className="video-editing-transcript-text"
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                readOnly={false}
                rows={12}
                placeholder="Transcript will appear here…"
              />
            </div>
          )}
        </aside>

        <div
          className="video-editing-resize-handle video-editing-resize-handle-left"
          onMouseDown={handleLeftResizeStart}
          role="separator"
          aria-label="Resize left panel"
        />

        {/* Center: Video + timeline */}
        <main className="video-editing-main">
          <div className="video-editing-preview">
            {loadError && <div className="video-editing-load-error" role="alert">{loadError}</div>}
            <video ref={videoRef} src={videoUrl} preload="auto" playsInline muted={false} />
          </div>

          <div className="video-editing-controls">
            <button
              type="button"
              className="video-editing-btn-play"
              onClick={togglePlay}
              title={playing ? 'Pause' : 'Play'}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
            <span className="video-editing-time-display" aria-live="polite">
              {formatTime(currentTime)} / {formatTime(displayDuration)}
            </span>
          </div>

          <div className="video-editing-timeline-wrap">
            <div
              ref={timelineRef}
              className="video-editing-timeline"
              onClick={handleTimelineClick}
              role="slider"
              aria-label="Timeline"
              aria-valuemin={0}
              aria-valuemax={displayDuration}
              aria-valuenow={currentTime}
              tabIndex={0}
              onKeyDown={(e) => {
                const step = e.shiftKey ? 10 : 1
                if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(currentTime - step) }
                if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(currentTime + step) }
              }}
            >
              <div className="video-editing-timeline-track">
                <div className="video-editing-timeline-progress" style={{ width: `${currentPct}%` }} />
                <div className="video-editing-timeline-playhead" style={{ left: `${currentPct}%` }} />
              </div>
            </div>
            <div className="video-editing-timeline-labels">
              <span>0:00</span>
              <span>{formatTime(displayDuration)}</span>
            </div>
          </div>
        </main>

        <div
          className="video-editing-resize-handle video-editing-resize-handle-right"
          onMouseDown={handleRightResizeStart}
          role="separator"
          aria-label="Resize right panel"
        />

        {/* Right panel: Settings */}
        <aside className="video-editing-panel video-editing-panel-right" style={{ width: rightPanelWidth }}>
          <h2 className="video-editing-panel-title">Settings</h2>

          <div className="video-editing-setting">
            <label className="video-editing-toggle-row">
              <input
                type="checkbox"
                checked={studioSound}
                onChange={(e) => setStudioSound(e.target.checked)}
              />
              <span>Studio sound</span>
            </label>
            <p className="video-editing-setting-hint">Enhance audio for a cleaner output (applied on export).</p>
          </div>

          <div className="video-editing-setting">
            <label className="video-editing-toggle-row">
              <input
                type="checkbox"
                checked={addCaptions}
                onChange={(e) => setAddCaptions(e.target.checked)}
              />
              <span>Add captions</span>
            </label>
            {addCaptions && (
              <select
                className="video-editing-select"
                value={captionStyle}
                onChange={(e) => setCaptionStyle(e.target.value)}
              >
                <option value="bottom-black">Bottom (black bar)</option>
                <option value="bottom-white">Bottom (white bar)</option>
                <option value="top-black">Top (black bar)</option>
                <option value="white-outline">White outline</option>
              </select>
            )}
            <p className="video-editing-setting-hint">Burn captions from transcript into the video (requires transcript).</p>
          </div>

          <div className="video-editing-setting video-editing-export">
            <button
              type="button"
              className="video-editing-btn-primary video-editing-btn-export"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? exportProgress || 'Exporting…' : 'Export video (FFmpeg)'}
            </button>
            <p className="video-editing-setting-hint">Export as WebM/MP4 using FFmpeg in the browser.</p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default VideoEditingMode
