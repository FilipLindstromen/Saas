'use client';

import React, { useEffect, useRef, useState } from 'react';
import type { Project } from '@/types/project';
import type { RenderJob } from '@/lib/renderJobs';

export function ExportPanel({ project }: { project: Project }) {
  const [job, setJob] = useState<RenderJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const startExport = async () => {
    const res = await fetch('/api/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project }),
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

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={startExport}
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
  );
}
