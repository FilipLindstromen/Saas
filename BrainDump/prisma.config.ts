import { defineConfig } from "prisma/config";

function getDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL ?? process.env.POSTGRES_URL ?? "";
  const url = (typeof raw === "string" ? raw : "").trim();
  if (!url) return "postgresql://localhost:5432/braindump";
  // Prisma expects postgresql:// scheme (postgres:// can cause P1013)
  if (url.startsWith("postgres://")) return "postgresql://" + url.slice(11);
  return url;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: getDatabaseUrl(),
  },
});
