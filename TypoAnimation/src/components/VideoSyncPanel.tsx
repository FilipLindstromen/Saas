'use client';

import React, { useMemo, useState } from 'react';
import type { CaptionWord, Project, Scene, VideoAsset } from '@/types/project';
import { computeSceneBoundaries, segmentByGaps } from '@/lib/segmentCaptions';

function fmt(ms: number): string {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  const rem = (s % 60).toFixed(1);
  return `${m}:${rem.padStart(4, '0')}`;
}

export function VideoSyncPanel({
  project,
  onProjectChange,
  onBulkSceneUpdate,
}: {
  project: Project;
  onProjectChange: (patch: Partial<Project>) => void;
  onBulkSceneUpdate: (updates: { id: string; patch: Partial<Scene> }[]) => void;
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const segments = useMemo(
    () => (project.captions ? segmentByGaps(project.captions, 500) : []),
    [project.captions]
  );

  const handleUpload = async (file: File) => {
    setBusy(true);
    setStatus('Uploading video…');
    try {
      const form = new FormData();
      form.append('video', file);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) throw new Error((await res.json()).error || 'upload failed');
      const data = (await res.json()) as { path: string; durationMs: number };
      const video: VideoAsset = { path: data.path, durationMs: data.durationMs, mode: 'background' };
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
    setStatus('Transcribing (first run installs whisper.cpp + downloads a ~150MB model — can take a few minutes)…');
    try {
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoPath: project.video.path }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'transcription failed');
      const data = (await res.json()) as { captions: CaptionWord[] };
      onProjectChange({ captions: data.captions });
      setStatus(`Transcribed — ${data.captions.length} words.`);
    } catch (err) {
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

  return (
    <div className="flex flex-col gap-3 text-sm">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Voiceover sync</h2>

      <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
        Webcam / voiceover video
        <input
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
          className="text-xs"
        />
      </label>

      {project.video && (
        <>
          <div className="text-xs text-neutral-600">
            {project.video.path} · {fmt(project.video.durationMs)}
          </div>

          <label className="flex flex-col gap-1 text-xs font-medium text-neutral-500">
            Show video as
            <select
              className="rounded border border-neutral-300 px-2 py-1 text-neutral-900"
              value={project.video.mode}
              onChange={(e) =>
                onProjectChange({ video: { ...project.video!, mode: e.target.value as VideoAsset['mode'] } })
              }
            >
              <option value="background">Full-bleed background</option>
              <option value="pip">Picture-in-picture</option>
              <option value="hidden">Hidden (audio only)</option>
            </select>
          </label>

          <button
            onClick={handleTranscribe}
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {project.captions ? 'Re-transcribe' : 'Transcribe voice (local, no API key)'}
          </button>
        </>
      )}

      {project.captions && segments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-neutral-500">
            Detected {segments.length} beat(s) from silence gaps
          </span>
          <div className="max-h-32 overflow-y-auto rounded border border-neutral-200 text-xs">
            {segments.map((s, i) => (
              <div key={i} className="border-b border-neutral-100 px-2 py-1 last:border-0">
                <span className="text-neutral-400">{fmt(s.startMs)}–{fmt(s.endMs)}</span>{' '}
                <span className="text-neutral-700">{s.words.map((w) => w.text).join(' ')}</span>
              </div>
            ))}
          </div>
          <button
            onClick={handleSync}
            disabled={busy}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-100 disabled:opacity-50"
          >
            Sync scene timing + word reveal to voiceover
          </button>
        </div>
      )}

      {status && <p className="text-xs text-neutral-500">{status}</p>}
    </div>
  );
}
