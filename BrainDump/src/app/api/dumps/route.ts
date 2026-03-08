import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode"); // inbox | work | personal
    const status = searchParams.get("status");

    const where: { mode?: string; status?: string } = {};
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
    const body = await request.json();
    const { mode, transcriptRaw, transcriptEdited, status, audioUrl } = body;

    const dump = await prisma.dump.create({
      data: {
        mode: mode ?? "inbox",
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
