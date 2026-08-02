import React from 'react';
import type { BrollAsset } from '@/types/project';
import { BrollBackground } from './BrollBackground';
import { SceneVideo, type ResolvedSceneVideo } from './SceneVideo';

/** Scene background: b-roll wins over voiceover/webcam fill so assigned stock media always shows. */
export function SceneBackdrop({
  broll,
  video,
  ink,
}: {
  broll?: BrollAsset;
  video?: ResolvedSceneVideo;
  ink: string;
}) {
  if (broll?.path) return <BrollBackground broll={broll} />;
  if (video?.mode === 'background') return <SceneVideo video={video} ink={ink} />;
  return null;
}
