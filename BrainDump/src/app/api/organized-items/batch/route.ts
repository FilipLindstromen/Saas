import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

/**
 * POST /api/organized-items/batch
 * Body: { dumpId, items: [ { domain, category, subcategory, projectId?, item_type, title, content, ... } ] }
 * Creates multiple organized items and optionally ensures projects exist by name.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { dumpId, items } = body as {
      dumpId: string;
      items: Array<{
        domain: string;
        category: string;
        subcategory?: string;
        project_name?: string;
        projectId?: string;
        item_type: string;
        title: string;
        content?: string;
        emotion_label?: string;
        recommended_view?: string;
        confidence_score?: number;
        tags?: string[];
      }>;
    };

    if (!dumpId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "dumpId and non-empty items array required" },
        { status: 400 }
      );
    }

    const created: Array<{ id: string; title: string }> = [];

    for (const it of items) {
      let projectId: string | null = it.projectId ?? null;
      if (it.project_name && !projectId) {
        const domain = it.domain === "work" ? "work" : "personal";
        const existing = await prisma.project.findFirst({
          where: { name: it.project_name, domain },
        });
        if (existing) projectId = existing.id;
        else {
          const proj = await prisma.project.create({
            data: { name: it.project_name, domain, status: "active" },
          });
          projectId = proj.id;
        }
      }

      const item = await prisma.organizedItem.create({
        data: {
          dumpId,
          domain: it.domain,
          category: it.category ?? "",
          subcategory: it.subcategory ?? "",
          projectId,
          itemType: it.item_type,
          title: it.title,
          content: it.content ?? "",
          emotionLabel: it.emotion_label ?? null,
          status: "draft",
          recommendedView: it.recommended_view ?? "note_cards",
          confidenceScore: typeof it.confidence_score === "number" ? it.confidence_score : 0.8,
        },
      });
      created.push({ id: item.id, title: item.title });

      if (Array.isArray(it.tags) && it.tags.length > 0) {
        for (const tagName of it.tags) {
          const name = String(tagName).trim();
          if (!name) continue;
          let tag = await prisma.tag.findUnique({ where: { name } });
          if (!tag) tag = await prisma.tag.create({ data: { name } });
          await prisma.organizedItemTag.upsert({
            where: { itemId_tagId: { itemId: item.id, tagId: tag.id } },
            create: { itemId: item.id, tagId: tag.id },
            update: {},
          });
        }
      }
    }

    return NextResponse.json({ created, count: created.length });
  } catch (e) {
    console.error("Batch create organized items error:", e);
    const message = getDbErrorMessage(e) || "Failed to create items";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
