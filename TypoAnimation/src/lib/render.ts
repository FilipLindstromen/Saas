import path from 'path';
import { promises as fs } from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Project } from '@/types/project';
import { COMPOSITION_ID } from '@/remotion/constants';
import { updateJob } from './renderJobs';

const ENTRY_POINT = path.join(process.cwd(), 'src', 'remotion', 'index.ts');
const RENDER_DIR = path.join(process.cwd(), 'public', 'renders');

// Bundling the composition is the slow part (tens of seconds) and doesn't depend on the
// project being rendered, so it's cached across requests/jobs for this process's lifetime.
let bundleLocationPromise: Promise<string> | null = null;
function getBundleLocation(): Promise<string> {
  if (!bundleLocationPromise) {
    bundleLocationPromise = bundle({
      entryPoint: ENTRY_POINT,
      onProgress: () => {},
      // Remotion's bundler is a separate build from Next's own (it bundles src/remotion/index.ts
      // standalone for rendering) and doesn't read tsconfig's `paths`, so the `@/*` alias every
      // file here uses needs to be added explicitly or every `@/...` import fails to resolve.
      bundlerOverride: (config) => ({
        ...config,
        resolve: {
          ...config.resolve,
          alias: { ...config.resolve?.alias, '@': path.join(process.cwd(), 'src') },
        },
      }),
    }).catch((err) => {
      // Don't let a failed bundle attempt permanently poison the cache for later requests.
      bundleLocationPromise = null;
      throw err;
    });
  }
  return bundleLocationPromise;
}

export async function renderProject(jobId: string, project: Project): Promise<string> {
  updateJob(jobId, { status: 'rendering', progress: 0 });

  const serveUrl = await getBundleLocation();
  const inputProps = { project };

  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps });

  await fs.mkdir(RENDER_DIR, { recursive: true });
  const filename = `${jobId}.mp4`;
  const outputLocation = path.join(RENDER_DIR, filename);

  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps,
    onProgress: ({ progress }) => updateJob(jobId, { progress }),
  });

  const url = `/renders/${filename}`;
  updateJob(jobId, { status: 'done', progress: 1, url });
  return url;
}
