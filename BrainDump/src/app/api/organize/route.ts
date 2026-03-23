import { NextRequest, NextResponse } from "next/server";
import { organizeTranscript } from "@/lib/organize-engine";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

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

    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    let mergedProjectNames: string[] = [];
    if (userId) {
      const dbProjects = await prisma.project.findMany({
        where: { userId, domain: "work" },
        select: { name: true },
        orderBy: { name: "asc" },
      });
      mergedProjectNames = dbProjects.map((p) => p.name);
    }
    const fromBody = Array.isArray(body.projectNames)
      ? body.projectNames
          .filter((p: unknown): p is string => typeof p === "string" && p.trim().length > 0)
          .map((p: string) => p.trim())
      : [];
    for (const n of fromBody) {
      if (!mergedProjectNames.some((x) => x.toLowerCase() === n.toLowerCase())) mergedProjectNames.push(n);
    }
    const projectNames = mergedProjectNames.length > 0 ? mergedProjectNames : undefined;
    const defaultDomain = body.defaultDomain === "work" || body.defaultDomain === "personal" ? body.defaultDomain : undefined;
    const customCategories = Array.isArray(body.customCategories) ? body.customCategories.filter((c: unknown) => typeof c === "string" && c.trim()) : undefined;
    const locale = body.locale === "sv" || body.locale === "en" ? body.locale : "en";
    const referenceIso = typeof body.referenceIso === "string" ? body.referenceIso.trim() : undefined;

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
      locale,
      ...(referenceIso ? { referenceIso } : {}),
    };

    const result = await organizeTranscript(transcript, apiKey, options);
    return NextResponse.json({
      items: result.items,
      standaloneProjectCreations: result.standaloneProjectCreations,
    });
  } catch (e) {
    console.error("Organize error:", e);
    const message = e instanceof Error ? e.message : "Organization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
