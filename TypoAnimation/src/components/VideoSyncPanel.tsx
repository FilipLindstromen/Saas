'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { CaptionWord, Project, Scene, VideoAsset } from '@/types/project';
import { createScene } from '@/types/project';
import {
  computeSceneBoundaries,
  segmentBySentences,
  segmentsFromBeatLayout,
  segmentsToBeatLayout,
} from '@/lib/segmentCaptions';
import { assignSceneStylesWithVariety, scenePatchForStyle } from '@/lib/parseScript';

function fmt(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1);
  return `${m}:${rem.padStart(4, '0')}`;
}

const CORNER_OPTIONS: { value: NonNullable<VideoAsset['corner']>; label: string }[] = [
  { value: 'br', label: 'Bottom right' },
  { value: 'bl', label: 'Bottom left' },
  { value: 'tr', label: 'Top right' },
  { value: 'tl', label: 'Top left' },
];

function fmtElapsed(startedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m > 0 ? `${m}:${String(s).padStart(2, '0')}` : `${s}s`;
}

type TranscribeStreamEvent =
  | { type: 'progress'; phase: string; message: string; progress: number }
  | { type: 'done'; captions: CaptionWord[] }
  | { type: 'error'; error: string };

async function consumeTranscribeStream(
  res: Response,
  onProgress: (evt: Extract<TranscribeStreamEvent, { type: 'progress' }>) => void
): Promise<CaptionWord[]> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error('No response from transcribe API');

  const decoder = new TextDecoder();
  let buffer = '';
  let captions: CaptionWord[] | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      const evt = JSON.parse(line) as TranscribeStreamEvent;
      if (evt.type === 'progress') onProgress(evt);
      else if (evt.type === 'done') captions = evt.captions;
      else if (evt.type === 'error') throw new Error(evt.error);
    }
  }
  if (buffer.trim()) {
    const evt = JSON.parse(buffer) as TranscribeStreamEvent;
    if (evt.type === 'done') captions = evt.captions;
    else if (evt.type === 'error') throw new Error(evt.error);
  }

  if (!captions) throw new Error('Transcription finished without results');
  return captions;
}

export function VideoSyncPanel({
  project,
  onProjectChange,
  onBulkSceneUpdate,
  onGenerated,
}: {
  project: Project;
  onProjectChange: (patch: Partial<Project>) => void;
  onBulkSceneUpdate: (updates: { id: string; patch: Partial<Scene> }[]) => void;
  /** called with the freshly-built scene list after "Generate scenes from transcript"
   * succeeds — the Import-mode step uses this to advance straight to Edit with the first
   * scene selected, same as the script Generate button does. Takes the scenes as an argument
   * rather than reading project.scenes back from the caller, since onProjectChange's setState
   * hasn't necessarily committed yet when this fires. */
  onGenerated?: (scenes: Scene[]) => void;
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [transcribeUi, setTranscribeUi] = useState<{
    phase: string;
    message: string;
    progress: number;
    startedAt: number;
    finished: boolean;
  } | null>(null);
  const [, tickElapsed] = useState(0);
  const [beatLayout, setBeatLayout] = useState('');
  const [beatLayoutCustom, setBeatLayoutCustom] = useState(false);

  useEffect(() => {
    if (!project.captions?.length) {
      setBeatLayout('');
      setBeatLayoutCustom(false);
      return;
    }
    if (!beatLayoutCustom) {
      setBeatLayout(segmentsToBeatLayout(segmentBySentences(project.captions)));
    }
  }, [project.captions, beatLayoutCustom]);

  useEffect(() => {
    if (!transcribeUi || transcribeUi.finished) return;
    const id = window.setInterval(() => tickElapsed((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [transcribeUi]);

  const segments = useMemo(() => {
    if (!project.captions?.length) return [];
    if (beatLayoutCustom && beatLayout.trim()) {
      return segmentsFromBeatLayout(beatLayout, project.captions);
    }
    return segmentBySentences(project.captions);
  }, [project.captions, beatLayout, beatLayoutCustom]);

  const patchVideo = (p: Partial<VideoAsset>) => project.video && onProjectChange({ video: { ...project.video, ...p } });

  const handleUpload = async (file: File) => {
    setBusy(true);
    setStatus('Uploading video…');
    try {
      const form = new FormData();
      form.append('video', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).error || 'upload failed');
      const data = (await res.json()) as { path: string; durationMs: number };
      // Defaults to a round picture-in-picture bubble, bottom-right — the common "talking head"
      // placement — rather than taking over the whole frame; full-bleed is opt-in below.
      const video: VideoAsset = { path: data.path, durationMs: data.durationMs, mode: 'background', scrim: 0.35 };
      onProjectChange({ video, captions: undefined });
      setStatus('Uploaded.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleTranscribe = async () => {
    if (!project.video) return;
    setBusy(true);
    const startedAt = Date.now();
    setTranscribeUi({
      phase: 'install_whisper',
      message: 'Starting transcription…',
      progress: 0,
      startedAt,
      finished: false,
    });
    setStatus('');
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: project.video.path }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || 'Transcription failed');
      }

      const captions = await consumeTranscribeStream(res, (evt) => {
        setTranscribeUi((prev) => ({
          phase: evt.phase,
          message: evt.message,
          progress: evt.progress,
          startedAt: prev?.startedAt ?? startedAt,
          finished: evt.phase === 'done',
        }));
      });

      onProjectChange({ captions });
      setBeatLayoutCustom(false);
      setTranscribeUi((prev) =>
        prev
          ? {
              ...prev,
              phase: 'done',
              message: `Done — ${captions.length} words transcribed`,
              progress: 100,
              finished: true,
            }
          : null
      );
      setStatus(`Transcription complete — ${captions.length} words.`);
    } catch (err) {
      setTranscribeUi(null);
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSync = () => {
    if (!project.video || segments.length === 0) return;
    const boundaries = computeSceneBoundaries(segments, project.video.durationMs);
    const n = Math.min(project.scenes.length, boundaries.length);
    const updates: { id: string; patch: Partial<Scene> }[] = [];
    for (let i = 0; i < n; i++) {
      const scene = project.scenes[i];
      const boundary = boundaries[i];
      const segment = segments[i];
      const durationSec = Math.max(0.5, (boundary.endMs - boundary.startMs) / 1000);
      const wordTimings: CaptionWord[] = segment.words.map((w) => ({
        text: w.text,
        startMs: w.startMs - boundary.startMs,
        endMs: w.endMs - boundary.startMs,
      }));
      updates.push({ id: scene.id, patch: { durationSec, wordTimings } });
    }
    onBulkSceneUpdate(updates);
    onProjectChange({ video: { ...project.video, trimStartMs: segments[0].startMs } });
    setStatus(
      n < project.scenes.length || n < boundaries.length
        ? `Synced ${n} scene(s). Scene count (${project.scenes.length}) and detected beats (${boundaries.length}) don't match — add/remove scenes to line them up exactly.`
        : `Synced all ${n} scenes to the voiceover.`
    );
  };

  // Builds a fresh scene list from transcript beats — each block (sentence by default,
  // or merged via blank lines in the editor) becomes one scene.
  const handleGenerateFromTranscript = () => {
    if (!project.video || segments.length === 0) return;
    const boundaries = computeSceneBoundaries(segments, project.video.durationMs);
    const sceneInputs = segments.map((seg) => ({
      kicker: null as string | null,
      lines: [{ text: seg.words.map((w) => w.text).join(' ') }],
    }));
    const styles = assignSceneStylesWithVariety(sceneInputs);
    const scenes: Scene[] = segments.map((seg, i) => {
      const boundary = boundaries[i];
      const lines = sceneInputs[i].lines;
      const patch = scenePatchForStyle({ lines, dark: styles[i] === 'poster' }, styles[i]);
      const wordTimings: CaptionWord[] = seg.words.map((w) => ({
        text: w.text,
        startMs: w.startMs - boundary.startMs,
        endMs: w.endMs - boundary.startMs,
      }));
      return createScene({
        name: `Scene ${i + 1}`,
        style: patch.style,
        lines: patch.lines,
        number: patch.number,
        numberSuffix: patch.numberSuffix,
        dark: patch.dark,
        durationSec: Math.max(0.5, (boundary.endMs - boundary.startMs) / 1000),
        wordTimings,
      });
    });
    onProjectChange({ scenes, video: { ...project.video, trimStartMs: segments[0].startMs, mode: 'background' } });
    setStatus(`Generated ${scenes.length} scene(s) from the transcript.`);
    onGenerated?.(scenes);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-[0.95rem] font-semibold text-white">Voiceover sync</h2>

      <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
        Webcam / voiceover video
        <input
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          className="text-xs text-white/65 file:mr-2 file:rounded-lg file:border-0 file:bg-[#141414] file:px-2 file:py-1 file:text-xs file:text-white"
        />
      </label>

      {project.video && (
        <>
          <div className="text-xs text-white/45">
            {project.video.path} · {fmt(project.video.durationMs)}
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
            Show video as (default for scenes without an override)
            <select
              className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white"
              value={project.video.mode}
              onChange={(e) => patchVideo({ mode: e.target.value as VideoAsset['mode'] })}
            >
              <option value="pip" className="bg-[#1f1f1f]">Picture-in-picture (round)</option>
              <option value="background" className="bg-[#1f1f1f]">Full-bleed background</option>
              <option value="hidden" className="bg-[#1f1f1f]">Hidden (audio only)</option>
            </select>
          </label>

          {project.video.mode === 'pip' && (
            <div className="flex gap-3">
              <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
                Corner
                <select
                  className="rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white"
                  value={project.video.corner || 'br'}
                  onChange={(e) => patchVideo({ corner: e.target.value as VideoAsset['corner'] })}
                >
                  {CORNER_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value} className="bg-[#1f1f1f]">
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
                Size (px)
                <input
                  type="number"
                  min={100}
                  max={480}
                  step={10}
                  className="w-24 rounded-xl border border-white/10 bg-[#141414] px-2 py-1.5 text-white"
                  value={project.video.size ?? 220}
                  onChange={(e) => patchVideo({ size: Number(e.target.value) || 220 })}
                />
              </label>
            </div>
          )}

          {project.video.mode === 'background' && (
            <label className="flex flex-col gap-1 text-xs font-medium text-white/65">
              Dark scrim over video ({Math.round((project.video.scrim ?? 0.35) * 100)}%)
              <input
                type="range"
                min={0}
                max={0.85}
                step={0.05}
                value={project.video.scrim ?? 0.35}
                onChange={(e) => patchVideo({ scrim: Number(e.target.value) })}
                className="accent-[#ff6b35]"
              />
            </label>
          )}

          <button
            onClick={handleTranscribe}
            disabled={busy}
            className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {project.captions ? 'Re-transcribe' : 'Transcribe voice (local, no API key)'}
          </button>

          {transcribeUi && (
            <div
              className="rounded-xl border border-white/10 bg-[#141414] p-3"
              role="status"
              aria-live="polite"
            >
              <div className="mb-2 flex items-start justify-between gap-2 text-xs">
                <span className="font-medium leading-snug text-white/90">{transcribeUi.message}</span>
                <span className="shrink-0 tabular-nums text-white/45">
                  {transcribeUi.finished
                    ? 'Done'
                    : `${transcribeUi.progress}% · ${fmtElapsed(transcribeUi.startedAt)}`}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className={`h-full rounded-full transition-[width] duration-300 ease-out ${
                    transcribeUi.finished
                      ? 'bg-emerald-500'
                      : 'bg-gradient-to-r from-[#ff6b35] to-[#ff4757]'
                  }`}
                  style={{ width: `${Math.max(transcribeUi.finished ? 100 : 2, transcribeUi.progress)}%` }}
                />
              </div>
              {!transcribeUi.finished && (
                <p className="mt-2 text-[11px] leading-snug text-white/40">
                  First run may install whisper.cpp and download a ~148 MB model. Long videos take longer to
                  transcribe — progress updates while whisper runs.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {project.captions && segments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-white/65">
            {segments.length} scene beat(s) — one sentence each by default
          </span>
          <p className="text-[11px] leading-snug text-white/40">
            Blank line between beats = separate scene. Delete a blank line to merge two beats into one scene.
          </p>
          <textarea
            className="max-h-48 min-h-[120px] w-full resize-y rounded-xl border border-white/10 bg-[#141414] p-2 font-mono text-xs leading-relaxed text-white/90 outline-none focus:border-[#ff6b35]/50"
            value={beatLayout}
            onChange={(e) => {
              setBeatLayout(e.target.value);
              setBeatLayoutCustom(true);
            }}
          />
          <div className="max-h-24 overflow-y-auto rounded-xl border border-white/10 bg-[#141414] text-xs">
            {segments.map((s, i) => (
              <div key={i} className="border-b border-white/[0.06] px-2 py-1 last:border-0">
                <span className="text-white/45">{fmt(s.startMs)}–{fmt(s.endMs)}</span>{' '}
                <span className="text-white/90">{s.words.map((w) => w.text).join(' ')}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleGenerateFromTranscript}
            disabled={busy}
            className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-3 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            Generate scenes from transcript
          </button>
          <button
            onClick={handleSync}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-[#141414] px-3 py-1.5 text-xs font-medium text-white/90 transition-colors hover:bg-[#252525] disabled:opacity-50"
          >
            Or: fit existing scenes' timing + word reveal to voiceover instead
          </button>
        </div>
      )}

      {status && <p className="text-xs text-white/45">{status}</p>}
    </div>
  );
}
