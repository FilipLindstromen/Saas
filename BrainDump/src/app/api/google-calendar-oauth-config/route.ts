import { NextResponse } from "next/server";
import { env } from "@/config/env.server";

/**
 * Exposes the web OAuth client id for Google Calendar (implicit flow in the browser).
 * Not a secret; same id appears in the OAuth consent URL. Must match redirect URI allowlist in Google Cloud.
 */
export async function GET() {
  const clientId = env.GOOGLE_CLIENT_ID?.trim() || "";
  return NextResponse.json({
    configured: clientId.length > 0,
    clientId: clientId.length > 0 ? clientId : null,
  });
}
