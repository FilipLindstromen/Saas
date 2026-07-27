import path from "path";
import type { NextConfig } from "next";

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
};

export default nextConfig;
