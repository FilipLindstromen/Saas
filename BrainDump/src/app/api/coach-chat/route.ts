import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";
import { resolveOpenAiApiKey } from "@/lib/resolve-openai-api-key";
import { coachModeStyleInstruction, parseCoachMode } from "@/lib/coach-modes";
import { ensureOrganizedItemListOrderColumn } from "@/lib/ensure-organized-item-list-order";
import {
  getAiInstructionOverrides,
  resolveCoachSystemPromptBase,
} from "@/lib/ai-instructions";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ITEMS = 280;
const MAX_DUMP_SNIPPETS = 8;
const CONTENT_MAX = 380;
const CONTEXT_CHAR_BUDGET = 95_000;

type ChatTurn = { role: "user" | "assistant"; content: string };

function formatItemsForCoach(
  items: Awaited<ReturnType<typeof loadOrganizedItemsForCoach>>
): string {
  const lines: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i]!;
    const tags = it.tags.map((x) => x.tag.name).filter(Boolean).join(", ");
    const content = (it.content ?? "").replace(/\s+/g, " ").trim();
    const contentShort = content.length > CONTENT_MAX ? `${content.slice(0, CONTENT_MAX)}…` : content;
    const sched =
      it.scheduledAt != null
        ? new Date(it.scheduledAt).toISOString().replace("T", " ").slice(0, 16)
        : "";
    const parts = [
      `${i + 1}. [${it.domain}] [${it.itemType}] ${it.title}`,
      contentShort || undefined,
      it.project?.name ? `project: ${it.project.name}` : undefined,
      it.category ? `area: ${it.category}` : undefined,
      tags ? `tags: ${tags}` : undefined,
      it.progress && it.progress !== "todo" ? `progress: ${it.progress}` : undefined,
      it.kanbanColumn ? `column: ${it.kanbanColumn}` : undefined,
      sched ? `scheduled: ${sched}` : undefined,
      it.scheduledTime ? `time: ${it.scheduledTime}` : undefined,
      it.emotionLabel ? `emotion: ${it.emotionLabel}` : undefined,
    ].filter(Boolean);
    lines.push(parts.join(" | "));
  }
  let out = lines.join("\n");
  if (out.length > CONTEXT_CHAR_BUDGET) {
    out = `${out.slice(0, CONTEXT_CHAR_BUDGET)}\n… (trimmed; workspace is larger)`;
  }
  return out;
}

function formatDumpsForCoach(
  dumps: Awaited<ReturnType<typeof loadRecentDumpsForCoach>>
): string {
  const lines: string[] = [];
  for (const d of dumps) {
    const raw = (d.transcriptEdited || "").replace(/\s+/g, " ").trim();
    if (!raw) continue;
    const snippet = raw.length > 900 ? `${raw.slice(0, 900)}…` : raw;
    const when = new Date(d.createdAt).toISOString().slice(0, 10);
    lines.push(`- (${d.mode}, ${when}): ${snippet}`);
  }
  return lines.join("\n");
}

async function loadOrganizedItemsForCoach(userId: string) {
  return prisma.organizedItem.findMany({
    where: { userId, deletedAt: null },
    orderBy: [{ updatedAt: "desc" }],
    take: MAX_ITEMS,
    include: {
      project: { select: { name: true } },
      tags: { include: { tag: { select: { name: true } } } },
    },
  });
}

async function loadRecentDumpsForCoach(userId: string) {
  return prisma.dump.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: MAX_DUMP_SNIPPETS,
    select: { mode: true, transcriptEdited: true, createdAt: true },
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await ensureOrganizedItemListOrderColumn(prisma);
    const keyRes = resolveOpenAiApiKey(userId);
    if (!keyRes.ok) {
      return NextResponse.json({ error: keyRes.error }, { status: keyRes.status });
    }

    const body = (await request.json()) as {
      messages?: unknown;
      locale?: string;
      coachMode?: unknown;
    };

    const rawMessages = Array.isArray(body.messages) ? body.messages : [];
    const turns: ChatTurn[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const rec = m as Record<string, unknown>;
      const role = rec.role;
      const content = rec.content;
      if (role !== "user" && role !== "assistant") continue;
      if (typeof content !== "string" || !content.trim()) continue;
      const trimmed = content.trim().slice(0, 12_000);
      turns.push({ role, content: trimmed });
      if (turns.length >= 32) break;
    }

    if (turns.length === 0 || turns[turns.length - 1]!.role !== "user") {
      return NextResponse.json({ error: "Last message must be a non-empty user message." }, { status: 400 });
    }

    const locale = body.locale === "sv" ? "sv" : "en";
    const coachMode = parseCoachMode(body.coachMode);
    const styleBlock = coachModeStyleInstruction(coachMode);
    const replyLang =
      locale === "sv"
        ? "Svara på svenska när användaren skriver på svenska; annars på engelska."
        : "Reply in English when the user writes in English, or in Swedish when they write in Swedish.";

    const [items, dumps] = await Promise.all([
      loadOrganizedItemsForCoach(userId),
      loadRecentDumpsForCoach(userId),
    ]);

    const itemsBlock = items.length ? formatItemsForCoach(items) : "(No saved organized items yet.)";
    const dumpsBlock = formatDumpsForCoach(dumps);
    const dumpsSection = dumpsBlock
      ? `\n\n### Recent brain-dump transcripts (may overlap with items)\n${dumpsBlock}`
      : "";

    const aiOverrides = await getAiInstructionOverrides();
    const coachBase = resolveCoachSystemPromptBase(aiOverrides).replace(
      /\{\{REPLY_LANG\}\}/g,
      replyLang
    );

    const system = `${coachBase}

${styleBlock}

### Workspace snapshot (${items.length} items)
${itemsBlock}${dumpsSection}`;

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey: keyRes.apiKey });

    const apiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: system },
      ...turns.map((t) => ({ role: t.role, content: t.content })),
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: apiMessages,
      temperature: 0.55,
      max_tokens: 1600,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ error: "Empty coach response." }, { status: 502 });
    }

    return NextResponse.json({ message: text });
  } catch (e) {
    console.error("coach-chat error:", e);
    const message = getDbErrorMessage(e) || (e instanceof Error ? e.message : "Coach request failed");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
