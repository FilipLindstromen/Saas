import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { prismaErrorMeta } from "@/lib/prisma-error-meta";
import { resolveDatabaseUrl } from "@/lib/database-url";
import { sendPasswordResetEmail } from "@/lib/send-password-reset-email";

export const runtime = "nodejs";

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
  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Database is not configured on the server. Set DATABASE_URL or NEON_DATABASE_URL / POSTGRES_URL, then redeploy.",
        },
        { status: 503 }
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid request body." }, { status: 400 });
    }
    const email =
      typeof (body as { email?: unknown }).email === "string"
        ? (body as { email: string }).email.trim().toLowerCase()
        : "";

    const configured = emailDeliveryConfigured();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { ok: false, error: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return NextResponse.json({ ok: false, error: "Email doesn't exist" }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json(
        {
          ok: false,
          error: "No password is set for this account. Sign in with Google or Apple if you used those.",
        },
        { status: 400 }
      );
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
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });
      if (process.env.NODE_ENV === "development") {
        console.info("[BrainDump] Password reset link (dev fallback):", resetUrl);
      }
    }

    const message = sent
      ? "We sent a password reset link to your email. Check your inbox and spam folder. The link expires in 1 hour."
      : !configured
        ? "No email was sent: this deployment is missing RESEND_API_KEY. The site owner must add a Resend API key (and usually EMAIL_FROM with a verified domain) in the server environment."
        : "No email was sent: Resend rejected the message or delivery failed. Try again later, check spam, or contact support. Owners should verify RESEND_API_KEY, EMAIL_FROM, and domain verification in the Resend dashboard.";

    return NextResponse.json({
      ok: true,
      message,
      attemptedEmailDelivery: true,
      emailSent: sent,
      emailDeliveryConfigured: configured,
      ...(process.env.NODE_ENV === "development" && !sent ? { devResetUrl: resetUrl } : {}),
    });
  } catch (e) {
    const { code, message } = prismaErrorMeta(e);
    console.error("forgot-password error:", code ?? "no-code", message, e);

    if (
      code === "P2009" ||
      code === "P2021" ||
      code === "P2022" ||
      /password_reset|PasswordResetToken|does not exist|relation/i.test(message)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Password reset is not fully set up on the server (database missing reset-token table). Ask the administrator to run: npx prisma db push — against production — then redeploy.",
          attemptedEmailDelivery: false,
          emailSent: false,
          emailDeliveryConfigured: emailDeliveryConfigured(),
        },
        { status: 503 }
      );
    }

    if (
      code === "P1001" ||
      code === "P1000" ||
      code === "P1013" ||
      code === "P1017" ||
      /connect|ECONNREFUSED|timeout|certificate/i.test(message)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Cannot reach the database right now. Try again in a moment. If this persists, the server database URL or network access may be misconfigured.",
          attemptedEmailDelivery: false,
          emailSent: false,
          emailDeliveryConfigured: emailDeliveryConfigured(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          process.env.NODE_ENV === "development"
            ? `Password reset failed (${code ?? "error"}): ${message}`
            : "Something went wrong. Please try again.",
        attemptedEmailDelivery: false,
        emailSent: false,
        emailDeliveryConfigured: emailDeliveryConfigured(),
      },
      { status: 500 }
    );
  }
}
