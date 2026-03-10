const path = require("path");

// Single root for both Turbopack and output file tracing (Next.js requires them to match)
const projectRoot = __dirname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // When served under a subpath (e.g. from SaaS hub at /BrainDump/), set NEXT_PUBLIC_BASE_PATH=/BrainDump
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  outputFileTracingRoot: projectRoot,
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: projectRoot,
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
