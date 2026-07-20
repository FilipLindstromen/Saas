import { GRAPHIC_COORDINATE_WIDTH, getExportCanvasSize } from './slideFormats'

const ROOT_PX = 16

/**
 * Scale factor from typography rem settings to pixels for the current slide width.
 * Edit preview uses GRAPHIC_COORDINATE_WIDTH (1200); present/export uses the same
 * design density on the wider export canvas so text matches the edit preview.
 */
export function getTypographyCoordScale(slideWidth, { isPlayMode = false, slideFormat = '16:9' } = {}) {
  if (!slideWidth || slideWidth <= 0) return 1
  if (isPlayMode) {
    const exportW = getExportCanvasSize(slideFormat).w
    return slideWidth / exportW
  }
  return slideWidth / GRAPHIC_COORDINATE_WIDTH
}

export function remToSlidePx(rem, coordScale) {
  return rem * ROOT_PX * coordScale
}

export function computeSlideTypographyPx(slideWidth, options, sizes) {
  const coordScale = getTypographyCoordScale(slideWidth, options)
  return {
    coordScale,
    baseFontSize: remToSlidePx(sizes.defaultTextSize, coordScale),
    bulletFontSize: remToSlidePx(sizes.bulletTextSize, coordScale),
    h1FontSize: remToSlidePx(sizes.h1Size, coordScale),
    h2FontSize: remToSlidePx(sizes.h2Size, coordScale),
    h3FontSize: remToSlidePx(sizes.h3Size, coordScale),
    h1SubtitleFontSize: remToSlidePx(sizes.h1Size * 0.5, coordScale),
    h2SubtitleFontSize: remToSlidePx(sizes.h2Size * 0.5, coordScale),
    h3SubtitleFontSize: remToSlidePx(sizes.h3Size * 0.5, coordScale),
    h1BulletFontSize: remToSlidePx(sizes.h1Size * 0.6, coordScale),
    h2BulletFontSize: remToSlidePx(sizes.h2Size * 0.6, coordScale),
    h3BulletFontSize: remToSlidePx(sizes.h3Size * 0.6, coordScale),
    dynamicFontSize: remToSlidePx(Math.max(sizes.defaultTextSize, 4) * 0.8, coordScale),
  }
}
