const OPENAI_API = "https://api.openai.com/v1";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatCompletion(opts: {
  apiKey: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" };
}): Promise<string> {
  const key = opts.apiKey?.trim();
  if (!key) {
    throw new Error("OpenAI API key is not set. Add it in the SaaS hub (gear icon) under OpenAI.");
  }

  const body: Record<string, unknown> = {
    model: opts.model ?? "gpt-4o-mini",
    messages: opts.messages,
    temperature: opts.temperature ?? 0.55,
    max_tokens: opts.max_tokens ?? 4096,
  };
  if (opts.response_format) body.response_format = opts.response_format;

  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message || `OpenAI API error: ${res.status}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

export function parseJsonObject<T>(raw: string): T {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error("Model returned invalid JSON. Try again or shorten inputs.");
  }
}
