import React from 'react';
import { AbsoluteFill, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import type { Project, Scene, SceneStyle } from '@/types/project';
import { resolveSceneTheme } from './shared/theme';
import type { SceneComponentProps } from './shared/sceneProps';
import { PlainScene } from './scenes/PlainScene';
import { PosterScene } from './scenes/PosterScene';
import { BigNumberScene } from './scenes/BigNumberScene';
import { CompareScene } from './scenes/CompareScene';
import { ChipsScene } from './scenes/ChipsScene';
import { FallingLinesScene } from './scenes/FallingLinesScene';
import { VideoTextScene } from './scenes/VideoTextScene';
import { RotatingWordScene } from './scenes/RotatingWordScene';
import { TypewriterScene } from './scenes/TypewriterScene';
import { SceneTransition } from './shared/SceneTransition';
import { GlitchIntro } from './shared/GlitchIntro';

const SCENE_COMPONENTS: Record<SceneStyle, React.ComponentType<SceneComponentProps>> = {
  plain: PlainScene,
  poster: PosterScene,
  bignumber: BigNumberScene,
  compare: CompareScene,
  chips: ChipsScene,
  falling: FallingLinesScene,
  videotext: VideoTextScene,
  rotate: RotatingWordScene,
  typewriter: TypewriterScene,
};

// Must be a `type` alias, not an `interface` — Remotion's <Composition>/<Player> require
// Props to structurally satisfy `Record<string, unknown>`, which interfaces (lacking an
// implicit index signature) don't.
export type MainCompositionProps = {
  project: Project;
};

export function sceneFrames(scene: Scene, fps: number): number {
  return Math.max(1, Math.round(scene.durationSec * fps));
}

// The composition's total length in frames — scenes are laid out back-to-back with each
// individually frame-rounded, so this must sum the SAME per-scene frame counts the
// Sequences below use, or the last scene would get truncated/extended by rounding drift.
export function computeTotalDurationInFrames(project: Project, fps: number): number {
  if (!project.scenes.length) return fps;
  return project.scenes.reduce((n, s) => n + sceneFrames(s, fps), 0);
}

// The frame at which a given scene's Sequence begins — same layout math as MainComposition's
// own frameCursor loop, exposed so the editor can seek the preview player to a scene on select.
export function sceneStartFrame(project: Project, sceneId: string, fps: number): number {
  let frame = 0;
  for (const s of project.scenes) {
    if (s.id === sceneId) return frame;
    frame += sceneFrames(s, fps);
  }
  return 0;
}

function SceneLayer({
  project,
  scene,
  sceneIndex,
  startSec,
  totalSec,
}: {
  project: Project;
  scene: Scene;
  sceneIndex: number;
  startSec: number;
  totalSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const theme = resolveSceneTheme(project.theme, scene);
  const Comp = SCENE_COMPONENTS[scene.style] || PlainScene;
  return (
    <SceneTransition type={project.theme.transition} t={t} dur={scene.durationSec}>
      <GlitchIntro active={scene.glitchIntro} t={t}>
        <Comp
          scene={scene}
          theme={theme}
          t={t}
          dur={scene.durationSec}
          label={project.label || project.name}
          showCaptions={!!project.showCaptions}
          showTimecode={!!project.showTimecode}
          sceneIndex={sceneIndex}
          sceneCount={project.scenes.length}
          elapsedSec={startSec + t}
          totalSec={totalSec}
        />
      </GlitchIntro>
    </SceneTransition>
  );
}

export function MainComposition({ project }: MainCompositionProps) {
  const { fps } = useVideoConfig();
  const scenes = project.scenes;
  const totalSec = scenes.reduce((n, s) => n + s.durationSec, 0);

  let frameCursor = 0;
  const laidOut = scenes.map((scene) => {
    const frames = sceneFrames(scene, fps);
    const fromFrame = frameCursor;
    const startSec = frameCursor / fps;
    frameCursor += frames;
    return { scene, frames, fromFrame, startSec };
  });

  const trimBeforeFrames = project.video?.trimStartMs ? Math.round((project.video.trimStartMs / 1000) * fps) : 0;

  return (
    <AbsoluteFill style={{ background: project.theme.bg }}>
      {project.video && project.video.mode === 'background' && (
        <AbsoluteFill>
          <OffthreadVideo
            src={project.video.path}
            trimBefore={trimBeforeFrames}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </AbsoluteFill>
      )}
      {laidOut.map(({ scene, frames, fromFrame, startSec }, i) => (
        <Sequence key={scene.id} from={fromFrame} durationInFrames={frames} name={scene.name}>
          <SceneLayer project={project} scene={scene} sceneIndex={i} startSec={startSec} totalSec={totalSec} />
        </Sequence>
      ))}
      {project.video && project.video.mode === 'pip' && (
        <div
          style={{
            position: 'absolute',
            right: 48,
            bottom: 140,
            width: 220,
            height: 220,
            overflow: 'hidden',
            border: `4px solid ${project.theme.ink}`,
          }}
        >
          <OffthreadVideo
            src={project.video.path}
            trimBefore={trimBeforeFrames}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      )}
    </AbsoluteFill>
  );
}
