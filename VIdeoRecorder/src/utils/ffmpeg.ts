import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpegInstance: FFmpeg | null = null
let isLoaded = false
let isLoading = false

/**
 * Initialize and load FFmpeg with WebAssembly
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
    ffmpegInstance = new FFmpeg()
    
    // Set up logging
    ffmpegInstance.on('log', ({ message }) => {
      console.log('FFmpeg:', message)
    })

    // Load FFmpeg WebAssembly files
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
    await ffmpegInstance.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    })

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
async function writeFile(ffmpeg: FFmpeg, filename: string, blob: Blob): Promise<void> {
  const data = await fetchFile(blob)
  await ffmpeg.writeFile(filename, data)
}

/**
 * Read file from FFmpeg filesystem as Blob
 */
async function readFile(ffmpeg: FFmpeg, filename: string): Promise<Blob> {
  const data = await ffmpeg.readFile(filename)
  if (data instanceof Uint8Array) {
    return new Blob([data])
  }
  return data as Blob
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

/**
 * Combine video layers with layout
 */
export async function combineVideos(
  cameraBlob: Blob | null,
  microphoneBlob: Blob | null,
  screenBlob: Blob | null,
  layout: {
    type: 'side-by-side' | 'picture-in-picture' | 'screen-only' | 'camera-only' | 'custom'
    cameraPosition?: { x: number; y: number; width: number; height: number }
    screenPosition?: { x: number; y: number; width: number; height: number }
  },
  outputFilename: string = 'output.mp4',
  outputWidth: number = 1920,
  outputHeight: number = 1080
): Promise<Blob> {
  const ffmpeg = await getFFmpeg()
  
  try {
    const inputs: string[] = []
    const inputLabels: string[] = []
    
    // Write input files and collect labels
    if (cameraBlob) {
      await writeFile(ffmpeg, 'camera.mp4', cameraBlob)
      inputs.push('-i', 'camera.mp4')
      inputLabels.push('camera')
    }
    
    if (screenBlob) {
      await writeFile(ffmpeg, 'screen.mp4', screenBlob)
      inputs.push('-i', 'screen.mp4')
      inputLabels.push('screen')
    }
    
    if (microphoneBlob) {
      await writeFile(ffmpeg, 'microphone.mp4', microphoneBlob)
      inputs.push('-i', 'microphone.mp4')
      inputLabels.push('microphone')
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
      filterComplex = `[0:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'screen-only' && hasScreen) {
      // Screen only
      const screenIndex = hasCamera ? 1 : 0
      filterComplex = `[${screenIndex}:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'side-by-side' && hasCamera && hasScreen) {
      // Side by side - camera on left, screen on right
      const cameraScaleW = Math.floor(outputWidth / 2)
      const cameraScaleH = outputHeight
      const screenScaleW = Math.floor(outputWidth / 2)
      const screenScaleH = outputHeight
      
      filterComplex = `[0:v]scale=${cameraScaleW}:${cameraScaleH}:force_original_aspect_ratio=decrease,pad=${cameraScaleW}:${cameraScaleH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[cam];[1:v]scale=${screenScaleW}:${screenScaleH}:force_original_aspect_ratio=decrease,pad=${screenScaleW}:${screenScaleH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[scr];[cam][scr]hstack=inputs=2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'picture-in-picture' && hasCamera && hasScreen) {
      // Picture in picture - screen is main, camera is PiP
      const pipWidth = Math.floor(outputWidth * 0.3)
      const pipHeight = Math.floor(outputHeight * 0.3)
      const pipX = outputWidth - pipWidth - 20
      const pipY = 20
      
      filterComplex = `[1:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[bg];[0:v]scale=${pipWidth}:${pipHeight}:force_original_aspect_ratio=decrease,pad=${pipWidth}:${pipHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[pip];[bg][pip]overlay=${pipX}:${pipY},format=yuv420p[v0]`
      videoOutput = '[v0]'
    } else if (layout.type === 'custom' && layout.cameraPosition && layout.screenPosition) {
      // Custom layout with specified positions
      const camX = Math.floor(layout.cameraPosition.x * outputWidth / 100)
      const camY = Math.floor(layout.cameraPosition.y * outputHeight / 100)
      const camW = Math.floor(layout.cameraPosition.width * outputWidth / 100)
      const camH = Math.floor(layout.cameraPosition.height * outputHeight / 100)
      
      const scrX = Math.floor(layout.screenPosition.x * outputWidth / 100)
      const scrY = Math.floor(layout.screenPosition.y * outputHeight / 100)
      const scrW = Math.floor(layout.screenPosition.width * outputWidth / 100)
      const scrH = Math.floor(layout.screenPosition.height * outputHeight / 100)
      
      if (hasCamera && hasScreen) {
        // Create black background, overlay screen, then camera
        filterComplex = `color=black:size=${outputWidth}x${outputHeight}:duration=1[bg];[1:v]scale=${scrW}:${scrH}:force_original_aspect_ratio=decrease,pad=${scrW}:${scrH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[scr];[0:v]scale=${camW}:${camH}:force_original_aspect_ratio=decrease,pad=${camW}:${camH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[cam];[bg][scr]overlay=${scrX}:${scrY}[tmp];[tmp][cam]overlay=${camX}:${camY},format=yuv420p[v0]`
        videoOutput = '[v0]'
        inputs.unshift('-f', 'lavfi', '-i', `color=black:size=${outputWidth}x${outputHeight}:duration=10`)
      } else if (hasCamera) {
        filterComplex = `color=black:size=${outputWidth}x${outputHeight}:duration=1[bg];[0:v]scale=${camW}:${camH}:force_original_aspect_ratio=decrease,pad=${camW}:${camH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[cam];[bg][cam]overlay=${camX}:${camY},format=yuv420p[v0]`
        videoOutput = '[v0]'
        inputs.unshift('-f', 'lavfi', '-i', `color=black:size=${outputWidth}x${outputHeight}:duration=10`)
      } else if (hasScreen) {
        filterComplex = `color=black:size=${outputWidth}x${outputHeight}:duration=1[bg];[0:v]scale=${scrW}:${scrH}:force_original_aspect_ratio=decrease,pad=${scrW}:${scrH}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[scr];[bg][scr]overlay=${scrX}:${scrY},format=yuv420p[v0]`
        videoOutput = '[v0]'
        inputs.unshift('-f', 'lavfi', '-i', `color=black:size=${outputWidth}x${outputHeight}:duration=10`)
      }
    } else {
      // Fallback: use first available video
      filterComplex = `[0:v]scale=${outputWidth}:${outputHeight}:force_original_aspect_ratio=decrease,pad=${outputWidth}:${outputHeight}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[v0]`
      videoOutput = '[v0]'
    }
    
    // Handle audio - microphone is always last input
    let audioInput = ''
    let audioFilter = ''
    let audioOutput = ''
    
    if (hasMicrophone) {
      // Microphone is always the last input
      const micIndex = inputs.length / 2 - 1  // inputs array has pairs of ['-i', 'filename']
      audioInput = `[${micIndex}:a]`
      audioFilter = audioInput
      audioOutput = '[a0]'
    }
    
    // Build full filter complex
    let fullFilter = filterComplex
    if (audioOutput) {
      fullFilter += `;${audioFilter}${audioOutput}`
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
    
    ffmpegArgs.push(
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-shortest'
    )
    
    if (audioOutput) {
      ffmpegArgs.push(
        '-c:a', 'aac',
        '-b:a', '192k',
        '-ar', '48000'
      )
    }
    
    ffmpegArgs.push(outputFilename)
    
    await ffmpeg.exec(ffmpegArgs)
    
    const outputBlob = await readFile(ffmpeg, outputFilename)
    
    // Cleanup
    try {
      await ffmpeg.deleteFile(outputFilename)
      if (hasCamera) await ffmpeg.deleteFile('camera.mp4')
      if (hasScreen) await ffmpeg.deleteFile('screen.mp4')
      if (hasMicrophone) await ffmpeg.deleteFile('microphone.mp4')
    } catch (e) {
      // Ignore cleanup errors
    }
    
    return outputBlob
  } catch (error) {
    console.error('Error combining videos:', error)
    throw error
  }
}

/**
 * Concatenate multiple video segments
 */
export async function concatVideos(
  videoBlobs: Blob[],
  outputFilename: string = 'output.mp4'
): Promise<Blob> {
  if (videoBlobs.length === 0) {
    throw new Error('No videos to concatenate')
  }
  
  if (videoBlobs.length === 1) {
    return videoBlobs[0]
  }
  
  const ffmpeg = await getFFmpeg()
  
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
  }
}


