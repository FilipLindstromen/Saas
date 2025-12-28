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
 */
export async function renderFrame(
  context: RenderContext,
  state: RenderState
): Promise<void> {
  const { canvas, ctx, time, width, height } = context
  const { timelineClips, layoutClips, canvasSettings, layout } = state
  
  // Clear canvas with background color
  ctx.fillStyle = canvasSettings.videoBackgroundColor || '#000000'
  ctx.fillRect(0, 0, width, height)
  
  // Find which clip is active at this time
  const timelineResult = timelineToVideoTime(time, timelineClips)
  
  // If we're in a gap, just show background
  if (!timelineResult || !timelineResult.clip) {
    return
  }
  
  const { videoTime, sceneId, takeId, clip } = timelineResult
  
  // Find layout clip that contains this timeline time
  const layoutClip = layoutClips.find(
    lc => time >= lc.timelineStart && time < lc.timelineEnd
  )
  
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
      
      if (video.readyState < 2) {
        await new Promise(resolve => setTimeout(resolve, 50))
        if (video.readyState < 2) {
          continue
        }
      }
      
      // Calculate video time
      const clipStartTime = activeClip.timelineStart
      const relativeTime = time - clipStartTime
      const clipDuration = activeClip.timelineEnd - activeClip.timelineStart
      const sourceDuration = activeClip.sourceOut - activeClip.sourceIn
      const targetVideoTime = activeClip.sourceIn + (relativeTime / clipDuration) * sourceDuration
      
      if (targetVideoTime < 0 || targetVideoTime >= video.duration) {
        continue
      }
      
      // Seek video to correct time
      if (Math.abs(video.currentTime - targetVideoTime) > 0.05) {
        video.currentTime = targetVideoTime
        await new Promise<void>((resolve) => {
          let resolved = false
          const timeout = setTimeout(() => {
            if (!resolved) {
              resolved = true
              if (Math.abs(video.currentTime - targetVideoTime) < 0.2) {
                resolve()
              } else {
                resolve()
              }
            }
          }, 1000)
          
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
      
      // Wait for video frame
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
      
      if ('requestVideoFrameCallback' in video) {
        await new Promise<void>((resolve) => {
          (video as any).requestVideoFrameCallback(() => {
            resolve()
          })
          setTimeout(() => resolve(), 500)
        })
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
        // Use document.createElement for compatibility (works in both browser and worker contexts)
        const tempCanvas = typeof document !== 'undefined' 
          ? document.createElement('canvas')
          : new OffscreenCanvas(Math.ceil(Math.abs(drawWidth)), Math.ceil(Math.abs(drawHeight)))
        if (typeof document !== 'undefined') {
          (tempCanvas as HTMLCanvasElement).width = Math.ceil(Math.abs(drawWidth))
          ;(tempCanvas as HTMLCanvasElement).height = Math.ceil(Math.abs(drawHeight))
        }
        const tempCtx = tempCanvas.getContext('2d')
        
        if (tempCtx) {
          // Draw video to temp canvas
          tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height)
          
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
          
          // Draw the processed temp canvas to main canvas
          ctx.drawImage(tempCanvas, drawX, drawY, drawWidth, drawHeight)
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
    
    if (video.readyState < 2) {
      // Video not ready yet - wait a bit
      await new Promise(resolve => setTimeout(resolve, 50))
      if (video.readyState < 2) {
        // Video still not ready - skip
        continue
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
    
    // Ensure video is at correct time
    if (Math.abs(video.currentTime - targetVideoTime) > 0.05) {
      video.currentTime = targetVideoTime
      // Wait for seek to complete with better error handling
      await new Promise<void>((resolve) => {
        let resolved = false
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true
            // Check if we're close enough
            if (Math.abs(video.currentTime - targetVideoTime) < 0.2) {
              resolve()
            } else {
              // Seek timeout - continue anyway (video may still be close enough)
              resolve()
            }
          }
        }, 1000)
        
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
    
    // Wait for video frame to be ready using requestVideoFrameCallback if available
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
          resolve() // Continue anyway
        }, 2000)
      })
    }
    
    // Use requestVideoFrameCallback if available for better frame accuracy
    if ('requestVideoFrameCallback' in video) {
      await new Promise<void>((resolve) => {
        (video as any).requestVideoFrameCallback(() => {
          resolve()
        })
        // Timeout fallback
        setTimeout(() => resolve(), 500)
      })
    }
    
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
    const videoAspect = video.videoWidth / video.videoHeight
    const holderAspect = holderWidth / holderHeight
    
    let drawWidth = holderWidth
    let drawHeight = holderHeight
    let drawX = -holderWidth / 2  // Relative to center
    let drawY = -holderHeight / 2 // Relative to center
    
    // Apply object-cover scaling (matches CSS object-cover exactly)
    // Object-cover: scale to fill container, maintain aspect, crop excess
    if (holderAspect > videoAspect) {
      // Holder is wider than video - fit to height, crop width (center crop)
      drawHeight = holderHeight
      drawWidth = drawHeight * videoAspect
      drawX = -drawWidth / 2
    } else {
      // Holder is taller than video - fit to width, crop height (center crop)
      drawWidth = holderWidth
      drawHeight = drawWidth / videoAspect
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
      // Use document.createElement for compatibility (works in both browser and worker contexts)
      const tempCanvas = typeof document !== 'undefined' 
        ? document.createElement('canvas')
        : new OffscreenCanvas(Math.ceil(Math.abs(drawWidth)), Math.ceil(Math.abs(drawHeight)))
      if (typeof document !== 'undefined') {
        (tempCanvas as HTMLCanvasElement).width = Math.ceil(Math.abs(drawWidth))
        ;(tempCanvas as HTMLCanvasElement).height = Math.ceil(Math.abs(drawHeight))
      }
      const tempCtx = tempCanvas.getContext('2d')
      
      if (tempCtx) {
        // Draw video to temp canvas (object-cover)
        const tempVideoAspect = video.videoWidth / video.videoHeight
        const tempAspect = tempCanvas.width / tempCanvas.height
        
        let tempDrawW = tempCanvas.width
        let tempDrawH = tempCanvas.height
        let tempDrawX = 0
        let tempDrawY = 0
        
        if (tempAspect > tempVideoAspect) {
          tempDrawH = tempCanvas.height
          tempDrawW = tempDrawH * tempVideoAspect
          tempDrawX = (tempCanvas.width - tempDrawW) / 2
        } else {
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
        
        // Draw the processed temp canvas to main canvas
        ctx.drawImage(tempCanvas, drawX, drawY, drawWidth, drawHeight)
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
  }
  
  // Render background image if present
  if (state.backgroundImageData) {
    const bgImg = await loadImage(state.backgroundImageData.url)
    if (bgImg) {
      const bgX = state.backgroundImageData.x * width
      const bgY = state.backgroundImageData.y * height
      const bgW = state.backgroundImageData.width * width
      const bgH = state.backgroundImageData.height * height
      ctx.drawImage(bgImg, bgX, bgY, bgW, bgH)
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

