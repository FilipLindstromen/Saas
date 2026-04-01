import { NextRequest, NextResponse } from "next/server";
import { organizeTranscriptResilient } from "@/lib/organize-engine";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { resolveOpenAiApiKey } from "@/lib/resolve-openai-api-key";

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const transcript = typeof body.transcript === "string" ? body.transcript : "";
    const MAX_INBOUND = 450_000;
    if (transcript.length > MAX_INBOUND) {
      return NextResponse.json(
        { error: `Transcript too long (max ${MAX_INBOUND.toLocaleString()} characters).` },
        { status: 413 }
      );
    }
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;

    const keyRes = resolveOpenAiApiKey(userId);
    if (!keyRes.ok) {
      return NextResponse.json({ error: keyRes.error }, { status: keyRes.status });
    }
    const apiKey = keyRes.apiKey;

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
    const referenceLocalDateRaw = typeof body.referenceLocalDate === "string" ? body.referenceLocalDate.trim() : "";
    const referenceLocalDate = /^\d{4}-\d{2}-\d{2}$/.test(referenceLocalDateRaw) ? referenceLocalDateRaw : undefined;

    let existingCategories: string[] | undefined;
    if (userId && (defaultDomain === "work" || defaultDomain === "personal")) {
      const rows = await prisma.organizedItem.groupBy({
        by: ["category"],
        where: { domain: defaultDomain, userId, deletedAt: null },
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
      ...(referenceLocalDate ? { referenceLocalDate } : {}),
    };

    const result = await organizeTranscriptResilient(transcript, apiKey, options);
    const items = Array.isArray(result.items) ? result.items : [];
    const standaloneProjectCreations = Array.isArray(result.standaloneProjectCreations)
      ? result.standaloneProjectCreations
      : [];
    return NextResponse.json({ items, standaloneProjectCreations });
  } catch (e) {
    console.error("Organize error:", e);
    const message = e instanceof Error ? e.message : "Organization failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
