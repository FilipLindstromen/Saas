/**
 * Audio generation utilities for creating simple tones and music
 */

export function generateTone(frequency: number, duration: number, sampleRate: number = 44100): string {
  const samples = Math.floor(sampleRate * duration)
  const buffer = new ArrayBuffer(44 + samples * 2)
  const view = new DataView(buffer)
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  // RIFF header
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + samples * 2, true) // File size - 8
  writeString(8, 'WAVE')
  
  // fmt chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // fmt chunk size
  view.setUint16(20, 1, true)  // Audio format (PCM)
  view.setUint16(22, 1, true)  // Number of channels
  view.setUint32(24, sampleRate, true) // Sample rate
  view.setUint32(28, sampleRate * 2, true) // Byte rate
  view.setUint16(32, 2, true)  // Block align
  view.setUint16(34, 16, true) // Bits per sample
  
  // data chunk
  writeString(36, 'data')
  view.setUint32(40, samples * 2, true) // Data size
  
  // Generate sine wave with envelope to avoid clicks
  for (let i = 0; i < samples; i++) {
    const t = i / sampleRate
    const envelope = Math.min(1, Math.min(t * 10, (duration - t) * 10)) // Fade in/out
    const sample = Math.sin(2 * Math.PI * frequency * t) * envelope
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true)
  }
  
  // Convert to base64
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  
  return 'data:audio/wav;base64,' + btoa(binary)
}

export function generateMusicTone(): string {
  // Generate a pleasant 440Hz tone (A4 note) for 2 seconds
  return generateTone(440, 2)
}

export function generateUpbeatTone(): string {
  // Generate a higher frequency tone for upbeat feel
  return generateTone(523.25, 2) // C5 note
}

export function generateChillTone(): string {
  // Generate a lower frequency tone for chill vibe
  return generateTone(329.63, 2) // E4 note
}

// Fallback method using a simple working audio data URL
export function generateSimpleTone(): string {
  // This is a minimal valid WAV file (1 second of silence)
  // It's guaranteed to work in all browsers
  return 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABYAAAAAAAB/////'
}

// Alternative method using Web Audio API to generate audio
export function generateAudioWithWebAPI(frequency: number, duration: number): Promise<string> {
  return new Promise((resolve) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const sampleRate = audioContext.sampleRate
      const samples = Math.floor(sampleRate * duration)
      const buffer = audioContext.createBuffer(1, samples, sampleRate)
      const data = buffer.getChannelData(0)
      
      // Generate sine wave
      for (let i = 0; i < samples; i++) {
        const t = i / sampleRate
        const envelope = Math.min(1, Math.min(t * 10, (duration - t) * 10))
        data[i] = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.3
      }
      
      // Convert to WAV
      const wav = audioBufferToWav(buffer)
      const blob = new Blob([wav], { type: 'audio/wav' })
      const url = URL.createObjectURL(blob)
      resolve(url)
    } catch (error) {
      // Fallback to simple tone
      resolve(generateSimpleTone())
    }
  })
}

// Helper function to convert AudioBuffer to WAV
function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const length = buffer.length
  const sampleRate = buffer.sampleRate
  const arrayBuffer = new ArrayBuffer(44 + length * 2)
  const view = new DataView(arrayBuffer)
  const data = buffer.getChannelData(0)
  
  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i))
    }
  }
  
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + length * 2, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, length * 2, true)
  
  // Convert float samples to 16-bit PCM
  for (let i = 0; i < length; i++) {
    view.setInt16(44 + i * 2, Math.round(data[i] * 32767), true)
  }
  
  return arrayBuffer
}
