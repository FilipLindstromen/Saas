import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';
import type { BrollAsset } from '@/types/project';

// Stock b-roll video layer, rendered right after the scene's base background color and
// before Chrome/text content — matches the layering pattern PitchDeck uses for its
// background-video slides (bg color -> bg video -> dark scrim -> text). Muted: this is a
// silent visual layer, not an audio source (the primary webcam/VO video carries narration).
export function BrollBackground({ broll }: { broll?: BrollAsset }) {
  if (!broll) return null;
  return (
    <AbsoluteFill>
      <OffthreadVideo src={broll.path} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <AbsoluteFill style={{ background: `rgba(0,0,0,${broll.opacity ?? 0.45})` }} />
    </AbsoluteFill>
  );
}
