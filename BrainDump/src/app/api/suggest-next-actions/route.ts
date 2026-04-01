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
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const keyRes = resolveOpenAiApiKey(userId);
    if (!keyRes.ok) {
      return NextResponse.json({ error: keyRes.error }, { status: keyRes.status });
    }
    const apiKey = keyRes.apiKey;

    const body = await request.json();
    const locale = body.locale === "sv" || body.locale === "en" ? body.locale : "en";
    const rawItems = (Array.isArray(body.items) ? body.items : []) as SuggestItem[];
    const items = rawItems.filter((it) => !isPastScheduledForAiSuggestions(it));

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

    const systemPromptEn = `You are a warm, skilled coach helping the user with BOTH todos and reflection—but your primary aim is mental clarity and relief, not hustle.

Given their current tasks, notes, calendar entries, and ideas, propose up to **5** focused suggestions (fewer only if there truly isn't enough to work with).

Each suggestion is EITHER:
- A concrete next action (something specific to do), OR
- A short reflection / journaling prompt (one thoughtful question) when that would clear fog, process emotion, or close a mental loop.

Coaching stance:
- Help **clear the mind**: reduce overwhelm; name what matters; knock down noisy open loops where you can.
- Put **what matters most** (impact, deadlines, commitments they care about) toward the top of your list—without shaming.
- Lean toward **relief**: lighter steps, boundaries, self-care tied to real context, or reflection that helps them breathe when items hint at stress, guilt, or overload.
- Sound supportive and human—never preachy, toxic positivity, or guilt-tripping.

Rules:
- Return **at most 5** suggestions; order them from most helpful “right now” to least (still valuable).
- Be specific; avoid generic fluff ("be productive", "you got this" with no tie to their items).
- "title": 3–12 words. "reason": one clear sentence linking to *why* this helps clarity, priority, or relief (not just restating the title).
- Mix actions and reflections as fits their list (e.g. several concrete todos plus 1–2 reflection prompts when emotions, decisions, or stuck-ness show up).
- If everything is done or there is nothing genuinely useful, return an empty list.

Return ONLY JSON:
{ "suggestions": [ { "title": string, "reason": string } ] }`;

    const systemPromptSv = `Du är en varm, skicklig coach som hjälper användaren med både uppgifter och reflektion—men ditt främsta mål är **mental klarhet och lättnad**, inte stress.

Utifrån deras uppgifter, anteckningar, kalenderposter och idéer: föreslå upp till **5** fokuserade förslag (färre bara om det verkligen inte finns tillräckligt att jobba med).

Varje förslag är ANTINGEN:
- En konkret nästa åtgärd (något specifikt att göra), ELLER
- En kort reflektions-/dagboksuppmaning (en genomtänkt fråga) när det skulle rensa dimma, bearbeta känsla eller stänga en mental öppen loop.

Coachande hållning:
- Hjälp att **rensa huvudet**: minska överväldigande; peka ut det som spelar roll; gör bråkiga öppna loopar mindre krävande när du kan.
- Lägg **det viktigaste först** (påverkan, deadlines, åtaganden de bryr sig om)—utan skam.
- Luta åt **lättnad**: mindre steg, gränser, återhämtning kopplad till kontext, eller reflektion som hjälper när posterna antyder stress, skuld eller överlast.
- Var stöttande och mänsklig—inte predikande, toxisk positivitet eller skuld.

Regler:
- **Max 5** förslag; ordna från mest hjälpsamt *just nu* till minst (fortfarande värdefullt).
- Var specifik; undvik tomma floskler.
- "title": 3–12 ord. "reason": en tydlig mening som kopplar till *varför* det hjälper klarhet, prioritering eller lättnad.
- Blanda åtgärder och reflektion efter listan (t.ex. flera konkreta uppgifter plus 1–2 reflektionsfrågor när känslor, beslut eller känsla av att fastna syns).
- Föreslå inte möten eller deadlines vars tid redan passerats (användarens lista kan redan vara filtrerad).
- Om allt är klart eller inget är meningsfullt: returnera en tom lista.

Returnera ENDAST JSON:
{ "suggestions": [ { "title": string, "reason": string } ] }`;

    const systemPrompt = locale === "sv" ? systemPromptSv : systemPromptEn;
    const userContent =
      locale === "sv"
        ? `Här är användarens poster:\n\n${summary}\n\nGe upp till 5 coachande förslag (anteckning eller reflektion). Skriv title och reason på svenska.`
        : `Here are the user's current items:\n\n${summary}\n\nGive up to 5 coaching suggestions (to-do or reflection).`;

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
      max_tokens: 900,
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
      .slice(0, 5);

    return NextResponse.json({ suggestions });
  } catch (e) {
    console.error("Suggest next actions error:", e);
    const message = e instanceof Error ? e.message : "Failed to suggest next actions";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

