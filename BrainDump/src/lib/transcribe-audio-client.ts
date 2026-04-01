/**
 * Client helpers for /api/transcribe — multi-segment uploads stay under Whisper size limits
 * and reduce serverless timeout risk vs one huge file.
 */

import { fetchWithTimeout } from "@/lib/safe-fetch-json";

/** Slightly under OpenAI Whisper’s 25 MB limit */
export const WHISPER_MAX_BYTES = 24 * 1024 * 1024;

export type TranscribeAudioOptions = {
  language: string;
  /** Per-chunk timeout (each segment gets a fresh budget). */
  timeoutMs: number;
};

export async function transcribeAudioBlobs(
  blobs: Blob[],
  { language, timeoutMs }: TranscribeAudioOptions
): Promise<string> {
  const nonEmpty = blobs.filter((b) => b.size > 0);
  if (nonEmpty.length === 0) return "";

  const parts: string[] = [];
  for (let i = 0; i < nonEmpty.length; i++) {
    const blob = nonEmpty[i]!;
    if (blob.size > WHISPER_MAX_BYTES) {
      throw new Error("AUDIO_SEGMENT_TOO_LARGE");
    }
    const mime = blob.type || "audio/webm";
    const fileName = mime.includes("mp4") || mime.includes("m4a") ? "recording.mp4" : "recording.webm";
    const form = new FormData();
    form.append("file", blob, fileName);
    form.append("language", language);

    const res = await fetchWithTimeout("/api/transcribe", { method: "POST", body: form }, timeoutMs);
    const raw = await res.text();
    let data: { error?: string; transcript?: string };
    try {
      data = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      throw new Error(!res.ok ? raw.trim().slice(0, 240) || `Transcription failed (${res.status})` : "Invalid response from server");
    }
    if (!res.ok) {
      throw new Error(typeof data.error === "string" && data.error ? data.error : "Transcription failed");
    }
    const piece = (data.transcript ?? "").trim();
    if (piece) parts.push(piece);
  }

  return parts.join("\n\n");
}
