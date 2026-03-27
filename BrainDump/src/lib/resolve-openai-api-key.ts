/**
 * Resolves the OpenAI API key for API routes from the server secret only.
 * Requires a signed-in session; key must be set as OPENAI_API_KEY on the server.
 */

export type OpenAiApiKeyResult =
  | { ok: true; apiKey: string }
  | { ok: false; error: string; status: 401 | 500 };

export function resolveOpenAiApiKey(sessionUserId: string | undefined): OpenAiApiKeyResult {
  if (!sessionUserId) {
    return {
      ok: false,
      error: "Sign in to continue.",
      status: 401,
    };
  }
  const server = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!server) {
    return {
      ok: false,
      error:
        "OpenAI is not configured on the server. Set the OPENAI_API_KEY environment variable.",
      status: 500,
    };
  }
  return { ok: true, apiKey: server };
}
