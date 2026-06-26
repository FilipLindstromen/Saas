import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const pageId = searchParams.get("pageId");
  if (!pageId) {
    return NextResponse.json({ error: "pageId required" }, { status: 400 });
  }

  await prisma.metaConnection.deleteMany({
    where: { userId: session.user.id, pageId },
  });

  return NextResponse.json({ ok: true });
}
