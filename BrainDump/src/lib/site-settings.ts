import { prisma } from "@/lib/db";
import { ensureSiteSettingsSchema } from "@/lib/ensure-site-settings-schema";

const GLOBAL_ID = "global";

export async function getRevenueCatServerEnabled(): Promise<boolean> {
  await ensureSiteSettingsSchema(prisma);
  const row = await prisma.siteSettings.findUnique({ where: { id: GLOBAL_ID } });
  if (!row) return true;
  return row.revenueCatEnabled;
}

export async function setRevenueCatServerEnabled(enabled: boolean): Promise<void> {
  await ensureSiteSettingsSchema(prisma);
  await prisma.siteSettings.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, revenueCatEnabled: enabled },
    update: { revenueCatEnabled: enabled },
  });
}
