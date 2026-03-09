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
    const userId = (session.user as { id?: string }).id;

    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode"); // inbox | work | personal
    const status = searchParams.get("status");

    const where: { userId: string; mode?: string; status?: string } = { userId: userId! };
    if (mode) where.mode = mode;
    if (status) where.status = status;

    const dumps = await prisma.dump.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        organizedItems: true,
      },
    });
    return NextResponse.json({ dumps });
  } catch (e) {
    console.error("Dumps GET error:", e);
    const message = getDbErrorMessage(e) || "Failed to fetch dumps";
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
    const { mode, transcriptRaw, transcriptEdited, status, audioUrl } = body;
    const safeMode = typeof mode === "string" && (mode === "inbox" || mode === "work" || mode === "personal") ? mode : "inbox";

    const dump = await prisma.dump.create({
      data: {
        userId,
        mode: safeMode,
        transcriptRaw: transcriptRaw ?? "",
        transcriptEdited: transcriptEdited ?? "",
        status: status ?? "draft",
        audioUrl: audioUrl ?? null,
      },
    });
    return NextResponse.json({ dump });
  } catch (e) {
    console.error("Dumps POST error:", e);
    const message = getDbErrorMessage(e) || "Failed to create dump";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
