import React from 'react';
import { AbsoluteFill, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
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
import { MosaicScene } from './scenes/MosaicScene';
import { StatementScene } from './scenes/StatementScene';
import { BadgeScene } from './scenes/BadgeScene';
import { UniformLinesScene } from './scenes/UniformLinesScene';
import { SceneTransition } from './shared/SceneTransition';
import { SceneVideo, type ResolvedSceneVideo } from './shared/SceneVideo';

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
  mosaic: MosaicScene,
  statement: StatementScene,
  badge: BadgeScene,
  uniform: UniformLinesScene,
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

// Resolves the project's main video for one scene: which mode it's in (scene override, else
// the project-wide default), and the trimBefore that keeps it at the correct absolute source
// position given it's nested inside this scene's own <Sequence from={fromFrame}> — Remotion
// shifts everything inside a Sequence by `fromFrame`, so trimBefore has to add `fromFrame`
// back on top of the base offset (trimStartMs) to land on the same continuous timeline the
// old non-nested single background layer used to.
function resolveSceneVideo(project: Project, scene: Scene, fromFrame: number, fps: number): ResolvedSceneVideo | undefined {
  if (!project.video) return undefined;
  const mode = scene.videoMode || project.video.mode;
  const baseTrimBefore = project.video.trimStartMs ? Math.round((project.video.trimStartMs / 1000) * fps) : 0;
  return {
    path: project.video.path,
    trimBefore: baseTrimBefore + fromFrame,
    mode,
    corner: project.video.corner || 'br',
    size: project.video.size ?? 220,
    scrim: project.video.scrim ?? 0.35,
  };
}

function SceneLayer({
  project,
  scene,
  sceneIndex,
  fromFrame,
  startSec,
  totalSec,
}: {
  project: Project;
  scene: Scene;
  sceneIndex: number;
  fromFrame: number;
  startSec: number;
  totalSec: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const theme = resolveSceneTheme(project.theme, scene);
  const video = resolveSceneVideo(project, scene, fromFrame, fps);
  const Comp = SCENE_COMPONENTS[scene.style] || PlainScene;
  return (
    <SceneTransition type={project.theme.transition} t={t} dur={scene.durationSec}>
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
        video={video}
      />
      {video && video.mode !== 'background' && <SceneVideo video={video} ink={theme.ink} />}
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

  return (
    <AbsoluteFill style={{ background: project.theme.bg }}>
      {laidOut.map(({ scene, frames, fromFrame, startSec }, i) => (
        <Sequence key={scene.id} from={fromFrame} durationInFrames={frames} name={scene.name}>
          <SceneLayer project={project} scene={scene} sceneIndex={i} fromFrame={fromFrame} startSec={startSec} totalSec={totalSec} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
