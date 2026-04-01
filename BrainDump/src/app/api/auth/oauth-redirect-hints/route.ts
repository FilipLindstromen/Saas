import { NextResponse } from "next/server";

/**
 * Public hints for OAuth console setup (no secrets).
 * Google "redirect_uri_mismatch" means the URI here must match Authorized redirect URIs exactly.
 */
export async function GET(request: Request) {
  const fromEnv = (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL)?.trim().replace(/\/$/, "");
  let origin: string;
  try {
    origin = fromEnv ? new URL(fromEnv).origin : new URL(request.url).origin;
  } catch {
    origin = new URL(request.url).origin;
  }

  const base = origin.replace(/\/$/, "");
  return NextResponse.json({
    googleRedirectUri: `${base}/api/auth/callback/google`,
    appleRedirectUri: `${base}/api/auth/callback/apple`,
    usedEnvCanonicalUrl: fromEnv ?? null,
    hint:
      "In Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Web client → Authorized redirect URIs, add the googleRedirectUri value exactly (scheme, host, path, no trailing slash unless your host uses one). Match www vs non-www and http vs https to your deployment.",
  });
}
