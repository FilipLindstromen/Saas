/**
 * Analyze audio blob and extract waveform data
 */
export async function analyzeWaveform(audioBlob: Blob, samples: number = 200): Promise<number[]> {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
    
    const channelData = audioBuffer.getChannelData(0) // Use first channel
    const blockSize = Math.floor(channelData.length / samples)
    const waveform: number[] = []
    
    for (let i = 0; i < samples; i++) {
      let sum = 0
      const start = i * blockSize
      const end = Math.min(start + blockSize, channelData.length)
      
      for (let j = start; j < end; j++) {
        sum += Math.abs(channelData[j])
      }
      
      // Normalize to 0-1 range
      const average = sum / (end - start)
      waveform.push(average)
    }
    
    audioContext.close()
    return waveform
  } catch (error) {
    console.error('Error analyzing waveform:', error)
    // Return empty waveform on error
    return new Array(samples).fill(0)
  }
}

