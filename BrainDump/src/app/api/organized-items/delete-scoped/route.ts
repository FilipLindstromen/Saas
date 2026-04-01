import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";
import type { Prisma } from "../../../../../prisma/generated/prisma/client";
import { withActiveOrganizedItems } from "@/lib/organized-item-scope";

type DomainFilter = "work" | "personal" | "all";

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

function allTasksWhere(userId: string, domain?: "work" | "personal"): Prisma.OrganizedItemWhereInput {
  const w: Prisma.OrganizedItemWhereInput = {
    userId,
    itemType: { in: ["task", "task_completed"] },
  };
  if (domain === "work" || domain === "personal") {
    w.domain = domain;
  }
  return w;
}

function parseDomainFilter(d: unknown): "work" | "personal" | undefined {
  if (d === "work" || d === "personal") return d;
  return undefined;
}

/**
 * POST body:
 * { dryRun?: boolean, scope: { type, ... } }
 *
 * scope types:
 * - { type: "everything" }
 * - { type: "domain", domain: "work" | "personal" }
 * - { type: "personal_category", category: string }
 * - { type: "work_category", category: string }
 * - { type: "project", projectId: string }
 * - { type: "item_type", itemType: string, domain?: "work" | "personal" | "all" }
 * - { type: "completed_tasks", domain?: "work" | "personal" | "all" }
 * - { type: "active_tasks", domain?: "work" | "personal" | "all" }
 * - { type: "all_tasks", domain?: "work" | "personal" | "all" }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;

    const body = await request.json();
    const dryRun = Boolean(body?.dryRun);
    const scope = body?.scope;

    if (!scope || typeof scope !== "object" || typeof scope.type !== "string") {
      return NextResponse.json({ error: "Invalid body: scope.type required" }, { status: 400 });
    }

    let where: Prisma.OrganizedItemWhereInput = { userId };

    switch (scope.type) {
      case "everything":
        where = { userId };
        break;
      case "domain": {
        const d = scope.domain;
        if (d !== "work" && d !== "personal") {
          return NextResponse.json({ error: "domain must be work or personal" }, { status: 400 });
        }
        where = { userId, domain: d };
        break;
      }
      case "personal_category": {
        const cat = typeof scope.category === "string" ? scope.category.trim() : "";
        if (!cat) return NextResponse.json({ error: "category required" }, { status: 400 });
        where = { userId, domain: "personal", category: cat };
        break;
      }
      case "work_category": {
        const cat = typeof scope.category === "string" ? scope.category.trim() : "";
        if (!cat) return NextResponse.json({ error: "category required" }, { status: 400 });
        where = { userId, domain: "work", category: cat };
        break;
      }
      case "project": {
        const pid = typeof scope.projectId === "string" ? scope.projectId.trim() : "";
        if (!pid) return NextResponse.json({ error: "projectId required" }, { status: 400 });
        const proj = await prisma.project.findFirst({ where: { id: pid, userId } });
        if (!proj) return NextResponse.json({ error: "Project not found" }, { status: 404 });
        where = { userId, projectId: pid };
        break;
      }
      case "item_type": {
        const it = typeof scope.itemType === "string" ? scope.itemType.trim() : "";
        if (!it) return NextResponse.json({ error: "itemType required" }, { status: 400 });
        const dom = scope.domain as DomainFilter;
        where = { userId, itemType: it };
        if (dom === "work" || dom === "personal") {
          where.domain = dom;
        }
        break;
      }
      case "completed_tasks": {
        const dom = parseDomainFilter(scope.domain);
        where = completedTasksWhere(userId, dom);
        break;
      }
      case "active_tasks": {
        const dom = parseDomainFilter(scope.domain);
        where = activeTasksWhere(userId, dom);
        break;
      }
      case "all_tasks": {
        const dom = parseDomainFilter(scope.domain);
        where = allTasksWhere(userId, dom);
        break;
      }
      default:
        return NextResponse.json({ error: "Unknown scope type" }, { status: 400 });
    }

    where = withActiveOrganizedItems(where);

    if (dryRun) {
      const count = await prisma.organizedItem.count({ where });
      return NextResponse.json({ ok: true, dryRun: true, count });
    }

    const result = await prisma.organizedItem.deleteMany({ where });
    return NextResponse.json({ ok: true, deleted: result.count });
  } catch (e) {
    console.error("delete-scoped error:", e);
    const message = getDbErrorMessage(e) || "Failed to delete entries";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
