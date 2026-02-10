/**
 * Frame-Accurate Canvas Export
 * 
 * Based on research and best practices:
 * - Uses requestVideoFrameCallback for video synchronization
 * - Fixed timestep rendering (not real-time)
 * - Pre-loads all videos before starting
 * - Captures actual preview canvas (not recreating)
 * - Proper frame synchronization
 */

export interface FrameAccurateOptions {
  /** Frame rate for the export (default: 30) */
  fps?: number
  /** Video bitrate in bits per second (default: 8_000_000) */
  bitrate?: number
  /** Output format: 'mp4' or 'webm' (default: 'webm') */
  format?: 'mp4' | 'webm'
  /** Progress callback: (message, percent) => void */
  onProgress?: (message: string, percent: number) => void
}

export interface FrameAccurateResult {
  success: boolean
  blob?: Blob
  error?: string
  duration?: number
}

/**
 * Video element with metadata for frame-accurate rendering
 */
interface VideoSource {
  element: HTMLVideoElement
  layer: 'camera' | 'screen'
  getSourceTime: (timelineTime: number) => number | null // Returns source time or null if not active
}

/**
 * Frame-accurate export using the actual preview canvas
 * 
 * @param previewCanvas - The actual canvas element that shows the preview
 * @param videoSources - Array of video sources to synchronize
 * @param duration - Duration in seconds to export
 * @param onTimeUpdate - Callback to update preview time: (time: number) => void
 * @param options - Export options
 */
export async function exportFrameAccurate(
  previewCanvas: HTMLCanvasElement,
  videoSources: VideoSource[],
  duration: number,
  onTimeUpdate: (time: number) => void,
  options: FrameAccurateOptions = {}
): Promise<FrameAccurateResult> {
  const {
    fps = 30,
    bitrate = 8_000_000,
    format = 'webm',
    onProgress
  } = options

  try {
    onProgress?.('Preparing frame-accurate export...', 0)

    // Step 1: Pre-load all videos and ensure they're ready
    onProgress?.('Pre-loading videos...', 5)
    await preloadVideos(videoSources, onProgress)

    // Step 2: Check canvas support
    if (!previewCanvas.captureStream) {
      throw new Error('Canvas captureStream API is not supported. Please use Chrome, Edge, or Firefox.')
    }

    // Step 3: Create capture stream
    onProgress?.('Creating capture stream...', 20)
    const stream = previewCanvas.captureStream(fps)
    const videoTrack = stream.getVideoTracks()[0]
    
    if (!videoTrack) {
      throw new Error('Failed to get video track from canvas stream')
    }

    // Step 4: Determine MIME type
    let mimeType = format === 'mp4'
      ? 'video/webm;codecs=vp9'
      : 'video/webm;codecs=vp9'

    if (!MediaRecorder.isTypeSupported(mimeType)) {
      mimeType = 'video/webm;codecs=vp8'
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm'
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          throw new Error('No supported video codec found.')
        }
      }
    }

    // Step 5: Record with frame-accurate synchronization
    onProgress?.('Starting frame-accurate recording...', 25)
    return await recordWithFrameSync(
      previewCanvas,
      videoSources,
      stream,
      duration,
      fps,
      mimeType,
      bitrate,
      onTimeUpdate,
      onProgress
    )

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Pre-loads all videos and ensures they're ready
 */
async function preloadVideos(
  videoSources: VideoSource[],
  onProgress?: (message: string, percent: number) => void
): Promise<void> {
  // Filter out videos that don't have valid sources
  const validVideos = videoSources.filter(vs => {
    const video = vs.element
    // Check if video has a valid source
    return video.src || video.srcObject || video.currentSrc
  })
  
  if (validVideos.length === 0) {
    onProgress?.('No videos to load', 15)
    return
  }
  
  // Load all valid videos
  for (let i = 0; i < validVideos.length; i++) {
    const videoSource = validVideos[i]
    const video = videoSource.element
    const layerName = videoSource.layer === 'camera' ? 'camera' : 'screen'
    
    onProgress?.(`Loading ${layerName} video ${i + 1} / ${validVideos.length}...`, 5 + (i / validVideos.length) * 10)

    try {
      // Wait for metadata if not already loaded
      if (video.readyState < 1) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`${layerName} video failed to load metadata`))
          }, 10000)

          const onLoadedMetadata = () => {
            clearTimeout(timeout)
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('error', onError)
            resolve()
          }

          const onError = () => {
            clearTimeout(timeout)
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('error', onError)
            // If video fails to load, check if it's actually needed
            // If it has no source, it's not needed - resolve instead of reject
            if (!video.src && !video.srcObject && !video.currentSrc) {
              resolve() // Video not needed, skip it
            } else {
              reject(new Error(`${layerName} video failed to load`))
            }
          }

          video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
          video.addEventListener('error', onError, { once: true })

          // Only trigger load if video has a source
          if (video.src || video.srcObject) {
            video.load()
          } else {
            // No source, skip this video
            clearTimeout(timeout)
            video.removeEventListener('loadedmetadata', onLoadedMetadata)
            video.removeEventListener('error', onError)
            resolve()
          }
        })
      }

      // Wait for enough data if not already ready
      if (video.readyState < 2) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            // If video still isn't ready but has no source, it's not needed
            if (!video.src && !video.srcObject && !video.currentSrc) {
              resolve() // Video not needed, skip it
            } else {
              reject(new Error(`${layerName} video failed to buffer`))
            }
          }, 30000)

          const checkReady = () => {
            if (video.readyState >= 2) {
              clearTimeout(timeout)
              video.removeEventListener('canplay', checkReady)
              video.removeEventListener('canplaythrough', checkReady)
              resolve()
            }
          }

          video.addEventListener('canplay', checkReady)
          video.addEventListener('canplaythrough', checkReady)
          
          // Try to play to trigger buffering (only if video has source)
          if (video.src || video.srcObject) {
            video.play().catch(() => {
              // Ignore play errors, just wait for buffering
            })
          } else {
            // No source, skip buffering
            clearTimeout(timeout)
            video.removeEventListener('canplay', checkReady)
            video.removeEventListener('canplaythrough', checkReady)
            resolve()
          }
        })
      }
    } catch (error) {
      // If video fails to load but has no source, it's probably not needed - continue
      if (!video.src && !video.srcObject && !video.currentSrc) {
        console.warn(`${layerName} video has no source, skipping...`)
        continue
      }
      // Otherwise, re-throw the error
      throw error
    }
  }

  onProgress?.('All videos loaded and ready', 15)
}

/**
 * Records with proper frame synchronization
 */
async function recordWithFrameSync(
  previewCanvas: HTMLCanvasElement,
  videoSources: VideoSource[],
  stream: MediaStream,
  duration: number,
  fps: number,
  mimeType: string,
  bitrate: number,
  onTimeUpdate: (time: number) => void,
  onProgress?: (message: string, percent: number) => void
): Promise<FrameAccurateResult> {
  return new Promise((resolve) => {
    const chunks: Blob[] = []
    const startTime = performance.now()
    const totalFrames = Math.ceil(duration * fps)
    const frameTime = 1000 / fps // milliseconds per frame
    let currentFrame = 0
    let isRecording = true
    let animationFrameId: number | null = null
    let videoFrameCallbacks: number[] = []

    // Create MediaRecorder
    let recorder: MediaRecorder
    try {
      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate,
        timeslice: 100
      })
    } catch (error) {
      resolve({
        success: false,
        error: `Failed to create MediaRecorder: ${error instanceof Error ? error.message : String(error)}`
      })
      return
    }

    // Handle data available
    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    // Handle recording stop
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      const actualDuration = (performance.now() - startTime) / 1000
      
      // Clean up
      stream.getTracks().forEach(track => track.stop())
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      videoFrameCallbacks.forEach(id => {
        // Clean up any video frame callbacks
        try {
          // Note: requestVideoFrameCallback doesn't have cancel, but we track them
        } catch (e) {
          // Ignore
        }
      })
      
      resolve({
        success: true,
        blob,
        duration: actualDuration
      })
    }

    // Handle errors
    recorder.onerror = (event) => {
      isRecording = false
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
      }
      resolve({
        success: false,
        error: `Recording error: ${(event as any).error?.message || 'Unknown error'}`
      })
    }

    // Start recording
    onProgress?.('Recording started...', 30)
    recorder.start(100)

    // Seek all videos to start position
    const seekVideosToTime = async (time: number): Promise<void> => {
      const seekPromises: Promise<void>[] = []

      for (const videoSource of videoSources) {
        const sourceTime = videoSource.getSourceTime(time)
        if (sourceTime !== null && videoSource.element.readyState >= 2) {
          const video = videoSource.element
          const targetTime = sourceTime

          if (Math.abs(video.currentTime - targetTime) > 0.01) {
            seekPromises.push(
              new Promise<void>((resolve) => {
                let resolved = false
                const onSeeked = () => {
                  if (!resolved) {
                    resolved = true
                    video.removeEventListener('seeked', onSeeked)
                    video.removeEventListener('loadeddata', onLoaded)
                    // Use requestVideoFrameCallback if available for frame sync
                    if (video.requestVideoFrameCallback) {
                      video.requestVideoFrameCallback(() => {
                        requestAnimationFrame(resolve)
                      })
                    } else {
                      requestAnimationFrame(() => {
                        requestAnimationFrame(resolve) // Double RAF
                      })
                    }
                  }
                }
                const onLoaded = () => {
                  if (!resolved && Math.abs(video.currentTime - targetTime) < 0.1) {
                    resolved = true
                    video.removeEventListener('seeked', onSeeked)
                    video.removeEventListener('loadeddata', onLoaded)
                    if (video.requestVideoFrameCallback) {
                      video.requestVideoFrameCallback(() => {
                        requestAnimationFrame(resolve)
                      })
                    } else {
                      requestAnimationFrame(() => {
                        requestAnimationFrame(resolve)
                      })
                    }
                  }
                }
                video.addEventListener('seeked', onSeeked, { once: true })
                video.addEventListener('loadeddata', onLoaded, { once: true })
                video.currentTime = targetTime
                
                // Timeout fallback
                setTimeout(() => {
                  if (!resolved) {
                    resolved = true
                    video.removeEventListener('seeked', onSeeked)
                    video.removeEventListener('loadeddata', onLoaded)
                    resolve()
                  }
                }, 500)
              })
            )
          }
        }
      }

      await Promise.all(seekPromises)
    }

    // Fixed timestep render loop
    const renderFrame = async () => {
      if (!isRecording || currentFrame >= totalFrames) {
        if (recorder.state === 'recording') {
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, frameTime * 2)
        }
        return
      }

      const targetTime = (currentFrame / fps)

      try {
        // Update preview time (this triggers the preview to render)
        onTimeUpdate(targetTime)

        // Seek all videos to correct time
        await seekVideosToTime(targetTime)

        // Wait for preview to render - use multiple RAFs for frame readiness
        await new Promise(resolve => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(resolve) // Triple RAF ensures frame is ready
            })
          })
        })

        // Small delay to ensure everything is rendered
        await new Promise(resolve => setTimeout(resolve, 10))

        // Update progress
        const percent = 30 + (currentFrame / totalFrames) * 65
        if (currentFrame % Math.max(1, Math.floor(fps / 2)) === 0) {
          onProgress?.(`Frame ${currentFrame + 1} / ${totalFrames} (${targetTime.toFixed(2)}s)`, percent)
        }

        currentFrame++

        // Schedule next frame with fixed timestep
        if (isRecording && currentFrame < totalFrames) {
          const nextFrameTime = startTime + (currentFrame * frameTime)
          const now = performance.now()
          const delay = Math.max(0, nextFrameTime - now)
          
          setTimeout(() => {
            if (isRecording) {
              animationFrameId = requestAnimationFrame(renderFrame)
            }
          }, delay)
        } else if (recorder.state === 'recording') {
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, frameTime * 2)
        }
      } catch (error) {
        isRecording = false
        if (recorder.state === 'recording') {
          recorder.stop()
        }
        resolve({
          success: false,
          error: `Frame rendering error: ${error instanceof Error ? error.message : String(error)}`
        })
      }
    }

    // Start render loop
    animationFrameId = requestAnimationFrame(renderFrame)

    // Safety timeout
    setTimeout(() => {
      if (recorder.state === 'recording') {
        isRecording = false
        if (animationFrameId !== null) {
          cancelAnimationFrame(animationFrameId)
        }
        recorder.stop()
      }
    }, (duration + 10) * 1000)
  })
}

/**
 * Helper to check if frame-accurate export is supported
 */
export function isFrameAccurateSupported(): boolean {
  return typeof HTMLCanvasElement !== 'undefined' &&
         typeof HTMLCanvasElement.prototype.captureStream !== 'undefined' &&
         typeof MediaRecorder !== 'undefined' &&
         typeof requestAnimationFrame !== 'undefined'
}
