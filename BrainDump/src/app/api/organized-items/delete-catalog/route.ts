import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";
import type { Prisma } from "../../../../../prisma/generated/prisma/client";

function completedTasksWhere(
  userId: string,
  domain?: "work" | "personal"
): Prisma.OrganizedItemWhereInput {
  const orClause: Prisma.OrganizedItemWhereInput[] = [
    { itemType: "task_completed" },
    { AND: [{ itemType: "task" }, { progress: "completed" }] },
    { AND: [{ itemType: "task" }, { kanbanColumn: "completed" }] },
  ];
  if (domain === "work" || domain === "personal") {
    return { userId, domain, OR: orClause };
  }
  return { userId, OR: orClause };
}

/**
 * Counts for the Delete entries overlay (bulk delete scopes only).
 */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;

    const [completedTasks, reflections, shopping, projects] = await Promise.all([
      prisma.organizedItem.count({ where: completedTasksWhere(userId) }),
      prisma.organizedItem.count({ where: { userId, itemType: "reflection" } }),
      prisma.organizedItem.count({ where: { userId, itemType: "shopping" } }),
      prisma.project.findMany({
        where: { userId },
        select: { id: true },
      }),
    ]);

    const projectCounts = await Promise.all(
      projects.map((p) =>
        prisma.organizedItem.count({ where: { userId, projectId: p.id } }).then((c) => c)
      )
    );
    const emptyProjectCount = projectCounts.filter((c) => c === 0).length;

    return NextResponse.json({
      completedTasks,
      reflections,
      shopping,
      emptyProjectCount,
    });
  } catch (e) {
    console.error("delete-catalog error:", e);
    const message = getDbErrorMessage(e) || "Failed to load delete catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
