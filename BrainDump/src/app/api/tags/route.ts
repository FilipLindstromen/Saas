import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ tags });
  } catch (e) {
    console.error("Tags GET error:", e);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}
