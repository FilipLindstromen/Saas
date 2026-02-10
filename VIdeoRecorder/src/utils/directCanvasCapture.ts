/**
 * Direct Canvas Capture - Captures the actual preview container
 * 
 * This approach uses html2canvas to capture the actual rendered preview,
 * eliminating flickering by using what's already on screen.
 */

import html2canvas from 'html2canvas'

export interface DirectCaptureOptions {
  /** Frame rate for the export (default: 30) */
  fps?: number
  /** Video bitrate in bits per second (default: 8_000_000) */
  bitrate?: number
  /** Output format: 'mp4' or 'webm' (default: 'webm') */
  format?: 'mp4' | 'webm'
  /** Progress callback: (message, percent) => void */
  onProgress?: (message: string, percent: number) => void
}

export interface DirectCaptureResult {
  success: boolean
  blob?: Blob
  error?: string
  duration?: number
}

/**
 * Captures the preview container directly using html2canvas and records it
 * 
 * @param containerSelector - CSS selector for the preview container (e.g., '[data-canvas-container]')
 * @param duration - Duration in seconds to record
 * @param options - Export options
 * @returns Promise with the recorded video blob
 */
export async function capturePreviewDirectly(
  containerSelector: string,
  duration: number,
  options: DirectCaptureOptions = {}
): Promise<DirectCaptureResult> {
  const {
    fps = 30,
    bitrate = 8_000_000,
    format = 'webm',
    onProgress
  } = options

  try {
    onProgress?.('Finding preview container...', 0)

    const container = document.querySelector(containerSelector) as HTMLElement
    if (!container) {
      throw new Error(`Container not found: ${containerSelector}`)
    }

    onProgress?.('Setting up canvas capture...', 5)

    // Get container dimensions
    const rect = container.getBoundingClientRect()
    const width = Math.floor(rect.width)
    const height = Math.floor(rect.height)

    if (width === 0 || height === 0) {
      throw new Error('Container has zero dimensions')
    }

    // Create a canvas for capturing frames
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', { willReadFrequently: false })
    
    if (!ctx) {
      throw new Error('Failed to get 2D context')
    }

    // Check if canvas.captureStream is supported
    if (!canvas.captureStream) {
      throw new Error('Canvas captureStream API is not supported. Please use Chrome, Edge, or Firefox.')
    }

    onProgress?.('Creating video stream...', 10)

    // Create video stream from canvas
    const stream = canvas.captureStream(fps)
    const videoTrack = stream.getVideoTracks()[0]
    
    if (!videoTrack) {
      throw new Error('Failed to get video track')
    }

    // Determine MIME type
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

    onProgress?.('Starting capture...', 15)

    return await recordContainerFrames(
      container,
      canvas,
      ctx,
      stream,
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
 * Records frames by capturing the container with html2canvas
 */
async function recordContainerFrames(
  container: HTMLElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  stream: MediaStream,
  duration: number,
  fps: number,
  mimeType: string,
  bitrate: number,
  onProgress?: (message: string, percent: number) => void
): Promise<DirectCaptureResult> {
  return new Promise((resolve) => {
    const chunks: Blob[] = []
    const startTime = performance.now()
    const totalFrames = Math.ceil(duration * fps)
    const frameTime = 1000 / fps
    let currentFrame = 0
    let isRecording = true
    let animationFrameId: number | null = null

    // Create MediaRecorder
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        timeslice: 100
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
    onProgress?.('Recording started...', 20)
    recorder.start(100)

    // Time update callback - we'll use a custom event to signal when time should update
    let currentTime = 0
    const timeUpdateCallback = ((time: number) => {
      currentTime = time
      // Dispatch custom event to update preview time
      const event = new CustomEvent('export-time-update', { detail: { time } })
      window.dispatchEvent(event)
    }) as (time: number) => void

    // Capture frames using html2canvas
    const captureFrame = async () => {
      if (!isRecording || currentFrame >= totalFrames) {
        if (recorder.state === 'recording') {
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, frameTime * 2)
        }
        return
      }

      try {
        const targetTime = (currentFrame / fps)
        
        // Update time and wait for preview to render
        timeUpdateCallback(targetTime)
        
        // Wait for preview to update - use multiple RAFs to ensure frame is ready
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve) // Triple RAF for maximum frame readiness
            })
          })
        })
        
        // Small additional delay to ensure video frames are ready
        await new Promise(resolve => setTimeout(resolve, 50))

        // Capture the container using html2canvas
        const capturedCanvas = await html2canvas(container, {
          width: canvas.width,
          height: canvas.height,
          scale: 1,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#000000', // Use black background to avoid transparency issues
          logging: false,
          // Important: capture exactly what's visible
          windowWidth: container.scrollWidth,
          windowHeight: container.scrollHeight,
          // Ignore certain elements that might cause issues
          ignoreElements: (element) => {
            // Ignore elements that are not part of the preview
            return element.classList?.contains('ignore-on-export') || false
          }
        })

        // Draw the captured canvas to our recording canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(capturedCanvas, 0, 0, canvas.width, canvas.height)

        // Update progress
        const percent = 20 + (currentFrame / totalFrames) * 75
        if (currentFrame % Math.max(1, Math.floor(fps / 2)) === 0) {
          onProgress?.(`Capturing frame ${currentFrame + 1} / ${totalFrames} (${targetTime.toFixed(2)}s)`, percent)
        }

        currentFrame++

        // Schedule next frame
        if (isRecording && currentFrame < totalFrames) {
          // Use setTimeout with frameTime to maintain consistent FPS
          setTimeout(() => {
            if (isRecording) {
              animationFrameId = requestAnimationFrame(captureFrame)
            }
          }, Math.max(0, frameTime - 50)) // Account for capture time
        } else if (recorder.state === 'recording') {
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, frameTime * 2)
        }
      } catch (error) {
        isRecording = false
        if (recorder.state === 'recording') {
          recorder.stop()
        }
        resolve({
          success: false,
          error: `Frame capture error: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }

    // Start capturing frames
    animationFrameId = requestAnimationFrame(captureFrame)

    // Safety timeout
    setTimeout(() => {
      if (recorder.state === 'recording') {
        isRecording = false
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        recorder.stop()
      }
    }, (duration + 10) * 1000)
  })
}

/**
 * Helper to check if direct capture is supported
 */
export function isDirectCaptureSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream !== 'undefined' &&
         typeof MediaRecorder !== 'undefined' &&
         typeof requestAnimationFrame !== 'undefined'
}
