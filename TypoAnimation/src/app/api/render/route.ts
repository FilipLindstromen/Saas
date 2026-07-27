import { NextRequest, NextResponse } from 'next/server';
import type { Project } from '@/types/project';
import { createJob, getJob, updateJob } from '@/lib/renderJobs';
import { renderProject } from '@/lib/render';

export const runtime = 'nodejs';
export const maxDuration = 600;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { project?: Project };
  if (!body.project) return NextResponse.json({ error: 'missing project' }, { status: 400 });

  const jobId = crypto.randomUUID();
  createJob(jobId);

  // Fire-and-forget: this process stays alive after the response (a local `next dev`/`next
  // start` server, not a serverless function that gets torn down), so the render keeps
  // running in the background and the client polls GET /api/render?jobId= for progress.
  renderProject(jobId, body.project).catch((err) => {
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
