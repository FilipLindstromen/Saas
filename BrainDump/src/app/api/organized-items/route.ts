import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;

    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");
    const category = searchParams.get("category");
    const itemType = searchParams.get("itemType");
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");
    const dumpId = searchParams.get("dumpId");

    const where: {
      userId: string;
      domain?: string;
      category?: string;
      itemType?: string;
      projectId?: string | null;
      status?: string;
      dumpId?: string;
    } = { userId };
    if (domain) where.domain = domain;
    if (category) where.category = category;
    if (itemType) where.itemType = itemType;
    if (projectId) where.projectId = projectId;
    if (status) where.status = status;
    if (dumpId) where.dumpId = dumpId;

    const items = await prisma.organizedItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        dump: { select: { id: true, mode: true, createdAt: true } },
        project: true,
        tags: { include: { tag: true } },
      },
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("Organized items GET error:", e);
    const message = getDbErrorMessage(e) || "Failed to fetch items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;

    const body = await request.json();
    const {
      dumpId,
      domain,
      category,
      subcategory,
      projectId,
      itemType,
      title,
      content,
      emotionLabel,
      status,
      priority,
      recommendedView,
      confidenceScore,
      tagIds,
      progress,
      kanbanColumn,
      scheduledAt,
      scheduledTime,
      recurrence,
      sendNotification,
    } = body;

    if (!dumpId || !domain || !category || !itemType || !title) {
      return NextResponse.json(
        { error: "Missing required fields: dumpId, domain, category, itemType, title" },
        { status: 400 }
      );
    }

    const item = await prisma.organizedItem.create({
      data: {
        dumpId,
        userId,
        domain,
        category: category ?? "",
        subcategory: subcategory ?? "",
        projectId: projectId ?? null,
        itemType,
        title,
        content: content ?? "",
        emotionLabel: emotionLabel ?? null,
        status: status ?? "draft",
        priority: priority ?? null,
        recommendedView: recommendedView ?? "note_cards",
        confidenceScore: typeof confidenceScore === "number" ? confidenceScore : 0,
        ...(progress !== undefined && { progress: progress ?? "todo" }),
        ...(kanbanColumn !== undefined && { kanbanColumn }),
        ...(scheduledAt !== undefined && { scheduledAt: scheduledAt === null || scheduledAt === "" ? null : new Date(scheduledAt) }),
        ...(scheduledTime !== undefined && { scheduledTime: scheduledTime ?? null }),
        ...(recurrence !== undefined && { recurrence: recurrence === null || recurrence === "none" ? null : recurrence }),
        ...(sendNotification !== undefined && { sendNotification: Boolean(sendNotification) }),
        tags: Array.isArray(tagIds) && tagIds.length > 0
          ? { create: tagIds.map((tagId: string) => ({ tagId })) }
          : undefined,
      },
      include: { project: true, tags: { include: { tag: true } } },
    });
    return NextResponse.json({ item });
  } catch (e) {
    console.error("Organized items POST error:", e);
    const message = getDbErrorMessage(e) || "Failed to create item";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
