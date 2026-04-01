import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";
import { ensureOrganizedItemListOrderColumn } from "@/lib/ensure-organized-item-schema";

/** POST — permanently delete all items in trash for the signed-in user. */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;

    await ensureOrganizedItemListOrderColumn(prisma);

    const result = await prisma.organizedItem.deleteMany({
      where: { userId, deletedAt: { not: null } },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (e) {
    console.error("purge-trash error:", e);
    const message = getDbErrorMessage(e) || "Failed to empty trash";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
