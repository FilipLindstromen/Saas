import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Player, type PlayerRef } from '@remotion/player'
import { BRollComposition } from '../remotion/Composition'
import { buildSegments, computeTotalDurationInFrames, getKeptRanges, getOutputLines } from '../remotion/segments'
import { origToOutMs } from '../services/cuts'
import { useStudioSoundPreview } from './useStudioSoundPreview'
import { ASPECT_RATIO_SIZES, FPS } from '../types'
import type { Project } from '../types'
import './PreviewPlayer.css'

type Props = { project: Project }

export type PreviewPlayerHandle = {
  /** ms is in ORIGINAL (pre-cut) audio time — the same time base as project.lines/words. Maps
   * through the project's cuts internally to the output timeline the player actually runs on. */
  seekToMs: (ms: number) => void
}

function preloadVideo(src: string): Promise<void> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.oncanplaythrough = () => resolve()
    video.onerror = () => resolve()
    video.src = src
    video.load()
  })
}

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve()
    img.onerror = () => resolve()
    img.src = src
  })
}

const PreviewPlayer = forwardRef<PreviewPlayerHandle, Props>(({ project }, ref) => {
  const size = ASPECT_RATIO_SIZES[project.aspectRatio]
  const durationInFrames = computeTotalDurationInFrames(project, FPS)
  const playerRef = useRef<PlayerRef>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  const segments = useMemo(() => buildSegments(getOutputLines(project)), [project.lines, project.cuts, project.audioDurationMs])
  // Key on the distinct broll URLs only, not the full segments array (which changes on every
  // keystroke while editing text) — re-preloading should only happen when what's actually
  // shown changes.
  const assetKey = useMemo(
    () => Array.from(new Set(segments.map((s) => s.broll?.url).filter(Boolean))).sort().join('|'),
    [segments]
  )

  useEffect(() => {
    let cancelled = false
    setReady(false)
    const urls = Array.from(new Set(segments.map((s) => s.broll).filter(Boolean))) as NonNullable<typeof segments[number]['broll']>[]
    if (urls.length === 0) {
      setReady(true)
      return
    }
    Promise.all(urls.map((b) => (b.type === 'video' ? preloadVideo(b.url) : preloadImage(b.url)))).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetKey])

  // Remotion Player's own getContainerNode() doesn't reliably contain the <audio> elements it
  // renders (it pools/shares real <audio> tags via an internal context provider that can place
  // them outside that specific node) — the outer wrapper div this component fully controls
  // does contain them, confirmed by inspecting the live DOM, so that's what gets observed.
  const getContainer = useCallback(() => wrapperRef.current, [])
  useStudioSoundPreview(getContainer, ready, project.studioSound)

  useImperativeHandle(ref, () => ({
    seekToMs: (ms: number) => {
      const keptRanges = getKeptRanges(project)
      let outMs = origToOutMs(ms, keptRanges)
      if (outMs === null) {
        // ms falls inside a cut (removed) — snap forward to the next kept range instead.
        const next = keptRanges.find((r) => r.origStart >= ms)
        outMs = next ? next.outStart : 0
      }
      const frame = Math.max(0, Math.round((outMs / 1000) * FPS))
      playerRef.current?.seekTo(frame)
    },
  }))

  return (
    <div ref={wrapperRef} className="preview-player" style={{ aspectRatio: `${size.width} / ${size.height}` }}>
      {ready ? (
        <Player
          ref={playerRef}
          component={BRollComposition}
          inputProps={{ project }}
          durationInFrames={durationInFrames}
          compositionWidth={size.width}
          compositionHeight={size.height}
          fps={FPS}
          style={{ width: '100%', height: '100%' }}
          controls
          loop
        />
      ) : (
        <div className="preview-player__loading">Loading b-roll…</div>
      )}
    </div>
  )
})

export default PreviewPlayer
