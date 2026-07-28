import React from 'react';
import { animate, Easing } from './motion';
import type { ProjectTheme } from '@/types/project';

const TRANS_DUR = 0.28;

// Wraps a scene's rendered output with a self-contained entrance/exit treatment — not a true
// cross-scene blend (Sequences are laid out back-to-back, non-overlapping, so `sceneStartFrame`
// stays exact for playhead sync), but at TRANS_DUR this reads convincingly like one at 30fps:
// each scene fades/slides/wipes itself in over its first stretch and back out over its last.
export function SceneTransition({
  type,
  t,
  dur,
  children,
}: {
  type?: ProjectTheme['transition'];
  t: number;
  dur: number;
  children: React.ReactNode;
}) {
  if (!type || type === 'cut') return <>{children}</>;

  const transDur = Math.min(TRANS_DUR, dur / 2);
  const inP = animate(t, { from: 0, to: 1, start: 0, end: transDur, ease: Easing.easeOutCubic });
  const outP = animate(t, { from: 1, to: 0, start: dur - transDur, end: dur, ease: Easing.easeInCubic });

  let transform: string | undefined;
  let clipPath: string | undefined;
  let opacity = 1;

  if (type === 'fade') {
    opacity = Math.min(inP, outP);
  } else if (type === 'slide') {
    const DIST = 90;
    opacity = Math.min(inP, outP);
    transform = `translateX(${(1 - inP) * DIST - (1 - outP) * DIST}px)`;
  } else if (type === 'wipe') {
    const right = (1 - inP) * 100;
    const left = (1 - outP) * 100;
    clipPath = `inset(0 ${right}% 0 ${left}%)`;
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', opacity, transform, clipPath }}>
      {children}
    </div>
  );
}
