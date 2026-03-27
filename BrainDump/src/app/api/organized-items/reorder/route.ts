import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";

/**
 * PATCH /api/organized-items/reorder
 * Body: { orderedIds: string[] } — full new order (ascending listOrder: index 0 = top).
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    const body = await request.json();
    const orderedIds = body?.orderedIds as unknown;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "orderedIds must be a non-empty array" }, { status: 400 });
    }
    const ids = orderedIds.filter((id): id is string => typeof id === "string" && id.length > 0);
    if (ids.length !== orderedIds.length || new Set(ids).size !== ids.length) {
      return NextResponse.json({ error: "orderedIds must be unique non-empty strings" }, { status: 400 });
    }

    const owned = await prisma.organizedItem.findMany({
      where: { userId, id: { in: ids } },
      select: { id: true },
    });
    if (owned.length !== ids.length) {
      return NextResponse.json({ error: "One or more items not found" }, { status: 403 });
    }

    const gap = 1000;
    await prisma.$transaction(
      ids.map((id, i) =>
        prisma.organizedItem.update({
          where: { id, userId },
          data: { listOrder: i * gap },
        })
      )
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Reorder error:", e);
    const message = getDbErrorMessage(e) || "Failed to reorder";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
