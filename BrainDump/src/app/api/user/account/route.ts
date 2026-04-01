import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

export async function DELETE() {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/user/account:", e);
    const message = getDbErrorMessage(e) || "Failed to delete account";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
