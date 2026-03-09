import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ tags: [] });
    }
    const userId = (session.user as { id?: string }).id!;

    const tags = await prisma.tag.findMany({
      where: { userId },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ tags });
  } catch (e) {
    console.error("Tags GET error:", e);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
