const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // When served under a subpath (e.g. from SaaS hub at /BrainDump/), set NEXT_PUBLIC_BASE_PATH=/BrainDump
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // Next 16: Turbopack is default; set root so workspace is inferred correctly (avoids multiple lockfile warning)
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: __dirname,
    resolveAlias: {
      "@shared": path.join(__dirname, "../shared"),
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@shared": path.resolve(__dirname, "../shared"),
    };
    return config;
  },
};

module.exports = nextConfig;
