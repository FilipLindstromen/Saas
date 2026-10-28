import React from 'react'
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { SYSTEM_CAPTION_FONT_CSS } from '../types'
import type { CaptionSettings } from '../types'
import { GOOGLE_FONT_FAMILIES } from './googleFonts'

function resolveFontFamily(font: CaptionSettings['font']): string {
  return SYSTEM_CAPTION_FONT_CSS[font] ?? GOOGLE_FONT_FAMILIES[font] ?? 'sans-serif'
}

export const CaptionLayer: React.FC<{ text: string; settings: CaptionSettings }> = ({ text, settings }) => {
  const frame = useCurrentFrame()
  const { durationInFrames, height, fps } = useVideoConfig()
  const animFrames = Math.max(1, Math.round((settings.animationSpeedMs / 1000) * fps))

  let opacity = 1
  let translateY = 0
  let scale = 1

  if (settings.animation === 'fade') {
    // Word-by-word mode can produce very short sequences (a few frames for a quick word) —
    // interpolate() requires strictly increasing breakpoints, so the fade-in and fade-out
    // points must never land on (or cross) each other. floor((durationInFrames-1)/2) is the
    // largest value that still guarantees fadeFrames < durationInFrames - fadeFrames.
    const fadeFrames = Math.min(animFrames, Math.max(1, Math.floor((durationInFrames - 1) / 2)))
    opacity = durationInFrames <= 2
      ? 1
      : interpolate(
          frame,
          [0, fadeFrames, durationInFrames - fadeFrames, durationInFrames],
          [0, 1, 1, 0],
          { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
        )
  } else if (settings.animation === 'slide-up') {
    translateY = interpolate(frame, [0, animFrames], [24, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    opacity = interpolate(frame, [0, animFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  } else if (settings.animation === 'pop') {
    scale = interpolate(frame, [0, animFrames], [0.85, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
    opacity = interpolate(frame, [0, animFrames], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  }

  const fontSize = Math.round((settings.sizePct / 100) * height)
  const textStyle: React.CSSProperties = {
    fontFamily: resolveFontFamily(settings.font),
    fontSize,
    fontWeight: 700,
    color: '#fff',
    opacity,
    transform: `translateY(${translateY}px) scale(${scale})`,
    textAlign: 'center',
    maxWidth: '85%',
    lineHeight: 1.25,
  }

  if (settings.style === 'lower-third') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-end' }}>
        <div style={{ ...textStyle, textAlign: 'left', maxWidth: '100%', background: 'rgba(0,0,0,0.7)', padding: '0.5em 6%', boxSizing: 'border-box', width: '100%' }}>
          {text}
        </div>
      </AbsoluteFill>
    )
  }

  if (settings.style === 'top-banner') {
    return (
      <AbsoluteFill style={{ justifyContent: 'flex-start', alignItems: 'center', paddingTop: '6%' }}>
        <div style={{ ...textStyle, background: 'rgba(0,0,0,0.65)', padding: '0.3em 0.7em', borderRadius: 8 }}>{text}</div>
      </AbsoluteFill>
    )
  }

  if (settings.style === 'bold-center') {
    return (
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{ ...textStyle, textShadow: '0 2px 16px rgba(0,0,0,0.85), 0 0 4px rgba(0,0,0,0.9)' }}>{text}</div>
      </AbsoluteFill>
    )
  }

  // 'subtitle' — the default
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: '8%' }}>
      <div style={{ ...textStyle, background: 'rgba(0,0,0,0.65)', padding: '0.3em 0.7em', borderRadius: 8 }}>{text}</div>
    </AbsoluteFill>
  )
}
