// Plain constants only — no React/remotion imports. Root.tsx, PreviewPlayer.tsx, and
// render.ts (a server-only Node module, part of the API route's bundle) all need these, but
// render.ts must NOT transitively pull in the Composition/scene-component tree: that tree
// touches `remotion`'s React internals (context, hooks) at module scope, which breaks when
// bundled under Next's "react-server" condition for route handlers (a plain Node.js
// module, not a Server Component, but bundled as part of the same server target) — the
// mere import used to throw "Remotion requires React.createContext, but it is undefined".
export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1080;
export const COMPOSITION_ID = 'Main';
