import React from 'react'
import { AbsoluteFill, Audio, Img, OffthreadVideo, Sequence, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import type { BRoll, BRollTransition, Project } from '../types'
import { buildSegments, getKeptRanges, getOutputLines, getOutputWords } from './segments'
import { mergeActiveRanges, musicVolumeAtMs } from './musicVolume'
import { CaptionLayer } from './CaptionLayer'

const TRANSITION_MS = 400

function msToFrames(ms: number, fps: number): number {
  return Math.round((ms / 1000) * fps)
}

function KenBurnsImage({ src, direction }: { src: string; direction: 1 | -1 }) {
  const frame = useCurrentFrame()
  const { durationInFrames } = useVideoConfig()
  const scale = interpolate(frame, [0, durationInFrames], direction === 1 ? [1, 1.15] : [1.15, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const translate = interpolate(frame, [0, durationInFrames], direction === 1 ? [0, -20] : [-20, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <Img
        src={src}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${scale}) translateX(${translate}px)`,
        }}
      />
    </AbsoluteFill>
  )
}

function BRollVisual({ broll, index }: { broll: BRoll; index: number }) {
  if (broll.type === 'color') return <AbsoluteFill style={{ backgroundColor: broll.url }} />
  if (broll.type === 'video') {
    // Not looped: stock clips run several seconds, comfortably longer than most single-line
    // segments. A segment that outlasts its clip holds the last frame.
    return <OffthreadVideo src={broll.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
  }
  if (broll.kenBurns) return <KenBurnsImage src={broll.url} direction={index % 2 === 0 ? 1 : -1} />
  return (
    <AbsoluteFill>
      <Img src={broll.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    </AbsoluteFill>
  )
}

/**
 * Wraps an ENTERING b-roll segment so it hands off from the previous one over `fadeFrames`
 * instead of an instant cut. Only the entering clip needs an effect: it's painted later in DOM
 * order than the segment before it, so as long as the OUTGOING segment is left rendering
 * unmodified underneath (its own Sequence already covers this window — see the overlap math in
 * BRollComposition), fading only the incoming clip's opacity in from 0 already produces a clean
 * cross-dissolve with no extra "fade the other one out too" bookkeeping, and no dip-to-black
 * (which independently fading both layers would cause, since two independent 1→0/0→1 opacities
 * don't sum to a true alpha blend once there's a third layer — background — underneath them).
 */
function TransitionIn({ transition, fadeFrames, children }: { transition: BRollTransition; fadeFrames: number; children: React.ReactNode }) {
  const frame = useCurrentFrame()
  if (transition === 'cut' || fadeFrames <= 0) return <>{children}</>
  const t = interpolate(frame, [0, fadeFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  if (transition === 'crossfade') {
    return <AbsoluteFill style={{ opacity: t }}>{children}</AbsoluteFill>
  }
  // whip-pan: swipes in from the right with a touch of motion blur, fading in over the same window.
  const translate = (1 - t) * 35
  const blur = (1 - t) * 10
  return (
    <AbsoluteFill style={{ opacity: t, transform: `translateX(${translate}%)`, filter: blur > 0.4 ? `blur(${blur}px)` : undefined }}>
      {children}
    </AbsoluteFill>
  )
}

export const BRollComposition: React.FC<{ project: Project }> = ({ project }) => {
  const { fps } = useVideoConfig()
  const keptRanges = getKeptRanges(project)
  const outputLines = getOutputLines(project)
  const segments = buildSegments(outputLines)
  const outputWords = project.captions.wordByWord ? getOutputWords(project) : []
  const transitionFrames = Math.round((TRANSITION_MS / 1000) * fps)
  const activeRanges = mergeActiveRanges(outputLines)

  return (
    <AbsoluteFill style={{ backgroundColor: '#0a0a0a' }}>
      {project.audioUrl && keptRanges.map((r, i) => {
        // A delay object shows up here as a zero-origin-width range (positive output duration,
        // no corresponding source audio at all) — skip rendering an <Audio> for it entirely
        // rather than trying to play a zero-length trimmed clip; no Audio there just means
        // silence for that stretch, which is exactly what a delay should sound like.
        if (r.origEnd <= r.origStart) return null
        // One <Audio> per kept (uncut) range of the original file, placed at its new position
        // in the output timeline and trimmed to just that range of the source — this is what
        // actually makes a "cut" shorten the video instead of just skipping which b-roll shows.
        const from = msToFrames(r.outStart, fps)
        const durationInFrames = Math.max(1, msToFrames(r.outEnd, fps) - from)
        const trimBefore = msToFrames(r.origStart, fps)
        const trimAfter = msToFrames(r.origEnd, fps)
        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <Audio src={project.audioUrl!} trimBefore={trimBefore} trimAfter={trimAfter} />
          </Sequence>
        )
      })}

      {project.music.url && (
        <Audio
          src={project.music.url}
          loop
          // Without this, Remotion evaluates the volume-automation curve against the LOOPED
          // source's own repeating timeline instead of the composition's absolute output time —
          // "extend" is Remotion's documented fix for exactly this (a custom volume curve driving
          // audio that also loops), and is what actually makes ducking sync to the narration
          // instead of an unrelated ~music-loop-length cycle.
          loopVolumeCurveBehavior="extend"
          volume={(f) => {
            const ms = (f / fps) * 1000
            const full = project.music.volume
            const ducked = project.music.ducking ? full * 0.35 : full
            return musicVolumeAtMs(ms, activeRanges, full, ducked)
          }}
        />
      )}

      {segments.map((segment, i) => {
        if (!segment.broll) return null
        // Each clip's OWN transition describes how it hands off from whatever played before it
        // — not a project-wide setting, so two scenes in the same video can use different ones.
        const transition = segment.broll.transition ?? 'cut'
        const rawFrom = msToFrames(segment.fromMs, fps)
        const to = msToFrames(segment.toMs, fps)
        const ownDurationFrames = Math.max(1, to - rawFrom)
        const prevSegment = segments[i - 1]
        const hasPrev = i > 0 && !!prevSegment?.broll
        const prevDurationFrames = hasPrev ? msToFrames(prevSegment.toMs, fps) - msToFrames(prevSegment.fromMs, fps) : 0
        const overlap = hasPrev && transition !== 'cut'
          ? Math.max(0, Math.min(transitionFrames, Math.floor(ownDurationFrames / 2), Math.floor(prevDurationFrames / 2)))
          : 0
        const from = rawFrom - overlap
        const durationInFrames = Math.max(1, to - from)

        return (
          <Sequence key={i} from={from} durationInFrames={durationInFrames}>
            <TransitionIn transition={transition} fadeFrames={overlap}>
              <BRollVisual broll={segment.broll} index={i} />
            </TransitionIn>
          </Sequence>
        )
      })}

      {project.captions.enabled && (
        project.captions.wordByWord
          ? outputWords.map((word, i) => {
              if (!word.text.trim()) return null
              const from = msToFrames(word.startMs, fps)
              const durationInFrames = Math.max(1, msToFrames(word.endMs, fps) - from)
              return (
                <Sequence key={`capw-${i}`} from={from} durationInFrames={durationInFrames}>
                  <CaptionLayer text={word.text} settings={project.captions} />
                </Sequence>
              )
            })
          : outputLines.map((line, i) => {
              if (!line.text.trim()) return null
              const from = msToFrames(line.startMs, fps)
              const durationInFrames = Math.max(1, msToFrames(line.endMs, fps) - from)
              return (
                <Sequence key={`cap-${i}`} from={from} durationInFrames={durationInFrames}>
                  <CaptionLayer text={line.text} settings={project.captions} />
                </Sequence>
              )
            })
      )}
    </AbsoluteFill>
  )
}
