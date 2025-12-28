/**
 * WebCodecs AudioEncoder wrapper for audio encoding
 */

export interface AudioEncoderConfig {
  sampleRate: number // e.g., 48000
  numberOfChannels: number // 1 (mono) or 2 (stereo)
  bitrate?: number // in bits per second
  codec: 'opus' | 'aac'
}

export interface EncodedAudioChunk {
  chunk: EncodedAudioChunk
  metadata?: EncodedAudioChunkMetadata
}

export class AudioEncoderWrapper {
  private encoder: AudioEncoder | null = null
  private config: AudioEncoderConfig
  private chunks: EncodedAudioChunk[] = []
  private onChunk?: (chunk: EncodedAudioChunk) => void
  private onError?: (error: Error) => void
  private isConfigured = false

  constructor(config: AudioEncoderConfig) {
    this.config = config
  }

  /**
   * Initialize the encoder
   */
  async initialize(): Promise<void> {
    if (this.encoder) {
      await this.flush()
      this.encoder.close()
    }

    // Determine codec string
    let codecString: string
    if (this.config.codec === 'opus') {
      codecString = 'opus'
    } else {
      codecString = 'mp4a.40.2' // AAC-LC
    }

    // Check codec support
    const encoderConfig: AudioEncoderConfig = {
      codec: codecString,
      sampleRate: this.config.sampleRate,
      numberOfChannels: this.config.numberOfChannels,
      bitrate: this.config.bitrate,
    }

    if (!AudioEncoder.isConfigSupported(encoderConfig)) {
      throw new Error(`Audio codec ${codecString} is not supported with these settings`)
    }

    this.encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        const encodedChunk: EncodedAudioChunk = { chunk, metadata }
        this.chunks.push(encodedChunk)
        if (this.onChunk) {
          this.onChunk(encodedChunk)
        }
      },
      error: (error) => {
        const err = new Error(`AudioEncoder error: ${error.message}`)
        if (this.onError) {
          this.onError(err)
        } else {
          console.error('AudioEncoder error:', error)
        }
      },
    })

    this.encoder.configure(encoderConfig)
    this.isConfigured = true
    this.chunks = []
  }

  /**
   * Encode an audio data
   */
  encode(audioData: AudioData): void {
    if (!this.encoder || !this.isConfigured) {
      throw new Error('Encoder not initialized. Call initialize() first.')
    }

    this.encoder.encode(audioData)
  }

  /**
   * Flush remaining frames
   */
  async flush(): Promise<EncodedAudioChunk[]> {
    if (!this.encoder || !this.isConfigured) {
      return []
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Audio encoder flush timeout'))
      }, 10000)

      const originalOnChunk = this.onChunk
      const originalOnError = this.onError

      this.onError = (error) => {
        clearTimeout(timeout)
        if (originalOnError) originalOnError(error)
        reject(error)
      }

      this.encoder!.flush().then(() => {
        setTimeout(() => {
          clearTimeout(timeout)
          this.onChunk = originalOnChunk
          this.onError = originalOnError
          resolve([...this.chunks])
        }, 100)
      }).catch((error) => {
        clearTimeout(timeout)
        this.onChunk = originalOnChunk
        this.onError = originalOnError
        reject(error)
      })
    })
  }

  /**
   * Close the encoder
   */
  close(): void {
    if (this.encoder) {
      this.encoder.close()
      this.encoder = null
    }
    this.isConfigured = false
    this.chunks = []
  }

  /**
   * Set chunk callback
   */
  setChunkCallback(callback: (chunk: EncodedAudioChunk) => void): void {
    this.onChunk = callback
  }

  /**
   * Set error callback
   */
  setErrorCallback(callback: (error: Error) => void): void {
    this.onError = callback
  }

  /**
   * Get all encoded chunks
   */
  getChunks(): EncodedAudioChunk[] {
    return [...this.chunks]
  }
}

/**
 * Check if WebCodecs AudioEncoder is supported
 */
export function isAudioEncoderSupported(): boolean {
  return typeof AudioEncoder !== 'undefined'
}


