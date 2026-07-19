/** Slide format metadata for preview, present, and export. */

/** Edit preview max width; graphic overlay width/height are stored in this coordinate space. */
export const GRAPHIC_COORDINATE_WIDTH = 1200

export const SLIDE_FORMATS = {
  '16:9': { label: '16:9', w: 1920, h: 1080 },
  '1:1': { label: '1:1', w: 1080, h: 1080 },
  '9:16': { label: '9:16', w: 1080, h: 1920 },
  '3:4': { label: '1080×1440', w: 1080, h: 1440 },
}

export const INSTAGRAM_CAROUSEL_FORMAT = '3:4'

export function getExportCanvasSize(slideFormat) {
  const format = SLIDE_FORMATS[slideFormat] || SLIDE_FORMATS['16:9']
  return { w: format.w, h: format.h }
}

export function isInstagramCarouselFormat(slideFormat) {
  return slideFormat === INSTAGRAM_CAROUSEL_FORMAT
}

export function getSlideFormatMeta(slideFormat) {
  if (slideFormat === '1:1') {
    return { aspectRatio: '1/1', className: 'slide-format-1-1', previewAspect: '1 / 1', previewWidthRatio: 1 }
  }
  if (slideFormat === '9:16') {
    return { aspectRatio: '9/16', className: 'slide-format-9-16', previewAspect: '9 / 16', previewWidthRatio: 9 / 16 }
  }
  if (slideFormat === '3:4') {
    return { aspectRatio: '3/4', className: 'slide-format-3-4', previewAspect: '3 / 4', previewWidthRatio: 3 / 4 }
  }
  return { aspectRatio: '16/9', className: 'slide-format-16-9', previewAspect: '16 / 9', previewWidthRatio: 16 / 9 }
}
