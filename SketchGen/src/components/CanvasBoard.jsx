import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { DEFAULT_SKETCH_FORMAT_ID, getSketchFormat } from '../utils/canvasFormat'
import { ensureGoogleFontLoaded } from '../constants/brand'
import './CanvasBoard.css'

/** @deprecated use getSketchFormat — kept for any external imports */
export const CANVAS_WIDTH = getSketchFormat('16:9').width
export const CANVAS_HEIGHT = getSketchFormat('16:9').height
export const BACKGROUND_COLOR = '#ffffff'
const MAX_HISTORY = 40
const FILL_TOLERANCE = 40
const SHAPE_TOOLS = new Set(['line', 'rect', 'circle'])
const FREEHAND_INK_TOOLS = new Set(['pen', 'eraser'])

function lerp(a, b, t) {
  return a + (b - a) * t
}

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

function createLayerCanvas(w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  return { canvas, ctx }
}

function resizeLayerCanvas(sourceCanvas, oldW, oldH, newW, newH, background = BACKGROUND_COLOR) {
  const { canvas, ctx } = createLayerCanvas(newW, newH)
  ctx.fillStyle = background
  ctx.fillRect(0, 0, newW, newH)
  const scale = Math.min(newW / oldW, newH / oldH)
  const dw = oldW * scale
  const dh = oldH * scale
  ctx.drawImage(sourceCanvas, (newW - dw) / 2, (newH - dh) / 2, dw, dh)
  return { canvas, ctx }
}

const CanvasBoard = forwardRef(function CanvasBoard(
  {
    tool,
    color,
    size,
    smoothing = 0,
    wobble = 0,
    zoom = 1,
    formatId = DEFAULT_SKETCH_FORMAT_ID,
    textFontFamily = 'Inter',
    textFontSize = 36,
    textFontBold = false,
    placing,
    onPlaced,
    onHistoryChange,
    onLayersChange,
    onCommit,
    onDropFile,
  },
  ref
) {
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
  const smoothingRef = useRef(smoothing)
  const wobbleRef = useRef(wobble)
  const textFontFamilyRef = useRef(textFontFamily)
  const textFontSizeRef = useRef(textFontSize)
  const textFontBoldRef = useRef(textFontBold)
  const placingRef = useRef(placing)
  const formatRef = useRef(formatId)
  const canvasSizeRef = useRef({
    w: getSketchFormat(formatId).width,
    h: getSketchFormat(formatId).height,
  })
  const W = () => canvasSizeRef.current.w
  const H = () => canvasSizeRef.current.h
  const shapeSnapshotRef = useRef(null)
  const shapeStartRef = useRef(null)
  const smoothPointRef = useRef(null)
  const wobblePhaseRef = useRef(0)
  const wobbleDirRef = useRef({ x: 1, y: 0 })
  const lastRawPointRef = useRef(null)
  const lastStrokeWidthRef = useRef(null)

  // Layer stack: bottom-to-top array of { id, name, visible, canvas, ctx }.
  // `canvasRef`/`ctxRef` above are the single VISIBLE canvas — tools never draw
  // on it directly, they draw on the active layer's offscreen canvas, then
  // renderComposite() flattens all visible layers onto the visible canvas.
  const layersRef = useRef([])
  const activeLayerIdRef = useRef(null)
  const layerIdCounterRef = useRef(0)
  const moveSnapshotRef = useRef(null)
  const moveStartRef = useRef(null)
  const [brushPreview, setBrushPreview] = useState(null)
  const [textEditor, setTextEditor] = useState(null)
  const textEditorRef = useRef(null)
  const textInputRef = useRef(null)

  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { sizeRef.current = size }, [size])
  useEffect(() => { smoothingRef.current = smoothing }, [smoothing])
  useEffect(() => { wobbleRef.current = wobble }, [wobble])
  useEffect(() => { textFontFamilyRef.current = textFontFamily }, [textFontFamily])
  useEffect(() => { textFontSizeRef.current = textFontSize }, [textFontSize])
  useEffect(() => { textFontBoldRef.current = textFontBold }, [textFontBold])
  useEffect(() => {
    ensureGoogleFontLoaded(textFontFamily)
  }, [textFontFamily])
  useEffect(() => { placingRef.current = placing }, [placing])
  useEffect(() => {
    textEditorRef.current = textEditor
  }, [textEditor])
  useEffect(() => {
    if (tool !== 'text' && textEditorRef.current) setTextEditor(null)
  }, [tool])
  useEffect(() => {
    if (textEditor && textInputRef.current) textInputRef.current.focus()
  }, [textEditor])
  useEffect(() => {
    if (!FREEHAND_INK_TOOLS.has(tool)) setBrushPreview(null)
  }, [tool])

  useEffect(() => {
    setBrushPreview((prev) => {
      if (!prev) return null
      const canvas = canvasRef.current
      if (!canvas) return prev
      const rect = canvas.getBoundingClientRect()
      const scale = rect.width / canvas.width
      return { ...prev, diameter: size * scale }
    })
  }, [size])

  const getActiveLayer = () => layersRef.current.find((l) => l.id === activeLayerIdRef.current) || layersRef.current[layersRef.current.length - 1]
  const getActiveCtx = () => getActiveLayer()?.ctx

  const notifyHistory = () => {
    onHistoryChange?.({
      canUndo: historyIndexRef.current > 0,
      canRedo: historyIndexRef.current < historyRef.current.length - 1,
    })
  }

  const notifyLayers = () => {
    onLayersChange?.({
      layers: layersRef.current.map((l) => ({ id: l.id, name: l.name, visible: l.visible })),
      activeLayerId: activeLayerIdRef.current,
    })
  }

  const renderComposite = () => {
    const ctx = ctxRef.current
    if (!ctx) return
    ctx.fillStyle = BACKGROUND_COLOR
    ctx.fillRect(0, 0, W(), H())
    for (const layer of layersRef.current) {
      if (layer.visible) ctx.drawImage(layer.canvas, 0, 0)
    }
  }

  const pushHistory = () => {
    if (!layersRef.current.length) return
    const snapshot = {
      layers: layersRef.current.map((l) => ({
        id: l.id,
        name: l.name,
        visible: l.visible,
        imageData: l.ctx.getImageData(0, 0, W(), H()),
      })),
      activeLayerId: activeLayerIdRef.current,
    }
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1)
    historyRef.current.push(snapshot)
    if (historyRef.current.length > MAX_HISTORY) historyRef.current.shift()
    historyIndexRef.current = historyRef.current.length - 1
    notifyHistory()
    onCommit?.()
  }

  const restoreHistoryEntry = (entry) => {
    layersRef.current = entry.layers.map((saved) => {
      const { canvas, ctx } = createLayerCanvas(W(), H())
      ctx.putImageData(saved.imageData, 0, 0)
      return { id: saved.id, name: saved.name, visible: saved.visible, canvas, ctx }
    })
    activeLayerIdRef.current = entry.activeLayerId
    renderComposite()
    notifyLayers()
  }

  useEffect(() => {
    const canvas = canvasRef.current
    canvas.width = W()
    canvas.height = H()
    ctxRef.current = canvas.getContext('2d', { willReadFrequently: true })

    // Guard against React StrictMode's dev-only double-invoke of mount effects:
    // without this, a second invocation would silently replace "Layer 1" with
    // a fresh "Layer 2" (layerIdCounterRef survives the simulated remount).
    if (layersRef.current.length === 0) {
      const { canvas: layerCanvas, ctx: layerCtx } = createLayerCanvas(W(), H())
      layerIdCounterRef.current += 1
      const layer = { id: `layer-${layerIdCounterRef.current}`, name: `Layer ${layerIdCounterRef.current}`, visible: true, canvas: layerCanvas, ctx: layerCtx }
      layersRef.current = [layer]
      activeLayerIdRef.current = layer.id
      pushHistory()
    }

    renderComposite()
    notifyLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Must run before the zoom-sizing effect below: it sets canvas.width/height
  // for the new format, which that effect then measures via getBoundingClientRect().
  // React runs effects in declaration order within a commit, so this ordering
  // is what makes "change format while zoomed" measure the new shape instead
  // of a stale one from the previous format.
  useEffect(() => {
    formatRef.current = formatId
    const next = getSketchFormat(formatId)
    const oldW = canvasSizeRef.current.w
    const oldH = canvasSizeRef.current.h
    if (next.width === oldW && next.height === oldH) return

    layersRef.current = layersRef.current.map((layer) => {
      const resized = resizeLayerCanvas(layer.canvas, oldW, oldH, next.width, next.height)
      return { ...layer, canvas: resized.canvas, ctx: resized.ctx }
    })
    canvasSizeRef.current = { w: next.width, h: next.height }
    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = next.width
      canvas.height = next.height
    }
    renderComposite()
    pushHistory()
    onCommit?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatId])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = canvas?.parentElement
    if (!canvas || !container) return
    if (zoom === 1) {
      canvas.style.width = ''
      canvas.style.height = ''
      canvas.style.maxHeight = ''
      return
    }
    // Measure the natural (unzoomed) rendered size first — still respecting the
    // CSS max-height cap at this point, so this reflects the actual 100% shape
    // rather than assuming it equals container.clientWidth (no longer true now
    // that non-square formats are also height-constrained).
    canvas.style.width = ''
    canvas.style.height = ''
    const rect = canvas.getBoundingClientRect()
    const baseWidth = rect.width
    const baseHeight = rect.height
    // Once zoomed, let the box grow past the normal 85vh cap — the viewport's
    // own overflow:auto is what keeps oversized zoomed content navigable.
    // Without lifting the cap here, max-height would clamp height but not
    // width, silently distorting the aspect ratio the same way the original
    // bug did.
    canvas.style.maxHeight = 'none'
    canvas.style.width = `${baseWidth * zoom}px`
    canvas.style.height = `${baseHeight * zoom}px`
    // Re-run on formatId too: switching the aspect ratio while already zoomed
    // must recompute against the new natural shape, not leave the previous
    // format's stale pixel size stuck on the element.
  }, [zoom, formatId])

  const drawImageFittedOnLayer = (ctx, img) => {
    ctx.clearRect(0, 0, W(), H())
    const scale = Math.min(W() / img.width, H() / img.height)
    const w = img.width * scale
    const h = img.height * scale
    const x = (W() - w) / 2
    const y = (H() - h) / 2
    ctx.drawImage(img, x, y, w, h)
  }

  useImperativeHandle(ref, () => ({
    exportPNG: () => canvasRef.current.toDataURL('image/png'),
    hasContent: () => hasContentRef.current,
    clear: () => {
      const ctx = getActiveCtx()
      if (!ctx) return
      ctx.clearRect(0, 0, W(), H())
      renderComposite()
      pushHistory()
    },
    undo: () => {
      if (historyIndexRef.current <= 0) return
      historyIndexRef.current -= 1
      restoreHistoryEntry(historyRef.current[historyIndexRef.current])
      notifyHistory()
      onCommit?.()
    },
    redo: () => {
      if (historyIndexRef.current >= historyRef.current.length - 1) return
      historyIndexRef.current += 1
      restoreHistoryEntry(historyRef.current[historyIndexRef.current])
      notifyHistory()
      onCommit?.()
    },
    /** Fit an external image (import, or a generated result) onto the active layer as a new undoable state. */
    loadImage: async (dataUrl) => {
      const img = await loadHtmlImage(dataUrl)
      drawImageFittedOnLayer(getActiveCtx(), img)
      hasContentRef.current = true
      renderComposite()
      pushHistory()
    },
    /** Rebuild the whole layer stack from an autosave/restore payload. Not an undoable action. */
    restoreLayers: async ({ layers, activeLayerId, formatId: savedFormatId }) => {
      if (!layers?.length) return
      if (savedFormatId) {
        const f = getSketchFormat(savedFormatId)
        canvasSizeRef.current = { w: f.width, h: f.height }
        formatRef.current = savedFormatId
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = f.width
          canvas.height = f.height
        }
      }
      const rebuilt = []
      let maxCounter = 0
      for (const saved of layers) {
        const img = await loadHtmlImage(saved.dataUrl)
        const { canvas, ctx } = createLayerCanvas(W(), H())
        ctx.fillStyle = BACKGROUND_COLOR
        ctx.fillRect(0, 0, W(), H())
        const scale = Math.min(W() / img.width, H() / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        ctx.drawImage(img, (W() - dw) / 2, (H() - dh) / 2, dw, dh)
        rebuilt.push({ id: saved.id, name: saved.name, visible: saved.visible, canvas, ctx })
        const num = parseInt(String(saved.id).replace('layer-', ''), 10)
        if (!Number.isNaN(num)) maxCounter = Math.max(maxCounter, num)
      }
      layersRef.current = rebuilt
      layerIdCounterRef.current = maxCounter
      activeLayerIdRef.current = layers.some((l) => l.id === activeLayerId) ? activeLayerId : rebuilt[rebuilt.length - 1].id
      hasContentRef.current = true
      renderComposite()
      notifyLayers()
      historyRef.current = [{
        layers: layersRef.current.map((l) => ({ id: l.id, name: l.name, visible: l.visible, imageData: l.ctx.getImageData(0, 0, W(), H()) })),
        activeLayerId: activeLayerIdRef.current,
      }]
      historyIndexRef.current = 0
      notifyHistory()
    },
    /** Reset to a single fresh blank layer — used when switching to a brand-new drawing (no saved snapshot yet). */
    resetBlank: (forcedFormatId) => {
      if (forcedFormatId) {
        const f = getSketchFormat(forcedFormatId)
        canvasSizeRef.current = { w: f.width, h: f.height }
        formatRef.current = forcedFormatId
        const canvas = canvasRef.current
        if (canvas) {
          canvas.width = f.width
          canvas.height = f.height
        }
      }
      const { canvas, ctx } = createLayerCanvas(W(), H())
      layerIdCounterRef.current += 1
      const layer = { id: `layer-${layerIdCounterRef.current}`, name: `Layer ${layerIdCounterRef.current}`, visible: true, canvas, ctx }
      layersRef.current = [layer]
      activeLayerIdRef.current = layer.id
      hasContentRef.current = false
      renderComposite()
      notifyLayers()
      historyRef.current = [{
        layers: [{ id: layer.id, name: layer.name, visible: layer.visible, imageData: ctx.getImageData(0, 0, W(), H()) }],
        activeLayerId: layer.id,
      }]
      historyIndexRef.current = 0
      notifyHistory()
    },
    /** Export every layer as a transparent PNG for autosave. */
    exportLayers: () => ({
      formatId: formatRef.current,
      layers: layersRef.current.map((l) => ({ id: l.id, name: l.name, visible: l.visible, dataUrl: l.canvas.toDataURL('image/png') })),
      activeLayerId: activeLayerIdRef.current,
    }),
    getFormatId: () => formatRef.current,
    addLayer: () => {
      layerIdCounterRef.current += 1
      const { canvas, ctx } = createLayerCanvas(W(), H())
      const layer = { id: `layer-${layerIdCounterRef.current}`, name: `Layer ${layerIdCounterRef.current}`, visible: true, canvas, ctx }
      layersRef.current = [...layersRef.current, layer]
      activeLayerIdRef.current = layer.id
      notifyLayers()
      pushHistory()
    },
    removeLayer: (id) => {
      if (layersRef.current.length <= 1) return
      const wasActive = activeLayerIdRef.current === id
      layersRef.current = layersRef.current.filter((l) => l.id !== id)
      if (wasActive) activeLayerIdRef.current = layersRef.current[layersRef.current.length - 1].id
      renderComposite()
      notifyLayers()
      pushHistory()
    },
    toggleLayerVisibility: (id) => {
      layersRef.current = layersRef.current.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))
      renderComposite()
      notifyLayers()
      pushHistory()
    },
    setActiveLayer: (id) => {
      if (!layersRef.current.some((l) => l.id === id)) return
      activeLayerIdRef.current = id
      notifyLayers()
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

  const stampPlacedImage = (ctx, pos, maxDim) => {
    const active = placingRef.current
    if (!active?.img) return
    const { img } = active
    const scale = maxDim / Math.max(img.width, img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.drawImage(img, pos.x - w / 2, pos.y - h / 2, w, h)
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

  /**
   * Click sets the stamp's center; dragging out from it grows the stamp, with a
   * live preview redrawn from a snapshot each move. A drag under ~4px counts as
   * a plain click and falls back to the picker's default stamp size.
   */
  const placingDimForDrag = (center, pos) => {
    const dist = Math.hypot(pos.x - center.x, pos.y - center.y)
    if (dist < 4) return placingRef.current?.maxDim ?? 100
    return clamp(dist * 2, 20, Math.max(W(), H()))
  }

  /**
   * Trails the raw pointer position through a smoothing lag, then adds a
   * continuous sine-wave wobble perpendicular to the direction of travel on
   * top — a real hand tremor is a smooth side-to-side oscillation as the hand
   * moves forward, not independent per-axis noise. The phase advances with
   * distance actually traveled (not event count), so the wobble's visual
   * frequency stays consistent whether the pointer moves fast or slow — a
   * random walk driven by event count instead reads as jagged, uncorrelated
   * zigzag. Both effects are 0 at slider value 0, so behavior is unchanged
   * unless the user turns them on.
   */
  const applySmoothWobble = (rawPos) => {
    const smoothing = smoothingRef.current
    const wobble = wobbleRef.current

    if (!smoothPointRef.current) smoothPointRef.current = { ...rawPos }
    const prevSmooth = smoothPointRef.current
    const alpha = 1 - smoothing * 0.9
    const nextSmooth = {
      x: lerp(prevSmooth.x, rawPos.x, alpha),
      y: lerp(prevSmooth.y, rawPos.y, alpha),
    }
    smoothPointRef.current = nextSmooth

    if (wobble <= 0) return nextSmooth

    const dx = nextSmooth.x - prevSmooth.x
    const dy = nextSmooth.y - prevSmooth.y
    const dist = Math.hypot(dx, dy)
    let dirX = wobbleDirRef.current.x
    let dirY = wobbleDirRef.current.y
    if (dist > 0.01) {
      dirX = dx / dist
      dirY = dy / dist
      wobbleDirRef.current = { x: dirX, y: dirY }
    }
    const perpX = -dirY
    const perpY = dirX

    wobblePhaseRef.current += dist

    const amp = wobble * 9
    // Two sine components at different frequencies/phases so the tremor
    // reads as organic rather than a perfectly metronomic wave.
    const wave = Math.sin(wobblePhaseRef.current * 0.09) * 0.7
      + Math.sin(wobblePhaseRef.current * 0.23 + 1.7) * 0.3
    const offset = wave * amp

    return {
      x: nextSmooth.x + perpX * offset,
      y: nextSmooth.y + perpY * offset,
    }
  }

  const updateBrushPreview = (e) => {
    const currentTool = toolRef.current
    if (!FREEHAND_INK_TOOLS.has(currentTool)) return
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scale = rect.width / canvas.width
    const diameter = sizeRef.current * scale
    setBrushPreview({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      diameter,
      eraser: currentTool === 'eraser',
    })
  }

  const clearBrushPreview = () => setBrushPreview(null)

  const commitTextEditor = useCallback(async () => {
    const editor = textEditorRef.current
    if (!editor) return
    const text = editor.value.trim()
    if (!text) {
      setTextEditor(null)
      return
    }
    const ctx = getActiveCtx()
    if (!ctx) {
      setTextEditor(null)
      return
    }
    const family = textFontFamilyRef.current
    const fontSize = textFontSizeRef.current
    const weight = textFontBoldRef.current ? 'bold' : 'normal'
    await ensureGoogleFontLoaded(family)
    ctx.font = `${weight} ${fontSize}px "${family}", sans-serif`
    ctx.fillStyle = colorRef.current
    ctx.textBaseline = 'top'
    const lines = editor.value.replace(/\r\n/g, '\n').split('\n')
    const lineHeight = fontSize * 1.25
    lines.forEach((line, i) => {
      ctx.fillText(line, editor.x, editor.y + i * lineHeight)
    })
    hasContentRef.current = true
    renderComposite()
    pushHistory()
    setTextEditor(null)
  }, [])

  const openTextEditorAt = useCallback(async (pos) => {
    if (textEditorRef.current) await commitTextEditor()
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const scale = rect.width / canvas.width
    setTextEditor({
      x: pos.x,
      y: pos.y,
      value: '',
      overlayLeft: pos.x * scale,
      overlayTop: pos.y * scale,
      scale,
    })
  }, [commitTextEditor])

  const handlePointerDown = (e) => {
    const canvas = canvasRef.current
    const pos = getPos(canvas, e)
    const ctx = getActiveCtx()
    if (!ctx) return

    const currentTool = toolRef.current

    if (currentTool === 'text') {
      e.preventDefault()
      void openTextEditorAt(pos)
      return
    }

    canvas.setPointerCapture(e.pointerId)

    if (placingRef.current?.img) {
      shapeSnapshotRef.current = ctx.getImageData(0, 0, W(), H())
      shapeStartRef.current = pos
      drawingRef.current = true
      hasContentRef.current = true
      stampPlacedImage(ctx, pos, placingDimForDrag(pos, pos))
      renderComposite()
      return
    }

    if (currentTool === 'move') {
      moveSnapshotRef.current = ctx.getImageData(0, 0, W(), H())
      moveStartRef.current = pos
      drawingRef.current = true
      return
    }

    if (currentTool === 'fill') {
      floodFill(ctx, pos.x, pos.y, colorRef.current)
      hasContentRef.current = true
      renderComposite()
      pushHistory()
      return
    }

    if (SHAPE_TOOLS.has(currentTool)) {
      shapeSnapshotRef.current = ctx.getImageData(0, 0, W(), H())
      shapeStartRef.current = pos
      drawingRef.current = true
      hasContentRef.current = true
      return
    }

    drawingRef.current = true
    hasContentRef.current = true

    if (currentTool === 'blur') {
      lastPointRef.current = pos
      blurRegion(ctx, pos.x, pos.y, sizeRef.current)
      renderComposite()
    } else {
      smoothPointRef.current = null
      wobblePhaseRef.current = 0
      wobbleDirRef.current = { x: 1, y: 0 }
      lastRawPointRef.current = pos
      const drawnPos = applySmoothWobble(pos)
      lastPointRef.current = drawnPos
      const strokeColor = currentTool === 'eraser' ? BACKGROUND_COLOR : colorRef.current
      const width = pressureWidth(e, sizeRef.current)
      lastStrokeWidthRef.current = width
      strokeTo(ctx, drawnPos, drawnPos, strokeColor, width)
      renderComposite()
    }
  }

  const handlePointerMove = (e) => {
    if (FREEHAND_INK_TOOLS.has(toolRef.current)) updateBrushPreview(e)
    if (!drawingRef.current) return
    const canvas = canvasRef.current
    const pos = getPos(canvas, e)
    const ctx = getActiveCtx()
    if (!ctx) return

    if (placingRef.current?.img) {
      ctx.putImageData(shapeSnapshotRef.current, 0, 0)
      const center = shapeStartRef.current
      stampPlacedImage(ctx, center, placingDimForDrag(center, pos))
      renderComposite()
      return
    }

    const currentTool = toolRef.current

    if (currentTool === 'move') {
      const dx = Math.round(pos.x - moveStartRef.current.x)
      const dy = Math.round(pos.y - moveStartRef.current.y)
      ctx.clearRect(0, 0, W(), H())
      ctx.putImageData(moveSnapshotRef.current, dx, dy)
      renderComposite()
      return
    }

    if (SHAPE_TOOLS.has(currentTool)) {
      ctx.putImageData(shapeSnapshotRef.current, 0, 0)
      const from = shapeStartRef.current
      if (currentTool === 'line') drawLineShape(ctx, from, pos, colorRef.current, sizeRef.current, e.shiftKey)
      else if (currentTool === 'rect') drawRectShape(ctx, from, pos, colorRef.current, sizeRef.current, e.shiftKey)
      else drawCircleShape(ctx, from, pos, colorRef.current, sizeRef.current, e.shiftKey)
      renderComposite()
      return
    }

    if (currentTool === 'blur') {
      blurRegion(ctx, pos.x, pos.y, sizeRef.current)
      lastPointRef.current = pos
      renderComposite()
      return
    }

    lastRawPointRef.current = pos
    const drawnPos = applySmoothWobble(pos)
    const strokeColor = currentTool === 'eraser' ? BACKGROUND_COLOR : colorRef.current
    const width = pressureWidth(e, sizeRef.current)
    lastStrokeWidthRef.current = width
    strokeTo(ctx, lastPointRef.current, drawnPos, strokeColor, width)
    lastPointRef.current = drawnPos
    renderComposite()
  }

  const handlePointerLeave = () => {
    clearBrushPreview()
    handlePointerUp()
  }

  const handlePointerEnter = (e) => {
    if (FREEHAND_INK_TOOLS.has(toolRef.current)) updateBrushPreview(e)
  }

  const handlePointerUp = () => {
    const ctx = getActiveCtx()

    if (drawingRef.current && placingRef.current?.img) {
      // The final size was already drawn on the last move (or, for a plain
      // click with no move, on pointerdown at the default size) — just commit it.
      drawingRef.current = false
      shapeSnapshotRef.current = null
      shapeStartRef.current = null
      hasContentRef.current = true
      pushHistory()
      onPlaced?.()
      return
    }

    if (drawingRef.current && toolRef.current === 'move') {
      drawingRef.current = false
      moveSnapshotRef.current = null
      moveStartRef.current = null
      pushHistory()
      return
    }

    if (drawingRef.current) {
      const tool = toolRef.current
      if (FREEHAND_INK_TOOLS.has(tool) && lastPointRef.current && lastRawPointRef.current && ctx) {
        // Smoothing lags behind the raw pointer — draw one final segment so the
        // stroke actually reaches where the pointer was released instead of
        // stopping short.
        const strokeColor = tool === 'eraser' ? BACKGROUND_COLOR : colorRef.current
        strokeTo(ctx, lastPointRef.current, lastRawPointRef.current, strokeColor, lastStrokeWidthRef.current ?? sizeRef.current)
        renderComposite()
      }
      pushHistory()
    }
    drawingRef.current = false
    lastPointRef.current = null
    lastRawPointRef.current = null
    smoothPointRef.current = null
    wobblePhaseRef.current = 0
    wobbleDirRef.current = { x: 1, y: 0 }
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

  const aspect = getSketchFormat(formatId)

  return (
    <div className="sketch-canvas-viewport" onDragOver={handleDragOver} onDrop={handleDrop}>
      <div className="sketch-canvas-wrap">
        <canvas
          ref={canvasRef}
          className={`sketch-canvas tool-${tool}${placing ? ' tool-placing' : ''}`}
          style={{ aspectRatio: `${aspect.width} / ${aspect.height}` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onPointerEnter={handlePointerEnter}
        />
        {brushPreview && (
          <div
            className={`brush-size-preview${brushPreview.eraser ? ' eraser' : ' pen'}`}
            style={{
              left: brushPreview.x,
              top: brushPreview.y,
              width: brushPreview.diameter,
              height: brushPreview.diameter,
              ...(brushPreview.eraser ? {} : { '--brush-preview-color': color }),
            }}
            aria-hidden
          />
        )}
        {textEditor && (
          <textarea
            ref={textInputRef}
            className="canvas-text-editor"
            value={textEditor.value}
            onChange={(e) => setTextEditor((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
            onBlur={() => { void commitTextEditor() }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void commitTextEditor()
              }
              if (e.key === 'Escape') {
                e.preventDefault()
                setTextEditor(null)
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              left: textEditor.overlayLeft,
              top: textEditor.overlayTop,
              fontSize: `${textFontSize * textEditor.scale}px`,
              fontFamily: `"${textFontFamily}", sans-serif`,
              fontWeight: textFontBold ? 700 : 400,
              color,
              lineHeight: 1.25,
            }}
            placeholder="Type…"
            rows={1}
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
})

export default CanvasBoard
