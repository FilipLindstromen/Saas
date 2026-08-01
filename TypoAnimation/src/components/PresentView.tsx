'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition, computeTotalDurationInFrames } from '@/remotion/Composition';
import { FPS, getCompositionSize } from '@/remotion/constants';
import type { Project } from '@/types/project';
import { presentEnterScene, presentExitScene, sceneAbsoluteFrames } from '@/lib/presentNavigation';

export function PresentView({
  project,
  initialSceneIndex = 0,
  onClose,
}: {
  project: Project;
  initialSceneIndex?: number;
  onClose: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<PlayerRef>(null);
  const [sceneIndex, setSceneIndex] = useState(() =>
    Math.min(Math.max(0, initialSceneIndex), Math.max(0, project.scenes.length - 1))
  );
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  const { width, height } = getCompositionSize(project.aspectRatio);
  const durationInFrames = useMemo(() => computeTotalDurationInFrames(project, FPS), [project]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const el = shellRef.current;
    if (!el) return;
    void el.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement === el) void document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onClose]);

  const goTo = useCallback(
    async (nextIndex: number) => {
      const player = playerRef.current;
      if (!player || busyRef.current) return;
      if (nextIndex < 0 || nextIndex >= project.scenes.length || nextIndex === sceneIndex) return;

      busyRef.current = true;
      try {
        await presentExitScene(player, project, sceneIndex);
        if (!mountedRef.current) return;
        setSceneIndex(nextIndex);
        await presentEnterScene(player, project, nextIndex);
      } finally {
        busyRef.current = false;
      }
    },
    [project, sceneIndex]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
        onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        void goTo(sceneIndex + 1);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        void goTo(sceneIndex - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, onClose, sceneIndex]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      await new Promise((r) => setTimeout(r, 80));
      const player = playerRef.current;
      if (!player || cancelled) return;
      const { start } = sceneAbsoluteFrames(project, sceneIndex, FPS);
      player.seekTo(start);
      await presentEnterScene(player, project, sceneIndex);
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount for initial slide
  }, []);

  return (
    <div ref={shellRef} className="fixed inset-0 z-[300] flex bg-black">
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Player
          ref={playerRef}
          component={MainComposition}
          inputProps={{ project }}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={FPS}
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            aspectRatio: `${width} / ${height}`,
          }}
          controls={false}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          autoPlay={false}
          loop={false}
        />
      </div>
    </div>
  );
}
