/**
 * Client-side canvas frame-by-frame video recording
 * 
 * This method renders each frame to a canvas and exports them
 * as a video. Perfect for deterministic, high-quality results
 * when the quiz is fully canvas-based.
 */

import { computeQuizTimeline } from './quizTiming'

// Helper function to format answer labels
function formatAnswerLabel(index: number, format: string = 'letters'): string {
  switch (format) {
    case 'letters':
      return String.fromCharCode(65 + index) + ')'
    case 'numbers':
      return `${index + 1})`
    case 'steps':
      return `Step ${index + 1}:`
    default:
      return String.fromCharCode(65 + index) + ')'
  }
}

export interface CanvasRecordingOptions {
  /** Quiz data to render */
  quiz: any
  /** Recording duration in milliseconds */
  duration: number
  /** Frame rate for recording (default: 60) */
  frameRate?: number
  /** Video quality preset */
  quality?: 'low' | 'medium' | 'high' | 'ultra'
  /** Output format */
  format?: 'webm' | 'mp4'
  /** Whether to include background music if available */
  includeMusic?: boolean
  /** Callback for progress updates */
  onProgress?: (progress: number) => void
  /** Callback for status updates */
  onStatus?: (status: string) => void
  /** Callback for errors */
  onError?: (error: Error) => void
}

export interface CanvasRecordingResult {
  /** Blob containing the exported video */
  blob: Blob
  /** URL for the video blob */
  url: string
  /** File size in bytes */
  size: number
  /** Duration in milliseconds */
  duration: number
  /** Resolution of the output */
  resolution: string
  /** Format of the output */
  format: 'mp4' | 'webm'
}

export class CanvasRecorder {

  private static readonly QUALITY_PRESETS = {
    low: { bitrate: 1000000, crf: 28 },
    medium: { bitrate: 3000000, crf: 23 },
    high: { bitrate: 8000000, crf: 20 },
    ultra: { bitrate: 15000000, crf: 18 }
  }

  private static applyMediaOffset(media: HTMLMediaElement | null | undefined, offsetSeconds?: number) {
    if (!media) return
    const desired = Math.max(0, offsetSeconds ?? 0)
    const setOffset = () => {
      const duration = media.duration
      const max = Number.isFinite(duration) && duration > 0 ? Math.max(0, duration - 0.05) : undefined
      const clamped = max !== undefined ? Math.min(desired, max) : desired
      if (!Number.isNaN(clamped)) {
        try {
          media.currentTime = clamped
        } catch (error) {
          console.warn('Failed to set media offset:', error)
        }
      }
    }

    if (media.readyState >= 1) {
      setOffset()
    } else {
      const handler = () => setOffset()
      media.addEventListener('loadedmetadata', handler, { once: true })
    }
  }

  /**
   * Record video using client-side canvas method
   */
  static async recordVideo(options: CanvasRecordingOptions): Promise<CanvasRecordingResult> {
    const {
      quiz,
      duration,
      frameRate = 60,
      quality = 'high',
      format = 'webm',
      includeMusic = true,
      onProgress,
      onStatus
    } = options

    let cleanupPlayback: () => void = () => {}

    try {
      onStatus?.('Initializing canvas recording...')
      
      // Use aspect ratio from settings to calculate dynamic height with fixed 1080 width
      const aspectRatio = quiz.settings?.aspectRatio || '9:16'
      const [aspectW, aspectH] = aspectRatio.split(':').map(Number)
      const aspectRatioValue = aspectW / aspectH
      
      // Always use 1080 width, calculate height based on aspect ratio
      const targetWidth = 1080
      const targetHeight = Math.round(targetWidth / aspectRatioValue)
      
      const targetResolution = { width: targetWidth, height: targetHeight }
      const qualitySettings = this.QUALITY_PRESETS[quality]
      
      // Create canvas for rendering with exact target dimensions
      const canvas = document.createElement('canvas')
      
      // Set canvas dimensions - both width/height AND style dimensions must match
      canvas.width = targetResolution.width
      canvas.height = targetResolution.height
      
      // IMPORTANT: Remove style dimensions to let canvas use its natural size
      // This ensures captureStream() uses the correct dimensions
      canvas.style.width = ''
      canvas.style.height = ''
      
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        throw new Error('Could not get canvas context')
      }

      // Preload assets (background image/video, music)
      const assets = await this.preloadAssets(quiz, onStatus)

      // Create media stream from canvas and optionally add audio
      const videoStream = canvas.captureStream(frameRate)
      let stream: MediaStream = videoStream
      let audioContext: AudioContext | null = null
      let audioSource: MediaElementAudioSourceNode | null = null
      let audioDest: MediaStreamAudioDestinationNode | null = null
      let musicEl: HTMLAudioElement | null = null

      const cleanupCallbacks: Array<() => void> = []
      let cleanedUp = false

      cleanupPlayback = () => {
        if (cleanedUp) return
        cleanedUp = true
        cleanupCallbacks.forEach(fn => {
          try {
            fn()
          } catch {
            // ignore cleanup errors
          }
        })

        if (musicEl) {
          try {
            musicEl.pause()
            musicEl.currentTime = 0
          } catch {
            // ignore
          }
        }

        ;[assets.videoEl, assets.upperVideoEl, assets.lowerVideoEl].forEach(el => {
          if (el) {
            try {
              el.pause()
            } catch {
              // ignore
            }
          }
        })

        if (audioSource) {
          try {
            audioSource.disconnect()
          } catch {
            // ignore
          }
        }
        if (audioDest) {
          try {
            audioDest.disconnect()
          } catch {
            // ignore
          }
        }
        if (audioContext) {
          audioContext.close().catch(() => {})
        }
      }

      if (includeMusic && assets.musicEl) {
        try {
          onStatus?.('Attaching background music...')
          audioContext = new AudioContext()
          musicEl = assets.musicEl
          // Ensure playback starts at desired offset
          this.applyMediaOffset(musicEl, quiz.settings?.music?.startOffsetSeconds)
          musicEl.crossOrigin = 'anonymous'
          musicEl.loop = false
          audioSource = audioContext.createMediaElementSource(musicEl)
          audioDest = audioContext.createMediaStreamDestination()
          audioSource.connect(audioDest)
          // Also connect to destination to hear locally if needed
          audioSource.connect(audioContext.destination)
          const combined = new MediaStream()
          videoStream.getVideoTracks().forEach(t => combined.addTrack(t))
          audioDest.stream.getAudioTracks().forEach(t => combined.addTrack(t))
          stream = combined
        } catch (e) {
          console.warn('Failed to attach music:', e)
        }
      }
      
      // Try different MIME types based on requested format
      const mimeTypes = format === 'mp4' ? [
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ] : [
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm',
        'video/mp4;codecs=h264',
        'video/mp4'
      ]
      
      let mimeType = format === 'mp4' ? 'video/mp4' : 'video/webm'
      for (const type of mimeTypes) {
        if (MediaRecorder.isTypeSupported(type)) {
          mimeType = type
          break
        }
      }

      return new Promise((resolve, reject) => {
        const recorder = new MediaRecorder(stream, {
          mimeType,
          videoBitsPerSecond: qualitySettings.bitrate
        })

        const chunks: Blob[] = []
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunks.push(e.data)
          }
        }

        recorder.onstop = () => {
          cleanupPlayback()
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
            format: fileExtension as 'mp4' | 'webm',
            resolution: `${targetResolution.width}x${targetResolution.height}`
          })
        }

        recorder.onerror = (e) => {
          cleanupPlayback()
          reject(new Error('MediaRecorder error during canvas recording'))
        }

        recorder.start(100) // Request data every 100ms

        // Start frame-by-frame rendering
        this.renderFrames(
          ctx,
          canvas,
          { ...quiz, __assets: assets },
          duration,
          frameRate,
          targetResolution,
          onProgress,
          onStatus,
          () => {
            console.log('All frames rendered, stopping recorder...')
            setTimeout(() => {
              if (recorder.state === 'recording') {
                recorder.stop()
              }
            }, 1000)
          }
        )

        // Start background video/music playback aligned to render loop
        let shouldLoopVideo = false
        if (quiz.background?.type === 'video' && assets.videoEl) {
          const bgVideoEl = assets.videoEl
          this.applyMediaOffset(
            bgVideoEl,
            quiz.background.videoStartOffsetSeconds
          )
          bgVideoEl.muted = true
          bgVideoEl.loop = false

          const bgDuration = bgVideoEl.duration
          if (Number.isFinite(bgDuration) && bgDuration > 0) {
            shouldLoopVideo = duration > (bgDuration * 1000)
          }

          bgVideoEl.play().catch(() => {})

          if (shouldLoopVideo) {
            const handleEnded = () => {
              this.applyMediaOffset(
                bgVideoEl,
                quiz.background?.videoStartOffsetSeconds
              )
              bgVideoEl.play().catch(() => {})
            }
            bgVideoEl.addEventListener('ended', handleEnded)
            cleanupCallbacks.push(() => bgVideoEl.removeEventListener('ended', handleEnded))
          }
        }
        
        // Start split screen videos playback
        if (assets.upperVideoEl) {
          const upperVideoEl = assets.upperVideoEl
          upperVideoEl.currentTime = 0
          upperVideoEl.muted = true
          upperVideoEl.play().catch(() => {})
          if (
            Number.isFinite(upperVideoEl.duration) &&
            upperVideoEl.duration > 0 &&
            duration > upperVideoEl.duration * 1000
          ) {
            const handleUpperEnded = () => {
              upperVideoEl.currentTime = 0
              upperVideoEl.play().catch(() => {})
            }
            upperVideoEl.addEventListener('ended', handleUpperEnded)
            cleanupCallbacks.push(() => upperVideoEl.removeEventListener('ended', handleUpperEnded))
          }
        }
        if (assets.lowerVideoEl) {
          const lowerVideoEl = assets.lowerVideoEl
          lowerVideoEl.currentTime = 0
          lowerVideoEl.muted = true
          lowerVideoEl.play().catch(() => {})
          if (
            Number.isFinite(lowerVideoEl.duration) &&
            lowerVideoEl.duration > 0 &&
            duration > lowerVideoEl.duration * 1000
          ) {
            const handleLowerEnded = () => {
              lowerVideoEl.currentTime = 0
              lowerVideoEl.play().catch(() => {})
            }
            lowerVideoEl.addEventListener('ended', handleLowerEnded)
            cleanupCallbacks.push(() => lowerVideoEl.removeEventListener('ended', handleLowerEnded))
          }
        }
        if (musicEl) {
          // Resume audio context then play
          audioContext?.resume().then(() => {
            musicEl!.play().catch(() => {})
          }).catch(() => {
            musicEl!.play().catch(() => {})
          })
        }
      })

    } catch (error) {
      cleanupPlayback()
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      options.onError?.(new Error(`Canvas recording failed: ${errorMessage}`))
      throw error
    }
  }

  /**
   * Render frames to canvas frame-by-frame
   */
  private static renderFrames(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    quiz: any,
    duration: number,
    frameRate: number,
    targetResolution: { width: number; height: number },
    onProgress?: (progress: number) => void,
    onStatus?: (status: string) => void,
    onComplete?: () => void
  ): void {
    const timeline = computeQuizTimeline(quiz)
    const ctaEnabled = Boolean(quiz.settings?.cta?.enabled && timeline.ctaDuration > 0)
    const ctaStartTime = timeline.totalContentDuration
    const frameCount = Math.ceil((duration / 1000) * frameRate)
    const frameInterval = 1000 / frameRate
    let frameIndex = 0

    console.log(`Rendering ${frameCount} frames at ${frameRate} FPS`)

    const renderNextFrame = () => {
      if (frameIndex >= frameCount) {
        onComplete?.()
        return
      }

      const frameTime = frameIndex * frameInterval
      
      try {
        onStatus?.(`Rendering frame ${frameIndex + 1}/${frameCount} at ${frameTime.toFixed(0)}ms`)
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        
        
        // Determine what stage to render based on frame time
        if (ctaEnabled && frameTime >= ctaStartTime) {
          const ctaFrameTime = frameTime - ctaStartTime
          this.renderCTAFrame(ctx, quiz, ctaFrameTime, duration, targetResolution)
        } else if (quiz.settings?.animationType === 'meme') {
          this.renderMemeFrame(ctx, quiz, frameTime, duration, targetResolution)
        } else {
          this.renderQuizFrame(ctx, quiz, frameTime, duration, targetResolution, timeline)
        }
        
        // Update progress
        const progress = ((frameIndex + 1) / frameCount) * 100
        onProgress?.(progress)

        frameIndex++

        // Schedule next frame
        setTimeout(renderNextFrame, frameInterval)

      } catch (error) {
        console.warn(`Failed to render frame ${frameIndex + 1}:`, error)
        frameIndex++
        setTimeout(renderNextFrame, frameInterval)
      }
    }

    renderNextFrame()
  }

  /**
   * Render a single quiz frame to the canvas
   */
  private static renderQuizFrame(
    ctx: CanvasRenderingContext2D,
    quiz: any,
    frameTime: number,
    totalDuration: number,
    targetResolution: { width: number; height: number },
    timeline: ReturnType<typeof computeQuizTimeline>
  ): void {
    const { width, height } = targetResolution
    
    // Calculate animation progress (0 to 1)
    const progress = Math.min(frameTime / totalDuration, 1)
    
    const { showTitle, titleDuration, questionTimings, totalQuestionDuration } = timeline
    
    let stage: 'title' | 'question' | 'postQuestions' = 'title'
    let questionIndex = -1
    let stageProgress = 0
    
    if (showTitle && frameTime < titleDuration) {
      stage = 'title'
      stageProgress = frameTime / titleDuration
    } else {
      const questionTime = frameTime - titleDuration
      if (questionTime >= 0 && questionTime < totalQuestionDuration) {
      stage = 'question'
        for (let i = 0; i < questionTimings.length; i++) {
          const timing = questionTimings[i]
          if (questionTime >= timing.start && questionTime < timing.start + timing.duration) {
            questionIndex = i
            stageProgress = (questionTime - timing.start) / timing.duration
            break
          }
        }
        if (questionIndex === -1 && questionTimings.length > 0) {
          // Clamp to last question
          questionIndex = questionTimings.length - 1
          stageProgress = 1
        }
      } else {
        stage = 'postQuestions'
        stageProgress = 1
      }
    }
    
    // Render background (color/image/video) and overlay
    const backgroundForFrame = quiz.background?.type === 'image'
      ? {
          ...quiz.background,
          zoomEnabled: quiz.settings?.bgZoomEnabled,
          zoomScale: quiz.settings?.bgZoomScale,
          zoomDurationMs: quiz.settings?.bgZoomDurationMs
        }
      : quiz.background

    this.renderBackground(ctx, backgroundForFrame, width, height, quiz.__assets, frameTime)
    // Overlay layer to match preview (optional)
    const overlayColor = quiz.settings?.overlayColor || 'transparent'
    const overlayOpacity = Number(quiz.settings?.overlayOpacity ?? 0)
    if (overlayOpacity > 0 && overlayColor && overlayColor !== 'transparent') {
      ctx.save()
      ctx.globalAlpha = overlayOpacity
      ctx.fillStyle = overlayColor
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Background color overlay
    const bgOverlayColor = quiz.settings?.bgOverlayColor || 'transparent'
    const bgOverlayOpacity = Number(quiz.settings?.bgOverlayOpacity ?? 0)
    if (bgOverlayOpacity > 0 && bgOverlayColor && bgOverlayColor !== 'transparent') {
      ctx.save()
      ctx.globalAlpha = bgOverlayOpacity
      ctx.fillStyle = bgOverlayColor
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }
    
    // Render content based on stage
    switch (stage) {
      case 'title':
        this.renderTitle(ctx, quiz.title, quiz.settings, width, height, stageProgress, targetResolution)
        break
      case 'question':
        if (questionIndex >= 0 && questionIndex < quiz.questions.length) {
          this.renderQuestion(
            ctx,
            quiz.questions[questionIndex],
            quiz.settings,
            width,
            height,
            stageProgress,
            targetResolution,
            questionIndex === quiz.questions.length - 1
          )
        }
        break
      case 'postQuestions':
        // Background already rendered; nothing to overlay so fade stays clear
        break
    }
  }

  /**
   * Render a single meme frame to the canvas
   */
  private static renderMemeFrame(
    ctx: CanvasRenderingContext2D,
    quiz: any,
    frameTime: number,
    totalDuration: number,
    targetResolution: { width: number; height: number }
  ): void {
    const { width, height } = targetResolution
    
    
    // Get meme data from quiz (assuming it's stored there)
    const meme = quiz.meme || {
      topText: 'TOP TEXT',
      bottomText: 'BOTTOM TEXT',
      background: quiz.background,
      settings: {}
    }
    
    const settings = meme.settings || {}
    const quizSettings = quiz.settings || {}
    
    // Calculate timing
    const topTextInMs = settings.topTextInMs || 500
    const bottomTextInMs = settings.bottomTextInMs || 500
    const topTextHoldMs = settings.topTextHoldMs || 3000
    const bottomTextHoldMs = settings.bottomTextHoldMs || 3000
    const topTextFadeOutMs = settings.topTextFadeOutMs || 500
    const bottomTextFadeOutMs = settings.bottomTextFadeOutMs || 500
    
    const topTextDelay = topTextInMs
    const bottomTextDelay = topTextInMs + bottomTextInMs
    
    // Calculate when each text should fade out
    const topTextFadeOutStartTime = topTextDelay + topTextHoldMs
    const bottomTextFadeOutStartTime = bottomTextDelay + bottomTextHoldMs
    
    // Calculate total meme duration (when both texts are completely gone)
    const totalMemeDuration = Math.max(
      topTextFadeOutStartTime + topTextFadeOutMs,
      bottomTextFadeOutStartTime + bottomTextFadeOutMs
    )
    
    // Render background (use quiz background instead of meme background)
    this.renderBackground(ctx, {
      ...quiz.background,
      zoomEnabled: quizSettings.bgZoomEnabled,
      zoomScale: quizSettings.bgZoomScale,
      zoomDurationMs: quizSettings.bgZoomDurationMs
    }, width, height, quiz.__assets, frameTime)
    
    // Render background overlay
    if (quizSettings.bgOverlayColor && quizSettings.bgOverlayOpacity) {
      ctx.fillStyle = quizSettings.bgOverlayColor
      ctx.globalAlpha = quizSettings.bgOverlayOpacity
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
    
    // Render meme overlay - Must be BELOW text
    if (settings.overlayColor && settings.overlayOpacity) {
      ctx.fillStyle = settings.overlayColor
      ctx.globalAlpha = settings.overlayOpacity
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
    
    // Calculate text sizes
    const topTextSize = (width * (settings.topTextSizePercent || 8)) / 100
    const bottomTextSize = (width * (settings.bottomTextSizePercent || 8)) / 100
    
    // Render top text
    if (settings.showTopText && meme.topText && frameTime >= topTextDelay) {
      ctx.save()
      
      // Calculate top text opacity (fade in/out)
      const topTextElapsed = frameTime - topTextDelay
      let topTextOpacity = 1
      
      // Fade in
      if (topTextElapsed < topTextInMs) {
        topTextOpacity = topTextElapsed / topTextInMs
      }
      // Fade out top text
      else if (frameTime >= topTextFadeOutStartTime) {
        const fadeOutElapsed = frameTime - topTextFadeOutStartTime
        if (fadeOutElapsed > topTextFadeOutMs) {
          topTextOpacity = 0
        } else {
          topTextOpacity = 1 - (fadeOutElapsed / topTextFadeOutMs)
        }
      }
      
      ctx.globalAlpha = topTextOpacity
      ctx.fillStyle = settings.topTextColor || '#ffffff'
      const fontWeight = (quizSettings.fontFamily || 'Impact') === 'Impact' ? 'normal' : 'bold'
      ctx.font = `${fontWeight} ${topTextSize}px ${quizSettings.fontFamily || 'Impact'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      
      // Remove manual letter spacing for better kerning
      
      // Text shadow
      if (settings.topTextShadowEnabled) {
        ctx.shadowColor = settings.topTextShadowColor || '#000000'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
      }
      
      // Calculate wrapped lines first for background
      const originalLines = meme.topText.split('\n').filter((line: string) => line.trim() !== '')
      const textAreaWidth = width - 64 // Leave some margin for readability
      const wrappedLines: string[] = []
      
      originalLines.forEach((line: string) => {
        const upperLine = line.toUpperCase().trim()
        if (upperLine.length === 0) return
        
        // Check if line fits in one line
        const textWidth = ctx.measureText(upperLine).width
        
        if (textWidth <= textAreaWidth) {
          wrappedLines.push(upperLine)
        } else {
          // Need to wrap the text
          const words = upperLine.split(' ')
          let currentLine = ''
          
          for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + (currentLine ? ' ' : '') + words[i]
            const testWidth = ctx.measureText(testLine).width
            
            if (testWidth <= textAreaWidth) {
              currentLine = testLine
            } else {
              if (currentLine) {
                wrappedLines.push(currentLine)
                currentLine = words[i]
              } else {
                wrappedLines.push(words[i])
              }
            }
          }
          
          if (currentLine) {
            wrappedLines.push(currentLine)
          }
        }
      })
      
      // Text background
      if (settings.textBackgroundEnabled) {
        const lineCount = wrappedLines.length
        const lineHeight = topTextSize * 1.2
        const textHeight = lineHeight * lineCount
        const padding = 20
        const topOffset = (height * (settings.topTextDistanceFromTop || 5)) / 100
        
        // Calculate background width to match text area
        const maxLineWidth = Math.max(...wrappedLines.map(line => ctx.measureText(line).width))
        const backgroundWidth = maxLineWidth + padding * 2
        
        ctx.fillStyle = settings.textBackgroundColor || '#000000'
        ctx.globalAlpha = 0.7
        ctx.fillRect(
          (width - backgroundWidth) / 2, // Center background horizontally
          topOffset - padding, // Match percentage-based top position
          backgroundWidth,
          textHeight + padding * 2
        )
        ctx.globalAlpha = 1
        ctx.fillStyle = settings.topTextColor || '#ffffff'
      }
      
      // Draw text with uppercase and letter spacing (reuse wrappedLines from above)
      const lineHeight = topTextSize * 1.2
      
      // Render each wrapped line
      wrappedLines.forEach((line: string, index: number) => {
        if (line.length === 0) return
        
        // Center text on the full width of the screen
        const x = width / 2 // Center on full screen width
        
        // Calculate Y position for this line
        const topOffset = (height * (settings.topTextDistanceFromTop || 5)) / 100
        const y = topOffset + (lineHeight * index) + (topTextSize * 0.8) // Use percentage-based top position + line height
        
        // Draw the entire line at once for proper kerning
        ctx.fillText(line, x, y)
      })
      
      ctx.restore()
    }
    
    // Render bottom text
    if (settings.showBottomText && meme.bottomText && frameTime >= bottomTextDelay) {
      ctx.save()
      
      // Calculate bottom text opacity (fade in/out)
      const bottomTextElapsed = frameTime - bottomTextDelay
      let bottomTextOpacity = 1
      
      // Fade in
      if (bottomTextElapsed < bottomTextInMs) {
        bottomTextOpacity = bottomTextElapsed / bottomTextInMs
      }
      // Fade out bottom text
      else if (frameTime >= bottomTextFadeOutStartTime) {
        const fadeOutElapsed = frameTime - bottomTextFadeOutStartTime
        if (fadeOutElapsed > bottomTextFadeOutMs) {
          bottomTextOpacity = 0
        } else {
          bottomTextOpacity = 1 - (fadeOutElapsed / bottomTextFadeOutMs)
        }
      }
      
      ctx.globalAlpha = bottomTextOpacity
      ctx.fillStyle = settings.bottomTextColor || '#ffffff'
      const fontWeight = (quizSettings.fontFamily || 'Impact') === 'Impact' ? 'normal' : 'bold'
      ctx.font = `${fontWeight} ${bottomTextSize}px ${quizSettings.fontFamily || 'Impact'}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      
      // Remove manual letter spacing for better kerning
      
      // Text shadow
      if (settings.bottomTextShadowEnabled) {
        ctx.shadowColor = settings.bottomTextShadowColor || '#000000'
        ctx.shadowBlur = 4
        ctx.shadowOffsetX = 2
        ctx.shadowOffsetY = 2
      }
      
      // Calculate wrapped lines first for background
      const originalBottomLines = meme.bottomText.split('\n').filter((line: string) => line.trim() !== '')
      const textAreaWidth = width - 64 // Leave some margin for readability
      const wrappedBottomLines: string[] = []
      
      originalBottomLines.forEach((line: string) => {
        const upperLine = line.toUpperCase().trim()
        if (upperLine.length === 0) return
        
        // Check if line fits in one line
        const textWidth = ctx.measureText(upperLine).width
        
        if (textWidth <= textAreaWidth) {
          wrappedBottomLines.push(upperLine)
        } else {
          // Need to wrap the text
          const words = upperLine.split(' ')
          let currentLine = ''
          
          for (let i = 0; i < words.length; i++) {
            const testLine = currentLine + (currentLine ? ' ' : '') + words[i]
            const testWidth = ctx.measureText(testLine).width
            
            if (testWidth <= textAreaWidth) {
              currentLine = testLine
            } else {
              if (currentLine) {
                wrappedBottomLines.push(currentLine)
                currentLine = words[i]
              } else {
                wrappedBottomLines.push(words[i])
              }
            }
          }
          
          if (currentLine) {
            wrappedBottomLines.push(currentLine)
          }
        }
      })
      
      // Text background
      if (settings.textBackgroundEnabled) {
        const lineCount = wrappedBottomLines.length
        const lineHeight = bottomTextSize * 1.2
        const textHeight = lineHeight * lineCount
        const padding = 20
        const bottomOffset = (height * (settings.bottomTextDistanceFromBottom || 5)) / 100
        
        // Calculate background width to match text area
        const maxLineWidth = Math.max(...wrappedBottomLines.map(line => ctx.measureText(line).width))
        const backgroundWidth = maxLineWidth + padding * 2
        
        ctx.fillStyle = settings.textBackgroundColor || '#000000'
        ctx.globalAlpha = 0.7
        ctx.fillRect(
          (width - backgroundWidth) / 2, // Center background horizontally
          height - bottomOffset - textHeight - padding, // Match percentage-based bottom position
          backgroundWidth,
          textHeight + padding * 2
        )
        ctx.globalAlpha = 1
        ctx.fillStyle = settings.bottomTextColor || '#ffffff'
      }
      
      // Draw text with uppercase and letter spacing (reuse wrappedBottomLines from above)
      const lineHeight = bottomTextSize * 1.2
      
      // Render each wrapped line
      wrappedBottomLines.forEach((line: string, index: number) => {
        if (line.length === 0) return
        
        // Center text on the full width of the screen
        const x = width / 2 // Center on full screen width
        
        // Calculate Y position for this line (from bottom)
        const bottomOffset = (height * (settings.bottomTextDistanceFromBottom || 5)) / 100
        const y = height - bottomOffset - (lineHeight * (wrappedBottomLines.length - 1 - index)) - (bottomTextSize * 0.2) // Use percentage-based bottom position + line height
        
        // Draw the entire line at once for proper kerning
        ctx.fillText(line, x, y)
      })
      
      ctx.restore()
    }
  }

  /**
   * Render CTA screen frame
   */
  private static renderCTAFrame(
    ctx: CanvasRenderingContext2D,
    quiz: any,
    frameTime: number,
    totalDuration: number,
    targetResolution: { width: number; height: number }
  ): void {
    const { width, height } = targetResolution
    const cta = quiz.settings?.cta
    
    // Determine background to use
    let backgroundToUse = quiz.background
    if (cta?.useSameBackground === false) {
      if (cta?.imageUrl) {
        backgroundToUse = {
          type: 'image',
          imageUrl: cta.imageUrl
        }
      } else if (cta?.backgroundVideoUrl) {
        backgroundToUse = {
          type: 'video',
          videoUrl: cta.backgroundVideoUrl
        }
      }
    }
    
    // Render background
    this.renderBackground(ctx, {
      ...backgroundToUse,
      zoomEnabled: quiz.settings?.bgZoomEnabled,
      zoomScale: quiz.settings?.bgZoomScale,
      zoomDurationMs: quiz.settings?.bgZoomDurationMs
    }, width, height, quiz.__assets, frameTime)
    
    // Render background overlay
    if (quiz.settings?.bgOverlayColor && quiz.settings?.bgOverlayOpacity) {
      ctx.fillStyle = quiz.settings.bgOverlayColor
      ctx.globalAlpha = quiz.settings.bgOverlayOpacity
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
    
    // Calculate CTA timing and opacity for fade in/out
    const fadeInMs = cta?.fadeInMs ?? 600
    const holdMs = cta?.holdMs ?? 1800
    const fadeOutMs = cta?.fadeOutMs ?? 600
    
    // Calculate opacity based on frame time within CTA duration
    let ctaOpacity = 1
    if (frameTime < fadeInMs) {
      ctaOpacity = frameTime / fadeInMs
    } else if (frameTime >= fadeInMs + holdMs) {
      const fadeOutProgress = (frameTime - (fadeInMs + holdMs)) / fadeOutMs
      ctaOpacity = Math.max(0, 1 - fadeOutProgress)
    }
    
    // Render CTA video overlay with fade
    if (cta?.overlayEnabled && cta?.overlayColor && cta?.overlayOpacity) {
      ctx.fillStyle = cta.overlayColor
      ctx.globalAlpha = ctaOpacity * cta.overlayOpacity
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
    
    // Render CTA content
    ctx.save()
    
    // Set global alpha for text (with fade in/out)
    ctx.globalAlpha = ctaOpacity
    
    // Calculate text size
    const textSizePercent = cta?.textSizePercent ?? 8
    const textSize = (width * textSizePercent) / 100
    
    // Set font
    const fontFamily = cta?.fontFamily || quiz.settings?.fontFamily || 'Impact'
    const fontWeight = fontFamily === 'Impact' ? 'normal' : 'bold'
    ctx.font = `${fontWeight} ${textSize}px ${fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Set text color
    ctx.fillStyle = cta?.textColor || '#ffffff'
    
    // Set text shadow
    if (cta?.textShadowEnabled) {
      ctx.shadowColor = cta.textShadowColor || '#000000'
      ctx.shadowBlur = 4
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
    }
    
    // Draw CTA text with line break support
    const ctaText = cta?.text || 'Thank You!'
    const lines = ctaText.split('\n')
    const lineHeight = textSize * 1.2 // 1.2x line height for better spacing
    
    // Calculate starting Y position to center all lines
    const totalTextHeight = lineHeight * lines.length
    let currentY = (height / 2) - (totalTextHeight / 2) + (lineHeight / 2)
    
    // Draw each line
    lines.forEach((line: string) => {
      ctx.fillText(line, width / 2, currentY)
      currentY += lineHeight
    })
    
    ctx.restore()
  }

  /**
   * Render background
   */
  private static renderBackground(
    ctx: CanvasRenderingContext2D,
    background: any,
    width: number,
    height: number,
    assets?: { imageEl?: HTMLImageElement | null; videoEl?: HTMLVideoElement | null; memeEl?: HTMLImageElement | null; upperVideoEl?: HTMLVideoElement | null; lowerVideoEl?: HTMLVideoElement | null },
    frameTime?: number
  ): void {
    // Base color
    const baseColor = background?.type === 'color' ? (background.color || '#111316') : '#111316'
    ctx.fillStyle = baseColor
    ctx.fillRect(0, 0, width, height)

    // Draw image or video if present
    const zoomEnabled = background?.zoomEnabled || false
    const zoomTarget = Number(background?.zoomScale ?? 1)
    const zoomDurationMs = Number(background?.zoomDurationMs ?? 0)
    const isImageBackground = background?.type === 'image'
    const shouldAnimateZoom = isImageBackground && zoomEnabled && zoomTarget > 1 && frameTime !== undefined

    const dynamicScale = () => {
      if (!shouldAnimateZoom) return zoomTarget > 0 ? zoomTarget : 1
      const duration = zoomDurationMs > 0 ? zoomDurationMs : 1
      const time = frameTime ?? 0
      const progress = Math.min(Math.max(time, 0) / duration, 1)
      return 1 + (progress * ((zoomTarget > 0 ? zoomTarget : 1) - 1))
    }
    const drawMedia = (mediaW: number, mediaH: number, draw: (dx: number, dy: number, dw: number, dh: number) => void) => {
      // object-fit: cover
      const canvasRatio = width / height
      const mediaRatio = mediaW / mediaH
      let dw = width
      let dh = height
      if (mediaRatio > canvasRatio) {
        dh = height
        dw = dh * mediaRatio
      } else {
        dw = width
        dh = dw / mediaRatio
      }
      const scale = zoomEnabled ? dynamicScale() : 1
      dw *= scale
      dh *= scale
      const dx = (width - dw) / 2
      const dy = (height - dh) / 2
      draw(dx, dy, dw, dh)
    }

    if (background?.type === 'image' && assets?.imageEl && assets.imageEl.complete) {
      const img = assets.imageEl
      drawMedia(img.naturalWidth, img.naturalHeight, (dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh))
    }

    if (background?.type === 'meme' && assets?.memeEl && assets.memeEl.complete) {
      const img = assets.memeEl
      
      // Check if this is a GIF by looking at the URL or if it's marked as GIF
      const isGif = background.isGif || (img.src && img.src.toLowerCase().includes('.gif'))
      
      if (isGif && frameTime !== undefined) {
        // For GIFs, we need to simulate animation by cycling through frames
        // Since we can't easily extract GIF frames, we'll use a time-based approach
        // to create visual variation that suggests animation
        
        // Use frameTime to create a cycling effect
        const animationCycle = 2000 // 2 second cycle for GIF animation
        const cycleProgress = (frameTime % animationCycle) / animationCycle
        
        // Apply a subtle scale/position variation to simulate animation
        ctx.save()
        const animationScale = 1 + (Math.sin(cycleProgress * Math.PI * 2) * 0.02) // 2% scale variation
        const animationOffsetX = Math.sin(cycleProgress * Math.PI * 2) * 5 // 5px horizontal drift
        const animationOffsetY = Math.cos(cycleProgress * Math.PI * 2) * 3 // 3px vertical drift
        
        ctx.translate(width/2 + animationOffsetX, height/2 + animationOffsetY)
        ctx.scale(animationScale, animationScale)
        ctx.translate(-width/2, -height/2)
        
        drawMedia(img.naturalWidth, img.naturalHeight, (dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh))
        ctx.restore()
      } else {
        // Static meme image - draw normally
        drawMedia(img.naturalWidth, img.naturalHeight, (dx, dy, dw, dh) => ctx.drawImage(img, dx, dy, dw, dh))
      }
    }

    if (background?.type === 'video' && assets?.videoEl) {
      const v = assets.videoEl
      if (v.readyState >= 2) {
        drawMedia(v.videoWidth || width, v.videoHeight || height, (dx, dy, dw, dh) => ctx.drawImage(v, dx, dy, dw, dh))
      }
    }

    if (background?.type === 'splitScreen') {
      // Draw upper half video
      if (background.upperVideoUrl && assets?.upperVideoEl) {
        const upperVideo = assets.upperVideoEl
        if (upperVideo.readyState >= 2) {
          // Don't constantly sync video time - let it play naturally
          // The videos are already started and playing from the beginning
          
          const upperHeight = height / 2
          const upperMediaW = upperVideo.videoWidth || width
          const upperMediaH = upperVideo.videoHeight || upperHeight
          
          // Save context for upper half clipping
          ctx.save()
          
          // Clip to upper half
          ctx.beginPath()
          ctx.rect(0, 0, width, upperHeight)
          ctx.clip()
          
          // Calculate scaling for upper half
          const canvasRatio = width / upperHeight
          const mediaRatio = upperMediaW / upperMediaH
          let dw = width
          let dh = upperHeight
          if (mediaRatio > canvasRatio) {
            dh = upperHeight
            dw = dh * mediaRatio
          } else {
            dw = width
            dh = dw / mediaRatio
          }
          const scale = zoomEnabled ? dynamicScale() : 1
          dw *= scale
          dh *= scale
          const dx = (width - dw) / 2
          const dy = (upperHeight - dh) / 2
          
          ctx.drawImage(upperVideo, dx, dy, dw, dh)
          
          ctx.restore()
        }
      }
      
      // Draw lower half video
      if (background.lowerVideoUrl && assets?.lowerVideoEl) {
        const lowerVideo = assets.lowerVideoEl
        if (lowerVideo.readyState >= 2) {
          // Don't constantly sync video time - let it play naturally
          // The videos are already started and playing from the beginning
          
          const lowerHeight = height / 2
          const lowerMediaW = lowerVideo.videoWidth || width
          const lowerMediaH = lowerVideo.videoHeight || lowerHeight
          
          // Save context for lower half clipping
          ctx.save()
          
          // Clip to lower half
          ctx.beginPath()
          ctx.rect(0, lowerHeight, width, lowerHeight)
          ctx.clip()
          
          // Calculate scaling for lower half
          const canvasRatio = width / lowerHeight
          const mediaRatio = lowerMediaW / lowerMediaH
          let dw = width
          let dh = lowerHeight
          if (mediaRatio > canvasRatio) {
            dh = lowerHeight
            dw = dh * mediaRatio
          } else {
            dw = width
            dh = dw / mediaRatio
          }
          const scale = zoomEnabled ? dynamicScale() : 1
          dw *= scale
          dh *= scale
          const dx = (width - dw) / 2
          const dy = lowerHeight + (lowerHeight - dh) / 2
          
          ctx.drawImage(lowerVideo, dx, dy, dw, dh)
          
          ctx.restore()
        }
      }
    }
  }

  /**
   * Render title screen
   */
  private static renderTitle(
    ctx: CanvasRenderingContext2D,
    title: string,
    settings: any,
    width: number,
    height: number,
    progress: number,
    targetResolution: { width: number; height: number }
  ): void {
    // Use percentage-based sizing for consistent scaling
    const titleSizePercent = settings?.titleSizePercent ?? 6.0
    const fontSize = Math.round(height * (titleSizePercent / 100))
    
    // Fade in animation
    const opacity = Math.min(progress * 2, 1)
    const yOffset = (1 - progress) * 20
    
    ctx.save()
    ctx.globalAlpha = opacity
    ctx.translate(0, yOffset)
    
    // Draw title with editor-like styling
    ctx.fillStyle = settings?.questionColor || '#ffffff'
    if (settings?.titleShadowEnabled) {
      ctx.shadowColor = settings?.titleShadowColor || 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 4
      ctx.shadowOffsetY = 1
    } else {
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    }
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Center title like preview (flex items-center justify-center)
    const padding = Math.round(width * 0.03) // 3% of width for padding
    const maxTitleWidth = width - (padding * 2)
    const wrappedTitle = this.wrapText(ctx, title, maxTitleWidth)
    this.drawMultilineCentered(ctx, wrappedTitle, width / 2, height / 2, Math.round(fontSize * 1.2))
    
    ctx.restore()
  }

  /**
   * Render question
   */
  private static renderQuestion(
    ctx: CanvasRenderingContext2D,
    question: any,
    settings: any,
    width: number,
    height: number,
    progress: number,
    targetResolution: { width: number; height: number },
    isLastQuestion: boolean = false
  ): void {
    // Use percentage-based sizing for consistent scaling
    // Font sizes as percentage of screen height with user control
    const questionSizePercent = settings?.questionSizePercent ?? 4.5
    const answerSizePercent = settings?.answerSizePercent ?? 2.2
    const questionFontSize = Math.round(height * (questionSizePercent / 100))
    const answerFontSize = Math.round(height * (answerSizePercent / 100))
    
    // Use percentage setting directly (0-100%)
    const answerWidthPercent = settings?.answerWidthPercent ?? 50 // Default 50% of container width
    const pillWidth = Math.round((width * 0.9) * (answerWidthPercent / 100)) // Apply to container width
    const pillHeight = Math.round(height * 0.075) // ~7.5% of height
    const radius = pillHeight / 2
    
    // Fade in animation
    const opacity = Math.min(progress * 2, 1)
    const yOffset = (1 - progress) * 12
    
    // Add fade out for last question - will be calculated after variables are declared
    let fadeOutOpacity = 1
    
    ctx.save()
    ctx.globalAlpha = opacity * fadeOutOpacity
    ctx.translate(0, yOffset)
    
    // Draw question with proper wrapping to match preview exactly
    ctx.fillStyle = settings?.questionColor || '#ffffff'
    if (settings?.questionShadowEnabled) {
      ctx.shadowColor = settings?.questionShadowColor || 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 3
      ctx.shadowOffsetY = 1
    } else {
      ctx.shadowColor = 'transparent'
      ctx.shadowBlur = 0
      ctx.shadowOffsetY = 0
    }
    ctx.font = `600 ${questionFontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    
    // Match preview CSS exactly: maxWidth: '90%', margin: '0 auto'
    const containerMaxWidth = width * 0.9 // 90% of width
    const containerX = (width - containerMaxWidth) / 2 // Center the container
    
    // Calculate total content height to center the entire block like preview
    const questionMarginBottom = height * 0.06 // 6vh - increased spacing between question and answers
    const answerGap = height * 0.02 // 2vh gap between answers
    const answersPerQuestion = question.answers?.length ?? 3
    const totalAnswerHeight = (pillHeight + answerGap) * answersPerQuestion - answerGap // Total height of all answers
    const totalContentHeight = questionFontSize * 1.2 + questionMarginBottom + totalAnswerHeight
    
    // Center the entire content block like preview (flex items-center justify-center)
    const contentStartY = (height - totalContentHeight) / 2
    const questionY = contentStartY + (questionFontSize * 1.2) / 2
    
    // Wrap question text to fit container width
    const maxQuestionWidth = containerMaxWidth
    const wrappedQuestion = this.wrapText(ctx, question.title, maxQuestionWidth)
    this.drawMultilineCentered(ctx, wrappedQuestion, width / 2, questionY, Math.round(questionFontSize * 1.2))
    
    // Position answers after question within the centered content block
    const answerY = contentStartY + questionFontSize * 1.2 + questionMarginBottom + answerGap
    const correctButtonColor = settings?.correctAnswerButtonColor || settings?.correctAnswerColor || '#10b981'
    const correctTextColor = settings?.correctAnswerTextColor || '#ffffff'
    const answerTextColor = settings?.answerColor || '#111111'
    const neutralBg = '#ffffff'
    const neutralStroke = 'rgba(255,255,255,0.15)'
    
    // Timing
    // Use settings-driven correct reveal timing and make answers pre-delay based on answersStagger
    // stageProgress is 0..1 across a single question timeline (questionIn + questionHold + correctReveal)
    const s = settings || {}
    const questionIn = Number(s.questionInMs ?? 300)
    const questionHold = Number(s.questionHoldMs ?? 2200)
    const correctRevealMs = Number(s.correctRevealMs ?? 500)
    const answersStaggerMs = Number(s.answersStaggerMs ?? 70)
    const allAnswersShownTime = questionIn + answersStaggerMs + (answersStaggerMs * (answersPerQuestion - 1))
    const perQuestionMs = allAnswersShownTime + correctRevealMs + questionHold
    const preDelayMs = answersStaggerMs // delay before first answer
    const perAnswerGapMs = answersStaggerMs // gap between answers
    const correctRevealTime = (allAnswersShownTime + correctRevealMs) / perQuestionMs
    const answersStartTime = (questionIn + preDelayMs) / perQuestionMs
    
    // Calculate fade out for last question - start fade 1 second before question ends
    if (isLastQuestion) {
      const questionDuration = questionIn + 
        (answersStaggerMs * (answersPerQuestion - 1)) + 
        correctRevealMs + 
        questionHold

      const fadeOutStartTime = questionDuration - 1000 // Start fade 1 second before end
      const currentTime = progress * perQuestionMs
      const fadeOutProgress = Math.max(0, (currentTime - fadeOutStartTime) / 1000)
      fadeOutOpacity = Math.max(0, 1 - fadeOutProgress)
    }
    
    question.answers.forEach((answer: any, index: number) => {
      const delay = (index * perAnswerGapMs) / perQuestionMs
      const staged = Math.max(0, progress - answersStartTime - delay)
      const answerProgress = Math.min(staged * 3, 1) // Faster appearance
      const answerOpacity = Math.max(0, answerProgress)
      const answerYOffset = (1 - answerProgress) * 8
      
      // Determine if we should show correct styling
      const isCorrect = !!(answer.correct || answer.isCorrect)
      const shouldShowCorrect = progress >= correctRevealTime && isCorrect
      const showCorrect = shouldShowCorrect || (!isCorrect && progress >= correctRevealTime)
      
      ctx.save()
      ctx.globalAlpha = answerOpacity * fadeOutOpacity
      ctx.translate(0, answerYOffset)
      
      // Determine style based on correct reveal timing
      const bg = showCorrect && isCorrect ? correctButtonColor : neutralBg
      const stroke = showCorrect && isCorrect ? correctButtonColor : neutralStroke

      // Match preview CSS: center within container and use 2vh gap
      const answerYPos = answerY + index * (pillHeight + answerGap)
      const pillX = containerX + (containerMaxWidth - pillWidth) / 2 // Center within container
      
      // Rounded pill background
      this.roundedRect(
        ctx,
        pillX,
        answerYPos - pillHeight / 2,
        pillWidth,
        pillHeight,
        radius,
        bg,
        stroke
      )
      
      // Answer text with proper wrapping
      ctx.fillStyle = showCorrect && isCorrect ? correctTextColor : answerTextColor
      ctx.font = `600 ${answerFontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
      ctx.textAlign = 'left'
      
      // Match preview CSS: padding: '0 8%' of pill width
      const horizontalPadding = Math.round(pillWidth * 0.08) // 8% of pill width for padding
      const answerText = `${formatAnswerLabel(index, settings?.answerFormat)} ${answer.text}`
      const wrappedText = this.wrapText(ctx, answerText, pillWidth - (horizontalPadding * 2))
      this.drawMultilineLeft(ctx, wrappedText, pillX + horizontalPadding, answerYPos, Math.round(answerFontSize * 1.2))
      
      ctx.restore()
    })
    
    ctx.restore()
  }

  /**
   * Render end screen
   */
  private static renderEnd(
    ctx: CanvasRenderingContext2D,
    quiz: any,
    width: number,
    height: number,
    targetResolution: { width: number; height: number }
  ): void {
    // Calculate font size based on aspect ratio and resolution
    const baseFontSize = Math.min(targetResolution.width, targetResolution.height) * 0.08 // 8% of smaller dimension
    const fontSize = Math.max(32, Math.min(80, baseFontSize))
    
    ctx.fillStyle = '#ffffff'
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    this.drawMultilineCentered(ctx, 'Quiz Complete!', width / 2, height / 2, Math.round(fontSize * 1.2))
  }

  /** Draw a rounded rectangle with optional stroke */
  private static roundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: string,
    stroke?: string
  ): void {
    const radius = Math.min(r, Math.min(w, h) / 2)
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
    ctx.lineTo(x + radius, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
    ctx.lineTo(x, y + radius)
    ctx.quadraticCurveTo(x, y, x + radius, y)
    ctx.closePath()
    ctx.fillStyle = fill
    ctx.fill()
    if (stroke) {
      ctx.lineWidth = 2
      ctx.strokeStyle = stroke
      ctx.stroke()
    }
  }

  /** Preload background image/video and music */
  private static async preloadAssets(
    quiz: any,
    onStatus?: (status: string) => void
  ): Promise<{ imageEl?: HTMLImageElement | null; videoEl?: HTMLVideoElement | null; musicEl?: HTMLAudioElement | null; memeEl?: HTMLImageElement | null; upperVideoEl?: HTMLVideoElement | null; lowerVideoEl?: HTMLVideoElement | null }> {
    const assets: { imageEl?: HTMLImageElement | null; videoEl?: HTMLVideoElement | null; musicEl?: HTMLAudioElement | null; memeEl?: HTMLImageElement | null; upperVideoEl?: HTMLVideoElement | null; lowerVideoEl?: HTMLVideoElement | null } = {}
    const bg = quiz.background || {}
    try {
      if (bg.type === 'image' && bg.imageUrl) {
        onStatus?.('Loading background image...')
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = bg.imageUrl
        await new Promise<void>((res, rej) => {
          img.onload = () => res()
          img.onerror = () => rej(new Error('Failed to load background image'))
        })
        assets.imageEl = img
      }
    } catch {}

    try {
      if (bg.type === 'meme' && bg.memeUrl) {
        onStatus?.('Loading meme background...')
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.src = bg.memeUrl
        await new Promise<void>((res, rej) => {
          img.onload = () => res()
          img.onerror = () => rej(new Error('Failed to load meme background'))
        })
        assets.memeEl = img
      }
    } catch {}

    try {
      if (bg.type === 'video' && bg.videoUrl) {
        onStatus?.('Preparing background video...')
        const v = document.createElement('video') as HTMLVideoElement
        v.crossOrigin = 'anonymous'
        v.src = bg.videoUrl
        v.playsInline = true
        v.muted = true
        await v.play().catch(() => {})
        v.pause()
        this.applyMediaOffset(v, bg.videoStartOffsetSeconds)
        assets.videoEl = v
      }
    } catch {}

    try {
      // Load CTA background video if different from main background
      const cta = quiz.settings?.cta
      if (cta?.enabled && !cta?.useSameBackground && cta?.backgroundVideoUrl) {
        onStatus?.('Preparing CTA background video...')
        const ctaVideo = document.createElement('video') as HTMLVideoElement
        ctaVideo.crossOrigin = 'anonymous'
        ctaVideo.src = cta.backgroundVideoUrl
        ctaVideo.playsInline = true
        ctaVideo.muted = true
        await ctaVideo.play().catch(() => {})
        ctaVideo.pause()
        this.applyMediaOffset(ctaVideo, 0)
        // Store CTA video in the same videoEl since we only use one at a time
        assets.videoEl = ctaVideo
      }
    } catch {}

    try {
      if (bg.type === 'splitScreen') {
        // Load upper video
        if (bg.upperVideoUrl) {
          onStatus?.('Preparing upper video...')
          const upperVideo = document.createElement('video') as HTMLVideoElement
          upperVideo.crossOrigin = 'anonymous'
          upperVideo.src = bg.upperVideoUrl
          upperVideo.playsInline = true
          upperVideo.muted = true
        await upperVideo.play().catch(() => {})
        upperVideo.pause()
        upperVideo.currentTime = 0
          assets.upperVideoEl = upperVideo
        }
        
        // Load lower video
        if (bg.lowerVideoUrl) {
          onStatus?.('Preparing lower video...')
          const lowerVideo = document.createElement('video') as HTMLVideoElement
          lowerVideo.crossOrigin = 'anonymous'
          lowerVideo.src = bg.lowerVideoUrl
          lowerVideo.playsInline = true
          lowerVideo.muted = true
        await lowerVideo.play().catch(() => {})
        lowerVideo.pause()
        lowerVideo.currentTime = 0
          assets.lowerVideoEl = lowerVideo
        }
      }
    } catch {}

    try {
      const music = quiz.settings?.music
      if (music?.url) {
        onStatus?.('Loading background music...')
        const a = document.createElement('audio')
        a.src = music.url
        a.crossOrigin = 'anonymous'
        a.volume = music.volume ?? 1.0 // Set volume from settings
        console.log('Music volume set to:', a.volume, 'from settings:', music.volume)
        
        // Add error handling
        a.onerror = (e) => {
          console.log('Canvas recorder music load error:', e)
          console.log('Music URL:', music.url)
        }
        
        await a.load
        assets.musicEl = a
        this.applyMediaOffset(a, music.startOffsetSeconds)
      }
    } catch (error) {
      console.log('Canvas recorder music error:', error)
    }

    return assets
  }

  /** Draw multi-line centered text supporting \n line breaks */
  private static drawMultilineCentered(
    ctx: CanvasRenderingContext2D,
    text: string,
    centerX: number,
    centerY: number,
    lineHeight: number
  ): void {
    const lines = String(text ?? '').split(/\r?\n/)
    const totalHeight = lineHeight * (lines.length - 1)
    const startY = centerY - totalHeight / 2
    lines.forEach((line, i) => {
      ctx.fillText(line, centerX, startY + i * lineHeight)
    })
  }

  /** Draw multi-line left-aligned text supporting \n line breaks */
  private static drawMultilineLeft(
    ctx: CanvasRenderingContext2D,
    text: string,
    leftX: number,
    centerY: number,
    lineHeight: number
  ): void {
    const lines = String(text ?? '').split(/\r?\n/)
    const totalHeight = lineHeight * (lines.length - 1)
    const startY = centerY - totalHeight / 2
    lines.forEach((line, i) => {
      ctx.fillText(line, leftX, startY + i * lineHeight)
    })
  }

  /** Wrap text to fit within specified width */
  private static wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string {
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word
      const metrics = ctx.measureText(testLine)
      
      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    
    if (currentLine) {
      lines.push(currentLine)
    }
    
    return lines.join('\n')
  }

  /**
   * Check if canvas recording is supported
   */
  static isSupported(): boolean {
    return typeof window !== 'undefined' && 
           typeof document !== 'undefined' &&
           typeof HTMLCanvasElement !== 'undefined' &&
           typeof MediaRecorder !== 'undefined'
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
}
