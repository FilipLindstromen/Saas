import { useState, useEffect, useRef, useCallback } from 'react'
import { convertToMp4, exportTrimmedVideo } from '../utils/ffmpegExport'
import './EditRecordingMode.css'

function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Returns true if the blob is likely playable natively in a video element (MP4 H.264). */
function isNativePlayable(blob) {
  if (!blob?.type) return false
  const t = blob.type.toLowerCase()
  return t.includes('mp4') || t === 'video/mp4'
}

function EditRecordingMode({ videoBlob, latestRecordingRef, onExit }) {
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const fileUrlRef = useRef(null)
  const playbackBlobRef = useRef(null)
  const prepareCancelRef = useRef(false)
  const [videoUrl, setVideoUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [cutPoints, setCutPoints] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const [loadError, setLoadError] = useState(null)
  const [prepareStatus, setPrepareStatus] = useState('idle') // 'idle' | 'converting' | 'ready' | 'error'
  const [convertProgress, setConvertProgress] = useState(0)
  const timelineRef = useRef(null)

  const revokeUrl = useCallback(() => {
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current)
      fileUrlRef.current = null
    }
  }, [])

  /** Prepare a video for playback: use MP4 as-is, transcode WebM/others to MP4 via FFmpeg. */
  const prepareVideo = useCallback(async (blob) => {
    if (!blob) return
    prepareCancelRef.current = false
    setLoadError(null)
    revokeUrl()
    setVideoUrl(null)
    setCutPoints([])
    setDuration(0)
    setTrimStart(0)
    setTrimEnd(0)
    playbackBlobRef.current = null

    if (isNativePlayable(blob)) {
      const url = URL.createObjectURL(blob)
      fileUrlRef.current = url
      playbackBlobRef.current = blob
      setVideoUrl(url)
      setPrepareStatus('ready')
      return
    }

    setPrepareStatus('converting')
    setConvertProgress(0)
    try {
      const mp4Blob = await convertToMp4(blob, {
        onProgress: (p) => { if (!prepareCancelRef.current) setConvertProgress(p) }
      })
      if (prepareCancelRef.current) return
      const url = URL.createObjectURL(mp4Blob)
      fileUrlRef.current = url
      playbackBlobRef.current = mp4Blob
      setVideoUrl(url)
      setPrepareStatus('ready')
    } catch (e) {
      if (prepareCancelRef.current) return
      setLoadError(e?.message ?? 'Conversion failed.')
      setPrepareStatus('error')
    } finally {
      setConvertProgress(0)
    }
  }, [revokeUrl])

  // When entering with a recording/blob, prepare it (transcode to MP4 if needed)
  useEffect(() => {
    const blob = latestRecordingRef?.current ?? videoBlob
    if (blob) {
      prepareVideo(blob)
      return () => {
        prepareCancelRef.current = true
        revokeUrl()
      }
    } else {
      prepareCancelRef.current = true
      revokeUrl()
      setVideoUrl(null)
      setDuration(0)
      setCurrentTime(0)
      setTrimStart(0)
      setTrimEnd(0)
      setCutPoints([])
      setPrepareStatus('idle')
    }
  }, [latestRecordingRef, videoBlob, prepareVideo, revokeUrl])

  useEffect(() => {
    return () => revokeUrl()
  }, [revokeUrl])

  // Video metadata
  const applyDuration = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const d = video.duration
    if (Number.isFinite(d) && d > 0 && !Number.isNaN(d)) {
      setDuration(d)
      setTrimEnd((prev) => (prev <= 0 ? d : prev))
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    setLoadError(null)
    const onMetadata = () => applyDuration()
    const onDurationChange = () => applyDuration()
    const onCanPlay = () => applyDuration()
    const onError = () => {
      const err = video.error
      const msg = err?.message || (err?.code === 4 ? 'Video format or codec not supported.' : 'Video failed to load.')
      setLoadError(msg)
    }
    video.addEventListener('loadedmetadata', onMetadata)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('loadedmetadata', onMetadata)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('canplay', onCanPlay)
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
      if (Number.isFinite(trimEnd) && t >= trimEnd - 0.05) {
        video.pause()
        video.currentTime = Math.max(0, trimStart)
        setPlaying(false)
        return
      }
      rafId = requestAnimationFrame(tick)
    }
    if (playing) {
      if (Number.isFinite(trimEnd) && Number.isFinite(trimStart) && video.currentTime >= trimEnd - 0.1) {
        video.currentTime = Math.max(0, trimStart)
      }
      video.play().catch((err) => {
        setPlaying(false)
        console.warn('Video play failed:', err)
      })
      rafId = requestAnimationFrame(tick)
      if (duration <= 0 && Number.isFinite(video.duration) && video.duration > 0) {
        setDuration(video.duration)
        setTrimEnd(video.duration)
      }
    } else {
      video.pause()
    }
    return () => { if (rafId != null) cancelAnimationFrame(rafId) }
  }, [playing, trimStart, trimEnd, duration])

  const togglePlay = () => setPlaying((p) => !p)

  const seekTo = (time) => {
    const video = videoRef.current
    if (!video) return
    let t = Number.isFinite(time) ? time : 0
    if (Number.isFinite(duration) && duration > 0) t = Math.max(0, Math.min(duration, t))
    else t = Math.max(0, t)
    if (!Number.isFinite(t)) return
    video.currentTime = t
    setCurrentTime(t)
  }

  const handleTimelineClick = (e) => {
    if (!timelineRef.current || !Number.isFinite(duration) || duration <= 0) return
    const rect = timelineRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = rect.width > 0 ? x / rect.width : 0
    seekTo(pct * duration)
  }

  const setTrimStartHere = () => setTrimStart(Math.max(0, Math.min(currentTime, trimEnd - 0.1)))
  const setTrimEndHere = () => setTrimEnd(Math.max(trimStart + 0.1, Math.min(duration, currentTime)))

  const addCutAtPlayhead = () => {
    const t = currentTime
    if (t <= trimStart || t >= trimEnd) return
    const next = [...cutPoints.filter((c) => Math.abs(c - t) > 0.05), t].sort((a, b) => a - b)
    setCutPoints(next)
  }

  const deleteSegmentAtPlayhead = () => {
    const t = currentTime
    const points = [trimStart, ...cutPoints.filter((c) => c > trimStart && c < trimEnd), trimEnd].sort((a, b) => a - b)
    let i = 0
    while (i < points.length - 1 && !(t >= points[i] && t <= points[i + 1])) i++
    if (i >= points.length - 1) return
    const segStart = points[i]
    const segEnd = points[i + 1]
    const hasCut = (x) => cutPoints.some((c) => Math.abs(c - x) < 0.001)
    if (hasCut(segEnd)) setCutPoints(cutPoints.filter((c) => Math.abs(c - segEnd) >= 0.001))
    else if (hasCut(segStart)) setCutPoints(cutPoints.filter((c) => Math.abs(c - segStart) >= 0.001))
  }

  const resetEdits = () => {
    setTrimStart(0)
    setTrimEnd(duration)
    setCutPoints([])
  }

  const getSegments = useCallback(() => {
    const start = Math.max(0, trimStart)
    const end = Math.min(duration, trimEnd)
    if (start >= end) return []
    const pts = [start, ...cutPoints.filter((c) => c > start && c < end), end].sort((a, b) => a - b)
    const segs = []
    for (let i = 0; i < pts.length - 1; i++) segs.push({ start: pts[i], end: pts[i + 1] })
    return segs
  }, [trimStart, trimEnd, cutPoints, duration])

  const exportVideo = useCallback(async () => {
    const blob = playbackBlobRef.current
    if (!blob || duration <= 0) return
    const segments = getSegments()
    if (segments.length === 0) return

    setIsExporting(true)
    setExportProgress('Exporting…')
    try {
      const result = await exportTrimmedVideo(blob, segments, { onProgress: setExportProgress })
      const ext = result.type.includes('mp4') ? 'mp4' : 'webm'
      const url = URL.createObjectURL(result)
      const a = document.createElement('a')
      a.href = url
      a.download = `edited-recording-${new Date().toISOString().split('T')[0]}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
      alert('Export failed: ' + (e?.message ?? 'Unknown error'))
    } finally {
      setExportProgress('')
      setIsExporting(false)
    }
  }, [duration, getSegments])

  // Converting: show progress
  if (prepareStatus === 'converting') {
    return (
      <div className="edit-recording-mode">
        <div className="edit-recording-header">
          <h1 className="edit-recording-title">Edit recording</h1>
          <button type="button" className="btn-exit-edit-recording" onClick={onExit}>Exit</button>
        </div>
        <div className="edit-recording-empty edit-recording-converting">
          <p>Preparing video for playback with FFmpeg…</p>
          <div className="edit-recording-progress-bar">
            <div className="edit-recording-progress-fill" style={{ width: `${Math.round(convertProgress * 100)}%` }} />
          </div>
          <span className="edit-recording-progress-pct">{Math.round(convertProgress * 100)}%</span>
        </div>
      </div>
    )
  }

  // No video loaded
  if (!videoUrl) {
    return (
      <div className="edit-recording-mode">
        <div className="edit-recording-header">
          <h1 className="edit-recording-title">Edit recording</h1>
          <button type="button" className="btn-exit-edit-recording" onClick={onExit}>Exit</button>
        </div>
        <div className="edit-recording-empty">
          {loadError && <p className="edit-recording-empty-error">{loadError}</p>}
          <p>No video loaded. Record a presentation first, or load a video file to edit (WebM, MP4, OGG).</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/webm,video/mp4,video/ogg"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) prepareVideo(file)
              e.target.value = ''
            }}
          />
          <button
            type="button"
            className="btn-load-video"
            onClick={() => fileInputRef.current?.click()}
          >
            Load video file
          </button>
        </div>
      </div>
    )
  }

  const segments = getSegments()
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const trimStartPct = (trimStart / safeDuration) * 100
  const trimEndPct = (trimEnd / safeDuration) * 100
  const currentPct = (currentTime / safeDuration) * 100

  return (
    <div className="edit-recording-mode">
      <div className="edit-recording-header">
        <h1 className="edit-recording-title">Edit recording</h1>
        <button type="button" className="btn-exit-edit-recording" onClick={onExit}>Exit</button>
      </div>

      <div className="edit-recording-main">
        <div className="edit-recording-preview">
          {loadError && (
            <div className="edit-recording-load-error" role="alert">
              {loadError}
            </div>
          )}
          <video
            ref={videoRef}
            src={videoUrl}
            preload="auto"
            playsInline
            muted={false}
          />
        </div>

        <div className="edit-recording-timeline-section">
          <div className="edit-recording-controls-row">
            <button
              type="button"
              className="btn-play-pause"
              onClick={togglePlay}
              title={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              )}
            </button>
            <span className="edit-recording-time">{formatTime(currentTime)} / {formatTime(duration)}</span>
            <div className="edit-recording-tool-buttons">
              <button type="button" className="btn-timeline-tool" onClick={setTrimStartHere} title="Set trim start">Trim start</button>
              <button type="button" className="btn-timeline-tool" onClick={setTrimEndHere} title="Set trim end">Trim end</button>
              <button type="button" className="btn-timeline-tool" onClick={addCutAtPlayhead} title="Cut at playhead">Cut</button>
              <button type="button" className="btn-timeline-tool" onClick={deleteSegmentAtPlayhead} title="Delete segment at playhead">Delete segment</button>
              <button type="button" className="btn-timeline-tool" onClick={resetEdits} title="Reset trim and cuts">Reset</button>
            </div>
          </div>

          <div
            ref={timelineRef}
            className="edit-recording-timeline"
            onClick={handleTimelineClick}
          >
            <div className="edit-recording-timeline-track">
              <div
                className="edit-recording-timeline-trim"
                style={{ left: `${trimStartPct}%`, width: `${trimEndPct - trimStartPct}%` }}
              />
              {cutPoints.map((t) => (
                <div
                  key={t}
                  className="edit-recording-timeline-cut"
                  style={{ left: `${(t / safeDuration) * 100}%` }}
                />
              ))}
              <div
                className="edit-recording-timeline-playhead"
                style={{ left: `${currentPct}%` }}
              />
            </div>
          </div>

          <div className="edit-recording-export-row">
            <span className="edit-recording-segments-info">{segments.length} segment(s)</span>
            <button
              type="button"
              className="btn-export-edited"
              onClick={exportVideo}
              disabled={isExporting || segments.length === 0}
            >
              {isExporting ? exportProgress : 'Export video'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditRecordingMode
