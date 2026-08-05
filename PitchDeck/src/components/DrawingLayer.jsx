import { useCallback, useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import {
  DEFAULT_DRAWING_BRUSH_SIZE,
  DEFAULT_DRAWING_SMOOTHING,
  DEFAULT_DRAWING_WOBBLE,
  DRAWING_BRUSH_MAX,
  DRAWING_BRUSH_MIN,
  normalizeDrawingPenColors,
  DRAWING_HISTORY_MAX,
} from '../utils/drawingDefaults'
import { clearDrawingBlob, loadDrawingBlob, saveDrawingPng, normalizeDrawingProjectName } from '../utils/drawingStorage'
import './DrawingLayer.css'

export const DRAWING_TOOLS = ['pen', 'eraser', 'fill', 'blend']

/** 0–1; mouse/touch use 1 so size matches the slider unless a pen reports pressure. */
function pointerPressure(e) {
  if (e.pointerType === 'mouse' || e.pointerType === 'touch') return 1
  const raw = typeof e.pressure === 'number' ? e.pressure : 0.5
  if (raw <= 0) return 0.08
  return Math.min(1, Math.max(0, raw))
}

function dist(a, b) {
  if (!a || !b) return 0
  const dx = b.x - a.x
  const dy = b.y - a.y
  return Math.hypot(dx, dy)
}

/** Hand-drawn jitter; t advances along the stroke, seed fixed per stroke. */
function applyWobble(x, y, wobble, brushW, t, seed, dirX, dirY) {
  if (wobble <= 0) return { x, y }
  const amp = wobble * Math.max(0.9, brushW * 0.42)
  const a = t * 0.11 + seed
  const b = t * 0.27 + seed * 1.63
  const tremor =
    Math.sin(a) * 0.55 + Math.sin(b * 2.05) * 0.35 + Math.sin(a * 3.7 + seed) * 0.18
  const lateral =
    Math.cos(a * 1.09) * 0.55 + Math.cos(b * 1.21) * 0.35 + Math.cos(b * 2.8 + seed) * 0.15
  const len = Math.hypot(dirX, dirY)
  const nx = len > 0.5 ? -dirY / len : Math.cos(seed)
  const ny = len > 0.5 ? dirX / len : Math.sin(seed)
  return {
    x: x + nx * lateral * amp + tremor * amp * 0.35,
    y: y + ny * lateral * amp + tremor * amp * 0.35,
  }
}

function smoothToward(current, target, smoothing) {
  if (smoothing <= 0) return target
  const keep = 1 - smoothing * 0.94
  return {
    x: current.x + (target.x - current.x) * keep,
    y: current.y + (target.y - current.y) * keep,
    pressure: target.pressure,
  }
}

function prepareStrokePoint(raw, state, smoothing, wobble, brushW) {
  const prevRaw = state.lastRaw
  const dx = prevRaw ? raw.x - prevRaw.x : 0
  const dy = prevRaw ? raw.y - prevRaw.y : 0
  state.wobbleT += dist(prevRaw, raw)
  state.lastRaw = raw
  let p = applyWobble(raw.x, raw.y, wobble, brushW, state.wobbleT, state.seed, dx, dy)
  p = { ...p, pressure: raw.pressure }
  if (smoothing > 0 && state.smooth) {
    p = smoothToward(state.smooth, p, smoothing)
  }
  state.smooth = p
  return p
}

function resetStrokeState(state, firstPoint) {
  state.seed = Math.random() * 1000
  state.wobbleT = 0
  state.lastRaw = firstPoint
  state.smooth = firstPoint ? { ...firstPoint } : null
  state.lastDrawn = null
  state.quadAnchor = null
}

function brushSizeForPressure(baseSize, pressure, activeTool) {
  if (activeTool !== 'pen' && activeTool !== 'eraser') return baseSize
  const minRatio = 0.12
  const ratio = minRatio + pressure * (1 - minRatio)
  const size = baseSize * ratio
  return Math.max(DRAWING_BRUSH_MIN, Math.min(DRAWING_BRUSH_MAX, size))
}

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

function applySoftRoundBlurStamp(ctx, x, y, radius) {
  const r = Math.max(10, radius)
  const pad = Math.ceil(r * 1.35)
  const size = pad * 2
  const { width, height } = ctx.canvas
  const sx = Math.max(0, Math.floor(x - pad))
  const sy = Math.max(0, Math.floor(y - pad))
  const sw = Math.min(width - sx, size)
  const sh = Math.min(height - sy, size)
  if (sw <= 2 || sh <= 2) return

  const localX = x - sx
  const localY = y - sy

  const off = document.createElement('canvas')
  off.width = sw
  off.height = sh
  const offCtx = off.getContext('2d')
  offCtx.drawImage(ctx.canvas, sx, sy, sw, sh, 0, 0, sw, sh)

  const blurPx = Math.max(8, r * 0.55)
  offCtx.filter = `blur(${blurPx}px)`
  offCtx.drawImage(off, 0, 0)
  offCtx.filter = `blur(${blurPx * 0.45}px)`
  offCtx.drawImage(off, 0, 0)
  offCtx.filter = 'none'

  const mask = document.createElement('canvas')
  mask.width = sw
  mask.height = sh
  const mctx = mask.getContext('2d')
  const grd = mctx.createRadialGradient(localX, localY, 0, localX, localY, r)
  grd.addColorStop(0, 'rgba(255,255,255,0.92)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.72)')
  grd.addColorStop(0.55, 'rgba(255,255,255,0.28)')
  grd.addColorStop(0.78, 'rgba(255,255,255,0.06)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  mctx.fillStyle = grd
  mctx.fillRect(0, 0, sw, sh)

  offCtx.globalCompositeOperation = 'destination-in'
  offCtx.drawImage(mask, 0, 0)
  offCtx.globalCompositeOperation = 'source-over'

  ctx.save()
  ctx.globalAlpha = 0.78
  ctx.drawImage(off, sx, sy)
  ctx.restore()
}

function stampBlendAlong(ctx, from, to, radius) {
  if (!from) {
    applySoftRoundBlurStamp(ctx, to.x, to.y, radius)
    return
  }
  const d = dist(from, to)
  const step = Math.max(6, radius * 0.32)
  if (d <= step) {
    applySoftRoundBlurStamp(ctx, to.x, to.y, radius)
    return
  }
  const n = Math.ceil(d / step)
  for (let i = 1; i <= n; i++) {
    const t = i / n
    applySoftRoundBlurStamp(ctx, from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, radius)
  }
}

function cloneCanvas(source) {
  const c = document.createElement('canvas')
  c.width = source.width
  c.height = source.height
  const ctx = c.getContext('2d')
  ctx.drawImage(source, 0, 0)
  return c
}

function restoreCanvas(target, snapshot) {
  const ctx = target.getContext('2d')
  ctx.clearRect(0, 0, target.width, target.height)
  if (snapshot) ctx.drawImage(snapshot, 0, 0)
}

function canvasHasInk(canvas) {
  const ctx = canvas.getContext('2d')
  const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 3; i < sample.length; i += 4) {
    if (sample[i] > 0) return true
  }
  return false
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
    lineSmoothing = 0,
    lineWobble = 0,
    onDrawingPersist,
    onHistoryChange,
    onLoadComplete,
  },
  ref
) {
  const canvasRef = useRef(null)
  const drawingRef = useRef(false)
  const lastPointRef = useRef(null)
  const lastBlendPointRef = useRef(null)
  const strokeStateRef = useRef({
    seed: 0,
    wobbleT: 0,
    lastRaw: null,
    smooth: null,
    lastDrawn: null,
    quadAnchor: null,
  })
  const smoothingRef = useRef(lineSmoothing)
  const wobbleRef = useRef(lineWobble)
  const saveTimerRef = useRef(null)
  const loadGenRef = useRef(0)
  const flushSaveRef = useRef(null)
  const undoStackRef = useRef([])
  const redoStackRef = useRef([])
  const gestureSnapshotRef = useRef(null)
  const undoFnRef = useRef(null)
  const redoFnRef = useRef(null)
  const onLoadCompleteRef = useRef(onLoadComplete)
  const onHistoryChangeRef = useRef(onHistoryChange)
  const onDrawingPersistRef = useRef(onDrawingPersist)
  const lastLoadKeyRef = useRef('')
  const activeSlideRef = useRef(null)
  const inkDirtyRef = useRef(false)
  const saveInFlightRef = useRef(false)

  onLoadCompleteRef.current = onLoadComplete
  onHistoryChangeRef.current = onHistoryChange
  onDrawingPersistRef.current = onDrawingPersist

  const notifyHistory = useCallback(() => {
    onHistoryChangeRef.current?.({
      canUndo: undoStackRef.current.length > 0,
      canRedo: redoStackRef.current.length > 0,
    })
  }, [])

  const resetHistory = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    gestureSnapshotRef.current = null
    notifyHistory()
  }, [notifyHistory])

  const pushUndoSnapshot = useCallback(
    (snapshot) => {
      if (!snapshot) return
      const stack = undoStackRef.current
      stack.push(snapshot)
      if (stack.length > DRAWING_HISTORY_MAX) stack.shift()
      redoStackRef.current = []
      notifyHistory()
    },
    [notifyHistory]
  )

  const beginGesture = useCallback(() => {
    const canvas = canvasRef.current
    gestureSnapshotRef.current = canvas ? cloneCanvas(canvas) : null
  }, [])

  const endGesture = useCallback(() => {
    const snap = gestureSnapshotRef.current
    gestureSnapshotRef.current = null
    if (snap) pushUndoSnapshot(snap)
  }, [pushUndoSnapshot])

  const flushSaveNow = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    if (!slideId) return
    const canvas = canvasRef.current
    if (!canvas) return
    saveInFlightRef.current = true
    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) return
      const proj = normalizeDrawingProjectName(projectName)
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
        if (inkDirtyRef.current) return
        await clearDrawingBlob(proj, slideId)
        onDrawingPersistRef.current?.(slideId, null)
        return
      }
      const result = await saveDrawingPng(proj, slideId, blob)
      onDrawingPersistRef.current?.(slideId, result.path || 'cached')
    } finally {
      saveInFlightRef.current = false
    }
  }, [slideId, projectName])

  flushSaveRef.current = flushSaveNow

  useEffect(() => {
    smoothingRef.current = lineSmoothing
  }, [lineSmoothing])

  useEffect(() => {
    wobbleRef.current = lineWobble
  }, [lineWobble])

  const scheduleSave = useCallback(() => {
    if (!slideId) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      flushSaveRef.current?.()
    }, 400)
  }, [slideId])

  const applyUndo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || undoStackRef.current.length === 0) return
    redoStackRef.current.push(cloneCanvas(canvas))
    const prev = undoStackRef.current.pop()
    restoreCanvas(canvas, prev)
    notifyHistory()
    scheduleSave()
  }, [notifyHistory, scheduleSave])

  const applyRedo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || redoStackRef.current.length === 0) return
    undoStackRef.current.push(cloneCanvas(canvas))
    const next = redoStackRef.current.pop()
    restoreCanvas(canvas, next)
    notifyHistory()
    scheduleSave()
  }, [notifyHistory, scheduleSave])

  undoFnRef.current = applyUndo
  redoFnRef.current = applyRedo

  useImperativeHandle(
    ref,
    () => ({
      clear() {
        const canvas = canvasRef.current
        if (!canvas) return
        if (canvasHasInk(canvas)) {
          pushUndoSnapshot(cloneCanvas(canvas))
        }
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        scheduleSave()
      },
      undo() {
        applyUndo()
      },
      redo() {
        applyRedo()
      },
      flushSave() {
        return flushSaveRef.current?.()
      },
    }),
    [applyUndo, applyRedo, pushUndoSnapshot, scheduleSave]
  )

  useEffect(() => {
    if (!drawingEnabled) return
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        undoFnRef.current?.()
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault()
        redoFnRef.current?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawingEnabled])

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      flushSaveRef.current?.()
    }
  }, [])

  useEffect(() => {
    const onPageHide = () => {
      flushSaveRef.current?.()
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flushSaveRef.current?.()
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return

    if (canvas.width !== width || canvas.height !== height) {
      const prev = canvas.width > 0 && canvas.height > 0 ? cloneCanvas(canvas) : null
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (prev) {
        ctx.drawImage(prev, 0, 0, width, height)
      }
    }
  }, [width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !width || !height) return

    const loadKey = `${slideId ?? ''}|${projectName}`
    const slideChanged = activeSlideRef.current !== slideId
    activeSlideRef.current = slideId

    if (!slideChanged && (inkDirtyRef.current || canvasHasInk(canvas) || lastLoadKeyRef.current === loadKey)) {
      onLoadCompleteRef.current?.()
      return
    }

    if (slideChanged) {
      inkDirtyRef.current = false
    }

    lastLoadKeyRef.current = loadKey

    const ctx = canvas.getContext('2d')
    const gen = ++loadGenRef.current
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    undoStackRef.current = []
    redoStackRef.current = []
    gestureSnapshotRef.current = null
    notifyHistory()

    const finishLoad = () => {
      if (gen === loadGenRef.current) onLoadCompleteRef.current?.()
    }

    if (!slideId) {
      finishLoad()
      return
    }
    const proj = normalizeDrawingProjectName(projectName)
    loadDrawingBlob(proj, slideId)
      .then((blob) => {
        if (gen !== loadGenRef.current) return
        if (!blob) {
          finishLoad()
          return
        }
        const img = new Image()
        img.onload = () => {
          if (gen !== loadGenRef.current) return
          if (inkDirtyRef.current || canvasHasInk(canvas)) {
            finishLoad()
            return
          }
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          URL.revokeObjectURL(img.src)
          finishLoad()
        }
        img.onerror = () => finishLoad()
        img.src = URL.createObjectURL(blob)
      })
      .catch(() => finishLoad())
  }, [slideId, projectName, width, height, notifyHistory])

  const getPoint = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const pressure = pointerPressure(e)
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure,
    }
  }

  const applyStrokeStyle = (ctx, lineWidth, activeTool, strokeColor) => {
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = lineWidth
    if (activeTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
      ctx.fillStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = strokeColor
      ctx.fillStyle = strokeColor
    }
  }

  const drawDot = (ctx, point, lineWidth, activeTool, strokeColor) => {
    if (!point) return
    applyStrokeStyle(ctx, lineWidth, activeTool, strokeColor)
    ctx.beginPath()
    ctx.arc(point.x, point.y, lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }

  const drawStrokeSegment = (from, to, lineWidth, activeTool, strokeColor, quadAnchor, onQuadAnchor) => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx || !to) return
    applyStrokeStyle(ctx, lineWidth, activeTool, strokeColor)
    if (!from) {
      drawDot(ctx, to, lineWidth, activeTool, strokeColor)
      return
    }
    const mid = { x: (from.x + to.x) * 0.5, y: (from.y + to.y) * 0.5 }
    ctx.beginPath()
    if (!quadAnchor) {
      ctx.moveTo(from.x, from.y)
      ctx.lineTo(mid.x, mid.y)
    } else {
      ctx.moveTo(quadAnchor.x, quadAnchor.y)
      ctx.quadraticCurveTo(from.x, from.y, mid.x, mid.y)
    }
    ctx.stroke()
    onQuadAnchor?.(mid)
    ctx.globalCompositeOperation = 'source-over'
  }

  const strokeTo = (from, to, lineWidth, strokeState) => {
    drawStrokeSegment(from, to, lineWidth ?? brushSize, tool, color, strokeState.quadAnchor, (mid) => {
      strokeState.quadAnchor = mid
    })
  }

  const penStrokeEffects = () => tool === 'pen' && (wobbleRef.current > 0 || smoothingRef.current > 0)

  const markInkDirty = () => {
    inkDirtyRef.current = true
  }

  const onPointerDown = (e) => {
    if (!drawingEnabled) return
    e.stopPropagation()
    e.preventDefault()
    const p = getPoint(e)
    if (!p) return
    drawingRef.current = true
    const strokeState = strokeStateRef.current
    resetStrokeState(strokeState, p)
    lastBlendPointRef.current = null
    e.currentTarget.setPointerCapture(e.pointerId)

    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return

    beginGesture()
    markInkDirty()

    if (tool === 'fill') {
      floodFill(ctx, p.x, p.y, color)
      endGesture()
      scheduleSave()
      requestAnimationFrame(() => {
        flushSaveRef.current?.()
      })
      drawingRef.current = false
      return
    }
    if (tool === 'blend') {
      const r = brushSizeForPressure(brushSize * 2, p.pressure, 'pen')
      lastBlendPointRef.current = p
      applySoftRoundBlurStamp(ctx, p.x, p.y, r)
    }
    if (tool === 'pen' || tool === 'eraser') {
      const w = brushSizeForPressure(brushSize, p.pressure, tool)
      const processed = penStrokeEffects()
        ? prepareStrokePoint(p, strokeState, smoothingRef.current, wobbleRef.current, w)
        : p
      lastPointRef.current = processed
      strokeState.lastDrawn = processed
      drawDot(ctx, processed, w, tool, color)
    }
  }

  const onPointerMove = (e) => {
    if (!drawingEnabled || !drawingRef.current) return
    e.stopPropagation()
    const raw = getPoint(e)
    if (!raw) return
    const strokeState = strokeStateRef.current
    const last = lastPointRef.current
    if (tool === 'pen' || tool === 'eraser') {
      const wFrom = brushSizeForPressure(brushSize, last?.pressure ?? raw.pressure, tool)
      const wTo = brushSizeForPressure(brushSize, raw.pressure, tool)
      const lineW = (wFrom + wTo) / 2
      const processed = penStrokeEffects()
          ? prepareStrokePoint(raw, strokeState, smoothingRef.current, wobbleRef.current, lineW)
          : raw
      strokeTo(strokeState.lastDrawn, processed, lineW, strokeState)
      strokeState.lastDrawn = processed
      lastPointRef.current = processed
    } else if (tool === 'blend') {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) {
        const r = brushSizeForPressure(brushSize * 2, raw.pressure, 'pen')
        stampBlendAlong(ctx, lastBlendPointRef.current, raw, r)
        lastBlendPointRef.current = raw
      }
    }
  }

  const onPointerUp = (e) => {
    if (!drawingRef.current) return
    e.stopPropagation()
    const strokeState = strokeStateRef.current
    if (tool === 'pen' || tool === 'eraser') {
      const last = strokeState.lastDrawn
      const anchor = strokeState.quadAnchor
      if (last && anchor) {
        const ctx = canvasRef.current?.getContext('2d')
        if (ctx) {
          const w = brushSizeForPressure(brushSize, last.pressure ?? 1, tool)
          applyStrokeStyle(ctx, w, tool, color)
          ctx.beginPath()
          ctx.moveTo(anchor.x, anchor.y)
          ctx.lineTo(last.x, last.y)
          ctx.stroke()
          ctx.globalCompositeOperation = 'source-over'
        }
      }
    }
    drawingRef.current = false
    lastPointRef.current = null
    lastBlendPointRef.current = null
    strokeState.lastDrawn = null
    strokeState.quadAnchor = null
    endGesture()
    markInkDirty()
    scheduleSave()
    requestAnimationFrame(() => {
      flushSaveRef.current?.()
    })
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

export function DrawingSettingsPanel({
  penColors,
  tool,
  onToolChange,
  color,
  onColorChange,
  brushSize,
  onBrushSizeChange,
  lineSmoothing = DEFAULT_DRAWING_SMOOTHING,
  onLineSmoothingChange,
  lineWobble = DEFAULT_DRAWING_WOBBLE,
  onLineWobbleChange,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClear,
  onDone,
  layout = 'sidebar',
}) {
  const colors = normalizeDrawingPenColors(penColors)
  const rootClass = [
    'drawing-settings-panel',
    layout === 'sidebar' && 'drawing-settings-panel--sidebar',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {onDone && (
        <button type="button" className="drawing-settings-panel__done" onClick={onDone}>
          Done drawing
        </button>
      )}
      <div className="drawing-settings-panel__tools">
        {DRAWING_TOOLS.map((t) => (
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
      </div>
      <label className="drawing-settings-panel__field">
        <span>Brush size</span>
        <input
          type="range"
          min={DRAWING_BRUSH_MIN}
          max={DRAWING_BRUSH_MAX}
          value={brushSize}
          onChange={(e) => onBrushSizeChange(Number(e.target.value))}
          className="drawing-layer__brush"
        />
      </label>
      {tool === 'pen' && onLineSmoothingChange && (
        <label className="drawing-settings-panel__field" title="Smooth pen strokes (0 = raw, 1 = very smooth)">
          <span>Smooth</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={lineSmoothing}
            onChange={(e) => onLineSmoothingChange(parseFloat(e.target.value))}
            className="drawing-layer__brush"
          />
        </label>
      )}
      {tool === 'pen' && onLineWobbleChange && (
        <label className="drawing-settings-panel__field" title="Hand-drawn scribble wobble">
          <span>Wobble</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={lineWobble}
            onChange={(e) => onLineWobbleChange(parseFloat(e.target.value))}
            className="drawing-layer__brush"
          />
        </label>
      )}
      {onUndo && (
        <div className="drawing-settings-panel__row">
          <button type="button" className="drawing-layer__tool" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
            Undo
          </button>
          <button type="button" className="drawing-layer__tool" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
            Redo
          </button>
        </div>
      )}
      <div className="drawing-settings-panel__colors">
        <span className="drawing-settings-panel__colors-label">Color</span>
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
      </div>
      <button type="button" className="drawing-layer__clear drawing-settings-panel__clear" onClick={onClear}>
        Clear slide drawing
      </button>
    </div>
  )
}

export function DrawingToolbar({
  drawingEnabled,
  onToggleDrawing,
}) {
  return (
    <button
      type="button"
      className={`drawing-layer__tool-toggle ${drawingEnabled ? 'active' : ''}`}
      onClick={onToggleDrawing}
      title={drawingEnabled ? 'Exit drawing mode' : 'Draw on slide'}
    >
      {drawingEnabled ? 'Done' : 'Draw'}
    </button>
  )
}
