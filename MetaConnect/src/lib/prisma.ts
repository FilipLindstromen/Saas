import { PrismaClient } from "../../prisma/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

function getDatabaseUrl(): string {
  const url =
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DATABASE_URL ||
    process.env.NEON_DATABASE_URL;
  if (!url) {
    console.error("[MetaConnect] No DATABASE_URL set. Set DATABASE_URL, POSTGRES_PRISMA_URL, or NEON_DATABASE_URL.");
    return "";
  }
  return url;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createPrismaClient(): PrismaClient {
  const connectionString = getDatabaseUrl();
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
