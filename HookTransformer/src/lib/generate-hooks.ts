import hookTransformInstructions from "@/data/hook-transform-instructions.json";

type Instructions = typeof hookTransformInstructions;

export type HookVariation = {
  text: string;
  score: number;
  reasons: string[];
};

export type GenerateHooksInput = {
  apiKey: string;
  targetAudience: string;
  hook: string;
  platform: string;
  stylePreset: string;
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
      const row = item as { text?: unknown; score?: unknown; reasons?: unknown };
      const reasons = Array.isArray(row.reasons) ? row.reasons.map((v) => String(v).trim()).filter(Boolean) : [];
      const scoreNumber = Number(row.score);
      return {
        text: String(row.text ?? "").trim(),
        score: Number.isFinite(scoreNumber) ? Math.max(0, Math.min(100, Math.round(scoreNumber))) : 0,
        reasons: reasons.slice(0, 3),
      };
    })
    .filter((item) => item.text.length > 0);
}

export async function generateHookVariations({
  apiKey,
  targetAudience,
  hook,
  platform,
  stylePreset,
  instructions: data,
}: GenerateHooksInput): Promise<HookVariation[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon). Keys are stored locally as shared saasApiKeys.");
  }

  const instructionBlock = buildInstructionBlock(data);

  const userPayload = [
    `Platform: ${platform.trim()}`,
    `Style preset: ${stylePreset.trim()}`,
    `Target audience: ${targetAudience.trim()}`,
    `Original hook: ${hook.trim()}`,
    "",
    "Return exactly 10 transformed hooks as JSON with shape:",
    "{\"hooks\":[{\"text\":\"...\",\"score\":0-100,\"reasons\":[\"short reason 1\",\"short reason 2\"]}]}",
    "Score should reflect how strong and natural the hook feels for the given audience and platform.",
    "Reasons must be short and plain-language.",
  ].join("\n");

  const parsed = await requestJson<{ hooks?: unknown }>(trimmedKey, [
    {
      role: "system",
      content: `You transform marketing hooks. Follow this instruction pack exactly:\n\n${instructionBlock}`,
    },
    { role: "user", content: userPayload },
  ]);

  const hooks = normalizeHooks(parsed.hooks);
  if (hooks.length !== 10) {
    throw new Error(`Expected 10 hooks, got ${hooks.length}. Try again.`);
  }
  return hooks;
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
    `Platform: ${input.platform.trim()}`,
    `Style preset: ${input.stylePreset.trim()}`,
    `Target audience: ${input.targetAudience.trim()}`,
    `Original hook: ${input.hook.trim()}`,
    `Winning hook to use as base pattern: ${input.winningHook.trim()}`,
    "",
    "Create 10 NEW hooks inspired by the winning hook's angle/structure but not duplicates.",
    "Return JSON: {\"hooks\":[{\"text\":\"...\",\"score\":0-100,\"reasons\":[\"...\",\"...\"]}]}",
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
  targetAudience: string;
  platform: string;
  hook: string;
}): Promise<string[]> {
  const trimmedKey = input.apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon).");
  }

  const parsed = await requestJson<{ ideas?: unknown }>(trimmedKey, [
    {
      role: "system",
      content:
        "You create practical short-form content ideas. Use plain language, no buzzwords, no fancy phrases. Be concrete and specific.",
    },
    {
      role: "user",
      content: [
        `Platform: ${input.platform}`,
        `Target audience: ${input.targetAudience}`,
        `Hook: ${input.hook}`,
        "",
        "Generate exactly 5 content ideas that could be made from this hook.",
        "Each idea should mention what to show or say.",
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
