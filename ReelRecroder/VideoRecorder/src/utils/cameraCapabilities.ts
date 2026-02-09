import type { ResolutionOption } from '../types'

export interface CameraCapabilities {
  width: { min: number; max: number }
  height: { min: number; max: number }
}

/**
 * Get width/height capability ranges from a video track, if supported by the browser.
 */
export function getVideoTrackCapabilities(stream: MediaStream | null): CameraCapabilities | null {
  if (!stream) return null
  const track = stream.getVideoTracks()[0]
  if (!track || typeof track.getCapabilities !== 'function') return null
  const cap = track.getCapabilities() as Record<string, { min?: number; max?: number }>
  const w = cap.width
  const h = cap.height
  if (!w || w.max == null || !h || h.max == null) return null
  return {
    width: { min: w.min ?? 0, max: w.max },
    height: { min: h.min ?? 0, max: h.max },
  }
}

/**
 * Filter resolution list to only those within the camera's reported capability range.
 * If capabilities is null, returns all resolutions (e.g. for screen share or unsupported browsers).
 */
export function filterResolutionsByCapabilities(
  resolutions: ResolutionOption[],
  capabilities: CameraCapabilities | null
): ResolutionOption[] {
  if (!capabilities) return resolutions
  const { width: wCap, height: hCap } = capabilities
  return resolutions.filter(
    (r) =>
      r.width >= wCap.min &&
      r.width <= wCap.max &&
      r.height >= hCap.min &&
      r.height <= hCap.max
  )
}
