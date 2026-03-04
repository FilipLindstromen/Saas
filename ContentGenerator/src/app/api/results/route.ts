import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const results = await prisma.generatedResult.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        questions: r.questions,
        settings: r.settings,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    );
  }
}
