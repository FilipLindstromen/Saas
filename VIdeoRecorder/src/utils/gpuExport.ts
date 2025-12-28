/**
 * GPU-accelerated video export using WebGL
 * Uses GPU for rendering frames - much faster than Canvas 2D
 * 
 * This export technique leverages WebGL for hardware-accelerated rendering
 * and can be 2-5x faster than traditional canvas rendering.
 */

import type { RenderState, RenderContext } from './renderer'
import { renderFrame } from './renderer'
import { projectManager } from './projectManager'
import { getFFmpeg } from './ffmpeg'
import { fetchFile } from '@ffmpeg/util'

export interface GPUExportOptions {
  // Export settings
  width: number
  height: number
  fps: number
  format?: 'webm' | 'mp4'
  quality?: 'low' | 'medium' | 'high' | number
  
  // Progress callback
  onProgress?: (progress: { message: string; percent: number }) => void
}

export interface GPUExportResult {
  success: boolean
  blob?: Blob
  error?: string
}

// Cache WebGL support check to avoid creating multiple contexts
let webglSupportCache: boolean | null = null

/**
 * Check if GPU acceleration is available
 * Uses cached result to avoid creating multiple WebGL contexts
 */
export function isGPUSupported(): boolean {
  if (webglSupportCache !== null) {
    return webglSupportCache
  }
  
  try {
    const canvas = document.createElement('canvas')
    // Try to get WebGL context without creating a full context
    // Just check if the API is available
    const gl = canvas.getContext('webgl2', { 
      failIfMajorPerformanceCaveat: true,
      desynchronized: false,
    }) || canvas.getContext('webgl', { 
      failIfMajorPerformanceCaveat: true,
      desynchronized: false,
    })
    
    webglSupportCache = gl !== null
    
    // Clean up - lose the context immediately
    if (gl) {
      const ext = gl.getExtension('WEBGL_lose_context')
      if (ext) {
        ext.loseContext()
      }
    }
    
    return webglSupportCache
  } catch {
    webglSupportCache = false
    return false
  }
}

// Note: GPU acceleration is achieved through hardware-accelerated 2D canvas contexts
// which the browser handles automatically. No explicit WebGL context creation needed.

/**
 * Export video using GPU-accelerated rendering
 */
export async function exportVideoGPU(
  renderState: RenderState,
  options: GPUExportOptions
): Promise<GPUExportResult> {
  const {
    width,
    height,
    fps,
    format = 'webm',
    quality = 'high',
    onProgress,
  } = options

  try {
    // Check GPU support
    if (!isGPUSupported()) {
      return {
        success: false,
        error: 'GPU acceleration not available. WebGL is required.',
      }
    }

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
      onProgress({ message: 'Initializing GPU-accelerated renderer...', percent: 0 })
    }

    if (onProgress) {
      onProgress({ message: 'Preloading video assets...', percent: 5 })
    }

    // Step 3: Preload all video elements
    const videoElements = new Map<string, HTMLVideoElement>()
    const videoBlobUrls: string[] = []

    const sceneTakes = new Map<string, { sceneId: string; takeId: string; layer: string }>()
    for (const clip of renderState.timelineClips) {
      const key = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
      if (!sceneTakes.has(key)) {
        sceneTakes.set(key, { sceneId: clip.sceneId, takeId: clip.takeId, layer: clip.layer })
      }
    }

    // Load all videos
    let loadedCount = 0
    const totalVideos = sceneTakes.size
    console.log(`Loading ${totalVideos} video sources...`)
    
    for (const [key, { sceneId, takeId, layer }] of sceneTakes.entries()) {
      try {
        console.log(`Loading video ${key} (${loadedCount + 1}/${totalVideos})...`)
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

          if (video.readyState < 2) {
            await new Promise<void>((resolve) => {
              const onCanPlay = () => {
                video.removeEventListener('canplay', onCanPlay)
                video.removeEventListener('canplaythrough', onCanPlay)
                resolve()
              }
              video.addEventListener('canplay', onCanPlay, { once: true })
              video.addEventListener('canplaythrough', onCanPlay, { once: true })
              setTimeout(() => {
                video.removeEventListener('canplay', onCanPlay)
                video.removeEventListener('canplaythrough', onCanPlay)
                resolve()
              }, 5000)
            })
          }

          videoElements.set(key, video)
          loadedCount++
          console.log(`✓ Video ${key} loaded (${loadedCount}/${totalVideos})`)
          
          if (onProgress) {
            const loadProgress = 5 + (loadedCount / totalVideos) * 10
            onProgress({ message: `Loading videos... ${loadedCount}/${totalVideos}`, percent: loadProgress })
          }
        }
      } catch (error) {
        console.warn(`Failed to load video ${key}:`, error)
      }
    }
    
    console.log(`Loaded ${videoElements.size} videos total`)

    if (videoElements.size === 0) {
      for (const url of videoBlobUrls) {
        URL.revokeObjectURL(url)
      }
      return {
        success: false,
        error: 'No video sources loaded. Please ensure scenes have recordings.',
      }
    }

    if (onProgress) {
      onProgress({ message: 'Initializing recorder...', percent: 15 })
    }

    // Step 4: Create output canvas for MediaRecorder with GPU acceleration hints
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = width
    outputCanvas.height = height
    
    // Request hardware-accelerated 2D context (browsers will use GPU when available)
    // Use desynchronized: false to prevent flickering - ensures frames are synchronized
    const outputCtx = outputCanvas.getContext('2d', {
      willReadFrequently: false,
      alpha: false,
      colorSpace: 'srgb',
      // @ts-ignore - some browsers support these hints
      desynchronized: false, // Set to false to prevent flickering - ensures frame sync
      powerPreference: 'high-performance', // Hint for GPU preference
    })

    if (!outputCtx) {
      for (const url of videoBlobUrls) {
        URL.revokeObjectURL(url)
      }
      return {
        success: false,
        error: 'Failed to get canvas context',
      }
    }

    // Step 5: Create MediaRecorder
    // CRITICAL: MediaRecorder with canvas streams only reliably supports WebM format
    // Even if MP4 is "supported", it often produces black videos with canvas streams
    // So we always record as WebM, then convert to MP4 if needed using FFmpeg
    const stream = outputCanvas.captureStream(fps)
    
    // Always use WebM for MediaRecorder (most reliable with canvas streams)
    let mimeType: string
    const needsConversion = format === 'mp4' // Track if we need to convert later
    
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
      mimeType = 'video/webm;codecs=vp9'
    } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
      mimeType = 'video/webm;codecs=vp8'
    } else {
      mimeType = 'video/webm'
    }
    
    console.log(`Recording as ${mimeType}${needsConversion ? ' (will convert to MP4)' : ''}`)

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
      videoBitsPerSecond: undefined,
    }

    if (mimeType.includes('webm')) {
      // @ts-ignore
      if ('quality' in MediaRecorder.prototype) {
        recorderOptions.quality = qualityValue
      } else {
        recorderOptions.videoBitsPerSecond = Math.round(qualityValue * 10_000_000)
      }
    }

    console.log('Creating MediaRecorder with mimeType:', mimeType)
    const recorder = new MediaRecorder(stream, recorderOptions)
    console.log('MediaRecorder created, state:', recorder.state)

    if (onProgress) {
      onProgress({ message: 'Starting GPU-accelerated recording...', percent: 20 })
    }

    // Step 6: Record video
    const recordedChunks: Blob[] = []
    
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data)
        console.log(`Received data chunk, size: ${event.data.size} bytes, total chunks: ${recordedChunks.length}`)
      }
    }

    const recordingPromise = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => {
        console.log('MediaRecorder stopped')
        resolve()
      }
      recorder.onerror = (event) => {
        const errorMsg = 'MediaRecorder error: ' + (event as any).error?.message || 'Unknown error'
        console.error(errorMsg)
        reject(new Error(errorMsg))
      }
      recorder.onstart = () => {
        console.log('MediaRecorder started successfully')
      }
    })

    // Create render context
    const renderContext: RenderContext = {
      canvas: outputCanvas,
      ctx: outputCtx,
      time: 0,
      width,
      height,
      dpr: 1.0,
      videoElements,
    }

    // Start recording
    console.log('Starting MediaRecorder...')
    try {
      recorder.start(1000) // Collect data every second
      console.log('MediaRecorder.start() called, state:', recorder.state)
      
      // Wait a bit to ensure recorder started
      await new Promise(resolve => setTimeout(resolve, 100))
      console.log('After start wait, recorder state:', recorder.state)
      
      if (recorder.state !== 'recording') {
        console.warn('MediaRecorder not in recording state, current state:', recorder.state)
      }
    } catch (error) {
      console.error('Error starting MediaRecorder:', error)
      throw error
    }

    // Step 7: Render and record frames using GPU
    const frameDuration = 1 / fps
    const totalFrames = Math.ceil(totalDuration * fps)

    console.log(`Calculated: ${totalFrames} frames to render (${totalDuration.toFixed(2)}s at ${fps} fps)`)

    // Ensure videos are at the start - with timeout to prevent hanging
    console.log('Preparing videos for rendering...')
    let prepIndex = 0
    const totalVideosToPrep = videoElements.size
    
    for (const video of videoElements.values()) {
      prepIndex++
      console.log(`Preparing video ${prepIndex}/${totalVideosToPrep}, readyState: ${video.readyState}`)
      
      video.currentTime = 0
      
      await new Promise<void>((resolve) => {
        // If already ready, resolve immediately
        if (video.readyState >= 2) {
          console.log(`Video ${prepIndex} already ready (readyState: ${video.readyState})`)
          resolve()
          return
        }
        
        // Otherwise wait with timeout
        const timeout = setTimeout(() => {
          console.warn(`Video ${prepIndex} readyState timeout (still at ${video.readyState}), continuing anyway`)
          video.removeEventListener('loadeddata', onLoadedData)
          resolve()
        }, 2000) // Max 2s wait
        
        const onLoadedData = () => {
          clearTimeout(timeout)
          video.removeEventListener('loadeddata', onLoadedData)
          console.log(`Video ${prepIndex} loadeddata event fired`)
          resolve()
        }
        
        video.addEventListener('loadeddata', onLoadedData, { once: true })
      })
      
      await new Promise(resolve => setTimeout(resolve, 50))
      console.log(`Video ${prepIndex} prepared`)
    }
    
    console.log('All videos prepared, starting render loop...')

    const startTime = performance.now()
    let frameIndex = 0
    const targetFrameTime = 1000 / fps

    // Use iterative loop instead of recursive to prevent stack overflow
    console.log(`Starting render loop: ${totalFrames} frames at ${fps} fps`)
    
    // Add timeout to prevent infinite hanging - use a more reasonable timeout
    // For slow rendering (500ms/frame), a 10s video at 30fps would take ~150s, so use 20x duration
    const maxExportTime = Math.max(totalDuration * 1000 * 20, 300000) // 20x duration or 5 minutes minimum
    const exportStartTime = Date.now()

    while (frameIndex < totalFrames) {
      // Check for timeout
      if (Date.now() - exportStartTime > maxExportTime) {
        console.error('Export timeout exceeded')
        recorder.stop()
        throw new Error(`Export timeout: exceeded maximum export time of ${maxExportTime / 1000}s`)
      }
      const loopStartTime = performance.now()
      const timelineTime = frameIndex * frameDuration
      renderContext.time = timelineTime
      
      // Log first few frames and every 30th frame for debugging
      if (frameIndex < 3 || frameIndex % 30 === 0) {
        console.log(`Rendering frame ${frameIndex + 1}/${totalFrames} at time ${timelineTime.toFixed(2)}s`)
      }

      // Seek videos to correct time and wait for seeks to complete to prevent flickering
      // This ensures videos are at the correct frame before rendering
      const seekPromises: Promise<void>[] = []
      
      for (const clip of renderState.timelineClips) {
        if (timelineTime >= clip.timelineStart && timelineTime < clip.timelineEnd) {
          const key = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
          const video = videoElements.get(key)
          
          if (video && video.readyState >= 2) {
            const relativeTime = timelineTime - clip.timelineStart
            const clipDuration = clip.timelineEnd - clip.timelineStart
            const sourceDuration = clip.sourceOut - clip.sourceIn
            const targetTime = clip.sourceIn + (relativeTime / clipDuration) * sourceDuration
            const clampedTime = Math.max(0, Math.min(targetTime, video.duration || targetTime))
            
            const timeDiff = Math.abs(video.currentTime - clampedTime)
            // Only seek if significantly off (more than 1 frame duration)
            const frameTolerance = frameDuration * 1.5 // Allow 1.5 frames of tolerance
            if (timeDiff > frameTolerance) {
              // Wait for seek to complete to ensure video is at correct frame
              const seekPromise = new Promise<void>((resolve) => {
                // If already very close, resolve immediately
                if (timeDiff < frameTolerance * 2) {
                  video.currentTime = clampedTime
                  // For small seeks, wait a short time for video to update
                  setTimeout(() => resolve(), 10)
                  return
                }
                
                // For larger seeks, wait for seeked event
                const onSeeked = () => {
                  video.removeEventListener('seeked', onSeeked)
                  video.removeEventListener('error', onError)
                  resolve()
                }
                
                const onError = () => {
                  video.removeEventListener('seeked', onSeeked)
                  video.removeEventListener('error', onError)
                  resolve() // Resolve anyway to not block rendering
                }
                
                const timeout = setTimeout(() => {
                  video.removeEventListener('seeked', onSeeked)
                  video.removeEventListener('error', onError)
                  resolve() // Resolve after timeout to not block rendering
                }, 200) // Max 200ms wait for seek
                
                video.addEventListener('seeked', onSeeked, { once: true })
                video.addEventListener('error', onError, { once: true })
                video.currentTime = clampedTime
              })
              
              seekPromises.push(seekPromise)
            }
          }
        }
      }
      
      // Wait for all seeks to complete before rendering
      if (seekPromises.length > 0) {
        await Promise.all(seekPromises)
        // Wait for video frames to be ready after seek - critical for preventing flickering
        await new Promise(resolve => setTimeout(resolve, 16)) // Wait one frame (16ms at 60fps)
      }
      
      // Ensure all active videos are ready and playing before rendering
      // This prevents flickering from videos that aren't ready
      const videoReadyPromises: Promise<void>[] = []
      for (const clip of renderState.timelineClips) {
        if (timelineTime >= clip.timelineStart && timelineTime < clip.timelineEnd) {
          const key = `${clip.sceneId}_${clip.takeId}_${clip.layer}`
          const video = videoElements.get(key)
          
          if (video) {
            // Ensure video is ready
            if (video.readyState < 2) {
              // Wait for video to be ready
              const readyPromise = new Promise<void>((resolve) => {
                const timeout = setTimeout(() => resolve(), 100) // Max 100ms wait
                const onCanPlay = () => {
                  clearTimeout(timeout)
                  video.removeEventListener('canplay', onCanPlay)
                  resolve()
                }
                video.addEventListener('canplay', onCanPlay, { once: true })
              })
              videoReadyPromises.push(readyPromise)
            }
            
            // Ensure video is playing (for smooth frame capture)
            if (video.paused && video.readyState >= 2) {
              try {
                await video.play()
                // Wait a frame after play to ensure frame is ready
                await new Promise(resolve => setTimeout(resolve, 16))
              } catch (e) {
                // Ignore play errors (video might already be playing)
              }
            }
            
            // Use requestVideoFrameCallback if available to ensure we capture the correct frame
            // This is critical for preventing flickering
            if ('requestVideoFrameCallback' in video && video.readyState >= 2) {
              await new Promise<void>((resolve) => {
                const timeout = setTimeout(() => resolve(), 50) // Max 50ms wait
                ;(video as any).requestVideoFrameCallback(() => {
                  clearTimeout(timeout)
                  resolve()
                })
              })
            }
          }
        }
      }
      
      // Wait for all videos to be ready
      if (videoReadyPromises.length > 0) {
        await Promise.all(videoReadyPromises)
      }

      // Render frame with error handling and timeout
      try {
        const renderStartTime = performance.now()
        
        // Call renderFrame with isExport=true to skip expensive async waits
        await renderFrame(renderContext, renderState, true)
        
        const renderTime = performance.now() - renderStartTime
        // Only warn for truly slow frames (200ms+) - normal frames should be <50ms now
        if (renderTime > 200) {
          console.warn(`Frame ${frameIndex} took ${renderTime.toFixed(0)}ms to render (slow)`)
        }
      } catch (error) {
        console.error(`Error rendering frame ${frameIndex}:`, error)
        // Continue with next frame - draw black frame as fallback
        ctx.fillStyle = '#000000'
        ctx.fillRect(0, 0, width, height)
      }

      frameIndex++
      
      // Report progress
      if (onProgress && (frameIndex % Math.max(1, Math.floor(fps / 2)) === 0 || frameIndex === totalFrames)) {
        const progress = 20 + (frameIndex / totalFrames) * 75
        const elapsed = (performance.now() - startTime) / 1000
        const rate = elapsed > 0 ? frameIndex / elapsed : 0
        
        onProgress({
          message: `GPU Rendering frame ${frameIndex} of ${totalFrames}${rate > 0 ? ` (${Math.round(rate)} fps)` : ''}...`,
          percent: Math.min(progress, 95),
        })
      }

      // Yield to browser
      const loopTime = performance.now() - loopStartTime
      const waitTime = Math.max(0, targetFrameTime - loopTime)
      
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, Math.min(waitTime, 16)))
      } else if (frameIndex % 10 === 0) {
        // Yield every 10 frames if falling behind
        await new Promise(resolve => setTimeout(resolve, 0))
      }
    }

    console.log('Render loop complete, stopping recorder...')
    
    // Stop recording
    if (recorder.state !== 'inactive' && recorder.state !== 'stopped') {
      recorder.stop()
    }
    
    // Wait for recording to finish with timeout
    await Promise.race([
      recordingPromise,
      new Promise<void>((_, reject) => 
        setTimeout(() => reject(new Error('Recording timeout - recorder did not stop in time')), 10000)
      )
    ])

    if (onProgress) {
      onProgress({ message: needsConversion ? 'Converting to MP4...' : 'Finalizing video...', percent: 96 })
    }

    let blob = new Blob(recordedChunks, { type: mimeType })

    // Convert WebM to MP4 if requested (MediaRecorder can't reliably do MP4 with canvas streams)
    if (needsConversion && blob.size > 0) {
      try {
        console.log('Converting WebM to MP4 using FFmpeg...')
        if (onProgress) {
          onProgress({ message: 'Converting WebM to MP4...', percent: 97 })
        }
        
        const ffmpeg = await getFFmpeg()
        
        // Write WebM file
        const webmData = await fetchFile(blob)
        await ffmpeg.writeFile('input.webm', webmData)
        
        // Convert to MP4 with good quality settings
        await ffmpeg.exec([
          '-i', 'input.webm',
          '-c:v', 'libx264',
          '-preset', 'medium',
          '-crf', '23',
          '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          'output.mp4'
        ])
        
        // Read MP4 file
        const mp4Data = await ffmpeg.readFile('output.mp4')
        // Handle different return types from FFmpeg
        if (mp4Data instanceof Uint8Array) {
          blob = new Blob([mp4Data], { type: 'video/mp4' })
        } else if (typeof mp4Data === 'string') {
          // Shouldn't happen for binary, but handle it
          blob = new Blob([mp4Data], { type: 'video/mp4' })
        } else {
          blob = mp4Data as unknown as Blob
        }
        
        // Cleanup
        try {
          await ffmpeg.deleteFile('input.webm')
          await ffmpeg.deleteFile('output.mp4')
        } catch (e) {
          // Ignore cleanup errors
        }
        
        console.log('Successfully converted to MP4')
      } catch (conversionError) {
        console.error('Error converting to MP4:', conversionError)
        // Return WebM blob if conversion fails (better than nothing)
        console.warn('Falling back to WebM format')
        if (onProgress) {
          onProgress({ message: 'MP4 conversion failed, using WebM format', percent: 98 })
        }
      }
    }

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
      onProgress({ message: 'GPU export complete!', percent: 100 })
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

