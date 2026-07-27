import React from 'react';
import { hexToRgba } from '@/lib/colors';
import { pulse } from './motion';
import type { ResolvedSceneTheme } from './theme';

function fmtClock(t: number): string {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

export interface ChromeProps {
  theme: ResolvedSceneTheme;
  label: string;
  caption: string;
  showCaptions: boolean;
  showTimecode: boolean;
  sceneIndex: number;
  sceneCount: number;
  elapsedSec: number;
  totalSec: number;
}

// Top/bottom rule bars, pulsing scene-label dot, scene counter, live timecode, and the
// burned-in caption bar — ported from the reference `Chrome` component.
export function Chrome({
  theme,
  label,
  caption,
  showCaptions,
  showTimecode,
  sceneIndex,
  sceneCount,
  elapsedSec,
  totalSec,
}: ChromeProps) {
  const ruleColor = theme.dark ? hexToRgba(theme.bg, 0.55) : hexToRgba(theme.ink, 0.14);
  const inkColor = theme.dark ? theme.bg : hexToRgba(theme.ink, 0.72);
  const dotColor = theme.dark ? theme.bg : theme.accent;
  const p = pulse(elapsedSec);

  return (
    <>
      <div style={{ position: 'absolute', left: 56, right: 56, top: 48, height: 2, background: ruleColor }} />
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 48, height: 2, background: ruleColor }} />
      <div style={{ position: 'absolute', left: 56, top: 22, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 9,
            height: 9,
            background: dotColor,
            opacity: p.opacity,
            transform: `scale(${p.scale})`,
          }}
        />
        <div
          style={{
            fontFamily: theme.fontHeading,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.13em',
            color: inkColor,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      </div>
      <div style={{ position: 'absolute', right: 56, top: 22, display: 'flex', alignItems: 'center', gap: 14 }}>
        {showTimecode && (
          <div style={{ fontFamily: theme.fontHeading, fontWeight: 600, fontSize: 12, color: inkColor, letterSpacing: '0.04em' }}>
            {fmtClock(elapsedSec)} / {fmtClock(totalSec)}
          </div>
        )}
        <div style={{ fontFamily: theme.fontHeading, fontWeight: 700, fontSize: 12, color: inkColor, letterSpacing: '0.08em' }}>
          {String(sceneIndex + 1).padStart(2, '0')} / {String(sceneCount).padStart(2, '0')}
        </div>
      </div>
      {showCaptions && (
        <div
          style={{
            position: 'absolute',
            left: 56,
            right: 56,
            bottom: 76,
            padding: '10px 16px',
            background: theme.dark ? 'rgba(0,0,0,0.28)' : hexToRgba(theme.ink, 0.06),
            color: inkColor,
            fontFamily: theme.fontBody,
            fontSize: 15,
            fontWeight: 500,
          }}
        >
          {caption}
        </div>
      )}
    </>
  );
}
