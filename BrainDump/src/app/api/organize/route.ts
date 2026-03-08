import { NextRequest, NextResponse } from "next/server";
import { organizeTranscript } from "@/lib/organize-engine";
import { prisma } from "@/lib/db";

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const clientKey = (body.apiKey && typeof body.apiKey === "string" ? body.apiKey : "").trim();
    const apiKey = process.env.OPENAI_API_KEY || clientKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Set OPENAI_API_KEY." },
        { status: 500 }
      );
    }
    const projectNames = Array.isArray(body.projectNames) ? body.projectNames.filter((p: unknown) => typeof p === "string") : undefined;
    const defaultDomain = body.defaultDomain === "work" || body.defaultDomain === "personal" ? body.defaultDomain : undefined;
    const customCategories = Array.isArray(body.customCategories) ? body.customCategories.filter((c: unknown) => typeof c === "string" && c.trim()) : undefined;

    let existingCategories: string[] | undefined;
    if (defaultDomain === "work" || defaultDomain === "personal") {
      const rows = await prisma.organizedItem.groupBy({
        by: ["category"],
        where: { domain: defaultDomain },
      });
      existingCategories = rows.map((r) => r.category).filter(Boolean);
    }

    const options = {
      projectNames,
      defaultDomain: defaultDomain ?? null,
      existingCategories,
      customCategories,
    };

    const items = await organizeTranscript(transcript, apiKey, options);
    return NextResponse.json({ items });
  } catch (e) {
    console.error("Organize error:", e);
    const message = e instanceof Error ? e.message : "Organization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
