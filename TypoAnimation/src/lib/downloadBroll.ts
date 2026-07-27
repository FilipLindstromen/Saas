import path from 'path';
import { existsSync, promises as fs } from 'fs';
import { ffprobeDurationMs } from './transcribe';

const BROLL_DIR = path.join(process.cwd(), 'public', 'broll');

export async function downloadBrollVideo(
  url: string,
  id: string,
  provider: string
): Promise<{ path: string; durationMs: number }> {
  await fs.mkdir(BROLL_DIR, { recursive: true });
  const filename = `${provider}-${id}.mp4`;
  const filePath = path.join(BROLL_DIR, filename);

  // Same stock clip picked again (re-run auto-select, or two scenes landing on the same
  // top result) — skip re-downloading it.
  if (!existsSync(filePath)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to download b-roll video: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(filePath, buffer);
  }

  const durationMs = await ffprobeDurationMs(filePath);
  return { path: `/broll/${filename}`, durationMs };
}
