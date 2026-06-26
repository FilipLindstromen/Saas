import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [metaPages, systemeioConnection] = await Promise.all([
    prisma.metaConnection.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "asc" },
    }),
    prisma.systemeioConnection.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    }),
  ]);

  return NextResponse.json({ metaPages, systemeioConnection });
}
