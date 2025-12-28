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
  if (!layoutClip || !layoutClip.holders || layoutClip.holders.length === 0) {
    return
  }
  
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
    
    if (!video) {
      // Video not found - log for debugging
      console.warn(`Video not found for key: ${videoKey}. Available keys:`, Array.from(context.videoElements.keys()))
      continue
    }
    
    if (video.readyState < 2) {
      // Video not ready yet - wait a bit
      await new Promise(resolve => setTimeout(resolve, 50))
      if (video.readyState < 2) {
        console.warn(`Video ${videoKey} not ready (readyState: ${video.readyState})`)
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
              console.warn(`Video seek timeout for ${videoKey} at ${targetVideoTime}s`)
              resolve() // Continue anyway
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
    
    // Draw video frame
    ctx.save()
    
    // Apply rotation if needed
    if (holder.rotation) {
      const centerX = holderX + holderWidth / 2
      const centerY = holderY + holderHeight / 2
      ctx.translate(centerX, centerY)
      ctx.rotate((holder.rotation * Math.PI) / 180)
      ctx.translate(-centerX, -centerY)
    }
    
    // Draw video frame (maintain aspect ratio, center crop like object-cover)
    const videoAspect = video.videoWidth / video.videoHeight
    const holderAspect = holderWidth / holderHeight
    
    let drawWidth = holderWidth
    let drawHeight = holderHeight
    let drawX = holderX
    let drawY = holderY
    
    if (videoAspect > holderAspect) {
      // Video is wider - fit to height, crop width
      drawHeight = holderHeight
      drawWidth = drawHeight * videoAspect
      drawX = holderX - (drawWidth - holderWidth) / 2
    } else {
      // Video is taller - fit to width, crop height
      drawWidth = holderWidth
      drawHeight = drawWidth / videoAspect
      drawY = holderY - (drawHeight - holderHeight) / 2
    }
    
    // Apply rounded corners if specified
    // Check if borderRadius exists and is greater than 0
    const borderRadius = holder.borderRadius ?? 0
    if (borderRadius > 0) {
      // Convert borderRadius from pixels to canvas coordinates
      // Since holder dimensions are 0-1 normalized, we need to scale borderRadius
      // borderRadius is in export resolution pixels, so we need to scale it to canvas pixels
      const scaleX = width / (state.canvasSettings?.resolution?.width || width)
      const scaleY = height / (state.canvasSettings?.resolution?.height || height)
      const scale = Math.min(scaleX, scaleY) // Use minimum to maintain aspect ratio
      const scaledRadius = Math.min(borderRadius * scale, Math.min(holderWidth, holderHeight) / 2)
      
      ctx.beginPath()
      
      // Use roundRect if available, otherwise use manual path
      if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(drawX, drawY, drawWidth, drawHeight, scaledRadius)
      } else {
        // Fallback: manually draw rounded rectangle path
        const r = scaledRadius
        const x = drawX
        const y = drawY
        const w = drawWidth
        const h = drawHeight
        
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
    
    ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight)
    ctx.restore()
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

