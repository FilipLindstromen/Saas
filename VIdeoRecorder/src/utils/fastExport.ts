/**
 * Fast, production-ready video export using MediaRecorder API
 * Records the canvas directly - What You See Is What You Get (WYSIWYG)
 * 
 * This is the recommended export method for production use.
 * It's fast, accurate, and reliable.
 */

import type { RenderState, RenderContext } from './renderer'
import { renderFrame } from './renderer'
import { projectManager } from './projectManager'

export interface FastExportOptions {
  // Export settings
  width: number
  height: number
  fps: number
  format?: 'webm' | 'mp4'
  quality?: 'low' | 'medium' | 'high' | number // 0.0 to 1.0 or preset
  
  // Progress callback
  onProgress?: (progress: { message: string; percent: number }) => void
}

export interface FastExportResult {
  success: boolean
  blob?: Blob
  error?: string
}

/**
 * Export video using MediaRecorder API
 * Records canvas frames directly - fast and accurate
 */
export async function exportVideoFast(
  renderState: RenderState,
  options: FastExportOptions
): Promise<FastExportResult> {
  const {
    width,
    height,
    fps,
    format = 'webm',
    quality = 'high',
    onProgress,
  } = options

  try {
    // Step 1: Calculate duration
    const totalDuration = renderState.timelineClips.reduce((max, clip) => {
      return Math.max(max, clip.timelineEnd)
    }, 0)

    if (totalDuration <= 0) {
      return {
        success: false,
        error: 'No video content to export',
      }
    }

    if (onProgress) {
      onProgress({ message: 'Preloading video assets...', percent: 0 })
    }

    // Step 2: Preload all video elements
    const videoElements = new Map<string, HTMLVideoElement>()
    const videoBlobUrls: string[] = []

    // Collect all unique scene/take/layer combinations
    const sceneTakes = new Map<string, { sceneId: string; takeId: string; layer: string }>()
    for (const clip of renderState.timelineClips) {
      const key = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
      if (!sceneTakes.has(key)) {
        sceneTakes.set(key, { sceneId: clip.sceneId, takeId: clip.takeId, layer: clip.layer })
      }
    }

    // Load all videos
    for (const [key, { sceneId, takeId, layer }] of sceneTakes.entries()) {
      try {
        const blob = await projectManager.loadRecording(sceneId, `${takeId}_${layer}`)
        if (blob) {
          const url = URL.createObjectURL(blob)
          videoBlobUrls.push(url)

          const video = document.createElement('video')
          video.crossOrigin = 'anonymous'
          video.preload = 'auto'
          video.playsInline = true
          video.muted = true
          
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error(`Timeout loading video: ${key}`))
            }, 30000)
            
            const onLoadedMetadata = () => {
              clearTimeout(timeout)
              video.removeEventListener('loadedmetadata', onLoadedMetadata)
              video.removeEventListener('error', onError)
              video.currentTime = 0
              resolve()
            }
            
            const onError = () => {
              clearTimeout(timeout)
              video.removeEventListener('loadedmetadata', onLoadedMetadata)
              video.removeEventListener('error', onError)
              reject(new Error(`Failed to load video: ${key}`))
            }
            
            video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
            video.addEventListener('error', onError, { once: true })
            video.src = url
          })

          // Wait for video to be ready for playback
          if (video.readyState < 2) {
            await new Promise<void>((resolve) => {
              const onCanPlay = () => {
                video.removeEventListener('canplay', onCanPlay)
                video.removeEventListener('canplaythrough', onCanPlay)
                resolve()
              }
              video.addEventListener('canplay', onCanPlay, { once: true })
              video.addEventListener('canplaythrough', onCanPlay, { once: true })
              // Timeout after 5 seconds
              setTimeout(() => {
                video.removeEventListener('canplay', onCanPlay)
                video.removeEventListener('canplaythrough', onCanPlay)
                resolve()
              }, 5000)
            })
          }

          videoElements.set(key, video)
        }
      } catch (error) {
        console.warn(`Failed to load video ${key}:`, error)
      }
    }

    if (videoElements.size === 0) {
      // Cleanup
      for (const url of videoBlobUrls) {
        URL.revokeObjectURL(url)
      }
      return {
        success: false,
        error: 'No video sources loaded. Please ensure scenes have recordings.',
      }
    }

    if (onProgress) {
      onProgress({ message: 'Initializing recorder...', percent: 10 })
    }

    // Step 3: Create canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d', {
      willReadFrequently: false,
      alpha: false,
      colorSpace: 'srgb',
    })

    if (!ctx) {
      // Cleanup
      for (const url of videoBlobUrls) {
        URL.revokeObjectURL(url)
      }
      return {
        success: false,
        error: 'Failed to get canvas context',
      }
    }

    // Step 4: Create MediaRecorder
    const stream = canvas.captureStream(fps)
    
    // Determine video codec and mime type
    let mimeType: string
    let codec: string
    
    if (format === 'webm') {
      // Try VP9 first, fallback to VP8
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9'
        codec = 'vp9'
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8'
        codec = 'vp8'
      } else {
        mimeType = 'video/webm'
        codec = 'vp8'
      }
    } else {
      // MP4 - only supported in Chromium with hardware acceleration
      if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4'
        codec = 'avc1'
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        // Fallback to WebM if MP4 not supported
        mimeType = 'video/webm;codecs=vp9'
        codec = 'vp9'
      } else {
        mimeType = 'video/webm'
        codec = 'vp8'
      }
    }

    // Convert quality preset to number if needed
    let qualityValue: number
    if (typeof quality === 'string') {
      switch (quality) {
        case 'low':
          qualityValue = 0.3
          break
        case 'medium':
          qualityValue = 0.6
          break
        case 'high':
        default:
          qualityValue = 0.9
          break
      }
    } else {
      qualityValue = quality
    }

    const recorderOptions: MediaRecorderOptions = {
      mimeType,
      videoBitsPerSecond: undefined, // Let browser decide based on quality
    }

    // For WebM, we can use quality setting
    if (mimeType.includes('webm')) {
      // @ts-ignore - quality property exists in some browsers
      if ('quality' in MediaRecorder.prototype) {
        recorderOptions.quality = qualityValue
      } else {
        // Fallback: use bitrate estimation
        const estimatedBitrate = Math.round(qualityValue * 10_000_000) // 10 Mbps max
        recorderOptions.videoBitsPerSecond = estimatedBitrate
      }
    }

    const recorder = new MediaRecorder(stream, recorderOptions)

    if (onProgress) {
      onProgress({ message: 'Starting recording...', percent: 15 })
    }

    // Step 5: Record video
    const recordedChunks: Blob[] = []
    
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data)
      }
    }

    const recordingPromise = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => {
        resolve()
      }
      recorder.onerror = (event) => {
        reject(new Error('MediaRecorder error: ' + (event as any).error?.message || 'Unknown error'))
      }
    })

    // Create render context
    const renderContext: RenderContext = {
      canvas,
      ctx,
      time: 0,
      width,
      height,
      dpr: 1.0,
      videoElements,
    }

    // Start recording
    recorder.start(1000) // Collect data every second

    // Step 6: Render and record frames
    const frameDuration = 1 / fps
    const totalFrames = Math.ceil(totalDuration * fps)

    // Ensure videos are loaded and at the start
    for (const video of videoElements.values()) {
      video.currentTime = 0
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) {
          resolve()
        } else {
          const onLoadedData = () => {
            video.removeEventListener('loadeddata', onLoadedData)
            resolve()
          }
          video.addEventListener('loadeddata', onLoadedData, { once: true })
        }
      })
      // Small delay to ensure video is ready
      await new Promise(resolve => setTimeout(resolve, 50))
    }

    // Render loop - update canvas at target FPS
    const startTime = performance.now()
    let frameIndex = 0
    let lastFrameTime = 0
    const targetFrameTime = 1000 / fps // milliseconds per frame

    const renderLoop = async (): Promise<void> => {
      if (frameIndex >= totalFrames) {
        // Stop recording after all frames
        if (recorder.state !== 'inactive' && recorder.state !== 'stopped') {
          recorder.stop()
        }
        return
      }

      const now = performance.now()
      const timelineTime = frameIndex * frameDuration

      // Update render context time
      renderContext.time = timelineTime

      // Seek videos to correct time if needed
      const seekPromises: Promise<void>[] = []
      for (const clip of renderState.timelineClips) {
        if (timelineTime >= clip.timelineStart && timelineTime < clip.timelineEnd) {
          const key = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
          const video = videoElements.get(key)
          
          if (video && video.readyState >= 2) {
            // Calculate source video time
            const relativeTime = timelineTime - clip.timelineStart
            const clipDuration = clip.timelineEnd - clip.timelineStart
            const sourceDuration = clip.sourceOut - clip.sourceIn
            const targetTime = clip.sourceIn + (relativeTime / clipDuration) * sourceDuration
            
            // Clamp target time
            const clampedTime = Math.max(0, Math.min(targetTime, video.duration || targetTime))
            
            // Only seek if significantly off (optimize for sequential playback)
            const timeDiff = Math.abs(video.currentTime - clampedTime)
            if (timeDiff > 0.1) {
              video.currentTime = clampedTime
              // Wait for seek to complete (but don't wait too long)
              seekPromises.push(
                new Promise<void>((resolve) => {
                  const timeout = setTimeout(() => resolve(), 100) // Max 100ms wait
                  const onSeeked = () => {
                    clearTimeout(timeout)
                    video.removeEventListener('seeked', onSeeked)
                    resolve()
                  }
                  video.addEventListener('seeked', onSeeked, { once: true })
                  // If already at target, resolve immediately
                  if (Math.abs(video.currentTime - clampedTime) < 0.05) {
                    clearTimeout(timeout)
                    video.removeEventListener('seeked', onSeeked)
                    resolve()
                  }
                })
              )
            }
          }
        }
      }

      // Wait for all seeks to complete (but don't wait too long)
      if (seekPromises.length > 0) {
        await Promise.all(seekPromises)
      }

      // Render frame with isExport=true to skip expensive async waits
      await renderFrame(renderContext, renderState, true)

      frameIndex++
      
      // Report progress
      if (onProgress && (frameIndex % Math.max(1, Math.floor(fps / 2)) === 0 || frameIndex === totalFrames)) {
        const progress = 15 + (frameIndex / totalFrames) * 80
        const elapsed = (performance.now() - startTime) / 1000
        const rate = elapsed > 0 ? frameIndex / elapsed : 0
        
        onProgress({
          message: `Rendering frame ${frameIndex} of ${totalFrames}${rate > 0 ? ` (${Math.round(rate)} fps)` : ''}...`,
          percent: Math.min(progress, 95),
        })
      }

      // Schedule next frame
      const elapsed = now - lastFrameTime
      const waitTime = Math.max(0, targetFrameTime - elapsed)
      lastFrameTime = now

      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime))
      } else {
        // If we're falling behind, yield briefly
        await new Promise(resolve => setTimeout(resolve, 0))
      }

      // Continue loop
      await renderLoop()
    }

    // Start render loop
    await renderLoop()

    // Wait for recording to complete
    await recordingPromise

    if (onProgress) {
      onProgress({ message: 'Finalizing video...', percent: 96 })
    }

    // Step 7: Combine chunks into final blob
    const blob = new Blob(recordedChunks, { type: mimeType })

    // Cleanup
    for (const url of videoBlobUrls) {
      URL.revokeObjectURL(url)
    }
    for (const video of videoElements.values()) {
      video.src = ''
    }
    stream.getTracks().forEach(track => track.stop())

    if (!blob || blob.size === 0) {
      return {
        success: false,
        error: 'Export produced an empty video file',
      }
    }

    if (onProgress) {
      onProgress({ message: 'Export complete!', percent: 100 })
    }

    return {
      success: true,
      blob,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
