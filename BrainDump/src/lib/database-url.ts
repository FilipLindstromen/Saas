/**
 * Postgres URL for Prisma + the pg driver adapter.
 *
 * Important: use first *non-empty* value. Vercel projects often define DATABASE_URL as an
 * empty placeholder; `process.env.DATABASE_URL ?? POSTGRES_URL` would incorrectly stick to "".
 */
const CANDIDATE_ENV_KEYS = [
  "DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "PRISMA_DATABASE_URL",
  /** Direct connection; use when pooled URLs misbehave with the pg adapter */
  "POSTGRES_URL_NON_POOLING",
] as const;

export function resolveDatabaseUrl(): string {
  let raw = "";
  for (const key of CANDIDATE_ENV_KEYS) {
    const v = process.env[key];
    if (typeof v === "string" && v.trim()) {
      raw = v.trim();
      break;
    }
  }
  if (!raw) return "";
  if (raw.startsWith("postgres://")) return `postgresql://${raw.slice("postgres://".length)}`;
  return raw;
}
