import React from 'react';
import { enter } from './motion';
import type { ResolvedSceneTheme } from './theme';

export interface LineProps {
  text: string;
  t: number;
  start?: number;
  end: number;
  size?: number;
  weight?: number;
  color?: string;
  align?: 'left' | 'center';
  maxWidth?: number;
  marginTop?: number;
  marginBottom?: number;
  letterSpacing?: string;
  /** render each word as a solid-color chip (the "Nike poster" emphasis treatment) */
  chip?: boolean;
  theme: ResolvedSceneTheme;
  /**
   * Per-word entrance start times (seconds, scene-local), one per word — when provided
   * (a scene synced to a transcribed voiceover), each word enters at its actual spoken
   * time instead of the fixed 55ms stagger from `start`.
   */
  wordStartsSec?: number[] | null;
}

// Word-by-word kinetic text: opacity/translateY/scale/rotate/blur entrance per word,
// staggered 55ms apart, ported verbatim from the reference `Line` component.
export function Line({
  text,
  t,
  start = 0,
  end,
  size = 104,
  weight,
  color,
  align,
  maxWidth,
  marginTop,
  marginBottom,
  letterSpacing = '-0.02em',
  chip = false,
  theme,
  wordStartsSec,
}: LineProps) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  const centered = align === 'center';
  const chipBg = theme.dark ? theme.bg : theme.accent;
  const chipColor = theme.dark ? theme.accent : theme.bg;
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: centered ? 'center' : 'flex-start',
        columnGap: chip ? '0.16em' : '0.26em',
        rowGap: chip ? 8 : 2,
        fontFamily: theme.fontHeading,
        fontWeight: weight ?? theme.headingWeight,
        fontSize: size,
        lineHeight: 1.02,
        letterSpacing,
        color: color || theme.ink,
        maxWidth,
        marginTop,
        marginBottom,
      }}
    >
      {words.map((w, i) => {
        const wordStart = wordStartsSec && wordStartsSec[i] != null ? wordStartsSec[i] : start + i * 0.055;
        const m = enter(t, { start: wordStart, end, inDur: 0.26, outDur: 0.16, rise: 60, rot: 11, blur: 10 });
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              opacity: m.opacity,
              transform: m.transform,
              filter: m.filter,
              transformOrigin: 'bottom left',
              background: chip ? chipBg : undefined,
              color: chip ? chipColor : undefined,
              padding: chip ? '0.03em 0.16em' : undefined,
            }}
          >
            {w}
          </span>
        );
      })}
    </div>
  );
}
