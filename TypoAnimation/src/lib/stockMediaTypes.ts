export interface StockMediaResult {
  id: string;
  provider: 'pexels' | 'pixabay' | 'unsplash';
  /** 'video' for Pexels/Pixabay results, 'image' for Unsplash photos */
  kind: 'video' | 'image';
  thumbnail: string;
  width: number;
  height: number;
  /** only present for video results */
  durationSec?: number;
  downloadUrl: string;
  credit?: string;
}

/** @deprecated kept as an alias — searchStockVideos now returns a mix of video and image results */
export type StockVideoResult = StockMediaResult;

export type StockProvider = 'pexels' | 'pixabay' | 'unsplash';
export type StockSearchScope = 'all' | StockProvider;

export const STOCK_PROVIDER_OPTIONS: { id: StockSearchScope; label: string; hint: string }[] = [
  { id: 'all', label: 'All sources', hint: 'Pexels, Pixabay & Unsplash' },
  { id: 'pexels', label: 'Pexels', hint: 'Stock video' },
  { id: 'pixabay', label: 'Pixabay', hint: 'Stock video' },
  { id: 'unsplash', label: 'Unsplash', hint: 'Stock photos' },
];
