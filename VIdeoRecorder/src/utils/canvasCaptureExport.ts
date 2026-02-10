/**
 * Canvas Capture Export Utility
 * 
 * This utility exports the preview canvas exactly as it appears in the preview.
 * It captures the composite canvas including all video holders, captions, titles,
 * backgrounds, LUT effects, and other visual elements.
 */

export interface CanvasCaptureOptions {
  /** Frame rate for the export (default: 30) */
  fps?: number
  /** Video bitrate in bits per second (default: 5_000_000) */
  bitrate?: number
  /** Output format: 'mp4' or 'webm' (default: 'mp4') */
  format?: 'mp4' | 'webm'
  /** Progress callback: (message, percent) => void */
  onProgress?: (message: string, percent: number) => void
}

export interface CanvasCaptureResult {
  success: boolean
  blob?: Blob
  error?: string
  duration?: number
}

/**
 * Captures a canvas element as a video stream and records it
 * 
 * @param canvas - The canvas element to capture
 * @param duration - Duration in seconds to record
 * @param options - Export options
 * @returns Promise with the recorded video blob
 */
export async function captureCanvasAsVideo(
  canvas: HTMLCanvasElement,
  duration: number,
  options: CanvasCaptureOptions = {}
): Promise<CanvasCaptureResult> {
  const {
    fps = 30,
    bitrate = 5_000_000,
    format = 'mp4',
    onProgress
  } = options

  try {
    onProgress?.('Initializing canvas capture...', 0)

    // Check if canvas.captureStream is supported
    if (!canvas.captureStream) {
      throw new Error('Canvas captureStream API is not supported in this browser. Please use Chrome, Edge, or Firefox.')
    }

    // Ensure canvas has valid dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas has invalid dimensions. Please ensure the canvas is properly sized.')
    }

    onProgress?.('Starting canvas stream capture...', 5)

    // Create a video stream from the canvas
    const stream = canvas.captureStream(fps)
    
    // Get the video track
    const videoTrack = stream.getVideoTracks()[0]
    if (!videoTrack) {
      throw new Error('Failed to get video track from canvas stream')
    }

    onProgress?.('Setting up MediaRecorder...', 10)

    // Determine MIME type based on format
    const mimeType = format === 'mp4' 
      ? 'video/webm;codecs=vp9' // MediaRecorder doesn't support MP4 directly, use WebM
      : 'video/webm;codecs=vp9'

    // Check if the MIME type is supported
    if (!MediaRecorder.isTypeSupported(mimeType)) {
      // Fallback to VP8
      const fallbackMimeType = format === 'mp4'
        ? 'video/webm;codecs=vp8'
        : 'video/webm;codecs=vp8'
      
      if (!MediaRecorder.isTypeSupported(fallbackMimeType)) {
        throw new Error('No supported video codec found. Please use a modern browser.')
      }

      return await recordStream(stream, duration, fallbackMimeType, bitrate, onProgress)
    }

    onProgress?.('Recording canvas...', 15)

    const result = await recordStream(stream, duration, mimeType, bitrate, onProgress)

    // If format was requested as MP4 but we recorded WebM, note it in the result
    if (format === 'mp4' && result.success) {
      onProgress?.('Note: Recorded as WebM (MP4 not directly supported by MediaRecorder). You can convert it later if needed.', 100)
    }

    return result

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Records a media stream using MediaRecorder
 */
async function recordStream(
  stream: MediaStream,
  duration: number,
  mimeType: string,
  bitrate: number,
  onProgress?: (message: string, percent: number) => void
): Promise<CanvasCaptureResult> {
  return new Promise((resolve) => {
    const chunks: Blob[] = []
    const startTime = Date.now()

    // Create MediaRecorder with options
    const options: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: bitrate,
    }

    let recorder: MediaRecorder

    try {
      recorder = new MediaRecorder(stream, options)
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
        const elapsed = (Date.now() - startTime) / 1000
        const percent = Math.min(95, (elapsed / duration) * 100)
        onProgress?.(`Recording... ${elapsed.toFixed(1)}s / ${duration.toFixed(1)}s`, percent)
      }
    }

    // Handle recording stop
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const actualDuration = (Date.now() - startTime) / 1000
      
      onProgress?.('Finalizing video...', 98)
      
      resolve({
        success: true,
        blob,
        duration: actualDuration
      })
    }

    // Handle errors
    recorder.onerror = (event) => {
      resolve({
        success: false,
        error: `Recording error: ${(event as any).error?.message || 'Unknown error'}`
      })
    }

    // Start recording
    onProgress?.('Recording started...', 20)
    recorder.start(1000) // Collect data every second

    // Stop recording after duration
    setTimeout(() => {
      if (recorder.state === 'recording') {
        recorder.stop()
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop())
      }
    }, duration * 1000)
  })
}

/**
 * Alternative method: Capture canvas frames manually and encode with WebCodecs
 * This provides more control but requires WebCodecs API support
 */
export async function captureCanvasWithWebCodecs(
  canvas: HTMLCanvasElement,
  duration: number,
  options: CanvasCaptureOptions = {}
): Promise<CanvasCaptureResult> {
  const {
    fps = 30,
    bitrate = 5_000_000,
    onProgress
  } = options

  try {
    // Check for WebCodecs support
    if (typeof VideoEncoder === 'undefined') {
      throw new Error('WebCodecs API is not supported. Please use Chrome 94+, Edge 94+, or Opera 80+.')
    }

    onProgress?.('Initializing WebCodecs encoder...', 0)

    // Ensure canvas has valid dimensions
    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error('Canvas has invalid dimensions.')
    }

    const totalFrames = Math.ceil(duration * fps)
    const frameDuration = 1000 / fps // milliseconds per frame

    // Create video encoder
    const encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        // Handle encoded chunks
        // This is a simplified version - full implementation would need
        // to mux the chunks into a container format
      },
      error: (error) => {
        throw error
      }
    })

    // Configure encoder
    encoder.configure({
      codec: 'avc1.42001E', // H.264 baseline
      width: canvas.width,
      height: canvas.height,
      bitrate: bitrate,
      framerate: fps,
    })

    onProgress?.('Capturing frames...', 10)

    // Capture frames
    for (let frameNumber = 0; frameNumber < totalFrames; frameNumber++) {
      const timestamp = frameNumber * frameDuration * 1000 // microseconds
      
      // Create VideoFrame from canvas
      const frame = new VideoFrame(canvas, {
        timestamp,
        duration: frameDuration * 1000
      })

      encoder.encode(frame)
      frame.close()

      const percent = 10 + (frameNumber / totalFrames) * 80
      onProgress?.(`Capturing frame ${frameNumber + 1} / ${totalFrames}`, percent)

      // Wait for next frame
      await new Promise(resolve => setTimeout(resolve, frameDuration))
    }

    // Flush encoder
    await encoder.flush()
    encoder.close()

    onProgress?.('Encoding complete', 95)

    // Note: This is a simplified version. A full implementation would need
    // to collect the encoded chunks and mux them into an MP4 container.
    // For now, we recommend using captureCanvasAsVideo instead.

    return {
      success: false,
      error: 'WebCodecs implementation incomplete. Please use captureCanvasAsVideo instead.'
    }

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Helper function to check if canvas capture is supported
 */
export function isCanvasCaptureSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream !== 'undefined'
}

/**
 * Helper function to check if WebCodecs is supported
 */
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined'
}
