import { NextRequest, NextResponse } from 'next/server';
import { downloadBrollVideo } from '@/lib/downloadBroll';
import type { StockVideoResult } from '@/lib/stockVideo';
import type { BrollAsset } from '@/types/project';

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { result?: StockVideoResult };
  const result = body.result;
  if (!result || !result.downloadUrl) {
    return NextResponse.json({ error: 'missing result' }, { status: 400 });
  }

  try {
    const { path } = await downloadBrollVideo(result.downloadUrl, result.id, result.provider);
    const broll: BrollAsset = {
      path,
      provider: result.provider,
      sourceId: result.id,
      thumbnail: result.thumbnail,
      credit: result.credit,
    };
    return NextResponse.json({ broll });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
