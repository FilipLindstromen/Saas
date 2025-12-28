/**
 * Asset preflight system to ensure WYSIWYG
 * Preloads and validates all assets before export
 */

export interface PreflightResult {
  success: boolean
  errors: string[]
  warnings: string[]
  videoElements: Map<string, HTMLVideoElement>
  videoBlobUrls: Map<string, string> // Keep blob URLs alive during export
  images: Map<string, HTMLImageElement>
  fonts: string[]
}

/**
 * Preload all fonts and ensure they're ready
 */
export async function preloadFonts(fontFamilies: string[]): Promise<void> {
  // Wait for document fonts to be ready
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready
    } catch (error) {
      console.warn('Fonts ready check failed:', error)
    }

    // Check each font family
    for (const fontFamily of fontFamilies) {
      try {
        // Try to load the font if not already loaded
        if (document.fonts.check(`12px ${fontFamily}`)) {
          continue
        }

        // Font might not be loaded yet - wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100))

        // Check again
        if (!document.fonts.check(`12px ${fontFamily}`)) {
          console.warn(`Font "${fontFamily}" may not be loaded`)
        }
      } catch (error) {
        console.warn(`Error checking font "${fontFamily}":`, error)
      }
    }
  }
}

/**
 * Preload a video element and ensure it's ready
 */
async function preloadVideo(
  blob: Blob,
  key: string
): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.crossOrigin = 'anonymous'
    // Set playsInline to prevent fullscreen on mobile
    video.setAttribute('playsinline', 'true')
    video.setAttribute('webkit-playsinline', 'true')

    const url = URL.createObjectURL(blob)
    video.src = url

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('error', onError)
      // Don't revoke URL here - keep it alive for export
    }

    const onLoadedMetadata = () => {
      // Ensure video is fully loaded
      if (video.readyState >= 2) {
        cleanup()
        resolve({ video, url })
      } else {
        // Wait for canplaythrough
        video.addEventListener('canplaythrough', () => {
          cleanup()
          resolve({ video, url })
        }, { once: true })
      }
    }

    const onError = (error: Event) => {
      cleanup()
      URL.revokeObjectURL(url) // Only revoke on error
      reject(new Error(`Failed to load video ${key}: ${error}`))
    }

    video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
    video.addEventListener('error', onError, { once: true })

    // Timeout fallback
    setTimeout(() => {
      if (video.readyState >= 2) {
        cleanup()
        resolve({ video, url })
      } else {
        cleanup()
        URL.revokeObjectURL(url) // Only revoke on timeout
        reject(new Error(`Video ${key} load timeout`))
      }
    }, 30000) // 30 second timeout
  })
}

/**
 * Preload an image
 */
async function preloadImage(url: string, key: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    const onLoad = () => {
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
      resolve(img)
    }

    const onError = (error: Event) => {
      img.removeEventListener('load', onLoad)
      img.removeEventListener('error', onError)
      reject(new Error(`Failed to load image ${key}: ${error}`))
    }

    img.addEventListener('load', onLoad, { once: true })
    img.addEventListener('error', onError, { once: true })

    img.src = url

    // Timeout fallback
    setTimeout(() => {
      if (img.complete) {
        resolve(img)
      } else {
        reject(new Error(`Image ${key} load timeout`))
      }
    }, 10000) // 10 second timeout
  })
}

/**
 * Preflight all assets before export
 */
export async function preflightAssets(
  videos: Map<string, Blob>,
  images: Map<string, string>,
  fonts: string[]
): Promise<PreflightResult> {
  const result: PreflightResult = {
    success: true,
    errors: [],
    warnings: [],
    videoElements: new Map(),
    videoBlobUrls: new Map(),
    images: new Map(),
    fonts: [],
  }

  // Preload fonts
  try {
    await preloadFonts(fonts)
    result.fonts = fonts
  } catch (error) {
    const errorMsg = `Font preload failed: ${error instanceof Error ? error.message : String(error)}`
    result.errors.push(errorMsg)
    result.success = false
  }

  // Preload videos
  const videoPromises = Array.from(videos.entries()).map(async ([key, blob]) => {
    try {
      const { video, url } = await preloadVideo(blob, key)
      result.videoElements.set(key, video)
      result.videoBlobUrls.set(key, url) // Keep blob URL alive
    } catch (error) {
      const errorMsg = `Video preload failed for ${key}: ${error instanceof Error ? error.message : String(error)}`
      result.errors.push(errorMsg)
      result.success = false
    }
  })

  await Promise.all(videoPromises)

  // Preload images
  const imagePromises = Array.from(images.entries()).map(async ([key, url]) => {
    try {
      const img = await preloadImage(url, key)
      result.images.set(key, img)
    } catch (error) {
      const errorMsg = `Image preload failed for ${key}: ${error instanceof Error ? error.message : String(error)}`
      result.warnings.push(errorMsg) // Images are warnings, not errors
    }
  })

  await Promise.all(imagePromises)

  return result
}

/**
 * Ensure video frame is available at specific time
 */
export async function ensureVideoFrame(
  video: HTMLVideoElement,
  time: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.01) {
      // Already at correct time
      if (video.readyState >= 2) {
        resolve()
        return
      }
    }

    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      resolve()
    }

    const onError = (error: Event) => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      reject(new Error(`Video seek failed: ${error}`))
    }

    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })

    video.currentTime = time

    // Timeout fallback
    setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.1) {
        resolve()
      } else {
        reject(new Error(`Video seek timeout at ${time}s`))
      }
    }, 5000) // 5 second timeout
  })
}

