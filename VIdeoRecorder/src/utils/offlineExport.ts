/**
 * Main export function for offline video rendering
 * Integrates renderer, encoder, and muxer
 */

import { exportVideo, type ExportConfig, type ExportProgress } from './exportWorker'
import type { RenderState } from './renderer'
import type { Scene } from '../App'
import type { TimelineClip, LayoutClip, CanvasVideoHolder } from './renderer'
import { projectManager } from './projectManager'

export interface OfflineExportOptions {
  // Export settings
  width?: number
  height?: number
  fps?: number
  bitrate?: number
  format?: 'mp4' | 'webm'
  codec?: 'avc1' | 'vp8' | 'vp9'
  
  // Progress callback
  onProgress?: (progress: ExportProgress) => void
  
  // Scene selection
  sceneIds?: string[]
}

/**
 * Export video using offline rendering pipeline
 */
export async function exportOfflineVideo(
  renderState: RenderState,
  options: OfflineExportOptions = {}
): Promise<Blob> {
  const {
    width = 1920,
    height = 1080,
    fps = 30,
    bitrate = 5_000_000, // 5 Mbps
    format = 'mp4',
    codec = 'avc1',
    onProgress,
  } = options

  // Calculate total duration from timeline clips
  const totalDuration = renderState.timelineClips.reduce((max, clip) => {
    return Math.max(max, clip.timelineEnd)
  }, 0)

  if (totalDuration <= 0) {
    throw new Error('No video content to export')
  }

  // Ensure layoutClips have holders - create default layout clips if needed
  let finalRenderState = renderState
  if (!renderState.layoutClips || renderState.layoutClips.length === 0 || renderState.layoutClips.every(lc => !lc.holders || lc.holders.length === 0)) {
    console.warn('No layout clips with holders found, creating default layout clips from timeline clips')
    
    // Get video clips (camera and screen only, not microphone)
    const videoClips = renderState.timelineClips.filter(clip => clip.layer === 'camera' || clip.layer === 'screen')
    
    if (videoClips.length === 0) {
      throw new Error('No video clips found to export')
    }
    
    // Create a default layout clip covering the entire timeline
    // For single clip: fullscreen
    // For multiple clips: stack them (first clip fullscreen, others behind)
    const defaultLayoutClip: LayoutClip = {
      id: 'default_layout',
      timelineStart: 0,
      timelineEnd: totalDuration,
      holders: videoClips.map((clip, index) => {
        // Always use fullscreen for default layout (x=0, y=0, width=1, height=1)
        // Multiple clips will stack (later clips on top due to zIndex)
        return {
          id: `holder_${clip.id}`,
          clipId: clip.id,
          layer: clip.layer,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          rotation: 0,
          zIndex: index, // Stack clips by order
          borderRadius: 0,
        }
      }),
    }
    
    // Update render state with default layout clips
    finalRenderState = {
      ...renderState,
      layoutClips: [defaultLayoutClip],
    }
  }

  // Collect all video blobs needed
  const videoBlobs = new Map<string, Blob>()
  const sceneTakes = new Map<string, { sceneId: string; takeId: string }>()

  for (const clip of finalRenderState.timelineClips) {
    const key = `${clip.sceneId}_${clip.takeId}`
    if (!sceneTakes.has(key)) {
      sceneTakes.set(key, { sceneId: clip.sceneId, takeId: clip.takeId })
    }
  }

  // Load video blobs from project
  for (const { sceneId, takeId } of sceneTakes.values()) {
    // Try to load camera, screen, and microphone
    const layers = ['camera', 'screen', 'microphone'] as const
    for (const layer of layers) {
      const videoKey = `${sceneId}_${takeId}_${layer}`
      try {
        const blob = await projectManager.loadRecording(sceneId, `${takeId}_${layer}`)
        if (blob) {
          videoBlobs.set(videoKey, blob)
        }
      } catch (error) {
        // Layer might not exist, continue
        console.debug(`Video layer ${videoKey} not found, skipping`)
      }
    }
  }

  // Collect image URLs
  const imageUrls = new Map<string, string>()
  if (finalRenderState.backgroundImageData) {
    imageUrls.set('background', finalRenderState.backgroundImageData.url)
  }

  // Collect fonts
  const fonts: string[] = []
  if (finalRenderState.captionSettings?.font) {
    fonts.push(finalRenderState.captionSettings.font)
  }
  if (finalRenderState.titleSettings?.font) {
    fonts.push(finalRenderState.titleSettings.font)
  }

  // Create export config with final render state
  const exportConfig: ExportConfig = {
    width,
    height,
    fps,
    duration: totalDuration,
    dpr: 1.0, // Fixed DPR for export
    bitrate,
    keyframeInterval: Math.floor(fps * 2), // Keyframe every 2 seconds
    codec,
    format,
    renderState: finalRenderState, // Use final render state with layout clips
    videoBlobs,
    imageUrls,
    fonts,
  }

  // Run export
  const result = await exportVideo(exportConfig, onProgress)

  if (!result.success) {
    throw new Error(result.error || 'Export failed')
  }

  if (!result.blob) {
    throw new Error('Export completed but no blob was generated')
  }

  return result.blob
}

/**
 * Prepare render state from EditStep data
 */
export function prepareRenderState(
  scenes: Scene[],
  timelineClips: TimelineClip[],
  layoutClips: LayoutClip[],
  canvasSettings: any,
  layout: any,
  captionSettings?: any,
  titleSettings?: any,
  backgroundImageData?: any,
  transcripts?: Map<string, any>,
  clipProperties?: Map<string, any>
): RenderState {
  return {
    scenes,
    timelineClips,
    layoutClips,
    canvasSettings: {
      format: canvasSettings.format || '16:9',
      resolution: {
        width: canvasSettings.resolution?.width || 1920,
        height: canvasSettings.resolution?.height || 1080,
      },
      videoBackgroundColor: canvasSettings.videoBackgroundColor || '#000000',
      transitionDuration: canvasSettings.transitionDuration ?? 0,
    },
    layout: {
      type: layout.type || 'custom',
      cameraPosition: layout.cameraPosition,
      screenPosition: layout.screenPosition,
    },
    captionSettings: captionSettings ? {
      style: captionSettings.style,
      font: captionSettings.font,
      size: captionSettings.size,
      lineHeight: captionSettings.lineHeight,
      maxWords: captionSettings.maxWords,
      enabled: captionSettings.enabled !== false,
    } : undefined,
    titleSettings: titleSettings ? {
      text: titleSettings.text,
      x: titleSettings.x,
      y: titleSettings.y,
      textAlign: titleSettings.textAlign,
      font: titleSettings.font,
      fontSize: titleSettings.fontSize,
      lineHeight: titleSettings.lineHeight,
      animationIn: titleSettings.animationIn,
      animationOut: titleSettings.animationOut,
      animationDuration: titleSettings.animationDuration,
      timelineStart: titleSettings.timelineStart,
      timelineEnd: titleSettings.timelineEnd,
    } : undefined,
    backgroundImageData,
    transcripts,
    clipProperties,
  }
}

