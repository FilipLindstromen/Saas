export const SKETCH_FORMATS = [
  { id: '1:1', label: '1:1', width: 1024, height: 1024, apiSize: '1024x1024' },
  { id: '16:9', label: '16:9', width: 1024, height: 576, apiSize: '1536x1024' },
  { id: '9:16', label: '9:16', width: 576, height: 1024, apiSize: '1024x1536' },
]

export const DEFAULT_SKETCH_FORMAT_ID = '16:9'

export function normalizeSketchFormatId(id) {
  return SKETCH_FORMATS.some((f) => f.id === id) ? id : DEFAULT_SKETCH_FORMAT_ID
}

export function getSketchFormat(id) {
  return SKETCH_FORMATS.find((f) => f.id === normalizeSketchFormatId(id)) ?? SKETCH_FORMATS[1]
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

/** Resize generated output to match sketch pixel dimensions (API sizes are approx aspect). */
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
