'use client';

import React, { useEffect, useMemo, useRef } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition, computeTotalDurationInFrames, sceneStartFrame } from '@/remotion/Composition';
import { FPS, getCompositionSize } from '@/remotion/constants';
import type { Project } from '@/types/project';

export function PreviewPlayer({ project, selectedSceneId }: { project: Project; selectedSceneId?: string | null }) {
  const playerRef = useRef<PlayerRef>(null);
  const projectRef = useRef(project);
  projectRef.current = project;

  const { width, height } = getCompositionSize(project.aspectRatio);

  const durationInFrames = useMemo(
    () => computeTotalDurationInFrames(project, FPS),
    // scene identity + durations are what actually change the timeline length; re-deriving
    // on every project change (incl. unrelated color tweaks) is cheap enough to just depend
    // on the whole scenes array.
    [project.scenes]
  );

  // Deliberately keyed only on the selected scene id, not on `project` — selecting a scene
  // should jump the playhead there once, but editing that scene's text afterward shouldn't
  // keep yanking playback back to its start on every keystroke.
  useEffect(() => {
    if (!selectedSceneId) return;
    const frame = sceneStartFrame(projectRef.current, selectedSceneId, FPS);
    playerRef.current?.seekTo(frame);
  }, [selectedSceneId]);

  return (
    <Player
      ref={playerRef}
      component={MainComposition}
      inputProps={{ project }}
      durationInFrames={durationInFrames}
      compositionWidth={width}
      compositionHeight={height}
      fps={FPS}
      style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
      controls
      loop
      clickToPlay
      spaceKeyToPlayOrPause
    />
  );
}
