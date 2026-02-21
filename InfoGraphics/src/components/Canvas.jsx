import { useRef, useState, useCallback, useEffect } from 'react'
import CanvasElement from './CanvasElement'
import './Canvas.css'

function getCanvasSize(aspectRatio, resolution = 800) {
  const r = resolution || 800
  if (aspectRatio === '16:9') return { w: r, h: Math.round(r * 9 / 16) }
  if (aspectRatio === '9:16') return { w: Math.round(r * 9 / 16), h: r }
  if (aspectRatio === '1:1') return { w: r, h: r }
  return { w: r, h: Math.round(r * 9 / 16) }
}

function screenToCanvas(clientX, clientY, canvasEl, size) {
  if (!canvasEl) return { x: 0, y: 0 }
  const rect = canvasEl.getBoundingClientRect()
  return {
    x: ((clientX - rect.left) / rect.width) * size.w,
    y: ((clientY - rect.top) / rect.height) * size.h
  }
}

function rectsOverlap(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

export default function Canvas({ aspectRatio, resolution, elements, currentTime = 0, selectedIds = [], onSelect, onUpdate, onDeleteSelected, onPushUndo, backgroundColor = '#ffffff', zoom = 100, canvasRef }) {
  const containerRef = useRef(null)
  const [dragState, setDragState] = useState(null)
  const [resizeHandle, setResizeHandle] = useState(null)
  const [rotateHandle, setRotateHandle] = useState(null)
  const [marquee, setMarquee] = useState(null)
  const marqueeJustCompleted = useRef(false)
  const dragStateRef = useRef(null)
  const resizeHandleRef = useRef(null)
  const rotateHandleRef = useRef(null)

  useEffect(() => {
    dragStateRef.current = dragState
    resizeHandleRef.current = resizeHandle
    rotateHandleRef.current = rotateHandle
  }, [dragState, resizeHandle, rotateHandle])

  const size = getCanvasSize(aspectRatio, resolution)
  const visibleElements = elements
    .filter(el => {
      if (el.visible === false) return false
      if (el.clipStart != null && el.clipEnd != null) {
        return currentTime >= el.clipStart && currentTime < el.clipEnd
      }
      return true
    })
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))

  const attachGlobalListeners = useCallback((onMove, onUp) => {
    const move = (ev) => {
      ev.preventDefault()
      onMove(ev)
    }
    const up = (ev) => {
      ev.preventDefault()
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
  }, [])

  const getElementCenter = useCallback((el) => {
    const rect = canvasRef?.current?.getBoundingClientRect()
    if (!rect) return null
    const cx = rect.left + (el.x + el.width / 2) * (rect.width / size.w)
    const cy = rect.top + (el.y + el.height / 2) * (rect.height / size.h)
    return { x: cx, y: cy }
  }, [size, canvasRef])

  const handlePointerMove = useCallback((e) => {
    const rot = rotateHandleRef.current
    const marq = marquee
    const drag = dragStateRef.current
    const resize = resizeHandleRef.current

    if (rot) {
      const el = elements.find(x => x.id === rot.id)
      const center = el && getElementCenter(el)
      if (center) {
        const startAngle = Math.atan2(rot.startY - center.y, rot.startX - center.x)
        const currAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x)
        const deltaDeg = ((currAngle - startAngle) * 180) / Math.PI
        const newRot = Math.round(rot.startRotation + deltaDeg)
        onUpdate(rot.id, { rotation: newRot })
        setRotateHandle(prev => prev ? { ...prev, startX: e.clientX, startY: e.clientY, startRotation: newRot } : null)
      }
    }
    if (marq) {
      const pt = screenToCanvas(e.clientX, e.clientY, canvasRef?.current, size)
      setMarquee(prev => prev ? { ...prev, endX: pt.x, endY: pt.y } : null)
    }
    if (drag) {
      const currCanvas = screenToCanvas(e.clientX, e.clientY, canvasRef?.current, size)
      drag.ids.forEach(id => {
        const pos = drag.positions[id]
        if (pos && pos.offsetX != null) {
          const newX = currCanvas.x + pos.offsetX
          const newY = currCanvas.y + pos.offsetY
          onUpdate(id, { x: newX, y: newY })
        } else if (pos) {
          onUpdate(id, { x: pos.x, y: pos.y })
        }
      })
      setDragState(prev => prev ? ({
        ...prev,
        positions: Object.fromEntries(
          prev.ids.map(id => {
            const pos = prev.positions[id]
            if (pos && pos.offsetX != null) {
              return [id, { ...pos, x: currCanvas.x + pos.offsetX, y: currCanvas.y + pos.offsetY }]
            }
            return [id, pos]
          })
        )
      }) : null)
    }
    if (resize) {
      const dx = e.clientX - resize.startX
      const dy = e.clientY - resize.startY
      const rect = canvasRef?.current?.getBoundingClientRect()
      const scaleX = rect ? size.w / rect.width : 1
      const scaleY = rect ? size.h / rect.height : 1
      const dCanvasX = dx * scaleX
      const dCanvasY = dy * scaleY
      let w = resize.startW
      let h = resize.startH
      if (resize.handle.includes('e')) w += dCanvasX
      if (resize.handle.includes('w')) w -= dCanvasX
      if (resize.handle.includes('s')) h += dCanvasY
      if (resize.handle.includes('n')) h -= dCanvasY
      w = Math.max(40, w)
      h = Math.max(24, h)
      onUpdate(resize.id, { width: w, height: h })
      setResizeHandle(prev => prev ? { ...prev, startX: e.clientX, startY: e.clientY, startW: w, startH: h } : null)
    }
  }, [marquee, size, canvasRef, onUpdate, elements, getElementCenter])

  const handlePointerDown = useCallback((e, id, handle) => {
    if (handle === 'move') {
      e.preventDefault()
      onPushUndo?.()
      const el = elements.find(x => x.id === id)
      if (!el) return
      const idsToDrag = selectedIds.includes(id) ? selectedIds : [id]
      if (!selectedIds.includes(id)) onSelect([id])
      const grabCanvas = screenToCanvas(e.clientX, e.clientY, canvasRef?.current, size)
      const positions = {}
      idsToDrag.forEach(i => {
        const elem = elements.find(x => x.id === i)
        if (elem) positions[i] = { x: elem.x, y: elem.y, offsetX: elem.x - grabCanvas.x, offsetY: elem.y - grabCanvas.y }
      })
      const state = { ids: idsToDrag, positions }
      dragStateRef.current = state
      setDragState(state)
      document.body.style.cursor = 'grabbing'
      attachGlobalListeners(
        (ev) => handlePointerMove(ev),
        () => { dragStateRef.current = null; setDragState(null) }
      )
    } else if (handle === 'rotate' && selectedIds.length === 1 && selectedIds[0] === id) {
      e.preventDefault()
      onPushUndo?.()
      const el = elements.find(x => x.id === id)
      if (el) {
        const rotState = { id, startX: e.clientX, startY: e.clientY, startRotation: el.rotation ?? 0 }
        rotateHandleRef.current = rotState
        setRotateHandle(rotState)
        document.body.style.cursor = 'grabbing'
        attachGlobalListeners(
          (ev) => handlePointerMove(ev),
          () => { rotateHandleRef.current = null; setRotateHandle(null); document.body.style.cursor = '' }
        )
      }
    } else if (handle && selectedIds.length === 1 && selectedIds[0] === id) {
      e.preventDefault()
      onPushUndo?.()
      const el = elements.find(x => x.id === id)
      if (el) {
        const resizeState = { id, handle, startX: e.clientX, startY: e.clientY, startW: el.width, startH: el.height }
        resizeHandleRef.current = resizeState
        setResizeHandle(resizeState)
        document.body.style.cursor = 'nwse-resize'
        attachGlobalListeners(
          (ev) => handlePointerMove(ev),
          () => { resizeHandleRef.current = null; setResizeHandle(null); document.body.style.cursor = '' }
        )
      }
    } else {
      if (e.shiftKey) {
        onSelect(id, { shift: true })
      } else {
        onSelect([id])
      }
    }
  }, [elements, selectedIds, onSelect, onPushUndo, attachGlobalListeners, handlePointerMove, size, canvasRef])

  const handleCanvasPointerDown = useCallback((e) => {
    if (e.target !== e.currentTarget) return
    if (e.shiftKey) return
    const pt = screenToCanvas(e.clientX, e.clientY, canvasRef?.current, size)
    setMarquee({ startX: pt.x, startY: pt.y, endX: pt.x, endY: pt.y })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [size, canvasRef])

  const handlePointerUp = useCallback((e) => {
    try { e.target.releasePointerCapture?.(e.pointerId) } catch (_) {}
    if (marquee) {
      const x1 = Math.min(marquee.startX, marquee.endX)
      const y1 = Math.min(marquee.startY, marquee.endY)
      const x2 = Math.max(marquee.startX, marquee.endX)
      const y2 = Math.max(marquee.startY, marquee.endY)
      const w = Math.max(1, x2 - x1)
      const h = Math.max(1, y2 - y1)
      const selRect = { x: x1, y: y1, w, h }
      const hit = visibleElements.filter(el => rectsOverlap(selRect, { x: el.x, y: el.y, w: el.width, h: el.height }))
      onSelect(hit.map(el => el.id))
      setMarquee(null)
      marqueeJustCompleted.current = true
    }
    setDragState(null)
    setResizeHandle(null)
    setRotateHandle(null)
  }, [marquee, visibleElements, onSelect])

  const handleCanvasClick = useCallback((e) => {
    if (e.target !== e.currentTarget) return
    if (marqueeJustCompleted.current) {
      marqueeJustCompleted.current = false
      return
    }
    onSelect([])
  }, [onSelect])

  const marqueeRect = marquee ? (() => {
    const x = Math.min(marquee.startX, marquee.endX)
    const y = Math.min(marquee.startY, marquee.endY)
    const w = Math.max(1, Math.abs(marquee.endX - marquee.startX))
    const h = Math.max(1, Math.abs(marquee.endY - marquee.startY))
    return { x, y, w, h }
  })() : null

  return (
    <div
      className="canvas-wrapper"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      <div
        className="canvas-container"
        ref={containerRef}
        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center center' }}
      >
        <div
          ref={canvasRef}
          className="canvas"
          style={{
            width: size.w,
            height: size.h,
            backgroundColor
          }}
          onPointerDown={handleCanvasPointerDown}
          onClick={handleCanvasClick}
        >
          {visibleElements.map(el => (
            <CanvasElement
              key={el.id}
              element={el}
              isSelected={selectedIds.includes(el.id)}
              showResizeHandles={selectedIds.length === 1 && selectedIds[0] === el.id}
              onPointerDown={handlePointerDown}
            />
          ))}
          {marqueeRect && (
            <div
              className="canvas-marquee"
              style={{
                left: marqueeRect.x,
                top: marqueeRect.y,
                width: marqueeRect.w,
                height: marqueeRect.h
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
