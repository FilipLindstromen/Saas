import { useState, useCallback, useRef, useEffect } from 'react'
import './Timeline.css'

function getElementLabel(el) {
  if (el.layerName && el.layerName.trim()) return el.layerName.trim()
  if (el.type === 'headline') return el.text || 'Headline'
  if (el.type === 'cta') return el.text || 'CTA'
  if (el.type === 'arrow') return 'Arrow'
  if (el.type === 'image') return 'Image'
  if (el.type === 'image-text') return el.text || 'Image+Text'
  return el.type
}

export default function Timeline({
  height = 140,
  onResize,
  elements = [],
  duration = 10,
  currentTime = 0,
  onCurrentTimeChange,
  onDurationChange,
  onUpdateClip,
  onClipEditStart,
  onSelect,
  selectedIds = [],
  isPlaying = false,
  onPlayPause
}) {
  const trackRef = useRef(null)
  const [dragState, setDragState] = useState(null)
  const [trimState, setTrimState] = useState(null)

  const sorted = [...elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  const timeToPx = useCallback((t) => {
    if (!trackRef.current || duration <= 0) return 0
    return (t / duration) * trackRef.current.clientWidth
  }, [duration])

  const pxToTime = useCallback((px) => {
    if (!trackRef.current || duration <= 0) return 0
    return (px / trackRef.current.clientWidth) * duration
  }, [duration])

  const isPlayingRef = useRef(isPlaying)
  isPlayingRef.current = isPlaying

  useEffect(() => {
    if (!isPlaying || !onCurrentTimeChange) return
    const start = performance.now()
    const startTime = currentTime
    let id
    const raf = (now) => {
      if (!isPlayingRef.current) return
      const elapsed = (now - start) / 1000
      let next = startTime + elapsed
      if (next >= duration) {
        next = duration
        onPlayPause?.(false)
      }
      onCurrentTimeChange(next)
      if (isPlayingRef.current) id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(id)
  }, [isPlaying, duration, onCurrentTimeChange, onPlayPause, currentTime])

  const SNAP_THRESHOLD = 0.15

  const getSnapPoints = useCallback(() => {
    const points = new Set([0, duration])
    elements.forEach(el => {
      const start = el.clipStart ?? 0
      const end = el.clipEnd ?? duration
      points.add(start)
      points.add(end)
    })
    return [...points].sort((a, b) => a - b)
  }, [elements, duration])

  const snapToNearest = useCallback((t) => {
    const points = getSnapPoints()
    for (const p of points) {
      if (Math.abs(t - p) <= SNAP_THRESHOLD) return p
    }
    return t
  }, [getSnapPoints])

  const handleTrackClick = (e) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    let t = pxToTime(px)
    t = Math.max(0, Math.min(duration, t))
    t = snapToNearest(t)
    onCurrentTimeChange?.(t)
  }

  const handleClipPointerDown = (e, el, action) => {
    e.stopPropagation()
    if (action === 'move' || action.startsWith('trim-')) {
      onClipEditStart?.()
    }
    if (action === 'move') {
      setDragState({
        id: el.id,
        startX: e.clientX,
        startClipStart: el.clipStart ?? 0,
        startClipEnd: el.clipEnd ?? duration
      })
    } else if (action === 'trim-left' || action === 'trim-right') {
      setTrimState({
        id: el.id,
        side: action,
        startX: e.clientX,
        startClipStart: el.clipStart ?? 0,
        startClipEnd: el.clipEnd ?? duration
      })
    }
  }

  useEffect(() => {
    if (!dragState && !trimState) return
    const onMove = (e) => {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const dx = e.clientX - (dragState ? dragState.startX : trimState.startX)
      const dt = pxToTime(dx)

      if (dragState) {
        const dur = dragState.startClipEnd - dragState.startClipStart
        let newStart = dragState.startClipStart + dt
        let newEnd = dragState.startClipEnd + dt
        newStart = Math.max(0, Math.min(duration - dur, newStart))
        newEnd = newStart + dur
        newEnd = Math.min(duration, newEnd)
        newStart = newEnd - dur
        onUpdateClip?.(dragState.id, { clipStart: newStart, clipEnd: newEnd })
      } else if (trimState) {
        let newStart = trimState.startClipStart
        let newEnd = trimState.startClipEnd
        if (trimState.side === 'trim-left') {
          newStart = Math.max(0, Math.min(trimState.startClipEnd - 0.5, trimState.startClipStart + dt))
        } else {
          newEnd = Math.max(trimState.startClipStart + 0.5, Math.min(duration, trimState.startClipEnd + dt))
        }
        onUpdateClip?.(trimState.id, { clipStart: newStart, clipEnd: newEnd })
      }
    }
    const onUp = () => {
      setDragState(null)
      setTrimState(null)
    }
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup', onUp)
    }
  }, [dragState, trimState, duration, pxToTime, onUpdateClip])

  return (
    <div className="timeline" style={{ height: `${height}px`, minHeight: `${height}px` }}>
      {onResize && (
        <div
          className="timeline-resize-handle"
          onPointerDown={(e) => {
            e.preventDefault()
            const timelineEl = e.currentTarget.closest('.timeline')
            const move = (ev) => {
              if (!timelineEl) return
              const rect = timelineEl.getBoundingClientRect()
              const newH = Math.max(80, Math.min(400, rect.bottom - ev.clientY))
              onResize(newH)
            }
            const up = () => {
              document.removeEventListener('pointermove', move)
              document.removeEventListener('pointerup', up)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
            }
            document.body.style.cursor = 'ns-resize'
            document.body.style.userSelect = 'none'
            document.addEventListener('pointermove', move)
            document.addEventListener('pointerup', up)
          }}
          title="Drag to resize timeline"
        />
      )}
      <div className="timeline-tracks" ref={trackRef}>
        <div className="timeline-ruler" onClick={handleTrackClick}>
          {[0, 0.25, 0.5, 0.75, 1].map((p) => (
            <div
              key={p}
              className="timeline-ruler-tick"
              style={{ left: `${p * 100}%` }}
            >
              {(duration * p).toFixed(1)}s
            </div>
          ))}
          <div
            className="timeline-playhead"
            style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <div className="timeline-tracks-inner">
          {sorted.length === 0 && (
            <div className="timeline-empty">Add elements to the canvas to see clips</div>
          )}
          {sorted.map((el) => {
            const start = (el.clipStart ?? 0) / duration
            const end = (el.clipEnd ?? duration) / duration
            const left = start * 100
            const width = (end - start) * 100
            return (
              <div
                key={el.id}
                className="timeline-track"
                onClick={() => onSelect?.([el.id])}
              >
                <span className="timeline-track-label">{getElementLabel(el)}</span>
                <div className="timeline-track-clips">
                  <div
                    className={`timeline-clip ${selectedIds.includes(el.id) ? 'selected' : ''}`}
                    style={{ left: `${left}%`, width: `${width}%` }}
                    onPointerDown={(e) => handleClipPointerDown(e, el, 'move')}
                  >
                    <div
                      className="timeline-clip-trim timeline-clip-trim-left"
                      onPointerDown={(e) => handleClipPointerDown(e, el, 'trim-left')}
                      title="Trim start"
                    />
                    <div
                      className="timeline-clip-trim timeline-clip-trim-right"
                      onPointerDown={(e) => handleClipPointerDown(e, el, 'trim-right')}
                      title="Trim end"
                    />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <div className="timeline-controls">
        <button
          type="button"
          className="timeline-play-btn"
          onClick={() => onPlayPause?.(!isPlaying)}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>
        <span className="timeline-time">{currentTime.toFixed(1)}s</span>
        <div className="timeline-duration">
          <label>Duration (s)</label>
          <input
            type="number"
            min={1}
            max={300}
            step={0.5}
            value={duration}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v) && v >= 1 && v <= 300) onDurationChange?.(v)
            }}
          />
        </div>
      </div>
    </div>
  )
}
