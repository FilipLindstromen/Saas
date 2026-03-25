/**
 * Resolves which OpenAI key to use for API routes.
 * - User-supplied key (Settings / BYOK) always wins when non-empty.
 * - Server OPENAI_API_KEY is only used for signed-in users (avoids anonymous burn of host quota).
 */

export type OpenAiApiKeyResult =
  | { ok: true; apiKey: string }
  | { ok: false; error: string; status: 401 | 500 };

export function resolveOpenAiApiKey(clientKey: string, sessionUserId: string | undefined): OpenAiApiKeyResult {
  const trimmed = clientKey.trim();
  if (trimmed) return { ok: true, apiKey: trimmed };

  const server = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!sessionUserId) {
    return {
      ok: false,
      error: "Sign in to continue, or add an OpenAI API key in Settings.",
      status: 401,
    };
  }
  if (!server) {
    return {
      ok: false,
      error:
        "OpenAI API key is not configured. Add your key in Settings or set OPENAI_API_KEY on the server.",
      status: 500,
    };
  }
  return { ok: true, apiKey: server };
}
