/**
 * Builds system and user prompts for OpenAI video question generation
 * Uses drop-in templates for non-generic, relatable, curiosity-driven output
 */

export interface GenerationSettings {
  audience: string;
  theme: string;
  tone: string[];
  format: string[];
  platform: string[];
  intensity: "soft" | "medium" | "direct";
  context?: string;
  numQuestions: number;
  generateHooks: boolean;
}

export interface SignalInput {
  title: string;
  selftext: string;
  permalink: string;
  comments?: string[];
  score?: number;
  numComments?: number;
}

// Allowed tags for questions (from app themes + common pain points)
const ALLOWED_TAGS = [
  "stress",
  "anxiety",
  "overthinking",
  "burnout",
  "people-pleasing",
  "motivation",
  "self-worth",
  "loneliness",
  "productivity guilt",
  "guilt",
  "rest",
  "avoidance",
  "doomscrolling",
  "perfectionism",
  "comparison",
  "boundaries",
  "sleep",
  "relationships",
  "work",
];

const SYSTEM_PROMPT = `You are an expert content strategist specializing in short-form video for personal development (stress, anxiety, overthinking, burnout, motivation, self-worth).

Your job: generate emotionally resonant, curiosity-driven VIDEO QUESTIONS and HOOKS based on real audience signals.

Hard rules:
- Output MUST be valid JSON only. No markdown, no extra text.
- Follow the provided JSON schema exactly.
- Do not include medical advice, diagnosis, or treatment instructions.
- Use supportive, non-clinical language.
- Avoid self-harm content. If any provided signals contain self-harm or suicidal ideation, do NOT use them; instead return an empty questions array and include a "safety_note" field explaining exclusion.
- Questions must feel like something a real person would say; avoid corporate/academic phrasing.
- Make each question specific and scenario-based. No generic "how to be happier" questions.
- Do not mention Reddit or any source explicitly in the questions/hooks.

Quality bar:
- Each question should create immediate self-recognition ("that's me") + curiosity ("oh… why is that?").
- Prefer "Why do I… / Is it normal… / Anyone else… / How do I stop…" structures.
- Write for a creator speaking directly to the viewer ("you") with empathy and clarity.`;

export function buildUserPrompt(
  settings: GenerationSettings,
  signals: SignalInput[]
): string {
  const signalsBlock = signals
    .slice(0, 20)
    .map((s, i) => {
      const commentSnippets = s.comments?.length
        ? s.comments
            .slice(0, 4)
            .map((c) => `- "${c.slice(0, 120)}${c.length > 120 ? "…" : ""}"`)
            .join("\n")
        : "";
      const engagement =
        s.score != null && s.numComments != null
          ? `Engagement: score ${s.score}, comments ${s.numComments}`
          : "";
      return `SIGNAL ${i + 1}:
Title: "${s.title}"
${s.selftext ? `Body: ${s.selftext.slice(0, 300)}${s.selftext.length > 300 ? "…" : ""}\n` : ""}${commentSnippets ? `Top comment snippets:\n${commentSnippets}\n` : ""}${engagement}`;
    })
    .join("\n\n");

  const intensityDesc =
    settings.intensity === "soft"
      ? "soft=gentle empathy"
      : settings.intensity === "direct"
        ? "direct=challenging truth"
        : "medium=balanced, honest but warm";

  const themeTags = [settings.theme, ...settings.format].filter(Boolean).join(", ");

  return `Generate ${settings.numQuestions} short-form video questions.

Context:
- Audience/persona: ${settings.audience || "people interested in personal development"}
- Primary theme: ${settings.theme}
- Secondary themes/tags: ${themeTags}
- Tone: ${settings.tone.join(", ") || "warm"}
- Format style: ${settings.format.join(", ") || "truth bomb"}
- Platform: ${settings.platform.join(", ") || "YouTube"}
- Intensity: ${intensityDesc}
- Optional situation/context: ${settings.context || "—"}

Requirements:
- Each question must be 8–16 words max (like a punchy video title).
- Each question must be anchored in a common real-life moment (work, relationships, sleep, phone scrolling, guilt, avoidance, etc).
- Avoid clinical terms (e.g., "generalized anxiety disorder", "diagnosis", "therapy modalities").
- Make the question feel intimate and spoken: "Why do I…" "Why can't I…" "Is it normal that…"
${settings.generateHooks ? `- For each question, generate 4 hooks:
  1) Pattern interrupt hook (contrarian or surprising)
  2) Validation hook ("You're not broken/lazy…")
  3) Curiosity hook ("The real reason is…")
  4) Scenario hook ("If you…")` : "- Do not include hooks."}

- Add 2–4 tags per question chosen from: ${ALLOWED_TAGS.join(", ")}

Signals (use these as inspiration; do not quote verbatim):
${signalsBlock}

Return JSON only using this exact structure:
{
  "safety_note": "",
  "questions": [
    {
      "question": "",
      "theme": "",
      "tags": [],
      "hooks": [],
      "why_it_works": ""
    }
  ]
}`;
}

/**
 * Build prompt for generating variations of a single question
 */
export function buildVariationPrompt(
  baseQuestion: string,
  settings: GenerationSettings,
  refineNotes?: string
): string {
  const intensityDesc =
    settings.intensity === "soft"
      ? "soft=gentle empathy"
      : settings.intensity === "direct"
        ? "direct=challenging truth"
        : "medium=balanced";

  return `Create ${settings.numQuestions} variations of the following question for short-form video.

Base question: "${baseQuestion}"

Constraints:
- Same theme: ${settings.theme}
- Same audience: ${settings.audience || "people interested in personal development"}
- Must stay specific and scenario-based.
- 8–16 words max.
- Do not repeat wording; each variation should feel distinct.
- Generate 4 hooks per variation using the same 4 hook types.
- Return JSON only in the same schema as before.

Optional extra direction from user:
${refineNotes || "—"}

Return JSON only using this exact structure:
{
  "safety_note": "",
  "questions": [
    {
      "question": "",
      "theme": "",
      "tags": [],
      "hooks": [],
      "why_it_works": ""
    }
  ]
}`;
}

/**
 * Build prompt for generating 8 hooks for a single question
 */
export function buildHooksOnlyPrompt(
  question: string,
  settings: GenerationSettings
): string {
  const intensityDesc =
    settings.intensity === "soft"
      ? "soft=gentle empathy"
      : settings.intensity === "direct"
        ? "direct=challenging truth"
        : "medium=balanced";

  return `Generate 8 short hooks for this question:
"${question}"

Tone: ${settings.tone.join(", ") || "warm"}
Platform: ${settings.platform.join(", ") || "YouTube"}
Intensity: ${intensityDesc}

Hook types to include (2 each):
- Pattern interrupt
- Validation ("you're not broken/lazy")
- Curiosity ("the real reason is…")
- Scenario ("If you…")

Return JSON only:
{
  "hooks": ["..."]
}`;
}

export { SYSTEM_PROMPT };
