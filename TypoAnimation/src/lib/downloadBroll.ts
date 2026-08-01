import path from 'path';
import { existsSync, promises as fs } from 'fs';
import { ffprobeDurationMs } from './transcribe';

const BROLL_DIR = path.join(process.cwd(), 'public', 'broll');

export async function downloadBrollMedia(
  url: string,
  id: string,
  provider: string,
  kind: 'video' | 'image' = 'video'
): Promise<{ path: string; durationMs: number }> {
  await fs.mkdir(BROLL_DIR, { recursive: true });
  const filename = `${provider}-${id}.${kind === 'image' ? 'jpg' : 'mp4'}`;
  const filePath = path.join(BROLL_DIR, filename);

  // Same stock pick again (re-run auto-select, or two scenes landing on the same top result)
  // — skip re-downloading it.
  if (!existsSync(filePath)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download b-roll ${kind}: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, buffer);
  }

  const durationMs = kind === 'image' ? 0 : await ffprobeDurationMs(filePath);
  return { path: `/broll/${filename}`, durationMs };
}
