import type { CSSProperties } from 'react';
import type { BrollAsset } from '@/types/project';

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Shared CSS for framed b-roll (scale, pan, media opacity). */
export function brollMediaStyle(broll: BrollAsset): CSSProperties {
  const fx = (broll.focusX ?? 0.5) * 100;
  const fy = (broll.focusY ?? 0.5) * 100;
  const scale = broll.scale ?? 1;
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${fx}% ${fy}%`,
    transform: `scale(${scale})`,
    transformOrigin: `${fx}% ${fy}%`,
    opacity: broll.mediaOpacity ?? 1,
  };
}

export function brollScrimOpacity(broll: BrollAsset): number {
  return broll.opacity ?? 0.45;
}
