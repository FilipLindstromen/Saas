import type { RefObject } from 'react';
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

export function presentRestFrame(project: Project, sceneIndex: number, fps: number): number {
  const { start, frames } = sceneAbsoluteFrames(project, sceneIndex, fps);
  const scene = project.scenes[sceneIndex];
  if (!scene || frames <= 0) return start;
  return start + presentSettleFrames(scene, fps);
}

export function playFrameRange(player: PlayerRef, fromFrame: number, toFrame: number): Promise<void> {
  return new Promise((resolve) => {
    player.seekTo(fromFrame);
    if (fromFrame === toFrame) {
      player.pause();
      resolve();
      return;
    }

    const forward = toFrame >= fromFrame;
    player.play();

    let raf = 0;
    const maxMs = (Math.abs(toFrame - fromFrame) / FPS) * 1000 * 2.5 + 1500;
    const timeout = window.setTimeout(finish, maxMs);

    function finish() {
      window.clearTimeout(timeout);
      if (raf) cancelAnimationFrame(raf);
      player.pause();
      player.seekTo(toFrame);
      resolve();
    }

    const tick = () => {
      const f = player.getCurrentFrame();
      const done = forward ? f >= toFrame : f <= toFrame;
      if (done) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
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

export function waitForPlayer(playerRef: RefObject<PlayerRef | null>, attempts = 60): Promise<PlayerRef | null> {
  return new Promise((resolve) => {
    let n = 0;
    const tick = () => {
      if (playerRef.current) {
        resolve(playerRef.current);
        return;
      }
      n++;
      if (n >= attempts) {
        resolve(null);
        return;
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}
