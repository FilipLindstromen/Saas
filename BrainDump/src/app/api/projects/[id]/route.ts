import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    const { id } = await params;
    const body = await request.json();
    const { name, description, status } = body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const project = await prisma.project.update({
      where: { id, userId },
      data: {
        name: name.trim(),
        ...(description !== undefined && { description: String(description) }),
        ...(status !== undefined && { status: String(status) }),
      },
    });
    return NextResponse.json({ project });
  } catch (e) {
    console.error("Project PATCH error:", e);
    const message = getDbErrorMessage(e) || "Failed to update project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    const { id } = await params;
    await prisma.$transaction(async (tx) => {
      await tx.organizedItem.deleteMany({ where: { projectId: id, userId } });
      await tx.project.delete({ where: { id, userId } });
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Project DELETE error:", e);
    const message = getDbErrorMessage(e) || "Failed to delete project";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
