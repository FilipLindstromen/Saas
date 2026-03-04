import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const signals = await prisma.signal.findMany({
      where: { flagged: false },
      orderBy: { signalScore: "desc" },
      take: 50,
    });
    return NextResponse.json({ signals });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
