/**
 * Export Technique 2: FFmpeg with Frame Sequence
 * Renders frames to canvas, captures as images, encodes with FFmpeg
 * Good compatibility, works in all browsers, slower but reliable
 */

import { renderFrame } from '../renderer'
import type { RenderContext, RenderState } from '../renderer'
import { encodeFramesToVideo } from '../ffmpeg'
import { preflightAssets } from '../assetPreflight'
import { projectManager } from '../projectManager'
import type { ExportOptions, ExportResult } from '../multiExport'

export async function exportFFmpegFrames(
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: any
): Promise<ExportResult> {
  logger.log('Starting FFmpeg Frames export...')

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    format = 'mp4',
    onProgress,
  } = options

  try {
    logger.log(`FFmpeg Frames export: ${width}x${height} @ ${fps}fps`)

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
    onProgress?.({ progress: 0.05, message: 'Loading video sources...', technique: 'ffmpeg-frames' })

    // Load video blobs from project
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
    onProgress?.({ progress: 0.1, message: 'Preflighting assets...', technique: 'ffmpeg-frames' })

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

    // Render frames
    const totalFrames = Math.ceil(totalDuration * fps)
    const frameDuration = 1 / fps
    const frames: Blob[] = []

    logger.log(`Rendering ${totalFrames} frames...`)
    onProgress?.({ progress: 0.2, message: `Rendering frames...`, technique: 'ffmpeg-frames' })

    const renderContext: RenderContext = {
      canvas,
      ctx,
      time: 0,
      width,
      height,
      dpr: 1.0,
      videoElements: preflightResult.videoElements,
    }

    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      const timelineTime = frameIndex * frameDuration
      renderContext.time = timelineTime

      // Render frame
      await renderFrame(renderContext, renderState)

      // Convert canvas to blob
      const frameBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to convert canvas to blob'))
          }
        }, 'image/png')
      })

      frames.push(frameBlob)

      // Progress update
      if (frameIndex % 10 === 0 || frameIndex === totalFrames - 1) {
        const progress = 0.2 + (frameIndex / totalFrames) * 0.5 // 20% to 70%
        onProgress?.({
          progress,
          message: `Rendered ${frameIndex + 1} of ${totalFrames} frames...`,
          technique: 'ffmpeg-frames',
        })
        logger.log(`Rendered frame ${frameIndex + 1}/${totalFrames}`)
      }

      // Yield to prevent blocking
      if (frameIndex % 30 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    logger.log(`All ${frames.length} frames rendered. Starting FFmpeg encoding...`)
    onProgress?.({ progress: 0.7, message: 'Encoding with FFmpeg...', technique: 'ffmpeg-frames' })

    // Encode frames with FFmpeg
    const blob = await encodeFramesToVideo(
      frames,
      fps,
      'output.mp4',
      null, // No audio for now - can be added later
      (progress) => {
        onProgress?.({
          progress: 0.7 + progress * 0.3, // 70% to 100%
          message: `Encoding: ${(progress * 100).toFixed(1)}%`,
          technique: 'ffmpeg-frames',
        })
      }
    )

    logger.log(`FFmpeg Frames export completed. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

    // Cleanup - revoke blob URLs if provided in preflight result
    if (preflightResult.videoBlobUrls) {
      for (const url of preflightResult.videoBlobUrls.values()) {
        if (url && url.startsWith('blob:')) {
          URL.revokeObjectURL(url)
        }
      }
    }
    
    // Also cleanup video elements
    for (const video of preflightResult.videoElements.values()) {
      video.src = ''
    }

    return {
      success: true,
      blob,
      technique: 'ffmpeg-frames',
      log: logger.getLogs(),
    }
  } catch (error) {
    logger.error('FFmpeg Frames export failed', error)
    throw error
  }
}

