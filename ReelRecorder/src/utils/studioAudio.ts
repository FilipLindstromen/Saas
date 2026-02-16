/**
 * Studio-quality audio processing: high-pass (remove rumble), noise gate, and compressor.
 * Returns a MediaStream suitable for recording. Call disconnect() when done to release resources.
 */
const HIGHPASS_FREQ = 90
const NOISE_GATE_THRESHOLD = 0.008
const NOISE_GATE_ATTACK = 0.02
const NOISE_GATE_RELEASE = 0.15
const ANALYSER_FFT_SIZE = 256
const SMOOTHING = 0.7

export interface StudioAudioResult {
  stream: MediaStream
  disconnect: () => void
}

export async function createStudioAudioStream(rawStream: MediaStream): Promise<StudioAudioResult> {
  const ctx = new AudioContext()
  const source = ctx.createMediaStreamSource(rawStream)
  const dest = ctx.createMediaStreamDestination()

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = HIGHPASS_FREQ
  highpass.Q.value = 0.7

  const gateGain = ctx.createGain()
  gateGain.gain.value = 1

  const analyser = ctx.createAnalyser()
  analyser.fftSize = ANALYSER_FFT_SIZE
  analyser.smoothingTimeConstant = SMOOTHING
  highpass.connect(analyser)

  const compressor = ctx.createDynamicsCompressor()
  compressor.threshold.value = -24
  compressor.knee.value = 12
  compressor.ratio.value = 6
  compressor.attack.value = 0.003
  compressor.release.value = 0.15

  source.connect(highpass)
  highpass.connect(gateGain)
  highpass.connect(analyser)
  gateGain.connect(compressor)
  compressor.connect(dest)

  const bufferLength = analyser.fftSize
  const dataArray = new Float32Array(bufferLength)
  let currentGain = 1
  let rafId = 0

  function measureRms(): number {
    analyser.getFloatTimeDomainData(dataArray)
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      const x = dataArray[i]
      sum += x * x
    }
    return Math.sqrt(sum / bufferLength)
  }

  function gateLoop() {
    const rms = measureRms()
    const targetGain = rms > NOISE_GATE_THRESHOLD ? 1 : 0
    const rate = targetGain > currentGain ? NOISE_GATE_ATTACK : NOISE_GATE_RELEASE
    const coeff = 1 - Math.exp(-1 / (rate * ctx.sampleRate))
    currentGain += (targetGain - currentGain) * coeff
    gateGain.gain.setTargetAtTime(currentGain, ctx.currentTime, 0.01)
    rafId = requestAnimationFrame(gateLoop)
  }

  gateLoop()

  function disconnect() {
    cancelAnimationFrame(rafId)
    try {
      source.disconnect()
      highpass.disconnect()
      analyser.disconnect()
      gateGain.disconnect()
      compressor.disconnect()
    } catch (_) {}
    ctx.close()
  }

  return { stream: dest.stream, disconnect }
}
