import { useCallback, useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import {
  DEFAULT_DRAWING_BRUSH_SIZE,
  DRAWING_BRUSH_MAX,
  DRAWING_BRUSH_MIN,
  normalizeDrawingPenColors,
} from '../utils/drawingDefaults'
import { clearDrawingBlob, loadDrawingBlob, saveDrawingPng } from '../utils/drawingStorage'
import './DrawingLayer.css'

export const DRAWING_TOOLS = ['pen', 'eraser', 'fill', 'blend']

function hexToRgba(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!m) return { r: 255, g: 255, b: 255, a: 255 }
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
    a: 255,
  }
}

function floodFill(ctx, x, y, fillColor) {
  const { width, height } = ctx.canvas
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  if (ix < 0 || iy < 0 || ix >= width || iy >= height) return
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const startPos = (iy * width + ix) * 4
  const startR = data[startPos]
  const startG = data[startPos + 1]
  const startB = data[startPos + 2]
  const startA = data[startPos + 3]
  const target = hexToRgba(fillColor)
  if (
    startR === target.r &&
    startG === target.g &&
    startB === target.b &&
    startA === target.a
  ) {
    return
  }
  const match = (pos) =>
    data[pos] === startR &&
    data[pos + 1] === startG &&
    data[pos + 2] === startB &&
    data[pos + 3] === startA
  const stack = [[ix, iy]]
  while (stack.length) {
    const [cx, cy] = stack.pop()
    const pos = (cy * width + cx) * 4
    if (!match(pos)) continue
    data[pos] = target.r
    data[pos + 1] = target.g
    data[pos + 2] = target.b
    data[pos + 3] = target.a
    if (cx > 0) stack.push([cx - 1, cy])
    if (cx < width - 1) stack.push([cx + 1, cy])
    if (cy > 0) stack.push([cx, cy - 1])
    if (cy < height - 1) stack.push([cx, cy + 1])
  }
  ctx.putImageData(imageData, 0, 0)
}

function applyBlendAt(ctx, x, y, radius) {
  const r = Math.max(8, radius)
  const { width, height } = ctx.canvas
  const sx = Math.max(0, Math.floor(x - r))
  const sy = Math.max(0, Math.floor(y - r))
  const sw = Math.min(width - sx, r * 2)
  const sh = Math.min(height - sy, r * 2)
  if (sw <= 0 || sh <= 0) return
  const off = document.createElement('canvas')
  off.width = sw
  off.height = sh
  const offCtx = off.getContext('2d')
  offCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh)
  offCtx.filter = `blur(${Math.max(4, r * 0.35)}px)`
  offCtx.drawImage(off, 0, 0)
  offCtx.filter = 'none'
  ctx.save()
  ctx.globalAlpha = 0.65
  ctx.drawImage(off, sx, sy)
  ctx.restore()
}

const DrawingLayer = forwardRef(function DrawingLayer(
  {
    slideId,
    width,
    height,
    penColors,
    projectName = '',
    drawingEnabled = false,
    tool = 'pen',
    color = '#ffffff',
    brushSize = DEFAULT_DRAWING_BRUSH_SIZE,
    onDrawingPersist,
  },
  ref
) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const saveTimerRef = useRef(null)
  const loadGenRef = useRef(0)

  const scheduleSave = useCallback(() => {
    if (!slideId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(async () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return
      const proj = (projectName || '').trim() || 'Untitled Project'
      const ctx = canvas.getContext('2d')
      const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data
      let hasInk = false
      for (let i = 3; i < sample.length; i += 4) {
        if (sample[i] > 0) {
          hasInk = true
          break
        }
      }
      if (!hasInk) {
        await clearDrawingBlob(proj, slideId)
        onDrawingPersist?.(slideId, null)
        return
      }
      const result = await saveDrawingPng(proj, slideId, blob)
      onDrawingPersist?.(slideId, result.path || 'cached')
    }, 400)
  }, [slideId, projectName, onDrawingPersist])

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      scheduleSave()
    },
  }))

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return
    const ctx = canvas.getContext('2d')
    const gen = ++loadGenRef.current
    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    if (!slideId) return
    const proj = (projectName || '').trim() || 'Untitled Project'
    loadDrawingBlob(proj, slideId).then((blob) => {
      if (gen !== loadGenRef.current || !blob) return
      const img = new Image()
      img.onload = () => {
        if (gen !== loadGenRef.current) return
        ctx.clearRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        URL.revokeObjectURL(img.src)
      }
      img.src = URL.createObjectURL(blob)
    })
  }, [slideId, width, height, projectName])

  const getPoint = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  const strokeTo = (from, to) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !from || !to) return
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = brushSize
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
  }

  const onPointerDown = (e) => {
    if (!drawingEnabled) return
    e.stopPropagation()
    e.preventDefault()
    const p = getPoint(e)
    if (!p) return
    drawingRef.current = true
    lastPointRef.current = p
    e.currentTarget.setPointerCapture(e.pointerId)

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    if (tool === 'fill') {
      floodFill(ctx, p.x, p.y, color)
      scheduleSave()
      drawingRef.current = false
      return
    }
    if (tool === 'blend') {
      applyBlendAt(ctx, p.x, p.y, brushSize * 2)
      scheduleSave()
    }
    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineCap = 'round'
      ctx.lineWidth = brushSize
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.fillStyle = 'rgba(0,0,0,1)'
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.fillStyle = color
      }
      ctx.beginPath()
      ctx.arc(p.x, p.y, brushSize / 2, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  const onPointerMove = (e) => {
    if (!drawingEnabled || !drawingRef.current) return
    e.stopPropagation()
    const p = getPoint(e)
    if (!p) return
    const last = lastPointRef.current
    if (tool === 'pen' || tool === 'eraser') {
      strokeTo(last, p)
    } else if (tool === 'blend') {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) applyBlendAt(ctx, p.x, p.y, brushSize * 2)
    }
    lastPointRef.current = p
  }

  const onPointerUp = (e) => {
    if (!drawingRef.current) return
    e.stopPropagation()
    drawingRef.current = false
    lastPointRef.current = null
    scheduleSave()
  }

  return (
    <canvas
      ref={canvasRef}
      className={[
        'drawing-layer__canvas',
        drawingEnabled && 'drawing-layer__canvas--active',
      ]
        .filter(Boolean)
        .join(' ')}
      width={width}
      height={height}
      aria-hidden={!drawingEnabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
})

export default DrawingLayer

export function DrawingToolbar({
  drawingEnabled,
  onToggleDrawing,
  penColors,
  tool,
  onToolChange,
  color,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  onClear,
}) {
  const colors = normalizeDrawingPenColors(penColors)
  return (
    <div
      className="drawing-layer__toolbar drawing-layer__toolbar--play"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`drawing-layer__tool-toggle ${drawingEnabled ? 'active' : ''}`}
        onClick={onToggleDrawing}
        title={drawingEnabled ? 'Exit drawing mode' : 'Draw on slide'}
      >
        {drawingEnabled ? 'Done' : 'Draw'}
      </button>
      {drawingEnabled &&
        DRAWING_TOOLS.map((t) => (
          <button
            key={t}
            type="button"
            className={`drawing-layer__tool ${tool === t ? 'active' : ''}`}
            onClick={() => onToolChange(t)}
            title={t.charAt(0).toUpperCase() + t.slice(1)}
          >
            {t === 'pen' && '✏'}
            {t === 'eraser' && '⌫'}
            {t === 'fill' && '▣'}
            {t === 'blend' && '◎'}
          </button>
        ))}
      {drawingEnabled && (
        <>
          <input
            type="range"
            min={DRAWING_BRUSH_MIN}
            max={DRAWING_BRUSH_MAX}
            value={brushSize}
            onChange={(e) => onBrushSizeChange(Number(e.target.value))}
            className="drawing-layer__brush"
            title="Brush size"
          />
          <div className="drawing-layer__colors">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                className={`drawing-layer__swatch ${color === c ? 'active' : ''}`}
                style={{ backgroundColor: c }}
                disabled={tool === 'eraser' || tool === 'blend'}
                onClick={() => onColorChange(c)}
                title={c}
              />
            ))}
          </div>
          <button type="button" className="drawing-layer__clear" onClick={onClear}>
            Clear slide
          </button>
        </>
      )}
    </div>
  )
}
