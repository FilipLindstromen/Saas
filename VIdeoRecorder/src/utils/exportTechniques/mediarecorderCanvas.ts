/**
 * Export Technique 3: MediaRecorder API with Canvas
 * Records canvas directly using MediaRecorder API
 * Fast, browser-native, but limited codec options
 */

import { renderFrame } from '../renderer'
import type { RenderContext, RenderState } from '../renderer'
import { preflightAssets } from '../assetPreflight'
import { projectManager } from '../projectManager'
import type { ExportOptions, ExportResult } from '../multiExport'

export async function exportMediaRecorderCanvas(
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: any
): Promise<ExportResult> {
  logger.log('Starting MediaRecorder Canvas export...')

  // Check MediaRecorder support
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('MediaRecorder API is not available in this browser.')
  }

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    format = 'webm', // MediaRecorder works best with WebM
    onProgress,
  } = options

  try {
    logger.log(`MediaRecorder export: ${width}x${height} @ ${fps}fps, format: ${format}`)

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
    onProgress?.({ progress: 0.1, message: 'Loading video sources...', technique: 'mediarecorder-canvas' })

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
    onProgress?.({ progress: 0.2, message: 'Preflighting assets...', technique: 'mediarecorder-canvas' })

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
    
    // Check available codecs
    const mimeType = format === 'webm' 
      ? 'video/webm;codecs=vp9,opus'
      : 'video/webm;codecs=vp8,opus'

    const isSupported = MediaRecorder.isTypeSupported(mimeType)
    logger.log(`MediaRecorder mime type: ${mimeType}, supported: ${isSupported}`)

    if (!isSupported) {
      // Try fallback codecs
      const fallbackTypes = [
        'video/webm;codecs=vp8',
        'video/webm',
        'video/webm;codecs=h264',
      ]
      
      let selectedType = fallbackTypes.find(type => MediaRecorder.isTypeSupported(type))
      if (!selectedType) {
        throw new Error('No supported MediaRecorder codec found')
      }
      logger.log(`Using fallback codec: ${selectedType}`)
    }

    // Setup MediaRecorder
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: isSupported ? mimeType : 'video/webm',
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
    onProgress?.({ progress: 0.3, message: 'Starting recording...', technique: 'mediarecorder-canvas' })

    mediaRecorder.start()

    // Render frames at fixed interval
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

    logger.log(`Rendering and recording ${totalFrames} frames...`)

    // Use requestAnimationFrame to render at correct rate
    let frameIndex = 0
    const startTime = performance.now()

    return new Promise<ExportResult>((resolve, reject) => {
      const renderLoop = async () => {
        try {
          if (frameIndex >= totalFrames) {
            // Finished rendering
            mediaRecorder.stop()
            return
          }

          const timelineTime = frameIndex * frameDuration
          renderContext.time = timelineTime

          // Render frame
          await renderFrame(renderContext, renderState)

          frameIndex++

          // Progress update
          if (frameIndex % 30 === 0 || frameIndex === totalFrames) {
            const progress = 0.3 + (frameIndex / totalFrames) * 0.6 // 30% to 90%
            onProgress?.({
              progress,
              message: `Recording frame ${frameIndex} of ${totalFrames}...`,
              technique: 'mediarecorder-canvas',
            })
          }

          // Calculate next frame time
          const elapsed = (performance.now() - startTime) / 1000
          const targetTime = frameIndex * frameDuration
          const delay = Math.max(0, (targetTime - elapsed) * 1000)

          if (frameIndex < totalFrames) {
            setTimeout(renderLoop, delay)
          }
        } catch (error) {
          mediaRecorder.stop()
          reject(error)
        }
      }

      mediaRecorder.onstop = () => {
        logger.log('MediaRecorder stopped. Creating final blob...')
        onProgress?.({ progress: 0.95, message: 'Finalizing...', technique: 'mediarecorder-canvas' })

        const blob = new Blob(chunks, { type: mimeType })
        logger.log(`MediaRecorder export completed. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

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
          technique: 'mediarecorder-canvas',
          log: logger.getLogs(),
        })
      }

      // Start rendering loop
      renderLoop()
    })
  } catch (error) {
    logger.error('MediaRecorder Canvas export failed', error)
    throw error
  }
}

