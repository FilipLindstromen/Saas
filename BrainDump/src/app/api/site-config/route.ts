import { NextResponse } from "next/server";
import { getRevenueCatServerEnabled } from "@/lib/site-settings";

export const runtime = "nodejs";

/** Public read for paywall / SDK gating (no secrets). */
export async function GET() {
  try {
    const revenueCatEnabled = await getRevenueCatServerEnabled();
    return NextResponse.json({ revenueCatEnabled }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ revenueCatEnabled: true }, { headers: { "Cache-Control": "no-store" } });
  }
}
