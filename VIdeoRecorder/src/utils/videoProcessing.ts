import { applyCuts, combineVideos, trimVideo, concatVideos } from './ffmpeg'

export { concatVideos } from './ffmpeg'

export interface VideoCut {
  id: string
  start: number // in seconds
  end: number // in seconds
}

export interface Layout {
  type: 'side-by-side' | 'picture-in-picture' | 'screen-only' | 'camera-only' | 'custom'
  name?: string
  cameraPosition?: { x: number; y: number; width: number; height: number }
  screenPosition?: { x: number; y: number; width: number; height: number }
}

/**
 * Apply cuts to a video blob by creating a new video with segments removed
 */
export async function applyCutsToVideo(
  videoBlob: Blob,
  cuts: VideoCut[]
): Promise<Blob> {
  if (!videoBlob || videoBlob.size === 0) {
    return videoBlob
  }

  if (cuts.length === 0) {
    return videoBlob
  }

  // Convert VideoCut[] to { start, end }[] format
  const cutSegments = cuts.map(cut => ({ start: cut.start, end: cut.end }))
  
  try {
    return await applyCuts(videoBlob, cutSegments)
  } catch (error) {
    console.error('Error applying cuts to video:', error)
    throw error
  }
}

/**
 * Combine multiple video/audio blobs into a single video with layout
 */
export async function combineLayersWithLayout(
  cameraBlob: Blob | null,
  microphoneBlob: Blob | null,
  screenBlob: Blob | null,
  layout: Layout,
  cuts: VideoCut[]
): Promise<Blob> {
  try {
    // Apply cuts to each input if cuts exist
    let processedCameraBlob = cameraBlob
    let processedMicrophoneBlob = microphoneBlob
    let processedScreenBlob = screenBlob

    if (cuts.length > 0) {
      if (cameraBlob) {
        processedCameraBlob = await applyCutsToVideo(cameraBlob, cuts)
      }
      if (screenBlob) {
        processedScreenBlob = await applyCutsToVideo(screenBlob, cuts)
      }
      // Note: Audio cuts are applied during combine, not separately
    }

    // Combine videos with layout
    const outputBlob = await combineVideos(
      processedCameraBlob,
      processedMicrophoneBlob,
      processedScreenBlob,
      layout
    )

    return outputBlob
  } catch (error) {
    console.error('Error combining layers with layout:', error)
    throw error
  }
}

