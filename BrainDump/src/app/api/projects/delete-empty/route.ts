import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { auth } from "@/auth";

/** Delete all projects for the user that have no organized items (any domain). */
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const userId = (session.user as { id?: string }).id!;

    const result = await prisma.project.deleteMany({
      where: {
        userId,
        items: { none: {} },
      },
    });

    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    console.error("delete-empty projects error:", e);
    const message = getDbErrorMessage(e) || "Failed to delete empty projects";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
