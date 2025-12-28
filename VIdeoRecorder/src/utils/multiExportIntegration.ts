/**
 * Integration helper for using multi-export in EditStep
 * Provides a drop-in replacement for existing export functions
 */

import { exportVideoMulti, isTechniqueAvailable, type ExportTechnique } from './multiExport'
import { prepareRenderState } from './offlineExport'
import type { Scene } from '../App'
import type { TimelineClip, LayoutClip } from './renderer'

/**
 * Export video using multi-technique system
 */
export async function exportWithMultiTechnique(
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
    technique?: ExportTechnique | 'auto'
    onProgress?: (message: string, percent: number, technique?: string, error?: string, timeRemaining?: number, elapsedTime?: number) => void
  }
): Promise<{ blob: Blob; technique: string; log: string[] }> {
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
  const result = await exportVideoMulti(renderState, {
    width: canvasSettings.resolution.width,
    height: canvasSettings.resolution.height,
    fps: options?.fps || 30,
    bitrate: options?.bitrate || 5_000_000,
    format: options?.format || 'mp4',
    codec: options?.codec || 'avc1',
    technique: options?.technique || 'auto',
    onProgress: options?.onProgress
      ? (progress) => {
          options.onProgress!(
            progress.message,
            progress.progress * 100,
            progress.technique,
            progress.error,
            progress.timeRemaining,
            progress.elapsedTime
          )
        }
      : undefined,
  })

  if (!result.success) {
    throw new Error(result.error || 'Export failed')
  }

  if (!result.blob) {
    throw new Error('Export completed but no blob was generated')
  }

  return {
    blob: result.blob,
    technique: result.technique || 'unknown',
    log: result.log || [],
  }
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

/**
 * Get available techniques
 */
export function getAvailableTechniques(): ExportTechnique[] {
  const allTechniques: ExportTechnique[] = [
    'smart-compositor', // SMART: Optimized compositing
    'fast-mediarecorder', // PRO: Fastest, most accurate - Production ready
    'webcodecs-accelerated',
    'offscreencanvas-webcodecs',
    'mediarecorder-optimized',
    'webcodecs-canvas',
    'ffmpeg-frames',
    'mediarecorder-canvas',
    'canvas-capture-ffmpeg',
    'canvas-capture-mediarecorder',
  ]

  return allTechniques.filter(technique => isTechniqueAvailable(technique))
}

