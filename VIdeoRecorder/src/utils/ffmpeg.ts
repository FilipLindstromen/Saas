import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false
let isLoading = false

/**
 * Initialize and load FFmpeg with WebAssembly
 * Uses bundled files instead of CDN for faster and more reliable loading
 */
export async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance
  }

  if (isLoading) {
    // Wait for existing load to complete
    while (isLoading) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    if (ffmpegInstance && isLoaded) {
      return ffmpegInstance
    }
  }

  isLoading = true

  try {
    // Check for SharedArrayBuffer support (required for FFmpeg WASM)
    if (typeof SharedArrayBuffer === 'undefined') {
      throw new Error('SharedArrayBuffer is not available. Make sure the server sends Cross-Origin-Embedder-Policy and Cross-Origin-Opener-Policy headers.')
    }

    ffmpegInstance = new FFmpeg()

    // Set up logging
    ffmpegInstance.on('log', ({ message }) => {
      console.log('FFmpeg:', message)
    })

    // Load FFmpeg WebAssembly files
    const { toBlobURL, fetchFile } = await import('@ffmpeg/util')
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
    const cdnCoreJs = `${baseURL}/ffmpeg-core.js`
    const cdnCoreWasm = `${baseURL}/ffmpeg-core.wasm`

    let loadedSuccessfully = false
    let lastError: any = null

    // Strategy 1: Use toBlobURL with CDN (best for require-corp policy)
    try {
      console.log('Strategy 1: Loading FFmpeg with toBlobURL from CDN (ESM)')
      await ffmpegInstance.load({
        coreURL: await toBlobURL(cdnCoreJs, 'text/javascript'),
        wasmURL: await toBlobURL(cdnCoreWasm, 'application/wasm'),
      })
      loadedSuccessfully = true
    } catch (blobError) {
      console.warn('toBlobURL CDN failed (ESM):', blobError)
      lastError = blobError
    }

    // Strategy 2: Use fetchFile + blob URLs from CDN (if toBlobURL failed)
    if (!loadedSuccessfully) {
      try {
        console.log('Strategy 2: Loading FFmpeg with fetchFile + blob URLs from CDN (ESM)')
        const coreJsData = await fetchFile(cdnCoreJs)
        const coreWasmData = await fetchFile(cdnCoreWasm)

        const coreJsBlob = coreJsData instanceof Blob
          ? coreJsData
          : new Blob([coreJsData as any], { type: 'text/javascript' })
        const coreWasmBlob = coreWasmData instanceof Blob
          ? coreWasmData
          : new Blob([coreWasmData as any], { type: 'application/wasm' })

        const coreJsURL = URL.createObjectURL(coreJsBlob)
        const coreWasmURL = URL.createObjectURL(coreWasmBlob)

        try {
          await ffmpegInstance.load({
            coreURL: coreJsURL,
            wasmURL: coreWasmURL,
          })
          loadedSuccessfully = true
          // Don't revoke URLs immediately - FFmpeg may need them during initialization
          // They will be cleaned up when the page unloads or we can revoke them later
        } catch (loadError) {
          URL.revokeObjectURL(coreJsURL)
          URL.revokeObjectURL(coreWasmURL)
          throw loadError
        }
      } catch (fetchError) {
        console.warn('fetchFile CDN failed (ESM):', fetchError)
        lastError = fetchError
      }
    }

    if (!loadedSuccessfully) {
      try {
        console.log('Strategy 3: Loading FFmpeg from local files (ESM)')
        const localCoreJs = '/ffmpeg/ffmpeg-core.js'
        const localCoreWasm = '/ffmpeg/ffmpeg-core.wasm'
        // const localWorkerJs = '/ffmpeg/ffmpeg-core.worker.js' // Removed as workerURL is no longer used

        // Try direct loading first if possible (some environments prefer this)
        try {
          await ffmpegInstance.load({
            coreURL: localCoreJs,
            wasmURL: localCoreWasm,
          })
          loadedSuccessfully = true
          console.log('Strategy 3.1: Local files direct load successful')
        } catch (directError) {
          console.warn('Strategy 3.1: Local files direct load failed, trying blob URLs', directError)

          const coreJsData = await fetchFile(localCoreJs)
          const coreWasmData = await fetchFile(localCoreWasm)

          const coreJsBlob = coreJsData instanceof Blob
            ? coreJsData
            : new Blob([coreJsData as any], { type: 'text/javascript' })
          const coreWasmBlob = coreWasmData instanceof Blob
            ? coreWasmData
            : new Blob([coreWasmData as any], { type: 'application/wasm' })

          const coreJsURL = URL.createObjectURL(coreJsBlob)
          const coreWasmURL = URL.createObjectURL(coreWasmBlob)

          try {
            await ffmpegInstance.load({
              coreURL: coreJsURL,
              wasmURL: coreWasmURL,
            })
            loadedSuccessfully = true
            console.log('Strategy 3.2: Local files with blob URLs successful')
          } catch (loadError) {
            URL.revokeObjectURL(coreJsURL)
            URL.revokeObjectURL(coreWasmURL)
            throw loadError
          }
        }
      } catch (localError) {
        console.warn('Local files failed (ESM):', localError)
        lastError = localError
      }
    }

    if (!loadedSuccessfully) {
      throw new Error(`Failed to load FFmpeg from all sources. Last error: ${lastError?.message || lastError}`)
    }

    isLoaded = true
    isLoading = false
    return ffmpegInstance
  } catch (error) {
    isLoading = false
    throw new Error(`Failed to load FFmpeg: ${error}`)
  }
}

/**
 * Convert Blob to file in FFmpeg filesystem
 */
async function writeFile(ffmpeg: FFmpeg, filename: string, blob: Blob, retries: number = 3): Promise<void> {
  let lastError: any = null
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const data = await fetchFile(blob)
      await ffmpeg.writeFile(filename, data)
      return // Success
    } catch (error) {
      lastError = error
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn(`Attempt ${attempt + 1}/${retries} to write ${filename} failed:`, errorMsg)
      
      // If it's an FS error and we have retries left, wait before retrying
      if (attempt < retries - 1) {
        const waitTime = (errorMsg.includes('FS error') || errorMsg.includes('ErrnoError')) 
          ? 300 * (attempt + 1) // Longer wait for FS errors
          : 100 * (attempt + 1)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }
  
  throw new Error(`Failed to write file ${filename} after ${retries} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

/**
 * Read file from FFmpeg filesystem as Blob
 */
async function readFile(ffmpeg: FFmpeg, filename: string, retries: number = 3, delay: number = 200): Promise<Blob> {
  let lastError: any = null
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      // Increasing delay before reading to ensure file is fully written
      // Longer delays for later attempts to give filesystem more time
      const waitTime = attempt === 0 ? 100 : delay * (attempt + 1)
      await new Promise(resolve => setTimeout(resolve, waitTime))
      
      // Try to read the file
      const data = await ffmpeg.readFile(filename)
      
      if (data instanceof Uint8Array) {
        const blob = new Blob([data as any])
        if (blob.size === 0) {
          throw new Error('File is empty')
        }
        return blob
      }
      // Handle string case (unlikely for binary files but possible for text)
      if (typeof data === 'string') {
        return new Blob([data], { type: 'text/plain' })
      }
      const blob = data as unknown as Blob
      if (blob.size === 0) {
        throw new Error('File is empty')
      }
      return blob
    } catch (error) {
      lastError = error
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.warn(`Attempt ${attempt + 1}/${retries} to read ${filename} failed:`, errorMsg)
      
      // If it's an FS error and we have retries left, wait longer
      if (attempt < retries - 1) {
        const waitTime = errorMsg.includes('FS error') || errorMsg.includes('ErrnoError') 
          ? delay * (attempt + 2) * 2 // Double wait time for FS errors
          : delay * (attempt + 1)
        await new Promise(resolve => setTimeout(resolve, waitTime))
      }
    }
  }
  
  throw new Error(`Failed to read file ${filename} after ${retries} attempts: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
}

/**
 * Get video duration using FFmpeg
 */
export async function getVideoDuration(blob: Blob): Promise<number> {
  const ffmpeg = await getFFmpeg()
  const inputFile = 'input.mp4'

  try {
    await writeFile(ffmpeg, inputFile, blob)

    // Run ffprobe to get duration
    await ffmpeg.exec([
      '-i', inputFile,
      '-hide_banner'
    ])

    // FFmpeg outputs duration to stderr, we'll use a different approach
    // Actually, let's just use the HTML5 video element for duration
    return new Promise((resolve) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.onloadedmetadata = () => {
        resolve(video.duration)
        URL.revokeObjectURL(video.src)
      }
      video.src = URL.createObjectURL(blob)
    })
  } finally {
    try {
      await ffmpeg.deleteFile(inputFile)
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

/**
 * Apply cuts to a video (remove segments)
 */
export async function applyCuts(
  inputBlob: Blob,
  cuts: Array<{ start: number; end: number }>,
  outputFilename: string = 'output.mp4'
): Promise<Blob> {
  if (cuts.length === 0) {
    return inputBlob
  }

  const ffmpeg = await getFFmpeg()
  const inputFile = 'input_cut.mp4'

  try {
    // Write input file
    await writeFile(ffmpeg, inputFile, inputBlob)

    // Get video duration
    const duration = await getVideoDuration(inputBlob)

    // Sort cuts by start time
    const sortedCuts = [...cuts].sort((a, b) => a.start - b.start)

    // Create segments (parts to keep)
    const segments: Array<{ start: number; end: number }> = []
    let currentStart = 0

    for (const cut of sortedCuts) {
      if (currentStart < cut.start) {
        segments.push({ start: currentStart, end: cut.start })
      }
      currentStart = Math.max(currentStart, cut.end)
    }

    // Add final segment if there's remaining video
    if (currentStart < duration) {
      segments.push({ start: currentStart, end: duration })
    }

    if (segments.length === 0) {
      // No segments to keep, return empty video
      return new Blob([], { type: 'video/mp4' })
    }

    // Build filter complex for concatenating segments
    // We'll use the concat demuxer approach
    if (segments.length === 1) {
      // Simple trim - only one segment
      const segment = segments[0]
      await ffmpeg.exec([
        '-i', inputFile,
        '-ss', segment.start.toFixed(3),
        '-t', (segment.end - segment.start).toFixed(3),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        outputFilename
      ])
    } else {
      // Multiple segments - need to trim each and concat
      const segmentFiles: string[] = []
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i]
        const segmentFile = `segment_${i}.mp4`
        segmentFiles.push(segmentFile)

        await ffmpeg.exec([
          '-i', inputFile,
          '-ss', segment.start.toFixed(3),
          '-t', (segment.end - segment.start).toFixed(3),
          '-c', 'copy',
          '-avoid_negative_ts', 'make_zero',
          segmentFile
        ])
      }

      // Create concat file list
      const concatList = segmentFiles.map(f => `file '${f}'`).join('\n')
      await ffmpeg.writeFile('concat_list.txt', concatList)

      // Concatenate segments
      await ffmpeg.exec([
        '-f', 'concat',
        '-safe', '0',
        '-i', 'concat_list.txt',
        '-c', 'copy',
        outputFilename
      ])

      // Cleanup segment files
      for (const file of segmentFiles) {
        try {
          await ffmpeg.deleteFile(file)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      try {
        await ffmpeg.deleteFile('concat_list.txt')
      } catch (e) {
        // Ignore cleanup errors
      }
    }

    // Read output
    const outputBlob = await readFile(ffmpeg, outputFilename)

    // Cleanup
    try {
      await ffmpeg.deleteFile(outputFilename)
      await ffmpeg.deleteFile(inputFile)
    } catch (e) {
      // Ignore cleanup errors
    }

    return outputBlob
  } catch (error) {
    console.error('Error applying cuts:', error)
    throw error
  }
}

/**
 * Trim a video (extract a segment)
 */
export async function trimVideo(
  inputBlob: Blob,
  start: number,
  end: number,
  outputFilename: string = 'output.mp4'
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  const inputFile = 'input_trim.mp4'

  try {
    await writeFile(ffmpeg, inputFile, inputBlob)

    const duration = end - start

    await ffmpeg.exec([
      '-i', inputFile,
      '-ss', start.toFixed(3),
      '-t', duration.toFixed(3),
      '-c', 'copy',
      '-avoid_negative_ts', 'make_zero',
      outputFilename
    ])

    const outputBlob = await readFile(ffmpeg, outputFilename)

    // Cleanup
    try {
      await ffmpeg.deleteFile(outputFilename)
      await ffmpeg.deleteFile(inputFile)
    } catch (e) {
      // Ignore cleanup errors
    }

    return outputBlob
  } catch (error) {
    console.error('Error trimming video:', error)
    throw error
  }
}


export interface AudioProperties {
  volume: number // in dB
  enhanceVoice: boolean
  removeNoise: boolean
  noiseRemovalLevel: number
  audioQuality: 'fast' | 'balanced' | 'best'
}

export interface Layout {
  type: 'side-by-side' | 'picture-in-picture' | 'screen-only' | 'camera-only' | 'custom'
  cameraPosition?: { x: number; y: number; width: number; height: number }
  screenPosition?: { x: number; y: number; width: number; height: number }
  outputFilename?: string
  outputWidth?: number
  outputHeight?: number
}

/**
 * Combine video and audio blobs into a single video file with specific layout
 */
export interface CaptionData {
  words: Array<{
    text: string
    start: number
    end: number
  }>
  style: {
    fontFamily: string
    fontSize: number
    backgroundColor: string
    textColor: string
    padding: number
    borderRadius: number
    fontWeight: string | number
    textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize'
  }
}

export interface TitleData {
  text: string
  x: number // Position (0-1, relative to canvas width)
  y: number // Position (0-1, relative to canvas height)
  textAlign?: 'left' | 'center' | 'right'
  font?: string
  fontSize?: number
  lineHeight?: number
  animationIn?: 'none' | 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'zoomOut'
  animationOut?: 'none' | 'fade' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'zoomIn' | 'zoomOut'
  animationDuration?: number
  timelineStart?: number
  timelineEnd?: number
}

export interface BackgroundImageData {
  url: string // Data URL or blob URL
  x: number
  y: number
  width: number
  height: number
  scale?: number
  flipHorizontal?: boolean
  alpha?: number
}

export async function combineVideos(
  cameraBlob: Blob | null,
  microphoneBlob: Blob | null,
  screenBlob: Blob | null,
  layout: Layout,
  outputFilename: string = 'output.mp4',
  outputWidth: number = 1920,
  outputHeight: number = 1080,
  audioProps?: {
    camera?: AudioProperties
    microphone?: AudioProperties
    screen?: AudioProperties
  },
  captionData?: CaptionData,
  backgroundMusicFile: Blob | null = null,
  backgroundMusicVolume: number = 0.5,
  videoDuration: number = 0,
  onProgress?: (progress: number) => void,
  titleData?: TitleData,
  backgroundImageData?: BackgroundImageData
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()

  // Set up progress listener
  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(progress)
  }
  ffmpeg.on('progress', progressHandler)

  try {
    const inputs: string[] = []
    const inputLabels: string[] = []
    let inputCount = 0

    // Write input files and collect labels
    let cameraIndex = -1
    let screenIndex = -1
    let microphoneIndex = -1
    let musicIndex = -1
    let backgroundIndex = -1

    if (cameraBlob) {
      await writeFile(ffmpeg, 'camera.mp4', cameraBlob)
      inputs.push('-i', 'camera.mp4')
      inputLabels.push('camera')
      cameraIndex = inputCount++
    }

    if (screenBlob) {
      await writeFile(ffmpeg, 'screen.mp4', screenBlob)
      inputs.push('-i', 'screen.mp4')
      inputLabels.push('screen')
      screenIndex = inputCount++
    }

    if (microphoneBlob) {
      await writeFile(ffmpeg, 'microphone.mp4', microphoneBlob)
      inputs.push('-i', 'microphone.mp4')
      inputLabels.push('microphone')
      microphoneIndex = inputCount++
    }

    // Add background music if provided
    let hasBackgroundMusic = false
    if (backgroundMusicFile) {
      try {
        // Determine file extension from blob type
        const musicExt = backgroundMusicFile.type.includes('webm') ? 'webm' :
          backgroundMusicFile.type.includes('ogg') ? 'ogg' : 'mp3'
        const musicFile = `background_music.${musicExt}`
        await writeFile(ffmpeg, musicFile, backgroundMusicFile)
        inputs.push('-i', musicFile)
        inputLabels.push('music')
        hasBackgroundMusic = true
        musicIndex = inputCount++
      } catch (error) {
        console.warn('Failed to load background music:', error)
        // Continue without background music
      }
    }

    if (inputs.length === 0) {
      throw new Error('No video or audio inputs provided')
    }

    // Determine which inputs we have
    const hasCamera = cameraBlob !== null
    const hasScreen = screenBlob !== null
    const hasMicrophone = microphoneBlob !== null

    // Build filter complex based on layout
    let filterComplex = ''
    let videoOutput = ''

    if (layout.type === 'camera-only' && hasCamera) {
      // Camera only
      filterComplex = `[${cameraIndex}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'screen-only' && hasScreen) {
      // Screen only
      filterComplex = `[${screenIndex}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'side-by-side' && hasCamera && hasScreen) {
      // Side by side - camera on left, screen on right
      const cameraScaleW = Math.floor(outputWidth / 2)
      const cameraScaleH = outputHeight
      const screenScaleW = Math.floor(outputWidth / 2)
      const screenScaleH = outputHeight

      filterComplex = `[${cameraIndex}:v]scale=${cameraScaleW}:${cameraScaleH}:force_original_aspect_ratio=decrease,pad=${cameraScaleW}:${cameraScaleH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[cam];[${screenIndex}:v]scale=${screenScaleW}:${screenScaleH}:force_original_aspect_ratio=decrease,pad=${screenScaleW}:${screenScaleH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[scr];[cam][scr]hstack=inputs=2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'picture-in-picture' && hasCamera && hasScreen) {
      // Picture in picture - screen is main, camera is PiP
      const pipWidth = Math.floor(outputWidth * 0.3)
      const pipHeight = Math.floor(outputHeight * 0.3)
      const pipX = outputWidth - pipWidth - 20
      const pipY = 20

      filterComplex = `[${screenIndex}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[bg];[${cameraIndex}:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=decrease,pad=${pipWidth}:${pipHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[pip];[bg][pip]overlay=${pipX}:${pipY},format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'custom' && (layout.cameraPosition || layout.screenPosition)) {
      // Custom layout with specified positions
      // Add black background as an input if needed
      inputs.unshift('-f', 'lavfi', '-i', `color=black:size=${outputWidth}x${outputHeight}:duration=${videoDuration > 0 ? videoDuration : 10}`)
      backgroundIndex = 0
      // Shift all other indices
      if (cameraIndex !== -1) cameraIndex++
      if (screenIndex !== -1) screenIndex++
      if (microphoneIndex !== -1) microphoneIndex++
      if (musicIndex !== -1) musicIndex++
      inputCount++

      let currentVideoChain = `[${backgroundIndex}:v]scale=${outputWidth}:${outputHeight}[bg]`

      if (hasScreen && layout.screenPosition) {
        // Convert percentage (0-100) to pixels
        const scrX = Math.floor(layout.screenPosition.x * outputWidth / 100)
        const scrY = Math.floor(layout.screenPosition.y * outputHeight / 100)
        const scrW = Math.floor(layout.screenPosition.width * outputWidth / 100)
        const scrH = Math.floor(layout.screenPosition.height * outputHeight / 100)
        const scrRotation = layout.screenPosition.rotation || 0
        
        // Scale video to match holder size, using object-cover behavior (crop to fill)
        // This matches CSS object-cover: scale to cover, maintaining aspect ratio
        // Revert to working approach: use decrease with pad (object-contain), which is more reliable
        // Note: This doesn't exactly match object-cover but is more stable
        let screenFilter = `[${screenIndex}:v]scale=${scrW}:${scrH}:force_original_aspect_ratio=decrease,pad=${scrW}:${scrH}:(ow-iw)/2:(oh-ih)/2`
        
        // Apply rotation if needed (after scaling and padding)
        if (scrRotation !== 0) {
          // Rotation in FFmpeg rotate filter uses radians
          const rotationRad = scrRotation * Math.PI / 180
          screenFilter += `,rotate=${rotationRad}:fillcolor=black@0`
        }
        
        screenFilter += `,format=yuv420p[scr]`
        currentVideoChain += `;${screenFilter};[bg][scr]overlay=${scrX}:${scrY}[tmp_scr]`
        videoOutput = '[tmp_scr]'
      } else {
        videoOutput = '[bg]'
      }

      if (hasCamera && layout.cameraPosition) {
        // Convert percentage (0-100) to pixels
        const camX = Math.floor(layout.cameraPosition.x * outputWidth / 100)
        const camY = Math.floor(layout.cameraPosition.y * outputHeight / 100)
        const camW = Math.floor(layout.cameraPosition.width * outputWidth / 100)
        const camH = Math.floor(layout.cameraPosition.height * outputHeight / 100)
        const camRotation = layout.cameraPosition.rotation || 0
        
        // Scale video to match holder size, using object-cover behavior (crop to fill)
        // This matches CSS object-cover: scale to cover, maintaining aspect ratio
        // Revert to working approach: use decrease with pad (object-contain), which is more reliable
        // Note: This doesn't exactly match object-cover but is more stable
        let cameraFilter = `[${cameraIndex}:v]scale=${camW}:${camH}:force_original_aspect_ratio=decrease,pad=${camW}:${camH}:(ow-iw)/2:(oh-ih)/2`
        
        // Apply rotation if needed (after scaling and padding)
        if (camRotation !== 0) {
          // Rotation in FFmpeg rotate filter uses radians
          const rotationRad = camRotation * Math.PI / 180
          cameraFilter += `,rotate=${rotationRad}:fillcolor=black@0`
        }
        
        cameraFilter += `,format=yuv420p[cam]`
        currentVideoChain += `;${cameraFilter};${videoOutput}[cam]overlay=${camX}:${camY}[v0]`
        videoOutput = '[v0]'
      } else if (videoOutput === '[bg]') {
        // If only background and no camera/screen, just output background
        currentVideoChain += `;[bg]null[v0]`
        videoOutput = '[v0]'
      } else if (videoOutput === '[tmp_scr]') {
        // If only screen and no camera, rename output
        currentVideoChain += `;[tmp_scr]null[v0]`
        videoOutput = '[v0]'
      }
      
      // Add background image if present
      if (backgroundImageData) {
        try {
          const bgImgBlob = await fetch(backgroundImageData.url).then(r => r.blob())
          const bgImgData = await fetchFile(bgImgBlob)
          await writeFile(ffmpeg, 'background_image.png', bgImgData)
          
          // Background image positions are in 0-1 range (relative to canvas)
          const bgX = Math.floor(backgroundImageData.x * outputWidth)
          const bgY = Math.floor(backgroundImageData.y * outputHeight)
          const bgW = Math.floor(backgroundImageData.width * outputWidth)
          const bgH = Math.floor(backgroundImageData.height * outputHeight)
          
          inputs.push('-i', 'background_image.png')
          const bgImgIndex = inputCount++
          
          currentVideoChain += `;[${bgImgIndex}:v]scale=${bgW}:${bgH}:force_original_aspect_ratio=decrease,format=rgba[bgimg];${videoOutput}[bgimg]overlay=${bgX}:${bgY}[v_bg]`
          videoOutput = '[v_bg]'
        } catch (error) {
          console.warn('Failed to add background image:', error)
        }
      }
      
      // Add title text if present
      if (titleData && titleData.text) {
        const titleText = titleData.text.replace(/<[^>]*>/g, '') // Remove HTML tags
        const titleX = Math.floor(titleData.x * outputWidth)
        const titleY = Math.floor(titleData.y * outputHeight)
        const fontSize = titleData.fontSize || 48
        const animationIn = titleData.animationIn || 'fade'
        const animationOut = titleData.animationOut || 'fade'
        const animationDuration = titleData.animationDuration || 0.5
        const timelineStart = titleData.timelineStart || 0
        const timelineEnd = titleData.timelineEnd || videoDuration
        
        // Calculate text alignment - FFmpeg drawtext uses x position differently
        // For center/right, we need to calculate the actual x position
        let textX = titleX
        let textAlignParam = ''
        if (titleData.textAlign === 'center') {
          // For center, x is the center point, use text_align=center
          textAlignParam = ':text_align=center'
        } else if (titleData.textAlign === 'right') {
          // For right, x is the right edge, use text_align=right
          textAlignParam = ':text_align=right'
        }
        
        // Escape special characters for FFmpeg drawtext
        // FFmpeg drawtext requires escaping: \ ' : [ ]
        const escapeDrawtext = (text: string): string => {
          return text
            .replace(/\\/g, '\\\\')  // Escape backslashes first
            .replace(/'/g, "\\'")    // Escape single quotes
            .replace(/:/g, "\\:")     // Escape colons
            .replace(/\[/g, "\\[")   // Escape brackets
            .replace(/\]/g, "\\]")   // Escape brackets
        }
        
        // Build alpha expression for fade animations
        let alphaExpression = '1.0' // Default: fully opaque
        if (animationIn === 'fade' || animationOut === 'fade') {
          // Calculate fade based on time
          // For fade in: alpha goes from 0 to 1 during animationDuration at the start
          // For fade out: alpha goes from 1 to 0 during animationDuration at the end
          const fadeInStart = timelineStart
          const fadeInEnd = timelineStart + animationDuration
          const fadeOutStart = timelineEnd - animationDuration
          const fadeOutEnd = timelineEnd
          
          if (animationIn === 'fade' && animationOut === 'fade') {
            // Both fade in and fade out
            alphaExpression = `if(between(t,${fadeInStart},${fadeInEnd}), (t-${fadeInStart})/${animationDuration}, if(between(t,${fadeOutStart},${fadeOutEnd}), 1-(t-${fadeOutStart})/${animationDuration}, if(lt(t,${fadeInStart}), 0, if(gt(t,${fadeOutEnd}), 0, 1))))`
          } else if (animationIn === 'fade') {
            // Only fade in
            alphaExpression = `if(between(t,${fadeInStart},${fadeInEnd}), (t-${fadeInStart})/${animationDuration}, if(lt(t,${fadeInStart}), 0, 1))`
          } else if (animationOut === 'fade') {
            // Only fade out
            alphaExpression = `if(between(t,${fadeOutStart},${fadeOutEnd}), 1-(t-${fadeOutStart})/${animationDuration}, if(gt(t,${fadeOutEnd}), 0, 1))`
          }
        }
        
        // Handle line breaks
        const lines = titleText.split('\n').filter(line => line.trim())
        if (lines.length > 1) {
          const lineHeight = fontSize * (titleData.lineHeight || 1.2)
          let currentOutput = videoOutput
          lines.forEach((line, index) => {
            const lineY = titleY + (index * lineHeight)
            const escapedLine = escapeDrawtext(line)
            const lineFilter = `drawtext=text='${escapedLine}':fontsize=${fontSize}:fontcolor=white@${alphaExpression}:x=${textX}:y=${lineY}${textAlignParam}:shadowx=2:shadowy=2:shadowcolor=black@0.8:enable='between(t,${timelineStart},${timelineEnd})'`
            currentVideoChain += `;${currentOutput}${lineFilter}[v_title${index}]`
            currentOutput = `[v_title${index}]`
          })
          videoOutput = currentOutput
        } else if (lines.length === 1) {
          // Single line
          const escapedText = escapeDrawtext(lines[0])
          const drawtextFilter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white@${alphaExpression}:x=${textX}:y=${titleY}${textAlignParam}:shadowx=2:shadowy=2:shadowcolor=black@0.8:enable='between(t,${timelineStart},${timelineEnd})'`
          currentVideoChain += `;${videoOutput}${drawtextFilter}[v_title]`
          videoOutput = '[v_title]'
        }
      }
      
      filterComplex = currentVideoChain
    } else {
      // Fallback: use first available video
      const fallbackIndex = cameraIndex !== -1 ? cameraIndex : (screenIndex !== -1 ? screenIndex : 0)
      let fallbackChain = `[${fallbackIndex}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]`
      videoOutput = '[v0]'
      
      // Add title even in fallback mode
      if (titleData && titleData.text) {
        const titleText = titleData.text.replace(/<[^>]*>/g, '')
        const titleX = Math.floor(titleData.x * outputWidth)
        const titleY = Math.floor(titleData.y * outputHeight)
        const fontSize = titleData.fontSize || 48
        const animationIn = titleData.animationIn || 'fade'
        const animationOut = titleData.animationOut || 'fade'
        const animationDuration = titleData.animationDuration || 0.5
        const timelineStart = titleData.timelineStart || 0
        const timelineEnd = titleData.timelineEnd || videoDuration
        
        let textX = titleX
        let textAlignParam = ''
        if (titleData.textAlign === 'center') {
          textAlignParam = ':text_align=center'
        } else if (titleData.textAlign === 'right') {
          textAlignParam = ':text_align=right'
        }
        
        const escapeDrawtext = (text: string): string => {
          return text
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/:/g, "\\:")
            .replace(/\[/g, "\\[")
            .replace(/\]/g, "\\]")
        }
        
        // Build alpha expression for fade animations
        let alphaExpression = '1.0'
        if (animationIn === 'fade' || animationOut === 'fade') {
          const fadeInStart = timelineStart
          const fadeInEnd = timelineStart + animationDuration
          const fadeOutStart = timelineEnd - animationDuration
          const fadeOutEnd = timelineEnd
          
          if (animationIn === 'fade' && animationOut === 'fade') {
            alphaExpression = `if(between(t,${fadeInStart},${fadeInEnd}), (t-${fadeInStart})/${animationDuration}, if(between(t,${fadeOutStart},${fadeOutEnd}), 1-(t-${fadeOutStart})/${animationDuration}, if(lt(t,${fadeInStart}), 0, if(gt(t,${fadeOutEnd}), 0, 1))))`
          } else if (animationIn === 'fade') {
            alphaExpression = `if(between(t,${fadeInStart},${fadeInEnd}), (t-${fadeInStart})/${animationDuration}, if(lt(t,${fadeInStart}), 0, 1))`
          } else if (animationOut === 'fade') {
            alphaExpression = `if(between(t,${fadeOutStart},${fadeOutEnd}), 1-(t-${fadeOutStart})/${animationDuration}, if(gt(t,${fadeOutEnd}), 0, 1))`
          }
        }
        
        const lines = titleText.split('\n').filter(line => line.trim())
        if (lines.length > 1) {
          const lineHeight = fontSize * (titleData.lineHeight || 1.2)
          let currentOutput = videoOutput
          lines.forEach((line, index) => {
            const lineY = titleY + (index * lineHeight)
            const escapedLine = escapeDrawtext(line)
            const lineFilter = `drawtext=text='${escapedLine}':fontsize=${fontSize}:fontcolor=white@${alphaExpression}:x=${textX}:y=${lineY}${textAlignParam}:shadowx=2:shadowy=2:shadowcolor=black@0.8:enable='between(t,${timelineStart},${timelineEnd})'`
            fallbackChain += `;${currentOutput}${lineFilter}[v_title${index}]`
            currentOutput = `[v_title${index}]`
          })
          videoOutput = currentOutput
        } else if (lines.length === 1) {
          const escapedText = escapeDrawtext(lines[0])
          const drawtextFilter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=white@${alphaExpression}:x=${textX}:y=${titleY}${textAlignParam}:shadowx=2:shadowy=2:shadowcolor=black@0.8:enable='between(t,${timelineStart},${timelineEnd})'`
          fallbackChain += `;${videoOutput}${drawtextFilter}[v_title]`
          videoOutput = '[v_title]'
        }
      }
      
      filterComplex = fallbackChain
    }

    // Handle audio - microphone and background music
    let audioInput = ''
    let audioFilter = ''
    let audioOutput = ''

    if (hasMicrophone && microphoneIndex !== -1) {
      audioInput = `[${microphoneIndex}:a]`
      const props = audioProps?.microphone
      let filters: string[] = []

      if (props) {
        // Apply volume
        if (props.volume !== 0) filters.push(`volume=${props.volume}dB`)
        
        // Apply noise reduction
        if (props.removeNoise || (props as any).noiseReduction) {
          filters.push('highpass=f=100', 'lowpass=f=8000')
        }
        
        // Apply voice enhancement
        if (props.enhanceVoice || (props as any).enhanceVoice) {
          filters.push('treble=g=5:f=4000', 'bass=g=2:f=100')
        }
        
        // Apply echo removal
        if ((props as any).removeEcho) {
          filters.push('lowpass=f=8000')
        }
        
        // Apply background noise removal
        if ((props as any).removeBackgroundNoise) {
          filters.push('highpass=f=150')
        }
        
        // Apply normalization
        if ((props as any).normalizeAudio) {
          filters.push('loudnorm=I=-16:TP=-1.5:LRA=11')
        }
      }

      if (filters.length > 0) {
        audioFilter = `${audioInput}${filters.join(',')}[a0]`
      } else {
        audioFilter = `${audioInput}anull[a0]`
      }
    }

    // Add background music with fade-out
    if (hasBackgroundMusic && musicIndex !== -1) {
      const musicInputSegment = `[${musicIndex}:a]`
      let musicFilters: string[] = []

      // Apply volume
      if (backgroundMusicVolume !== 1) {
        musicFilters.push(`volume=${backgroundMusicVolume}`)
      }

      // Add fade-out 1 second before end (or at end if duration is unknown)
      if (videoDuration > 1) {
        musicFilters.push(`afade=t=out:st=${(videoDuration - 1).toFixed(3)}:d=1`)
      } else if (videoDuration > 0) {
        // If duration is very short, fade out from the start
        musicFilters.push(`afade=t=out:st=0:d=${Math.min(videoDuration, 1).toFixed(3)}`)
      }

      const musicFilterStr = musicFilters.length > 0
        ? `${musicInputSegment}${musicFilters.join(',')}[a1]`
        : `${musicInputSegment}anull[a1]`

      if (audioFilter) {
        // Mix microphone and music
        audioFilter += `;${musicFilterStr};[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]`
        audioOutput = '[aout]'
      } else {
        // Only music
        audioFilter = musicFilterStr
        audioOutput = '[a1]'
      }
    } else if (audioFilter) {
      // Only microphone
      audioOutput = '[a0]'
    }

    // Build full filter complex
    let fullFilter = filterComplex
    if (audioOutput) {
      fullFilter += `;${audioFilter}`
    }

    // Build FFmpeg command
    const ffmpegArgs: string[] = [
      ...inputs,
      '-filter_complex', fullFilter,
      '-map', videoOutput,
    ]

    if (audioOutput) {
      ffmpegArgs.push('-map', audioOutput)
    }

    // Determine audio bitrate based on quality setting
    let audioBitrate = '192k'
    if (audioProps?.microphone?.audioQuality === 'fast') audioBitrate = '128k'
    else if (audioProps?.microphone?.audioQuality === 'best') audioBitrate = '320k'

    if (audioOutput) {
      ffmpegArgs.push(
        '-c:a', 'aac',
        '-b:a', audioBitrate,
        '-ar', '48000'
      )
    }

    // High quality and performance settings
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'slow', // Better compression/quality tradeoff
      '-crf', '18',      // High quality (lower is better, 18 is visually lossless)
      '-pix_fmt', 'yuv420p',
      '-r', '60',        // Smooth 60fps
      '-profile:v', 'high',
      '-level:v', '4.2',
      '-movflags', '+faststart', // Playback optimization (atoms at front)
      '-shortest'
    )

    ffmpegArgs.push(outputFilename)

    await ffmpeg.exec(ffmpegArgs)
    
    // Longer delay after exec to ensure file is fully written to filesystem
    await new Promise(resolve => setTimeout(resolve, 500))

    const outputBlob = await readFile(ffmpeg, outputFilename, 10, 500)

    // Cleanup
    try {
      await ffmpeg.deleteFile(outputFilename)
      if (hasCamera) await ffmpeg.deleteFile('camera.mp4')
      if (hasScreen) await ffmpeg.deleteFile('screen.mp4')
      if (hasMicrophone) await ffmpeg.deleteFile('microphone.mp4')
      if (hasBackgroundMusic) {
        try {
          await ffmpeg.deleteFile('background_music.mp3')
          await ffmpeg.deleteFile('background_music.webm')
          await ffmpeg.deleteFile('background_music.ogg')
        } catch (e) {
          // Ignore cleanup errors for music files
        }
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    return outputBlob
  } catch (error) {
    console.error('Error combining videos:', error)
    throw error
  } finally {
    // Remove progress handler
    ffmpeg.off('progress', progressHandler)
  }
}

/**
 * Concatenate multiple video segments
 */
export async function concatVideos(
  videoBlobs: Blob[],
  outputFilename: string = 'output.mp4',
  onProgress?: (progress: number) => void
): Promise<Blob> {
  if (videoBlobs.length === 0) {
    throw new Error('No videos to concatenate')
  }

  if (videoBlobs.length === 1) {
    return videoBlobs[0]
  }

  const ffmpeg = await getFFmpeg()

  // Set up progress listener
  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(progress)
  }
  ffmpeg.on('progress', progressHandler)

  try {
    // Write all input files
    const inputFiles: string[] = []
    for (let i = 0; i < videoBlobs.length; i++) {
      const filename = `input_${i}.mp4`
      await writeFile(ffmpeg, filename, videoBlobs[i])
      inputFiles.push(filename)
    }

    // Create concat file list
    const concatList = inputFiles.map(f => `file '${f}'`).join('\n')
    await ffmpeg.writeFile('concat_list.txt', concatList)

    // Concatenate
    await ffmpeg.exec([
      '-f', 'concat',
      '-safe', '0',
      '-i', 'concat_list.txt',
      '-c', 'copy',
      outputFilename
    ])

    const outputBlob = await readFile(ffmpeg, outputFilename)

    // Cleanup
    try {
      await ffmpeg.deleteFile(outputFilename)
      await ffmpeg.deleteFile('concat_list.txt')
      for (const file of inputFiles) {
        await ffmpeg.deleteFile(file)
      }
    } catch (e) {
      // Ignore cleanup errors
    }

    return outputBlob
  } catch (error) {
    console.error('Error concatenating videos:', error)
    throw error
  } finally {
    // Remove progress handler
    ffmpeg.off('progress', progressHandler)
  }
}

/**
 * Encode frames from canvas into video
 */
export async function encodeFramesToVideo(
  frames: Blob[], // Array of image blobs (PNG/JPEG)
  frameRate: number = 60,
  outputFilename: string = 'output.mp4',
  audioBlob?: Blob | null,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  if (frames.length === 0) {
    throw new Error('No frames to encode')
  }

  const ffmpeg = await getFFmpeg()

  // Set up progress listener
  const progressHandler = ({ progress }: { progress: number }) => {
    if (onProgress) onProgress(progress)
  }
  ffmpeg.on('progress', progressHandler)

  const frameFiles: string[] = []
  let audioFileWritten = false

  try {
    // Write all frame images with error handling and batching to reduce memory pressure
    // Use smaller batch size to reduce filesystem pressure
    const batchSize = 20 // Reduced batch size for better stability
    for (let batchStart = 0; batchStart < frames.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, frames.length)
      
      for (let i = batchStart; i < batchEnd; i++) {
        const filename = `frame_${i.toString().padStart(6, '0')}.png`
        try {
          const frameData = await fetchFile(frames[i])
          await ffmpeg.writeFile(filename, frameData)
          frameFiles.push(filename)
        } catch (error) {
          console.error(`Error writing frame ${i}:`, error)
          // Clean up what we've written so far
          for (const file of frameFiles) {
            try {
              await ffmpeg.deleteFile(file)
            } catch (e) {
              // Ignore cleanup errors
            }
          }
          throw new Error(`Failed to write frame ${i}: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
      
      // Delay between batches to allow filesystem to recover
      if (batchEnd < frames.length) {
        await new Promise(resolve => setTimeout(resolve, 150))
      }
    }

    // Use image2 demuxer with pattern - this is the correct way to encode image sequences
    // The pattern uses %06d to match frame_000000.png, frame_000001.png, etc.
    const inputPattern = 'frame_%06d.png'

    // Build FFmpeg command using image2 demuxer
    // Structure: First specify all inputs, then encoding options with proper mapping
    const ffmpegArgs: string[] = [
      '-framerate', frameRate.toString(), // Input framerate
      '-i', inputPattern, // Input 0: image sequence pattern
    ]

    // Add audio input if provided (must be added before encoding options)
    if (audioBlob) {
      try {
        const audioData = await fetchFile(audioBlob)
        await ffmpeg.writeFile('audio.mp4', audioData)
        audioFileWritten = true
        ffmpegArgs.push('-i', 'audio.mp4') // Input 1: audio file
      } catch (error) {
        console.warn('Failed to write audio file, continuing without audio:', error)
        // Continue without audio
      }
    }

    // Map inputs to outputs (must come after all inputs are specified)
    if (audioBlob && audioFileWritten) {
      // Map video from input 0, audio from input 1
      ffmpegArgs.push('-map', '0:v', '-map', '1:a')
    } else {
      // Only video, no mapping needed (default behavior)
      ffmpegArgs.push('-map', '0:v')
    }

    // Video encoding options (only apply to video streams)
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium', // Changed from 'slow' to 'medium' for better performance
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-profile:v', 'high',
      '-level:v', '4.2',
      '-r', frameRate.toString(), // Output framerate
      '-movflags', '+faststart',
    )

    // Audio encoding options (only apply to audio streams, if audio exists)
    if (audioBlob && audioFileWritten) {
      ffmpegArgs.push(
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000',
        '-shortest' // Finish encoding when shortest input stream ends
      )
    }

    ffmpegArgs.push(outputFilename)

    try {
      await ffmpeg.exec(ffmpegArgs)
      // Wait longer after exec to ensure file is fully written and flushed
      await new Promise(resolve => setTimeout(resolve, 1000))
    } catch (error) {
      // Cleanup on exec error
      const errorMsg = error instanceof Error ? error.message : String(error)
      console.error('FFmpeg exec error:', errorMsg)
      throw new Error(`FFmpeg encoding failed: ${errorMsg}`)
    }

    // Read output file with retry logic
    let outputBlob: Blob
    try {
      // Read with more retries and longer delays
      outputBlob = await readFile(ffmpeg, outputFilename, 15, 600) // 15 retries with 600ms delays
      if (!outputBlob || outputBlob.size === 0) {
        throw new Error('Output blob is empty')
      }
      // Validate blob size is reasonable (at least 1KB)
      if (outputBlob.size < 1024) {
        throw new Error(`Output blob is too small: ${outputBlob.size} bytes`)
      }
    } catch (error) {
      // Clean up before throwing
      try {
        await ffmpeg.deleteFile(outputFilename)
      } catch (e) {
        // Ignore cleanup errors
      }
      throw new Error(`Failed to read output file: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Cleanup - always try to clean up, even if there was an error
    try {
      await ffmpeg.deleteFile(outputFilename)
    } catch (e) {
      console.warn('Failed to delete output file:', e)
    }
    if (audioFileWritten) {
      try {
        await ffmpeg.deleteFile('audio.mp4')
      } catch (e) {
        console.warn('Failed to delete audio file:', e)
      }
    }
    // Clean up frame files in batches to avoid overwhelming the filesystem
    const cleanupBatchSize = 50
    for (let i = 0; i < frameFiles.length; i += cleanupBatchSize) {
      const batch = frameFiles.slice(i, i + cleanupBatchSize)
      for (const file of batch) {
        try {
          await ffmpeg.deleteFile(file)
        } catch (e) {
          // Ignore individual frame cleanup errors
        }
      }
      // Small delay between cleanup batches
      if (i + cleanupBatchSize < frameFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 50))
      }
    }

    return outputBlob
  } catch (error) {
    // Ensure cleanup on error
    try {
      // Clean up frame files
      for (const file of frameFiles) {
        try {
          await ffmpeg.deleteFile(file)
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      // Clean up audio if written
      if (audioFileWritten) {
        try {
          await ffmpeg.deleteFile('audio.mp4')
        } catch (e) {
          // Ignore
        }
      }
      // Clean up output if it exists
      try {
        await ffmpeg.deleteFile(outputFilename)
      } catch (e) {
        // Ignore
      }
    } catch (cleanupError) {
      console.warn('Error during cleanup:', cleanupError)
    }
    
    console.error('Error encoding frames to video:', error)
    throw error
  } finally {
    // Remove progress handler
    ffmpeg.off('progress', progressHandler)
  }
}


