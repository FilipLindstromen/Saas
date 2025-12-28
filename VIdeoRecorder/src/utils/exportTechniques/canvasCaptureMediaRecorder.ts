/**
 * Export Technique 5: Canvas CaptureStream + MediaRecorder
 * Uses canvas.captureStream() and MediaRecorder to record
 * Fast, native browser encoding, best for WebM
 */

import { renderFrame } from '../renderer'
import type { RenderContext, RenderState } from '../renderer'
import { preflightAssets } from '../assetPreflight'
import { projectManager } from '../projectManager'
import type { ExportOptions, ExportResult } from '../multiExport'

export async function exportCanvasCaptureMediaRecorder(
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: any
): Promise<ExportResult> {
  logger.log('Starting Canvas CaptureStream + MediaRecorder export...')

  // Check support
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder API is not available in this browser.')
  }
  if (typeof HTMLCanvasElement.prototype.captureStream === 'undefined') {
    throw new Error('Canvas captureStream is not available in this browser.')
  }

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    format = 'webm',
    onProgress,
  } = options

  try {
    logger.log(`Canvas CaptureStream MediaRecorder export: ${width}x${height} @ ${fps}fps`)

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
    onProgress?.({ progress: 0.1, message: 'Loading video sources...', technique: 'canvas-capture-mediarecorder' })

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
    onProgress?.({ progress: 0.2, message: 'Preflighting assets...', technique: 'canvas-capture-mediarecorder' })

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

    // Create canvas stream
    const stream = canvas.captureStream(fps)
    logger.log(`Canvas stream created at ${fps} fps`)

    // Determine MIME type
    const mimeTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
    ]

    let selectedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type))
    if (!selectedMimeType) {
      throw new Error('No supported MediaRecorder codec found')
    }

    logger.log(`Using MIME type: ${selectedMimeType}`)

    // Setup MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: selectedMimeType,
      videoBitsPerSecond: options.bitrate || 5_000_000,
    })

    const chunks: Blob[] = []

    mediaRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
        logger.log(`Received chunk: ${(event.data.size / 1024).toFixed(2)} KB`)
      }
    }

    mediaRecorder.onerror = (event) => {
      logger.error('MediaRecorder error', event)
    }

    // Start recording
    logger.log('Starting MediaRecorder...')
    onProgress?.({ progress: 0.3, message: 'Starting recording...', technique: 'canvas-capture-mediarecorder' })

    mediaRecorder.start(100) // Request data every 100ms

    // Render frames
    const frameDuration = 1 / fps
    const totalFrames = Math.ceil(totalDuration * fps)

    const renderContext: RenderContext = {
      canvas,
      ctx,
      time: 0,
      width,
      height,
      dpr: 1.0,
      videoElements: preflightResult.videoElements,
    }

    logger.log(`Rendering ${totalFrames} frames...`)

    // Render all frames
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const timelineTime = frameIndex * frameDuration
      renderContext.time = timelineTime

      // Render frame
      await renderFrame(renderContext, renderState)

      // Progress update
      if (frameIndex % 30 === 0 || frameIndex === totalFrames - 1) {
        const progress = 0.3 + (frameIndex / totalFrames) * 0.6 // 30% to 90%
        onProgress?.({
          progress,
          message: `Recording frame ${frameIndex + 1} of ${totalFrames}...`,
          technique: 'canvas-capture-mediarecorder',
        })
      }

      // Yield to prevent blocking
      if (frameIndex % 30 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    logger.log('All frames rendered. Stopping MediaRecorder...')

    // Stop recording and wait for final blob
    return new Promise<ExportResult>((resolve, reject) => {
      mediaRecorder.onstop = () => {
        logger.log('MediaRecorder stopped. Creating final blob...')
        onProgress?.({ progress: 0.95, message: 'Finalizing...', technique: 'canvas-capture-mediarecorder' })

        const blob = new Blob(chunks, { type: selectedMimeType })
        logger.log(`Canvas CaptureStream MediaRecorder export completed. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

        // Cleanup
        stream.getTracks().forEach(track => track.stop())
        for (const video of preflightResult.videoElements.values()) {
          const url = video.src
          video.src = ''
          if (url && url.startsWith('blob:')) {
            URL.revokeObjectURL(url)
          }
        }

        resolve({
          success: true,
          blob,
          technique: 'canvas-capture-mediarecorder',
          log: logger.getLogs(),
        })
      }

      mediaRecorder.stop()

      // Timeout fallback
      setTimeout(() => {
        if (chunks.length > 0) {
          const blob = new Blob(chunks, { type: selectedMimeType })
          logger.warn('MediaRecorder onstop not fired, using collected chunks')
          resolve({
            success: true,
            blob,
            technique: 'canvas-capture-mediarecorder',
            log: logger.getLogs(),
          })
        } else {
          reject(new Error('MediaRecorder stopped but no chunks were collected'))
        }
      }, 5000)
    })
  } catch (error) {
    logger.error('Canvas CaptureStream MediaRecorder export failed', error)
    throw error
  }
}

