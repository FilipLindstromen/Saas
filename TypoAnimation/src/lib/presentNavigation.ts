import type { Project, Scene } from '@/types/project';
import { sceneFrames, sceneStartFrame } from '@/remotion/Composition';
import { FPS } from '@/remotion/constants';
import type { PlayerRef } from '@remotion/player';

/** Matches SceneTransition TRANS_DUR in remotion/shared/SceneTransition.tsx */
export const PRESENT_TRANS_DUR_SEC = 0.28;

export function presentSettleFrames(scene: Scene, fps: number): number {
  return Math.min(Math.round(fps * 0.8), Math.floor(sceneFrames(scene, fps) * 0.4));
}

export function presentExitStartOffsetFrames(scene: Scene, fps: number): number {
  const frames = sceneFrames(scene, fps);
  const trans = Math.min(Math.round(PRESENT_TRANS_DUR_SEC * fps), Math.floor(frames / 2));
  return Math.max(0, frames - trans);
}

export function sceneAbsoluteFrames(project: Project, sceneIndex: number, fps: number) {
  const scene = project.scenes[sceneIndex];
  if (!scene) return { start: 0, end: 0, frames: 0 };
  const start = sceneStartFrame(project, scene.id, fps);
  const frames = sceneFrames(scene, fps);
  return { start, frames, end: start + frames - 1 };
}

export function playFrameRange(player: PlayerRef, fromFrame: number, toFrame: number): Promise<void> {
  return new Promise((resolve) => {
    player.seekTo(fromFrame);
    player.play();
    const forward = toFrame >= fromFrame;
    const handler = (e: { detail: { frame: number } }) => {
      const f = e.detail.frame;
      const done = forward ? f >= toFrame : f <= toFrame;
      if (done) {
        player.pause();
        player.seekTo(toFrame);
        player.removeEventListener('timeupdate', handler);
        resolve();
      }
    };
    player.addEventListener('timeupdate', handler);
  });
}

export async function presentEnterScene(player: PlayerRef, project: Project, sceneIndex: number) {
  const { start, frames } = sceneAbsoluteFrames(project, sceneIndex, FPS);
  const scene = project.scenes[sceneIndex];
  if (!scene || frames <= 0) return;
  const to = start + presentSettleFrames(scene, FPS);
  await playFrameRange(player, start, to);
}

export async function presentExitScene(player: PlayerRef, project: Project, sceneIndex: number) {
  const { start, end, frames } = sceneAbsoluteFrames(project, sceneIndex, FPS);
  const scene = project.scenes[sceneIndex];
  if (!scene || frames <= 0) return;
  const from = start + presentExitStartOffsetFrames(scene, FPS);
  await playFrameRange(player, from, end);
}
