
export interface AudioAnalyzerResult {
    peaks: number[] // Normalized peaks 0..1
    duration: number // Duration of the decoded audio in seconds
}

/**
 * Generates a waveform from an audio/video blob.
 * It uses the Web Audio API to decode the audio data and then downsamples it.
 */
export async function generateWaveform(blob: Blob, samplesPerSecond: number = 20): Promise<AudioAnalyzerResult> {
    try {
        const arrayBuffer = await blob.arrayBuffer()
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()

        // Decode audio data
        // detailed error handling for decodeAudioData
        let audioBuffer: AudioBuffer
        try {
            audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
        } catch (e) {
            console.error("Failed to decode audio data for waveform:", e)
            return { peaks: [], duration: 0 }
        }

        const rawData = audioBuffer.getChannelData(0) // Use first channel
        const sampleRate = audioBuffer.sampleRate
        const duration = audioBuffer.duration

        const totalSamples = Math.floor(duration * samplesPerSecond)
        const blockSize = Math.floor(rawData.length / totalSamples)

        const waveform: number[] = []

        for (let i = 0; i < totalSamples; i++) {
            const start = i * blockSize
            let sum = 0
            for (let j = 0; j < blockSize; j++) {
                if (start + j < rawData.length) {
                    sum += Math.abs(rawData[start + j])
                }
            }
            waveform.push(sum / blockSize) // Average amplitude
        }

        // Normalize (find max and scale)
        const max = Math.max(...waveform, 0.0001)
        const normalized = waveform.map(n => n / max)

        audioContext.close()
        return { peaks: normalized, duration }

    } catch (error) {
        console.error('Error generating waveform:', error)
        return { peaks: [], duration: 0 }
    }
}
