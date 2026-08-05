import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import './CanvasBoard.css'

export const CANVAS_WIDTH = 1024
export const CANVAS_HEIGHT = 768
export const BACKGROUND_COLOR = '#ffffff'
const MAX_HISTORY = 40
const FILL_TOLERANCE = 40
const SHAPE_TOOLS = new Set(['line', 'rect', 'circle'])

function hexToRgb(hex) {
  const clean = String(hex || '#000000').replace('#', '')
  const num = parseInt(clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function getPos(canvas, e) {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  }
}

/** Mouse pressure defaults to 0/0.5 depending on browser; only trust it for real stylus input. */
function pressureWidth(e, baseSize) {
  if (e.pointerType !== 'pen') return baseSize
  const p = typeof e.pressure === 'number' && e.pressure > 0 ? e.pressure : 0.5
  return Math.max(1, baseSize * (0.4 + p * 1.2))
}

function floodFill(ctx, startX, startY, fillHex, tolerance = FILL_TOLERANCE) {
  const { width, height } = ctx.canvas
  const sx = Math.floor(startX)
  const sy = Math.floor(startY)
  if (sx < 0 || sx >= width || sy < 0 || sy >= height) return

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const startIdx = (sy * width + sx) * 4
  const startR = data[startIdx]
  const startG = data[startIdx + 1]
  const startB = data[startIdx + 2]
  const startA = data[startIdx + 3]

  const fill = hexToRgb(fillHex)
  if (Math.abs(startR - fill.r) <= 2 && Math.abs(startG - fill.g) <= 2 && Math.abs(startB - fill.b) <= 2 && startA === 255) {
    return
  }

  const tol2 = tolerance * tolerance
  const matches = (idx) => {
    const dr = data[idx] - startR
    const dg = data[idx + 1] - startG
    const db = data[idx + 2] - startB
    const da = data[idx + 3] - startA
    return dr * dr + dg * dg + db * db + da * da <= tol2
  }

  const visited = new Uint8Array(width * height)
  const stack = [[sx, sy]]

  while (stack.length) {
    const [x, y] = stack.pop()
    if (x < 0 || x >= width || y < 0 || y >= height) continue
    const pixelIdx = y * width + x
    if (visited[pixelIdx]) continue
    const idx = pixelIdx * 4
    if (!matches(idx)) continue
    visited[pixelIdx] = 1
    data[idx] = fill.r
    data[idx + 1] = fill.g
    data[idx + 2] = fill.b
    data[idx + 3] = 255
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
  }

  ctx.putImageData(imageData, 0, 0)
}

function blurRegion(ctx, cx, cy, radius) {
  const { width, height } = ctx.canvas
  const x0 = Math.max(0, Math.floor(cx - radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const x1 = Math.min(width, Math.ceil(cx + radius))
  const y1 = Math.min(height, Math.ceil(cy + radius))
  const w = x1 - x0
  const h = y1 - y0
  if (w <= 0 || h <= 0) return

  const imageData = ctx.getImageData(x0, y0, w, h)
  const src = imageData.data
  const out = new Uint8ClampedArray(src.length)
  const kernel = 2
  const r2 = radius * radius

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const dx = x0 + x - cx
      const dy = y0 + y - cy
      if (dx * dx + dy * dy > r2) {
        out[idx] = src[idx]
        out[idx + 1] = src[idx + 1]
        out[idx + 2] = src[idx + 2]
        out[idx + 3] = src[idx + 3]
        continue
      }
      let r = 0, g = 0, b = 0, a = 0, count = 0
      for (let ky = -kernel; ky <= kernel; ky++) {
        for (let kx = -kernel; kx <= kernel; kx++) {
          const sx = x + kx
          const sy = y + ky
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue
          const sIdx = (sy * w + sx) * 4
          r += src[sIdx]; g += src[sIdx + 1]; b += src[sIdx + 2]; a += src[sIdx + 3]
          count++
        }
      }
      out[idx] = r / count
      out[idx + 1] = g / count
      out[idx + 2] = b / count
      out[idx + 3] = a / count
    }
  }
  imageData.data.set(out)
  ctx.putImageData(imageData, x0, y0)
}

function drawLineShape(ctx, from, to, color, width, shiftKey) {
  let end = to
  if (shiftKey) {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4)
    const dist = Math.hypot(dx, dy)
    end = { x: from.x + Math.cos(angle) * dist, y: from.y + Math.sin(angle) * dist }
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(end.x, end.y)
  ctx.stroke()
}

function drawRectShape(ctx, from, to, color, width, shiftKey) {
  let w = to.x - from.x
  let h = to.y - from.y
  if (shiftKey) {
    const s = Math.max(Math.abs(w), Math.abs(h))
    w = (w < 0 ? -1 : 1) * s
    h = (h < 0 ? -1 : 1) * s
  }
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.lineJoin = 'miter'
  ctx.strokeRect(from.x, from.y, w, h)
}

function drawCircleShape(ctx, from, to, color, width, shiftKey) {
  let rx = Math.abs(to.x - from.x) / 2
  let ry = Math.abs(to.y - from.y) / 2
  if (shiftKey) {
    const r = Math.max(rx, ry)
    rx = r
    ry = r
  }
  const cx = from.x + (to.x - from.x) / 2
  const cy = from.y + (to.y - from.y) / 2
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.beginPath()
  ctx.ellipse(cx, cy, Math.max(rx, 0.01), Math.max(ry, 0.01), 0, 0, Math.PI * 2)
  ctx.stroke()
}

function loadHtmlImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

const CanvasBoard = forwardRef(function CanvasBoard({ tool, color, size, zoom = 1, placing, onPlaced, onHistoryChange, onCommit, onDropFile }, ref) {
  const canvasRef = useRef(null)
  const ctxRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const historyRef = useRef([])
  const historyIndexRef = useRef(-1)
  const hasContentRef = useRef(false)
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const sizeRef = useRef(size)
  const placingRef = useRef(placing)
  const shapeSnapshotRef = useRef(null)
  const shapeStartRef = useRef(null)

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { sizeRef.current = size }, [size])
  useEffect(() => { placingRef.current = placing }, [placing])

  const notifyHistory = () => {
    onHistoryChange?.({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    })
  }

  const pushHistory = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    const snapshot = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
    historyIndexRef.current = historyRef.current.length - 1
    notifyHistory()
    onCommit?.()
  }

  const clearToBackground = (ctx) => {
    ctx.fillStyle = BACKGROUND_COLOR
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = CANVAS_WIDTH
    canvas.height = CANVAS_HEIGHT
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctxRef.current = ctx
    clearToBackground(ctx)
    pushHistory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    if (zoom === 1) {
      canvas.style.width = ''
      canvas.style.height = ''
      return
    }
    const baseWidth = container.clientWidth
    canvas.style.width = `${baseWidth * zoom}px`
    canvas.style.height = `${baseWidth * zoom * (CANVAS_HEIGHT / CANVAS_WIDTH)}px`
  }, [zoom])

  const drawImageFitted = (ctx, img) => {
    clearToBackground(ctx)
    const scale = Math.min(CANVAS_WIDTH / img.width, CANVAS_HEIGHT / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (CANVAS_WIDTH - w) / 2
    const y = (CANVAS_HEIGHT - h) / 2
    ctx.drawImage(img, x, y, w, h)
  }

  useImperativeHandle(ref, () => ({
    exportPNG: () => canvasRef.current.toDataURL('image/png'),
    hasContent: () => hasContentRef.current,
    clear: () => {
      const ctx = ctxRef.current
      clearToBackground(ctx)
      hasContentRef.current = false
      pushHistory()
    },
    undo: () => {
      if (historyIndexRef.current <= 0) return
      historyIndexRef.current -= 1
      ctxRef.current.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
      notifyHistory()
      onCommit?.()
    },
    redo: () => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return
      historyIndexRef.current += 1
      ctxRef.current.putImageData(historyRef.current[historyIndexRef.current], 0, 0)
      notifyHistory()
      onCommit?.()
    },
    /** Fit an external image (import, or a generated result) onto the canvas as a new undoable state. */
    loadImage: async (dataUrl) => {
      const img = await loadHtmlImage(dataUrl)
      drawImageFitted(ctxRef.current, img)
      hasContentRef.current = true
      pushHistory()
    },
    /** Restore an exact 1:1 autosave snapshot as the base state (does not count as a user action). */
    restoreSnapshot: async (dataUrl) => {
      const img = await loadHtmlImage(dataUrl)
      const ctx = ctxRef.current
      clearToBackground(ctx)
      ctx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      hasContentRef.current = true
      historyRef.current = [ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)]
      historyIndexRef.current = 0
      notifyHistory()
    },
  }))

  const strokeTo = (ctx, from, to, strokeColor, width) => {
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(to.x, to.y, width / 2, 0, Math.PI * 2)
    ctx.fillStyle = strokeColor
    ctx.fill()
  }

  const stampPlacedImage = (ctx, pos) => {
    const active = placingRef.current
    if (!active?.img) return
    const { img, maxDim } = active
    const scale = maxDim / Math.max(img.width, img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, pos.x - w / 2, pos.y - h / 2, w, h)
  }

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    canvas.setPointerCapture(e.pointerId)
    const pos = getPos(canvas, e)

    if (placingRef.current?.img) {
      stampPlacedImage(ctx, pos)
      hasContentRef.current = true
      pushHistory()
      onPlaced?.()
      return
    }

    const currentTool = toolRef.current

    if (currentTool === 'fill') {
      floodFill(ctx, pos.x, pos.y, colorRef.current)
      hasContentRef.current = true
      pushHistory()
      return
    }

    if (SHAPE_TOOLS.has(currentTool)) {
      shapeSnapshotRef.current = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
      shapeStartRef.current = pos
      drawingRef.current = true
      hasContentRef.current = true
      return
    }

    drawingRef.current = true
    lastPointRef.current = pos
    hasContentRef.current = true

    if (currentTool === 'blur') {
      blurRegion(ctx, pos.x, pos.y, sizeRef.current)
    } else {
      const strokeColor = currentTool === 'eraser' ? BACKGROUND_COLOR : colorRef.current
      strokeTo(ctx, pos, pos, strokeColor, pressureWidth(e, sizeRef.current))
    }
  }

  const handlePointerMove = (e) => {
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const ctx = ctxRef.current
    const pos = getPos(canvas, e)
    const currentTool = toolRef.current

    if (SHAPE_TOOLS.has(currentTool)) {
      ctx.putImageData(shapeSnapshotRef.current, 0, 0)
      const from = shapeStartRef.current
      if (currentTool === 'line') drawLineShape(ctx, from, pos, colorRef.current, sizeRef.current, e.shiftKey)
      else if (currentTool === 'rect') drawRectShape(ctx, from, pos, colorRef.current, sizeRef.current, e.shiftKey)
      else drawCircleShape(ctx, from, pos, colorRef.current, sizeRef.current, e.shiftKey)
      return
    }

    if (currentTool === 'blur') {
      blurRegion(ctx, pos.x, pos.y, sizeRef.current)
    } else {
      const strokeColor = currentTool === 'eraser' ? BACKGROUND_COLOR : colorRef.current
      strokeTo(ctx, lastPointRef.current, pos, strokeColor, pressureWidth(e, sizeRef.current))
    }
    lastPointRef.current = pos
  }

  const handlePointerUp = () => {
    if (drawingRef.current) {
      pushHistory()
    }
    drawingRef.current = false
    lastPointRef.current = null
    shapeSnapshotRef.current = null
    shapeStartRef.current = null
  }

  const handleDragOver = (e) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault()
  }

  const handleDrop = (e) => {
    const file = e.dataTransfer?.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    e.preventDefault()
    onDropFile?.(file)
  }

  return (
    <div className="sketch-canvas-viewport" onDragOver={handleDragOver} onDrop={handleDrop}>
      <canvas
        ref={canvasRef}
        className={`sketch-canvas tool-${tool}${placing ? ' tool-placing' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
    </div>
  )
})

export default CanvasBoard
