// Plain constants only — no React/remotion imports. Root.tsx, PreviewPlayer.tsx, and
// render.ts (a server-only Node module, part of the API route's bundle) all need these, but
// render.ts must NOT transitively pull in the Composition/scene-component tree: that tree
// touches `remotion`'s React internals (context, hooks) at module scope, which breaks when
// bundled under Next's "react-server" condition for route handlers (a plain Node.js
// module, not a Server Component, but bundled as part of the same server target) — the
// mere import used to throw "Remotion requires React.createContext, but it is undefined".
// `@/types/project` is safe to pull in here too: it's plain types/functions, no React.
import type { AspectRatio } from '@/types/project';

export const FPS = 30;
// Default (1:1) composition size — Root.tsx's <Composition> needs a static width/height at
// registration time; the actual per-project size then comes from calculateMetadata via
// getCompositionSize(project.aspectRatio) below, which both the Player preview and the
// server render path (selectComposition resolves the same calculateMetadata) pick up.
export const WIDTH = 1080;
export const HEIGHT = 1080;
export const COMPOSITION_ID = 'Main';

export const ASPECT_RATIO_SIZES: Record<AspectRatio, { width: number; height: number }> = {
  '1:1': { width: 1080, height: 1080 },
  '16:9': { width: 1920, height: 1080 },
  '9:16': { width: 1080, height: 1920 },
};

export function getCompositionSize(aspectRatio?: AspectRatio): { width: number; height: number } {
  return ASPECT_RATIO_SIZES[aspectRatio || '1:1'];
}
