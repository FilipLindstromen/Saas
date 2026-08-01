import React, { useEffect, useState } from 'react';
import { AbsoluteFill, Img } from 'remotion';
import type { BrollAsset } from '@/types/project';
import {
  brollMediaKind,
  resolveBrollFallbackSrc,
  resolveBrollPrimarySrc,
} from './mediaSrc';
import { brollMediaStyle, brollScrimOpacity } from './brollFraming';
import { RemotionVideo } from './RemotionVideo';

async function localBrollReachable(src: string): Promise<boolean> {
  try {
    const head = await fetch(src, { method: 'HEAD' });
    if (head.ok) return true;
    if (head.status !== 405 && head.status !== 501) return false;
    const probe = await fetch(src, { headers: { Range: 'bytes=0-0' } });
    return probe.ok;
  } catch {
    return false;
  }
}

// Stock b-roll layer (video from Pexels/Pixabay, or a still image from Unsplash), rendered
// right after the scene's base background color and before Chrome/text content.
export function BrollBackground({ broll }: { broll?: BrollAsset }) {
  const [src, setSrc] = useState<string | null>(() => (broll ? resolveBrollPrimarySrc(broll) : null));

  useEffect(() => {
    if (!broll) {
      setSrc(null);
      return;
    }

    let cancelled = false;
    const primary = resolveBrollPrimarySrc(broll);
    const fallback = resolveBrollFallbackSrc(broll);
    setSrc(primary);

    (async () => {
      const ok = await localBrollReachable(primary);
      if (cancelled) return;
      if (!ok && fallback) setSrc(fallback);
    })();

    return () => {
      cancelled = true;
    };
  }, [broll?.path, broll?.thumbnail]);

  if (!broll || !src) return null;

  const kind = brollMediaKind(broll);
  const fallback = resolveBrollFallbackSrc(broll);
  const mediaStyle = brollMediaStyle(broll);

  const onMediaError = () => {
    if (fallback && src !== fallback) setSrc(fallback);
  };

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      {kind === 'image' ? (
        <Img src={src} onError={onMediaError} style={mediaStyle} />
      ) : (
        <RemotionVideo src={src} muted onError={() => onMediaError()} style={mediaStyle} />
      )}
      <AbsoluteFill style={{ background: `rgba(0,0,0,${brollScrimOpacity(broll)})` }} />
    </AbsoluteFill>
  );
}
