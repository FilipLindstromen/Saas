import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-email";
import { getRevenueCatServerEnabled, setRevenueCatServerEnabled } from "@/lib/site-settings";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const revenueCatEnabled = await getRevenueCatServerEnabled();
    return NextResponse.json({ revenueCatEnabled });
  } catch (e) {
    console.error("admin settings GET:", e);
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const body = await request.json();
    const v = (body as { revenueCatEnabled?: unknown }).revenueCatEnabled;
    if (typeof v !== "boolean") {
      return NextResponse.json({ error: "revenueCatEnabled boolean required" }, { status: 400 });
    }
    await setRevenueCatServerEnabled(v);
    return NextResponse.json({ ok: true, revenueCatEnabled: v });
  } catch (e) {
    console.error("admin settings PATCH:", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
