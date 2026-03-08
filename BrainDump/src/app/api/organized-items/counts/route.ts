import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

/**
 * GET /api/organized-items/counts?domain=work|personal&projectId=optional&category=optional
 * Returns counts per project, category, and itemType for the given scope (used to hide empty sections).
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get("domain");
    const projectId = searchParams.get("projectId");
    const category = searchParams.get("category");

    if (!domain || (domain !== "work" && domain !== "personal")) {
      return NextResponse.json(
        { error: "domain is required and must be 'work' or 'personal'" },
        { status: 400 }
      );
    }

    const where: { domain: string; projectId?: string | null; category?: string } = { domain };
    if (projectId != null && projectId !== "") where.projectId = projectId;
    if (category != null && category !== "") where.category = category;

    const [byProject, byCategory, byItemType] = await Promise.all([
      prisma.organizedItem.groupBy({
        by: ["projectId"],
        where: { domain },
        _count: { id: true },
      }),
      prisma.organizedItem.groupBy({
        by: ["category"],
        where,
        _count: { id: true },
      }),
      prisma.organizedItem.groupBy({
        by: ["itemType"],
        where,
        _count: { id: true },
      }),
    ]);

    const projectCounts: Record<string, number> = {};
    byProject.forEach((row) => {
      if (row.projectId != null) projectCounts[row.projectId] = row._count.id;
    });

    const categoryCounts: Record<string, number> = {};
    byCategory.forEach((row) => {
      categoryCounts[row.category] = row._count.id;
    });

    const itemTypeCounts: Record<string, number> = {};
    byItemType.forEach((row) => {
      itemTypeCounts[row.itemType] = row._count.id;
    });

    return NextResponse.json({
      projectCounts,
      categoryCounts,
      itemTypeCounts,
    });
  } catch (e) {
    console.error("Organized items counts GET error:", e);
    const message = getDbErrorMessage(e) || "Failed to fetch counts";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
