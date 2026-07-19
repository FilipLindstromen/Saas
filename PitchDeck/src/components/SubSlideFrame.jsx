import { useCallback, useRef } from 'react'
import { SUB_SLIDE_MIN_SIZE } from '../utils/subSlides'

const DRAG_THRESHOLD = 4

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
  return target?.closest?.('.slide-subslide-resize-handle')
}

export default function SubSlideFrame({
  subSlide,
  index,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
  containerRef,
  isEditing,
}) {
  const dragRef = useRef(null)
  const pendingDragRef = useRef(null)
  const resizeRef = useRef(null)
  const suppressClickRef = useRef(false)

  const x = subSlide.x ?? 50
  const y = subSlide.y ?? 50
  const width = subSlide.width ?? 40
  const height = subSlide.height ?? 30

  const getContainerRect = useCallback(() => containerRef?.current?.getBoundingClientRect(), [containerRef])

  const handlePointerMove = useCallback((e) => {
    const rect = getContainerRect()
    if (!rect || !onUpdate) return

    if (pendingDragRef.current && !dragRef.current) {
      const { startX, startY } = pendingDragRef.current
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > DRAG_THRESHOLD) {
        dragRef.current = { ...pendingDragRef.current }
        pendingDragRef.current = null
        suppressClickRef.current = true
        document.body.style.cursor = 'grabbing'
      }
    }

    if (dragRef.current) {
      const { startX, startY, startGx, startGy } = dragRef.current
      const dxPercent = ((e.clientX - startX) / rect.width) * 100
      const dyPercent = ((e.clientY - startY) / rect.height) * 100
      const newX = Math.max(0, Math.min(100, startGx + dxPercent))
      const newY = Math.max(0, Math.min(100, startGy + dyPercent))
      onUpdate({ x: newX, y: newY })
      dragRef.current = { ...dragRef.current, startX: e.clientX, startY: e.clientY, startGx: newX, startGy: newY }
    }

    if (resizeRef.current) {
      const { startX, startY, startW, startH } = resizeRef.current
      const dxPercent = ((e.clientX - startX) / rect.width) * 100
      const dyPercent = ((e.clientY - startY) / rect.height) * 100
      const newW = Math.max(SUB_SLIDE_MIN_SIZE, Math.min(100, startW + dxPercent))
      const newH = Math.max(SUB_SLIDE_MIN_SIZE, Math.min(100, startH + dyPercent))
      onUpdate({ width: newW, height: newH })
      resizeRef.current = { ...resizeRef.current, startX: e.clientX, startY: e.clientY, startW: newW, startH: newH }
      suppressClickRef.current = true
    }
  }, [getContainerRect, onUpdate])

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
    pendingDragRef.current = { startX: e.clientX, startY: e.clientY, startGx: x, startGy: y }
    document.body.style.cursor = 'grab'
    attachGlobalListeners(handlePointerMove, handlePointerUp)
  }, [isEditing, isSelected, onSelect, x, y, handlePointerMove, handlePointerUp])

  const onResizeDown = useCallback((e) => {
    if (!isEditing || !onUpdate) return
    e.preventDefault()
    e.stopPropagation()
    if (!isSelected) onSelect?.()
    resizeRef.current = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }
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

  const onDeleteClick = useCallback((e) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete?.()
  }, [onDelete])

  if (!isEditing) return null

  return (
    <div
      className={`slide-subslide-frame ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}%`,
        height: `${height}%`,
        transform: 'translate(-50%, -50%)',
      }}
      onClick={onSelectClick}
      onPointerDown={onMoveDown}
    >
      <span className="slide-subslide-label">Sub slide {index + 1}</span>
      {isSelected && (
        <>
          <button
            type="button"
            className="slide-subslide-delete"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={onDeleteClick}
            title="Remove sub slide"
            aria-label="Remove sub slide"
          >
            ×
          </button>
          <div
            className="slide-subslide-resize-handle"
            onPointerDown={onResizeDown}
            title="Drag corner to resize"
            aria-label="Resize sub slide"
          />
        </>
      )}
    </div>
  )
}
