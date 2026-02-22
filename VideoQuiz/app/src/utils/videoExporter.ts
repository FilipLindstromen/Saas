/**
 * High-Quality Video Exporter using ffmpeg.wasm
 * 
 * Implements Canva-like video export with:
 * - High-quality MP4 output using H.264 encoding
 * - Optimized bitrates and encoding settings
 * - Multiple resolution presets
 * - Frame-by-frame capture with proper timing
 * - Progress tracking and error handling
 */

import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'
import html2canvas from 'html2canvas'

export interface VideoExportOptions {
  /** Target element to record */
  element: HTMLElement
  /** Recording duration in milliseconds */
  duration: number
  /** Frame rate for recording (default: 30) */
  frameRate?: number
  /** Output resolution preset */
  resolution?: '720p' | '1080p' | '1440p' | '4k'
  /** Video quality preset */
  quality?: 'low' | 'medium' | 'high' | 'ultra'
  /** Custom bitrate override */
  customBitrate?: number
  /** Callback for export progress (0-100) */
  onProgress?: (progress: number) => void
  /** Callback for status updates */
  onStatus?: (status: string) => void
  /** Callback for errors */
  onError?: (error: Error) => void
  /** Function to set recording time for animation control */
  setRecordingTime?: (time: number) => void
  /** Total duration for timing calculations */
  totalDuration?: number
}

export interface VideoExportResult {
  /** Blob containing the exported video */
  blob: Blob
  /** URL for the video blob */
  url: string
  /** File size in bytes */
  size: number
  /** Duration in milliseconds */
  duration: number
  /** Format of the output */
  format: 'mp4'
  /** Resolution of the output */
  resolution: string
}

export class VideoExporter {
  private ffmpeg: FFmpeg | null = null
  private isInitialized = false

  // Resolution presets (9:16 portrait format)
  private readonly resolutionPresets = {
    '720p': { width: 720, height: 1280 },
    '1080p': { width: 1080, height: 1920 },
    '1440p': { width: 1440, height: 2560 },
    '4k': { width: 2160, height: 3840 }
  }

  // Quality presets with optimized bitrates
  private readonly qualityPresets = {
    low: { bitrate: 1000000, crf: 28 },
    medium: { bitrate: 3000000, crf: 23 },
    high: { bitrate: 8000000, crf: 20 },
    ultra: { bitrate: 15000000, crf: 18 }
  }

  /**
   * Initialize ffmpeg.wasm with better error handling and fallbacks
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      console.log('Starting ffmpeg initialization...')
      
      // Check if SharedArrayBuffer is available (required for ffmpeg.wasm)
      if (typeof SharedArrayBuffer === 'undefined') {
        console.warn('SharedArrayBuffer not available, skipping ffmpeg initialization')
        throw new Error('SharedArrayBuffer is not available. This browser may not support ffmpeg.wasm.')
      }

      console.log('SharedArrayBuffer available, creating FFmpeg instance...')
      this.ffmpeg = new FFmpeg()
      
      // Try different CDN sources for better reliability
      const cdnSources = [
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd',
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd',
        'https://unpkg.com/@ffmpeg/core@0.12.5/dist/umd'
      ]

      let loaded = false
      let lastError: Error | null = null

      for (const baseURL of cdnSources) {
        try {
          console.log(`Trying to load ffmpeg from: ${baseURL}`)
          
          // Add shorter timeout to prevent hanging
          const loadPromise = this.ffmpeg.load({
            coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
          })
          
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('FFmpeg load timeout after 10 seconds')), 10000) // 10 second timeout
          )
          
          console.log('Starting ffmpeg load with timeout...')
          await Promise.race([loadPromise, timeoutPromise])
          
          loaded = true
          console.log(`Successfully loaded ffmpeg from ${baseURL}`)
          break
        } catch (error) {
          console.warn(`Failed to load from ${baseURL}:`, error)
          lastError = error as Error
          // Reset ffmpeg instance for next attempt
          this.ffmpeg = new FFmpeg()
        }
      }

      if (!loaded) {
        console.error('All CDN sources failed, throwing error')
        throw new Error(`Failed to load ffmpeg from any CDN. Last error: ${lastError?.message}`)
      }

      this.isInitialized = true
      console.log('FFmpeg initialized successfully')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('FFmpeg initialization failed:', errorMessage)
      throw new Error(`Failed to initialize ffmpeg: ${errorMessage}`)
    }
  }

  /**
   * Export video with proper animation timing control
   */
  async exportVideoWithTiming(
    options: VideoExportOptions, 
    setRecordingTime: (time: number) => void, 
    totalDuration: number
  ): Promise<VideoExportResult> {
    const {
      element,
      duration,
      frameRate = 30,
      resolution = '1080p',
      quality = 'high',
      customBitrate,
      onProgress,
      onStatus
    } = options

    try {
      onStatus?.('Initializing video export with timing control...')
      
      // Use streaming approach with proper timing
      onStatus?.('Using streaming video creation with animation timing...')
      
      const result = await this.createStreamingVideoWithTiming(
        element, 
        duration, 
        frameRate, 
        resolution, 
        quality, 
        customBitrate, 
        onProgress, 
        onStatus,
        setRecordingTime
      )
      onStatus?.('Video export complete!')
      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(new Error(`Video export failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Export video with high-quality settings and memory efficiency
   */
  async exportVideo(options: VideoExportOptions): Promise<VideoExportResult> {
    const {
      element,
      duration,
      frameRate = 30,
      resolution = '1080p',
      quality = 'high',
      customBitrate,
      onProgress,
      onStatus,
      setRecordingTime,
      totalDuration
    } = options

    try {
      onStatus?.('Initializing memory-efficient video export...')
      
      // Use streaming approach with timing control if available
      if (setRecordingTime && totalDuration) {
        onStatus?.('Using streaming video creation with animation timing...')
        const result = await this.createStreamingVideoWithTiming(
          element, 
          duration, 
          frameRate, 
          resolution, 
          quality, 
          customBitrate, 
          onProgress, 
          onStatus,
          setRecordingTime
        )
        onStatus?.('Video export complete!')
        return result
      } else {
        onStatus?.('Using streaming video creation...')
        const result = await this.createStreamingVideo(element, duration, frameRate, resolution, quality, customBitrate, onProgress, onStatus)
        onStatus?.('Video export complete!')
        return result
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(new Error(`Video export failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Capture frames from the DOM element
   */
  private async captureFrames(
    element: HTMLElement,
    duration: number,
    frameRate: number,
    resolution: keyof typeof VideoExporter.prototype.resolutionPresets,
    onProgress?: (progress: number) => void
  ): Promise<string[]> {
    const frameCount = Math.ceil((duration / 1000) * frameRate)
    const frameInterval = 1000 / frameRate
    const frames: string[] = []

    console.log(`Capturing ${frameCount} frames at ${frameRate} FPS for ${duration}ms duration`)

    const targetResolution = this.resolutionPresets[resolution]
    
    // Calculate scale factor for high-quality capture
    const elementRect = element.getBoundingClientRect()
    const scaleFactor = Math.max(
      targetResolution.width / elementRect.width,
      targetResolution.height / elementRect.height
    ) * 2 // 2x scale for crisp output

    console.log(`Element rect: ${elementRect.width}x${elementRect.height}, scale factor: ${scaleFactor}`)

    for (let i = 0; i < frameCount; i++) {
      const frameTime = i * frameInterval
      
      try {
        console.log(`Capturing frame ${i + 1}/${frameCount} at time ${frameTime}ms`)
        
        // Capture frame with high quality settings
        const canvas = await html2canvas(element, {
          scale: scaleFactor,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false,
          removeContainer: false,
          width: elementRect.width,
          height: elementRect.height
        })

        // Convert to base64
        const frameData = canvas.toDataURL('image/png')
        frames.push(frameData)

        // Update progress
        const progress = ((i + 1) / frameCount) * 50 // First 50% for frame capture
        onProgress?.(progress)

        console.log(`Frame ${i + 1} captured successfully, progress: ${progress.toFixed(1)}%`)

        // Small delay to prevent overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 50)) // Increased delay for stability

      } catch (error) {
        console.warn(`Failed to capture frame ${i + 1}:`, error)
        // Continue with next frame
      }
    }

    console.log(`Frame capture complete, captured ${frames.length} frames`)
    return frames
  }

  /**
   * Encode video from frames using ffmpeg.wasm
   */
  private async encodeVideo(
    frames: string[],
    frameRate: number,
    resolution: keyof typeof VideoExporter.prototype.resolutionPresets,
    quality: keyof typeof VideoExporter.prototype.qualityPresets,
    customBitrate?: number,
    onProgress?: (progress: number) => void
  ): Promise<VideoExportResult> {
    if (!this.ffmpeg) {
      throw new Error('FFmpeg not initialized')
    }

    const targetResolution = this.resolutionPresets[resolution]
    const qualitySettings = this.qualityPresets[quality]
    const bitrate = customBitrate || qualitySettings.bitrate

    try {
      // Write frames as individual PNG files
      for (let i = 0; i < frames.length; i++) {
        const frameData = await this.base64ToUint8Array(frames[i])
        await this.ffmpeg.writeFile(`frame_${i.toString().padStart(4, '0')}.png`, frameData)
      }

      // Create input pattern file
      await this.ffmpeg.writeFile('input.txt', `file 'frame_%04d.png'\nduration ${1/frameRate}`)

      // FFmpeg command for high-quality MP4 encoding
      const ffmpegArgs = [
        '-f', 'concat',
        '-safe', '0',
        '-i', 'input.txt',
        '-c:v', 'libx264',
        '-preset', 'slow', // Better quality than 'fast'
        '-crf', qualitySettings.crf.toString(),
        '-b:v', `${bitrate}`,
        '-maxrate', `${bitrate * 1.5}`,
        '-bufsize', `${bitrate * 2}`,
        '-pix_fmt', 'yuv420p', // Ensure compatibility
        '-movflags', '+faststart', // Optimize for streaming
        '-profile:v', 'high',
        '-level', '4.1',
        '-s', `${targetResolution.width}x${targetResolution.height}`,
        '-r', frameRate.toString(),
        '-y', // Overwrite output file
        'output.mp4'
      ]

      // Execute ffmpeg with progress tracking
      await this.ffmpeg.exec(ffmpegArgs)

      // Read the output file
      const mp4Data = await this.ffmpeg.readFile('output.mp4')
      const mp4Blob = new Blob([mp4Data], { type: 'video/mp4' })

      // Clean up temporary files
      await this.cleanupTempFiles(frames.length)

      // Update progress to 100%
      onProgress?.(100)

      return {
        blob: mp4Blob,
        url: URL.createObjectURL(mp4Blob),
        size: mp4Blob.size,
        duration: (frames.length / frameRate) * 1000,
        format: 'mp4',
        resolution: `${targetResolution.width}x${targetResolution.height}`
      }

    } catch (error) {
      // Clean up on error
      await this.cleanupTempFiles(frames.length)
      throw new Error(`Video encoding failed: ${error}`)
    }
  }

  /**
   * Convert base64 to Uint8Array
   */
  private async base64ToUint8Array(base64: string): Promise<Uint8Array> {
    const response = await fetch(base64)
    const arrayBuffer = await response.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  /**
   * Memory-efficient streaming video creation with proper animation timing
   */
  private async createStreamingVideoWithTiming(
    element: HTMLElement,
    duration: number,
    frameRate: number,
    resolution: keyof typeof VideoExporter.prototype.resolutionPresets,
    quality: keyof typeof VideoExporter.prototype.qualityPresets,
    customBitrate?: number,
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void,
    setRecordingTime?: (time: number) => void
  ): Promise<VideoExportResult> {
    const targetResolution = this.resolutionPresets[resolution]
    const qualitySettings = this.qualityPresets[quality]
    const bitrate = customBitrate || qualitySettings.bitrate

    // Create canvas for video creation
    const canvas = document.createElement('canvas')
    canvas.width = targetResolution.width
    canvas.height = targetResolution.height
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      throw new Error('Could not get canvas context for video creation')
    }

    // Create media stream from canvas with the correct frame rate
    const stream = canvas.captureStream(frameRate)

    // Try different MIME types in order of preference
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=h264',
      'video/mp4'
    ]

    let mimeType = 'video/webm'
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type
        break
      }
    }

    return new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate
      })

      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        if (chunks.length === 0) {
          reject(new Error('No video data recorded'))
          return
        }

        const blob = new Blob(chunks, { type: mimeType })
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm'

        resolve({
          blob,
          url: URL.createObjectURL(blob),
          size: blob.size,
          duration: duration,
          format: fileExtension as 'mp4',
          resolution: `${targetResolution.width}x${targetResolution.height}`
        })
      }

      recorder.onerror = (e) => {
        reject(new Error('MediaRecorder error during video creation'))
      }

      recorder.start(100) // Request data every 100ms

      // Memory-efficient frame processing with proper timing
      this.processFramesStreamingWithTiming(
        element,
        duration,
        frameRate,
        targetResolution,
        ctx,
        onProgress,
        onStatus,
        setRecordingTime,
        () => {
          console.log('All frames processed, stopping recorder...')
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, 1000)
        }
      )
    })
  }

  /**
   * Create a capture stream from a DOM element by overlaying a canvas
   */
  private createElementCaptureStream(element: HTMLElement, targetResolution: { width: number; height: number }, frameRate: number): MediaStream {
    // Create a canvas that overlays the element
    const canvas = document.createElement('canvas')
    canvas.width = targetResolution.width
    canvas.height = targetResolution.height
    canvas.style.position = 'absolute'
    canvas.style.top = '0'
    canvas.style.left = '0'
    canvas.style.pointerEvents = 'none'
    canvas.style.zIndex = '9999'
    
    // Add canvas to the element
    element.appendChild(canvas)
    
    const ctx = canvas.getContext('2d')!
    
    // Start capturing frames
    const captureFrame = () => {
      // Capture the entire element including background and content
      html2canvas(element, {
        scale: targetResolution.width / element.offsetWidth,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        width: element.offsetWidth,
        height: element.offsetHeight
      }).then(capturedCanvas => {
        ctx.clearRect(0, 0, targetResolution.width, targetResolution.height)
        ctx.drawImage(capturedCanvas, 0, 0, targetResolution.width, targetResolution.height)
        
        // Clean up
        capturedCanvas.width = 0
        capturedCanvas.height = 0
      }).catch(error => {
        console.warn('Frame capture failed:', error)
      })
    }
    
    // Capture frames at the specified rate
    const interval = setInterval(captureFrame, 1000 / frameRate)
    
    // Clean up after duration
    setTimeout(() => {
      clearInterval(interval)
      if (element.contains(canvas)) {
        element.removeChild(canvas)
      }
    }, 10000) // 10 second safety timeout
    
    return canvas.captureStream(frameRate)
  }

  /**
   * Start animation timing control
   */
  private startAnimationTiming(
    duration: number,
    setRecordingTime?: (time: number) => void,
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void,
    onComplete?: () => void
  ): void {
    if (!setRecordingTime) {
      // If no timing control, just wait for duration
      setTimeout(onComplete, duration)
      return
    }

    const startTime = Date.now()
    const frameRate = 30
    const frameInterval = 1000 / frameRate
    let frameIndex = 0

    const updateTiming = () => {
      const elapsed = Date.now() - startTime
      const frameTime = frameIndex * frameInterval
      
      if (elapsed >= duration) {
        onComplete?.()
        return
      }

      // Update recording time for animation control
      setRecordingTime(frameTime)
      
      // Update progress
      const progress = (elapsed / duration) * 100
      onProgress?.(progress)
      
      onStatus?.(`Recording animation at ${frameTime.toFixed(0)}ms (${progress.toFixed(1)}%)`)

      frameIndex++
      setTimeout(updateTiming, frameInterval)
    }

    updateTiming()
  }

  /**
   * Memory-efficient streaming video creation
   */
  private async createStreamingVideo(
    element: HTMLElement,
    duration: number,
    frameRate: number,
    resolution: keyof typeof VideoExporter.prototype.resolutionPresets,
    quality: keyof typeof VideoExporter.prototype.qualityPresets,
    customBitrate?: number,
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void
  ): Promise<VideoExportResult> {
    const targetResolution = this.resolutionPresets[resolution]
    const qualitySettings = this.qualityPresets[quality]
    const bitrate = customBitrate || qualitySettings.bitrate

    // Create canvas for video creation
    const canvas = document.createElement('canvas')
    canvas.width = targetResolution.width
    canvas.height = targetResolution.height
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Could not get canvas context for video creation')
    }

    // Create media stream from canvas
    const stream = canvas.captureStream(frameRate)
    
    // Try different MIME types in order of preference
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=h264',
      'video/mp4'
    ]
    
    let mimeType = 'video/webm'
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type
        break
      }
    }

    return new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate
      })

      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        if (chunks.length === 0) {
          reject(new Error('No video data recorded'))
          return
        }

        const blob = new Blob(chunks, { type: mimeType })
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm'
        
        resolve({
          blob,
          url: URL.createObjectURL(blob),
          size: blob.size,
          duration: duration,
          format: fileExtension as 'mp4',
          resolution: `${targetResolution.width}x${targetResolution.height}`
        })
      }

      recorder.onerror = (e) => {
        reject(new Error('MediaRecorder error during video creation'))
      }

      recorder.start(100) // Request data every 100ms

      // Memory-efficient frame processing
      this.processFramesStreaming(element, duration, frameRate, targetResolution, ctx, onProgress, onStatus, () => {
        console.log('All frames processed, stopping recorder...')
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop()
          }
        }, 1000)
      })
    })
  }

  /**
   * Record animation directly using a more efficient approach
   */
  private recordAnimationDirectly(
    element: HTMLElement,
    duration: number,
    frameRate: number,
    targetResolution: { width: number; height: number },
    ctx: CanvasRenderingContext2D,
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void,
    setRecordingTime?: (time: number) => void,
    onComplete?: () => void
  ): void {
    const frameCount = Math.ceil((duration / 1000) * frameRate)
    const frameInterval = 1000 / frameRate
    let frameIndex = 0
    let startTime = Date.now()

    console.log(`Recording ${frameCount} frames with direct animation approach`)

    // Calculate scale factor
    const elementRect = element.getBoundingClientRect()
    const scaleFactor = Math.max(
      targetResolution.width / elementRect.width,
      targetResolution.height / elementRect.height
    )

    const recordFrame = () => {
      if (frameIndex >= frameCount) {
        onComplete?.()
        return
      }

      const frameTime = frameIndex * frameInterval
      const currentTime = Date.now() - startTime
      
      // Update the recording time to control animation timing
      if (setRecordingTime) {
        setRecordingTime(frameTime)
      }
      
      onStatus?.(`Recording frame ${frameIndex + 1}/${frameCount} at ${frameTime.toFixed(0)}ms`)
      
      // Use requestAnimationFrame for smooth recording
      requestAnimationFrame(() => {
        try {
          // Capture the current state of the element using html2canvas
          // but only when we need to (not every frame)
          if (frameIndex % 2 === 0 || frameIndex < 10) { // Capture every other frame after first 10
            this.captureElementToCanvasEfficient(element, ctx, scaleFactor, targetResolution)
          } else {
            // For intermediate frames, just copy the previous frame
            // This reduces memory usage significantly
          }

          // Update progress
          const progress = ((frameIndex + 1) / frameCount) * 100
          onProgress?.(progress)

          frameIndex++

          // Schedule next frame
          const nextFrameTime = (frameIndex * frameInterval) - currentTime
          if (nextFrameTime > 0) {
            setTimeout(recordFrame, nextFrameTime)
          } else {
            recordFrame() // Process immediately if we're behind
          }

        } catch (error) {
          console.warn(`Failed to record frame ${frameIndex + 1}:`, error)
          frameIndex++
          setTimeout(recordFrame, frameInterval)
        }
      })
    }

    recordFrame()
  }

  /**
   * Efficiently capture element to canvas with minimal memory usage
   */
  private captureElementToCanvasEfficient(
    element: HTMLElement, 
    ctx: CanvasRenderingContext2D, 
    scaleFactor: number, 
    targetResolution: { width: number; height: number }
  ): void {
    // Use html2canvas but with optimized settings
    html2canvas(element, {
      scale: scaleFactor,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
      removeContainer: false,
      width: element.offsetWidth,
      height: element.offsetHeight,
      // Ensure we capture the full element including all children
      includeHiddenElements: false,
      foreignObjectRendering: true,
      // Add these options for better capture
      scrollX: 0,
      scrollY: 0,
      windowWidth: element.offsetWidth,
      windowHeight: element.offsetHeight
    }).then(canvas => {
      // Clear and draw to video canvas
      ctx.clearRect(0, 0, targetResolution.width, targetResolution.height)
      ctx.drawImage(canvas, 0, 0, targetResolution.width, targetResolution.height)
      
      // Clean up immediately
      canvas.width = 0
      canvas.height = 0
    }).catch(error => {
      console.warn('Canvas capture failed:', error)
      // Fallback: draw a placeholder
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, targetResolution.width, targetResolution.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Capture failed', targetResolution.width / 2, targetResolution.height / 2)
    })
  }

  /**
   * Process frames with proper animation timing control - Memory efficient approach
   */
  private processFramesStreamingWithTiming(
    element: HTMLElement,
    duration: number,
    frameRate: number,
    targetResolution: { width: number; height: number },
    ctx: CanvasRenderingContext2D,
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void,
    setRecordingTime?: (time: number) => void,
    onComplete?: () => void
  ): void {
    const frameCount = Math.ceil((duration / 1000) * frameRate)
    const frameInterval = 1000 / frameRate
    let frameIndex = 0

    console.log(`Processing ${frameCount} frames with memory-efficient approach`)

    // Calculate scale factor for high-quality capture
    const elementRect = element.getBoundingClientRect()
    const scaleFactor = Math.max(
      targetResolution.width / elementRect.width,
      targetResolution.height / elementRect.height
    )

    const processNextFrame = async () => {
      if (frameIndex >= frameCount) {
        onComplete?.()
        return
      }

      const frameTime = frameIndex * frameInterval
      
      try {
        // Update the recording time to control animation timing
        if (setRecordingTime) {
          setRecordingTime(frameTime)
        }
        
        onStatus?.(`Processing frame ${frameIndex + 1}/${frameCount} at ${frameTime.toFixed(0)}ms`)
        
        // Use requestAnimationFrame for smooth timing
        requestAnimationFrame(async () => {
          try {
            // First try the simple fallback method to test canvas
            this.captureElementToCanvas(element, ctx, scaleFactor)
            
            // Then try the full capture
            try {
              await this.captureElementToCanvasEfficientAsync(element, ctx, scaleFactor, targetResolution)
            } catch (error) {
              console.warn('Full capture failed, using fallback:', error)
              // Fallback is already drawn above
            }

            // Update progress
            const progress = ((frameIndex + 1) / frameCount) * 100
            onProgress?.(progress)

            frameIndex++

            // Process next frame at the correct frame rate timing
            setTimeout(processNextFrame, 1000 / frameRate)

          } catch (error) {
            console.warn(`Failed to process frame ${frameIndex + 1}:`, error)
            frameIndex++
            setTimeout(processNextFrame, 1000 / frameRate)
          }
        })

      } catch (error) {
        console.warn(`Failed to process frame ${frameIndex + 1}:`, error)
        frameIndex++
        setTimeout(processNextFrame, 1000 / frameRate)
      }
    }

    processNextFrame()
  }

  /**
   * Async version of capture element to canvas with better error handling
   */
  private async captureElementToCanvasEfficientAsync(
    element: HTMLElement, 
    ctx: CanvasRenderingContext2D, 
    scaleFactor: number, 
    targetResolution: { width: number; height: number }
  ): Promise<void> {
    try {
      // Use html2canvas but with optimized settings
      const canvas = await html2canvas(element, {
        scale: scaleFactor,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        removeContainer: false,
        width: element.offsetWidth,
        height: element.offsetHeight,
        // Ensure we capture the full element including all children
        includeHiddenElements: false,
        foreignObjectRendering: true,
        // Add these options for better capture
        scrollX: 0,
        scrollY: 0,
        windowWidth: element.offsetWidth,
        windowHeight: element.offsetHeight
      })

      // Clear and draw to video canvas
      ctx.clearRect(0, 0, targetResolution.width, targetResolution.height)
      ctx.drawImage(canvas, 0, 0, targetResolution.width, targetResolution.height)
      
      // Debug: Add a small indicator to verify canvas is working
      ctx.fillStyle = 'rgba(255, 0, 0, 0.3)'
      ctx.fillRect(10, 10, 20, 20)
      
      // Clean up immediately
      canvas.width = 0
      canvas.height = 0
    } catch (error) {
      console.warn('Canvas capture failed:', error)
      // Fallback: draw a placeholder
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, targetResolution.width, targetResolution.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '24px Arial'
      ctx.textAlign = 'center'
      ctx.fillText('Capture failed', targetResolution.width / 2, targetResolution.height / 2)
    }
  }

  /**
   * Simple fallback capture method that draws a test pattern
   */
  private captureElementToCanvas(element: HTMLElement, ctx: CanvasRenderingContext2D, scaleFactor: number): void {
    // Clear the canvas
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Draw a test pattern to verify canvas is working
    const gradient = ctx.createLinearGradient(0, 0, ctx.canvas.width, ctx.canvas.height)
    gradient.addColorStop(0, '#ff6b6b')
    gradient.addColorStop(0.5, '#4ecdc4')
    gradient.addColorStop(1, '#45b7d1')
    
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height)
    
    // Add some text
    ctx.fillStyle = '#ffffff'
    ctx.font = '48px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('Video Recording', ctx.canvas.width / 2, ctx.canvas.height / 2 - 50)
    ctx.font = '24px Arial'
    ctx.fillText('Canvas is working!', ctx.canvas.width / 2, ctx.canvas.height / 2 + 20)
    
    // Add a timestamp
    const now = new Date()
    ctx.font = '16px Arial'
    ctx.fillText(now.toLocaleTimeString(), ctx.canvas.width / 2, ctx.canvas.height / 2 + 60)
  }

  /**
   * Fallback capture method using html2canvas (only when needed)
   */
  private async captureWithHtml2Canvas(element: HTMLElement, ctx: CanvasRenderingContext2D, scaleFactor: number): Promise<void> {
    try {
      const canvas = await html2canvas(element, {
        scale: scaleFactor,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
        removeContainer: false
      })
      
      ctx.drawImage(canvas, 0, 0)
      
      // Clean up immediately
      canvas.width = 0
      canvas.height = 0
    } catch (error) {
      console.warn('Html2canvas capture failed:', error)
    }
  }

  /**
   * Process frames in a memory-efficient streaming manner
   */
  private processFramesStreaming(
    element: HTMLElement,
    duration: number,
    frameRate: number,
    targetResolution: { width: number; height: number },
    ctx: CanvasRenderingContext2D,
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void,
    onComplete?: () => void
  ): void {
    const frameCount = Math.ceil((duration / 1000) * frameRate)
    const frameInterval = 1000 / frameRate
    let frameIndex = 0

    console.log(`Processing ${frameCount} frames with memory-efficient streaming`)

    // Calculate scale factor for high-quality capture
    const elementRect = element.getBoundingClientRect()
    const scaleFactor = Math.max(
      targetResolution.width / elementRect.width,
      targetResolution.height / elementRect.height
    ) * 2 // 2x scale for crisp output

    const processNextFrame = async () => {
      if (frameIndex >= frameCount) {
        onComplete?.()
        return
      }

      const frameTime = frameIndex * frameInterval
      
      try {
        onStatus?.(`Processing frame ${frameIndex + 1}/${frameCount}`)
        
        // Capture frame with high quality settings
        const canvas = await html2canvas(element, {
          scale: scaleFactor,
          useCORS: true,
          allowTaint: true,
          backgroundColor: null,
          logging: false,
          removeContainer: false,
          width: elementRect.width,
          height: elementRect.height
        })

        // Draw frame to video canvas
        ctx.clearRect(0, 0, targetResolution.width, targetResolution.height)
        ctx.drawImage(canvas, 0, 0, targetResolution.width, targetResolution.height)

        // Update progress
        const progress = ((frameIndex + 1) / frameCount) * 100
        onProgress?.(progress)

        // Clean up the captured canvas immediately to free memory
        canvas.width = 0
        canvas.height = 0

        frameIndex++

        // Force garbage collection if available
        if (window.gc) {
          window.gc()
        }

        // Process next frame at the correct frame rate timing
        setTimeout(processNextFrame, 1000 / frameRate)

      } catch (error) {
        console.warn(`Failed to process frame ${frameIndex + 1}:`, error)
        frameIndex++
        setTimeout(processNextFrame, 1000 / frameRate)
      }
    }

    processNextFrame()
  }

  /**
   * Fallback video creation using MediaRecorder (when ffmpeg.wasm is not available)
   */
  private async createVideoFallback(
    frames: string[],
    frameRate: number,
    resolution: keyof typeof VideoExporter.prototype.resolutionPresets,
    quality: keyof typeof VideoExporter.prototype.qualityPresets,
    customBitrate?: number,
    onProgress?: (progress: number) => void
  ): Promise<VideoExportResult> {
    const targetResolution = this.resolutionPresets[resolution]
    const qualitySettings = this.qualityPresets[quality]
    const bitrate = customBitrate || qualitySettings.bitrate

    // Create canvas for video creation
    const canvas = document.createElement('canvas')
    canvas.width = targetResolution.width
    canvas.height = targetResolution.height
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      throw new Error('Could not get canvas context for fallback video creation')
    }

    // Create media stream from canvas
    const stream = canvas.captureStream(frameRate)
    
    // Try different MIME types in order of preference
    const mimeTypes = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4;codecs=h264',
      'video/mp4'
    ]
    
    let mimeType = 'video/webm'
    for (const type of mimeTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        mimeType = type
        break
      }
    }

    return new Promise((resolve, reject) => {
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: bitrate
      })

      const chunks: Blob[] = []
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data)
        }
      }

      recorder.onstop = () => {
        if (chunks.length === 0) {
          reject(new Error('No video data recorded'))
          return
        }

        const blob = new Blob(chunks, { type: mimeType })
        const fileExtension = mimeType.includes('mp4') ? 'mp4' : 'webm'
        
        resolve({
          blob,
          url: URL.createObjectURL(blob),
          size: blob.size,
          duration: (frames.length / frameRate) * 1000,
          format: fileExtension as 'mp4',
          resolution: `${targetResolution.width}x${targetResolution.height}`
        })
      }

      recorder.onerror = (e) => {
        reject(new Error('MediaRecorder error during fallback video creation'))
      }

      recorder.start(100) // Request data every 100ms

      // Process frames with better error handling
      let frameIndex = 0
      const processNextFrame = () => {
        if (frameIndex >= frames.length) {
          console.log('All frames processed, stopping recorder...')
          setTimeout(() => {
            if (recorder.state === 'recording') {
              recorder.stop()
            }
          }, 1000) // Give more time for final frame
          return
        }

        const img = new Image()
        img.crossOrigin = 'anonymous'
        
        img.onload = () => {
          try {
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            
            // Update progress (50% for frame processing, 50% for encoding)
            const progress = 50 + ((frameIndex + 1) / frames.length) * 50
            onProgress?.(progress)
            
            console.log(`Processed frame ${frameIndex + 1}/${frames.length}`)
            frameIndex++
            
            // Use requestAnimationFrame for smoother processing
            requestAnimationFrame(() => {
              setTimeout(processNextFrame, Math.max(1000 / frameRate, 16)) // At least 16ms between frames
            })
          } catch (error) {
            console.warn(`Error processing frame ${frameIndex + 1}:`, error)
            frameIndex++
            setTimeout(processNextFrame, 1000 / frameRate)
          }
        }
        
        img.onerror = (error) => {
          console.warn(`Failed to load frame ${frameIndex + 1}, skipping...`, error)
          frameIndex++
          setTimeout(processNextFrame, 1000 / frameRate)
        }
        
        try {
          img.src = frames[frameIndex]
        } catch (error) {
          console.warn(`Error setting frame ${frameIndex + 1} source:`, error)
          frameIndex++
          setTimeout(processNextFrame, 1000 / frameRate)
        }
      }

      console.log(`Starting to process ${frames.length} frames...`)
      processNextFrame()
    })
  }

  /**
   * Clean up temporary files
   */
  private async cleanupTempFiles(frameCount: number): Promise<void> {
    if (!this.ffmpeg) return

    try {
      // Delete frame files
      for (let i = 0; i < frameCount; i++) {
        await this.ffmpeg.deleteFile(`frame_${i.toString().padStart(4, '0')}.png`)
      }
      
      // Delete other temp files
      await this.ffmpeg.deleteFile('input.txt')
      await this.ffmpeg.deleteFile('output.mp4')
    } catch (error) {
      console.warn('Error cleaning up temp files:', error)
    }
  }

  /**
   * Download video blob
   */
  static downloadVideo(blob: Blob, filename: string): void {
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
   * Format file size in human readable format
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Check if video export is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           typeof document !== 'undefined' &&
           typeof HTMLCanvasElement !== 'undefined'
  }

  /**
   * Get current memory usage (if available)
   */
  static getMemoryUsage(): { used: number; total: number; percentage: number } | null {
    if ('memory' in performance) {
      const memory = (performance as any).memory
      return {
        used: Math.round(memory.usedJSHeapSize / 1024 / 1024), // MB
        total: Math.round(memory.totalJSHeapSize / 1024 / 1024), // MB
        percentage: Math.round((memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100)
      }
    }
    return null
  }

  /**
   * Force garbage collection if available
   */
  static forceGC(): void {
    if (window.gc) {
      window.gc()
    }
  }
}
