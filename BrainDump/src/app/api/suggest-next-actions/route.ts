import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isPastScheduledForAiSuggestions } from "@/lib/calendar-schedule";
import { resolveOpenAiApiKey } from "@/lib/resolve-openai-api-key";

interface SuggestItem {
  title: string;
  content?: string;
  itemType?: string;
  progress?: string;
  scheduledAt?: string;
  scheduledTime?: string;
  recurrence?: string;
  project?: { id?: string; name?: string } | null;
}

export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const locale = body.locale === "sv" || body.locale === "en" ? body.locale : "en";
    const rawItems = (Array.isArray(body.items) ? body.items : []) as SuggestItem[];
    const items = rawItems.filter((it) => !isPastScheduledForAiSuggestions(it));
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const keyRes = resolveOpenAiApiKey(userId);
    if (!keyRes.ok) {
      return NextResponse.json({ error: keyRes.error }, { status: keyRes.status });
    }
    const apiKey = keyRes.apiKey;

    if (items.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    const OpenAI = (await import("openai")).default;
    const client = new OpenAI({ apiKey });

    const summary = items
      .map((it, idx) => {
        const title = it.title || "(untitled)";
        const content = (it.content ?? "").trim();
        const type = it.itemType || "note";
        const progress = it.progress || "";
        const schedule =
          (it.scheduledAt || it.scheduledTime || it.recurrence)
            ? `Scheduled: ${it.scheduledAt ?? ""} ${it.scheduledTime ?? ""} ${it.recurrence ?? ""}`.trim()
            : "";
        const project = it.project?.name ? `Project: ${it.project.name}` : "";
        const parts = [title, content, project, progress && `Progress: ${progress}`, schedule]
          .filter(Boolean)
          .join(" • ");
        return `${idx + 1}. [${type}] ${parts}`;
      })
      .join("\n");

    const systemPromptEn = `You are a focused productivity coach.

Given the user's current tasks, notes, calendar entries and ideas, suggest the next 1–3 priorities.

Each suggestion can be EITHER:
- A concrete next action (task to do), OR
- A short reflection / journaling prompt (a question to think or write about) when that would unlock clarity or closure.

Rules:
- Be specific; avoid generic advice ("be productive", "stay focused").
- "title": 3–10 words. "reason": one clear sentence (why this matters or what to focus on).
- Prefer time-bound items and work that moves important projects forward when actions fit; mix in 0–1 reflection prompts when emotions, decisions, or open loops suggest it.
- If everything is already complete or there is nothing useful to suggest, return an empty list.

Return ONLY JSON with this shape:
{ "suggestions": [ { "title": string, "reason": string } ] }`;

    const systemPromptSv = `Du är en fokuserad produktivitetscoach.

Utifrån användarens nuvarande uppgifter, anteckningar, kalenderposter och idéer: föreslå nästa 1–3 prioriteringar.

Varje förslag kan vara ANTINGEN:
- En konkret nästa åtgärd (något att göra), ELLER
- En kort reflektions-/dagboksuppmaning (en fråga att fundera eller skriva kring) när det skulle ge klarhet eller avslut.

Regler:
- Var specifik; undvik flummiga råd.
- "title": 3–10 ord. "reason": en tydlig mening.
- Prioritera tidsbundna poster och arbete som driver projekt när det passar; blanda in 0–1 reflektionsfrågor när känslor, beslut eller öppna loopar talar för det.
- Föreslå inte möten eller deadlines vars schemalagda tid redan har passerat.
- Om allt är klart eller inget är värdefullt att föreslå: returnera en tom lista.

Returnera ENDAST JSON med formen:
{ "suggestions": [ { "title": string, "reason": string } ] }`;

    const systemPrompt = locale === "sv" ? systemPromptSv : systemPromptEn;
    const userContent =
      locale === "sv"
        ? `Här är användarens poster:\n\n${summary}\n\nFöreslå 1–3 saker att göra eller reflektera kring. Skriv title och reason på svenska.`
        : `Here are the user's current items:\n\n${summary}\n\nSuggest 1–3 things to do or reflect on.`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: userContent,
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: "json_object" },
    });

    const text = response.choices?.[0]?.message?.content?.trim() ?? "";
    if (!text) {
      return NextResponse.json({ suggestions: [] });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json({ suggestions: [] });
    }

    const rawList = (parsed as { suggestions?: Array<{ title?: string; reason?: string }> }).suggestions ?? [];
    const suggestions = rawList
      .filter((s) => typeof s?.title === "string" && s.title.trim())
      .map((s) => ({
        title: s.title!.trim(),
        reason: typeof s.reason === "string" ? s.reason.trim() : "",
      }))
      .slice(0, 3);

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("Suggest next actions error:", e);
    const message = e instanceof Error ? e.message : "Failed to suggest next actions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

