import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";

const TOKEN_BYTES = 32;
const EXPIRY_MS = 60 * 60 * 1000; // 1 hour

function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

/**
 * Password reset links must never use client-controlled Origin/Referer (open-redirect / token leak).
 * Prefer env; fall back to this deployment's own origin from the incoming request URL.
 */
function trustedAppBaseUrl(request: Request): string {
  const envUrl = (process.env.AUTH_URL || process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL)?.trim();
  if (envUrl) return envUrl.replace(/\/$/, "");
  try {
    return new URL(request.url).origin;
  } catch {
    return "http://localhost:3001";
  }
}

export async function POST(request: Request) {
  const genericMessage =
    "If an account exists for that email, we sent password reset instructions. Check your inbox.";

  try {
    const body = await request.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

    const configured = emailDeliveryConfigured();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({
        ok: true,
        message: genericMessage,
        attemptedEmailDelivery: false,
        emailSent: false,
        emailDeliveryConfigured: configured,
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json({
        ok: true,
        message: genericMessage,
        attemptedEmailDelivery: false,
        emailSent: false,
        emailDeliveryConfigured: configured,
      });
    }

    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    });

    const token = randomBytes(TOKEN_BYTES).toString("hex");
    const expiresAt = new Date(Date.now() + EXPIRY_MS);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    const base = trustedAppBaseUrl(request);
    const resetUrl = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    const { sent, error: sendErr } = await sendPasswordResetEmail(email, resetUrl);

    if (!sent) {
      console.error("[BrainDump] Password reset email was not sent.", sendErr ?? "unknown", { email });
      if (process.env.NODE_ENV === "development") {
        console.info("[BrainDump] Password reset link (dev fallback):", resetUrl);
      }
    }

    return NextResponse.json({
      ok: true,
      message: genericMessage,
      attemptedEmailDelivery: true,
      emailSent: sent,
      emailDeliveryConfigured: configured,
      ...(process.env.NODE_ENV === "development" && !sent ? { devResetUrl: resetUrl } : {}),
    });
  } catch (e) {
    console.error("forgot-password error:", e);
    return NextResponse.json({
      ok: true,
      message: genericMessage,
      attemptedEmailDelivery: false,
      emailSent: false,
      emailDeliveryConfigured: emailDeliveryConfigured(),
    });
  }
}
