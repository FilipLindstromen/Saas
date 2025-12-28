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
    transcripts
  )

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
          options.onProgress!(progress.message, progress.progress * 100)
        }
      : undefined,
  })

  return blob
}

/**
 * Helper to download the exported blob
 */
export function downloadExportedVideo(blob: Blob, filename: string = 'export.mp4'): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

