import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/admin-email";
import { getRevenueCatServerEnabled, setRevenueCatServerEnabled } from "@/lib/site-settings";
import {
  getAiInstructionDefaults,
  getAiInstructionOverrides,
  setAiInstructionOverrides,
} from "@/lib/ai-instructions";

export const runtime = "nodejs";

const MAX_PROMPT_CHARS = 120_000;

function parseOptionalPrompt(value: unknown, field: string): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error(`${field} must be a string or null`);
  }
  if (value.length > MAX_PROMPT_CHARS) {
    throw new Error(`${field} exceeds ${MAX_PROMPT_CHARS.toLocaleString()} characters`);
  }
  return value;
}

export async function GET() {
  const session = await auth();
  if (!isAdminEmail(session?.user?.email)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const [revenueCatEnabled, aiOverrides] = await Promise.all([
      getRevenueCatServerEnabled(),
      getAiInstructionOverrides(),
    ]);
    const defaults = getAiInstructionDefaults();
    return NextResponse.json({
      revenueCatEnabled,
      organizeSystemPromptEn: aiOverrides.organizeSystemPromptEn,
      organizeSystemPromptSv: aiOverrides.organizeSystemPromptSv,
      coachSystemPrompt: aiOverrides.coachSystemPrompt,
      defaults,
    });
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
    const rec = body as Record<string, unknown>;

    if ("revenueCatEnabled" in rec) {
      const v = rec.revenueCatEnabled;
      if (typeof v !== "boolean") {
        return NextResponse.json({ error: "revenueCatEnabled boolean required" }, { status: 400 });
      }
      await setRevenueCatServerEnabled(v);
    }

    const aiPatch: Partial<{
      organizeSystemPromptEn: string | null;
      organizeSystemPromptSv: string | null;
      coachSystemPrompt: string | null;
    }> = {};

    try {
      const en = parseOptionalPrompt(rec.organizeSystemPromptEn, "organizeSystemPromptEn");
      if (en !== undefined) aiPatch.organizeSystemPromptEn = en;
      const sv = parseOptionalPrompt(rec.organizeSystemPromptSv, "organizeSystemPromptSv");
      if (sv !== undefined) aiPatch.organizeSystemPromptSv = sv;
      const coach = parseOptionalPrompt(rec.coachSystemPrompt, "coachSystemPrompt");
      if (coach !== undefined) aiPatch.coachSystemPrompt = coach;
    } catch (validationError) {
      const message = validationError instanceof Error ? validationError.message : "Invalid prompt";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (Object.keys(aiPatch).length > 0) {
      await setAiInstructionOverrides(aiPatch);
    }

    const [revenueCatEnabled, aiOverrides] = await Promise.all([
      getRevenueCatServerEnabled(),
      getAiInstructionOverrides(),
    ]);

    return NextResponse.json({
      ok: true,
      revenueCatEnabled,
      organizeSystemPromptEn: aiOverrides.organizeSystemPromptEn,
      organizeSystemPromptSv: aiOverrides.organizeSystemPromptSv,
      coachSystemPrompt: aiOverrides.coachSystemPrompt,
    });
  } catch (e) {
    console.error("admin settings PATCH:", e);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
