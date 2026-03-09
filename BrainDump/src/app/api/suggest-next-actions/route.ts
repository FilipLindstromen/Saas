import { NextRequest, NextResponse } from "next/server";

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
    const items = (Array.isArray(body.items) ? body.items : []) as SuggestItem[];
    const clientKey = (body.apiKey && typeof body.apiKey === "string" ? body.apiKey : "").trim();
    const apiKey = process.env.OPENAI_API_KEY || clientKey;

    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Set OPENAI_API_KEY or provide apiKey in request body." },
        { status: 500 }
      );
    }

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

    const systemPrompt = `You are a focused productivity coach.

Given the user's current tasks, notes, calendar entries and ideas, suggest the next 1–3 concrete actions they should take.

Rules:
- Be specific and actionable (what to do next, not vague advice).
- Prefer short, clear titles (3–8 words) and a one-sentence reason.
- Prioritize time-bound items (calendar / deadlines) and tasks that move important projects forward.
- If everything is already complete or there is nothing actionable, return an empty list.

Return ONLY JSON with this shape:
{ "suggestions": [ { "title": string, "reason": string } ] }`;

    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Here are the user's current items:\n\n${summary}\n\nSuggest 1–3 next actions.`,
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

