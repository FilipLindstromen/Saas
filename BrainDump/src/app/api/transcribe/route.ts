import { NextRequest, NextResponse } from "next/server";
import OpenAI, { toFile } from "openai";

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

    const clientKey = (formData.get("apiKey") as string | null)?.trim() || "";
    const apiKey = process.env.OPENAI_API_KEY || clientKey;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OpenAI API key is not configured. Set OPENAI_API_KEY." },
        { status: 500 }
      );
    }

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
    const transcription = await openai.audio.transcriptions.create({
      file: apiFile,
      model: "whisper-1",
    });

    const text = (transcription as { text?: string }).text?.trim() ?? "";
    return NextResponse.json({ transcript: text });
  } catch (e) {
    console.error("Transcribe error:", e);
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
