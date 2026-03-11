const path = require("path");

// Load env from repo root (localhost: one .env for all apps)
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });

// Single root for both Turbopack and output file tracing (Next.js requires them to match)
const projectRoot = __dirname;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // When served under a subpath (e.g. from SaaS hub at /BrainDump/), set NEXT_PUBLIC_BASE_PATH=/BrainDump
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  // Expose root .env keys to client (so shared/apiKeys can use them)
  env: {
    NEXT_PUBLIC_OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
    NEXT_PUBLIC_UNSPLASH_ACCESS_KEY: process.env.UNSPLASH_ACCESS_KEY || "",
    NEXT_PUBLIC_PEXELS_API_KEY: process.env.PEXELS_API_KEY || "",
    NEXT_PUBLIC_GIPHY_API_KEY: process.env.GIPHY_API_KEY || "",
    NEXT_PUBLIC_PIXABAY_API_KEY: process.env.PIXABAY_API_KEY || "",
  },
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
