import { useRef, useState, useCallback, useEffect } from 'react'
import type { OverlayItem, OverlayTextAnimation } from '../types'
import { IconType, IconImage, IconPlay, IconPause, IconSplit, IconVideo } from './Icons'
import { StickerPicker } from './StickerPicker'
import { AnimatedStickerPicker } from './AnimatedStickerPicker'
import { SubscribePicker } from './SubscribePicker'
import { getStoredGiphyApiKey } from './SettingsModal'
import styles from './Timeline.module.css'

const MIN_CLIP_DURATION = 0.5
const MIN_DURATION = 1
const MAX_DURATION = 600
const EDGE_HIT_PX = 10
type ClipDragMode = 'move' | 'resizeStart' | 'resizeEnd'

/** Trim range for the main video clip (source seconds). When set, a Video track is shown at the bottom. */
export interface VideoClipTrim {
  trimStart: number
  trimEnd: number
}

interface TimelineProps {
  overlays: OverlayItem[]
  duration: number
  currentTime: number
  onSeek?: (time: number) => void
  onAddOverlay: (type: 'text' | 'image' | 'video', initialPatch?: Partial<OverlayItem>) => void
  onEditOverlay: (id: string, patch: Partial<OverlayItem>) => void
  onRemoveOverlay: (id: string) => void
  onSelectOverlay: (id: string | null) => void
  selectedId: string | null
  onDurationChange?: (newDuration: number) => void
  overlayTextAnimation?: OverlayTextAnimation
  onOverlayTextAnimationChange?: (anim: OverlayTextAnimation) => void
  /** When set, show play/pause button to preview overlay animations */
  isPreviewPlaying?: boolean
  onPreviewPlayToggle?: () => void
  /** When set (after recording), show the video as a clip on the bottom track; user can trim edges */
  videoClipTrim?: VideoClipTrim | null
  /** Full length of the source video (seconds); used to clamp trim */
  videoSourceDuration?: number
  onVideoClipTrimChange?: (trimStart: number, trimEnd: number) => void
  /** Split selected overlay clip at playhead */
  onSplitClip?: () => void
}

export function Timeline({
  overlays,
  duration,
  currentTime,
  onSeek,
  onAddOverlay,
  onEditOverlay,
  onRemoveOverlay,
  onSelectOverlay,
  selectedId,
  onDurationChange,
  overlayTextAnimation = 'none',
  onOverlayTextAnimationChange,
  isPreviewPlaying = false,
  onPreviewPlayToggle,
  videoClipTrim,
  videoSourceDuration = 0,
  onVideoClipTrimChange,
  onSplitClip,
}: TimelineProps) {
  const safeDuration = Number.isFinite(duration) && duration >= 0 ? duration : 0
  const safeCurrentTime = Number.isFinite(currentTime) && currentTime >= 0 ? Math.min(currentTime, safeDuration) : 0

  const rulerRef = useRef<HTMLDivElement>(null)
  const stripRefsMap = useRef<Record<string, HTMLDivElement | null>>({})
  const videoStripRef = useRef<HTMLDivElement>(null)
  const [durationDrag, setDurationDrag] = useState<{ startX: number; startDuration: number; rect: DOMRect } | null>(null)
  const [playheadDrag, setPlayheadDrag] = useState<{ rect: DOMRect } | null>(null)
  const [videoClipDrag, setVideoClipDrag] = useState<{
    mode: 'resizeStart' | 'resizeEnd' | 'move'
    startX: number
    startTrimStart: number
    startTrimEnd: number
    rect: DOMRect
  } | null>(null)
  const [clipDrag, setClipDrag] = useState<{
    id: string
    mode: ClipDragMode
    startX: number
    startStartTime: number
    startEndTime: number
    rect: DOMRect
  } | null>(null)
  const [durationEditing, setDurationEditing] = useState(false)
  const [durationInputValue, setDurationInputValue] = useState('')
  const durationInputRef = useRef<HTMLInputElement>(null)
  const [stickerPickerOpen, setStickerPickerOpen] = useState(false)
  const [subscribePickerOpen, setSubscribePickerOpen] = useState(false)
  const [animatedStickerPickerOpen, setAnimatedStickerPickerOpen] = useState(false)
  const [animatedStickerInitialQuery, setAnimatedStickerInitialQuery] = useState<string | undefined>(undefined)
  const [inOutMarkerDrag, setInOutMarkerDrag] = useState<'in' | 'out' | null>(null)
  const inOutMarkerDragRef = useRef<{ kind: 'in' | 'out'; rect: DOMRect } | null>(null)
  const videoClipTrimRef = useRef(videoClipTrim)
  videoClipTrimRef.current = videoClipTrim

  const handleInOutMarkerPointerDown = useCallback(
    (e: React.PointerEvent, kind: 'in' | 'out') => {
      if (!videoClipTrim || !onVideoClipTrimChange || !rulerRef.current) return
      e.preventDefault()
      e.stopPropagation()
      setInOutMarkerDrag(kind)
      inOutMarkerDragRef.current = { kind, rect: rulerRef.current.getBoundingClientRect() }
        ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [videoClipTrim, onVideoClipTrimChange]
  )

  const handleInOutMarkerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const state = inOutMarkerDragRef.current
      const trim = videoClipTrimRef.current
      if (!state || !trim || !onVideoClipTrimChange || !videoSourceDuration) return
      const { rect } = state
      const x = e.clientX - rect.left
      const t = Math.max(0, Math.min(videoSourceDuration, (x / rect.width) * safeDuration))
      if (state.kind === 'in') {
        const newStart = Math.max(0, Math.min(trim.trimEnd - MIN_CLIP_DURATION, t))
        onVideoClipTrimChange(newStart, trim.trimEnd)
      } else {
        const newEnd = Math.max(trim.trimStart + MIN_CLIP_DURATION, Math.min(videoSourceDuration, t))
        onVideoClipTrimChange(trim.trimStart, newEnd)
      }
    },
    [onVideoClipTrimChange, videoSourceDuration, safeDuration]
  )

  const handleInOutMarkerPointerUp = useCallback((e: React.PointerEvent) => {
    if (inOutMarkerDragRef.current) {
      ; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
      setInOutMarkerDrag(null)
      inOutMarkerDragRef.current = null
    }
  }, [])

  const handleRulerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onSeek || !rulerRef.current) return
      const rect = rulerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left
      const t = (x / rect.width) * safeDuration
      onSeek(Math.max(0, Math.min(safeDuration, t)))
    },
    [onSeek, safeDuration]
  )

  const applyDurationFromInput = useCallback(() => {
    const raw = durationInputRef.current?.value ?? durationInputValue
    const sec = parseDurationInput(raw)
    const clamped = sec != null
      ? Math.max(MIN_DURATION, Math.min(MAX_DURATION, sec))
      : null
    if (clamped != null) {
      onDurationChange?.(clamped)
      setDurationInputValue(formatTimeFull(clamped))
    } else {
      setDurationInputValue(formatTimeFull(safeDuration))
    }
    setDurationEditing(false)
    durationInputRef.current?.blur()
  }, [durationInputValue, onDurationChange, safeDuration])

  const handlePlayheadPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!onSeek || !rulerRef.current) return
      e.preventDefault()
      e.stopPropagation()
      setPlayheadDrag({ rect: rulerRef.current.getBoundingClientRect() })
        ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [onSeek]
  )

  const handlePlayheadPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!playheadDrag || !onSeek) return
      const { rect } = playheadDrag
      const x = e.clientX - rect.left
      const t = (x / rect.width) * safeDuration
      onSeek(Math.max(0, Math.min(safeDuration, t)))
    },
    [playheadDrag, onSeek, safeDuration]
  )

  const handlePlayheadPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (playheadDrag) {
        ; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
        setPlayheadDrag(null)
      }
    },
    [playheadDrag]
  )

  const handlePointerDownDuration = useCallback(
    (e: React.PointerEvent) => {
      if (!onDurationChange || !rulerRef.current) return
      e.preventDefault()
      const rect = rulerRef.current.getBoundingClientRect()
      setDurationDrag({
        startX: e.clientX,
        startDuration: safeDuration,
        rect,
      })
        ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [onDurationChange, safeDuration]
  )

  const handlePointerMoveDuration = useCallback(
    (e: React.PointerEvent) => {
      if (!durationDrag || !onDurationChange) return
      const x = Math.max(0, e.clientX - durationDrag.rect.left)
      const newDuration = (x / durationDrag.rect.width) * durationDrag.startDuration
      onDurationChange(Math.max(MIN_DURATION, Math.min(MAX_DURATION, newDuration)))
    },
    [durationDrag, onDurationChange]
  )

  const handlePointerUpDuration = useCallback(
    (e: React.PointerEvent) => {
      if (durationDrag) {
        ; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
        setDurationDrag(null)
      }
    },
    [durationDrag]
  )

  const getClipDragMode = useCallback((offsetX: number, clipWidthPx: number): ClipDragMode => {
    if (clipWidthPx <= 0) return 'move'
    if (offsetX <= EDGE_HIT_PX) return 'resizeStart'
    if (offsetX >= clipWidthPx - EDGE_HIT_PX) return 'resizeEnd'
    return 'move'
  }, [])

  const handleClipPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, o: OverlayItem, forceMode?: ClipDragMode) => {
      e.preventDefault()
      e.stopPropagation()
      const strip = stripRefsMap.current[o.id]
      if (!strip) return
      const stripRect = strip.getBoundingClientRect()
      let mode: ClipDragMode = forceMode ?? 'move'
      if (!forceMode) {
        const clipLeftPct = o.startTime / Math.max(duration, 0.001)
        const clipWidthPct = (o.endTime - o.startTime) / Math.max(duration, 0.001)
        const clipLeftPx = clipLeftPct * stripRect.width
        const clipWidthPx = clipWidthPct * stripRect.width
        const xInClip = e.clientX - stripRect.left - clipLeftPx
        mode = getClipDragMode(xInClip, clipWidthPx)
      }
      setClipDrag({
        id: o.id,
        mode,
        startX: e.clientX,
        startStartTime: o.startTime,
        startEndTime: o.endTime,
        rect: stripRect,
      })
        ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [safeDuration, getClipDragMode]
  )

  const handleClipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!clipDrag) return
      const { rect } = clipDrag
      const x = e.clientX - rect.left
      const t = (x / rect.width) * safeDuration
      const tClamped = Math.max(0, Math.min(safeDuration, t))
      if (clipDrag.mode === 'move') {
        const deltaPx = e.clientX - clipDrag.startX
        const deltaT = (deltaPx / rect.width) * safeDuration
        const len = clipDrag.startEndTime - clipDrag.startStartTime
        let newStart = clipDrag.startStartTime + deltaT
        let newEnd = clipDrag.startEndTime + deltaT
        if (newStart < 0) {
          newStart = 0
          newEnd = len
        }
        if (newEnd > safeDuration) {
          newEnd = safeDuration
          newStart = safeDuration - len
        }
        onEditOverlay(clipDrag.id, { startTime: newStart, endTime: newEnd })
      } else if (clipDrag.mode === 'resizeStart') {
        const newStart = Math.max(0, Math.min(clipDrag.startEndTime - MIN_CLIP_DURATION, tClamped))
        onEditOverlay(clipDrag.id, { startTime: newStart })
      } else {
        const newEnd = Math.max(clipDrag.startStartTime + MIN_CLIP_DURATION, Math.min(duration, tClamped))
        onEditOverlay(clipDrag.id, { endTime: newEnd })
      }
    },
    [clipDrag, safeDuration, onEditOverlay]
  )

  const handleClipPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (clipDrag) {
        ; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
        setClipDrag(null)
      }
    },
    [clipDrag]
  )

  const handleVideoClipPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, mode: 'resizeStart' | 'resizeEnd' | 'move') => {
      e.preventDefault()
      e.stopPropagation()
      const strip = videoStripRef.current
      if (!strip || !videoClipTrim || !onVideoClipTrimChange) return
      const stripRect = strip.getBoundingClientRect()
      setVideoClipDrag({
        mode,
        startX: e.clientX,
        startTrimStart: videoClipTrim.trimStart,
        startTrimEnd: videoClipTrim.trimEnd,
        rect: stripRect,
      })
        ; (e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    [videoClipTrim, onVideoClipTrimChange]
  )

  const handleVideoClipPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!videoClipDrag || !onVideoClipTrimChange || !videoSourceDuration) return
      const { rect } = videoClipDrag
      const clipLen = videoClipDrag.startTrimEnd - videoClipDrag.startTrimStart
      const deltaPx = e.clientX - videoClipDrag.startX
      const deltaT = (deltaPx / rect.width) * clipLen
      if (videoClipDrag.mode === 'resizeStart') {
        const newTrimStart = Math.max(
          0,
          Math.min(videoClipDrag.startTrimEnd - MIN_CLIP_DURATION, videoClipDrag.startTrimStart + deltaT)
        )
        onVideoClipTrimChange(newTrimStart, videoClipDrag.startTrimEnd)
      } else if (videoClipDrag.mode === 'resizeEnd') {
        const newTrimEnd = Math.min(
          videoSourceDuration,
          Math.max(videoClipDrag.startTrimStart + MIN_CLIP_DURATION, videoClipDrag.startTrimEnd + deltaT)
        )
        onVideoClipTrimChange(videoClipDrag.startTrimStart, newTrimEnd)
      } else {
        const newTrimStart = videoClipDrag.startTrimStart + deltaT
        const newTrimEnd = videoClipDrag.startTrimEnd + deltaT
        let clampedStart = newTrimStart
        let clampedEnd = newTrimEnd
        if (newTrimStart < 0) {
          clampedStart = 0
          clampedEnd = clipLen
        } else if (newTrimEnd > videoSourceDuration) {
          clampedEnd = videoSourceDuration
          clampedStart = videoSourceDuration - clipLen
        }
        onVideoClipTrimChange(Math.max(0, clampedStart), Math.min(videoSourceDuration, clampedEnd))
      }
    },
    [videoClipDrag, onVideoClipTrimChange, videoSourceDuration]
  )

  const handleVideoClipPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (videoClipDrag) {
        ; (e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
        setVideoClipDrag(null)
      }
    },
    [videoClipDrag]
  )

  const textOverlays = overlays.filter((o) => o.type === 'text')
  const imageOverlays = overlays.filter((o) => o.type === 'image')
  const videoOverlays = overlays.filter((o) => o.type === 'video')

  const selectedOverlayForSplit = selectedId ? overlays.find((x) => x.id === selectedId) : null
  const canSplit = !!(
    selectedId &&
    onSplitClip &&
    selectedOverlayForSplit &&
    safeCurrentTime > selectedOverlayForSplit.startTime + MIN_CLIP_DURATION &&
    safeCurrentTime < selectedOverlayForSplit.endTime - MIN_CLIP_DURATION
  )

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {onSplitClip && (
          <button
            type="button"
            className={styles.toolbarBtn}
            onClick={onSplitClip}
            disabled={!canSplit}
            title={canSplit ? 'Split selected clip at playhead' : 'Select a clip and position playhead inside it to split'}
            aria-label="Split clip at playhead"
          >
            <IconSplit />
            <span>Split</span>
          </button>
        )}
        <button type="button" className={styles.toolbarBtn} onClick={() => onAddOverlay('text')} title="Add text overlay" aria-label="Add text overlay">
          <IconType />
          <span>Text</span>
        </button>
        <button type="button" className={styles.toolbarBtn} onClick={() => onAddOverlay('image')} title="Add image overlay" aria-label="Add image overlay">
          <IconImage />
          <span>Image</span>
        </button>
        <button type="button" className={styles.toolbarBtn} onClick={() => setStickerPickerOpen(true)} title="Add sticker" aria-label="Add sticker">
          <span className={styles.stickerIcon}>✱</span>
          <span>Sticker</span>
        </button>
        <StickerPicker
          isOpen={stickerPickerOpen}
          onClose={() => setStickerPickerOpen(false)}
          onSelect={(imageDataUrl, naturalWidth, naturalHeight) => {
            onAddOverlay('image', {
              imageDataUrl,
              naturalWidth,
              naturalHeight,
              imageScale: 1,
              x: 0.5,
              y: 0.5,
              burnIntoExport: true,
            })
            setStickerPickerOpen(false)
          }}
        />
        <button type="button" className={styles.toolbarBtn} onClick={() => setSubscribePickerOpen(true)} title="Add YouTube subscribe button" aria-label="Add YouTube subscribe button">
          <span className={styles.stickerIcon}>▶</span>
          <span>Subscribe</span>
        </button>
        <SubscribePicker
          isOpen={subscribePickerOpen}
          onClose={() => setSubscribePickerOpen(false)}
          onAddStatic={(imageDataUrl, naturalWidth, naturalHeight) => {
            onAddOverlay('image', {
              imageDataUrl,
              naturalWidth,
              naturalHeight,
              imageScale: 1,
              x: 0.5,
              y: 0.5,
              burnIntoExport: true,
            })
            setSubscribePickerOpen(false)
          }}
          onOpenAnimated={() => {
            setSubscribePickerOpen(false)
            setAnimatedStickerInitialQuery('youtube subscribe')
            setAnimatedStickerPickerOpen(true)
          }}
        />
        <button type="button" className={styles.toolbarBtn} onClick={() => { setAnimatedStickerInitialQuery(undefined); setAnimatedStickerPickerOpen(true) }} title="Add animated sticker (GIPHY)" aria-label="Add animated sticker">
          <span className={styles.stickerIcon}>G</span>
          <span>Animated</span>
        </button>
        <AnimatedStickerPicker
          isOpen={animatedStickerPickerOpen}
          onClose={() => { setAnimatedStickerPickerOpen(false); setAnimatedStickerInitialQuery(undefined) }}
          apiKey={getStoredGiphyApiKey()}
          initialQuery={animatedStickerInitialQuery}
          onSelect={(imageUrl, naturalWidth, naturalHeight) => {
            onAddOverlay('image', {
              imageUrl,
              naturalWidth,
              naturalHeight,
              imageScale: 1,
              x: 0.5,
              y: 0.5,
              burnIntoExport: true,
            })
            setAnimatedStickerPickerOpen(false)
            setAnimatedStickerInitialQuery(undefined)
          }}
        />
        <button type="button" className={styles.toolbarBtn} onClick={() => onAddOverlay('video', { imageScale: 1, x: 0.5, y: 0.5, burnIntoExport: true })} title="Add video overlay (set source in Inspector: Pexels or Pixabay)" aria-label="Add video overlay">
          <IconVideo />
          <span>Video</span>
        </button>
        <div className={styles.toolbarSpacer} />
        {onPreviewPlayToggle && (
          <button
            type="button"
            className={styles.previewPlayBtn}
            onClick={onPreviewPlayToggle}
            title={isPreviewPlaying ? 'Pause' : 'Play'}
            aria-label={isPreviewPlaying ? 'Pause' : 'Play'}
          >
            {isPreviewPlaying ? <IconPause /> : <IconPlay />}
          </button>
        )}
        <span className={styles.timeDisplay} aria-hidden>
          {formatTimeFull(safeCurrentTime)} /{' '}
          {onDurationChange && durationEditing ? (
            <span className={styles.durationInputRow}>
              <input
                ref={durationInputRef}
                type="text"
                className={styles.durationInput}
                value={durationInputValue}
                onChange={(e) => setDurationInputValue(e.target.value)}
                onBlur={applyDurationFromInput}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    applyDurationFromInput()
                  } else if (e.key === 'Escape') {
                    e.preventDefault()
                    setDurationInputValue(formatTimeFull(safeDuration))
                    setDurationEditing(false)
                    durationInputRef.current?.blur()
                  }
                }}
                aria-label="Timeline duration (e.g. 90, 1:30, 0:01.00)"
              />
              <button
                type="button"
                className={styles.durationApplyBtn}
                onClick={applyDurationFromInput}
                title="Apply duration"
              >
                Apply
              </button>
            </span>
          ) : onDurationChange ? (
            <button
              type="button"
              className={styles.durationEditBtn}
              onClick={() => {
                setDurationInputValue(formatTimeFull(safeDuration))
                setDurationEditing(true)
              }}
              title="Click to edit duration (e.g. 90 or 1:30)"
            >
              {formatTimeFull(safeDuration)}
            </button>
          ) : (
            formatTimeFull(safeDuration)
          )}
        </span>
        <div className={styles.toolbarSpacer} />
      </div>

      <div className={styles.rulerAndTracksWrap}>
        <div
          className={styles.playhead}
          style={{
            /* Center playhead on time: left is set to time position + 13px so that translateX(-50%) places center correctly */
            left: `calc(72px + (100% - 72px) * ${safeCurrentTime / Math.max(safeDuration, 0.001)})`,
          }}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={safeDuration}
          aria-valuenow={safeCurrentTime}
          tabIndex={0}
          onPointerDown={handlePlayheadPointerDown}
          onPointerMove={handlePlayheadPointerMove}
          onPointerUp={handlePlayheadPointerUp}
          onPointerLeave={handlePlayheadPointerUp}
          onKeyDown={(e) => {
            if (!onSeek) return
            const step = e.shiftKey ? 5 : 1
            if (e.key === 'ArrowLeft') {
              e.preventDefault()
              onSeek(Math.max(0, safeCurrentTime - step))
            } else if (e.key === 'ArrowRight') {
              e.preventDefault()
              onSeek(Math.min(safeDuration, safeCurrentTime + step))
            }
          }}
        >
          <span className={styles.playheadTriangle} aria-hidden />
        </div>

        {videoClipTrim && onVideoClipTrimChange && videoSourceDuration > 0 && (
          <>
            <div
              className={styles.inOutMarker}
              data-marker="in"
              style={{
                left: `calc(72px + (100% - 72px) * ${(videoClipTrim.trimStart / Math.max(safeDuration, 0.001))})`,
              }}
              onPointerDown={(e) => handleInOutMarkerPointerDown(e, 'in')}
              onPointerMove={handleInOutMarkerPointerMove}
              onPointerUp={handleInOutMarkerPointerUp}
              onPointerLeave={handleInOutMarkerPointerUp}
              title="Export start (drag to adjust)"
              aria-label="In point – export start"
            >
              <span className={styles.inOutMarkerLine} aria-hidden />
              <span className={styles.inOutMarkerLabel}>In</span>
            </div>
            <div
              className={styles.inOutMarker}
              data-marker="out"
              style={{
                left: `calc(72px + (100% - 72px) * ${(videoClipTrim.trimEnd / Math.max(safeDuration, 0.001))})`,
              }}
              onPointerDown={(e) => handleInOutMarkerPointerDown(e, 'out')}
              onPointerMove={handleInOutMarkerPointerMove}
              onPointerUp={handleInOutMarkerPointerUp}
              onPointerLeave={handleInOutMarkerPointerUp}
              title="Export end (drag to adjust)"
              aria-label="Out point – export end"
            >
              <span className={styles.inOutMarkerLine} aria-hidden />
              <span className={styles.inOutMarkerLabel}>Out</span>
            </div>
          </>
        )}

        <div className={styles.rulerSection}>
          <div className={styles.rulerLabels} aria-hidden> </div>
          <div
            className={styles.rulerTicksWrap}
            ref={rulerRef}
            onClick={handleRulerClick}
            aria-label="Timeline ruler; click to seek"
            title="Click to seek to time"
          >
            <div className={styles.rulerTicks}>
              {(() => {
                const tickStep = 0.5
                const ticks: number[] = []
                for (let t = 0; t <= safeDuration; t += tickStep) ticks.push(t)
                const labelStep =
                  safeDuration <= 10 ? 1 : safeDuration <= 30 ? 2 : safeDuration <= 60 ? 5 : 10
                return ticks.map((t) => {
                  const isWholeSecond = t % 1 === 0
                  const showLabel = isWholeSecond && (labelStep <= 1 || t % labelStep === 0)
                  return (
                    <div
                      key={t}
                      className={isWholeSecond ? styles.rulerTickMajor : styles.rulerTickMinor}
                      style={{ left: `${(t / Math.max(safeDuration, 0.001)) * 100}%` }}
                    >
                      {showLabel && <span className={styles.rulerTickLabel}>{formatTime(t)}</span>}
                    </div>
                  )
                })
              })()}
            </div>
            <div className={styles.timeRuler}>
              {onDurationChange && (
                <div
                  className={styles.durationHandle}
                  title="Drag to set timeline length"
                  aria-label="Drag to set timeline length"
                  onPointerDown={handlePointerDownDuration}
                  onPointerMove={handlePointerMoveDuration}
                  onPointerUp={handlePointerUpDuration}
                  onPointerLeave={handlePointerUpDuration}
                />
              )}
            </div>
          </div>
        </div>

        <div className={styles.tracksSection}>
          <div className={styles.clipsScroll}>
            {textOverlays.map((o) => (
              <div key={o.id} className={styles.clipsStripRow}>
                <span className={styles.stripLabel} title="Text overlay">{o.text ? (o.text.slice(0, 12) + (o.text.length > 12 ? '…' : '')) : 'Text'}</span>
                <div ref={(el) => { stripRefsMap.current[o.id] = el }} className={styles.clipsStrip}>
                  <div
                    data-clip-segment
                    className={`${styles.clipSegment} ${styles.clipSegmentText} ${selectedId === o.id ? styles.clipSegmentSelected : ''} ${clipDrag?.id === o.id ? styles.clipSegmentDragging : ''}`}
                    style={{
                      left: `${(o.startTime / Math.max(safeDuration, 0.001)) * 100}%`,
                      width: `${((o.endTime - o.startTime) / Math.max(safeDuration, 0.001)) * 100}%`,
                    }}
                    title={`${o.type === 'text' ? (o.text || 'Text') : 'Image'} ${o.startTime.toFixed(1)}s – ${o.endTime.toFixed(1)}s. Drag to move, drag edges to trim.`}
                    onClick={(e) => { e.stopPropagation(); onSelectOverlay(o.id) }}
                    onPointerDown={(e) => {
                      const el = e.target as HTMLElement
                      const edge = el.getAttribute?.('data-edge')
                      const forceMode: ClipDragMode | undefined =
                        edge === 'left' ? 'resizeStart' : edge === 'right' ? 'resizeEnd' : undefined
                      handleClipPointerDown(e, o, forceMode)
                      const seg = el.closest('[data-clip-segment]') as HTMLElement | null
                      seg?.setPointerCapture(e.pointerId)
                    }}
                    onPointerMove={handleClipPointerMove}
                    onPointerUp={handleClipPointerUp}
                    onPointerLeave={handleClipPointerUp}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectOverlay(o.id) } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Clip: ${o.type === 'text' ? (o.text || 'Text') : 'Image'}, ${o.startTime.toFixed(1)} to ${o.endTime.toFixed(1)} seconds. Drag to move or trim.`}
                  >
                    <span className={styles.clipSegmentEdge} data-edge="left" title="Drag to trim start" />
                    <span className={styles.clipSegmentBody} title="Drag to move">
                      <IconType className={styles.clipIcon} />
                      <span className={styles.clipLabel}>{o.text ? (o.text.slice(0, 28) + (o.text.length > 28 ? '…' : '')) : 'Text'}</span>
                    </span>
                    <span className={styles.clipSegmentEdge} data-edge="right" title="Drag to trim end" />
                  </div>
                </div>
              </div>
            ))}
            {imageOverlays.map((o) => (
              <div key={o.id} className={styles.clipsStripRow}>
                <span className={styles.stripLabel}>Image</span>
                <div ref={(el) => { stripRefsMap.current[o.id] = el }} className={styles.clipsStrip}>
                  <div
                    data-clip-segment
                    className={`${styles.clipSegment} ${styles.clipSegmentImage} ${selectedId === o.id ? styles.clipSegmentSelected : ''} ${clipDrag?.id === o.id ? styles.clipSegmentDragging : ''}`}
                    style={{
                      left: `${(o.startTime / Math.max(safeDuration, 0.001)) * 100}%`,
                      width: `${((o.endTime - o.startTime) / Math.max(safeDuration, 0.001)) * 100}%`,
                    }}
                    title={`Image ${o.startTime.toFixed(1)}s – ${o.endTime.toFixed(1)}s. Drag to move, drag edges to trim.`}
                    onClick={(e) => { e.stopPropagation(); onSelectOverlay(o.id) }}
                    onPointerDown={(e) => {
                      const el = e.target as HTMLElement
                      const edge = el.getAttribute?.('data-edge')
                      const forceMode: ClipDragMode | undefined =
                        edge === 'left' ? 'resizeStart' : edge === 'right' ? 'resizeEnd' : undefined
                      handleClipPointerDown(e, o, forceMode)
                      const seg = el.closest('[data-clip-segment]') as HTMLElement | null
                      seg?.setPointerCapture(e.pointerId)
                    }}
                    onPointerMove={handleClipPointerMove}
                    onPointerUp={handleClipPointerUp}
                    onPointerLeave={handleClipPointerUp}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectOverlay(o.id) } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Image clip, ${o.startTime.toFixed(1)} to ${o.endTime.toFixed(1)} seconds`}
                  >
                    <span className={styles.clipSegmentEdge} data-edge="left" title="Drag to trim start" />
                    <span className={styles.clipSegmentBody} title="Drag to move">
                      <IconImage className={styles.clipIcon} />
                      <span className={styles.clipLabel}>Image</span>
                    </span>
                    <span className={styles.clipSegmentEdge} data-edge="right" title="Drag to trim end" />
                  </div>
                </div>
              </div>
            ))}
            {videoOverlays.map((o) => (
              <div key={o.id} className={styles.clipsStripRow}>
                <span className={styles.stripLabel}>Video</span>
                <div ref={(el) => { stripRefsMap.current[o.id] = el }} className={styles.clipsStrip}>
                  <div
                    data-clip-segment
                    className={`${styles.clipSegment} ${styles.clipSegmentImage} ${selectedId === o.id ? styles.clipSegmentSelected : ''} ${clipDrag?.id === o.id ? styles.clipSegmentDragging : ''}`}
                    style={{
                      left: `${(o.startTime / Math.max(safeDuration, 0.001)) * 100}%`,
                      width: `${((o.endTime - o.startTime) / Math.max(safeDuration, 0.001)) * 100}%`,
                    }}
                    title={`Video ${o.startTime.toFixed(1)}s – ${o.endTime.toFixed(1)}s. Drag to move, drag edges to trim.`}
                    onClick={(e) => { e.stopPropagation(); onSelectOverlay(o.id) }}
                    onPointerDown={(e) => {
                      const el = e.target as HTMLElement
                      const edge = el.getAttribute?.('data-edge')
                      const forceMode: ClipDragMode | undefined =
                        edge === 'left' ? 'resizeStart' : edge === 'right' ? 'resizeEnd' : undefined
                      handleClipPointerDown(e, o, forceMode)
                      const seg = el.closest('[data-clip-segment]') as HTMLElement | null
                      seg?.setPointerCapture(e.pointerId)
                    }}
                    onPointerMove={handleClipPointerMove}
                    onPointerUp={handleClipPointerUp}
                    onPointerLeave={handleClipPointerUp}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectOverlay(o.id) } }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Video clip, ${o.startTime.toFixed(1)} to ${o.endTime.toFixed(1)} seconds`}
                  >
                    <span className={styles.clipSegmentEdge} data-edge="left" title="Drag to trim start" />
                    <span className={styles.clipSegmentBody} title="Drag to move">
                      <IconVideo className={styles.clipIcon} />
                      <span className={styles.clipLabel}>Video</span>
                    </span>
                    <span className={styles.clipSegmentEdge} data-edge="right" title="Drag to trim end" />
                  </div>
                </div>
              </div>
            ))}
            {videoClipTrim && (
              <div className={styles.clipsStripRow}>
                <span className={styles.stripLabelVideo}>Video</span>
                <div ref={videoStripRef} className={styles.clipsStrip}>
                  <div
                    className={`${styles.clipSegment} ${styles.clipSegmentVideo} ${videoClipDrag ? styles.clipSegmentDragging : ''} ${selectedId === 'background' ? styles.clipSegmentSelected : ''}`}
                    style={(() => {
                      if (safeDuration <= 0) return { left: '0%', width: '100%' }
                      const leftPct = (videoClipTrim.trimStart / safeDuration) * 100
                      const widthPct = ((videoClipTrim.trimEnd - videoClipTrim.trimStart) / safeDuration) * 100
                      const left = Math.max(0, Math.min(100, leftPct))
                      const width = Math.max(0, Math.min(100 - left, widthPct))
                      return { left: `${left}%`, width: `${width}%` }
                    })()}
                    title="Drag edges to trim, drag body to move. Click to select."
                    onClick={(e) => {
                      e.stopPropagation()
                      onSelectOverlay('background')
                    }}
                    onPointerDown={(e) => {
                      const el = e.target as HTMLElement
                      const edge = el.getAttribute?.('data-edge')
                      const mode: 'resizeStart' | 'resizeEnd' | 'move' =
                        edge === 'left' ? 'resizeStart' : edge === 'right' ? 'resizeEnd' : 'move'
                      handleVideoClipPointerDown(e, mode)
                        ; (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
                    }}
                    onPointerMove={handleVideoClipPointerMove}
                    onPointerUp={handleVideoClipPointerUp}
                    onPointerLeave={handleVideoClipPointerUp}
                    data-video-clip
                  >
                    <span className={styles.clipSegmentEdge} data-edge="left" title="Drag to trim start" />
                    <span className={styles.clipSegmentBody} title="Drag to move" />
                    <span className={styles.clipSegmentEdge} data-edge="right" title="Drag to trim end" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

function formatTimeFull(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const cs = Math.floor((s % 1) * 100)
  return `${m}:${sec.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
}

/** Parse duration string to seconds: "90", "1:30", "1:30.50", "0:01.00" */
function parseDurationInput(str: string): number | null {
  const s = str.trim()
  if (!s) return null
  const parts = s.split(':')
  if (parts.length === 1) {
    const n = parseFloat(parts[0])
    return Number.isFinite(n) ? n : null
  }
  if (parts.length === 2) {
    const m = parseInt(parts[0], 10)
    const secStr = parts[1].replace(',', '.')
    const sec = parseFloat(secStr)
    if (!Number.isFinite(m) || !Number.isFinite(sec)) return null
    return m * 60 + sec
  }
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10)
    const m = parseInt(parts[1], 10)
    const sec = parseFloat(parts[2].replace(',', '.'))
    if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(sec)) return null
    return h * 3600 + m * 60 + sec
  }
  return null
}
