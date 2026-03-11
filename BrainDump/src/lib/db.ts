/**
 * Prisma client singleton for BrainDump (Postgres).
 * DATABASE_URL must be set (e.g. Vercel Postgres connection string).
 */
import { PrismaClient } from "../../prisma/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  const options: { datasources?: { db: { url: string } }; log: ("error" | "warn")[] } = {
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  };
  // Prisma 7 generated types require adapter|accelerateUrl; datasources + log are valid at runtime
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient(options as any);
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
