import React, { useCallback, useRef } from 'react'

const DRAG_THRESHOLD = 5

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

export default function GraphicOverlay({
  graphic,
  isSelected,
  onSelect,
  onUpdate,
  containerRef,
  isEditing
}) {
  const dragRef = useRef(null)
  const pendingDragRef = useRef(null)
  const resizeRef = useRef(null)
  const rotateRef = useRef(null)

  const x = graphic.x ?? 50
  const y = graphic.y ?? 50
  const width = graphic.width ?? 80
  const height = graphic.height ?? 80
  const rotation = graphic.rotation ?? 0
  const flipHorizontal = graphic.flipHorizontal ?? false
  const tintColor = graphic.tintColor ?? null
  const tintOpacity = graphic.tintOpacity ?? 100

  const getContainerRect = useCallback(() => containerRef?.current?.getBoundingClientRect(), [containerRef])
  const getGraphicCenterScreen = useCallback(() => {
    const rect = getContainerRect()
    if (!rect) return null
    const cx = rect.left + (x / 100) * rect.width
    const cy = rect.top + (y / 100) * rect.height
    return { x: cx, y: cy }
  }, [getContainerRect, x, y])

  const handlePointerMove = useCallback((e) => {
    const rect = getContainerRect()
    if (!rect) return

    if (pendingDragRef.current && !dragRef.current) {
      const { startX, startY } = pendingDragRef.current
      const dist = Math.hypot(e.clientX - startX, e.clientY - startY)
      if (dist > DRAG_THRESHOLD) {
        dragRef.current = { ...pendingDragRef.current }
        pendingDragRef.current = null
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
      const { startX, startY, startW, startH } = resizeRef.current
      const dx = e.clientX - startX
      const dy = e.clientY - startY
      const newW = Math.max(24, startW + dx)
      const newH = Math.max(24, startH + dy)
      onUpdate({ width: newW, height: newH })
      resizeRef.current = { ...resizeRef.current, startX: e.clientX, startY: e.clientY, startW: newW, startH: newH }
    }

    if (rotateRef.current) {
      const center = getGraphicCenterScreen()
      if (center) {
        const { startX, startY, startRotation } = rotateRef.current
        const startAngle = Math.atan2(startY - center.y, startX - center.x)
        const currAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x)
        const deltaDeg = ((currAngle - startAngle) * 180) / Math.PI
        let newRot = Math.round(startRotation + deltaDeg)
        if (e.shiftKey) newRot = Math.round(newRot / 15) * 15
        onUpdate({ rotation: newRot })
        rotateRef.current = { ...rotateRef.current, startX: e.clientX, startY: e.clientY, startRotation: newRot }
      }
    }
  }, [getContainerRect, getGraphicCenterScreen, onUpdate])

  const handlePointerUp = useCallback((e) => {
    const didDrag = !!dragRef.current
    dragRef.current = null
    pendingDragRef.current = null
    resizeRef.current = null
    rotateRef.current = null
    if (didDrag) e.preventDefault()
  }, [])

  const onMoveDown = useCallback((e) => {
    if (!isEditing || !isSelected) return
    e.preventDefault()
    e.stopPropagation()
    const state = { startX: e.clientX, startY: e.clientY, startGx: x, startGy: y }
    pendingDragRef.current = state
    document.body.style.cursor = 'grabbing'
    attachGlobalListeners(handlePointerMove, handlePointerUp)
  }, [isEditing, isSelected, x, y, handlePointerMove, handlePointerUp])

  const onResizeDown = useCallback((e) => {
    if (!isEditing || !isSelected) return
    e.preventDefault()
    e.stopPropagation()
    const state = { startX: e.clientX, startY: e.clientY, startW: width, startH: height }
    resizeRef.current = state
    document.body.style.cursor = 'nwse-resize'
    attachGlobalListeners(handlePointerMove, handlePointerUp)
  }, [isEditing, isSelected, width, height, handlePointerMove, handlePointerUp])

  const onRotateDown = useCallback((e) => {
    if (!isEditing || !isSelected) return
    e.preventDefault()
    e.stopPropagation()
    const state = { startX: e.clientX, startY: e.clientY, startRotation: rotation }
    rotateRef.current = state
    document.body.style.cursor = 'grabbing'
    attachGlobalListeners(handlePointerMove, handlePointerUp)
  }, [isEditing, isSelected, rotation, handlePointerMove, handlePointerUp])

  const onFlipClick = useCallback((e) => {
    if (!isEditing || !isSelected) return
    e.preventDefault()
    e.stopPropagation()
    onUpdate({ flipHorizontal: !flipHorizontal })
  }, [isEditing, isSelected, flipHorizontal, onUpdate])

  const onSelectClick = useCallback((e) => {
    e.stopPropagation()
    onSelect?.()
  }, [onSelect])

  const rot = (rotation || 0) * (Math.PI / 180)
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  const corners = [
    { x: 0, y: 0 },
    { x: width, y: 0 },
    { x: width, y: height },
    { x: 0, y: height }
  ]
  const cornerScreen = corners.map(({ x: cx, y: cy }) => {
    const dx = cx - width / 2
    const dy = cy - height / 2
    return {
      x: dx * cos - dy * sin + width / 2,
      y: dx * sin + dy * cos + height / 2
    }
  })
  const brIdx = cornerScreen.reduce((best, p, i) =>
    (p.x + p.y) > (cornerScreen[best].x + cornerScreen[best].y) ? i : best
  , 0)
  const brCorner = corners[brIdx]
  const resizeHandleStyle = rot !== 0 ? {
    left: brCorner.x,
    top: brCorner.y,
    right: 'auto',
    bottom: 'auto',
    transform: `translate(-50%, -50%) rotate(${-rotation}deg)`
  } : undefined

  return (
    <div
      className={`slide-graphic-overlay ${isSelected ? 'selected' : ''}`}
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(-50%, -50%) rotate(${rotation}deg)${flipHorizontal ? ' scaleX(-1)' : ''}`,
        transformOrigin: 'center center',
        cursor: isEditing ? 'move' : 'pointer',
        zIndex: isSelected ? 10001 : undefined
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
        <>
          <div
            className="slide-graphic-rotate-handle"
            onPointerDown={onRotateDown}
            title="Rotate"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 11-9-9" />
              <path d="M21 3v6h-6" />
            </svg>
          </div>
          <div
            className="slide-graphic-flip-handle"
            onPointerDown={onFlipClick}
            title="Flip horizontally"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18" />
              <path d="M7 12l-4 4 4 4" />
              <path d="M17 12l4 4-4 4" />
            </svg>
          </div>
          <div
            className="slide-graphic-resize-handle se"
            style={resizeHandleStyle}
            onPointerDown={onResizeDown}
          />
        </>
      )}
    </div>
  )
}
