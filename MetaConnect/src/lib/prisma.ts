import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { resolveDatabaseUrl } from "@/lib/database-url";

/** Used only when no URL is set (e.g. `prisma generate` / Next.js production build). */
const FALLBACK_LOCAL = "postgresql://127.0.0.1:5432/metaconnect";

function isNextProductionBuild(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

function getConnectionString(): string {
  const resolved = resolveDatabaseUrl();
  if (resolved) return resolved;

  if (!isNextProductionBuild() && process.env.NODE_ENV === "development") {
    console.warn(
      `[MetaConnect] No database URL — using ${FALLBACK_LOCAL}. Set DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL, or NEON_DATABASE_URL.`,
    );
  } else if (!isNextProductionBuild() && process.env.VERCEL) {
    console.error(
      "[MetaConnect] No database URL. Set DATABASE_URL, POSTGRES_PRISMA_URL, POSTGRES_URL, or NEON_DATABASE_URL in Vercel project settings.",
    );
  }

  return FALLBACK_LOCAL;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = getConnectionString();
  const onVercel = Boolean(process.env.VERCEL);
  const adapter = new PrismaPg({
    connectionString,
    max: onVercel ? 1 : 10,
    idleTimeoutMillis: onVercel ? 20_000 : 30_000,
    connectionTimeoutMillis: 15_000,
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (!globalForPrisma.prisma) globalForPrisma.prisma = prisma;

export default prisma;
