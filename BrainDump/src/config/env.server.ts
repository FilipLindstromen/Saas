// Server-side environment access for BrainDump.
// Real values are provided via:
// - .env.local in local development (git-ignored)
// - Environment variables in the hosting provider (e.g. Vercel)
// Uses getters so validation runs at runtime, not at build time (Vercel build may not have env vars).

function optional(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim() ? value : undefined;
}

function getRequired(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    // During Vercel build, env vars may not be available; return placeholder so build succeeds.
    // At runtime, missing vars will cause auth/DB to fail with a clear error.
    if (process.env.VERCEL === "1") {
      return "";
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export const env = {
  get DATABASE_URL() {
    return getRequired("DATABASE_URL");
  },
  get OPENAI_API_KEY() {
    return getRequired("OPENAI_API_KEY");
  },
  get GOOGLE_CLIENT_ID() {
    return getRequired("GOOGLE_CLIENT_ID");
  },
  get GOOGLE_CLIENT_SECRET() {
    return getRequired("GOOGLE_CLIENT_SECRET");
  },
  get UNSPLASH_ACCESS_KEY() {
    return optional("UNSPLASH_ACCESS_KEY");
  },
  get PEXELS_API_KEY() {
    return optional("PEXELS_API_KEY");
  },
  get GIPHY_API_KEY() {
    return optional("GIPHY_API_KEY");
  },
};

