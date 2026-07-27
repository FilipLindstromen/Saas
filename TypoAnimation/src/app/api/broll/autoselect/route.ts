import { NextRequest, NextResponse } from 'next/server';
import type { Scene, BrollAsset } from '@/types/project';
import { generateBrollSearchQuery } from '@/lib/keywords';
import { searchStockVideos } from '@/lib/stockVideo';
import { downloadBrollVideo } from '@/lib/downloadBroll';

export const runtime = 'nodejs';
export const maxDuration = 600;

// Bulk auto-select, mirroring PitchDeck's handleBulkSelectVideos: loop scenes sequentially
// (small delay between each to be polite to the stock APIs), generate a search query from
// each scene's own text, take the first result, download it, assign. Scenes that already
// have b-roll are left alone — this fills gaps, it doesn't replace existing picks.
export async function POST(request: NextRequest) {
  const body = (await request.json()) as { scenes?: Scene[] };
  const scenes = body.scenes || [];
  const updates: { id: string; patch: { broll: BrollAsset } }[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const scene of scenes) {
    if (scene.broll) continue;
    try {
      const query = await generateBrollSearchQuery(scene);
      const results = await searchStockVideos(query, 5);
      const top = results[0];
      if (!top) {
        skipped.push({ id: scene.id, reason: `no results for "${query}"` });
        continue;
      }
      const { path } = await downloadBrollVideo(top.downloadUrl, top.id, top.provider);
      updates.push({
        id: scene.id,
        patch: {
          broll: {
            path,
            provider: top.provider,
            sourceId: top.id,
            thumbnail: top.thumbnail,
            credit: top.credit,
          },
        },
      });
    } catch (err) {
      skipped.push({ id: scene.id, reason: err instanceof Error ? err.message : String(err) });
    }
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return NextResponse.json({ updates, skipped });
}
