/**
 * Integration helper for fast video export in EditStep
 * Uses MediaRecorder API for fast, accurate, production-ready exports
 */

import { exportVideoFast } from './fastExport'
import { exportVideoGPU, isGPUSupported } from './gpuExport'
import { prepareRenderState } from './offlineExport'
import type { Scene } from '../App'
import type { TimelineClip, LayoutClip } from './renderer'

/**
 * Check if MediaRecorder is available
 */
export function isExportAvailable(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream !== 'undefined'
}

/**
 * Export video using fast MediaRecorder pipeline
 * Records canvas directly - fast, accurate, production-ready
 */
export async function exportWithOfflinePipeline(
  // Data from EditStep
  scenes: Scene[],
  timelineClips: TimelineClip[],
  layoutClips: LayoutClip[],
  canvasSettings: {
    format: string
    resolution: { width: number; height: number }
    videoBackgroundColor: string
  },
  layout: {
    type: string
    cameraPosition?: { x: number; y: number; width: number; height: number; rotation?: number }
    screenPosition?: { x: number; y: number; width: number; height: number; rotation?: number }
  },
  // Optional settings
  captionSettings?: {
    style: any
    font: string
    size: number
    lineHeight: number
    maxWords: number
    enabled: boolean
  },
  titleSettings?: {
    text: string
    x: number
    y: number
    textAlign?: 'left' | 'center' | 'right'
    font?: string
    fontSize?: number
    lineHeight?: number
    animationIn?: string
    animationOut?: string
    animationDuration?: number
    timelineStart?: number
    timelineEnd?: number
  },
  backgroundImageData?: {
    url: string
    x: number
    y: number
    width: number
    height: number
  },
  transcripts?: Map<string, { words: Array<{ word: string; start: number; end: number }> }>,
  clipProperties?: Map<string, {
    brightness: number
    contrast: number
    saturation: number
    exposure: number
    highlights: number
    midtones: number
    shadows: number
  }>,
  // Export options
  options?: {
    fps?: number
    bitrate?: number
    format?: 'mp4' | 'webm'
    codec?: 'avc1' | 'vp8' | 'vp9'
    onProgress?: (message: string, percent: number) => void
  }
): Promise<Blob> {
  // Check MediaRecorder support
  if (!isExportAvailable()) {
    throw new Error(
      'MediaRecorder API is not available. Please use a modern browser (Chrome 47+, Firefox 25+, Safari 14.1+).'
    )
  }

  // Prepare render state
  const renderState = prepareRenderState(
    scenes,
    timelineClips,
    layoutClips,
    canvasSettings,
    layout,
    captionSettings,
    titleSettings,
    backgroundImageData,
    transcripts,
    clipProperties
  )

  // Determine quality from bitrate if provided
  let quality: 'low' | 'medium' | 'high' | number = 'high'
  if (options?.bitrate) {
    if (options.bitrate < 2_000_000) {
      quality = 'low'
    } else if (options.bitrate < 8_000_000) {
      quality = 'medium'
    } else {
      quality = 'high'
    }
  }

  // Export with progress
  const result = await exportVideoFast(renderState, {
    width: canvasSettings.resolution.width,
    height: canvasSettings.resolution.height,
    fps: options?.fps || 30,
    format: options?.format || 'webm',
    quality,
    onProgress: options?.onProgress
      ? (progress) => {
          try {
            options.onProgress!(progress.message, progress.percent)
          } catch (error) {
            console.warn('Error in progress callback:', error)
          }
        }
      : undefined,
  })

  if (!result.success) {
    throw new Error(result.error || 'Export failed')
  }

  if (!result.blob || result.blob.size === 0) {
    throw new Error('Export produced an empty blob')
  }

  return result.blob
}

/**
 * Export video using GPU-accelerated rendering
 * This is a drop-in replacement for the fast export, using WebGL for GPU acceleration
 */
export async function exportWithGPUPipeline(
  // Data from EditStep
  scenes: Scene[],
  timelineClips: TimelineClip[],
  layoutClips: LayoutClip[],
  canvasSettings: {
    format: string
    resolution: { width: number; height: number }
    videoBackgroundColor: string
  },
  layout: {
    type: string
    cameraPosition?: { x: number; y: number; width: number; height: number; rotation?: number }
    screenPosition?: { x: number; y: number; width: number; height: number; rotation?: number }
  },
  // Optional settings
  captionSettings?: {
    style: any
    font: string
    size: number
    lineHeight: number
    maxWords: number
    enabled: boolean
  },
  titleSettings?: {
    text: string
    x: number
    y: number
    textAlign?: 'left' | 'center' | 'right'
    font?: string
    fontSize?: number
    lineHeight?: number
    animationIn?: string
    animationOut?: string
    animationDuration?: number
    timelineStart?: number
    timelineEnd?: number
  },
  backgroundImageData?: {
    url: string
    x: number
    y: number
    width: number
    height: number
  },
  transcripts?: Map<string, { words: Array<{ word: string; start: number; end: number }> }>,
  clipProperties?: Map<string, {
    brightness: number
    contrast: number
    saturation: number
    exposure: number
    highlights: number
    midtones: number
    shadows: number
  }>,
  // Export options
  options?: {
    fps?: number
    bitrate?: number
    format?: 'mp4' | 'webm'
    codec?: 'avc1' | 'vp8' | 'vp9'
    onProgress?: (message: string, percent: number) => void
  }
): Promise<Blob> {
  // Check GPU support
  if (!isGPUSupported()) {
    throw new Error(
      'GPU acceleration not available. WebGL is required. Falling back to CPU rendering is not supported in GPU export mode.'
    )
  }

  // Check MediaRecorder support
  if (!isExportAvailable()) {
    throw new Error(
      'MediaRecorder API is not available. Please use a modern browser (Chrome 47+, Firefox 25+, Safari 14.1+).'
    )
  }

  // Prepare render state
  const renderState = prepareRenderState(
    scenes,
    timelineClips,
    layoutClips,
    canvasSettings,
    layout,
    captionSettings,
    titleSettings,
    backgroundImageData,
    transcripts,
    clipProperties
  )

  // Determine quality from bitrate if provided
  let quality: 'low' | 'medium' | 'high' | number = 'high'
  if (options?.bitrate) {
    if (options.bitrate < 2_000_000) {
      quality = 'low'
    } else if (options.bitrate < 8_000_000) {
      quality = 'medium'
    } else {
      quality = 'high'
    }
  }

  // Export with GPU acceleration
  const result = await exportVideoGPU(renderState, {
    width: canvasSettings.resolution.width,
    height: canvasSettings.resolution.height,
    fps: options?.fps || 30,
    format: options?.format || 'webm',
    quality,
    onProgress: options?.onProgress
      ? (progress) => {
          try {
            options.onProgress!(progress.message, progress.percent)
          } catch (error) {
            console.warn('Error in progress callback:', error)
          }
        }
      : undefined,
  })

  if (!result.success) {
    throw new Error(result.error || 'Export failed')
  }

  if (!result.blob || result.blob.size === 0) {
    throw new Error('Export produced an empty blob')
  }

  return result.blob
}

/**
 * Helper to download the exported blob
 */
export function downloadExportedVideo(blob: Blob, filename: string = 'export.mp4'): void {
  try {
    if (!blob || blob.size === 0) {
      throw new Error('Cannot download empty blob')
    }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    
    // Clean up after a short delay to ensure download starts
    setTimeout(() => {
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }, 100)
  } catch (error) {
    console.error('Error downloading video:', error)
    throw new Error(
      `Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

