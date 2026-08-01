'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition, computeTotalDurationInFrames, sceneStartFrame, sceneFrames } from '@/remotion/Composition';
import { FPS, getCompositionSize } from '@/remotion/constants';
import type { BrollAsset, Project } from '@/types/project';
import { BrollFramingOverlay } from '@/components/BrollFramingOverlay';

function fmtTime(frame: number, fps: number): string {
  const s = frame / fps;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${rem}`;
}

// Every scene's start frame except the very first (frame 0 isn't a "change" — there's nothing
// before it to cut from), for tick marks on the scrubber showing where each scene cut falls.
function sceneCutFrames(project: Project, fps: number): number[] {
  let cursor = 0;
  const cuts: number[] = [];
  for (const scene of project.scenes) {
    if (cursor > 0) cuts.push(cursor);
    cursor += sceneFrames(scene, fps);
  }
  return cuts;
}

// A custom control bar rendered below the Player instead of Remotion's own `controls` prop,
// which overlays the bar on top of the video frame itself — driven entirely through
// PlayerRef's imperative API + event listeners, since the Player has no "controls below"
// layout option of its own.
function PlayerControls({
  playerRef,
  durationInFrames,
  fps,
  cutFrames,
}: {
  playerRef: React.RefObject<PlayerRef | null>;
  durationInFrames: number;
  fps: number;
  cutFrames: number[];
}) {
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = (e: { detail: { frame: number } }) => setFrame(e.detail.frame);
    const onMuteChange = (e: { detail: { isMuted: boolean } }) => setMuted(e.detail.isMuted);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);
    player.addEventListener('timeupdate', onTimeUpdate);
    player.addEventListener('mutechange', onMuteChange);
    setMuted(player.isMuted());
    return () => {
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
      player.removeEventListener('timeupdate', onTimeUpdate);
      player.removeEventListener('mutechange', onMuteChange);
    };
  }, [playerRef]);

  const btnClass =
    'flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-[#141414] text-white/90 hover:border-white/20 hover:bg-[#1f1f1f]';

  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#1f1f1f] px-3 py-2">
      <button className={btnClass} onClick={() => playerRef.current?.toggle()} title={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <button className={btnClass} onClick={() => (muted ? playerRef.current?.unmute() : playerRef.current?.mute())} title={muted ? 'Unmute' : 'Mute'}>
        {muted ? '🔇' : '🔊'}
      </button>
      <span className="w-24 shrink-0 text-center text-xs tabular-nums text-white/65">
        {fmtTime(frame, fps)} / {fmtTime(durationInFrames, fps)}
      </span>
      <div className="relative flex-1">
        <input
          type="range"
          min={0}
          max={Math.max(0, durationInFrames - 1)}
          value={frame}
          onChange={(e) => playerRef.current?.seekTo(Number(e.target.value))}
          className="w-full accent-[#ff6b35]"
        />
        <div className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2">
          {cutFrames.map((f, i) => (
            <div
              key={i}
              className="absolute top-0 h-full w-px bg-white/50"
              style={{ left: `${(f / Math.max(1, durationInFrames - 1)) * 100}%` }}
            />
          ))}
        </div>
      </div>
      <button className={btnClass} onClick={() => playerRef.current?.requestFullscreen()} title="Fullscreen">
        ⛶
      </button>
    </div>
  );
}

export function PreviewPlayer({
  project,
  selectedSceneId,
  brollPanMode,
  onBrollPatch,
}: {
  project: Project;
  selectedSceneId?: string | null;
  brollPanMode?: boolean;
  onBrollPatch?: (patch: Partial<BrollAsset>) => void;
}) {
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

  const cutFrames = useMemo(() => sceneCutFrames(project, FPS), [project.scenes]);

  // Deliberately keyed only on the selected scene id, not on `project` — selecting a scene
  // should jump the playhead there once, but editing that scene's text afterward shouldn't
  // keep yanking playback back to its start on every keystroke.
  //
  // Seeks past the entrance animation rather than to frame 0: landing exactly on a scene's
  // first frame means every style's word-by-word/typewriter/etc reveal hasn't started yet, so
  // you'd click a scene and see blank or half-animated text instead of the actual copy. A
  // fixed ~0.8s offset (clamped to 40% of the scene's own length, so short scenes don't
  // overshoot into their exit animation) comfortably clears every style's entrance timing.
  useEffect(() => {
    if (!selectedSceneId) return;
    const project = projectRef.current;
    const scene = project.scenes.find((s) => s.id === selectedSceneId);
    const startFrame = sceneStartFrame(project, selectedSceneId, FPS);
    const settleFrames = scene ? Math.min(Math.round(FPS * 0.8), Math.floor(sceneFrames(scene, FPS) * 0.4)) : 0;
    playerRef.current?.seekTo(startFrame + settleFrames);
  }, [selectedSceneId]);

  const selectedScene = selectedSceneId ? project.scenes.find((s) => s.id === selectedSceneId) : null;

  return (
    <div className="w-full">
      <div className="relative w-full">
        <Player
          ref={playerRef}
          component={MainComposition}
          inputProps={{ project }}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={FPS}
          style={{ width: '100%', aspectRatio: `${width} / ${height}` }}
          loop
          clickToPlay={!brollPanMode}
          spaceKeyToPlayOrPause
        />
        {selectedScene?.broll && onBrollPatch && (
          <BrollFramingOverlay
            broll={selectedScene.broll}
            active={!!brollPanMode}
            onPatch={onBrollPatch}
          />
        )}
      </div>
      <PlayerControls playerRef={playerRef} durationInFrames={durationInFrames} fps={FPS} cutFrames={cutFrames} />
    </div>
  );
}
