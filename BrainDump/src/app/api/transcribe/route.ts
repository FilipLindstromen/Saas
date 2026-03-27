import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";
import { auth } from "@/auth";
import { resolveOpenAiApiKey } from "@/lib/resolve-openai-api-key";

export const runtime = "nodejs";
export const maxDuration = 60;

const SUPPORTED_EXT = ["webm", "mp4", "mp3", "wav", "m4a", "mpeg", "mpga", "ogg", "flac", "oga"] as const;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }

    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const keyRes = resolveOpenAiApiKey(userId);
    if (!keyRes.ok) {
      return NextResponse.json({ error: keyRes.error }, { status: keyRes.status });
    }
    const apiKey = keyRes.apiKey;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Audio file is empty. Record something first." }, { status: 400 });
    }

    const mimeType = (file.type || "audio/webm").toLowerCase();
    const name = (file.name || "recording.webm").toLowerCase();
    const ext =
      name.includes(".mp4") || name.includes(".m4a") || mimeType.includes("mp4") || mimeType.includes("m4a")
        ? "mp4"
        : "webm";
    const filename = SUPPORTED_EXT.includes(ext as (typeof SUPPORTED_EXT)[number])
      ? `recording.${ext}`
      : "recording.webm";

    const apiFile = await toFile(buffer, filename);
    const openai = new OpenAI({ apiKey });
    const langRaw = (formData.get("language") as string | null)?.trim().toLowerCase() ?? "";
    /** ISO 639-1; Whisper supports forcing language for more reliable output in that language */
    const language = langRaw === "sv" ? "sv" : langRaw === "en" ? "en" : undefined;

    const numberStylePrompt =
      language === "sv"
        ? "Skriv tal med siffror när det handlar om antal eller mängder: 7, inte sju."
        : language === "en"
          ? "Write numbers as digits for counts and amounts: 7, not seven."
          : "Prefer digits for numbers in the transcript (e.g. 7) instead of spelling them out (seven) when stating quantities or counts.";

    const transcription = await openai.audio.transcriptions.create({
      file: apiFile,
      model: "whisper-1",
      ...(language ? { language } : {}),
      prompt: numberStylePrompt,
    });

    const text = (transcription as { text?: string }).text?.trim() ?? "";
    return NextResponse.json({ transcript: text });
  } catch (e) {
    console.error("Transcribe error:", e);
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
