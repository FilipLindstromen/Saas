import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

const MAX_BODY_BYTES = 120_000;

export async function GET() {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { clientPreferences: true },
    });

    const raw = user?.clientPreferences;
    const preferences =
      raw != null && typeof raw === "object" && !Array.isArray(raw)
        ? (raw as Record<string, unknown>)
        : {};

    return NextResponse.json({ preferences });
  } catch (e) {
    console.error("GET /api/user/preferences:", e);
    const message = getDbErrorMessage(e) || "Failed to load preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Payload too large" }, { status: 413 });
    }

    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const prefsField = (body as Record<string, unknown>).preferences;
    if (prefsField == null || typeof prefsField !== "object" || Array.isArray(prefsField)) {
      return NextResponse.json({ error: "preferences object required" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: userId },
      data: { clientPreferences: prefsField as object },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/user/preferences:", e);
    const message = getDbErrorMessage(e) || "Failed to save preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
