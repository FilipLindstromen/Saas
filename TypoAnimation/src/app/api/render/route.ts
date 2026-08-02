import { NextRequest, NextResponse } from 'next/server';
import type { Project } from '@/types/project';
import type { ExportRenderSettings } from '@/lib/exportSettings';
import { createJob, getJob, updateJob } from '@/lib/renderJobs';
import { renderProject } from '@/lib/render';
import { exportSettingsFromPreset } from '@/lib/exportSettings';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { project?: Project; exportSettings?: ExportRenderSettings; qualityPreset?: ExportRenderSettings['preset'] };
  if (!body.project) return NextResponse.json({ error: 'missing project' }, { status: 400 });

  const exportSettings =
    body.exportSettings ??
    (body.qualityPreset ? exportSettingsFromPreset(body.qualityPreset) : exportSettingsFromPreset('standard'));

  const jobId = crypto.randomUUID();
  createJob(jobId);

  renderProject(jobId, body.project, exportSettings).catch((err) => {
    updateJob(jobId, { status: 'error', error: err instanceof Error ? err.message : String(err) });
  });

  return NextResponse.json({ jobId });
}

export async function GET(request: NextRequest) {
  const jobId = request.nextUrl.searchParams.get('jobId');
  if (!jobId) return NextResponse.json({ error: 'missing jobId' }, { status: 400 });
  const job = getJob(jobId);
  if (!job) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  return NextResponse.json(job);
}
