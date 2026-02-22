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

const SNAP_THRESHOLD = 8

function getSnapPoints(elements, draggingIds, size) {
  const points = { x: new Set(), y: new Set() }
  elements.forEach(el => {
    if (draggingIds.includes(el.id)) return
    points.x.add(el.x)
    points.x.add(el.x + el.width)
    points.x.add(el.x + el.width / 2)
    points.y.add(el.y)
    points.y.add(el.y + el.height)
    points.y.add(el.y + el.height / 2)
  })
  points.x.add(0)
  points.x.add(size.w)
  points.x.add(size.w / 2)
  points.y.add(0)
  points.y.add(size.h)
  points.y.add(size.h / 2)
  return points
}

function snapValue(val, points, threshold) {
  for (const p of points) {
    if (Math.abs(val - p) <= threshold) return p
  }
  return val
}

function findSnappedGuides(draggingRects, snapPoints, threshold) {
  const guides = []
  draggingRects.forEach(({ x, y, w, h }) => {
    const edges = [
      { val: x, type: 'x', pos: x },
      { val: x + w, type: 'x', pos: x + w },
      { val: x + w / 2, type: 'x', pos: x + w / 2 },
      { val: y, type: 'y', pos: y },
      { val: y + h, type: 'y', pos: y + h },
      { val: y + h / 2, type: 'y', pos: y + h / 2 }
    ]
    edges.forEach(({ val, type, pos }) => {
      for (const p of snapPoints[type]) {
        if (Math.abs(val - p) <= threshold) {
          guides.push({ type, pos: p })
          break
        }
      }
    })
  })
  return guides
}

export default function Canvas({ aspectRatio, resolution, elements, currentTime = 0, selectedIds = [], onSelect, onUpdate, onUpdateMultiple, onDeleteSelected, onPushUndo, backgroundColor = '#ffffff', zoom = 100, canvasRef, editingTextId = null, onStartEditText, onFinishEditText }) {
  const containerRef = useRef(null)
  const [dragState, setDragState] = useState(null)
  const [resizeHandle, setResizeHandle] = useState(null)
  const [groupResizeHandle, setGroupResizeHandle] = useState(null)
  const [rotateHandle, setRotateHandle] = useState(null)
  const [marquee, setMarquee] = useState(null)
  const [snapGuides, setSnapGuides] = useState([])
  const marqueeJustCompleted = useRef(false)
  const dragStateRef = useRef(null)
  const resizeHandleRef = useRef(null)
  const rotateHandleRef = useRef(null)

  useEffect(() => {
    dragStateRef.current = dragState
    resizeHandleRef.current = resizeHandle
    rotateHandleRef.current = rotateHandle
  }, [dragState, resizeHandle, rotateHandle])

  const groupResizeHandleRef = useRef(null)
  useEffect(() => {
    groupResizeHandleRef.current = groupResizeHandle
  }, [groupResizeHandle])

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
    const groupResize = groupResizeHandleRef.current

    if (groupResize && onUpdateMultiple) {
      const dx = e.clientX - groupResize.startX
      const dy = e.clientY - groupResize.startY
      const rect = canvasRef?.current?.getBoundingClientRect()
      const scaleX = rect ? size.w / rect.width : 1
      const scaleY = rect ? size.h / rect.height : 1
      const dCanvasX = dx * scaleX
      const dCanvasY = dy * scaleY
      let newW = groupResize.startW + dCanvasX
      let newH = groupResize.startH + dCanvasY
      if (e.shiftKey) {
        const aspect = groupResize.startW / groupResize.startH
        if (Math.abs(dCanvasX) > Math.abs(dCanvasY)) {
          newH = newW / aspect
        } else {
          newW = newH * aspect
        }
      }
      newW = Math.max(40, newW)
      newH = Math.max(24, newH)
      const scaleXFactor = newW / groupResize.startW
      const scaleYFactor = newH / groupResize.startH
      const updatesById = {}
      groupResize.ids.forEach(id => {
        const el = elements.find(x => x.id === id)
        if (!el) return
        const relX = (el.x - groupResize.minX) / groupResize.startW
        const relY = (el.y - groupResize.minY) / groupResize.startH
        const relW = el.width / groupResize.startW
        const relH = el.height / groupResize.startH
        updatesById[id] = {
          x: groupResize.minX + relX * newW,
          y: groupResize.minY + relY * newH,
          width: Math.max(20, el.width * scaleXFactor),
          height: Math.max(16, el.height * scaleYFactor)
        }
      })
      onUpdateMultiple(updatesById)
      setGroupResizeHandle(prev => prev ? { ...prev, startX: e.clientX, startY: e.clientY, startW: newW, startH: newH } : null)
      return
    }
    if (rot) {
      const el = elements.find(x => x.id === rot.id)
      const center = el && getElementCenter(el)
      if (center) {
        const startAngle = Math.atan2(rot.startY - center.y, rot.startX - center.x)
        const currAngle = Math.atan2(e.clientY - center.y, e.clientX - center.x)
        const deltaDeg = ((currAngle - startAngle) * 180) / Math.PI
        let newRot = Math.round(rot.startRotation + deltaDeg)
        if (e.shiftKey) {
          newRot = Math.round(newRot / 10) * 10
        }
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
      const snapPoints = getSnapPoints(elements, drag.ids, size)
      const proposed = {}
      drag.ids.forEach(id => {
        const pos = drag.positions[id]
        if (pos && pos.offsetX != null) {
          let newX = currCanvas.x + pos.offsetX
          let newY = currCanvas.y + pos.offsetY
          const el = elements.find(x => x.id === id)
          if (el) {
            const snappedX = snapValue(newX, snapPoints.x, SNAP_THRESHOLD)
            const snappedXRight = snapValue(newX + el.width, snapPoints.x, SNAP_THRESHOLD) - el.width
            const snappedXCenter = snapValue(newX + el.width / 2, snapPoints.x, SNAP_THRESHOLD) - el.width / 2
            if (snappedX !== newX) newX = snappedX
            else if (snappedXRight !== newX) newX = snappedXRight
            else if (snappedXCenter !== newX) newX = snappedXCenter
            const snappedY = snapValue(newY, snapPoints.y, SNAP_THRESHOLD)
            const snappedYBottom = snapValue(newY + el.height, snapPoints.y, SNAP_THRESHOLD) - el.height
            const snappedYCenter = snapValue(newY + el.height / 2, snapPoints.y, SNAP_THRESHOLD) - el.height / 2
            if (snappedY !== newY) newY = snappedY
            else if (snappedYBottom !== newY) newY = snappedYBottom
            else if (snappedYCenter !== newY) newY = snappedYCenter
          }
          proposed[id] = { x: newX, y: newY, w: el?.width ?? 100, h: el?.height ?? 100 }
          onUpdate(id, { x: newX, y: newY })
        } else if (pos) {
          onUpdate(id, { x: pos.x, y: pos.y })
        }
      })
      const rects = Object.entries(proposed).map(([, r]) => r)
      const guides = findSnappedGuides(rects, snapPoints, SNAP_THRESHOLD)
      setSnapGuides(guides)
      setDragState(prev => prev ? ({
        ...prev,
        positions: Object.fromEntries(
          prev.ids.map(id => {
            const pos = prev.positions[id]
            const p = proposed[id]
            if (p) return [id, { ...pos, x: p.x, y: p.y }]
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
  }, [marquee, size, canvasRef, onUpdate, onUpdateMultiple, elements, getElementCenter])

  const handlePointerDown = useCallback((e, id, handle) => {
    if (handle === 'group-resize' && selectedIds.length > 1 && onUpdateMultiple) {
      e.preventDefault()
      e.stopPropagation()
      onPushUndo?.()
      const selected = elements.filter(x => selectedIds.includes(x.id))
      if (selected.length < 2) return
      const minX = Math.min(...selected.map(el => el.x))
      const minY = Math.min(...selected.map(el => el.y))
      const maxX = Math.max(...selected.map(el => el.x + el.width))
      const maxY = Math.max(...selected.map(el => el.y + el.height))
      const w = maxX - minX
      const h = maxY - minY
      const state = { ids: selectedIds, minX, minY, startW: w, startH: h, startX: e.clientX, startY: e.clientY }
      groupResizeHandleRef.current = state
      setGroupResizeHandle(state)
      document.body.style.cursor = 'nwse-resize'
      attachGlobalListeners(
        (ev) => handlePointerMove(ev),
        () => { groupResizeHandleRef.current = null; setGroupResizeHandle(null); document.body.style.cursor = '' }
      )
      return
    }
    if (handle === 'move') {
      if (e.shiftKey) {
        onSelect(id, { shift: true })
        return
      }
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
        () => { dragStateRef.current = null; setDragState(null); setSnapGuides([]) }
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
    } else if (handle === 'flip' && selectedIds.length === 1 && selectedIds[0] === id) {
      e.preventDefault()
      e.stopPropagation()
      onPushUndo?.()
      const el = elements.find(x => x.id === id)
      if (el) {
        onUpdate(id, { imageFlipHorizontal: !el.imageFlipHorizontal })
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
  }, [elements, selectedIds, onSelect, onPushUndo, onUpdate, onUpdateMultiple, attachGlobalListeners, handlePointerMove, size, canvasRef])

  const handleCanvasPointerDown = useCallback((e) => {
    if (e.target !== e.currentTarget) return
    if (e.shiftKey) return
    const pt = screenToCanvas(e.clientX, e.clientY, canvasRef?.current, size)
    setMarquee({ startX: pt.x, startY: pt.y, endX: pt.x, endY: pt.y })
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }, [size, canvasRef])

  const handlePointerUp = useCallback((e) => {
    try { e.target.releasePointerCapture?.(e.pointerId) } catch (_) {}
    setGroupResizeHandle(null)
    groupResizeHandleRef.current = null
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

  const selectionBounds = selectedIds.length > 1 ? (() => {
    const selected = visibleElements.filter(el => selectedIds.includes(el.id))
    if (selected.length < 2) return null
    const minX = Math.min(...selected.map(el => el.x))
    const minY = Math.min(...selected.map(el => el.y))
    const maxX = Math.max(...selected.map(el => el.x + el.width))
    const maxY = Math.max(...selected.map(el => el.y + el.height))
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
  })() : null

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
              currentTime={currentTime}
              isSelected={selectedIds.includes(el.id)}
              showResizeHandles={selectedIds.length === 1 && selectedIds[0] === el.id}
              onPointerDown={handlePointerDown}
              isEditingText={editingTextId === el.id}
              onStartEditText={onStartEditText}
              onFinishEditText={onFinishEditText}
              onUpdate={onUpdate}
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
          {selectionBounds && (
            <div
              className="canvas-selection-group"
              style={{
                left: selectionBounds.x,
                top: selectionBounds.y,
                width: selectionBounds.w,
                height: selectionBounds.h
              }}
            >
              <div
                className="resize-handle se canvas-group-resize-handle"
                onPointerDown={(e) => handlePointerDown(e, selectedIds[0], 'group-resize')}
                title="Scale selection"
              />
            </div>
          )}
          {snapGuides.map((g, i) => (
            <div
              key={i}
              className={`canvas-snap-guide canvas-snap-guide-${g.type}`}
              style={
                g.type === 'x'
                  ? { left: g.pos, top: 0, width: 1, height: size.h }
                  : { left: 0, top: g.pos, width: size.w, height: 1 }
              }
            />
          ))}
        </div>
      </div>
    </div>
  )
}
