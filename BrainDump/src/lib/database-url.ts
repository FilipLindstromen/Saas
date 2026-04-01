/**
 * Postgres URL for Prisma + the pg driver adapter.
 *
 * - Uses the first *non-empty* env value (empty DATABASE_URL must not block fallbacks).
 * - For pooled hosts (Neon pooler, Supabase pool port), appends `pgbouncer=true` so the Prisma
 *   `pg` adapter works with transaction-mode poolers (avoids prepared-statement errors).
 */

const CANDIDATE_ENV_KEYS = [
  "DATABASE_URL",
  /** Neon “create on Vercel” often exposes this */
  "NEON_DATABASE_URL",
  "POSTGRES_PRISMA_URL",
  "POSTGRES_URL",
  "PRISMA_DATABASE_URL",
  /** Direct / non-pooling (try last — can help if pooled URL fails) */
  "POSTGRES_URL_NON_POOLING",
] as const;

/** Host looks like a transaction pooler — Prisma/pg usually needs pgbouncer=true */
function connectionProbablyUsesTransactionPooler(connectionString: string): boolean {
  const lower = connectionString.toLowerCase();
  if (lower.includes("pooler")) return true;
  if (lower.includes(":6543/") || lower.includes(":6543?")) return true;
  return false;
}

function ensurePgbouncerQueryParam(connectionString: string): string {
  if (!connectionProbablyUsesTransactionPooler(connectionString)) {
    return connectionString;
  }
  if (/[?&]pgbouncer=true(?:&|$)/i.test(connectionString)) {
    return connectionString;
  }
  const joiner = connectionString.includes("?") ? "&" : "?";
  return `${connectionString}${joiner}pgbouncer=true`;
}

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
  if (raw.startsWith("postgres://")) {
    raw = `postgresql://${raw.slice("postgres://".length)}`;
  }
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    const port = u.port || "5432";
    const pooled = host.includes("pooler") || port === "6543" || host.includes("pooler.supabase.com");
    if (pooled && u.searchParams.get("pgbouncer") !== "true") {
      u.searchParams.set("pgbouncer", "true");
      return u.toString();
    }
  } catch {
    return ensurePgbouncerQueryParam(raw);
  }
  return raw;
}
