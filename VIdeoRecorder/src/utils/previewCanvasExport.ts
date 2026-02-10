/**
 * Preview Canvas Export Utility
 * 
 * This utility exports the preview exactly as it appears by capturing
 * the entire preview container including all video holders, overlays,
 * captions, titles, backgrounds, and effects.
 * 
 * It works by:
 * 1. Creating a composite canvas that matches the preview dimensions
 * 2. Rendering each frame by drawing all visible elements
 * 3. Capturing the canvas using captureStream() API
 */

export interface PreviewExportOptions {
  /** Frame rate for the export (default: 30) */
  fps?: number
  /** Video bitrate in bits per second (default: 5_000_000) */
  bitrate?: number
  /** Output format: 'mp4' or 'webm' (default: 'webm') */
  format?: 'mp4' | 'webm'
  /** Canvas width (default: 1920) */
  width?: number
  /** Canvas height (default: 1080) */
  height?: number
  /** Progress callback: (message, percent) => void */
  onProgress?: (message: string, percent: number) => void
}

export interface PreviewExportResult {
  success: boolean
  blob?: Blob
  error?: string
  duration?: number
}

/**
 * Renders a composite frame to a canvas
 * This function should be called for each frame during export
 */
export type FrameRenderer = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  time: number
) => Promise<void> | void

/**
 * Exports the preview by rendering frames to a canvas and capturing it
 * 
 * @param frameRenderer - Function that renders each frame to the canvas
 * @param duration - Duration in seconds to export
 * @param options - Export options
 * @returns Promise with the recorded video blob
 */
export async function exportPreviewCanvas(
  frameRenderer: FrameRenderer,
  duration: number,
  options: PreviewExportOptions = {}
): Promise<PreviewExportResult> {
  const {
    fps = 30,
    bitrate = 5_000_000,
    format = 'webm',
    width = 1920,
    height = 1080,
    onProgress
  } = options

  try {
    onProgress?.('Initializing export canvas...', 0)

    // Create a hidden canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas')
    }

    // Check if canvas.captureStream is supported
    if (!canvas.captureStream) {
      throw new Error('Canvas captureStream API is not supported. Please use Chrome, Edge, or Firefox.')
    }

    onProgress?.('Setting up canvas stream...', 5)

    // Create video stream from canvas
    const stream = canvas.captureStream(fps)
    const videoTrack = stream.getVideoTracks()[0]
    
    if (!videoTrack) {
      throw new Error('Failed to get video track from canvas stream')
    }

    // Determine MIME type
    const mimeType = format === 'mp4'
      ? 'video/webm;codecs=vp9' // MediaRecorder doesn't support MP4, use WebM
      : 'video/webm;codecs=vp9'

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      const fallbackMimeType = 'video/webm;codecs=vp8'
      if (!MediaRecorder.isTypeSupported(fallbackMimeType)) {
        throw new Error('No supported video codec found.')
      }
      return await recordWithFrameRenderer(
        canvas,
        ctx,
        stream,
        frameRenderer,
        duration,
        fps,
        fallbackMimeType,
        bitrate,
        onProgress
      )
    }

    return await recordWithFrameRenderer(
      canvas,
      ctx,
      stream,
      frameRenderer,
      duration,
      fps,
      mimeType,
      bitrate,
      onProgress
    )

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Records frames by rendering them to canvas and capturing the stream
 */
async function recordWithFrameRenderer(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  stream: MediaStream,
  frameRenderer: FrameRenderer,
  duration: number,
  fps: number,
  mimeType: string,
  bitrate: number,
  onProgress?: (message: string, percent: number) => void
): Promise<PreviewExportResult> {
  return new Promise((resolve) => {
    const chunks: Blob[] = []
    const startTime = Date.now()
    const totalFrames = Math.ceil(duration * fps)
    const frameInterval = 1000 / fps // milliseconds
    let currentFrame = 0
    let isRecording = true

    // Create MediaRecorder
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
      })
    } catch (error) {
      resolve({
        success: false,
        error: `Failed to create MediaRecorder: ${error instanceof Error ? error.message : String(error)}`
      })
      return
    }

    // Handle data available
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    // Handle recording stop
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const actualDuration = (Date.now() - startTime) / 1000
      
      // Clean up
      stream.getTracks().forEach(track => track.stop())
      
      resolve({
        success: true,
        blob,
        duration: actualDuration
      })
    }

    // Handle errors
    recorder.onerror = (event) => {
      isRecording = false
      resolve({
        success: false,
        error: `Recording error: ${(event as any).error?.message || 'Unknown error'}`
      })
    }

    // Start recording
    onProgress?.('Starting recording...', 10)
    recorder.start(1000) // Collect data every second

    // Render frames
    const renderFrame = async () => {
      if (!isRecording || currentFrame >= totalFrames) {
        if (recorder.state === 'recording') {
          recorder.stop()
        }
        return
      }

      const time = (currentFrame / fps)
      const percent = 10 + (currentFrame / totalFrames) * 85

      try {
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Render the frame
        await frameRenderer(canvas, ctx, time)

        // Update progress
        onProgress?.(`Rendering frame ${currentFrame + 1} / ${totalFrames} (${time.toFixed(2)}s)`, percent)

        currentFrame++

        // Schedule next frame
        if (currentFrame < totalFrames && isRecording) {
          setTimeout(renderFrame, frameInterval)
        } else if (recorder.state === 'recording') {
          // Wait a bit for the last frame to be captured, then stop
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, frameInterval * 2)
        }
      } catch (error) {
        isRecording = false
        if (recorder.state === 'recording') {
          recorder.stop()
        }
        resolve({
          success: false,
          error: `Frame rendering error: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }

    // Start rendering frames
    renderFrame()

    // Safety timeout
    setTimeout(() => {
      if (recorder.state === 'recording') {
        isRecording = false
        recorder.stop()
      }
    }, (duration + 5) * 1000) // Add 5 second buffer
  })
}

/**
 * Helper to check if preview export is supported
 */
export function isPreviewExportSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream !== 'undefined' &&
         typeof MediaRecorder !== 'undefined'
}
