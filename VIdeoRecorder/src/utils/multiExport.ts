/**
 * Multi-technique video export system
 * Provides 5 different export methods with automatic fallback and logging
 */

import { exportOfflineVideo, prepareRenderState } from './offlineExport'
import type { RenderState } from './renderer'
import type { Scene } from '../App'
import type { TimelineClip, LayoutClip } from './renderer'

export type ExportTechnique = 
  | 'smart-compositor' // SMART: Optimized compositing technique
  | 'fast-mediarecorder' // PRO: Fastest, most accurate - Production ready
  | 'webcodecs-canvas'
  | 'ffmpeg-frames'
  | 'mediarecorder-canvas'
  | 'canvas-capture-ffmpeg'
  | 'canvas-capture-mediarecorder'
  | 'webcodecs-accelerated' // Hardware-accelerated WebCodecs
  | 'offscreencanvas-webcodecs' // OffscreenCanvas with WebCodecs
  | 'mediarecorder-optimized' // Optimized MediaRecorder

export interface ExportOptions {
  // Export settings
  width?: number
  height?: number
  fps?: number
  bitrate?: number
  format?: 'mp4' | 'webm'
  codec?: 'avc1' | 'vp8' | 'vp9'
  
  // Technique selection
  technique?: ExportTechnique | 'auto' // 'auto' will try all techniques
  
  // Progress callback
  onProgress?: (progress: {
    progress: number // 0-1
    message: string
    technique?: ExportTechnique
    error?: string
    timeRemaining?: number // Estimated seconds remaining
    elapsedTime?: number // Elapsed seconds
  }) => void
  
  // Scene selection
  sceneIds?: string[]
}

export interface ExportResult {
  success: boolean
  blob?: Blob
  technique?: ExportTechnique
  error?: string
  duration?: number // Export duration in milliseconds
  log: string[]
}

/**
 * Helper to format time remaining
 */
function formatTimeRemaining(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${mins}m ${secs}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${mins}m`
  }
}

/**
 * Helper to calculate time remaining from progress
 */
function calculateTimeRemaining(
  progress: number,
  startTime: number,
  currentTime: number = Date.now()
): { timeRemaining: number; elapsedTime: number } {
  const elapsedTime = (currentTime - startTime) / 1000 // seconds
  if (progress <= 0) {
    return { timeRemaining: Infinity, elapsedTime }
  }
  const estimatedTotal = elapsedTime / progress
  const timeRemaining = Math.max(0, estimatedTotal - elapsedTime)
  return { timeRemaining, elapsedTime }
}

/**
 * Logger class for export operations
 */
class ExportLogger {
  private logs: string[] = []
  private startTime: number = 0

  start() {
    this.startTime = Date.now()
    this.log('=== Export Started ===')
  }

  log(message: string) {
    const timestamp = new Date().toISOString()
    const logEntry = `[${timestamp}] ${message}`
    this.logs.push(logEntry)
    console.log(`[EXPORT] ${logEntry}`)
  }

  error(message: string, error?: any) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const logEntry = `ERROR: ${message} - ${errorMsg}`
    this.log(logEntry)
    if (error && error.stack) {
      this.log(`Stack: ${error.stack}`)
    }
  }

  warn(message: string) {
    this.log(`WARN: ${message}`)
  }

  finish(success: boolean) {
    const duration = Date.now() - this.startTime
    this.log(`=== Export ${success ? 'Completed' : 'Failed'} === (${duration}ms)`)
    return this.logs
  }

  getLogs(): string[] {
    return [...this.logs]
  }
}

/**
 * Main export function with multiple techniques
 */
export async function exportVideoMulti(
  renderState: RenderState,
  options: ExportOptions = {}
): Promise<ExportResult> {
  const logger = new ExportLogger()
  logger.start()

  const {
    width = 1920,
    height = 1080,
    fps = 30,
    bitrate = 5_000_000,
    format = 'mp4',
    codec = 'avc1',
    technique = 'auto',
    onProgress,
  } = options

  try {
    logger.log(`Export configuration: ${width}x${height} @ ${fps}fps, ${format}, ${codec}`)
    logger.log(`Selected technique: ${technique}`)

    // Track start time for time estimation
    const exportStartTime = Date.now()
    
    // Prepare progress callback with logging and time estimation
    const progressCallback = (progress: { progress: number; message: string; technique?: ExportTechnique; error?: string }) => {
      const { timeRemaining, elapsedTime } = calculateTimeRemaining(progress.progress, exportStartTime)
      const timeRemainingStr = timeRemaining !== Infinity ? formatTimeRemaining(timeRemaining) : 'calculating...'
      
      logger.log(`Progress [${(progress.progress * 100).toFixed(1)}%]: ${progress.message} (${timeRemainingStr} remaining)`)
      if (progress.error) {
        logger.error(progress.error)
      }
      onProgress?.({
        ...progress,
        timeRemaining,
        elapsedTime,
      })
    }

    let result: ExportResult

    if (technique === 'auto') {
      // Try all techniques in order until one succeeds
      result = await tryAllTechniques(renderState, {
        width,
        height,
        fps,
        bitrate,
        format,
        codec,
        onProgress: progressCallback,
      }, logger)
    } else {
      // Use specific technique
      result = await tryTechnique(technique, renderState, {
        width,
        height,
        fps,
        bitrate,
        format,
        codec,
        onProgress: progressCallback,
      }, logger)
    }

    logger.finish(result.success)
    result.log = logger.getLogs()

    return result
  } catch (error) {
    logger.error('Export failed with unhandled error', error)
    logger.finish(false)
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      log: logger.getLogs(),
    }
  }
}

/**
 * Try all techniques in order until one succeeds
 */
async function tryAllTechniques(
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: ExportLogger
): Promise<ExportResult> {
  const techniques: ExportTechnique[] = [
    'smart-compositor', // SMART: Optimized compositing
    'fast-mediarecorder', // PRO: Fastest, most accurate - Production ready
    'mediarecorder-optimized', // Fast - renders frames at correct timing
    'mediarecorder-canvas', // Also fast - proven to work
    'webcodecs-canvas', // Good quality with WebCodecs
    'webcodecs-accelerated', // Fast if hardware accelerated
    'offscreencanvas-webcodecs',
    'canvas-capture-mediarecorder',
    'canvas-capture-ffmpeg',
    'ffmpeg-frames', // Slowest - only as last resort
  ]

  for (const technique of techniques) {
    logger.log(`Trying technique: ${technique}`)
    const result = await tryTechnique(technique, renderState, options, logger)
    
    if (result.success) {
      logger.log(`✓ Technique ${technique} succeeded!`)
      return result
    } else {
      logger.warn(`✗ Technique ${technique} failed: ${result.error}`)
    }
  }

  return {
    success: false,
    error: 'All export techniques failed. Check logs for details.',
    log: logger.getLogs(),
  }
}

/**
 * Try a specific export technique
 */
async function tryTechnique(
  technique: ExportTechnique,
  renderState: RenderState,
  options: Omit<ExportOptions, 'technique'>,
  logger: ExportLogger
): Promise<ExportResult> {
  const startTime = Date.now()

  try {
    const exportFn = await loadTechnique(technique)
    return await exportFn(renderState, options, logger)
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error(`Technique ${technique} failed after ${duration}ms`, error)
    return {
      success: false,
      technique,
      error: error instanceof Error ? error.message : String(error),
      duration,
      log: logger.getLogs(),
    }
  }
}

// Technique implementations - imported dynamically to avoid circular dependencies
async function loadTechnique(technique: ExportTechnique) {
  switch (technique) {
    case 'webcodecs-canvas':
      const webcodecs = await import('./exportTechniques/webcodecsCanvas')
      return webcodecs.exportWebCodecsCanvas
    case 'ffmpeg-frames':
      const ffmpegFrames = await import('./exportTechniques/ffmpegFrames')
      return ffmpegFrames.exportFFmpegFrames
    case 'mediarecorder-canvas':
      const mediarecorder = await import('./exportTechniques/mediarecorderCanvas')
      return mediarecorder.exportMediaRecorderCanvas
    case 'canvas-capture-ffmpeg':
      const canvasFFmpeg = await import('./exportTechniques/canvasCaptureFFmpeg')
      return canvasFFmpeg.exportCanvasCaptureFFmpeg
    case 'canvas-capture-mediarecorder':
      const canvasMR = await import('./exportTechniques/canvasCaptureMediaRecorder')
      return canvasMR.exportCanvasCaptureMediaRecorder
    case 'webcodecs-accelerated':
      const webcodecsAccel = await import('./exportTechniques/webcodecsAccelerated')
      return webcodecsAccel.exportWebCodecsAccelerated
    case 'offscreencanvas-webcodecs':
      const offscreenWC = await import('./exportTechniques/offscreenCanvasWebCodecs')
      return offscreenWC.exportOffscreenCanvasWebCodecs
    case 'mediarecorder-optimized':
      const mrOptimized = await import('./exportTechniques/mediarecorderOptimized')
      return mrOptimized.exportMediaRecorderOptimized
    case 'fast-mediarecorder':
      const fastMR = await import('./exportTechniques/fastMediaRecorder')
      return fastMR.exportFastMediaRecorder
    case 'smart-compositor':
      const smartComp = await import('./exportTechniques/smartCompositor')
      return smartComp.exportSmartCompositor
    default:
      throw new Error(`Unknown technique: ${technique}`)
  }
}

/**
 * Helper to check if a technique is available
 */
export function isTechniqueAvailable(technique: ExportTechnique): boolean {
  switch (technique) {
    case 'smart-compositor':
      return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    
    case 'fast-mediarecorder':
      return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    
    case 'webcodecs-accelerated':
      return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
    
    case 'offscreencanvas-webcodecs':
      return typeof OffscreenCanvas !== 'undefined' && typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
    
    case 'mediarecorder-optimized':
      return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    
    case 'webcodecs-canvas':
      return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
    
    case 'mediarecorder-canvas':
      return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    
    case 'canvas-capture-mediarecorder':
      return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function'
    
    case 'ffmpeg-frames':
    case 'canvas-capture-ffmpeg':
      return true // FFmpeg is always available (it's loaded dynamically)
    
    default:
      return false
  }
}

