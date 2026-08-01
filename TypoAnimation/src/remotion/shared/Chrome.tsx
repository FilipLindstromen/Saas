import React from 'react';
import { hexToRgba } from '@/lib/colors';
import type { ResolvedSceneTheme } from './theme';

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

// Bottom rule bar and the burned-in caption bar — ported from the reference `Chrome`
// component. The top eyebrow-label/scene-counter header was removed per feedback; `label`,
// `showTimecode`, `sceneIndex`, `sceneCount`, and `elapsedSec` are still accepted (every
// scene component still passes them) but no longer rendered anywhere.
export function Chrome({ theme, caption, showCaptions }: ChromeProps) {
  const ruleColor = theme.dark ? hexToRgba(theme.bg, 0.55) : hexToRgba(theme.ink, 0.14);
  const inkColor = theme.dark ? theme.bg : hexToRgba(theme.ink, 0.72);

  return (
    <>
      <div style={{ position: 'absolute', left: 56, right: 56, bottom: 48, height: 2, background: ruleColor }} />
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
