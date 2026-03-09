// Server-side environment access for BrainDump.
// Real values are provided via:
// - .env.local in local development (git-ignored)
// - Environment variables in the hosting provider (e.g. Vercel)

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  OPENAI_API_KEY: required("OPENAI_API_KEY"),
  GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
  // Optional: stock media (Unsplash, Pexels, Giphy) – used by ReelRecorder / shared pickers
  UNSPLASH_ACCESS_KEY: optional("UNSPLASH_ACCESS_KEY"),
  PEXELS_API_KEY: optional("PEXELS_API_KEY"),
  GIPHY_API_KEY: optional("GIPHY_API_KEY"),
};

