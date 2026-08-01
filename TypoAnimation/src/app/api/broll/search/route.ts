import { NextRequest, NextResponse } from 'next/server';
import { searchStockMedia, type StockSearchScope } from '@/lib/stockVideo';

export const runtime = 'nodejs';

const VALID_PROVIDERS = new Set<StockSearchScope>(['all', 'pexels', 'pixabay', 'unsplash']);

export async function POST(request: NextRequest) {
  const body = (await request.json()) as { query?: string; provider?: StockSearchScope };
  if (!body.query || !body.query.trim()) {
    return NextResponse.json({ error: 'missing query' }, { status: 400 });
  }
  const provider = VALID_PROVIDERS.has(body.provider as StockSearchScope)
    ? (body.provider as StockSearchScope)
    : 'all';
  const results = await searchStockMedia(body.query.trim(), { provider, perPage: 12 });
  return NextResponse.json({ results, provider });
}
