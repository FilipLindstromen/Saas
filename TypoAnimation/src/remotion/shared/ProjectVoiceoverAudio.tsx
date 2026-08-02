import React from 'react';
import { Sequence, useVideoConfig } from 'remotion';
import type { Project } from '@/types/project';
import { resolveRemotionSrc } from './mediaSrc';
import { RemotionVideo } from './RemotionVideo';

/** One continuous voiceover track for the whole timeline (preview + export). Scene-level videos stay muted so audio is not duplicated. */
export function ProjectVoiceoverAudio({
  project,
  durationInFrames,
}: {
  project: Project;
  durationInFrames: number;
}) {
  const { fps } = useVideoConfig();
  if (!project.video) return null;

  const trimBefore = project.video.trimStartMs ? Math.round((project.video.trimStartMs / 1000) * fps) : 0;

  return (
    <Sequence from={0} durationInFrames={durationInFrames} layout="none" name="Voiceover audio">
      <RemotionVideo
        src={resolveRemotionSrc(project.video.path)}
        trimBefore={trimBefore}
        muted={false}
        volume={1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </Sequence>
  );
}
