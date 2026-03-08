import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const dump = await prisma.dump.findUnique({
      where: { id },
      include: { organizedItems: { include: { tags: { include: { tag: true } }, project: true } } },
    });
    if (!dump) return NextResponse.json({ error: "Dump not found" }, { status: 404 });
    return NextResponse.json({ dump });
  } catch (e) {
    console.error("Dump GET error:", e);
    return NextResponse.json({ error: "Failed to fetch dump" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { mode, transcriptRaw, transcriptEdited, status, audioUrl, organizedAt } = body;

    const dump = await prisma.dump.update({
      where: { id },
      data: {
        ...(mode !== undefined && { mode }),
        ...(transcriptRaw !== undefined && { transcriptRaw }),
        ...(transcriptEdited !== undefined && { transcriptEdited }),
        ...(status !== undefined && { status }),
        ...(audioUrl !== undefined && { audioUrl }),
        ...(organizedAt !== undefined && { organizedAt }),
      },
    });
    return NextResponse.json({ dump });
  } catch (e) {
    console.error("Dump PATCH error:", e);
    return NextResponse.json({ error: "Failed to update dump" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.dump.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Dump DELETE error:", e);
    return NextResponse.json({ error: "Failed to delete dump" }, { status: 500 });
  }
}
