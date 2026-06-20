import type { PrismaClient } from "../../prisma/generated/prisma/client";

let organizedItemSchemaEnsured: Promise<void> | null = null;

/**
 * Ensures newer OrganizedItem columns exist (Postgres IF NOT EXISTS).
 * Covers deployments that never ran full migrations (`db push` / migrate).
 *
 * - listOrder — list/text ordering
 * - deletedAt — soft-delete (trash)
 */
export function ensureOrganizedItemListOrderColumn(prisma: PrismaClient): Promise<void> {
  if (!organizedItemSchemaEnsured) {
    organizedItemSchemaEnsured = (async () => {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "OrganizedItem" ADD COLUMN IF NOT EXISTS "listOrder" DOUBLE PRECISION NOT NULL DEFAULT 0`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "OrganizedItem" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3)`
      );
    })()
      .then(() => undefined)
      .catch((e) => {
        organizedItemSchemaEnsured = null;
        throw e;
      });
  }
  return organizedItemSchemaEnsured;
}
