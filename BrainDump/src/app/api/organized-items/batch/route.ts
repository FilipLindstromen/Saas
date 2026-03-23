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
    const { dumpId, items } = body as {
      dumpId: string;
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

    const created: Array<{ id: string; title: string }> = [];

    await prisma.$transaction(async (tx) => {
      for (const it of items) {
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

        const taskDueDate =
          isTaskLike && scheduledAtDate != null ? scheduledAtDate : null;
        const taskProgress = itemTypeStr === "task_completed" ? "completed" : "todo";
        const taskKanbanCol = itemTypeStr === "task_completed" ? "completed" : "todo";
        const shoppingDueDate =
          isShopping && scheduledAtDate != null ? scheduledAtDate : null;

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
            emotionLabel: it.emotion_label != null && it.emotion_label !== "" ? String(it.emotion_label) : null,
            status: "draft",
            progress: taskProgress,
            recommendedView: String(it.recommended_view ?? "note_cards"),
            confidenceScore: typeof it.confidence_score === "number" ? it.confidence_score : 0.8,
            ...(isCalendar && scheduledAtDate != null && { scheduledAt: scheduledAtDate }),
            ...(isTaskLike && taskDueDate != null && { scheduledAt: taskDueDate }),
            ...(isTaskLike && { kanbanColumn: taskKanbanCol }),
            ...(isShopping && shoppingDueDate != null && { scheduledAt: shoppingDueDate }),
            ...(isCalendar && scheduledTimeRaw && { scheduledTime: scheduledTimeRaw }),
            ...(isCalendar && recurrenceVal && { recurrence: recurrenceVal }),
            ...(isCalendar && { sendNotification: sendNotif }),
            ...(isCalendar && sendNotif && reminderAtVal
              ? { reminderAt: reminderAtVal, reminderMinutesBefore: rMin }
              : {}),
          },
        });
        created.push({ id: item.id, title: item.title });

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

    return NextResponse.json({ created, count: created.length });
  } catch (e) {
    console.error("Batch create organized items error:", e);
    const message = getDbErrorMessage(e) || "Failed to create items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
