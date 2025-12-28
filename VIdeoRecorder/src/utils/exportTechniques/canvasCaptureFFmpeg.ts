/**
 * Export Technique 4: Canvas CaptureStream + FFmpeg
 * Uses canvas.captureStream() and feeds frames to FFmpeg
 * Good compatibility, uses FFmpeg encoding
 */

import { renderFrame } from '../renderer'
import type { RenderContext, RenderState } from '../renderer'
import { encodeFramesToVideo } from '../ffmpeg'
import { preflightAssets } from '../assetPreflight'
import { projectManager } from '../projectManager'
import type { ExportOptions, ExportResult } from '../multiExport'

export async function exportCanvasCaptureFFmpeg(
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: any
): Promise<ExportResult> {
  logger.log('Starting Canvas CaptureStream + FFmpeg export...')

  // Check canvas captureStream support
  if (typeof HTMLCanvasElement.prototype.captureStream === 'undefined') {
    throw new Error('Canvas captureStream is not available in this browser.')
  }

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    format = 'mp4',
    onProgress,
  } = options

  try {
    logger.log(`Canvas CaptureStream FFmpeg export: ${width}x${height} @ ${fps}fps`)

    // Calculate total duration
    const totalDuration = renderState.timelineClips.reduce((max, clip) => {
      return Math.max(max, clip.timelineEnd)
    }, 0)

    if (totalDuration <= 0) {
      throw new Error('No video content to export')
    }

    logger.log(`Total duration: ${totalDuration.toFixed(2)}s`)

    // Collect video blobs
    const videoBlobs = new Map<string, Blob>()
    const sceneTakes = new Map<string, { sceneId: string; takeId: string }>()

    for (const clip of renderState.timelineClips) {
      const key = `${clip.sceneId}_${clip.takeId}`
      if (!sceneTakes.has(key)) {
        sceneTakes.set(key, { sceneId: clip.sceneId, takeId: clip.takeId })
      }
    }

    logger.log(`Loading ${sceneTakes.size} video sources...`)
    onProgress?.({ progress: 0.05, message: 'Loading video sources...', technique: 'canvas-capture-ffmpeg' })

    // Load video blobs
    for (const { sceneId, takeId } of sceneTakes.values()) {
      const layers = ['camera', 'screen', 'microphone'] as const
      for (const layer of layers) {
        const videoKey = `${sceneId}_${takeId}_${layer}`
        try {
          const blob = await projectManager.loadRecording(sceneId, `${takeId}_${layer}`)
          if (blob) {
            videoBlobs.set(videoKey, blob)
          }
        } catch (error) {
          logger.warn(`Video layer ${videoKey} not found, skipping`)
        }
      }
    }

    // Collect image URLs and fonts
    const imageUrls = new Map<string, string>()
    if (renderState.backgroundImageData) {
      imageUrls.set('background', renderState.backgroundImageData.url)
    }

    const fonts: string[] = []
    if (renderState.captionSettings?.font) {
      fonts.push(renderState.captionSettings.font)
    }
    if (renderState.titleSettings?.font) {
      fonts.push(renderState.titleSettings.font)
    }

    // Preflight assets
    logger.log('Preflighting assets...')
    onProgress?.({ progress: 0.1, message: 'Preflighting assets...', technique: 'canvas-capture-ffmpeg' })

    const preflightResult = await preflightAssets(videoBlobs, imageUrls, fonts)
    if (!preflightResult.success) {
      throw new Error(`Asset preflight failed: ${preflightResult.errors.join(', ')}`)
    }

    // Create canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: false,
      colorSpace: 'srgb',
    })

    if (!ctx) {
      throw new Error('Failed to get canvas context')
    }

    // Capture stream from canvas
    const stream = canvas.captureStream(fps)
    logger.log(`Canvas stream created at ${fps} fps`)

    // Create video element to receive stream
    const videoElement = document.createElement('video')
    videoElement.width = width
    videoElement.height = height
    videoElement.autoplay = true
    videoElement.playsInline = true
    videoElement.srcObject = stream

    // Wait for video to be ready
    await new Promise((resolve) => {
      videoElement.addEventListener('loadedmetadata', resolve, { once: true })
    })

    // Render frames and capture them
    const totalFrames = Math.ceil(totalDuration * fps)
    const frameDuration = 1 / fps
    const frames: Blob[] = []

    logger.log(`Rendering and capturing ${totalFrames} frames...`)
    onProgress?.({ progress: 0.2, message: 'Rendering frames...', technique: 'canvas-capture-ffmpeg' })

    const renderContext: RenderContext = {
      canvas,
      ctx,
      time: 0,
      width,
      height,
      dpr: 1.0,
      videoElements: preflightResult.videoElements,
    }

    // Use ImageCapture API if available, otherwise fall back to canvas.toBlob
    const hasImageCapture = typeof ImageCapture !== 'undefined'
    let imageCapture: ImageCapture | null = null

    if (hasImageCapture) {
      try {
        const track = stream.getVideoTracks()[0]
        if (track) {
          imageCapture = new ImageCapture(track)
          logger.log('Using ImageCapture API for frame capture')
        }
      } catch (error) {
        logger.warn('ImageCapture API not available, using canvas.toBlob fallback')
      }
    }

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const timelineTime = frameIndex * frameDuration
      renderContext.time = timelineTime

      // Render frame
      await renderFrame(renderContext, renderState)

      // Capture frame
      let frameBlob: Blob
      if (imageCapture) {
        try {
          const frame = await imageCapture.grabFrame()
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = width
          tempCanvas.height = height
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.drawImage(frame, 0, 0)
            frameBlob = await new Promise<Blob>((resolve, reject) => {
              tempCanvas.toBlob((blob) => {
                if (blob) resolve(blob)
                else reject(new Error('Failed to convert frame to blob'))
              }, 'image/png')
            })
          } else {
            throw new Error('Failed to get temp canvas context')
          }
        } catch (error) {
          logger.warn('ImageCapture failed, falling back to canvas.toBlob')
          frameBlob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((blob) => {
              if (blob) resolve(blob)
              else reject(new Error('Failed to convert canvas to blob'))
            }, 'image/png')
          })
        }
      } else {
        frameBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to convert canvas to blob'))
          }, 'image/png')
        })
      }

      frames.push(frameBlob)

      // Progress update
      if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
        const progress = 0.2 + (frameIndex / totalFrames) * 0.5 // 20% to 70%
        onProgress?.({
          progress,
          message: `Captured ${frameIndex + 1} of ${totalFrames} frames...`,
          technique: 'canvas-capture-ffmpeg',
        })
      }

      // Yield to prevent blocking
      if (frameIndex % 30 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    logger.log(`All ${frames.length} frames captured. Starting FFmpeg encoding...`)
    onProgress?.({ progress: 0.7, message: 'Encoding with FFmpeg...', technique: 'canvas-capture-ffmpeg' })

    // Encode frames with FFmpeg
    const blob = await encodeFramesToVideo(
      frames,
      fps,
      'output.mp4',
      null,
      (progress) => {
        onProgress?.({
          progress: 0.7 + progress * 0.3,
          message: `Encoding: ${(progress * 100).toFixed(1)}%`,
          technique: 'canvas-capture-ffmpeg',
        })
      }
    )

    logger.log(`Canvas CaptureStream FFmpeg export completed. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

    // Cleanup
    stream.getTracks().forEach(track => track.stop())
    videoElement.srcObject = null
    for (const video of preflightResult.videoElements.values()) {
      const url = video.src
      video.src = ''
      if (url && url.startsWith('blob:')) {
        URL.revokeObjectURL(url)
      }
    }

    return {
      success: true,
      blob,
      technique: 'canvas-capture-ffmpeg',
      log: logger.getLogs(),
    }
  } catch (error) {
    logger.error('Canvas CaptureStream FFmpeg export failed', error)
    throw error
  }
}

