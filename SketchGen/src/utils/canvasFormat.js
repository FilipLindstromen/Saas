export const SKETCH_FORMATS = [
  { id: '1:1', label: '1:1', width: 1080, height: 1080, apiSize: '1024x1024' },
  { id: '4:3', label: '4:3', width: 1080, height: 810, apiSize: '1536x1024' },
  { id: '16:9', label: '16:9', width: 1920, height: 1080, apiSize: '1536x1024' },
  { id: '9:16', label: '9:16', width: 1080, height: 1920, apiSize: '1024x1536' },
  { id: '1080x1440', label: '1080×1440', width: 1080, height: 1440, apiSize: '1024x1536' },
]

export const DEFAULT_SKETCH_FORMAT_ID = '4:3'

/** Inset fraction used in generation prompts and the sketch safe-zone overlay. */
export const GENERATION_SAFE_ZONE_INSET = 0.06

export function normalizeSketchFormatId(id) {
  return SKETCH_FORMATS.some((f) => f.id === id) ? id : DEFAULT_SKETCH_FORMAT_ID
}

export function getSketchFormat(id) {
  const normalized = normalizeSketchFormatId(id)
  return SKETCH_FORMATS.find((f) => f.id === normalized) ?? SKETCH_FORMATS.find((f) => f.id === DEFAULT_SKETCH_FORMAT_ID)
}

/** Solid-color canvas PNG for instruction-only generation (style edit with no sketch). */
export function createBlankCanvasDataUrl(width, height, fill = '#ffffff') {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, width, height)
  return canvas.toDataURL('image/png')
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

/** Resize API output to sketch dimensions (contain — full artwork visible, no edge crop). */
export async function fitDataUrlToSketchSize(dataUrl, width, height, background = '#ffffff') {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, width, height)
  const scale = Math.min(width / img.width, height / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  const x = (width - dw) / 2
  const y = (height - dh) / 2
  ctx.drawImage(img, x, y, dw, dh)
  return canvas.toDataURL('image/png')
}
