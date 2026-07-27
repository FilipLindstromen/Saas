export interface RenderJob {
  id: string;
  status: 'pending' | 'rendering' | 'done' | 'error';
  progress: number;
  url?: string;
  error?: string;
}

// In-memory only — this is a local, single-user tool run via `npm run dev`/`next start` in
// one long-lived Node process, not a serverless deployment where background work after a
// response can get killed. A job map is enough; no need for persistence across restarts.
const jobs = new Map<string, RenderJob>();

export function createJob(id: string): RenderJob {
  const job: RenderJob = { id, status: 'pending', progress: 0 };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, patch: Partial<RenderJob>): void {
  const job = jobs.get(id);
  if (job) Object.assign(job, patch);
}

export function getJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}
