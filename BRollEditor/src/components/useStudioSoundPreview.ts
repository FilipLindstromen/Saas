import { useEffect, useRef } from 'react'

type Nodes = { highpass: BiquadFilterNode; compressor: DynamicsCompressorNode; gain: GainNode }

/**
 * Makes "Studio Sound" audible in the live preview, not just in the final export. The export
 * uses ffmpeg's loudnorm (see server/render.mjs) for a precise, analysis-based normalization
 * pass — that's not something the browser can replicate frame-for-frame in real time, so this
 * is a real-time approximation instead (highpass to cut low-end rumble, a compressor to even
 * out levels, makeup gain to bring it up) via the Web Audio API. It works by finding the actual
 * `<audio>` element(s) Remotion Player creates inside its container and routing their output
 * through a small effects chain.
 *
 * The chain is built once and left connected permanently — a `MediaElementAudioSourceNode` can
 * only be created once per element ever, so instead of connecting/disconnecting on toggle, the
 * toggle just moves the chain's own parameters between "on" (filtering/compressing/boosting)
 * and "off" (transparent passthrough).
 */
export function useStudioSoundPreview(getContainer: () => HTMLElement | null | undefined, active: boolean, enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<Nodes | null>(null)
  const connectedRef = useRef<WeakSet<HTMLMediaElement>>(new WeakSet())

  useEffect(() => {
    if (!active) return
    const container = getContainer()
    if (!container) return

    const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    if (!ctxRef.current) {
      const ctx = new AudioContextCtor()
      const highpass = ctx.createBiquadFilter()
      highpass.type = 'highpass'
      const compressor = ctx.createDynamicsCompressor()
      const gain = ctx.createGain()
      highpass.connect(compressor)
      compressor.connect(gain)
      gain.connect(ctx.destination)
      ctxRef.current = ctx
      nodesRef.current = { highpass, compressor, gain }
    }

    const connect = (el: HTMLMediaElement) => {
      if (connectedRef.current.has(el)) return
      connectedRef.current.add(el)
      try {
        const ctx = ctxRef.current!
        if (ctx.state === 'suspended') ctx.resume().catch(() => {})
        const source = ctx.createMediaElementSource(el)
        source.connect(nodesRef.current!.highpass)
      } catch {
        // Already captured elsewhere, or the element isn't capturable — skip it rather than
        // break playback over an enhancement that can't apply here.
      }
    }

    container.querySelectorAll('audio').forEach((el) => connect(el as HTMLAudioElement))

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return
          if (node.tagName === 'AUDIO') connect(node as HTMLAudioElement)
          node.querySelectorAll?.('audio').forEach((el) => connect(el as HTMLAudioElement))
        })
      }
    })
    observer.observe(container, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [active, getContainer])

  useEffect(() => {
    const nodes = nodesRef.current
    if (!nodes) return
    const now = nodes.highpass.context.currentTime
    if (enabled) {
      nodes.highpass.frequency.setTargetAtTime(90, now, 0.05)
      nodes.compressor.threshold.setTargetAtTime(-24, now, 0.05)
      nodes.compressor.ratio.setTargetAtTime(3, now, 0.05)
      nodes.compressor.knee.setTargetAtTime(12, now, 0.05)
      nodes.compressor.attack.setTargetAtTime(0.005, now, 0.05)
      nodes.compressor.release.setTargetAtTime(0.25, now, 0.05)
      nodes.gain.gain.setTargetAtTime(1.6, now, 0.05)
    } else {
      nodes.highpass.frequency.setTargetAtTime(20, now, 0.05)
      nodes.compressor.threshold.setTargetAtTime(0, now, 0.05)
      nodes.compressor.ratio.setTargetAtTime(1, now, 0.05)
      nodes.gain.gain.setTargetAtTime(1, now, 0.05)
    }
  }, [enabled])
}
