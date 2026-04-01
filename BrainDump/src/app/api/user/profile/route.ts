import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getDbErrorMessage } from "@/lib/db-error";

const MAX_BODY_CHARS = 520_000;
const MAX_NAME_LENGTH = 120;
/** Decoded binary size cap for embedded avatars (base64 data URLs). */
const MAX_IMAGE_BYTES = 350_000;
const MAX_HTTPS_IMAGE_URL = 2048;

function normalizeProfileImage(
  raw: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Invalid image" };
  }
  const s = raw.trim();
  if (s === "") {
    return { ok: true, value: null };
  }
  if (s.length > MAX_BODY_CHARS) {
    return { ok: false, error: "Image payload too large" };
  }
  if (s.startsWith("data:image/")) {
    const m = /^data:image\/(jpeg|jpg|png|webp|gif);base64,([\s\S]+)$/i.exec(s);
    if (!m) {
      return { ok: false, error: "Image must be JPEG, PNG, WebP, or GIF (base64)" };
    }
    try {
      const b64 = m[2].replace(/\s/g, "");
      const buf = Buffer.from(b64, "base64");
      if (buf.length > MAX_IMAGE_BYTES) {
        return { ok: false, error: "Image file too large (max ~340 KB)" };
      }
      if (buf.length < 32) {
        return { ok: false, error: "Image is too small or corrupt" };
      }
    } catch {
      return { ok: false, error: "Invalid image data" };
    }
    return { ok: true, value: s };
  }
  if (s.startsWith("http://")) {
    return { ok: false, error: "Only HTTPS URLs are allowed for profile images" };
  }
  if (s.startsWith("https://")) {
    if (s.length > MAX_HTTPS_IMAGE_URL) {
      return { ok: false, error: "Image URL is too long" };
    }
    try {
      const u = new URL(s);
      if (u.protocol !== "https:") {
        return { ok: false, error: "Invalid image URL" };
      }
    } catch {
      return { ok: false, error: "Invalid image URL" };
    }
    return { ok: true, value: s };
  }
  return { ok: false, error: "Image must be a small photo file or an HTTPS link" };
}

function normalizeName(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null || raw === undefined) {
    return { ok: true, value: null };
  }
  if (typeof raw !== "string") {
    return { ok: false, error: "Invalid name" };
  }
  const t = raw.trim();
  if (t === "") {
    return { ok: true, value: null };
  }
  if (t.length > MAX_NAME_LENGTH) {
    return { ok: false, error: `Name must be at most ${MAX_NAME_LENGTH} characters` };
  }
  return { ok: true, value: t };
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const userId = (session?.user as { id?: string } | undefined)?.id;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const text = await request.text();
    if (text.length > MAX_BODY_CHARS) {
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

    const rec = body as Record<string, unknown>;
    const hasName = Object.prototype.hasOwnProperty.call(rec, "name");
    const hasImage = Object.prototype.hasOwnProperty.call(rec, "image");

    if (!hasName && !hasImage) {
      return NextResponse.json({ error: "Provide name and/or image" }, { status: 400 });
    }

    let nextName: string | null | undefined;
    let nextImage: string | null | undefined;

    if (hasName) {
      const n = normalizeName(rec.name);
      if (!n.ok) {
        return NextResponse.json({ error: n.error }, { status: 400 });
      }
      nextName = n.value;
    }

    if (hasImage) {
      const img = normalizeProfileImage(rec.image);
      if (!img.ok) {
        return NextResponse.json({ error: img.error }, { status: 400 });
      }
      nextImage = img.value;
    }

    const data: { name?: string | null; image?: string | null } = {};
    if (hasName) data.name = nextName ?? null;
    if (hasImage) data.image = nextImage ?? null;

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: { name: true, email: true, image: true },
    });

    return NextResponse.json({
      user: {
        name: updated.name,
        email: updated.email,
        image: updated.image,
      },
    });
  } catch (e) {
    console.error("PATCH /api/user/profile:", e);
    const message = getDbErrorMessage(e) || "Failed to update profile";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
