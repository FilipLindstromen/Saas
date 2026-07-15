/** Carousel format — fixed 1080×1440 (Instagram carousel). */
export const CAROUSEL_FORMAT = '3:4'

export const SLIDE_FORMATS = {
  [CAROUSEL_FORMAT]: { label: '1080×1440', w: 1080, h: 1440 },
}

export const INSTAGRAM_CAROUSEL_FORMAT = CAROUSEL_FORMAT

export function getExportCanvasSize(slideFormat = CAROUSEL_FORMAT) {
  const format = SLIDE_FORMATS[slideFormat] || SLIDE_FORMATS[CAROUSEL_FORMAT]
  return { w: format.w, h: format.h }
}

export function isInstagramCarouselFormat(slideFormat) {
  return (slideFormat || CAROUSEL_FORMAT) === CAROUSEL_FORMAT
}

export function getSlideFormatMeta(slideFormat = CAROUSEL_FORMAT) {
  return {
    aspectRatio: '3/4',
    className: 'slide-format-3-4',
    previewAspect: '3 / 4',
    previewWidthRatio: 3 / 4,
  }
}
