import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const raw = await prisma.signal.findMany({
      where: { flagged: false },
      orderBy: { signalScore: "desc" },
      take: 100,
    });
    // Dedupe by permalink (keep first = highest score)
    const seen = new Set<string>();
    const signals = raw.filter((s) => {
      if (seen.has(s.permalink)) return false;
      seen.add(s.permalink);
      return true;
    });
    return NextResponse.json({ signals: signals.slice(0, 50) });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch signals" },
      { status: 500 }
    );
  }
}
