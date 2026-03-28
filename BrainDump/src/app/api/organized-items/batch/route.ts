import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";
import { resolveOrCreateProjectByName } from "@/lib/resolve-project-for-item";
import {
  dateOnlyToStartOfDay,
  localDateTimeToDate,
  normalizeReminderMinutesBefore,
} from "@/lib/calendar-schedule";
import { ensureOrganizedItemListOrderColumn } from "@/lib/ensure-organized-item-schema";

/**
 * POST /api/organized-items/batch
 * Body: { dumpId, items: [ { domain, category, subcategory, projectId?, item_type, title, content, ... } ] }
 * Creates multiple organized items and optionally ensures projects exist by name.
 */
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
      items,
      insertAfterItemId: insertAfterRaw,
      insertBeforeItemId: insertBeforeRaw,
    } = body as {
      dumpId: string;
      /** When splitting text view, new rows are ordered between this item and `insertBeforeItemId` (listOrder). */
      insertAfterItemId?: string | null;
      insertBeforeItemId?: string | null;
      items: Array<{
        domain: string;
        category: string;
        subcategory?: string;
        project_name?: string;
        /** Alternate keys from models — normalized server-side */
        project?: string;
        projectName?: string;
        projectId?: string;
        item_type: string;
        title: string;
        content?: string;
        emotion_label?: string;
        recommended_view?: string;
        confidence_score?: number;
        tags?: string[];
        scheduled_date?: string;
        scheduled_time?: string;
        task_due_date?: string;
        shopping_due_date?: string;
        recurrence?: string;
        send_notification?: boolean;
        reminder_minutes_before?: number;
      }>;
    };

    const dumpIdStr = typeof dumpId === "string" ? dumpId.trim() : "";
    if (!dumpIdStr || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "dumpId and non-empty items array required" },
        { status: 400 }
      );
    }

    const dump = await prisma.dump.findUnique({ where: { id: dumpIdStr, userId } });
    if (!dump) {
      return NextResponse.json(
        { error: "Dump not found. Create the dump first (e.g. POST /api/dumps)." },
        { status: 400 }
      );
    }

    await ensureOrganizedItemListOrderColumn(prisma);

    const insertAfterItemId =
      typeof insertAfterRaw === "string" && insertAfterRaw.trim() ? insertAfterRaw.trim() : null;
    const insertBeforeItemId =
      typeof insertBeforeRaw === "string" && insertBeforeRaw.trim() ? insertBeforeRaw.trim() : null;

    const createdIds: string[] = [];

    await prisma.$transaction(async (tx) => {
      // findFirst avoids aggregate + driver edge cases; same as min(listOrder) for this user
      const minRow = await tx.organizedItem.findFirst({
        where: { userId },
        orderBy: { listOrder: "asc" },
        select: { listOrder: true },
      });
      let nextListOrder = minRow?.listOrder ?? 0;

      const n = items.length;
      let insertListOrders: number[] | null = null;

      if (insertAfterItemId && n > 0) {
        const anchor = await tx.organizedItem.findFirst({
          where: { id: insertAfterItemId, userId },
          select: { listOrder: true, createdAt: true },
        });
        if (anchor) {
          let placed = false;
          if (
            insertBeforeItemId &&
            insertBeforeItemId !== insertAfterItemId
          ) {
            const beforeRow = await tx.organizedItem.findFirst({
              where: { id: insertBeforeItemId, userId },
              select: { listOrder: true, createdAt: true },
            });
            if (beforeRow) {
              const aLo = anchor.listOrder;
              const bLo = beforeRow.listOrder;
              const aT = anchor.createdAt.getTime();
              const bT = beforeRow.createdAt.getTime();
              const beforeIsAfterAnchor = bLo > aLo || (bLo === aLo && bT < aT);
              if (beforeIsAfterAnchor) {
                if (bLo > aLo) {
                  insertListOrders = Array.from(
                    { length: n },
                    (_, i) => aLo + ((bLo - aLo) * (i + 1)) / (n + 1)
                  );
                } else {
                  insertListOrders = Array.from({ length: n }, (_, i) => aLo + (i + 1) * 1e-6);
                }
                placed = true;
              }
            }
          }
          if (!placed) {
            insertListOrders = Array.from({ length: n }, (_, i) => anchor.listOrder + 1000 * (i + 1));
          }
        }
      }

      for (let idx = 0; idx < items.length; idx++) {
        const it = items[idx];
        const name =
          (typeof it.project_name === "string" && it.project_name.trim()) ||
          (typeof it.project === "string" && it.project.trim()) ||
          (typeof it.projectName === "string" && it.projectName.trim()) ||
          "";

        let projectId: string | null = it.projectId ?? null;

        if (name) {
          projectId = await resolveOrCreateProjectByName(
            tx,
            userId,
            name,
            String(it.domain ?? ""),
            String(it.category ?? "")
          );
        } else if (projectId) {
          const exists = await tx.project.findFirst({
            where: { id: projectId, userId },
          });
          if (!exists) projectId = null;
        }

        const itemTypeStr = String(it.item_type ?? "note");
        const isCalendar = itemTypeStr === "calendar";
        const isTaskLike = itemTypeStr === "task" || itemTypeStr === "task_completed";
        const isShopping = itemTypeStr === "shopping";
        const scheduledDateRaw =
          typeof it.scheduled_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.scheduled_date.trim())
            ? it.scheduled_date.trim()
            : undefined;
        const scheduledTimeRaw =
          typeof it.scheduled_time === "string" && /^\d{2}:\d{2}$/.test(it.scheduled_time.trim())
            ? it.scheduled_time.trim()
            : undefined;
        const scheduledAtDate = scheduledDateRaw ? dateOnlyToStartOfDay(scheduledDateRaw) : null;
        const recurrenceVal =
          it.recurrence && ["daily", "weekly", "monthly"].includes(it.recurrence) ? it.recurrence : null;
        const sendNotif = Boolean(it.send_notification);
        const rMin = normalizeReminderMinutesBefore(it.reminder_minutes_before);
        const eventStart =
          isCalendar && scheduledDateRaw
            ? localDateTimeToDate(scheduledDateRaw, scheduledTimeRaw || "09:00")
            : null;
        const reminderAtVal =
          isCalendar && sendNotif && eventStart ? eventStart : null;

        const taskDueFromScheduled =
          isTaskLike && scheduledAtDate != null ? scheduledAtDate : null;
        const shoppingDueFromScheduled =
          isShopping && scheduledAtDate != null ? scheduledAtDate : null;

        const taskDueRaw =
          typeof it.task_due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.task_due_date.trim())
            ? it.task_due_date.trim()
            : undefined;
        const shoppingDueRaw =
          typeof it.shopping_due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(it.shopping_due_date.trim())
            ? it.shopping_due_date.trim()
            : undefined;
        const taskDueFromField = taskDueRaw ? dateOnlyToStartOfDay(taskDueRaw) : null;
        const shoppingDueFromField = shoppingDueRaw ? dateOnlyToStartOfDay(shoppingDueRaw) : null;

        const effectiveTaskDue = isTaskLike ? taskDueFromScheduled ?? taskDueFromField : null;
        const effectiveShoppingDue = isShopping ? shoppingDueFromScheduled ?? shoppingDueFromField : null;
        const taskProgress = itemTypeStr === "task_completed" ? "completed" : "todo";
        const taskKanbanCol = itemTypeStr === "task_completed" ? "completed" : "todo";

        const listOrderForRow =
          insertListOrders != null ? insertListOrders[idx]! : (() => ((nextListOrder -= 1000), nextListOrder))();

        const item = await tx.organizedItem.create({
          data: {
            dumpId: dumpIdStr,
            userId,
            domain: String(it.domain ?? ""),
            category: String(it.category ?? ""),
            subcategory: String(it.subcategory ?? ""),
            ...(projectId != null ? { projectId } : {}),
            itemType: itemTypeStr,
            title: String(it.title ?? ""),
            content: String(it.content ?? ""),
            listOrder: listOrderForRow,
            emotionLabel: it.emotion_label != null && it.emotion_label !== "" ? String(it.emotion_label) : null,
            status: "draft",
            progress: taskProgress,
            recommendedView: String(it.recommended_view ?? "note_cards"),
            confidenceScore: typeof it.confidence_score === "number" ? it.confidence_score : 0.8,
            ...(isCalendar && scheduledAtDate != null && { scheduledAt: scheduledAtDate }),
            ...(isTaskLike && effectiveTaskDue != null && { scheduledAt: effectiveTaskDue }),
            ...(isTaskLike && { kanbanColumn: taskKanbanCol }),
            ...(isShopping && effectiveShoppingDue != null && { scheduledAt: effectiveShoppingDue }),
            ...(isCalendar && scheduledTimeRaw && { scheduledTime: scheduledTimeRaw }),
            ...(isTaskLike && scheduledTimeRaw && { scheduledTime: scheduledTimeRaw }),
            ...(isShopping && scheduledTimeRaw && { scheduledTime: scheduledTimeRaw }),
            ...(isCalendar && recurrenceVal && { recurrence: recurrenceVal }),
            ...(isCalendar && { sendNotification: sendNotif }),
            ...(isCalendar && sendNotif && reminderAtVal
              ? { reminderAt: reminderAtVal, reminderMinutesBefore: rMin }
              : {}),
          },
        });
        createdIds.push(item.id);

        if (Array.isArray(it.tags) && it.tags.length > 0) {
          for (const tagName of it.tags) {
            const tagLabel = String(tagName).trim();
            if (!tagLabel) continue;
            let tag = await tx.tag.findFirst({ where: { name: tagLabel, userId } });
            if (!tag) tag = await tx.tag.create({ data: { name: tagLabel, userId } });
            await tx.organizedItemTag.upsert({
              where: { itemId_tagId: { itemId: item.id, tagId: tag.id } },
              create: { itemId: item.id, tagId: tag.id },
              update: {},
            });
          }
        }
      }
    });

    const createdItems =
      createdIds.length === 0
        ? []
        : await prisma.organizedItem.findMany({
            where: { id: { in: createdIds } },
            include: {
              dump: { select: { id: true, mode: true, createdAt: true } },
              project: true,
              tags: { include: { tag: true } },
            },
          });
    const orderIndex = new Map(createdIds.map((id, i) => [id, i]));
    createdItems.sort((a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0));

    const created = createdItems.map((row) => ({ id: row.id, title: row.title }));

    return NextResponse.json({ created, createdItems, count: created.length });
  } catch (e) {
    console.error("Batch create organized items error:", e);
    const message = getDbErrorMessage(e) || "Failed to create items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
