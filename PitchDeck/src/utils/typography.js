import { GRAPHIC_COORDINATE_WIDTH } from './slideFormats'

const ROOT_PX = 16

/**
 * Scale typography rem settings to pixels for the current slide width.
 * Same formula in edit preview and present mode so text occupies the same
 * percentage of the slide canvas in both.
 */
export function getTypographyCoordScale(slideWidth) {
  if (!slideWidth || slideWidth <= 0) return 1
  return slideWidth / GRAPHIC_COORDINATE_WIDTH
}

export function remToSlidePx(rem, coordScale) {
  return rem * ROOT_PX * coordScale
}

export function computeSlideTypographyPx(slideWidth, sizes) {
  const coordScale = getTypographyCoordScale(slideWidth)
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
