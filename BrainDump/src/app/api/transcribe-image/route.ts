import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { resolveOpenAiApiKey } from "@/lib/resolve-openai-api-key";

export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BYTES = 20 * 1024 * 1024;
const MAX_BODY = MAX_BYTES + 256 * 1024; /* multipart overhead */
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    const keyRes = resolveOpenAiApiKey(userId);
    if (!keyRes.ok) {
      return NextResponse.json({ error: keyRes.error }, { status: keyRes.status });
    }
    const apiKey = keyRes.apiKey;

    const cl = request.headers.get("content-length");
    if (cl && /^\d+$/.test(cl) && Number(cl) > MAX_BODY) {
      return NextResponse.json({ error: "Image is too large (max 20 MB)." }, { status: 413 });
    }

    const formData = await request.formData();
    const file = formData.get("image") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing image file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length === 0) {
      return NextResponse.json({ error: "Image is empty." }, { status: 400 });
    }
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "Image is too large (max 20 MB)." }, { status: 400 });
    }

    let mime = (file.type || "image/jpeg").toLowerCase();
    if (mime === "image/jpg") mime = "image/jpeg";
    if (!ALLOWED_MIME.has(mime)) {
      return NextResponse.json(
        { error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF." },
        { status: 400 }
      );
    }

    const locale = (formData.get("locale") as string | null)?.trim().toLowerCase() ?? "en";
    const langNote =
      locale === "sv"
        ? "Om texten är på svenska, transkribera den på svenska och behåll svensk stavning. Föredra siffror för tal (7) framför ord (sju) vid antal och mängder."
        : "If the text is in a non-English language, transcribe it in that language faithfully.";

    const base64 = buffer.toString("base64");
    const dataUrl = `data:${mime || "image/jpeg"};base64,${base64}`;

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 4096,
      messages: [
        {
          role: "system",
          content: `You transcribe images of notes, whiteboards, handwriting, screenshots, and printed text into plain text for a productivity app.
Rules:
- Output ONLY the transcribed text. No preamble, no "Here is...", no markdown fences unless the original clearly uses code blocks.
- Preserve line breaks, bullet points, and numbered lists when visible.
- Prefer Arabic digits for quantities and counts (e.g. 7) rather than spelling numbers in words (e.g. seven), unless the source text clearly uses words.
- ${langNote}
- If there is no readable text, reply exactly: (no text detected)`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all readable text from this image.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const text = raw === "(no text detected)" ? "" : raw;
    return NextResponse.json({ transcript: text });
  } catch (e) {
    console.error("transcribe-image error:", e);
    const message = e instanceof Error ? e.message : "Image transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
