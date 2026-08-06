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
  link.click()
}

export async function exportGeneratedImage(dataUrl, action) {
  if (!dataUrl) return

  switch (action) {
    case EXPORT_ACTION.PNG:
      downloadDataUrl(dataUrl, 'sketchgen-result.png')
      break
    case EXPORT_ACTION.PNG_TRANSPARENT: {
      const transparent = await dataUrlWithTransparentBackground(dataUrl)
      downloadDataUrl(transparent, 'sketchgen-result-transparent.png')
      break
    }
    case EXPORT_ACTION.COPY:
      await copyImageToClipboard(dataUrl)
      break
    case EXPORT_ACTION.COPY_TRANSPARENT: {
      const transparent = await dataUrlWithTransparentBackground(dataUrl)
      await copyImageToClipboard(transparent)
      break
    }
    default:
      break
  }
}
