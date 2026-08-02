'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition, computeTotalDurationInFrames } from '@/remotion/Composition';
import { FPS, getCompositionSize } from '@/remotion/constants';
import type { Project } from '@/types/project';
import {
  presentEnterScene,
  presentExitScene,
  presentRestFrame,
  waitForPlayer,
} from '@/lib/presentNavigation';

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
  const sceneIndexRef = useRef(0);
  const [sceneIndex, setSceneIndex] = useState(() =>
    Math.min(Math.max(0, initialSceneIndex), Math.max(0, project.scenes.length - 1))
  );
  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  const enteredFullscreenRef = useRef(false);

  sceneIndexRef.current = sceneIndex;

  const { width, height } = getCompositionSize(project.aspectRatio);
  const durationInFrames = useMemo(() => computeTotalDurationInFrames(project, FPS), [project]);

  const initialRestFrame = useMemo(
    () => presentRestFrame(project, sceneIndex, FPS),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial slide only
    []
  );

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
      if (document.fullscreenElement === shellRef.current) {
        enteredFullscreenRef.current = true;
        return;
      }
      if (enteredFullscreenRef.current) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onClose]);

  const goTo = useCallback(
    async (nextIndex: number) => {
      const player = playerRef.current;
      if (!player || busyRef.current) return;
      if (nextIndex < 0 || nextIndex >= project.scenes.length) return;
      const current = sceneIndexRef.current;
      if (nextIndex === current) return;

      busyRef.current = true;
      try {
        await presentExitScene(player, project, current);
        if (!mountedRef.current) return;
        sceneIndexRef.current = nextIndex;
        setSceneIndex(nextIndex);
        await presentEnterScene(player, project, nextIndex);
      } finally {
        busyRef.current = false;
      }
    },
    [project]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {});
        else onClose();
        return;
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault();
        void goTo(sceneIndexRef.current + 1);
      }
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        void goTo(sceneIndexRef.current - 1);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [goTo, onClose]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const player = await waitForPlayer(playerRef);
      if (!player || cancelled) return;
      player.seekTo(presentRestFrame(project, sceneIndexRef.current, FPS));
      player.pause();
      await presentEnterScene(player, project, sceneIndexRef.current);
    };
    void boot();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once on mount
  }, []);

  const frameStyle: React.CSSProperties = {
    width: `min(96vw, calc(96dvh * ${width} / ${height}))`,
    maxHeight: '96dvh',
    aspectRatio: `${width} / ${height}`,
  };

  return (
    <div
      ref={shellRef}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black"
      style={{ width: '100%', height: '100%' }}
    >
      <div style={frameStyle}>
        <Player
          ref={playerRef}
          component={MainComposition}
          inputProps={{ project }}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={FPS}
          initialFrame={initialRestFrame}
          style={{ width: '100%', height: '100%' }}
          controls={false}
          clickToPlay={false}
          spaceKeyToPlayOrPause={false}
          autoPlay={false}
          loop={false}
          acknowledgeRemotionLicense
        />
      </div>
    </div>
  );
}
