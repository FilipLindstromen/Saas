export const SKETCH_FORMATS = [
  { id: '1:1', label: '1:1', width: 1024, height: 1024, apiSize: '1024x1024' },
  { id: '4:3', label: '4:3', width: 1024, height: 768, apiSize: '1536x1024' },
  { id: '16:9', label: '16:9', width: 1024, height: 576, apiSize: '1536x1024' },
  { id: '9:16', label: '9:16', width: 576, height: 1024, apiSize: '1024x1536' },
]

export const DEFAULT_SKETCH_FORMAT_ID = '16:9'

export function normalizeSketchFormatId(id) {
  return SKETCH_FORMATS.some((f) => f.id === id) ? id : DEFAULT_SKETCH_FORMAT_ID
}

export function getSketchFormat(id) {
  const normalized = normalizeSketchFormatId(id)
  return SKETCH_FORMATS.find((f) => f.id === normalized) ?? SKETCH_FORMATS.find((f) => f.id === DEFAULT_SKETCH_FORMAT_ID)
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

/** Resize generated output to exact sketch pixel dimensions (cover — fills frame, no letterboxing). */
export async function fitDataUrlToSketchSize(dataUrl, width, height) {
  const img = await loadImage(dataUrl)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  const scale = Math.max(width / img.width, height / img.height)
  const sw = width / scale
  const sh = height / scale
  const sx = (img.width - sw) / 2
  const sy = (img.height - sh) / 2
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
  return canvas.toDataURL('image/png')
}
