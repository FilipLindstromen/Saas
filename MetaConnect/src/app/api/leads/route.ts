import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const take = Math.min(Number(searchParams.get("limit") ?? 100), 500);

  const leads = await prisma.lead.findMany({
    where: {
      project: { userId: session.user.id },
      ...(projectId ? { projectId } : {}),
    },
    include: { project: { select: { name: true, type: true } } },
    orderBy: { createdAt: "desc" },
    take,
  });

  return NextResponse.json(leads);
}
