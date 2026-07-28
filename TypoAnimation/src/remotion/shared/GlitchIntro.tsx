import React from 'react';
import { noise1D } from './motion';

const GLITCH_DUR = 0.18;

// A brief RGB-split/jitter treatment over a scene's opening frames — cheap chromatic
// aberration via layered drop-shadows plus a decaying positional jitter, both driven off
// `noise1D` (not Math.random) so it stays frame-exact under Remotion's seek-and-capture
// render model. No DOM duplication of the scene's own content (which would double up any
// <OffthreadVideo> inside it) — just a transform/filter on a single wrapper.
export function GlitchIntro({ active, t, children }: { active?: boolean; t: number; children: React.ReactNode }) {
  if (!active || t >= GLITCH_DUR) return <>{children}</>;

  const seed = Math.round(t * 1000);
  const decay = 1 - t / GLITCH_DUR;
  const jitterX = noise1D(seed) * 10 * decay;
  const sliceY = noise1D(seed + 97) * 14 * decay;
  const aberration = 5 * decay;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        transform: `translateX(${jitterX}px)`,
        filter: `drop-shadow(${aberration}px 0 rgba(255,0,60,0.55)) drop-shadow(${-aberration}px 0 rgba(0,220,255,0.55))`,
      }}
    >
      <div style={{ width: '100%', height: '100%', transform: `translateY(${sliceY}px)` }}>{children}</div>
    </div>
  );
}
