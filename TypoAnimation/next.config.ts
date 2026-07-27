import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Multiple lockfiles exist above this directory (user home dir, the Saas monorepo root) —
  // pin the workspace root explicitly so Turbopack doesn't guess wrong.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
