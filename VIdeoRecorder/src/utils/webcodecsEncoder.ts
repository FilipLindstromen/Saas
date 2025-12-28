/**
 * WebCodecs VideoEncoder wrapper for deterministic video encoding
 * Uses fixed timestep encoding, not real-time recording
 */

export interface EncoderConfig {
  width: number
  height: number
  fps: number
  bitrate: number // in bits per second
  keyframeInterval: number // frames between keyframes
  codec: 'avc1' | 'vp8' | 'vp9' // H.264, VP8, or VP9
}

export interface EncodedChunk {
  chunk: EncodedVideoChunk
  metadata?: EncodedVideoChunkMetadata
}

export class VideoEncoderWrapper {
  private encoder: VideoEncoder | null = null
  private config: EncoderConfig
  private chunks: EncodedChunk[] = []
  private frameCount = 0
  private onChunk?: (chunk: EncodedChunk) => void
  private onError?: (error: Error) => void
  private isConfigured = false

  constructor(config: EncoderConfig) {
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

    // Validate configuration parameters
    if (this.config.width <= 0 || this.config.height <= 0) {
      throw new Error(`Invalid encoder dimensions: ${this.config.width}x${this.config.height}`)
    }
    if (this.config.fps <= 0 || this.config.fps > 120) {
      throw new Error(`Invalid frame rate: ${this.config.fps} (must be between 1 and 120)`)
    }
    if (this.config.bitrate <= 0) {
      throw new Error(`Invalid bitrate: ${this.config.bitrate} (must be positive)`)
    }
    if (this.config.keyframeInterval <= 0) {
      throw new Error(`Invalid keyframe interval: ${this.config.keyframeInterval} (must be positive)`)
    }

    // Determine codec string with better fallback logic
    // Try VP9 first (most widely supported in Chromium), then VP8, then AVC
    let codecString: string | null = null
    const codecPreference = this.config.codec === 'avc1' 
      ? ['vp9', 'vp8', 'avc1'] as const
      : this.config.codec === 'vp8'
      ? ['vp8', 'vp9', 'avc1'] as const
      : ['vp9', 'vp8', 'avc1'] as const
    
    for (const preferredCodec of codecPreference) {
      if (preferredCodec === 'vp9') {
        // Try VP9 - most compatible
        const testCodec = 'vp09.00.10.08'
        if (VideoEncoder.isConfigSupported({ 
          codec: testCodec, 
          width: this.config.width, 
          height: this.config.height 
        })) {
          codecString = testCodec
          break
        }
      } else if (preferredCodec === 'vp8') {
        // Try VP8
        if (VideoEncoder.isConfigSupported({ 
          codec: 'vp8', 
          width: this.config.width, 
          height: this.config.height 
        })) {
          codecString = 'vp8'
          break
        }
      } else if (preferredCodec === 'avc1') {
        // H.264 - try different profiles/levels
        const avcOptions = [
          'avc1.4D002A', // Main profile, level 4.2
          'avc1.4D0028', // Main profile, level 4.0
          'avc1.64002A', // High profile, level 4.2
          'avc1.640028', // High profile, level 4.0
          'avc1.42001E', // Baseline profile, level 3.0 (lower but more compatible)
        ]
        
        for (const avcCodec of avcOptions) {
          if (VideoEncoder.isConfigSupported({ 
            codec: avcCodec, 
            width: this.config.width, 
            height: this.config.height 
          })) {
            codecString = avcCodec
            break
          }
        }
        
        if (codecString) break
      }
    }
    
    // If no codec found, throw error
    if (!codecString) {
      throw new Error(
        `No supported codec found for ${this.config.width}x${this.config.height}. ` +
        `Tried: VP9, VP8, and H.264. Your browser may not support WebCodecs encoding at this resolution.`
      )
    }

    // Build encoder configuration with a very conservative approach
    // Start with absolute minimal config and only add options if they work
    let adjustedBitrate = this.config.bitrate
    
    // Ensure bitrate is reasonable
    if (adjustedBitrate > 50_000_000) {
      adjustedBitrate = 50_000_000 // Cap at 50 Mbps
    }
    if (adjustedBitrate < 100_000) {
      adjustedBitrate = 100_000 // Minimum 100 kbps
    }
    
    // Ensure dimensions are even (required by many codecs)
    const evenWidth = this.config.width % 2 === 0 ? this.config.width : this.config.width - 1
    const evenHeight = this.config.height % 2 === 0 ? this.config.height : this.config.height - 1
    
    // Start with absolute minimal config
    let encoderConfig: VideoEncoderConfig = {
      codec: codecString,
      width: evenWidth,
      height: evenHeight,
      bitrate: adjustedBitrate,
      framerate: this.config.fps,
    }
    
    // Verify minimal config is supported
    if (!VideoEncoder.isConfigSupported(encoderConfig)) {
      throw new Error(
        `Codec ${codecString} is not supported at ${evenWidth}x${evenHeight} @ ${this.config.fps}fps. ` +
        `Try a different codec or lower resolution.`
      )
    }
    
    // Now try to add optional parameters one by one, testing each
    // We'll test by actually trying to configure (more reliable than isConfigSupported)
    const testConfig = (config: VideoEncoderConfig): boolean => {
      try {
        return VideoEncoder.isConfigSupported(config)
      } catch {
        return false
      }
    }
    
    // Try adding keyFrameEvery
    if (this.config.keyframeInterval > 0) {
      const testWithKeyframes = { ...encoderConfig, keyFrameEvery: this.config.keyframeInterval }
      if (testConfig(testWithKeyframes)) {
        encoderConfig.keyFrameEvery = this.config.keyframeInterval
      }
    }
    
    // Try hardware acceleration (prefer-software is often more reliable)
    const hwOptions: Array<'prefer-software' | 'no-preference' | 'prefer-hardware' | 'allow-software'> = [
      'prefer-software', // Most reliable
      'no-preference',
      'allow-software',
      'prefer-hardware', // Least reliable
    ]
    
    for (const hwOption of hwOptions) {
      const testWithHW = { ...encoderConfig, hardwareAcceleration: hwOption }
      if (testConfig(testWithHW)) {
        encoderConfig.hardwareAcceleration = hwOption
        break
      }
    }
    
    // Try latency mode (quality is better for offline encoding)
    const testWithLatency = { ...encoderConfig, latencyMode: 'quality' as const }
    if (testConfig(testWithLatency)) {
      encoderConfig.latencyMode = 'quality'
    }

    // Create encoder with error handling
    let encoderCreationError: Error | null = null
    let encoderErrorOccurred = false
    
    try {
      // Verify VideoEncoder is available before creating
      if (typeof VideoEncoder === 'undefined') {
        throw new Error('VideoEncoder is not available. Please use Chrome 94+, Edge 94+, or Opera 80+.')
      }
      
      this.encoder = new VideoEncoder({
        output: (chunk, metadata) => {
          // Only process output if encoder is still configured
          if (this.isConfigured && !encoderErrorOccurred) {
            const encodedChunk: EncodedChunk = { chunk, metadata }
            this.chunks.push(encodedChunk)
            if (this.onChunk) {
              this.onChunk(encodedChunk)
            }
          }
        },
        error: (error) => {
          // Mark that an error occurred
          encoderErrorOccurred = true
          this.isConfigured = false
          
          // Create a more descriptive error message
          // VideoEncoder error callback receives a DOMException
          let errorMessage = 'Unknown encoder error'
          let errorName = 'UnknownError'
          
          if (error) {
            if (typeof error === 'string') {
              errorMessage = error
            } else if (error instanceof DOMException) {
              errorMessage = error.message || error.name || 'DOMException'
              errorName = error.name || 'DOMException'
            } else if (error instanceof Error) {
              errorMessage = error.message
              errorName = error.name || 'Error'
            } else if (typeof error === 'object' && error !== null) {
              // Try to extract message and name
              if ('message' in error) {
                errorMessage = String(error.message)
              }
              if ('name' in error) {
                errorName = String(error.name)
              }
              if (errorMessage === 'Unknown encoder error' && errorName === 'UnknownError') {
                // Last resort: try to stringify
                try {
                  errorMessage = JSON.stringify(error)
                } catch {
                  errorMessage = String(error)
                }
              }
            } else {
              errorMessage = String(error)
            }
          }
          
          // Create a more informative error
          const err = new Error(`VideoEncoder error (${errorName}): ${errorMessage}`)
          encoderCreationError = err
          
          // Don't call onError during initialization to avoid double error reporting
          // The initialization will catch encoderCreationError and throw it
          console.error('VideoEncoder error:', error, 'Name:', errorName, 'Message:', errorMessage)
        },
      })
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      throw new Error(`Failed to create VideoEncoder: ${errorMsg}. This may indicate the browser doesn't fully support WebCodecs or there's a configuration issue.`)
    }

    // Check if encoder was created successfully
    if (!this.encoder) {
      throw new Error('VideoEncoder creation returned null or undefined')
    }

    try {
      // Log the config we're about to use for debugging
      console.log('Configuring encoder with:', {
        codec: encoderConfig.codec,
        width: encoderConfig.width,
        height: encoderConfig.height,
        bitrate: encoderConfig.bitrate,
        framerate: encoderConfig.framerate,
        keyFrameEvery: encoderConfig.keyFrameEvery,
        hardwareAcceleration: encoderConfig.hardwareAcceleration,
        latencyMode: encoderConfig.latencyMode,
      })
      
      this.encoder.configure(encoderConfig)
      
      // Wait longer to allow async errors to surface
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check if configuration triggered an immediate error
      if (encoderCreationError) {
        // If we got an error, try with even simpler config
        console.warn('Initial config failed, trying minimal config...')
        
        // Try absolute minimal config
        const minimalConfig: VideoEncoderConfig = {
          codec: codecString,
          width: evenWidth,
          height: evenHeight,
          bitrate: Math.min(adjustedBitrate, 5_000_000), // Lower bitrate
          framerate: this.config.fps,
        }
        
        // Reset error state
        encoderCreationError = null
        encoderErrorOccurred = false
        
        // Close and recreate encoder
        try {
          this.encoder.close()
        } catch (e) {
          // Ignore
        }
        
        this.encoder = new VideoEncoder({
          output: (chunk, metadata) => {
            if (this.isConfigured && !encoderErrorOccurred) {
              const encodedChunk: EncodedChunk = { chunk, metadata }
              this.chunks.push(encodedChunk)
              if (this.onChunk) {
                this.onChunk(encodedChunk)
              }
            }
          },
          error: (error) => {
            encoderErrorOccurred = true
            this.isConfigured = false
            const err = new Error(`VideoEncoder error: ${error instanceof DOMException ? error.message : String(error)}`)
            encoderCreationError = err
            console.error('VideoEncoder error with minimal config:', error)
          },
        })
        
        console.log('Trying minimal config:', minimalConfig)
        this.encoder.configure(minimalConfig)
        await new Promise(resolve => setTimeout(resolve, 50))
        
        if (encoderCreationError) {
          throw encoderCreationError
        }
        
        encoderConfig = minimalConfig
      }
      
      // Verify encoder is in configured state
      const state = this.encoder.state
      if (state !== 'configured') {
        if (state === 'unconfigured') {
          throw new Error(
            `Encoder configuration failed - encoder remains in 'unconfigured' state. ` +
            `Codec: ${codecString}, Resolution: ${evenWidth}x${evenHeight}, FPS: ${this.config.fps}. ` +
            `Your browser may not support this codec/resolution combination.`
          )
        }
        if (state === 'closed') {
          throw new Error(
            `Encoder was closed during configuration. Codec: ${codecString}, ` +
            `Resolution: ${evenWidth}x${evenHeight}. This may indicate unsupported parameters.`
          )
        }
        throw new Error(`Encoder state is '${state}' after configuration, expected 'configured'`)
      }
      
      this.isConfigured = true
      this.chunks = []
      this.frameCount = 0
      console.log('Encoder configured successfully')
    } catch (error) {
      // Configuration failed - encoder might be closed
      this.isConfigured = false
      if (this.encoder) {
        try {
          this.encoder.close()
        } catch (e) {
          // Ignore close errors
        }
        this.encoder = null
      }
      
      // Provide more helpful error message
      const errorMsg = error instanceof Error ? error.message : String(error)
      if (encoderCreationError) {
        throw encoderCreationError
      }
      throw new Error(
        `Failed to configure encoder: ${errorMsg}. ` +
        `Codec: ${codecString}, Resolution: ${evenWidth}x${evenHeight}, FPS: ${this.config.fps}, ` +
        `Bitrate: ${adjustedBitrate}. Try a different codec or lower resolution.`
      )
    }
  }

  /**
   * Encode a frame at a specific timestamp
   * @param frame VideoFrame to encode
   * @param timestamp Frame timestamp in microseconds (use frame.timestamp or calculate from frame index)
   */
  encodeFrame(frame: VideoFrame, timestamp: number): void {
    if (!this.encoder) {
      throw new Error('Encoder not initialized. Call initialize() first.')
    }

    if (!this.isConfigured) {
      throw new Error('Encoder not configured. Call initialize() first.')
    }

    // Check encoder state
    const state = this.encoder.state
    if (state === 'closed') {
      throw new Error('Encoder has been closed. Cannot encode more frames.')
    }
    
    if (state === 'unconfigured') {
      throw new Error('Encoder is unconfigured. Call initialize() first.')
    }
    
    // If encoder is in error state, it will be closed automatically
    // Check if it's still usable
    if (state !== 'configured') {
      throw new Error(`Encoder is in invalid state: ${state}. Cannot encode frames.`)
    }

    // Check encoder state
    if (this.encoder.encodeQueueSize > 10) {
      // Backpressure - encoder is falling behind
      console.warn(`Encoder queue size: ${this.encoder.encodeQueueSize}, waiting...`)
      // In a real implementation, you might want to wait here
      // For now, we'll continue but log a warning
    }

    // Determine if this should be a keyframe
    const isKeyFrame = this.frameCount % this.config.keyframeInterval === 0

    // Create a new VideoFrame with the correct timestamp
    // Note: We need to clone the frame if we're modifying timestamp
    const frameToEncode = new VideoFrame(frame, {
      timestamp,
      duration: 1000000 / this.config.fps, // Duration in microseconds
    })

    try {
      this.encoder.encode(frameToEncode, { keyFrame: isKeyFrame })
      this.frameCount++
    } catch (error) {
      // Close the frame before rethrowing
      frameToEncode.close()
      throw error
    }

    // Close the cloned frame to free memory
    frameToEncode.close()
  }

  /**
   * Flush remaining frames and finalize encoding
   */
  async flush(): Promise<EncodedChunk[]> {
    if (!this.encoder || !this.isConfigured) {
      return []
    }

    // Check if encoder is already closed
    if (this.encoder.state === 'closed') {
      // Return existing chunks if any
      return [...this.chunks]
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Don't reject if we have chunks - just return them
        if (this.chunks.length > 0) {
          clearTimeout(timeout)
          this.onChunk = originalOnChunk
          this.onError = originalOnError
          resolve([...this.chunks])
        } else {
          clearTimeout(timeout)
          this.onChunk = originalOnChunk
          this.onError = originalOnError
          reject(new Error('Encoder flush timeout'))
        }
      }, 30000) // 30 second timeout

      const originalOnChunk = this.onChunk
      const originalOnError = this.onError

      // Temporarily override handlers to detect flush completion
      let pendingChunks = 0
      this.onChunk = (chunk) => {
        if (originalOnChunk) originalOnChunk(chunk)
        pendingChunks++
      }

      this.onError = (error) => {
        clearTimeout(timeout)
        this.onChunk = originalOnChunk
        this.onError = originalOnError
        // If we have chunks, return them even if there was an error
        if (this.chunks.length > 0) {
          resolve([...this.chunks])
        } else {
          reject(error)
        }
      }

      // Flush encoder
      this.encoder!.flush().then(() => {
        // Wait a bit for any remaining chunks
        setTimeout(() => {
          clearTimeout(timeout)
          this.onChunk = originalOnChunk
          this.onError = originalOnError
          resolve([...this.chunks])
        }, 200) // Increased wait time
      }).catch((error) => {
        clearTimeout(timeout)
        this.onChunk = originalOnChunk
        this.onError = originalOnError
        // If we have chunks, return them even if flush failed
        if (this.chunks.length > 0) {
          console.warn('Encoder flush failed but returning existing chunks:', error)
          resolve([...this.chunks])
        } else {
          reject(error)
        }
      })
    })
  }

  /**
   * Close the encoder and free resources
   */
  close(): void {
    if (this.encoder) {
      this.encoder.close()
      this.encoder = null
    }
    this.isConfigured = false
    this.chunks = []
    this.frameCount = 0
  }

  /**
   * Get current queue size (for backpressure handling)
   * Returns -1 if encoder is closed or invalid
   */
  getQueueSize(): number {
    if (!this.encoder) {
      return -1
    }
    try {
      return this.encoder.encodeQueueSize
    } catch (error) {
      // Encoder might be closed
      return -1
    }
  }
  
  /**
   * Check if encoder is still valid
   */
  isValid(): boolean {
    if (!this.encoder || !this.isConfigured) {
      return false
    }
    try {
      const state = this.encoder.state
      return state === 'configured'
    } catch (error) {
      return false
    }
  }

  /**
   * Set chunk callback
   */
  setChunkCallback(callback: (chunk: EncodedChunk) => void): void {
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
  getChunks(): EncodedChunk[] {
    return [...this.chunks]
  }
}

/**
 * Convert canvas to VideoFrame
 */
export function canvasToVideoFrame(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  timestamp: number
): VideoFrame {
  return new VideoFrame(canvas, {
    timestamp,
    duration: 0, // Will be set by encoder
  })
}

/**
 * Check if WebCodecs is supported
 */
export function isWebCodecsSupported(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined'
}

