/** Normalize slide object with default layout and numeric props (load/import). */
export function normalizeSlide(slide) {
  return {
    ...slide,
    layout: slide.layout || 'default',
    gradientStrength: slide.gradientStrength !== undefined ? slide.gradientStrength : 0.7,
    flipHorizontal: slide.flipHorizontal !== undefined ? slide.flipHorizontal : false,
    backgroundOpacity: slide.backgroundOpacity !== undefined ? slide.backgroundOpacity : 0.6,
    gradientFlipped: slide.gradientFlipped !== undefined ? slide.gradientFlipped : false,
    subtitle: slide.subtitle || '',
    imageScale: slide.imageScale !== undefined ? slide.imageScale : 1.0,
    imagePositionX: slide.imagePositionX !== undefined ? slide.imagePositionX : 50,
    imagePositionY: slide.imagePositionY !== undefined ? slide.imagePositionY : 50,
    textHeadingLevel: slide.textHeadingLevel || null,
    subtitleHeadingLevel: slide.subtitleHeadingLevel || null,
    backgroundColorOverride: slide.backgroundColorOverride === true,
    backgroundColorOverrideValue: slide.backgroundColorOverrideValue ?? undefined,
    graphicOverlays: Array.isArray(slide.graphicOverlays) ? slide.graphicOverlays : [],
  }
}
