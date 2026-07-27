import { NextRequest, NextResponse } from 'next/server';
import { searchStockVideos } from '@/lib/stockVideo';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { query?: string };
  if (!body.query || !body.query.trim()) {
    return NextResponse.json({ error: 'missing query' }, { status: 400 });
  }
  const results = await searchStockVideos(body.query.trim());
  return NextResponse.json({ results });
}
