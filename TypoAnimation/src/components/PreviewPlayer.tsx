'use client';

import React, { useMemo } from 'react';
import { Player } from '@remotion/player';
import { MainComposition, computeTotalDurationInFrames } from '@/remotion/Composition';
import { FPS, WIDTH, HEIGHT } from '@/remotion/constants';
import type { Project } from '@/types/project';

export function PreviewPlayer({ project }: { project: Project }) {
  const durationInFrames = useMemo(
    () => computeTotalDurationInFrames(project, FPS),
    // scene identity + durations are what actually change the timeline length; re-deriving
    // on every project change (incl. unrelated color tweaks) is cheap enough to just depend
    // on the whole scenes array.
    [project.scenes]
  );

  return (
    <Player
      component={MainComposition}
      inputProps={{ project }}
      durationInFrames={durationInFrames}
      compositionWidth={WIDTH}
      compositionHeight={HEIGHT}
      fps={FPS}
      style={{ width: '100%', aspectRatio: '1 / 1' }}
      controls
      loop
      clickToPlay
      spaceKeyToPlayOrPause
    />
  );
}
