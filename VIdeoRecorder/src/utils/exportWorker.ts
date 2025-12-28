/**
 * Export worker for offline rendering using OffscreenCanvas
 * Runs in a Web Worker to keep UI responsive
 */

import type { RenderContext, RenderState } from './renderer'
import { renderFrame } from './renderer'
import { VideoEncoderWrapper, canvasToVideoFrame, isWebCodecsSupported } from './webcodecsEncoder'
import type { EncoderConfig } from './webcodecsEncoder'

export interface ExportConfig {
  // Render settings
  width: number
  height: number
  fps: number
  duration: number // in seconds
  dpr: number // device pixel ratio (typically 1.0 for export)
  
  // Encoder settings
  bitrate: number
  keyframeInterval: number
  codec: 'avc1' | 'vp8' | 'vp9'
  format: 'mp4' | 'webm'
  
  // Render state
  renderState: RenderState
  
  // Video elements (will be transferred to worker)
  videoBlobs: Map<string, Blob>
  imageUrls: Map<string, string>
  fonts: string[]
}

export interface ExportProgress {
  progress: number // 0-1
  message: string
  currentFrame: number
  totalFrames: number
}

export interface ExportResult {
  success: boolean
  blob?: Blob
  error?: string
}

/**
 * Export video using WebCodecs in main thread
 * (Worker version would use OffscreenCanvas, but we'll start with main thread)
 */
export async function exportVideo(
  config: ExportConfig,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  // Check WebCodecs support
  if (!isWebCodecsSupported()) {
    return {
      success: false,
      error: 'WebCodecs API is not supported in this browser. Please use a Chromium-based browser.',
    }
  }

  try {
    // Step 1: Preflight assets
    if (onProgress) {
      onProgress({
        progress: 0.0,
        message: 'Preloading assets...',
        currentFrame: 0,
        totalFrames: Math.ceil(config.duration * config.fps),
      })
    }

    const { preflightAssets } = await import('./assetPreflight')
    
    // Preflight all assets
    const preflightResult = await preflightAssets(
      config.videoBlobs,
      config.imageUrls,
      config.fonts
    )

    if (!preflightResult.success) {
      return {
        success: false,
        error: `Asset preflight failed: ${preflightResult.errors.join(', ')}`,
      }
    }

    const videoElements = preflightResult.videoElements

    if (onProgress) {
      onProgress({
        progress: 0.1,
        message: 'Assets loaded, initializing encoder...',
        currentFrame: 0,
        totalFrames: Math.ceil(config.duration * config.fps),
      })
    }

    // Step 2: Initialize encoder
    const encoderConfig: EncoderConfig = {
      width: config.width,
      height: config.height,
      fps: config.fps,
      bitrate: config.bitrate,
      keyframeInterval: config.keyframeInterval,
      codec: config.codec,
    }

    const encoder = new VideoEncoderWrapper(encoderConfig)
    
    // Set up error callback before initialization
    let encoderError: Error | null = null
    encoder.setErrorCallback((error) => {
      encoderError = error
      console.error('Encoder error:', error)
    })
    
    try {
      await encoder.initialize()
    } catch (error) {
      return {
        success: false,
        error: `Failed to initialize encoder: ${error instanceof Error ? error.message : String(error)}`,
      }
    }

    // Verify encoder is still configured after initialization
    if (encoderError) {
      return {
        success: false,
        error: `Encoder initialization error: ${encoderError.message}`,
      }
    }

    // Collect encoded chunks
    const encodedChunks: Array<{ chunk: EncodedVideoChunk; metadata?: EncodedVideoChunkMetadata }> = []
    encoder.setChunkCallback((chunk) => {
      encodedChunks.push(chunk)
    })

    // Step 3: Create canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = config.width
    canvas.height = config.height
    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: false, // Opaque for better performance
      colorSpace: 'srgb',
    })

    if (!ctx) {
      return {
        success: false,
        error: 'Failed to get canvas context',
      }
    }

    // Step 4: Render and encode frames
    const totalFrames = Math.ceil(config.duration * config.fps)
    const frameDuration = 1 / config.fps // in seconds
    const frameDurationMicroseconds = frameDuration * 1_000_000 // in microseconds

    const renderContext: RenderContext = {
      canvas,
      ctx,
      time: 0,
      width: config.width,
      height: config.height,
      dpr: config.dpr,
      videoElements,
    }

    // Error callback already set up before initialization
    // Just check for errors that occurred during initialization

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      // Check for encoder errors before each frame
      if (encoderError) {
        throw encoderError
      }

      // Verify encoder is still valid before encoding
      let queueSize = encoder.getQueueSize()
      if (queueSize === -1) {
        // Encoder is closed or invalid
        throw new Error('Encoder became invalid before encoding frame. This may indicate a configuration error.')
      }

      // Calculate timeline time for this frame
      const timelineTime = frameIndex * frameDuration
      const timestamp = frameIndex * frameDurationMicroseconds

      // Update render context
      renderContext.time = timelineTime

      // Render frame
      await renderFrame(renderContext, config.renderState)
      
      // Verify canvas has content (debug check)
      if (frameIndex === 0 || frameIndex % 30 === 0) {
        const imageData = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height))
        const hasContent = imageData.data.some((val, idx) => idx % 4 !== 3 && val !== 0) // Check if any non-alpha pixel is non-zero
        if (!hasContent && frameIndex === 0) {
          console.warn('First frame appears empty. Check video loading and layout clips.')
        }
      }

      // Convert canvas to VideoFrame
      const videoFrame = canvasToVideoFrame(canvas, timestamp)

      try {
        // Encode frame
        encoder.encodeFrame(videoFrame, timestamp)
      } catch (error) {
        // Close frame before handling error
        videoFrame.close()
        const errorMsg = error instanceof Error ? error.message : String(error)
        // If encoder is closed, provide more helpful error
        if (errorMsg.includes('closed')) {
          throw new Error(`Encoder was closed during encoding. This may be due to a configuration error or unsupported codec settings. Original error: ${errorMsg}`)
        }
        throw new Error(`Failed to encode frame ${frameIndex + 1}: ${errorMsg}`)
      }

      // Close frame to free memory
      videoFrame.close()

      // Report progress
      if (onProgress && frameIndex % 10 === 0) {
        const progress = 0.1 + (frameIndex / totalFrames) * 0.7 // 10% to 80%
        onProgress({
          progress,
          message: `Encoding frame ${frameIndex + 1} of ${totalFrames}...`,
          currentFrame: frameIndex + 1,
          totalFrames,
        })
      }

      // Handle encoder backpressure (reuse queueSize variable)
      queueSize = encoder.getQueueSize()
      if (queueSize > 20) {
        // Wait a bit for encoder to catch up
        await new Promise((resolve) => setTimeout(resolve, 10))
      }

      // Yield to prevent blocking
      if (frameIndex % 30 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    // Check for encoder errors one more time before flush
    if (encoderError) {
      throw encoderError
    }

    if (onProgress) {
      onProgress({
        progress: 0.8,
        message: 'Finalizing encoding...',
        currentFrame: totalFrames,
        totalFrames,
      })
    }

    // Step 5: Flush encoder
    await encoder.flush()
    encoder.close()

    if (onProgress) {
      onProgress({
        progress: 0.9,
        message: 'Muxing video...',
        currentFrame: totalFrames,
        totalFrames,
      })
    }

    // Step 6: Mux chunks into final video
    const { Muxer } = await import('./muxer')
    const muxer = new Muxer({
      format: config.format,
      videoCodec: config.codec === 'avc1' ? 'avc1' : config.codec === 'vp8' ? 'vp8' : 'vp9',
      width: config.width,
      height: config.height,
      fps: config.fps,
      duration: config.duration,
    })

    for (const { chunk } of encodedChunks) {
      muxer.addVideoChunk(chunk)
    }

    muxer.setProgressCallback((progress) => {
      if (onProgress) {
        onProgress({
          progress: 0.9 + progress.progress * 0.1,
          message: progress.message,
          currentFrame: totalFrames,
          totalFrames,
        })
      }
    })

    const blob = await muxer.mux()

    // Cleanup
    for (const video of videoElements.values()) {
      const url = video.src
      video.src = ''
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    }

    if (onProgress) {
      onProgress({
        progress: 1.0,
        message: 'Export complete!',
        currentFrame: totalFrames,
        totalFrames,
      })
    }

    return {
      success: true,
      blob,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

/**
 * Create export worker (for future OffscreenCanvas support)
 * This would run in a Web Worker with OffscreenCanvas
 */
export function createExportWorker(): Worker | null {
  if (typeof Worker === 'undefined') {
    return null
  }

  // Worker code would be in a separate file
  // For now, we'll use main thread export
  return null
}

