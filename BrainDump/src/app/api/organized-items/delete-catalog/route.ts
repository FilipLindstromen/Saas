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

function activeTasksWhere(
  userId: string,
  domain?: "work" | "personal"
): Prisma.OrganizedItemWhereInput {
  const base: Prisma.OrganizedItemWhereInput = {
    userId,
    itemType: "task",
    NOT: {
      OR: [{ progress: "completed" }, { kanbanColumn: "completed" }],
    },
  };
  if (domain === "work" || domain === "personal") {
    return { ...base, domain };
  }
  return base;
}

/** Catalog of deletable scopes for the settings UI (counts only). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;

    const [
      totalAll,
      totalWork,
      totalPersonal,
      projects,
      workByCategory,
      personalByCategory,
      workByType,
      personalByType,
      completedAll,
      completedWork,
      completedPersonal,
      activeAll,
      activeWork,
      activePersonal,
      allTasksAll,
      allTasksWork,
      allTasksPersonal,
    ] = await Promise.all([
      prisma.organizedItem.count({ where: { userId } }),
      prisma.organizedItem.count({ where: { userId, domain: "work" } }),
      prisma.organizedItem.count({ where: { userId, domain: "personal" } }),
      prisma.project.findMany({
        where: { userId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, domain: true },
      }),
      prisma.organizedItem.groupBy({
        by: ["category"],
        where: { userId, domain: "work" },
        _count: { id: true },
      }),
      prisma.organizedItem.groupBy({
        by: ["category"],
        where: { userId, domain: "personal" },
        _count: { id: true },
      }),
      prisma.organizedItem.groupBy({
        by: ["itemType"],
        where: { userId, domain: "work" },
        _count: { id: true },
      }),
      prisma.organizedItem.groupBy({
        by: ["itemType"],
        where: { userId, domain: "personal" },
        _count: { id: true },
      }),
      prisma.organizedItem.count({ where: completedTasksWhere(userId) }),
      prisma.organizedItem.count({ where: completedTasksWhere(userId, "work") }),
      prisma.organizedItem.count({ where: completedTasksWhere(userId, "personal") }),
      prisma.organizedItem.count({ where: activeTasksWhere(userId) }),
      prisma.organizedItem.count({ where: activeTasksWhere(userId, "work") }),
      prisma.organizedItem.count({ where: activeTasksWhere(userId, "personal") }),
      prisma.organizedItem.count({
        where: { userId, itemType: { in: ["task", "task_completed"] } },
      }),
      prisma.organizedItem.count({
        where: { userId, domain: "work", itemType: { in: ["task", "task_completed"] } },
      }),
      prisma.organizedItem.count({
        where: { userId, domain: "personal", itemType: { in: ["task", "task_completed"] } },
      }),
    ]);

    const projectCounts = await Promise.all(
      projects.map((p) =>
        prisma.organizedItem.count({ where: { userId, projectId: p.id } }).then((c) => ({
          ...p,
          count: c,
        }))
      )
    );

    const emptyProjectCount = projectCounts.filter((p) => p.count === 0).length;

    return NextResponse.json({
      totals: { all: totalAll, work: totalWork, personal: totalPersonal },
      completedTasks: { all: completedAll, work: completedWork, personal: completedPersonal },
      activeTasks: { all: activeAll, work: activeWork, personal: activePersonal },
      allTasks: { all: allTasksAll, work: allTasksWork, personal: allTasksPersonal },
      emptyProjectCount,
      projects: projectCounts.filter((p) => p.count > 0),
      workCategories: workByCategory
        .filter((r) => r.category && String(r.category).trim())
        .map((r) => ({ category: r.category as string, count: r._count.id })),
      personalCategories: personalByCategory
        .filter((r) => r.category && String(r.category).trim())
        .map((r) => ({ category: r.category as string, count: r._count.id })),
      itemTypesWork: Object.fromEntries(workByType.map((r) => [r.itemType, r._count.id])),
      itemTypesPersonal: Object.fromEntries(personalByType.map((r) => [r.itemType, r._count.id])),
    });
  } catch (e) {
    console.error("delete-catalog error:", e);
    const message = getDbErrorMessage(e) || "Failed to load delete catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
