import React from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { BrollAsset } from '@/types/project';
import { brollMediaKind } from './mediaSrc';
import { brollMediaStyle, brollScrimOpacity } from './brollFraming';
import { RemotionVideo } from './RemotionVideo';
import { useBrollSrc } from './useBrollSrc';

// Stock b-roll layer (video from Pexels/Pixabay, or a still image from Unsplash), rendered
// right after the scene's base background color and before Chrome/text content.
export function BrollBackground({ broll }: { broll?: BrollAsset }) {
  const binding = useBrollSrc(broll);

  if (!broll?.path || !binding) return null;

  const kind = brollMediaKind(broll);
  const mediaStyle = brollMediaStyle(broll);

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {kind === 'image' ? (
        <Img src={binding.src} onError={binding.onError} style={mediaStyle} />
      ) : (
        <RemotionVideo src={binding.src} muted onError={binding.onError} style={mediaStyle} />
      )}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${brollScrimOpacity(broll)})` }} />
    </AbsoluteFill>
  );
}
