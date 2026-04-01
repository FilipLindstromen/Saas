import { defineConfig } from "prisma/config";
import { resolveDatabaseUrl } from "./src/lib/database-url";

/** Used only when no DATABASE_URL / NEON_DATABASE_URL / … is set (see .env.example). */
const FALLBACK_LOCAL = "postgresql://127.0.0.1:5432/braindump";

function prismaDatasourceUrl(): string {
  const resolved = resolveDatabaseUrl();
  if (resolved) return resolved;
  console.warn(
    `[prisma] No DATABASE_URL (or NEON_DATABASE_URL, …) — using ${FALLBACK_LOCAL}.\n` +
      `To run commands against the Vercel database: npm run vercel:env:production, then npm run db:migrate:vercel (or db:push:vercel).`,
  );
  return FALLBACK_LOCAL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: prismaDatasourceUrl(),
  },
});
