/**
 * Prisma client singleton for BrainDump (Postgres).
 * DATABASE_URL must be set (e.g. Vercel Postgres connection string).
 */
import { PrismaClient } from "../../prisma/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
