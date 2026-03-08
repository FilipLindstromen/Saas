import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

/**
 * GET /api/organized-items/reminders
 * Returns items that have a reminder set (reminderAt not null), for the notification checker.
 */
export async function GET() {
  try {
    const items = await prisma.organizedItem.findMany({
      where: { reminderAt: { not: null } },
      select: {
        id: true,
        title: true,
        reminderAt: true,
        reminderMinutesBefore: true,
        reminderNotifiedAt: true,
        reminderEarlyNotifiedAt: true,
      },
    });
    return NextResponse.json({ items });
  } catch (e) {
    console.error("Reminders GET error:", e);
    const message = getDbErrorMessage(e) || "Failed to fetch reminders";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
