/**
 * Prisma client singleton for BrainDump (Postgres).
 * Set DATABASE_URL, or POSTGRES_PRISMA_URL / POSTGRES_URL (common on Vercel Postgres).
 * Prisma 7 requires the pg adapter; datasources is not supported.
 */
import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "@/lib/database-url";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    console.error(
      "[BrainDump] No database URL: set DATABASE_URL (or POSTGRES_PRISMA_URL / POSTGRES_URL on Vercel Postgres)."
    );
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
