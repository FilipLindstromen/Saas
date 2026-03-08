import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const item = await prisma.organizedItem.findUnique({
      where: { id },
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
    } = body;

    const item = await prisma.organizedItem.update({
      where: { id },
      data: {
        ...(domain !== undefined && { domain }),
        ...(category !== undefined && { category }),
        ...(subcategory !== undefined && { subcategory }),
        ...(projectId !== undefined && { projectId }),
        ...(itemType !== undefined && { itemType }),
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
      },
      include: { project: true, tags: { include: { tag: true } } },
    });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("Item PATCH error:", e);
    return NextResponse.json({ error: "Failed to update item" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.organizedItem.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Item DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete item" }, { status: 500 });
  }
}
