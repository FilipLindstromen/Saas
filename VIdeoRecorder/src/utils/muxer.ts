/**
 * MP4/WebM muxer using mp4box.js for WebCodecs chunks
 * Alternative: Can use WebM muxer for WebM format
 */

// We'll use mp4box.js for MP4 muxing if available
// For WebM, we can use a simpler approach or a WebM muxer library

export interface MuxerConfig {
  format: 'mp4' | 'webm'
  videoCodec: string
  audioCodec?: string
  width: number
  height: number
  fps: number
  duration: number // in seconds
}

export interface MuxerProgress {
  progress: number // 0-1
  message: string
}

export class Muxer {
  private config: MuxerConfig
  private videoChunks: EncodedVideoChunk[] = []
  private audioChunks: EncodedAudioChunk[] = []
  private onProgress?: (progress: MuxerProgress) => void

  constructor(config: MuxerConfig) {
    this.config = config
  }

  /**
   * Add a video chunk
   */
  addVideoChunk(chunk: EncodedVideoChunk): void {
    this.videoChunks.push(chunk)
  }

  /**
   * Add an audio chunk
   */
  addAudioChunk(chunk: EncodedAudioChunk): void {
    this.audioChunks.push(chunk)
  }

  /**
   * Mux chunks into final video file
   */
  async mux(): Promise<Blob> {
    if (this.config.format === 'mp4') {
      return this.muxMP4()
    } else {
      return this.muxWebM()
    }
  }

  /**
   * Mux to MP4 - using mp4box.js for proper MP4 structure
   */
  private async muxMP4(): Promise<Blob> {
    // Try to use mp4box.js if available
    try {
      const MP4Box = (await import('mp4box')).default
      return this.muxMP4WithMP4Box(MP4Box)
    } catch (error) {
      console.warn('mp4box.js not available for MP4 muxing', error)
      // Fallback: MP4 requires mp4box.js
      // In this case, we'll throw an error to make it clear
      throw new Error(
        'MP4 muxing requires mp4box.js. Please ensure it is installed: npm install mp4box. ' +
        'Error: ' + (error instanceof Error ? error.message : String(error))
      )
    }
  }

  private async muxMP4WithMP4Box(MP4Box: any): Promise<Blob> {
    const mp4boxFile = MP4Box.createFile()

    return new Promise((resolve, reject) => {
      const chunks: Uint8Array[] = []

      mp4boxFile.onReady = (info: any) => {
        // File is ready for writing
        if (this.onProgress) {
          this.onProgress({ progress: 0.5, message: 'Muxing video...' })
        }
      }

      mp4boxFile.onSegment = (id: number, user: any, buffer: ArrayBuffer) => {
        chunks.push(new Uint8Array(buffer))
      }

      mp4boxFile.onError = (error: any) => {
        reject(new Error(`MP4Box error: ${error}`))
      }

      // Add video track
      const videoTrack = mp4boxFile.addTrack({
        width: this.config.width,
        height: this.config.height,
        nb_samples: this.videoChunks.length,
        timescale: this.config.fps * 1000, // Use milliseconds
        duration: this.config.duration * 1000,
        name: 'Video',
        avcDecoderConfigRecord: this.getAVCConfig(), // For H.264
      })

      // Process video chunks
      let chunkIndex = 0
      for (const chunk of this.videoChunks) {
        const buffer = new ArrayBuffer(chunk.byteLength)
        const view = new Uint8Array(buffer)
        chunk.copyTo(view)

        mp4boxFile.addSample(videoTrack, buffer, {
          duration: chunk.duration || (1000 / this.config.fps),
          dts: chunk.timestamp / 1000, // Convert microseconds to milliseconds
          cts: chunk.timestamp / 1000,
          is_sync: chunk.type === 'key',
        })

        chunkIndex++
        if (this.onProgress && chunkIndex % 10 === 0) {
          this.onProgress({
            progress: 0.3 + (chunkIndex / this.videoChunks.length) * 0.4,
            message: `Muxing frame ${chunkIndex} of ${this.videoChunks.length}...`,
          })
        }
      }

      // Add audio track if present
      if (this.audioChunks.length > 0 && this.config.audioCodec) {
        const audioTrack = mp4boxFile.addTrack({
          timescale: 48000, // Audio sample rate
          duration: this.config.duration * 48000,
          name: 'Audio',
        })

        for (const chunk of this.audioChunks) {
          const buffer = new ArrayBuffer(chunk.byteLength)
          const view = new Uint8Array(buffer)
          chunk.copyTo(view)

          mp4boxFile.addSample(audioTrack, buffer, {
            duration: chunk.duration || 1024,
            dts: chunk.timestamp / 1000,
            cts: chunk.timestamp / 1000,
          })
        }
      }

      // Save file
      mp4boxFile.save('video.mp4')

      // Wait for all segments
      setTimeout(() => {
        const blob = new Blob(chunks, { type: 'video/mp4' })
        if (this.onProgress) {
          this.onProgress({ progress: 1.0, message: 'Muxing complete' })
        }
        resolve(blob)
      }, 1000)
    })
  }

  private async muxMP4Basic(): Promise<Blob> {
    // Basic MP4 muxing - just concatenate chunks
    // In production, you'd want proper MP4 structure
    const chunks: Uint8Array[] = []
    for (const chunk of this.videoChunks) {
      const buffer = new Uint8Array(chunk.byteLength)
      chunk.copyTo(buffer)
      chunks.push(buffer)
    }
    return new Blob(chunks, { type: 'video/mp4' })
  }

  /**
   * Mux to WebM (simpler, can use WebM muxer library or manual muxing)
   */
  private async muxWebM(): Promise<Blob> {
    // For WebM, we can use a WebM muxer library or implement basic muxing
    // For now, we'll create a simple WebM container
    // In production, consider using a library like 'webm-muxer' or similar

    const chunks: Uint8Array[] = []

    // WebM header (simplified - in production use a proper muxer)
    // This is a minimal implementation
    for (const chunk of this.videoChunks) {
      const buffer = new Uint8Array(chunk.byteLength)
      chunk.copyTo(buffer)
      chunks.push(buffer)
    }

    return new Blob(chunks, { type: 'video/webm' })
  }

  /**
   * Get AVC decoder config record from first keyframe
   */
  private getAVCConfig(): Uint8Array | undefined {
    // Find first keyframe chunk
    const keyframeChunk = this.videoChunks.find((chunk) => chunk.type === 'key')
    if (!keyframeChunk) {
      return undefined
    }

    // Extract SPS/PPS from keyframe (simplified - in production parse properly)
    // This is a placeholder - actual implementation needs to parse H.264 NAL units
    return undefined
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback: (progress: MuxerProgress) => void): void {
    this.onProgress = callback
  }
}

/**
 * Simple WebM muxer using Mediabunny (replaces deprecated webm-muxer)
 * Install: npm install mediabunny
 */
export async function createWebMMuxer(
  config: MuxerConfig
): Promise<{ addChunk: (chunk: EncodedVideoChunk) => void; finalize: () => Promise<Blob> }> {
  try {
    const {
      Output,
      WebMOutputFormat,
      BufferTarget,
      EncodedVideoPacketSource,
      EncodedPacket,
    } = await import('mediabunny')

    // Map config videoCodec to Mediabunny codec (vp8, vp9, av1, etc.)
    const codec = config.videoCodec?.toLowerCase().includes('vp9')
      ? 'vp9'
      : config.videoCodec?.toLowerCase().includes('vp8')
        ? 'vp8'
        : 'vp9'

    const videoSource = new EncodedVideoPacketSource(codec as 'vp8' | 'vp9')
    const output = new Output({
      format: new WebMOutputFormat(),
      target: new BufferTarget(),
    })
    output.addVideoTrack(videoSource, { frameRate: config.fps })
    await output.start()

    const chunks: EncodedVideoChunk[] = []

    return {
      addChunk: (chunk: EncodedVideoChunk) => {
        chunks.push(chunk)
      },
      finalize: async () => {
        for (const chunk of chunks) {
          const packet = EncodedPacket.fromEncodedChunk(chunk)
          await videoSource.add(packet)
        }
        await output.finalize()
        const buffer = output.target.buffer
        return new Blob([buffer!], { type: 'video/webm' })
      },
    }
  } catch (error) {
    console.warn('mediabunny not available, using basic muxer', error)
    return createBasicWebMMuxer(config)
  }
}

function createBasicWebMMuxer(
  _config: MuxerConfig
): { addChunk: (chunk: EncodedVideoChunk) => void; finalize: () => Promise<Blob> } {
  const chunks: Uint8Array[] = []

  return {
    addChunk: (chunk: EncodedVideoChunk) => {
      const buffer = new Uint8Array(chunk.byteLength)
      chunk.copyTo(buffer)
      chunks.push(buffer)
    },
    finalize: async () => {
      return new Blob(chunks, { type: 'video/webm' })
    },
  }
}

