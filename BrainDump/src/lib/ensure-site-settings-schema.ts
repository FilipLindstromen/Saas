import type { PrismaClient } from "../../prisma/generated/prisma/client";

let siteSettingsSchemaEnsured: Promise<void> | null = null;

/**
 * Ensures SiteSettings table and newer columns exist (Postgres IF NOT EXISTS).
 * Covers deployments that never ran full migrations (`db push` / migrate).
 */
export function ensureSiteSettingsSchema(prisma: PrismaClient): Promise<void> {
  if (!siteSettingsSchemaEnsured) {
    siteSettingsSchemaEnsured = (async () => {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "SiteSettings" (
          "id" TEXT NOT NULL,
          "revenueCatEnabled" BOOLEAN NOT NULL DEFAULT true,
          "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT "SiteSettings_pkey" PRIMARY KEY ("id")
        )
      `);
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "organizeSystemPromptEn" TEXT`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "organizeSystemPromptSv" TEXT`
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "SiteSettings" ADD COLUMN IF NOT EXISTS "coachSystemPrompt" TEXT`
      );
    })()
      .then(() => undefined)
      .catch((e) => {
        siteSettingsSchemaEnsured = null;
        throw e;
      });
  }
  return siteSettingsSchemaEnsured;
}
