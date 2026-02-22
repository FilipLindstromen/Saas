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
  const [autoOffset, setAutoOffset] = useState(0.5)
  const [autoMode, setAutoMode] = useState('in') // 'in' | 'in-and-out'

  const sorted = [...elements].sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))

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

  const startTimeRef = useRef(0)
  const startWallRef = useRef(0)
  useEffect(() => {
    if (!isPlaying || !onCurrentTimeChange) return
    startTimeRef.current = currentTime
    startWallRef.current = performance.now()
    let id
    const raf = () => {
      if (!isPlayingRef.current) return
      const elapsed = (performance.now() - startWallRef.current) / 1000
      let next = startTimeRef.current + elapsed
      if (next >= duration) {
        next = duration
        onPlayPause?.(false)
      }
      onCurrentTimeChange(next)
      if (isPlayingRef.current) id = requestAnimationFrame(raf)
    }
    id = requestAnimationFrame(raf)
    return () => cancelAnimationFrame(id)
  }, [isPlaying, duration, onCurrentTimeChange, onPlayPause])

  const SNAP_THRESHOLD = 0.15
  const CLIP_END_BUFFER = 0.1
  const maxClipEnd = Math.max(0, duration - CLIP_END_BUFFER)

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

  const snapToSecondOrHalf = useCallback((t) => Math.round(t * 2) / 2, [])

  const handleApplyAutoAnimation = useCallback(() => {
    if (sorted.length === 0 || !onUpdateClip || !onClipEditStart) return
    onClipEditStart()
    sorted.forEach((el, index) => {
      const offset = index * autoOffset
      const currentStart = el.clipStart ?? 0
      const currentEnd = el.clipEnd ?? duration
      const clipDuration = currentEnd - currentStart
      if (autoMode === 'in') {
        const newStart = Math.min(offset, Math.max(0, currentEnd - 0.5))
        onUpdateClip(el.id, { clipStart: newStart, clipEnd: currentEnd })
      } else {
        const newStart = offset
        const newEnd = offset + clipDuration
        onUpdateClip(el.id, { clipStart: newStart, clipEnd: newEnd })
      }
    })
    if (autoMode === 'in-and-out' && sorted.length > 0 && onDurationChange) {
      const lastIndex = sorted.length - 1
      const lastEl = sorted[lastIndex]
      const lastClipDuration = (lastEl.clipEnd ?? duration) - (lastEl.clipStart ?? 0)
      const lastEnd = lastIndex * autoOffset + lastClipDuration
      if (lastEnd > duration) {
        onDurationChange(Math.min(300, Math.ceil(lastEnd * 2) / 2))
      }
    }
  }, [sorted, autoOffset, autoMode, duration, onUpdateClip, onClipEditStart, onDurationChange])

  const handleTrackClick = (e) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    let t = pxToTime(px)
    t = Math.max(0, Math.min(duration, t))
    t = snapToNearest(t)
    onCurrentTimeChange?.(t)
  }

  const handleClipClick = (e, el) => {
    e.stopPropagation()
    if (e.shiftKey) {
      onSelect?.(el.id, { shift: true })
    } else {
      onSelect?.([el.id])
    }
  }

  const handleClipPointerDown = (e, el, action) => {
    e.stopPropagation()
    if (action === 'move' && e.shiftKey) {
      return
    }
    if (action === 'move' || action.startsWith('trim-')) {
      onClipEditStart?.()
    }
    if (action === 'move') {
      const idsToMove = selectedIds.includes(el.id) ? selectedIds : [el.id]
      const clips = {}
      idsToMove.forEach((id) => {
        const elem = elements.find(x => x.id === id)
        if (elem) clips[id] = { start: elem.clipStart ?? 0, end: elem.clipEnd ?? duration }
      })
      setDragState({
        id: el.id,
        ids: idsToMove,
        clips,
        startX: e.clientX
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
      const dx = e.clientX - (dragState ? dragState.startX : trimState.startX)
      const dt = pxToTime(dx)
      const shift = e.shiftKey

      if (dragState) {
        const minStart = Math.min(...Object.values(dragState.clips).map(c => c.start))
        const maxEnd = Math.max(...Object.values(dragState.clips).map(c => c.end))
        const totalDur = maxEnd - minStart
        let clampedDt = dt
        if (minStart + dt < 0) clampedDt = -minStart
        if (maxEnd + dt > maxClipEnd) clampedDt = maxClipEnd - maxEnd

        dragState.ids.forEach((id) => {
          const { start, end } = dragState.clips[id]
          let newStart = start + clampedDt
          let newEnd = end + clampedDt
          if (shift) {
            newStart = snapToSecondOrHalf(newStart)
            newEnd = snapToSecondOrHalf(newEnd)
            newStart = Math.max(0, Math.min(maxClipEnd - 0.5, newStart))
            newEnd = Math.max(newStart + 0.5, Math.min(maxClipEnd, newEnd))
          }
          onUpdateClip?.(id, { clipStart: newStart, clipEnd: newEnd })
        })
      } else if (trimState) {
        let newStart = trimState.startClipStart
        let newEnd = trimState.startClipEnd
        if (trimState.side === 'trim-left') {
          newStart = Math.max(0, Math.min(trimState.startClipEnd - 0.5, trimState.startClipStart + dt))
        } else {
          newEnd = Math.max(trimState.startClipStart + 0.5, Math.min(duration, trimState.startClipEnd + dt))
        }
        if (shift) {
          if (trimState.side === 'trim-left') {
            newStart = snapToSecondOrHalf(newStart)
            newStart = Math.max(0, Math.min(trimState.startClipEnd - 0.5, newStart))
          } else {
            newEnd = snapToSecondOrHalf(newEnd)
            newEnd = Math.max(trimState.startClipStart + 0.5, Math.min(duration, newEnd))
          }
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
  }, [dragState, trimState, duration, pxToTime, onUpdateClip, snapToSecondOrHalf])

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
      <div className="timeline-tracks">
        <div className="timeline-ruler-row">
          <div className="timeline-ruler-spacer" />
          <div className="timeline-ruler" ref={trackRef} onClick={handleTrackClick}>
            {Array.from({ length: Math.floor(duration * 2) + 1 }, (_, i) => i * 0.5).map((t) => {
              const p = duration > 0 ? t / duration : 0
              const isFullSecond = t % 1 === 0
              return (
                <div
                  key={t}
                  className={`timeline-ruler-tick ${isFullSecond ? 'timeline-ruler-tick-major' : 'timeline-ruler-tick-minor'}`}
                  style={{ left: `${Math.min(100, p * 100)}%` }}
                >
                  {isFullSecond ? `${t}s` : null}
                </div>
              )
            })}
            <div
              className="timeline-playhead"
              style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            <div
              className="timeline-duration-marker"
              style={{ left: '100%' }}
              title={`Timeline end (${duration}s)`}
            />
          </div>
        </div>
        <div className="timeline-tracks-inner">
          {sorted.length === 0 && (
            <div className="timeline-empty">Add elements to the canvas to see clips</div>
          )}
          {sorted.map((el) => {
            const rawStart = el.clipStart ?? 0
            const rawEnd = el.clipEnd ?? duration
            const start = Math.min(rawStart, duration) / duration
            const end = Math.min(Math.max(rawStart, rawEnd), duration) / duration
            const left = start * 100
            const width = Math.max(0, (end - start) * 100)
            return (
              <div
                key={el.id}
                className="timeline-track"
                onClick={(e) => handleClipClick(e, el)}
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
        <div className="timeline-controls-row">
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
        </div>
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
        <div className="timeline-auto-animation">
          <label className="timeline-auto-animation-label">Auto animation</label>
          <div className="timeline-auto-animation-offset">
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={autoOffset}
              onChange={(e) => setAutoOffset(parseFloat(e.target.value))}
              className="timeline-auto-offset-slider"
            />
            <input
              type="number"
              min={0}
              max={5}
              step={0.1}
              value={autoOffset}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                if (!isNaN(v) && v >= 0 && v <= 5) setAutoOffset(v)
              }}
              className="timeline-auto-offset-input"
            />
          </div>
          <div className="timeline-auto-animation-mode">
            <label className="timeline-auto-mode-option">
              <input
                type="radio"
                name="autoMode"
                value="in"
                checked={autoMode === 'in'}
                onChange={() => setAutoMode('in')}
              />
              In only
            </label>
            <label className="timeline-auto-mode-option">
              <input
                type="radio"
                name="autoMode"
                value="in-and-out"
                checked={autoMode === 'in-and-out'}
                onChange={() => setAutoMode('in-and-out')}
              />
              In and out
            </label>
          </div>
          <button
            type="button"
            className="timeline-auto-apply-btn"
            onClick={handleApplyAutoAnimation}
            disabled={sorted.length === 0}
            title="Offset each clip's start (top to bottom) by the specified seconds"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}
