import { useState, useEffect, useRef, useCallback } from 'react'
import { transcribeWithSegments } from '../services/presentationAnalysis'
import { exportTrimmedVideo, extractAudioForWhisper, WHISPER_MAX_BYTES, preloadFFmpeg, getFfmpegApiBase } from '../utils/ffmpegExport'
import './VideoEditingMode.css'

function wordId() {
  return `w_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Merge consecutive words into segments for export/captions (fewer clips). */
function wordsToSegments(words) {
  if (!words.length) return []
  const out = []
  let start = words[0].start
  let end = words[0].end
  let text = words[0].word
  for (let i = 1; i < words.length; i++) {
    const w = words[i]
    if (w.start <= end + 0.15) {
      end = w.end
      text += ' ' + w.word
    } else {
      out.push({ start, end, text })
      start = w.start
      end = w.end
      text = w.word
    }
  }
  out.push({ start, end, text })
  return out
}

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
  const [fileSize, setFileSize] = useState(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const timelineRef = useRef(null)

  // Left panel: word-level transcript (edit by cutting/moving words → clips)
  const [words, setWords] = useState([])
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [transcribeStatus, setTranscribeStatus] = useState('')
  const [transcribeError, setTranscribeError] = useState(null)
  const [currentWordIndex, setCurrentWordIndex] = useState(null)
  const [draggingWordId, setDraggingWordId] = useState(null)
  const dragOverWordIdRef = useRef(null)

  // Resizable panels (px)
  const [leftPanelWidth, setLeftPanelWidth] = useState(320)
  const [rightPanelWidth, setRightPanelWidth] = useState(280)
  const leftResizeRef = useRef({ dragging: false, startX: 0, startW: 0 })
  const rightResizeRef = useRef({ dragging: false, startX: 0, startW: 0 })

  // Right panel: settings
  const [studioSound, setStudioSound] = useState(false)
  const [addCaptions, setAddCaptions] = useState(false)
  const [captionStyle, setCaptionStyle] = useState('bottom-black')
  const [exportFormat, setExportFormat] = useState('mp4')
  const [exportQuality, setExportQuality] = useState('high')
  const [exportResolution, setExportResolution] = useState('original')
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
    setWords([])
    setTranscribeError(null)
    setCurrentWordIndex(null)
    playbackBlobRef.current = null

    const url = URL.createObjectURL(blob)
    fileUrlRef.current = url
    playbackBlobRef.current = blob
    setVideoUrl(url)
    setFileSize(blob.size)
  }, [revokeUrl])

  useEffect(() => {
    const blob = latestRecordingRef?.current ?? videoBlob
    if (blob) {
      loadBlob(blob)
      return () => revokeUrl()
    } else {
      revokeUrl()
      setVideoUrl(null)
      setFileSize(null)
      setDuration(0)
      setCurrentTime(0)
      setWords([])
    }
  }, [latestRecordingRef, videoBlob, loadBlob, revokeUrl])

  useEffect(() => () => revokeUrl(), [revokeUrl])

  // Preload FFmpeg as soon as video editing is open so it's ready before Transcribe/Export
  useEffect(() => {
    preloadFFmpeg()
  }, [])

  const applyDuration = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const d = video.duration
    if (Number.isFinite(d) && d > 0 && !Number.isNaN(d)) setDuration(d)
  }, [])

  const discoveredDurationRef = useRef(false)
  useEffect(() => {
    discoveredDurationRef.current = false
  }, [videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    setLoadError(null)
    const onMeta = () => applyDuration()
    const onTimeUpdate = () => applyDuration()

    const discoverWebMDuration = () => {
      if (discoveredDurationRef.current) return
      const d = video.duration
      const suspicious = !Number.isFinite(d) || d <= 0 || Number.isNaN(d) || d < 2
      if (!suspicious) return
      discoveredDurationRef.current = true
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked)
        const realEnd = video.currentTime
        if (Number.isFinite(realEnd) && realEnd > 0) {
          setDuration(realEnd)
          setCurrentTime(0)
          video.currentTime = 0
        }
      }
      video.addEventListener('seeked', onSeeked)
      video.currentTime = 86400
    }

    const onLoadedMeta = () => {
      onMeta()
      discoverWebMDuration()
    }

    const onError = () => {
      const err = video.error
      const msg = err?.message || (err?.code === 4 ? 'Video format or codec not supported.' : 'Video failed to load.')
      setLoadError(msg)
    }
    video.addEventListener('loadedmetadata', onLoadedMeta)
    video.addEventListener('durationchange', onMeta)
    video.addEventListener('canplay', onMeta)
    video.addEventListener('loadeddata', onMeta)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMeta)
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

  // Sync current word highlight when currentTime changes while paused (e.g. timeline click)
  useEffect(() => {
    if (words.length === 0 || playing) return
    const idx = words.findIndex((w) => currentTime >= w.start && currentTime < w.end)
    setCurrentWordIndex((prev) => (idx >= 0 ? idx : prev === null ? 0 : prev))
  }, [currentTime, playing, words])

  // Word-based playback: jump to next word when current word ends
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let rafId = null
    const useWords = words.length > 0
    const tick = () => {
      if (video.paused || video.ended) return
      const t = video.currentTime
      setCurrentTime(t)
      const d = video.duration
      if (Number.isFinite(d) && d > 0 && !Number.isNaN(d)) setDuration(d)
      if (useWords && currentWordIndex != null && currentWordIndex < words.length) {
        const w = words[currentWordIndex]
        if (w && t >= w.end - 0.05) {
          const next = currentWordIndex + 1
          if (next < words.length) {
            setCurrentWordIndex(next)
            video.currentTime = words[next].start
          } else {
            setPlaying(false)
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    if (playing) {
      if (useWords && words.length > 0) {
        let idx = currentWordIndex
        if (idx == null || idx < 0 || idx >= words.length) {
          const t = video.currentTime
          idx = words.findIndex((w) => t >= w.start && t < w.end)
          if (idx < 0) idx = 0
          setCurrentWordIndex(idx)
        }
        video.currentTime = words[idx].start
      }
      video.play().catch(() => setPlaying(false))
      rafId = requestAnimationFrame(tick)
    } else {
      video.pause()
    }
    return () => { if (rafId != null) cancelAnimationFrame(rafId) }
  }, [playing, words, currentWordIndex])

  const togglePlay = () => setPlaying((p) => !p)

  const seekTo = (time) => {
    const video = videoRef.current
    if (!video) return
    let t = Number.isFinite(time) ? time : 0
    if (Number.isFinite(duration) && duration > 0) t = Math.max(0, Math.min(duration, t))
    video.currentTime = t
    setCurrentTime(t)
    if (words.length > 0) {
      const idx = words.findIndex((w) => t >= w.start && t < w.end)
      setCurrentWordIndex(idx >= 0 ? idx : null)
    }
  }

  const seekToWord = (word, index) => {
    seekTo(word.start)
    setCurrentWordIndex(index)
  }

  const deleteWord = (id) => {
    setWords((prev) => prev.filter((w) => w.id !== id))
    setCurrentWordIndex((prev) => {
      if (prev == null) return null
      const idx = words.findIndex((w) => w.id === id)
      if (idx < 0) return prev
      if (prev === idx) return Math.max(0, prev - 1)
      if (prev > idx) return prev - 1
      return prev
    })
  }

  const moveWord = (fromIndex, toIndex) => {
    if (fromIndex === toIndex || toIndex < 0 || toIndex >= words.length) return
    setWords((prev) => {
      const next = [...prev]
      const [removed] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, removed)
      return next
    })
    setCurrentWordIndex((prev) => {
      if (prev == null) return null
      if (prev === fromIndex) return toIndex
      if (fromIndex < toIndex) {
        if (prev > fromIndex && prev <= toIndex) return prev - 1
        return prev
      }
      if (fromIndex > toIndex) {
        if (prev >= toIndex && prev < fromIndex) return prev + 1
        return prev
      }
      return prev
    })
  }

  const handleWordDragStart = (e, id) => {
    if (e.button !== 0) return
    setDraggingWordId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleWordDragOver = (e, id) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverWordIdRef.current = id
  }

  const handleWordDrop = (e, dropId) => {
    e.preventDefault()
    const fromId = draggingWordId ?? e.dataTransfer.getData('text/plain')
    setDraggingWordId(null)
    dragOverWordIdRef.current = null
    if (!fromId || fromId === dropId) return
    const fromIdx = words.findIndex((w) => w.id === fromId)
    const toIdx = words.findIndex((w) => w.id === dropId)
    if (fromIdx >= 0 && toIdx >= 0) moveWord(fromIdx, toIdx)
  }

  const handleWordDragEnd = () => {
    setDraggingWordId(null)
    dragOverWordIdRef.current = null
  }

  const handleTimelineClick = (e) => {
    const effective = Number.isFinite(duration) && duration > 0 ? duration : Math.max(currentTime, 0) || 1
    if (!timelineRef.current || effective <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = rect.width > 0 ? Math.max(0, Math.min(1, x / rect.width)) : 0
    seekTo(pct * effective)
  }

  const OVER_25_MB_NO_SERVER_MSG = 'Video is over 25 MB. Start the FFmpeg server (npm run server) and add VITE_FFMPEG_API_URL=http://localhost:3030 to your .env file to transcribe.'
  const COMPRESSION_FAILED_MSG = 'File is too large. Please use a shorter audio file or enable the FFmpeg server.'

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
        if (!getFfmpegApiBase()) {
          setTranscribeError(OVER_25_MB_NO_SERVER_MSG)
          return
        }
        setTranscribeStatus('Uploading to server…')
        let extracted
        try {
          extracted = await Promise.race([
            extractAudioForWhisper(blob, { onProgress: setTranscribeStatus }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Audio preparation is taking too long. Try a shorter clip.')), 5 * 60 * 1000)
            )
          ])
        } catch (compressErr) {
          setTranscribeError(COMPRESSION_FAILED_MSG)
          return
        }

        if (extracted.size > WHISPER_MAX_BYTES) {
          setTranscribeError(COMPRESSION_FAILED_MSG)
          return
        }
        audioBlob = new File([extracted], 'audio.mp3', { type: extracted.type || 'audio/mpeg' })
      }

      setTranscribeStatus('Transcribing…')
      const { segments: rawSegments } = await Promise.race([
        transcribeWithSegments(audioBlob, openaiKey.trim()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Transcription is taking too long. Try again.')), 60000)
        )
      ])
      const withIds = (rawSegments || []).map((s) => ({
        id: wordId(),
        word: (s.text || '').trim(),
        start: Number(s.start) ?? 0,
        end: Number(s.end) ?? 0,
      })).filter((w) => w.word.length > 0)
      setWords(withIds)
      setCurrentWordIndex(null)
    } catch (e) {
      const msg = e?.message || 'Transcription failed.'
      const isLargeNoServer = playbackBlobRef.current?.size > WHISPER_MAX_BYTES && !getFfmpegApiBase()
      setTranscribeError(isLargeNoServer ? OVER_25_MB_NO_SERVER_MSG : msg)
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
    if (!blob) {
      alert('No video loaded. Load or record a video first.')
      return
    }
    const effectiveDuration = Number.isFinite(duration) && duration > 0
      ? duration
      : (videoRef.current && Number.isFinite(videoRef.current.duration) && videoRef.current.duration > 0
        ? videoRef.current.duration
        : 0)
    if (effectiveDuration <= 0) {
      alert('Video duration is not ready. Play the video once, then try Export again.')
      return
    }
    const merged = words.length > 0 ? wordsToSegments(words) : []
    const exportSegments = merged.length > 0
      ? merged.map((s) => ({ start: s.start, end: s.end }))
      : [{ start: 0, end: effectiveDuration }]
    if (addCaptions && merged.length === 0) {
      alert('Add captions is enabled but there are no segments. Transcribe the video first or disable captions.')
      return
    }
    setIsExporting(true)
    setExportProgress('Preparing…')
    try {
      setExportProgress(getFfmpegApiBase() ? 'Uploading…' : 'Exporting with FFmpeg…')
      const exportOpts = {
        onProgress: setExportProgress,
        format: exportFormat,
        quality: exportQuality,
        resolution: exportResolution,
      }
      if (addCaptions && merged.length > 0) {
        exportOpts.captions = { segments: merged, style: captionStyle }
      }
      const result = await exportTrimmedVideo(blob, exportSegments, exportOpts)
      const ext = (getFfmpegApiBase() ? exportFormat : result.type?.includes('mp4') ? 'mp4' : 'webm')
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
  }, [duration, addCaptions, words, captionStyle, exportFormat, exportQuality, exportResolution])

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
        {/* Left panel: word-level transcript (edit by cutting/moving words → clips) */}
        <aside className="video-editing-panel video-editing-panel-left" style={{ width: leftPanelWidth }}>
          <h2 className="video-editing-panel-title">Transcript</h2>
          <p className="video-editing-panel-desc">Transcribe with segments (same as record-mode captions). Click to seek, delete to cut, drag to reorder. OpenAI Whisper limit: 25 MB.</p>
          {fileSize != null && (
            <p className="video-editing-file-size" aria-live="polite">
              Video: {(fileSize / (1024 * 1024)).toFixed(1)} MB
              {fileSize > WHISPER_MAX_BYTES && (
                <span className="video-editing-file-size-note"> — will compress or use server</span>
              )}
            </p>
          )}
          <button
            type="button"
            className="video-editing-btn-primary"
            onClick={handleTranscribe}
            disabled={isTranscribing || !openaiKey?.trim()}
          >
            {isTranscribing ? (transcribeStatus || 'Transcribing…') : 'Transcribe video'}
          </button>
          {getFfmpegApiBase() && (
            <p className="video-editing-server-hint">Using FFmpeg server — no browser load</p>
          )}
          {transcribeError && <p className="video-editing-error" role="alert">{transcribeError}</p>}
          {words.length > 0 && (
            <div className="video-editing-segments">
              <label className="video-editing-transcript-label">Segments — click to seek, delete to cut, drag to reorder</label>
              <div className="video-editing-segment-list video-editing-word-list" role="list">
                {words.map((w, index) => (
                  <div
                    key={w.id}
                    role="listitem"
                    className={`video-editing-segment video-editing-word ${currentWordIndex === index ? 'video-editing-segment-current' : ''} ${draggingWordId === w.id ? 'video-editing-segment-dragging' : ''}`}
                    onClick={() => seekToWord(w, index)}
                    draggable
                    onDragStart={(e) => handleWordDragStart(e, w.id)}
                    onDragOver={(e) => handleWordDragOver(e, w.id)}
                    onDrop={(e) => handleWordDrop(e, w.id)}
                    onDragEnd={handleWordDragEnd}
                    onDragLeave={() => { dragOverWordIdRef.current = null }}
                  >
                    <span className="video-editing-segment-drag" aria-hidden title="Drag to reorder">⋮⋮</span>
                    <span className="video-editing-segment-text">{w.word}</span>
                    <span className="video-editing-segment-time">{formatTime(w.start)} – {formatTime(w.end)}</span>
                    <button
                      type="button"
                      className="video-editing-segment-delete"
                      onClick={(e) => { e.stopPropagation(); deleteWord(w.id) }}
                      title="Remove word (cut from video)"
                      aria-label={`Remove word: ${w.word}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
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
            <p className="video-editing-setting-hint">Burn captions from segments into the video (transcribe first).</p>
          </div>

          <div className="video-editing-setting">
            <label className="video-editing-label">Export format</label>
            <select
              className="video-editing-select"
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
            >
              <option value="mp4">MP4 (H.264)</option>
              <option value="webm">WebM (VP9)</option>
            </select>
          </div>

          <div className="video-editing-setting">
            <label className="video-editing-label">Quality</label>
            <select
              className="video-editing-select"
              value={exportQuality}
              onChange={(e) => setExportQuality(e.target.value)}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low (smaller file)</option>
            </select>
          </div>

          <div className="video-editing-setting">
            <label className="video-editing-label">Resolution</label>
            <select
              className="video-editing-select"
              value={exportResolution}
              onChange={(e) => setExportResolution(e.target.value)}
            >
              <option value="original">Original</option>
              <option value="1080">1080p</option>
              <option value="720">720p</option>
              <option value="480">480p</option>
            </select>
          </div>

          <div className="video-editing-setting video-editing-export">
            <button
              type="button"
              className="video-editing-btn-primary video-editing-btn-export"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? exportProgress || 'Exporting…' : getFfmpegApiBase() ? 'Export video (server)' : 'Export video (FFmpeg)'}
            </button>
            <p className="video-editing-setting-hint">
              {getFfmpegApiBase() ? 'Export using server-side FFmpeg (format, quality, resolution applied).' : 'Export as WebM/MP4 in the browser. Set VITE_FFMPEG_API_URL for server export with options.'}
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}

export default VideoEditingMode
