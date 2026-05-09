import hookTransformInstructions from "@/data/hook-transform-instructions.json";

type Instructions = typeof hookTransformInstructions;
export type AppLanguage = "English" | "Swedish";

export type HookVariation = {
  text: string;
  score: number;
  performanceScore: number;
  performanceReason: string;
  reasons: string[];
  improveTip: string;
  source?: string;
};

export type GenerateHooksInput = {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  hook: string;
  platform: string;
  stylePreset: string;
  curiosityLevel?: number;
  useContrarianHook?: boolean;
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
  uniquePerspective?: string;
  instructions: Instructions;
};

type ChatChoices = { choices?: { message?: { content?: string } }[] };

async function requestJson<T>(apiKey: string, messages: { role: "system" | "user"; content: string }[]): Promise<T> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages,
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error: ${response.status}`);
  }

  const body = (await response.json()) as ChatChoices;
  const raw = body.choices?.[0]?.message?.content?.trim() ?? "";
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Could not parse model response as JSON.");
  }
}

function languageDirective(language?: AppLanguage): string {
  return `Output language: ${language ?? "English"}. Write all generated text in this language.`;
}

function buildInstructionBlock(data: Instructions): string {
  return [
    `Framework title: ${data.title}`,
    `Goal: ${data.summary}`,
    "Rules:",
    ...data.rules.map((r, i) => `${i + 1}. ${r}`),
    "",
    "Illustrative example (tone and density only—do not repeat this hook unless the user supplied it):",
    `Target audience: ${data.example.targetAudience}`,
    `Original: ${data.example.originalHook}`,
    `Strong transform: ${data.example.goodTransform}`,
    "",
    "Patterns to avoid:",
    ...data.badPatternsToAvoid.map((p) => `- ${p}`),
  ].join("\n");
}

function normalizeHooks(hooks: unknown): HookVariation[] {
  if (!Array.isArray(hooks)) return [];
  return hooks
    .map((item) => {
      const row = item as { text?: unknown; score?: unknown; reasons?: unknown; improveTip?: unknown; source?: unknown };
      const reasons = Array.isArray(row.reasons) ? row.reasons.map((v) => String(v).trim()).filter(Boolean) : [];
      const scoreNumber = Number(row.score);
      const performanceScoreNumber = Number((item as { performanceScore?: unknown }).performanceScore);
      const improveTip = String(row.improveTip ?? "").trim();
      const performanceReason = String((item as { performanceReason?: unknown }).performanceReason ?? "").trim();
      const rawText = String(row.text ?? "").trim();
      const match = rawText.match(/^\[([^\]]+)\]\s*/);
      const parsedSource = typeof row.source === "string" ? row.source.trim() : "";
      const source = parsedSource || (match ? match[1].trim() : "");
      const text = match ? rawText.replace(/^\[[^\]]+\]\s*/, "").trim() : rawText;
      return {
        text,
        score: Number.isFinite(scoreNumber) ? Math.max(0, Math.min(100, Math.round(scoreNumber))) : 0,
        performanceScore: Number.isFinite(performanceScoreNumber)
          ? Math.max(0, Math.min(100, Math.round(performanceScoreNumber)))
          : (Number.isFinite(scoreNumber) ? Math.max(0, Math.min(100, Math.round(scoreNumber))) : 0),
        performanceReason: performanceReason || "Strong situational relevance and clear emotional payoff can improve retention.",
        reasons: reasons.slice(0, 3),
        improveTip: improveTip || "Add a more specific situation detail to make it feel even more real.",
        source: source || undefined,
      };
    })
    .filter((item) => item.text.length > 0);
}

/** Labels match the Variants view columns (3 hooks each, 15 total). */
export const HOOK_COLUMN_LABELS = [
  "Ask a question Hook",
  "Story hook",
  "Negative hook",
  "Contrarian view",
  "Numbered list",
] as const;

const HOOK_BUILD_GUIDANCE = [
  "Hook quality rules (must follow):",
  "- Open a curiosity gap without closing it in the same sentence.",
  "- Be immediate: the tension must land in the first sentence.",
  "- Speak to what the audience already feels in their real day-to-day context.",
  "- Do not be vague, generic, or broad. Be specific to the provided audience, topic, and situation.",
  "",
  "Type-specific build rules:",
  "- Ask a question Hook: Ask a specific high-tension question the viewer feels compelled to mentally answer.",
  "  Bad pattern: broad beginner question like 'How do you grow...?'",
  "  Good pattern: specific contrast/oddity question like 'How can X happen when Y is true?'",
  "- Story hook: Start with a strong story premise or provocative observation, not rambling setup.",
  "  Bad pattern: 'So basically I was...' / meandering preamble.",
  "  Good pattern: immediate claim that implies a story resolution is coming.",
  "- Negative hook: Use loss-avoidance and urgency with 'don't / never / before you...' framing.",
  "  Bad pattern: weak moral phrasing like 'why you shouldn't be inconsistent'.",
  "  Good pattern: concrete downside + unresolved fix, e.g. 'Never do X before Y'.",
  "- Contrarian view: State the opposite of common belief in a way that forces agreement/disagreement.",
  "  Bad pattern: soft generic contrarian line with no stakes.",
  "  Good pattern: sharp conflict against common advice with clear stakes.",
  "- Numbered list: Promise a specific transformation/outcome and imply high-value items are inside.",
  "  Bad pattern: generic list title like '5 ways to...'.",
  "  Good pattern: curiosity-first payoff line that naturally leads into a numbered breakdown.",
].join("\n");

function normalizeHookTypeLabel(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/g, "");
}

/**
 * Ensures 15 hooks land in 5×3 columns. Models often omit or mislabel `source`;
 * we match when possible, then place leftovers in the first column with free slots.
 */
export function distributeHooksToFiveColumns(hooks: HookVariation[]): HookVariation[] {
  const labels = [...HOOK_COLUMN_LABELS];
  const canon = labels.map((l) => normalizeHookTypeLabel(l));
  const buckets: HookVariation[][] = labels.map(() => []);
  const used = new Set<number>();

  const matchColumn = (raw: string | undefined): number => {
    const n = normalizeHookTypeLabel(raw);
    if (!n) return -1;
    for (let i = 0; i < canon.length; i++) {
      if (n === canon[i]) return i;
    }
    for (let i = 0; i < canon.length; i++) {
      if (canon[i].includes(n) || n.includes(canon[i])) return i;
    }
    if (n.includes("question") || n.startsWith("what if")) return 0;
    if (n.includes("story")) return 1;
    if (n.includes("negative")) return 2;
    if (n.includes("contrarian")) return 3;
    if (n.includes("number") || n.includes("numbered") || /reasons?\s+your/.test(n)) return 4;
    return -1;
  };

  hooks.forEach((h, idx) => {
    const col = matchColumn(h.source);
    if (col >= 0 && buckets[col].length < 3) {
      buckets[col].push({ ...h, source: labels[col] });
      used.add(idx);
    }
  });

  const orphans = hooks.filter((_, idx) => !used.has(idx));
  for (const h of orphans) {
    const emptyCol = buckets.findIndex((b) => b.length < 3);
    if (emptyCol >= 0) {
      buckets[emptyCol].push({ ...h, source: labels[emptyCol] });
    }
  }

  return labels.flatMap((label, colIdx) => buckets[colIdx].map((item) => ({ ...item, source: label })));
}

export async function generateHookVariations({
  apiKey,
  language,
  targetAudience,
  hook,
  platform,
  stylePreset,
  curiosityLevel,
  useContrarianHook,
  useBrandVoiceLock,
  brandVoiceSample,
  uniquePerspective,
  instructions: data,
}: GenerateHooksInput): Promise<HookVariation[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon). Keys are stored locally as shared saasApiKeys.");
  }

  const instructionBlock = buildInstructionBlock(data);

  const userPayload = [
    languageDirective(language),
    `Platform: ${platform.trim()}`,
    `Style preset: ${stylePreset.trim()}`,
    `Target audience: ${targetAudience.trim()}`,
    `Original hook: ${hook.trim()}`,
    ...(uniquePerspective?.trim() ? [`Unique perspective: ${uniquePerspective.trim()}`] : []),
    `Curiosity level (0-1): ${Math.max(0, Math.min(1, curiosityLevel ?? 0.5))}`,
    `Use contrarian hook angle: ${useContrarianHook ? "yes" : "no"}`,
    ...(useBrandVoiceLock && brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${brandVoiceSample.trim()}`] : []),
    "",
    "Return exactly 15 transformed hooks as JSON with shape:",
    "{\"hooks\":[{\"text\":\"...\",\"source\":\"Ask a question Hook|Story hook|Negative hook|Contrarian view|Numbered list\",\"score\":0-100,\"performanceScore\":0-100,\"performanceReason\":\"one short reason\",\"reasons\":[\"short reason 1\",\"short reason 2\"],\"improveTip\":\"one short suggestion\"}]}",
    "Use exactly these 5 hook types and generate exactly 3 hooks per type (15 total), in this order:",
    "3 × Ask a question Hook, then 3 × Story hook, then 3 × Negative hook, then 3 × Contrarian view, then 3 × Numbered list.",
    "Each hook MUST include a string field source set to exactly one of these labels (copy spelling):",
    "- Ask a question Hook",
    "- Story hook",
    "- Negative hook",
    "- Contrarian view",
    "- Numbered list",
    "Each hook must clearly and naturally include:",
    "- who it is for",
    "- a real-life situation/context",
    "- the core problem",
    "Every hook must create a clear curiosity gap (open loop) without sounding clickbait.",
    "",
    HOOK_BUILD_GUIDANCE,
    "Write like everyday speech, not formal or robotic copy.",
    "Prefer phrasing similar to: If your mind won't stop after work, it's not a thinking problem.",
    "Score should reflect how strong and natural the hook feels for the given audience and platform.",
    "performanceScore should estimate expected watch-through potential.",
    "performanceReason must explain the performance score in one short sentence.",
    "Reasons must be short and plain-language.",
    "improveTip must be one short, concrete suggestion to make the hook stronger.",
  ].join("\n");

  const parsed = await requestJson<{ hooks?: unknown }>(trimmedKey, [
    {
      role: "system",
      content: `You transform marketing hooks. Follow this instruction pack exactly:\n\n${instructionBlock}`,
    },
    { role: "user", content: userPayload },
  ]);

  const hooks = normalizeHooks(parsed.hooks);
  if (hooks.length !== 15) {
    throw new Error(`Expected 15 hooks, got ${hooks.length}. Try again.`);
  }
  return distributeHooksToFiveColumns(hooks);
}

export async function rewriteWinningHook(
  input: GenerateHooksInput & {
    winningHook: string;
  },
): Promise<HookVariation[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon). Keys are stored locally as shared saasApiKeys.");
  }
  const instructionBlock = buildInstructionBlock(input.instructions);
  const userPayload = [
    languageDirective(input.language),
    `Platform: ${input.platform.trim()}`,
    `Style preset: ${input.stylePreset.trim()}`,
    `Target audience: ${input.targetAudience.trim()}`,
    `Original hook: ${input.hook.trim()}`,
    ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
    `Curiosity level (0-1): ${Math.max(0, Math.min(1, input.curiosityLevel ?? 0.5))}`,
    `Use contrarian hook angle: ${input.useContrarianHook ? "yes" : "no"}`,
    ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
    `Winning hook to use as base pattern: ${input.winningHook.trim()}`,
    "",
    "Create 10 NEW hooks inspired by the winning hook's angle/structure but not duplicates.",
    "Each hook must clearly and naturally include:",
    "- who it is for",
    "- a real-life situation/context",
    "- the core problem",
    "Write like everyday speech, not formal or robotic copy.",
    "Return JSON: {\"hooks\":[{\"text\":\"...\",\"score\":0-100,\"performanceScore\":0-100,\"performanceReason\":\"...\",\"reasons\":[\"...\",\"...\"],\"improveTip\":\"one short suggestion\"}]}",
  ].join("\n");

  const parsed = await requestJson<{ hooks?: unknown }>(trimmedKey, [
    {
      role: "system",
      content: `You rewrite from winning hooks. Follow this instruction pack exactly:\n\n${instructionBlock}`,
    },
    { role: "user", content: userPayload },
  ]);

  const hooks = normalizeHooks(parsed.hooks);
  if (hooks.length !== 10) {
    throw new Error(`Expected 10 hooks, got ${hooks.length}. Try again.`);
  }
  return hooks;
}

export async function generateContentIdeas(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  platform: string;
  hook: string;
  uniquePerspective?: string;
}): Promise<string[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const parsed = await requestJson<{ ideas?: unknown }>(trimmedKey, [
    {
      role: "system",
      content:
        "You create aha-moment and conclusion lines for short-form content. Use symptom-first everyday language, no buzzwords, no fancy phrases, no expert talk. Be concrete and specific.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Platform: ${input.platform}`,
        `Target audience: ${input.targetAudience}`,
        `Hook: ${input.hook}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        "",
        "Generate exactly 5 examples.",
        "Each example should be a short 'Aha + Conclusion' statement.",
        "Start from a relatable symptom/problem first, then give the insight/conclusion.",
        "Focus on the insight and ending takeaway, not on shots, filming, or structure.",
        "Format each line like: Aha: ... Conclusion: ...",
        "Return JSON: {\"ideas\":[\"...\",\"...\",\"...\",\"...\",\"...\"]}",
      ].join("\n"),
    },
  ]);

  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas.map((idea) => String(idea).trim()).filter(Boolean) : [];
  if (ideas.length !== 5) {
    throw new Error(`Expected 5 ideas, got ${ideas.length}. Try again.`);
  }
  return ideas;
}

export async function generateTrendingHooks(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  hook: string;
  stylePreset: string;
  curiosityLevel?: number;
  useContrarianHook?: boolean;
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
  uniquePerspective?: string;
}): Promise<HookVariation[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const parsed = await requestJson<{ hooks?: unknown }>(trimmedKey, [
    {
      role: "system",
      content:
        "You create trend-inspired social hooks in plain language. Avoid fancy words and buzzwords. Generate hooks that sound like how people actually talk.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Target audience: ${input.targetAudience}`,
        `Seed hook: ${input.hook}`,
        `Style preset: ${input.stylePreset}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        `Curiosity level (0-1): ${Math.max(0, Math.min(1, input.curiosityLevel ?? 0.5))}`,
        `Use contrarian hook angle: ${input.useContrarianHook ? "yes" : "no"}`,
        ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
        "",
        "Generate trend-inspired hooks for these platforms: Instagram, Reddit, YouTube Shorts, TikTok.",
        "Create exactly 12 hooks total (3 per platform).",
        "Each hook must stay relevant to the seed hook topic and audience.",
        "Each hook must clearly and naturally include:",
        "- who it is for",
        "- a real-life situation/context",
        "- the core problem",
        "Write like everyday speech, not formal or robotic copy.",
        "Return JSON only:",
        "{\"hooks\":[{\"source\":\"Instagram|Reddit|YouTube|TikTok\",\"text\":\"...\",\"score\":0-100,\"performanceScore\":0-100,\"performanceReason\":\"...\",\"reasons\":[\"starts with a common TikTok style\",\"clear pain for the audience\"],\"improveTip\":\"one short suggestion\"}]}",
      ].join("\n"),
    },
  ]);

  const hooks = normalizeHooks(parsed.hooks);
  if (hooks.length < 8) {
    throw new Error(`Expected trend hooks, got ${hooks.length}. Try again.`);
  }
  return hooks;
}

export type ExpansionPack = {
  rewrites: HookVariation[];
  painHooks: HookVariation[];
  curiosityHooks: HookVariation[];
};

export async function generateWinningHookExpansion(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  platform: string;
  stylePreset: string;
  baseHook: string;
  uniquePerspective?: string;
}): Promise<ExpansionPack> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const parsed = await requestJson<{
    rewrites?: unknown;
    painHooks?: unknown;
    curiosityHooks?: unknown;
  }>(trimmedKey, [
    {
      role: "system",
      content:
        "You expand winning social hooks. Use plain language and natural spoken tone. No buzzwords, no fancy language.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Target audience: ${input.targetAudience}`,
        `Platform: ${input.platform}`,
        `Style preset: ${input.stylePreset}`,
        `Winning hook: ${input.baseHook}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        "",
        "Generate 3 sets with exactly 10 hooks each:",
        "1) rewrites: same core idea, fresh wording",
        "2) painHooks: stronger pain/tension angle",
        "3) curiosityHooks: stronger curiosity/open-loop angle",
        "For every hook: clearly and naturally include who it is for, the situation, and the core problem.",
        "Keep phrasing conversational and everyday, never robotic.",
        "Return JSON only with this shape:",
        "{\"rewrites\":[{\"text\":\"...\",\"score\":0-100,\"reasons\":[\"...\"],\"improveTip\":\"...\"}],\"painHooks\":[...],\"curiosityHooks\":[...]}",
      ].join("\n"),
    },
  ]);

  const rewrites = normalizeHooks(parsed.rewrites);
  const painHooks = normalizeHooks(parsed.painHooks);
  const curiosityHooks = normalizeHooks(parsed.curiosityHooks);
  if (rewrites.length !== 10 || painHooks.length !== 10 || curiosityHooks.length !== 10) {
    throw new Error("Expected 10 hooks in each expansion set. Try again.");
  }
  return { rewrites, painHooks, curiosityHooks };
}

export type ScriptStoryboard = {
  title: string;
  script: string;
  storyboard: string[];
  ctaOptions: string[];
};

export type CalendarHookDayInput = {
  id: string;
  weekLabel: string;
  dayLabel: string;
  topic: string;
  hookType: string;
  format: string;
};

export async function generateCalendarHooks(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  uniquePerspective?: string;
  curiosityLevel?: number;
  useContrarianHook?: boolean;
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
  days: CalendarHookDayInput[];
}): Promise<Array<{ id: string; hook: string }>> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }
  if (!Array.isArray(input.days) || input.days.length === 0) return [];

  const parsed = await requestJson<{ days?: unknown }>(trimmedKey, [
    {
      role: "system",
      content:
        "You create social media hooks for a content calendar. Write plain, everyday language and always include a curiosity gap. No buzzwords, no robotic tone.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Target audience: ${input.targetAudience}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        `Curiosity level (0-1): ${Math.max(0, Math.min(1, input.curiosityLevel ?? 0.5))}`,
        `Use contrarian hook angle: ${input.useContrarianHook ? "yes" : "no"}`,
        ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
        "",
        "Generate one hook per calendar day listed below.",
        "Each hook must follow the requested hook type and be compatible with the requested format.",
        "Every hook must include a curiosity gap and naturally imply: who this is for, the situation, and the core problem.",
        "Keep each hook concise (around 1 sentence).",
        "",
        HOOK_BUILD_GUIDANCE,
        "Return JSON only with this exact shape:",
        "{\"days\":[{\"id\":\"same id\",\"hook\":\"generated hook\"}]}",
        "",
        "Calendar day requests:",
        ...input.days.map((day) => `- id=${day.id} | ${day.weekLabel} ${day.dayLabel} | topic=${day.topic} | hookType=${day.hookType} | format=${day.format}`),
      ].join("\n"),
    },
  ]);

  const rows = Array.isArray(parsed.days) ? parsed.days : [];
  const normalized = rows
    .map((row) => {
      const item = row as { id?: unknown; hook?: unknown };
      const id = String(item.id ?? "").trim();
      const hook = String(item.hook ?? "").trim();
      if (!id || !hook) return null;
      return { id, hook };
    })
    .filter((item): item is { id: string; hook: string } => item !== null);

  return normalized;
}

export async function generateSymptomStoryBlocks(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  platform: string;
  hook: string;
  stylePreset: string;
  uniquePerspective?: string;
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
}): Promise<string[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const parsed = await requestJson<{ blocks?: unknown }>(trimmedKey, [
    {
      role: "system",
      content:
        "You write short-form social content in a symptom-first narrative style. Avoid expert talk, jargon, and clinical phrasing.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Platform: ${input.platform}`,
        `Style preset: ${input.stylePreset}`,
        `Target audience: ${input.targetAudience}`,
        `Hook: ${input.hook}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
        "",
        "Generate exactly 5 content blocks in this structure:",
        "- opening: 4 to 6 short symptom/situation lines",
        "- then a contrast turn (like: But..., Meanwhile..., And then...)",
        "- then a short pivot line (like: That uncomfortable feeling? / And one day you realize:)",
        "- then a 2 to 3 line reframe/conclusion ending",
        "",
        "Rules:",
        "- everyday spoken language only",
        "- no names and no cinematic character storytelling",
        "- no list numbers, no bullet markers",
        "- each line should be short and readable as separate line breaks",
        "- each block should feel like a full micro-story, not a short caption",
        "- target length: about 9 to 13 lines total per block",
        "- target length: about 45 to 80 words total per block",
        "- include 1 to 3 intentional blank lines for pacing",
        "- keep the output ready to post (no commentary)",
        "- follow this rhythm closely: setup lines -> contrast turn -> pivot line -> embodied reframe",
        "",
        "Return JSON only:",
        "{\"blocks\":[\"line1\\nline2\\nline3\\n\\nBut ...\\n...\",\"...\"]}",
      ].join("\n"),
    },
  ]);

  const blocks = Array.isArray(parsed.blocks) ? parsed.blocks.map((b) => String(b).trim()).filter(Boolean) : [];
  if (blocks.length !== 5) {
    throw new Error(`Expected 5 symptom story blocks, got ${blocks.length}. Try again.`);
  }
  return blocks;
}

function cleanStoryboardLine(line: string): string {
  return line
    .replace(/^shot\s*\d+\s*[:.-]?\s*/i, "")
    .replace(/^scene\s*\d+\s*[:.-]?\s*/i, "")
    .trim();
}

export async function generateNetflixifyScripts(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  platform: string;
  hook: string;
  curiosityLevel?: number;
  useContrarianHook?: boolean;
  conflictLevel?: number;
  dramaLevel?: number;
  endingStyle?: "hopeful" | "urgent" | "reflective";
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
  uniquePerspective?: string;
}): Promise<ScriptStoryboard[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const parsed = await requestJson<{
    scripts?: unknown;
  }>(trimmedKey, [
    {
      role: "system",
      content:
        "You are a short-form script strategist. Create clear, practical symptom-first scripts in plain language. Avoid expert talk, jargon, and lecture tone.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Platform: ${input.platform}`,
        `Target audience: ${input.targetAudience}`,
        `Seed hook: ${input.hook}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        `Curiosity level (0-1): ${Math.max(0, Math.min(1, input.curiosityLevel ?? 0.5))}`,
        `Use contrarian hook angle: ${input.useContrarianHook ? "yes" : "no"}`,
        `Conflict level (0-1): ${Math.max(0, Math.min(1, input.conflictLevel ?? 0.7))}`,
        `Drama level (0-1): ${Math.max(0, Math.min(1, input.dramaLevel ?? 0.7))}`,
        `Ending style: ${(input.endingStyle ?? "reflective").trim()}`,
        ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
        "",
        "Create exactly 5 distinct 'Netflixified' script ideas.",
        "Each idea must follow this structure in the script itself:",
        "1) opening hook that sets situation + who it is for",
        "2) conflict",
        "3) drama/escalation",
        "4) conclusion",
        "The opening must be symptom-first and relatable in everyday life.",
        "Write final content only. Do not include planning commentary, analysis notes, or meta lines.",
        "Never write lines like: 'Who is this for?', 'Here's the twist', 'Step 1', or similar instruction-style phrasing.",
        "Do not ask questions to the creator. Write direct audience-facing content.",
        "Do not use person names (no named characters).",
        "Describe relatable everyday situations instead of cinematic fictional scenes.",
        "Base each script directly on the provided seed hook and unique perspective.",
        "If unique perspective is provided, it must clearly show up in each script's angle.",
        "",
        "Return JSON with shape:",
        "{\"scripts\":[{\"title\":\"...\",\"script\":\"...\",\"storyboard\":[\"shot 1 ...\",\"shot 2 ...\",\"shot 3 ...\",\"shot 4 ...\",\"shot 5 ...\",\"shot 6 ...\"],\"ctaOptions\":[\"cta1\",\"cta2\",\"cta3\"]}]}",
        "Rules:",
        "- scripts array: exactly 5 items",
        "- storyboard: exactly 6 steps per script",
        "- ctaOptions: exactly 3 options per script",
      ].join("\n"),
    },
  ]);

  const scripts = Array.isArray(parsed.scripts) ? parsed.scripts : [];
  const normalized = scripts
    .map((entry) => {
      const row = entry as { title?: unknown; script?: unknown; storyboard?: unknown; ctaOptions?: unknown };
      const title = String(row.title ?? "").trim();
      const script = String(row.script ?? "").trim();
      const storyboard = Array.isArray(row.storyboard)
        ? row.storyboard.map((s) => cleanStoryboardLine(String(s))).filter(Boolean)
        : [];
      const ctaOptions = Array.isArray(row.ctaOptions) ? row.ctaOptions.map((s) => String(s).trim()).filter(Boolean) : [];
      if (!title || !script || storyboard.length !== 6 || ctaOptions.length !== 3) {
        return null;
      }
      return { title, script, storyboard, ctaOptions };
    })
    .filter((item): item is ScriptStoryboard => item !== null);

  if (normalized.length !== 5) {
    throw new Error(`Expected 5 Netflixified scripts, got ${normalized.length}. Try again.`);
  }
  return normalized;
}

export async function generateScriptStoryboard(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  platform: string;
  hook: string;
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
  uniquePerspective?: string;
}): Promise<ScriptStoryboard> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const isCarousel = input.platform.toLowerCase().includes("carousel");

  const parsed = await requestJson<{
    title?: unknown;
    script?: unknown;
    storyboard?: unknown;
    ctaOptions?: unknown;
  }>(trimmedKey, [
    {
      role: "system",
      content:
        "You are a short-form content strategist. Write practical, simple symptom-first scripts and shot lists in plain everyday language. Avoid expert talk and jargon.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Platform: ${input.platform}`,
        `Target audience: ${input.targetAudience}`,
        `Hook: ${input.hook}`,
        ...(input.uniquePerspective?.trim() ? [`Unique perspective: ${input.uniquePerspective.trim()}`] : []),
        ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
        ...(isCarousel
          ? [
              "Platform note: This is for a carousel post.",
              "Write the script in a slide-friendly way where each beat can be turned into: headline + subheadline.",
              "Keep each beat concise and punchy.",
            ]
          : []),
        "",
        "Create a 30-45 second content blueprint.",
        "Return JSON with this shape:",
        "{\"title\":\"...\",\"script\":\"...\",\"storyboard\":[\"shot 1 ...\",\"shot 2 ...\"],\"ctaOptions\":[\"cta1\",\"cta2\",\"cta3\"]}",
        "Rules:",
        "- storyboard: exactly 6 steps",
        "- ctaOptions: exactly 3 options",
        "- script: one cohesive read-out script",
      ].join("\n"),
    },
  ]);

  const storyboard = Array.isArray(parsed.storyboard) ? parsed.storyboard.map((s) => String(s).trim()).filter(Boolean) : [];
  const ctaOptions = Array.isArray(parsed.ctaOptions) ? parsed.ctaOptions.map((s) => String(s).trim()).filter(Boolean) : [];
  const title = String(parsed.title ?? "").trim();
  const script = String(parsed.script ?? "").trim();
  if (!title || !script || storyboard.length !== 6 || ctaOptions.length !== 3) {
    throw new Error("Failed to generate a complete script/storyboard package. Try again.");
  }
  return { title, script, storyboard, ctaOptions };
}

export async function recalculateHookScores(input: {
  apiKey: string;
  language?: AppLanguage;
  targetAudience: string;
  platform: string;
  useBrandVoiceLock?: boolean;
  brandVoiceSample?: string;
  hooks: string[];
}): Promise<HookVariation[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }
  const cleanedHooks = input.hooks.map((hook) => hook.trim()).filter(Boolean);
  if (cleanedHooks.length === 0) return [];

  const parsed = await requestJson<{ hooks?: unknown }>(trimmedKey, [
    {
      role: "system",
      content:
        "You score social media hooks. Never rewrite, rephrase, or alter hook text. Only evaluate and score exactly what you receive.",
    },
    {
      role: "user",
      content: [
        languageDirective(input.language),
        `Target audience: ${input.targetAudience}`,
        `Platform: ${input.platform}`,
        ...(input.useBrandVoiceLock && input.brandVoiceSample?.trim() ? [`Brand voice lock sample:\n${input.brandVoiceSample.trim()}`] : []),
        "",
        "Score these hooks exactly as written. Do not change any hook text.",
        "Return JSON only with shape:",
        "{\"hooks\":[{\"text\":\"original exact hook text\",\"score\":0-100,\"performanceScore\":0-100,\"performanceReason\":\"...\",\"reasons\":[\"...\",\"...\"],\"improveTip\":\"...\"}]}",
        "",
        "Hooks:",
        ...cleanedHooks.map((hook, i) => `${i + 1}. ${hook}`),
      ].join("\n"),
    },
  ]);

  const variations = normalizeHooks(parsed.hooks);
  if (variations.length !== cleanedHooks.length) {
    throw new Error("Could not rescore all hooks. Try again.");
  }
  return variations;
}
