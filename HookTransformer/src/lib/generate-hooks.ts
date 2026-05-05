import hookTransformInstructions from "@/data/hook-transform-instructions.json";

type Instructions = typeof hookTransformInstructions;

export type GenerateHooksInput = {
  apiKey: string;
  targetAudience: string;
  hook: string;
  instructions: Instructions;
};

export type GenerateHooksResult = {
  hooks: string[];
};

export async function generateHookVariations({
  apiKey,
  targetAudience,
  hook,
  instructions: data,
}: GenerateHooksInput): Promise<string[]> {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) {
    throw new Error("Add your OpenAI API key in the SaaS Apps hub settings (gear icon). Keys are stored locally as shared saasApiKeys.");
  }

  const instructionBlock = [
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

  const userPayload = [
    `Target audience: ${targetAudience.trim()}`,
    `Original hook: ${hook.trim()}`,
    "",
    "Return exactly 10 transformed hooks as JSON with shape {\"hooks\": string[]}. No other keys.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${trimmedKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You transform marketing hooks. Follow this instruction pack exactly:\n\n${instructionBlock}`,
        },
        { role: "user", content: userPayload },
      ],
    }),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `OpenAI error: ${response.status}`);
  }

  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = body.choices?.[0]?.message?.content?.trim() ?? "";
  let parsed: GenerateHooksResult;
  try {
    parsed = JSON.parse(raw) as GenerateHooksResult;
  } catch {
    throw new Error("Could not parse model response as JSON.");
  }

  const hooks = Array.isArray(parsed.hooks) ? parsed.hooks.map((h) => String(h).trim()).filter(Boolean) : [];
  if (hooks.length !== 10) {
    throw new Error(`Expected 10 hooks, got ${hooks.length}. Try again.`);
  }
  return hooks;
}
