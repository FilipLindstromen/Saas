import { copyImageToClipboard } from './clipboard'
import { dataUrlWithTransparentBackground } from './imageBackground'

export const EXPORT_ACTION = {
  PNG: 'png',
  PNG_TRANSPARENT: 'png-transparent',
  COPY: 'copy',
  COPY_TRANSPARENT: 'copy-transparent',
}

export function downloadDataUrl(dataUrl, filename = 'sketchgen-result.png') {
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

async function resolveExportDataUrl(dataUrl, action, options = {}) {
  const wantsTransparent =
    action === EXPORT_ACTION.PNG_TRANSPARENT || action === EXPORT_ACTION.COPY_TRANSPARENT
  if (!wantsTransparent) return dataUrl
  if (options.includeBackground === false) return dataUrl
  return dataUrlWithTransparentBackground(dataUrl, options.transparentOptions)
}

export async function exportImageDataUrl(dataUrl, action, options = {}) {
  if (!dataUrl) throw new Error('Nothing to export')
  const resolved = await resolveExportDataUrl(dataUrl, action, options)
  const baseName = options.filenameBase || 'sketchgen-export'

  switch (action) {
    case EXPORT_ACTION.PNG:
      downloadDataUrl(resolved, `${baseName}.png`)
      break
    case EXPORT_ACTION.PNG_TRANSPARENT:
      downloadDataUrl(resolved, `${baseName}-transparent.png`)
      break
    case EXPORT_ACTION.COPY:
      await copyImageToClipboard(resolved)
      break
    case EXPORT_ACTION.COPY_TRANSPARENT:
      await copyImageToClipboard(resolved)
      break
    default:
      throw new Error('Unknown export action')
  }
}

/** @deprecated use exportImageDataUrl */
export async function exportGeneratedImage(dataUrl, action, options) {
  return exportImageDataUrl(dataUrl, action, { filenameBase: 'sketchgen-result', ...options })
}

/** Export the live sketch composite (with or without canvas background). */
export async function exportSketchComposite(canvasBoard, action) {
  if (!canvasBoard?.exportCompositePNG) throw new Error('Canvas not ready')
  const withBackground =
    action === EXPORT_ACTION.PNG || action === EXPORT_ACTION.COPY
  const dataUrl = canvasBoard.exportCompositePNG(withBackground)
  return exportImageDataUrl(dataUrl, action, {
    filenameBase: 'sketchgen-sketch',
    includeBackground: withBackground,
  })
}
