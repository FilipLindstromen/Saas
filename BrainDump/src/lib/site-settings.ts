import { prisma } from "@/lib/db";

const GLOBAL_ID = "global";

export async function getRevenueCatServerEnabled(): Promise<boolean> {
  const row = await prisma.siteSettings.findUnique({ where: { id: GLOBAL_ID } });
  if (!row) return true;
  return row.revenueCatEnabled;
}

export async function setRevenueCatServerEnabled(enabled: boolean): Promise<void> {
  await prisma.siteSettings.upsert({
    where: { id: GLOBAL_ID },
    create: { id: GLOBAL_ID, revenueCatEnabled: enabled },
    update: { revenueCatEnabled: enabled },
  });
}
