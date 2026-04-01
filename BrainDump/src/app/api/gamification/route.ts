import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureUserGamification, snapshotFromRow } from "@/lib/gamification";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = (session.user as { id?: string }).id!;
    const row = await ensureUserGamification(prisma, userId);
    return NextResponse.json({ gamification: snapshotFromRow(row) });
  } catch (e) {
    console.error("Gamification GET error:", e);
    return NextResponse.json({ error: "Failed to load progress" }, { status: 500 });
  }
}
