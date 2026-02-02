import { useState, useEffect, useRef, useCallback } from 'react'
import { exportTrimmedVideo } from '../utils/ffmpegExport'
import './EditRecordingMode.css'

function formatTime(seconds) {
  if (seconds == null || !Number.isFinite(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function EditRecordingMode({ videoBlob, latestRecordingRef, onExit }) {
  const fileInputRef = useRef(null)
  const videoRef = useRef(null)
  const fileUrlRef = useRef(null)
  const rafRef = useRef(null)
  const [videoUrl, setVideoUrl] = useState(null)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [trimStart, setTrimStart] = useState(0)
  const [trimEnd, setTrimEnd] = useState(0)
  const [cutPoints, setCutPoints] = useState([])
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState('')
  const timelineRef = useRef(null)

  const loadBlob = useCallback((blob) => {
    if (!blob) return
    if (fileUrlRef.current) {
      URL.revokeObjectURL(fileUrlRef.current)
      fileUrlRef.current = null
    }
    const url = URL.createObjectURL(blob)
    fileUrlRef.current = url
    setVideoUrl(url)
    setCutPoints([])
  }, [])

  // When entering edit-recording mode, always load the latest recording from the ref so it's automatically loaded
  useEffect(() => {
    const blob = latestRecordingRef?.current ?? videoBlob
    if (blob) {
      loadBlob(blob)
      return () => {
        if (fileUrlRef.current) {
          URL.revokeObjectURL(fileUrlRef.current)
          fileUrlRef.current = null
        }
      }
    } else {
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current)
        fileUrlRef.current = null
      }
      setVideoUrl(null)
      setDuration(0)
      setCurrentTime(0)
      setTrimStart(0)
      setTrimEnd(0)
      setCutPoints([])
    }
  }, [latestRecordingRef, videoBlob, loadBlob])

  useEffect(() => {
    return () => {
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current)
        fileUrlRef.current = null
      }
    }
  }, [])

  // Video metadata
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoUrl) return
    const onLoadedMetadata = () => {
      const d = video.duration
      const safeDuration = Number.isFinite(d) && d > 0 ? d : 0
      setDuration(safeDuration)
      setTrimEnd(safeDuration)
    }
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    return () => video.removeEventListener('loadedmetadata', onLoadedMetadata)
  }, [videoUrl])

  // Smooth playback: RAF loop to sync currentTime when playing (smoother than timeupdate)
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
      video.play().catch(() => setPlaying(false))
      rafId = requestAnimationFrame(tick)
    } else {
      video.pause()
    }
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [playing, trimStart, trimEnd])

  const togglePlay = () => setPlaying((p) => !p)

  const seekTo = (time) => {
    const video = videoRef.current
    if (!video) return
    let t = Number.isFinite(time) ? time : 0
    if (Number.isFinite(duration) && duration > 0) {
      t = Math.max(0, Math.min(duration, t))
    } else {
      t = Math.max(0, t)
    }
    if (!Number.isFinite(t)) return
    video.currentTime = t
    setCurrentTime(t)
  }

  // Timeline click to seek
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

  // Build segments from trim and cut points
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
    if (!videoUrl || duration <= 0) return
    const segments = getSegments()
    if (segments.length === 0) return

    setIsExporting(true)
    setExportProgress('Loading video…')

    let blob
    try {
      blob = await fetch(videoUrl).then((r) => r.blob())
    } catch (e) {
      setExportProgress('')
      setIsExporting(false)
      alert('Could not load video for export: ' + (e?.message ?? 'Unknown error'))
      return
    }

    try {
      const result = await exportTrimmedVideo(blob, segments, {
        onProgress: setExportProgress
      })
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
  }, [videoUrl, duration, getSegments])

  if (!videoUrl) {
    return (
      <div className="edit-recording-mode">
        <div className="edit-recording-header">
          <h1 className="edit-recording-title">Edit recording</h1>
          <button type="button" className="btn-exit-edit-recording" onClick={onExit}>Exit</button>
        </div>
        <div className="edit-recording-empty">
          <p>No video loaded. Record a presentation first, or load a video file to edit.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/webm,video/mp4,video/ogg"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current)
                fileUrlRef.current = URL.createObjectURL(file)
                setVideoUrl(fileUrlRef.current)
                setCutPoints([])
              }
              e.target.value = ''
            }}
            style={{ display: 'none' }}
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
