import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import * as path from "path";
import { resolveDatabaseUrl } from "./src/lib/database-url";

// Load .env from project root for local dev
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local") });

/** Used only when no DATABASE_URL / NEON_DATABASE_URL / … is set (see .env.example). */
const FALLBACK_LOCAL = "postgresql://127.0.0.1:5432/metaconnect";

function prismaDatasourceUrl(): string {
  const resolved = resolveDatabaseUrl();
  if (resolved) return resolved;
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[prisma] No DATABASE_URL (or NEON_DATABASE_URL, …) — using ${FALLBACK_LOCAL}.\n` +
        `For production, set DATABASE_URL in Vercel project settings.`,
    );
  }
  return FALLBACK_LOCAL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: prismaDatasourceUrl(),
  },
});
