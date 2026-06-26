import { defineConfig } from "prisma/config";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env from project root for local dev
dotenv.config({ path: path.join(__dirname, ".env") });
dotenv.config({ path: path.join(__dirname, ".env.local") });

const FALLBACK_LOCAL = "postgresql://127.0.0.1:5432/metaconnect";

function datasourceUrl(): string {
  const url =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL;
  if (url) return url;
  console.warn(`[prisma] No DATABASE_URL found — falling back to ${FALLBACK_LOCAL}`);
  return FALLBACK_LOCAL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: datasourceUrl(),
  },
});
