import path from "path";
import type { NextConfig } from "next";

// Set by scripts/static-build.mjs, which also temporarily moves src/app/api/ out of the way
// for this build — a static export can't include Route Handlers (upload/transcribe/render/
// broll all need a real server), so that script builds a script->scenes->live-preview-only
// version for GitHub Pages while the regular `npm run build`/`next dev` keep the full app.
const isStaticExport = process.env.STATIC_EXPORT === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this directory (user home dir, the Saas monorepo root) —
  // pin the workspace root explicitly so Turbopack doesn't guess wrong.
  turbopack: {
    root: path.join(__dirname),
  },
  // @remotion/renderer/@remotion/bundler pick their native compositor binary at runtime via
  // a switch on process.platform/arch (@remotion/compositor-<platform>-<arch>) — only the
  // one matching package is ever actually installed. Bundling them (Turbopack's default for
  // route handlers) makes it statically resolve every branch and fail on the platforms that
  // aren't installed. Leaving them external hands the require() to Node at runtime instead,
  // which only ever touches the real one.
  serverExternalPackages: ['@remotion/renderer', '@remotion/bundler', '@remotion/compositor-win32-x64-msvc'],
  ...(isStaticExport
    ? {
        output: "export" as const,
        trailingSlash: true,
        images: { unoptimized: true },
        ...(basePath ? { basePath, assetPrefix: basePath } : {}),
      }
    : {}),
};

export default nextConfig;
