import path from 'path';
import { promises as fs } from 'fs';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Project } from '@/types/project';
import { COMPOSITION_ID } from '@/remotion/constants';
import { updateJob } from './renderJobs';

const ENTRY_POINT = path.join(process.cwd(), 'src', 'remotion', 'index.ts');
const RENDER_DIR = path.join(process.cwd(), 'public', 'renders');

// NOT cached across requests: Remotion's bundle() copies `public/` into the bundle output as
// a one-time snapshot. Uploads, downloaded b-roll clips, and rendered exports all land in
// public/ AFTER the app starts — a cached bundle from before a given upload/b-roll download
// would 404 on it during render (confirmed: this broke b-roll and would equally break the
// primary webcam-video render path). Re-bundling per render costs ~20-50s against a
// multi-minute render anyway, so correctness wins over the caching that used to be here.
function getBundleLocation(): Promise<string> {
  return bundle({
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
  });
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
