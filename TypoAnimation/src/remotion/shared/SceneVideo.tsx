import React from 'react';
import { AbsoluteFill } from 'remotion';
import { resolveRemotionSrc } from './mediaSrc';
import { RemotionVideo } from './RemotionVideo';

// Scene-level voiceover clips are visual-only; audio is mixed from ProjectVoiceoverAudio.
const SCENE_VIDEO_MUTED = true;

// Resolved per-scene: mode is scene.videoMode ?? project.video.mode, and trimBefore is the
// SAME video-position math BrollBackground-adjacent OffthreadVideo would need — offset by
// this scene's own start frame so nesting the video inside a per-scene <Sequence> still shows
// the continuously-correct absolute position in the source file (see SceneLayer).
export interface ResolvedSceneVideo {
  path: string;
  trimBefore: number;
  mode: 'background' | 'pip' | 'hidden';
  corner: 'br' | 'bl' | 'tr' | 'tl';
  size: number;
  scrim: number;
}

const CORNER_STYLE: Record<ResolvedSceneVideo['corner'], React.CSSProperties> = {
  br: { right: 48, bottom: 140 },
  bl: { left: 48, bottom: 140 },
  tr: { right: 48, top: 140 },
  tl: { left: 48, top: 140 },
};

// Renders the project's main webcam/voiceover video for one scene, in whichever mode that
// scene resolved to. 'background' fills the frame (call this as the first child inside a
// scene's own AbsoluteFill, same slot as BrollBackground, so it paints behind Chrome/text).
// 'pip' is a round bubble in a corner (call this once, on top of everything, from SceneLayer).
// 'hidden' — no picture; audio comes from the composition voiceover track.
export function SceneVideo({ video, ink }: { video?: ResolvedSceneVideo; ink: string }) {
  if (!video) return null;

  if (video.mode === 'hidden') return null;

  if (video.mode === 'background') {
    return (
      <AbsoluteFill>
        <RemotionVideo
          src={resolveRemotionSrc(video.path)}
          trimBefore={video.trimBefore}
          muted={SCENE_VIDEO_MUTED}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {video.scrim > 0 && <AbsoluteFill style={{ background: `rgba(0,0,0,${video.scrim})` }} />}
      </AbsoluteFill>
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        zIndex: 30,
        ...CORNER_STYLE[video.corner],
        width: video.size,
        height: video.size,
        overflow: 'hidden',
        borderRadius: '50%',
        border: `4px solid ${ink}`,
      }}
    >
      <RemotionVideo
        src={resolveRemotionSrc(video.path)}
        trimBefore={video.trimBefore}
        muted={SCENE_VIDEO_MUTED}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}
