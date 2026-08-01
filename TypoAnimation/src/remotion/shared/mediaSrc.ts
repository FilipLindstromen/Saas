import { staticFile } from 'remotion';
import type { BrollAsset } from '@/types/project';

/** Infer image vs video when older projects omit `broll.kind`. */
export function brollMediaKind(broll: BrollAsset): 'image' | 'video' {
  if (broll.kind === 'image' || broll.kind === 'video') return broll.kind;
  return /\.(jpe?g|png|webp|gif)$/i.test(broll.path) ? 'image' : 'video';
}

/** Turn project-stored media paths (/uploads/…, /broll/…) into URLs Remotion can load in Player + render. */
export function resolveRemotionSrc(mediaPath: string): string {
  if (!mediaPath) return mediaPath;
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;

  const webPath = mediaPath.startsWith('/') ? mediaPath : `/${mediaPath}`;

  // In the browser (Remotion Player inside Next.js), serve files from `public/` at the page origin.
  if (typeof window !== 'undefined') {
    return new URL(webPath, window.location.origin).href;
  }

  const normalized = webPath.slice(1);
  return staticFile(normalized);
}

/** Prefer the downloaded local file; fall back to the stock thumbnail URL for live preview. */
export function resolveBrollPrimarySrc(broll: BrollAsset): string {
  return resolveRemotionSrc(broll.path);
}

export function resolveBrollFallbackSrc(broll: BrollAsset): string | undefined {
  if (broll.thumbnail && /^https?:\/\//i.test(broll.thumbnail)) return broll.thumbnail;
  return undefined;
}
