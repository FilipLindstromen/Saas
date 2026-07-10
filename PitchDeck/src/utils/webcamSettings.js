/** Camera id for a slide: per-slide override, else global record settings. */
export function getWebcamCameraId(slide, recordSettings) {
  return slide?.selectedCameraId || recordSettings?.selectedCameraId || ''
}

/**
 * Whether webcam should show on this slide in present/record mode.
 * Global recordSettings.webcamEnabled applies to all slides (slides with explicit false still show when global is on).
 * Per-slide webcamEnabled: true can enable webcam when global is off.
 */
export function isWebcamActiveForSlide(slide, recordSettings) {
  const cameraId = getWebcamCameraId(slide, recordSettings)
  if (!cameraId) return false
  if (recordSettings?.webcamEnabled) return true
  return slide?.webcamEnabled === true
}

/** True when any slide (or global settings) needs webcam in the deck. */
export function isAnyWebcamActive(slides, recordSettings) {
  if (recordSettings?.webcamEnabled && recordSettings?.selectedCameraId) return true
  return (slides || []).some((slide) => isWebcamActiveForSlide(slide, recordSettings))
}
