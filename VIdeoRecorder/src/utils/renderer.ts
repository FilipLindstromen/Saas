/**
 * Shared renderer for both preview and export
 * Ensures WYSIWYG: What You See Is What You Export
 */

import type { Scene } from '../App'

// Define types locally to avoid circular dependencies
export interface TimelineClip {
  id: string
  sceneId: string
  takeId: string
  layer: 'camera' | 'microphone' | 'screen'
  timelineStart: number // Start position on timeline (in seconds)
  timelineEnd: number // End position on timeline (in seconds)
  sourceIn: number // Start time in source media (in seconds)
  sourceOut: number // End time in source media (in seconds)
  sourceDuration: number // Full duration of source media
}

export interface CanvasVideoHolder {
  id: string
  clipId: string // Reference to timeline clip
  layer: 'camera' | 'microphone' | 'screen'
  x: number // 0-1 normalized
  y: number // 0-1 normalized
  width: number // 0-1 normalized
  height: number // 0-1 normalized
  rotation: number // Degrees
  zIndex: number
  borderRadius?: number // Rounded corners in pixels (max 600px)
}

export interface LayoutClip {
  id: string
  timelineStart: number // Start position on timeline (in seconds)
  timelineEnd: number // End position on timeline (in seconds)
  holders: CanvasVideoHolder[]
}

export interface RenderContext {
  // Canvas to render to (must be at export resolution)
  canvas: HTMLCanvasElement | OffscreenCanvas
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
  
  // Time in seconds (timeline time, not video time)
  time: number
  
  // Canvas dimensions (export resolution)
  width: number
  height: number
  
  // Device pixel ratio (fixed for export, typically 1.0)
  dpr: number
  
  // Video elements (preloaded and ready)
  videoElements: Map<string, HTMLVideoElement>
  
  // Audio context (if needed for audio analysis)
  audioContext?: AudioContext
}

export interface RenderState {
  // Project data
  scenes: Scene[]
  timelineClips: TimelineClip[]
  layoutClips: LayoutClip[]
  
  // Canvas settings
  canvasSettings: {
    format: string
    resolution: { width: number; height: number }
    videoBackgroundColor: string
    transitionDuration?: number // Transition duration in seconds
  }
  
  // Layout settings
  layout: {
    type: string
    cameraPosition?: { x: number; y: number; width: number; height: number; rotation?: number }
    screenPosition?: { x: number; y: number; width: number; height: number; rotation?: number }
  }
  
  // Caption settings
  captionSettings?: {
    style: any
    font: string
    size: number
    lineHeight: number
    maxWords: number
    enabled: boolean
  }
  
  // Title settings
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
  }
  
  // Background image
  backgroundImageData?: {
    url: string
    x: number
    y: number
    width: number
    height: number
    scale?: number
    flipHorizontal?: boolean
    alpha?: number
  }
  
  // Transcripts for captions
  transcripts?: Map<string, { words: Array<{ word: string; start: number; end: number }> }>
  
  // Clip properties (for video filters)
  clipProperties?: Map<string, {
    brightness: number
    contrast: number
    saturation: number
    exposure: number
    highlights: number
    midtones: number
    shadows: number
  }>
}

/**
 * Convert timeline time to video time and scene info
 */
export function timelineToVideoTime(
  timelineTime: number,
  timelineClips: TimelineClip[]
): { videoTime: number; sceneId: string; takeId: string; clip: TimelineClip } | null {
  // Find clip that contains this timeline time
  const clip = timelineClips.find(
    c => timelineTime >= c.timelineStart && timelineTime < c.timelineEnd
  )
  
  if (!clip) {
    return null
  }
  
  // Calculate relative time within the clip
  const relativeTime = timelineTime - clip.timelineStart
  const clipDuration = clip.timelineEnd - clip.timelineStart
  const sourceDuration = clip.sourceOut - clip.sourceIn
  
  // Map timeline time to source video time
  const sourceTime = clip.sourceIn + (relativeTime / clipDuration) * sourceDuration
  
  return {
    videoTime: sourceTime,
    sceneId: clip.sceneId,
    takeId: clip.takeId,
    clip
  }
}

/**
 * Get visible words at a specific timeline time
 */
export function getVisibleWords(
  timelineTime: number,
  sceneId: string,
  sceneStartTime: number,
  transcripts?: Map<string, { words: Array<{ word: string; start: number; end: number }> }>
): Array<{ word: string; start: number; end: number }> {
  if (!transcripts) return []
  
  const transcript = transcripts.get(sceneId)
  if (!transcript) return []
  
  const sceneRelativeTime = timelineTime - sceneStartTime
  return transcript.words.filter(w => {
    const wordStart = w.start - sceneStartTime
    const wordEnd = w.end - sceneStartTime
    return sceneRelativeTime >= wordStart && sceneRelativeTime <= wordEnd
  })
}

/**
 * Apply video filters (brightness, contrast, saturation, exposure, highlights, midtones, shadows)
 * to image data, matching the preview behavior exactly
 */
function applyVideoFilters(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number,
  exposure: number,
  highlights: number,
  midtones: number,
  shadows: number
): ImageData {
  const data = imageData.data
  const brightnessValue = 1 + (brightness + exposure) / 100
  const contrastValue = 1 + contrast / 100
  
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i]
    let g = data[i + 1]
    let b = data[i + 2]
    
    // Calculate luminance for tone mapping
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    let adjustment = 0
    if (luminance > 200) {
      adjustment = highlights / 100
    } else if (luminance > 100) {
      adjustment = midtones / 100
    } else {
      adjustment = shadows / 100
    }
    
    // Apply brightness/exposure with tone mapping
    r = Math.max(0, Math.min(255, r * brightnessValue * (1 + adjustment)))
    g = Math.max(0, Math.min(255, g * brightnessValue * (1 + adjustment)))
    b = Math.max(0, Math.min(255, b * brightnessValue * (1 + adjustment)))
    
    // Apply contrast
    r = Math.max(0, Math.min(255, (r - 128) * contrastValue + 128))
    g = Math.max(0, Math.min(255, (g - 128) * contrastValue + 128))
    b = Math.max(0, Math.min(255, (b - 128) * contrastValue + 128))
    
    // Apply saturation
    if (saturation !== 0) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      const satValue = 1 + saturation / 100
      r = Math.max(0, Math.min(255, gray + (r - gray) * satValue))
      g = Math.max(0, Math.min(255, gray + (g - gray) * satValue))
      b = Math.max(0, Math.min(255, gray + (b - gray) * satValue))
    }
    
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
  
  return imageData
}

/**
 * Calculate transition state for a clip at a given time
 * Returns the interpolated border radius if a transition is active
 */
function getTransitionBorderRadius(
  time: number,
  clipId: string,
  layer: 'camera' | 'screen',
  layoutClips: LayoutClip[],
  transitionDuration: number
): number | null {
  if (transitionDuration <= 0) return null
  
  // Find current and previous layout clips
  const currentLayoutClip = layoutClips.find(
    lc => time >= lc.timelineStart && time < lc.timelineEnd
  )
  
  const smallOffset = 0.001
  const previousTime = Math.max(0, time - smallOffset)
  const previousLayoutClip = layoutClips.find(
    lc => previousTime >= lc.timelineStart && previousTime < lc.timelineEnd
  )
  
  // Check if we're transitioning
  const currentLayoutClipId = currentLayoutClip?.id || null
  const previousLayoutClipId = previousLayoutClip?.id || null
  
  if (currentLayoutClipId === previousLayoutClipId) {
    // No transition, return null
    return null
  }
  
  // Determine transition boundary time
  let transitionBoundaryTime: number
  if (currentLayoutClip) {
    transitionBoundaryTime = currentLayoutClip.timelineStart
  } else if (previousLayoutClip) {
    transitionBoundaryTime = previousLayoutClip.timelineEnd
  } else {
    return null
  }
  
  const timeSinceBoundary = time - transitionBoundaryTime
  
  // Check if we're within transition window
  if (timeSinceBoundary < 0 || timeSinceBoundary >= transitionDuration) {
    return null
  }
  
  // Calculate transition progress
  const progress = Math.min(1, Math.max(0, timeSinceBoundary / transitionDuration))
  
  // Ease-in-out cubic function for smooth animation
  const easeInOut = (t: number): number => {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2
  }
  
  const eased = easeInOut(progress)
  
  // Determine start and end border radius
  let startBorderRadius = 0
  let endBorderRadius = 0
  
  // Case 1: Transitioning from layout clip to empty space (no layout clip)
  if (previousLayoutClip && !currentLayoutClip) {
    const prevHolder = previousLayoutClip.holders.find(
      h => h.clipId === clipId && h.layer === layer
    )
    if (prevHolder) {
      startBorderRadius = prevHolder.borderRadius ?? 0
      endBorderRadius = 0 // Empty space has no rounded corners
    } else {
      return null
    }
  }
  // Case 2: Transitioning from empty space to layout clip
  else if (!previousLayoutClip && currentLayoutClip) {
    const newHolder = currentLayoutClip.holders.find(
      h => h.clipId === clipId && h.layer === layer
    )
    if (newHolder) {
      startBorderRadius = 0 // Empty space has no rounded corners
      endBorderRadius = newHolder.borderRadius ?? 0
    } else {
      return null
    }
  }
  // Case 3: Transitioning between two layout clips
  else if (previousLayoutClip && currentLayoutClip) {
    const prevHolder = previousLayoutClip.holders.find(
      h => h.clipId === clipId && h.layer === layer
    )
    const newHolder = currentLayoutClip.holders.find(
      h => h.clipId === clipId && h.layer === layer
    )
    
    if (prevHolder && newHolder) {
      startBorderRadius = prevHolder.borderRadius ?? 0
      endBorderRadius = newHolder.borderRadius ?? 0
    } else if (prevHolder && !newHolder) {
      // Holder exists in previous but not in new - transition to empty space
      startBorderRadius = prevHolder.borderRadius ?? 0
      endBorderRadius = 0
    } else if (!prevHolder && newHolder) {
      // Holder appears in new clip - transition from empty space
      startBorderRadius = 0
      endBorderRadius = newHolder.borderRadius ?? 0
    } else {
      return null
    }
  } else {
    return null
  }
  
  // Interpolate border radius
  return startBorderRadius + (endBorderRadius - startBorderRadius) * eased
}

/**
 * Render a single frame at time t
 * This is the core rendering function used by both preview and export
 * @param isExport - If true, skips expensive async waits for faster export rendering
 */
export async function renderFrame(
  context: RenderContext,
  state: RenderState,
  isExport: boolean = false
): Promise<void> {
  const { canvas, ctx, time, width, height } = context
  const { timelineClips, layoutClips, canvasSettings, layout } = state
  
  // Clear canvas with background color - use save/restore to prevent flickering
  // Reset transform to ensure clean clear
  ctx.save()
  ctx.setTransform(1, 0, 0, 1, 0, 0) // Reset transform to identity
  ctx.fillStyle = canvasSettings.videoBackgroundColor || '#000000'
  ctx.fillRect(0, 0, width, height)
  ctx.restore()
  
  // Ensure canvas is ready for drawing (prevent flickering from partial renders)
  if (isExport) {
    // For export, ensure we have a clean slate
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
  }
  
  // Find layout clip that contains this timeline time
  const layoutClip = layoutClips.find(
    lc => time >= lc.timelineStart && time < lc.timelineEnd
  )
  
  // Render background image FIRST (behind everything) - only if layout clip is active
  if (layoutClip && state.backgroundImageData && layoutClip.backgroundImage?.enabled && layoutClip.backgroundImage?.url) {
    const bgImg = await loadImage(state.backgroundImageData.url)
    if (bgImg) {
      // Calculate dimensions to fill canvas while maintaining aspect ratio (object-cover behavior)
      const canvasAspect = width / height
      const imgAspect = bgImg.width / bgImg.height
      
      let drawWidth = width
      let drawHeight = height
      let drawX = 0
      let drawY = 0
      
      if (imgAspect > canvasAspect) {
        // Image is wider than canvas - fit to height, crop width (object-cover behavior)
        drawHeight = height
        drawWidth = bgImg.width * (height / bgImg.height)
        drawX = (width - drawWidth) / 2
      } else {
        // Image is taller than canvas - fit to width, crop height (object-cover behavior)
        drawWidth = width
        drawHeight = bgImg.height * (width / bgImg.width)
        drawY = (height - drawHeight) / 2
      }
      
      // Apply panning offset (normalized 0-1 values)
      const offsetX = (state.backgroundImageData.x ?? 0) * width
      const offsetY = (state.backgroundImageData.y ?? 0) * height
      
      // Apply the pan offset to the centered position
      drawX += offsetX
      drawY += offsetY
      
      // Apply scale factor (0.1 to 3.0)
      const scale = state.backgroundImageData.scale ?? 1
      const centerX = drawX + drawWidth / 2
      const centerY = drawY + drawHeight / 2
      drawWidth *= scale
      drawHeight *= scale
      // Re-center after scaling
      drawX = centerX - drawWidth / 2
      drawY = centerY - drawHeight / 2
      
      // Apply horizontal flip if needed
      ctx.save()
      if (state.backgroundImageData.flipHorizontal) {
        ctx.translate(width, 0)
        ctx.scale(-1, 1)
        drawX = width - drawX - drawWidth
      }
      
      // Apply alpha/opacity
      ctx.globalAlpha = state.backgroundImageData.alpha ?? 1
      ctx.drawImage(bgImg, drawX, drawY, drawWidth, drawHeight)
      ctx.restore()
    }
  }
  
  // Find which clip is active at this time
  const timelineResult = timelineToVideoTime(time, timelineClips)
  
  // If we're in a gap, just show background (already drawn above)
  if (!timelineResult || !timelineResult.clip) {
    return
  }
  
  const { videoTime, sceneId, takeId, clip } = timelineResult
  
  // If no layout clip, render video full screen (matches preview behavior)
  if (!layoutClip || !layoutClip.holders || layoutClip.holders.length === 0) {
    // Find active video clips at this time (camera or screen)
    const activeClips = timelineClips.filter(
      c => time >= c.timelineStart && time < c.timelineEnd && (c.layer === 'camera' || c.layer === 'screen')
    )
    
    // Render each active clip full screen
    for (const activeClip of activeClips) {
      const videoKey = `${activeClip.sceneId}_${activeClip.takeId}_${activeClip.layer}`
      const video = context.videoElements.get(videoKey)
      
      if (!video) {
        continue
      }
      
      // For export, skip readyState check - videos are already loaded and ready
      // This saves ~50ms per frame
      if (!isExport && video.readyState < 2) {
        // Only wait briefly if video is truly not ready (preview only)
        await new Promise(resolve => setTimeout(resolve, 10))
        if (video.readyState < 2) {
          continue
        }
      }
      
      // Skip video seeking if isExport is true - the export loop already handles seeking
      // This eliminates redundant seeks and saves significant time
      if (!isExport) {
        // Calculate video time
        const clipStartTime = activeClip.timelineStart
        const relativeTime = time - clipStartTime
        const clipDuration = activeClip.timelineEnd - activeClip.timelineStart
        const sourceDuration = activeClip.sourceOut - activeClip.sourceIn
        const targetVideoTime = activeClip.sourceIn + (relativeTime / clipDuration) * sourceDuration
        
        if (targetVideoTime < 0 || targetVideoTime >= video.duration) {
          continue
        }
        
        // Seek video to correct time - only if significantly off (optimize for sequential rendering)
        // For export, frames are sequential so we can be more lenient with seeks
        const timeDiff = Math.abs(video.currentTime - targetVideoTime)
        if (timeDiff > 0.1) { // Increased threshold for faster rendering
          video.currentTime = targetVideoTime
          // Only wait if we're way off
          if (timeDiff > 1.0) {
            await new Promise<void>((resolve) => {
              let resolved = false
              const timeout = setTimeout(() => {
                if (!resolved) {
                  resolved = true
                  resolve()
                }
              }, 500) // Shorter timeout for export
              
              const onSeeked = () => {
                if (!resolved) {
                  resolved = true
                  clearTimeout(timeout)
                  video.removeEventListener('seeked', onSeeked)
                  resolve()
                }
              }
              
              video.addEventListener('seeked', onSeeked, { once: true })
            })
          }
        }
        
        // Wait for video frame (preview only)
        if (video.readyState < 2) {
          await new Promise<void>((resolve) => {
            if (video.readyState >= 2) {
              resolve()
              return
            }
            
            const onCanPlay = () => {
              video.removeEventListener('canplay', onCanPlay)
              video.removeEventListener('canplaythrough', onCanPlayThrough)
              resolve()
            }
            
            const onCanPlayThrough = () => {
              video.removeEventListener('canplay', onCanPlay)
              video.removeEventListener('canplaythrough', onCanPlayThrough)
              resolve()
            }
            
            video.addEventListener('canplay', onCanPlay, { once: true })
            video.addEventListener('canplaythrough', onCanPlayThrough, { once: true })
            
            setTimeout(() => {
              video.removeEventListener('canplay', onCanPlay)
              video.removeEventListener('canplaythrough', onCanPlayThrough)
              resolve()
            }, 2000)
          })
        }
        
        // requestVideoFrameCallback is very slow - skip for export
        if ('requestVideoFrameCallback' in video) {
          await new Promise<void>((resolve) => {
            (video as any).requestVideoFrameCallback(() => {
              resolve()
            })
            setTimeout(() => resolve(), 500)
          })
        }
      }
      
      // Get transition border radius if transitioning
      const transitionDuration = canvasSettings.transitionDuration ?? 0
      const transitionBorderRadius = getTransitionBorderRadius(
        time,
        activeClip.id,
        activeClip.layer,
        layoutClips,
        transitionDuration
      )
      
      // Get clip properties for filters
      const clipKey = `${activeClip.sceneId}_${activeClip.takeId}_${activeClip.layer}`
      const props = state.clipProperties?.get(clipKey)
      const brightness = props?.brightness ?? 0
      const contrast = props?.contrast ?? 0
      const saturation = props?.saturation ?? 0
      const exposure = props?.exposure ?? 0
      const highlights = props?.highlights ?? 0
      const midtones = props?.midtones ?? 0
      const shadows = props?.shadows ?? 0
      
      // Render full screen with object-cover behavior (crop to fill, maintain aspect)
      ctx.save()
      
      const videoAspect = video.videoWidth / video.videoHeight
      const canvasAspect = width / height
      
      let drawWidth = width
      let drawHeight = height
      let drawX = 0
      let drawY = 0
      
      // Object-cover: scale to fill, crop excess
      if (canvasAspect > videoAspect) {
        // Canvas is wider - fit to height, crop width
        drawHeight = height
        drawWidth = drawHeight * videoAspect
        drawX = (width - drawWidth) / 2
      } else {
        // Canvas is taller - fit to width, crop height
        drawWidth = width
        drawHeight = drawWidth / videoAspect
        drawY = (height - drawHeight) / 2
      }
      
      // Apply border radius transition if active
      const borderRadius = transitionBorderRadius !== null ? transitionBorderRadius : 0
      const hasFilters = brightness !== 0 || contrast !== 0 || saturation !== 0 || exposure !== 0 || highlights !== 0 || midtones !== 0 || shadows !== 0
      
      if (borderRadius > 0 || hasFilters) {
        // Use temporary canvas for filters and/or rounded corners
        // Always use HTMLCanvasElement during export to avoid WebGL context limits
        // Temp canvas should match full canvas size to ensure correct object-cover behavior
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = Math.ceil(Math.abs(width))
        tempCanvas.height = Math.ceil(Math.abs(height))
        const tempCtx = tempCanvas.getContext('2d', {
          willReadFrequently: false,
          alpha: false,
        })
        
        if (tempCtx) {
          // Draw video to temp canvas with object-cover behavior (fill canvas, maintain aspect, crop excess)
          // This matches CSS object-cover exactly
          const tempVideoAspect = video.videoWidth / video.videoHeight
          const tempAspect = tempCanvas.width / tempCanvas.height
          
          let tempDrawW = tempCanvas.width
          let tempDrawH = tempCanvas.height
          let tempDrawX = 0
          let tempDrawY = 0
          
          if (tempAspect > tempVideoAspect) {
            // Temp canvas is wider than video - fit to height, crop width (center crop)
            tempDrawH = tempCanvas.height
            tempDrawW = tempDrawH * tempVideoAspect
            tempDrawX = (tempCanvas.width - tempDrawW) / 2
          } else {
            // Temp canvas is taller than video - fit to width, crop height (center crop)
            tempDrawW = tempCanvas.width
            tempDrawH = tempDrawW / tempVideoAspect
            tempDrawY = (tempCanvas.height - tempDrawH) / 2
          }
          
          tempCtx.drawImage(video, tempDrawX, tempDrawY, tempDrawW, tempDrawH)
          
          // Apply filters if needed
          if (hasFilters) {
            const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
            const filteredData = applyVideoFilters(imageData, brightness, contrast, saturation, exposure, highlights, midtones, shadows)
            tempCtx.putImageData(filteredData, 0, 0)
          }
          
          // Apply rounded corners mask if needed
          if (borderRadius > 0) {
            const maxRadius = Math.min(tempCanvas.width, tempCanvas.height) / 2
            const clampedRadius = Math.min(borderRadius, maxRadius)
            
            tempCtx.globalCompositeOperation = 'destination-in'
            tempCtx.fillStyle = 'white'
            tempCtx.beginPath()
            if (typeof (tempCtx as any).roundRect === 'function') {
              (tempCtx as any).roundRect(0, 0, tempCanvas.width, tempCanvas.height, clampedRadius)
            } else {
              const r = clampedRadius
              tempCtx.moveTo(r, 0)
              tempCtx.lineTo(tempCanvas.width - r, 0)
              tempCtx.quadraticCurveTo(tempCanvas.width, 0, tempCanvas.width, r)
              tempCtx.lineTo(tempCanvas.width, tempCanvas.height - r)
              tempCtx.quadraticCurveTo(tempCanvas.width, tempCanvas.height, tempCanvas.width - r, tempCanvas.height)
              tempCtx.lineTo(r, tempCanvas.height)
              tempCtx.quadraticCurveTo(0, tempCanvas.height, 0, tempCanvas.height - r)
              tempCtx.lineTo(0, r)
              tempCtx.quadraticCurveTo(0, 0, r, 0)
              tempCtx.closePath()
            }
            tempCtx.fill()
          }
          
          // Draw the processed temp canvas to main canvas at full size
          ctx.drawImage(tempCanvas, 0, 0, width, height)
        } else {
          // Fallback: draw directly if OffscreenCanvas not supported
          ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
        }
      } else {
        // No filters or rounded corners - draw directly
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
      }
      
      ctx.restore()
    }
    
    // Continue to render background image, title, and captions even without layout clip
    // (fall through to code below)
  } else {
  
  // Render each holder (video layer)
  for (const holder of layoutClip.holders) {
    // Find the timeline clip this holder references
    const holderClip = timelineClips.find(c => c.id === holder.clipId)
    if (!holderClip) {
      // Holder references a clip that doesn't exist - skip
      continue
    }
    
    // Use the holder's clip sceneId/takeId, not the current timeline clip's
    const holderSceneId = holderClip.sceneId
    const holderTakeId = holderClip.takeId
    const videoKey = `${holderSceneId}_${holderTakeId}_${holder.layer}`
    const video = context.videoElements.get(videoKey)
    
    // Get clip properties for filters
    const clipKey = `${holderSceneId}_${holderTakeId}_${holder.layer}`
    const props = state.clipProperties?.get(clipKey)
    const brightness = props?.brightness ?? 0
    const contrast = props?.contrast ?? 0
    const saturation = props?.saturation ?? 0
    const exposure = props?.exposure ?? 0
    const highlights = props?.highlights ?? 0
    const midtones = props?.midtones ?? 0
    const shadows = props?.shadows ?? 0
    
    if (!video) {
      // Video not found - skip silently (matches preview behavior)
      continue
    }
    
    // Skip expensive waits when exporting - videos are pre-loaded and seeks are handled by export loop
    if (!isExport) {
      // For preview, check readyState
      if (video.readyState < 2) {
        // Only wait briefly if video is truly not ready
        await new Promise(resolve => setTimeout(resolve, 10))
        if (video.readyState < 2) {
          // Video still not ready - skip
          continue
        }
      }
    }
    
    // Calculate video time from the holder clip's source in/out points
    const clipStartTime = holderClip.timelineStart
    const relativeTime = time - clipStartTime
    const clipDuration = holderClip.timelineEnd - holderClip.timelineStart
    const sourceDuration = holderClip.sourceOut - holderClip.sourceIn
    
    // Only render if we're within the holder clip's timeline range
    if (time < holderClip.timelineStart || time >= holderClip.timelineEnd) {
      continue
    }
    
    const targetVideoTime = holderClip.sourceIn + (relativeTime / clipDuration) * sourceDuration
    
    // Clamp to valid video time range
    if (targetVideoTime < 0 || targetVideoTime >= video.duration) {
      continue
    }
    
    // Skip seeking in renderFrame when exporting - the export loop already handles this
    if (!isExport) {
      // Ensure video is at correct time - optimize for sequential frame rendering
      const timeDiff = Math.abs(video.currentTime - targetVideoTime)
      if (timeDiff > 0.1) { // Increased threshold for faster rendering
        video.currentTime = targetVideoTime
        // Only wait for seek if we're way off (for export speed)
        if (timeDiff > 1.0) {
          await new Promise<void>((resolve) => {
            let resolved = false
            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true
                resolve()
              }
            }, 500) // Shorter timeout for export
            
            const onSeeked = () => {
              if (!resolved) {
                resolved = true
                clearTimeout(timeout)
                video.removeEventListener('seeked', onSeeked)
                resolve()
              }
            }
            
            video.addEventListener('seeked', onSeeked, { once: true })
          })
        }
      }
      
      // For preview, minimize waiting - just check readyState briefly
      if (video.readyState < 2) {
        await new Promise<void>((resolve) => {
          if (video.readyState >= 2) {
            resolve()
            return
          }
          
          const timeout = setTimeout(() => resolve(), 100) // Short timeout for export speed
          
          const onCanPlay = () => {
          clearTimeout(timeout)
          video.removeEventListener('canplay', onCanPlay)
          video.removeEventListener('canplaythrough', onCanPlayThrough)
          resolve()
        }
        
        const onCanPlayThrough = () => {
          clearTimeout(timeout)
          video.removeEventListener('canplay', onCanPlay)
          video.removeEventListener('canplaythrough', onCanPlayThrough)
          resolve()
        }
        
        video.addEventListener('canplay', onCanPlay, { once: true })
        video.addEventListener('canplaythrough', onCanPlayThrough, { once: true })
      })
      }
      
      // requestVideoFrameCallback is very slow - skip for export
      if (!isExport && 'requestVideoFrameCallback' in video) {
        await new Promise<void>((resolve) => {
          (video as any).requestVideoFrameCallback(() => {
            resolve()
          })
          setTimeout(() => resolve(), 500)
        })
      }
    }
    
    // Skip requestVideoFrameCallback for export - too slow, just render current frame
    
    // Calculate holder position and size in pixels
    const holderX = holder.x * width
    const holderY = holder.y * height
    const holderWidth = holder.width * width
    const holderHeight = holder.height * height
    
    // Draw video frame (matches canvas preview exactly)
    ctx.save()
    
    // Apply rotation around holder center
    const centerX = holderX + holderWidth / 2
    const centerY = holderY + holderHeight / 2
    ctx.translate(centerX, centerY)
    if (holder.rotation) {
      ctx.rotate((holder.rotation * Math.PI) / 180)
    }
    
    // Clip to holder bounds first (ensures video is cropped to holder, not scaled down)
    ctx.beginPath()
    ctx.rect(-holderWidth / 2, -holderHeight / 2, holderWidth, holderHeight)
    ctx.clip()
    
    // Calculate video frame dimensions (object-cover behavior: maintain aspect, center crop)
    // Coordinates are relative to center after rotation (matches canvas preview)
    // IMPORTANT: We always draw to fill the entire holder area (holderWidth x holderHeight)
    // The object-cover behavior only affects how the video is scaled within that area
    const videoAspect = video.videoWidth / video.videoHeight
    const holderAspect = holderWidth / holderHeight
    
    // For direct drawing (no filters/borderRadius), calculate object-cover dimensions
    // For temp canvas approach, we'll fill the entire holder area
    let drawWidth = holderWidth
    let drawHeight = holderHeight
    let drawX = -holderWidth / 2  // Relative to center - always fill holder width
    let drawY = -holderHeight / 2 // Relative to center - always fill holder height
    
    // Apply object-cover scaling (matches CSS object-cover exactly)
    // Object-cover: scale to fill container, maintain aspect, crop excess
    // CRITICAL: The video must always fill the holder in the correct dimension
    // to ensure proper height and width matching the preview
    if (holderAspect > videoAspect) {
      // Holder is wider than video - fit to height, crop width (center crop)
      // Video MUST fill holder height completely (drawHeight = holderHeight)
      drawHeight = holderHeight
      drawWidth = drawHeight * videoAspect
      drawX = -drawWidth / 2
      drawY = -holderHeight / 2  // Always use full holder height
    } else {
      // Holder is taller than video - fit to width, crop height (center crop)
      // Video MUST fill holder width completely (drawWidth = holderWidth)
      drawWidth = holderWidth
      drawHeight = drawWidth / videoAspect
      drawX = -holderWidth / 2  // Always use full holder width
      drawY = -drawHeight / 2
    }
    
    // Apply rounded corners if specified
    // Get transition border radius if transitioning
    const transitionDuration = canvasSettings.transitionDuration ?? 0
    const transitionBorderRadius = getTransitionBorderRadius(
      time,
      holder.clipId,
      holder.layer,
      layoutClips,
      transitionDuration
    )
    
    // Use transition border radius if active, otherwise use holder's border radius
    const borderRadius = transitionBorderRadius !== null ? transitionBorderRadius : (holder.borderRadius ?? 0)
    if (borderRadius > 0) {
      // borderRadius is stored in export resolution pixels (e.g., 1920x1080)
      // The width/height parameters are already at export resolution
      // So we can use borderRadius directly (scale = 1.0) when canvas matches export resolution
      // But we still calculate scale in case canvas resolution differs
      const exportWidth = state.canvasSettings?.resolution?.width || width
      const exportHeight = state.canvasSettings?.resolution?.height || height
      
      // Calculate scale factor from export resolution to actual canvas size
      // Typically this will be 1.0 if canvas is at export resolution
      const scaleX = width / exportWidth
      const scaleY = height / exportHeight
      const scale = Math.min(scaleX, scaleY) // Use minimum to maintain aspect ratio
      
      // Scale the borderRadius from export resolution pixels to canvas pixels
      // Use the holder's actual pixel dimensions (holderWidth/holderHeight) for clamping
      const scaledRadius = Math.min(borderRadius * scale, Math.min(Math.abs(holderWidth), Math.abs(holderHeight)) / 2)
      
      // Create rounded rectangle clip path (relative to center after rotation)
      // Use holder bounds, not draw bounds, to ensure proper cropping
      ctx.beginPath()
      
      // Use roundRect if available, otherwise use manual path
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(-holderWidth / 2, -holderHeight / 2, holderWidth, holderHeight, scaledRadius)
      } else {
        // Fallback: manually draw rounded rectangle path
        const r = scaledRadius
        const x = -holderWidth / 2
        const y = -holderHeight / 2
        const w = holderWidth
        const h = holderHeight
        
        ctx.moveTo(x + r, y)
        ctx.lineTo(x + w - r, y)
        ctx.quadraticCurveTo(x + w, y, x + w, y + r)
        ctx.lineTo(x + w, y + h - r)
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
        ctx.lineTo(x + r, y + h)
        ctx.quadraticCurveTo(x, y + h, x, y + h - r)
        ctx.lineTo(x, y + r)
        ctx.quadraticCurveTo(x, y, x + r, y)
        ctx.closePath()
      }
      
      ctx.clip()
    }
    
    // Apply filters if needed
    const hasFilters = brightness !== 0 || contrast !== 0 || saturation !== 0 || exposure !== 0 || highlights !== 0 || midtones !== 0 || shadows !== 0
    
    if (hasFilters || borderRadius > 0) {
      // Use temporary canvas for filters and/or rounded corners
      // Always use HTMLCanvasElement during export to avoid WebGL context limits
      // Temp canvas should match holder dimensions (not object-cover dimensions) to ensure correct cropping
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = Math.ceil(Math.abs(holderWidth))
      tempCanvas.height = Math.ceil(Math.abs(holderHeight))
      const tempCtx = tempCanvas.getContext('2d', {
        willReadFrequently: false,
        alpha: false,
      })
      
      if (tempCtx) {
        // Draw video to temp canvas with object-cover behavior (fill holder, maintain aspect, crop excess)
        // This matches CSS object-cover exactly
        const tempVideoAspect = video.videoWidth / video.videoHeight
        const tempAspect = tempCanvas.width / tempCanvas.height
        
        let tempDrawW = tempCanvas.width
        let tempDrawH = tempCanvas.height
        let tempDrawX = 0
        let tempDrawY = 0
        
        if (tempAspect > tempVideoAspect) {
          // Temp canvas is wider than video - fit to height, crop width (center crop)
          // CRITICAL: Video MUST fill temp canvas height completely
          tempDrawH = tempCanvas.height
          tempDrawW = tempDrawH * tempVideoAspect
          tempDrawX = (tempCanvas.width - tempDrawW) / 2
          tempDrawY = 0 // Start at top to fill height
        } else {
          // Temp canvas is taller than video - fit to width, crop height (center crop)
          // CRITICAL: Video MUST fill temp canvas width completely
          tempDrawW = tempCanvas.width
          tempDrawH = tempDrawW / tempVideoAspect
          tempDrawX = 0 // Start at left to fill width
          tempDrawY = (tempCanvas.height - tempDrawH) / 2
        }
        
        // Verify dimensions are correct
        if (tempAspect > tempVideoAspect) {
          // Should fill height
          if (Math.abs(tempDrawH - tempCanvas.height) > 0.1) {
            console.warn('Temp canvas height mismatch:', { tempDrawH, tempCanvasHeight: tempCanvas.height })
            tempDrawH = tempCanvas.height
            tempDrawW = tempDrawH * tempVideoAspect
            tempDrawX = (tempCanvas.width - tempDrawW) / 2
          }
        } else {
          // Should fill width
          if (Math.abs(tempDrawW - tempCanvas.width) > 0.1) {
            console.warn('Temp canvas width mismatch:', { tempDrawW, tempCanvasWidth: tempCanvas.width })
            tempDrawW = tempCanvas.width
            tempDrawH = tempDrawW / tempVideoAspect
            tempDrawY = (tempCanvas.height - tempDrawH) / 2
          }
        }
        
        tempCtx.drawImage(video, tempDrawX, tempDrawY, tempDrawW, tempDrawH)
        
        // Apply filters if needed
        if (hasFilters) {
          const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
          const filteredData = applyVideoFilters(imageData, brightness, contrast, saturation, exposure, highlights, midtones, shadows)
          tempCtx.putImageData(filteredData, 0, 0)
        }
        
        // Apply rounded corners mask if needed
        if (borderRadius > 0) {
          const exportWidth = state.canvasSettings?.resolution?.width || width
          const exportHeight = state.canvasSettings?.resolution?.height || height
          const scaleX = width / exportWidth
          const scaleY = height / exportHeight
          const scale = Math.min(scaleX, scaleY)
          const scaledRadius = Math.min(borderRadius * scale, Math.min(Math.abs(holderWidth), Math.abs(holderHeight)) / 2)
          
          tempCtx.globalCompositeOperation = 'destination-in'
          tempCtx.fillStyle = 'white'
          tempCtx.beginPath()
          if (typeof (tempCtx as any).roundRect === 'function') {
            (tempCtx as any).roundRect(0, 0, tempCanvas.width, tempCanvas.height, scaledRadius)
          } else {
            const r = scaledRadius
            tempCtx.moveTo(r, 0)
            tempCtx.lineTo(tempCanvas.width - r, 0)
            tempCtx.quadraticCurveTo(tempCanvas.width, 0, tempCanvas.width, r)
            tempCtx.lineTo(tempCanvas.width, tempCanvas.height - r)
            tempCtx.quadraticCurveTo(tempCanvas.width, tempCanvas.height, tempCanvas.width - r, tempCanvas.height)
            tempCtx.lineTo(r, tempCanvas.height)
            tempCtx.quadraticCurveTo(0, tempCanvas.height, 0, tempCanvas.height - r)
            tempCtx.lineTo(0, r)
            tempCtx.quadraticCurveTo(0, 0, r, 0)
            tempCtx.closePath()
          }
          tempCtx.fill()
        }
        
        // Draw the processed temp canvas to main canvas at holder position with holder dimensions
        // Position is relative to center after rotation
        // The temp canvas is already holderWidth x holderHeight, so draw it to fill the entire holder area
        // This ensures the video fills the holder correctly with proper height and width/cropping
        // CRITICAL: Verify temp canvas matches holder dimensions
        if (Math.abs(tempCanvas.width - Math.abs(holderWidth)) > 1 || Math.abs(tempCanvas.height - Math.abs(holderHeight)) > 1) {
          console.warn('Temp canvas size mismatch:', {
            tempCanvasWidth: tempCanvas.width,
            tempCanvasHeight: tempCanvas.height,
            holderWidth,
            holderHeight
          })
        }
        // Always draw at full holder dimensions to ensure correct height and width
        ctx.drawImage(tempCanvas, -holderWidth / 2, -holderHeight / 2, holderWidth, holderHeight)
      } else {
        // Fallback: draw directly if OffscreenCanvas not supported
        ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
      }
    } else {
      // No filters or rounded corners - draw directly
      // CRITICAL: We've already clipped to holder bounds, so the video must fill the holder
      // The object-cover calculation ensures the video fills the holder in the correct dimension
      // (height when holder is wider, width when holder is taller)
      // Verify the dimensions are correct before drawing
      if (holderAspect > videoAspect) {
        // Holder is wider - video MUST fill holder height
        // drawHeight should equal holderHeight, drawWidth will be smaller (gets cropped by clip)
        if (Math.abs(drawHeight - holderHeight) > 0.1) {
          console.warn('Height mismatch in object-cover calculation:', { drawHeight, holderHeight, holderAspect, videoAspect })
          drawHeight = holderHeight
          drawWidth = drawHeight * videoAspect
          drawX = -drawWidth / 2
          drawY = -holderHeight / 2
        }
      } else {
        // Holder is taller - video MUST fill holder width
        // drawWidth should equal holderWidth, drawHeight will be larger (gets cropped by clip)
        if (Math.abs(drawWidth - holderWidth) > 0.1) {
          console.warn('Width mismatch in object-cover calculation:', { drawWidth, holderWidth, holderAspect, videoAspect })
          drawWidth = holderWidth
          drawHeight = drawWidth / videoAspect
          drawX = -holderWidth / 2
          drawY = -drawHeight / 2
        }
      }
      ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
    }
    
    ctx.restore()
  }
  }
  
  // Render title if present and within timeline
  if (state.titleSettings && state.titleSettings.text) {
    const title = state.titleSettings
    const titleStart = title.timelineStart || 0
    const titleEnd = title.timelineEnd || Infinity
    
    if (time >= titleStart && time <= titleEnd) {
      await renderTitle(ctx, title, time, width, height)
    }
  }
  
  // Render captions if enabled
  if (state.captionSettings && state.captionSettings.enabled) {
    const sceneClip = state.timelineClips.find(c => c.sceneId === sceneId)
    if (sceneClip) {
      const sceneStartTime = sceneClip.timelineStart
      const visibleWords = getVisibleWords(time, sceneId, sceneStartTime, state.transcripts)
      
      if (visibleWords.length > 0) {
        await renderCaptions(ctx, visibleWords, state.captionSettings, width, height)
      }
    }
  }
}

/**
 * Load image from URL (data URL, blob URL, or regular URL)
 */
async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

/**
 * Render title text with animations
 */
async function renderTitle(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  title: RenderState['titleSettings']!,
  time: number,
  width: number,
  height: number
): Promise<void> {
  if (!title.text) return
  
  const fontSize = title.fontSize || 48
  const fontFamily = title.font || 'Arial'
  const x = title.x * width
  const y = title.y * height
  const lineHeight = (title.lineHeight || 1.2) * fontSize
  
  // Calculate animation alpha
  let alpha = 1.0
  const animationDuration = title.animationDuration || 0.5
  const titleStart = title.timelineStart || 0
  const titleEnd = title.timelineEnd || Infinity
  
  if (title.animationIn === 'fade' || title.animationOut === 'fade') {
    const fadeInEnd = titleStart + animationDuration
    const fadeOutStart = titleEnd - animationDuration
    
    if (time < fadeInEnd && title.animationIn === 'fade') {
      alpha = (time - titleStart) / animationDuration
    } else if (time > fadeOutStart && title.animationOut === 'fade') {
      alpha = 1 - (time - fadeOutStart) / animationDuration
    }
  }
  
  ctx.save()
  ctx.font = `${fontSize}px ${fontFamily}`
  ctx.textAlign = title.textAlign || 'left'
  ctx.textBaseline = 'top'
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha))
  ctx.fillStyle = '#ffffff'
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  
  // Handle multi-line text
  const lines = title.text.split('\n').filter(line => line.trim())
  lines.forEach((line, index) => {
    const lineY = y + index * lineHeight
    ctx.strokeText(line, x, lineY)
    ctx.fillText(line, x, lineY)
  })
  
  ctx.restore()
}

/**
 * Render captions
 */
async function renderCaptions(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  words: Array<{ word: string; start: number; end: number }>,
  settings: RenderState['captionSettings']!,
  width: number,
  height: number
): Promise<void> {
  if (!settings.style || words.length === 0) return
  
  const text = words.slice(0, settings.maxWords || 10).map(w => w.word).join(' ')
  const fontSize = Math.max(12, Math.min(200, (height / 1080) * settings.size))
  const fontFamily = settings.font
  
  ctx.save()
  ctx.font = `${settings.style.fontWeight || 'normal'} ${fontSize}px ${fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  
  const x = width / 2
  const y = height - (height * 0.1)
  
  const metrics = ctx.measureText(text)
  const textWidth = metrics.width
  const textHeight = fontSize
  const padding = parseFloat(settings.style.padding) || 8
  const borderRadius = parseFloat(settings.style.borderRadius) || 4
  
  const bgX = x - textWidth / 2 - padding
  const bgY = y - textHeight - padding
  const bgWidth = textWidth + (padding * 2)
  const bgHeight = textHeight + (padding * 2)
  
  // Draw rounded rectangle background
  ctx.beginPath()
  if ('roundRect' in ctx) {
    (ctx as any).roundRect(bgX, bgY, bgWidth, bgHeight, borderRadius)
  } else {
    // Fallback for browsers without roundRect
    ctx.rect(bgX, bgY, bgWidth, bgHeight)
  }
  ctx.fillStyle = settings.style.backgroundColor
  ctx.fill()
  
  if (settings.style.border) {
    ctx.strokeStyle = settings.style.border.split(' ')[2] || '#ffffff'
    ctx.lineWidth = parseFloat(settings.style.border.split(' ')[0]) || 2
    ctx.stroke()
  }
  
  // Draw text
  ctx.fillStyle = settings.style.textColor
  ctx.fillText(text, x, y)
  
  ctx.restore()
}

