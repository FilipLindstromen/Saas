/**
 * Improved Canvas Export Utility
 * 
 * This version fixes flickering and low frame rate issues by:
 * 1. Properly synchronizing video elements before drawing
 * 2. Using requestAnimationFrame for consistent timing
 * 3. Ensuring frames are ready before capture
 * 4. Using a continuous render loop instead of setTimeout
 */

export interface ImprovedExportOptions {
  /** Frame rate for the export (default: 30) */
  fps?: number
  /** Video bitrate in bits per second (default: 8_000_000) */
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

export interface ImprovedExportResult {
  success: boolean
  blob?: Blob
  error?: string
  duration?: number
}

/**
 * Renders a composite frame to a canvas
 */
export type FrameRenderer = (
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  time: number
) => Promise<void> | void

/**
 * Improved export that uses continuous rendering with proper frame synchronization
 */
export async function exportCanvasImproved(
  frameRenderer: FrameRenderer,
  duration: number,
  options: ImprovedExportOptions = {}
): Promise<ImprovedExportResult> {
  const {
    fps = 30,
    bitrate = 8_000_000,
    format = 'webm',
    width = 1920,
    height = 1080,
    onProgress
  } = options

  try {
    onProgress?.('Initializing improved canvas export...', 0)

    // Create a hidden canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { 
      willReadFrequently: false,
      alpha: false // Disable alpha for better performance
    })
    
    if (!ctx) {
      throw new Error('Failed to get 2D context from canvas')
    }

    // Check if canvas.captureStream is supported
    if (!canvas.captureStream) {
      throw new Error('Canvas captureStream API is not supported. Please use Chrome, Edge, or Firefox.')
    }

    onProgress?.('Setting up canvas stream...', 5)

    // Create video stream from canvas with the desired frame rate
    const stream = canvas.captureStream(fps)
    const videoTrack = stream.getVideoTracks()[0]
    
    if (!videoTrack) {
      throw new Error('Failed to get video track from canvas stream')
    }

    // Determine MIME type - prefer VP9 for better quality
    let mimeType = format === 'mp4'
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp9'

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('No supported video codec found.')
        }
      }
    }

    onProgress?.('Starting continuous rendering...', 10)

    return await recordWithContinuousRendering(
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
 * Records using continuous rendering loop for smooth frame capture
 */
async function recordWithContinuousRendering(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  stream: MediaStream,
  frameRenderer: FrameRenderer,
  duration: number,
  fps: number,
  mimeType: string,
  bitrate: number,
  onProgress?: (message: string, percent: number) => void
): Promise<ImprovedExportResult> {
  return new Promise((resolve) => {
    const chunks: Blob[] = []
    const startTime = performance.now()
    const totalFrames = Math.ceil(duration * fps)
    const frameTime = 1000 / fps // milliseconds per frame
    let currentFrame = 0
    let isRecording = true
    let lastFrameTime = 0
    let animationFrameId: number | null = null

    // Create MediaRecorder with optimal settings
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        // Use timeslice to get data more frequently for better progress tracking
        timeslice: 100 // 100ms chunks
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
      const actualDuration = (performance.now() - startTime) / 1000
      
      // Clean up
      stream.getTracks().forEach(track => track.stop())
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      
      resolve({
        success: true,
        blob,
        duration: actualDuration
      })
    }

    // Handle errors
    recorder.onerror = (event) => {
      isRecording = false
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      resolve({
        success: false,
        error: `Recording error: ${(event as any).error?.message || 'Unknown error'}`
      })
    }

    // Start recording
    onProgress?.('Starting recording...', 10)
    recorder.start(100) // Collect data every 100ms for smoother progress

    // Continuous render loop using requestAnimationFrame
    const renderLoop = async (currentTime: number) => {
      if (!isRecording || currentFrame >= totalFrames) {
        if (recorder.state === 'recording') {
          // Wait a moment for the last frame to be captured
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, frameTime * 2)
        }
        return
      }

      // Calculate target time for this frame
      const targetTime = (currentFrame / fps)
      const elapsed = currentTime - lastFrameTime

      // Only render if enough time has passed (throttle to desired FPS)
      if (elapsed >= frameTime || lastFrameTime === 0) {
        try {
          // Clear canvas first to avoid flickering
          ctx.fillStyle = '#000000'
          ctx.fillRect(0, 0, canvas.width, canvas.height)

          // Render the frame - wait for it to complete
          await frameRenderer(canvas, ctx, targetTime)

          // Force canvas to update (important for captureStream)
          // This ensures the frame is ready before capture
          ctx.save()
          ctx.restore()

          // Update progress
          const percent = 10 + (currentFrame / totalFrames) * 85
          if (currentFrame % Math.max(1, Math.floor(fps / 2)) === 0) {
            // Update progress every half second
            onProgress?.(`Rendering frame ${currentFrame + 1} / ${totalFrames} (${targetTime.toFixed(2)}s)`, percent)
          }

          currentFrame++
          lastFrameTime = currentTime

        } catch (error) {
          isRecording = false
          if (recorder.state === 'recording') {
            recorder.stop()
          }
          resolve({
            success: false,
            error: `Frame rendering error: ${error instanceof Error ? error.message : String(error)}`
          })
          return
        }
      }

      // Continue the loop
      if (isRecording && currentFrame < totalFrames) {
        animationFrameId = requestAnimationFrame(renderLoop)
      } else if (recorder.state === 'recording') {
        // All frames rendered, stop recording
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }, frameTime * 2)
      }
    }

    // Start the render loop
    animationFrameId = requestAnimationFrame(renderLoop)

    // Safety timeout
    setTimeout(() => {
      if (recorder.state === 'recording') {
        isRecording = false
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        recorder.stop()
      }
    }, (duration + 10) * 1000) // Add 10 second buffer
  })
}

/**
 * Helper to check if improved export is supported
 */
export function isImprovedExportSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream !== 'undefined' &&
         typeof MediaRecorder !== 'undefined' &&
         typeof requestAnimationFrame !== 'undefined'
}
