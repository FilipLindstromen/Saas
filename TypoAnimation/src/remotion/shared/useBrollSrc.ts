import { useEffect, useState } from 'react';
import type { BrollAsset } from '@/types/project';
import { resolveBrollFallbackSrc, resolveBrollPrimarySrc } from './mediaSrc';

export function useBrollSrc(broll?: BrollAsset): { src: string; onError: () => void } | null {
  const primary = broll?.path ? resolveBrollPrimarySrc(broll) : null;
  const fallback = broll ? resolveBrollFallbackSrc(broll) : undefined;
  const [src, setSrc] = useState(primary);

  useEffect(() => {
    setSrc(primary);
  }, [primary]);

  if (!src) return null;

  const onError = () => {
    if (fallback) setSrc((current) => (current && current !== fallback ? fallback : current));
  };

  return { src, onError };
}
