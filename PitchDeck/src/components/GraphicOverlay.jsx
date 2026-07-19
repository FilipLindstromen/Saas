import React, { useCallback, useRef } from 'react'
import { GRAPHIC_COORDINATE_WIDTH } from '../utils/slideFormats'

const DRAG_THRESHOLD = 4
const MIN_SIZE = 32
const MAX_SIZE = 800

function attachGlobalListeners(onMove, onUp) {
  const move = (ev) => {
    ev.preventDefault()
    onMove(ev)
  }
  const up = (ev) => {
    onUp(ev)
    document.removeEventListener('pointermove', move, true)
    document.removeEventListener('pointerup', up, true)
    document.removeEventListener('pointercancel', up, true)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }
  document.body.style.userSelect = 'none'
  document.addEventListener('pointermove', move, true)
  document.addEventListener('pointerup', up, true)
  document.addEventListener('pointercancel', up, true)
}

function isResizeHandle(target) {
  return target?.closest?.('.slide-graphic-resize-handle')
}

export default function GraphicOverlay({
  graphic,
  isSelected,
  onSelect,
  onUpdate,
  containerRef,
  isEditing,
  isPlayMode = false,
  animationIn = 'fade-scale',
  animationDelay = 0.25,
}) {
  const dragRef = useRef(null)
  const pendingDragRef = useRef(null)
  const resizeRef = useRef(null)
  const suppressClickRef = useRef(false)

  const x = graphic.x ?? 50
  const y = graphic.y ?? 50
  const width = graphic.width ?? 80
  const height = graphic.height ?? 80
  const rotation = graphic.rotation ?? 0
  const flipHorizontal = graphic.flipHorizontal ?? false
  const tintColor = graphic.tintColor ?? null
  const tintOpacity = graphic.tintOpacity ?? 100

  const getContainerRect = useCallback(() => containerRef?.current?.getBoundingClientRect(), [containerRef])

  const getScaleFactor = useCallback(() => {
    const rect = getContainerRect()
    const el = containerRef?.current
    if (!rect || !el?.offsetWidth) return 1
    return rect.width / el.offsetWidth
  }, [getContainerRect, containerRef])

  const getCoordScale = useCallback(() => {
    const el = containerRef?.current
    if (!el?.offsetWidth) return 1
    return el.offsetWidth / GRAPHIC_COORDINATE_WIDTH
  }, [containerRef])

  const handlePointerMove = useCallback((e) => {
    const rect = getContainerRect()
    if (!rect || !onUpdate) return
    const scale = getScaleFactor()

    if (pendingDragRef.current && !dragRef.current) {
      const { startX, startY } = pendingDragRef.current
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY)
      if (dist > DRAG_THRESHOLD) {
        dragRef.current = { ...pendingDragRef.current }
        pendingDragRef.current = null
        suppressClickRef.current = true
        document.body.style.cursor = 'grabbing'
      }
    }

    if (dragRef.current) {
      const { startX, startY, startGx, startGy } = dragRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const dxPercent = (dx / rect.width) * 100
      const dyPercent = (dy / rect.height) * 100
      const newX = Math.max(0, Math.min(100, startGx + dxPercent))
      const newY = Math.max(0, Math.min(100, startGy + dyPercent))
      onUpdate({ x: newX, y: newY })
      dragRef.current = { ...dragRef.current, startX: e.clientX, startY: e.clientY, startGx: newX, startGy: newY }
    }

    if (resizeRef.current) {
      const { startX, startY, startW, aspect } = resizeRef.current
      const dx = (e.clientX - startX) / scale
      const dy = (e.clientY - startY) / scale
      const delta = Math.max(dx, dy)
      const coordScale = getCoordScale()
      const startDisplayW = startW * coordScale
      const newDisplayW = Math.max(MIN_SIZE * coordScale, Math.min(MAX_SIZE * coordScale, startDisplayW + delta))
      const newW = newDisplayW / coordScale
      const newH = Math.max(MIN_SIZE, Math.min(MAX_SIZE, newW * aspect))
      onUpdate({ width: newW, height: newH })
      resizeRef.current = { ...resizeRef.current, startX: e.clientX, startY: e.clientY, startW: newW }
      suppressClickRef.current = true
    }
  }, [getContainerRect, getScaleFactor, getCoordScale, onUpdate])

  const handlePointerUp = useCallback(() => {
    dragRef.current = null
    pendingDragRef.current = null
    resizeRef.current = null
    document.body.style.cursor = ''
  }, [])

  const onMoveDown = useCallback((e) => {
    if (!isEditing || isResizeHandle(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    if (!isSelected) onSelect?.()
    const state = { startX: e.clientX, startY: e.clientY, startGx: x, startGy: y }
    pendingDragRef.current = state
    document.body.style.cursor = 'grab'
    attachGlobalListeners(handlePointerMove, handlePointerUp)
  }, [isEditing, isSelected, onSelect, x, y, handlePointerMove, handlePointerUp])

  const onResizeDown = useCallback((e) => {
    if (!isEditing || !onUpdate) return
    e.preventDefault()
    e.stopPropagation()
    if (!isSelected) onSelect?.()
    const aspect = width > 0 ? height / width : 1
    const state = { startX: e.clientX, startY: e.clientY, startW: width, aspect }
    resizeRef.current = state
    document.body.style.cursor = 'nwse-resize'
    attachGlobalListeners(handlePointerMove, handlePointerUp)
  }, [isEditing, isSelected, onSelect, onUpdate, width, height, handlePointerMove, handlePointerUp])

  const onSelectClick = useCallback((e) => {
    e.stopPropagation()
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    onSelect?.()
  }, [onSelect])

  return (
    <div
      className={`slide-graphic-overlay ${isSelected ? 'selected' : ''}${isPlayMode ? ` graphic-anim-${animationIn || 'fade-scale'}` : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `calc(${width}px * var(--slide-coord-scale, 1))`,
        height: `calc(${height}px * var(--slide-coord-scale, 1))`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)${flipHorizontal ? ' scaleX(-1)' : ''}`,
        transformOrigin: 'center center',
        cursor: isEditing ? (isSelected ? 'grab' : 'pointer') : 'default',
        zIndex: isSelected ? 2 : 1,
        ...(isPlayMode ? { '--graphic-anim-delay': `${animationDelay}s` } : {}),
      }}
      onClick={onSelectClick}
      onPointerDown={onMoveDown}
    >
      <div className="slide-graphic-overlay-inner">
        <img src={graphic.url} alt="" draggable={false} />
        {tintColor && (
          <div
            className="slide-graphic-tint-mask"
            style={{
              backgroundColor: tintColor,
              opacity: tintOpacity / 100,
              WebkitMaskImage: `url(${graphic.url})`,
              maskImage: `url(${graphic.url})`
            }}
          />
        )}
      </div>
      {isSelected && isEditing && (
        <div
          className="slide-graphic-resize-handle"
          onPointerDown={onResizeDown}
          title="Drag corner to resize"
          aria-label="Resize graphic"
        />
      )}
    </div>
  )
}
