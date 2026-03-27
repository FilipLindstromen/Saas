import type { PrismaClient } from "../../prisma/generated/prisma/client";

let listOrderColumnEnsured: Promise<void> | null = null;

/**
 * Deployments that predated listOrder never ran migrate; Prisma then fails on orderBy/create.
 * Adds the column once per process (Postgres IF NOT EXISTS).
 */
export function ensureOrganizedItemListOrderColumn(prisma: PrismaClient): Promise<void> {
  if (!listOrderColumnEnsured) {
    listOrderColumnEnsured = prisma
      .$executeRawUnsafe(
        `ALTER TABLE "OrganizedItem" ADD COLUMN IF NOT EXISTS "listOrder" DOUBLE PRECISION NOT NULL DEFAULT 0`
      )
      .then(() => undefined)
      .catch((e) => {
        listOrderColumnEnsured = null;
        throw e;
      });
  }
  return listOrderColumnEnsured;
}
