import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { ensureOrganizedItemListOrderColumn } from "@/lib/ensure-organized-item-schema";
import { withActiveOrganizedItems } from "@/lib/organized-item-scope";
import { maybeRecordSingleTaskCompletion } from "@/lib/gamification";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    await ensureOrganizedItemListOrderColumn(prisma);

    const { id } = await params;
    const item = await prisma.organizedItem.findUnique({
      where: { id, userId },
      include: { dump: true, project: true, tags: { include: { tag: true } } },
    });
    if (!item) return NextResponse.json({ error: "Item not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("Item GET error:", e);
    return NextResponse.json({ error: "Failed to fetch item" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    await ensureOrganizedItemListOrderColumn(prisma);

    const { id } = await params;
    const body = await request.json();
    const {
      domain,
      category,
      subcategory,
      projectId,
      itemType,
      title,
      content,
      emotionLabel,
      status,
      progress,
      priority,
      recommendedView,
      positionX,
      positionY,
      kanbanColumn,
      scheduledAt,
      scheduledTime,
      recurrence,
      sendNotification,
      reminderAt,
      reminderMinutesBefore,
      reminderNotifiedAt,
      reminderEarlyNotifiedAt,
      listOrder,
    } = body;

    const existing = await prisma.organizedItem.findFirst({
      where: withActiveOrganizedItems({ id, userId }),
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const nextProgress = progress !== undefined ? progress : existing.progress;
    const nextKanban = kanbanColumn !== undefined ? kanbanColumn : existing.kanbanColumn;
    const nextItemTypeRaw = itemType !== undefined ? itemType : existing.itemType;

    let resolvedItemType: string | undefined;
    if (itemType !== undefined && itemType !== "task" && itemType !== "task_completed") {
      resolvedItemType = itemType;
    } else if (nextItemTypeRaw === "task" || nextItemTypeRaw === "task_completed") {
      const completed = nextProgress === "completed" || nextKanban === "completed";
      resolvedItemType = completed ? "task_completed" : "task";
    }

    const shouldWriteItemType = resolvedItemType !== undefined && resolvedItemType !== existing.itemType;

    const beforeGamification = {
      itemType: existing.itemType,
      progress: existing.progress,
      kanbanColumn: existing.kanbanColumn,
    };

    const item = await prisma.organizedItem.update({
      where: { id, userId },
      data: {
        ...(domain !== undefined && { domain }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(projectId !== undefined && { projectId }),
        ...(shouldWriteItemType && resolvedItemType !== undefined && { itemType: resolvedItemType }),
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(emotionLabel !== undefined && { emotionLabel }),
        ...(status !== undefined && { status }),
        ...(progress !== undefined && { progress }),
        ...(priority !== undefined && { priority }),
        ...(recommendedView !== undefined && { recommendedView }),
        ...(positionX !== undefined && { positionX }),
        ...(positionY !== undefined && { positionY }),
        ...(kanbanColumn !== undefined && { kanbanColumn }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt === null ? null : new Date(scheduledAt) }),
        ...(scheduledTime !== undefined && { scheduledTime }),
        ...(recurrence !== undefined && { recurrence }),
        ...(sendNotification !== undefined && { sendNotification: Boolean(sendNotification) }),
        ...(reminderAt !== undefined && { reminderAt: reminderAt === null ? null : new Date(reminderAt) }),
        ...(reminderMinutesBefore !== undefined && { reminderMinutesBefore }),
        ...(reminderNotifiedAt !== undefined && { reminderNotifiedAt: reminderNotifiedAt === null ? null : new Date(reminderNotifiedAt) }),
        ...(reminderEarlyNotifiedAt !== undefined && { reminderEarlyNotifiedAt: reminderEarlyNotifiedAt === null ? null : new Date(reminderEarlyNotifiedAt) }),
        ...(listOrder !== undefined &&
          typeof listOrder === "number" &&
          Number.isFinite(listOrder) && { listOrder }),
      },
      include: { project: true, tags: { include: { tag: true } } },
    });
    let gamification = null;
    try {
      const afterGamification = {
        itemType: item.itemType,
        progress: item.progress,
        kanbanColumn: item.kanbanColumn,
      };
      gamification = await maybeRecordSingleTaskCompletion(prisma, userId, beforeGamification, afterGamification);
    } catch (geo) {
      console.warn("Gamification task completion:", geo);
    }
    return NextResponse.json({ item, ...(gamification ? { gamification } : {}) });
  } catch (e) {
    console.error("Item PATCH error:", e);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    await ensureOrganizedItemListOrderColumn(prisma);

    const { id } = await params;
    const permanent =
      request.nextUrl.searchParams.get("permanent") === "1" ||
      request.nextUrl.searchParams.get("permanent") === "true";

    const existing = await prisma.organizedItem.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (permanent) {
      if (existing.deletedAt == null) {
        return NextResponse.json({ error: "Move to trash before permanent delete" }, { status: 400 });
      }
      await prisma.organizedItem.delete({ where: { id, userId } });
      return NextResponse.json({ ok: true, permanent: true });
    }

    if (existing.deletedAt != null) {
      return NextResponse.json({ error: "Already in trash" }, { status: 400 });
    }

    await prisma.organizedItem.update({
      where: { id, userId },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true, trashed: true });
  } catch (e) {
    console.error("Item DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
