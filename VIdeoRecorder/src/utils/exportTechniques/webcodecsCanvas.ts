/**
 * Export Technique 1: WebCodecs with Canvas Rendering
 * Uses WebCodecs VideoEncoder to encode frames rendered to canvas
 * Best quality, good performance, requires Chrome/Edge
 */

import { exportOfflineVideo } from '../offlineExport'
import type { RenderState } from '../renderer'
import type { ExportOptions, ExportResult } from '../multiExport'

export async function exportWebCodecsCanvas(
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: any
): Promise<ExportResult> {
  logger.log('Starting WebCodecs Canvas export...')

  // Check WebCodecs support
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('WebCodecs API is not available. Please use Chrome 94+, Edge 94+, or Opera 80+.')
  }

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    bitrate = 5_000_000,
    format = 'mp4',
    codec = 'avc1',
    onProgress,
  } = options

  try {
    logger.log(`WebCodecs export: ${width}x${height} @ ${fps}fps, format: ${format}, codec: ${codec}`)

    // Use the existing offline export pipeline
    const blob = await exportOfflineVideo(renderState, {
      width,
      height,
      fps,
      bitrate,
      format,
      codec,
      onProgress: onProgress ? (progress) => {
        onProgress({
          ...progress,
          technique: 'webcodecs-canvas',
        })
      } : undefined,
    })

    logger.log(`WebCodecs export completed. Blob size: ${(blob.size / 1024 / 1024).toFixed(2)} MB`)

    return {
      success: true,
      blob,
      technique: 'webcodecs-canvas',
      log: logger.getLogs(),
    }
  } catch (error) {
    logger.error('WebCodecs Canvas export failed', error)
    throw error
  }
}

