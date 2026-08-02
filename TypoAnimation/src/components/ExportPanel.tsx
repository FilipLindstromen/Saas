'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/types/project';
import type { RenderJob } from '@/lib/renderJobs';
import {
  EXPORT_QUALITY_PRESETS,
  exportOutputDimensions,
  exportSettingsFromPreset,
  type ExportQualityPreset,
} from '@/lib/exportSettings';
import { SettingsOverlay } from '@/components/SettingsOverlay';

export function ExportPanel({ project }: { project: Project }) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [preset, setPreset] = useState<ExportQualityPreset>('standard');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startExport = async (qualityPreset: ExportQualityPreset) => {
    setDialogOpen(false);
    const exportSettings = exportSettingsFromPreset(qualityPreset);
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project, exportSettings }),
    });
    const data = (await res.json()) as { jobId: string };
    setJob({ id: data.jobId, status: 'pending', progress: 0 });

    pollRef.current = setInterval(async () => {
      const r = await fetch(`/api/render?jobId=${data.jobId}`);
      if (!r.ok) return;
      const j = (await r.json()) as RenderJob;
      setJob(j);
      if (j.status === 'done' || j.status === 'error') {
        if (pollRef.current) clearInterval(pollRef.current);
      }
    }, 1500);
  };

  const busy = job?.status === 'pending' || job?.status === 'rendering';
  const selected = EXPORT_QUALITY_PRESETS[preset];
  const outSize = exportOutputDimensions(project.aspectRatio, selected.scale);

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={busy || project.scenes.length === 0}
          className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
        >
          {busy ? `Rendering… ${Math.round((job?.progress ?? 0) * 100)}%` : 'Export MP4'}
        </button>
        {job?.status === 'done' && job.url && (
          <a href={job.url} download className="text-xs font-medium text-white/90 underline hover:text-white">
            Download
          </a>
        )}
        {job?.status === 'error' && <span className="text-xs text-[#ff4757]">{job.error}</span>}
      </div>

      <SettingsOverlay open={dialogOpen} onClose={() => setDialogOpen(false)} title="Export MP4">
        <div className="flex flex-col gap-4 text-sm">
          <p className="text-xs leading-relaxed text-white/50">
            Exports your full timeline — text animations, scene video, and voiceover audio — as one H.264 MP4.
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-white/65">Quality</span>
            {(Object.keys(EXPORT_QUALITY_PRESETS) as ExportQualityPreset[]).map((key) => {
              const opt = EXPORT_QUALITY_PRESETS[key];
              const active = preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setPreset(key)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    active
                      ? 'border-[#ff6b35] bg-[#ff6b35]/10'
                      : 'border-white/10 bg-[#141414] hover:border-white/15'
                  }`}
                >
                  <div className="text-xs font-semibold text-white">{opt.label}</div>
                  <div className="mt-0.5 text-[11px] leading-snug text-white/45">{opt.description}</div>
                </button>
              );
            })}
          </div>

          <div className="rounded-xl border border-white/10 bg-[#141414] px-3 py-2 text-xs text-white/55">
            Output:{' '}
            <span className="font-medium text-white/85">
              {outSize.width}×{outSize.height}
            </span>
            {' · '}
            CRF {selected.crf}
            {selected.scale < 1 ? ` · ${Math.round(selected.scale * 100)}% resolution` : ''}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="rounded-xl border border-white/10 bg-[#141414] px-4 py-1.5 text-xs font-medium text-white/90 hover:bg-[#252525]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void startExport(preset)}
              className="rounded-xl bg-gradient-to-br from-[#ff6b35] to-[#ff4757] px-4 py-1.5 text-xs font-semibold text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
            >
              Start export
            </button>
          </div>
        </div>
      </SettingsOverlay>
    </>
  );
}
