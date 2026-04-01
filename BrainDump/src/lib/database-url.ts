/**
 * Postgres URL for Prisma + the pg driver adapter.
 * Vercel Postgres / Neon often set POSTGRES_PRISMA_URL or POSTGRES_URL;
 * only reading DATABASE_URL leaves the runtime adapter with an empty string.
 */
export function resolveDatabaseUrl(): string {
  const raw =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    "";
  const url = (typeof raw === "string" ? raw : "").trim();
  if (!url) return "";
  if (url.startsWith("postgres://")) return `postgresql://${url.slice("postgres://".length)}`;
  return url;
}
