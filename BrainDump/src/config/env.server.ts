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
    // During Vercel *build* only, return placeholder so the build succeeds.
    // At runtime (NEXT_PHASE is set during build), always throw so auth fails with a clear message.
    const isBuild = process.env.NEXT_PHASE === "phase-production-build";
    if (process.env.VERCEL === "1" && isBuild) {
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
  /** Required by NextAuth v5 for signing cookies/tokens. Set AUTH_SECRET on Vercel. */
  get AUTH_SECRET() {
    const v = getRequired("AUTH_SECRET");
    const isBuild = process.env.VERCEL === "1" && process.env.NEXT_PHASE === "phase-production-build";
    if (!isBuild && v.length < 16) {
      throw new Error(
        "AUTH_SECRET must be at least 16 characters. In Vercel: Settings → Environment Variables → add AUTH_SECRET (e.g. run: openssl rand -base64 32)"
      );
    }
    return v;
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

