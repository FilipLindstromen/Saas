/**
 * Integration helper for using offline export in EditStep
 * Provides a drop-in replacement for the FFmpeg-based export
 */

import { exportOfflineVideo, prepareRenderState } from './offlineExport'
import type { Scene } from '../App'
import type { TimelineClip, LayoutClip } from './renderer'

/**
 * Check if WebCodecs is available
 */
export function isWebCodecsAvailable(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

/**
 * Export video using the new offline pipeline
 * This is a drop-in replacement for the FFmpeg export
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
  // Check WebCodecs support
  if (!isWebCodecsAvailable()) {
    throw new Error(
      'WebCodecs API is not available. Please use a Chromium-based browser (Chrome 94+, Edge 94+).'
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

  try {
    // Export with progress
    const blob = await exportOfflineVideo(renderState, {
      width: canvasSettings.resolution.width,
      height: canvasSettings.resolution.height,
      fps: options?.fps || 30,
      bitrate: options?.bitrate || 5_000_000, // 5 Mbps default
      format: options?.format || 'mp4',
      codec: options?.codec || 'avc1',
      onProgress: options?.onProgress
        ? (progress) => {
            try {
              options.onProgress!(progress.message, progress.progress * 100)
            } catch (error) {
              console.warn('Error in progress callback:', error)
            }
          }
        : undefined,
    })

    if (!blob || blob.size === 0) {
      throw new Error('Export produced an empty blob')
    }

    return blob
  } catch (error) {
    console.error('Export error:', error)
    throw new Error(
      `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
      'Please check that all video sources are valid and try again.'
    )
  }
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

