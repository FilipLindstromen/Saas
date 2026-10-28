import { useEffect, useRef, useState } from 'react'
import './Waveform.css'

type CutRange = { id: string; startMs: number; endMs: number }

type Props = {
  audioUrl: string
  totalMs: number
  trimStartMs: number
  trimEndMs: number
  playheadMs: number
  cuts: CutRange[]
  onTrimStart: (ms: number) => void
  onTrimEnd: (ms: number) => void
  onSeek: (ms: number) => void
}

const BUCKETS = 500
const MIN_TRIM_GAP_MS = 100

/** Decodes the audio file into per-bucket peak amplitudes for drawing — done once per URL. */
async function decodePeaks(url: string): Promise<Float32Array> {
  const res = await fetch(url)
  const arrayBuffer = await res.arrayBuffer()
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  const ctx = new AudioCtx()
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer)
    const channelData = audioBuffer.getChannelData(0)
    const samplesPerBucket = Math.max(1, Math.floor(channelData.length / BUCKETS))
    const peaks = new Float32Array(BUCKETS)
    for (let i = 0; i < BUCKETS; i++) {
      let max = 0
      const start = i * samplesPerBucket
      const end = Math.min(start + samplesPerBucket, channelData.length)
      for (let j = start; j < end; j++) {
        const v = Math.abs(channelData[j])
        if (v > max) max = v
      }
      peaks[i] = max
    }
    return peaks
  } finally {
    ctx.close().catch(() => {})
  }
}

// The Cut tab's timeline: a real waveform with the trim-in/trim-out handles and the playhead
// all on the same visual clip, instead of a separate plain bar below the waveform. Trim handles
// drag the clip's start/end; clicking or dragging anywhere else on the waveform moves the
// playhead (and seeks playback).
export default function Waveform({ audioUrl, totalMs, trimStartMs, trimEndMs, playheadMs, cuts, onTrimStart, onTrimEnd, onSeek }: Props) {
  const [peaks, setPeaks] = useState<Float32Array | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef<'start' | 'end' | 'playhead' | null>(null)
  const movedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    setPeaks(null)
    decodePeaks(audioUrl)
      .then((p) => { if (!cancelled) setPeaks(p) })
      .catch(() => { if (!cancelled) setPeaks(new Float32Array(BUCKETS)) })
    return () => { cancelled = true }
  }, [audioUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !peaks) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * dpr
    canvas.height = rect.height * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const w = rect.width
    const h = rect.height
    ctx.clearRect(0, 0, w, h)
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff6b35'
    const dimmed = 'rgba(255,255,255,0.18)'
    const barWidth = w / peaks.length
    for (let i = 0; i < peaks.length; i++) {
      const x = i * barWidth
      const barMs = (i / peaks.length) * totalMs
      const isCut = cuts.some((c) => barMs >= c.startMs && barMs < c.endMs)
      const amp = Math.max(0.035, Math.min(1, peaks[i] * 1.6))
      const barH = Math.max(2, amp * h)
      ctx.fillStyle = isCut ? dimmed : accent
      ctx.fillRect(x, (h - barH) / 2, Math.max(1, barWidth - 1), barH)
    }
  }, [peaks, totalMs, cuts])

  const msFromClientX = (clientX: number): number => {
    const el = containerRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return frac * totalMs
  }

  const startDrag = (kind: 'start' | 'end' | 'playhead') => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    draggingRef.current = kind
    movedRef.current = false
    const move = (ev: PointerEvent) => {
      movedRef.current = true
      const ms = msFromClientX(ev.clientX)
      if (draggingRef.current === 'start') onTrimStart(Math.min(ms, trimEndMs - MIN_TRIM_GAP_MS))
      else if (draggingRef.current === 'end') onTrimEnd(Math.max(ms, trimStartMs + MIN_TRIM_GAP_MS))
      else if (draggingRef.current === 'playhead') onSeek(ms)
    }
    const up = () => {
      draggingRef.current = null
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerup', up)
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
  }

  const handleContainerPointerDown = (e: React.PointerEvent) => {
    // A click (not a drag) anywhere on the waveform itself — not on a handle, which stops
    // propagation before this ever fires — moves the playhead there directly.
    onSeek(msFromClientX(e.clientX))
    startDrag('playhead')(e)
  }

  const trimStartPct = (trimStartMs / totalMs) * 100
  const trimEndPct = (trimEndMs / totalMs) * 100
  const playheadPct = Math.max(0, Math.min(100, (playheadMs / totalMs) * 100))

  return (
    <div className="waveform" ref={containerRef} onPointerDown={handleContainerPointerDown}>
      <canvas ref={canvasRef} className="waveform__canvas" />
      {!peaks && <div className="waveform__loading">Loading waveform…</div>}
      {cuts.map((c) => (
        <div
          key={c.id}
          className="waveform__dim"
          style={{ left: `${(c.startMs / totalMs) * 100}%`, width: `${((c.endMs - c.startMs) / totalMs) * 100}%` }}
        />
      ))}
      <div className="waveform__handle waveform__handle--start" style={{ left: `${trimStartPct}%` }} onPointerDown={startDrag('start')} />
      <div className="waveform__handle waveform__handle--end" style={{ left: `${trimEndPct}%` }} onPointerDown={startDrag('end')} />
      <div className="waveform__playhead" style={{ left: `${playheadPct}%` }} onPointerDown={startDrag('playhead')} />
    </div>
  )
}
